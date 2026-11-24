import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookmarkSimple, Check, Microphone, Play, Repeat, SkipBack, SkipForward, Stop, UploadSimple } from "@phosphor-icons/react";
import { clockTime, cueAtTime, parseSubtitles, validateProgress, readProgress, shadowDb, writeProgress } from "./shadowingStore";
import "./shadowing.css";
import SubtitleEditor from "./SubtitleEditor";
import ShadowStudyTools from "./ShadowStudyTools";
import {exportStudyPdf,readRestoreFile} from "../../../src/lib/studyDocuments";

const LIBRARY_URL = new URL("./shadowing/library.json", document.baseURI).href;
const assetUrl = (path) => new URL(path, LIBRARY_URL).href;
const makeId = () => crypto.randomUUID();

function Player({ item, saved, update, onBack, onBusyChange, onAddExpression }) {
  const [cues, setCues] = useState(saved.customCues || (item.imported ? item.cues || [] : []));
  const [loading, setLoading] = useState(!item.imported);
  const [error, setError] = useState("");
  const [time, setTime] = useState(saved.time || 0);
  const [duration, setDuration] = useState(item.duration || 0);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState("text");
  const [hidden, setHidden] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [translations, setTranslations] = useState(true);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [recording, setRecording] = useState(false);
  const [pendingMic, setPendingMic] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioType, setAudioType] = useState("audio/webm");
  const video = useRef(null);
  const recorder = useRef(null);
  const streamRef = useRef(null);
  const mounted = useRef(true);
  const allowSave = useRef(false);
  const currentTime = useRef(time);
  const latestUpdate = useRef(update);
  const loopRange = useRef(null);
  const onceRange = useRef(null);
  const cueRefs = useRef({});
  const transcriptRef = useRef(null);
  const recordingPosition = useRef(null);
  const micRequest = useRef(0);
  const active = cueAtTime(cues, time);
  const cueIndex = active >= 0 ? active : selected;
  const cue = cues[cueIndex];
  latestUpdate.current = update;
  currentTime.current = time;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      micRequest.current += 1;
      allowSave.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      latestUpdate.current({ time: currentTime.current });
    };
  }, []);

  useEffect(() => {
    if (item.imported || saved.customCues) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    fetch(assetUrl(item.cues || `transcripts/${item.id}.json`), { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error("字幕读取失败"); return r.json(); })
      .then((data) => { if (!Array.isArray(data.cues)) throw new Error("字幕格式不正确"); setCues(data.cues); })
      .catch((e) => { if (e.name !== "AbortError") setError(`${e.message}，仍可播放视频或导入自己的字幕。`); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [item.id, item.imported, item.cues]);

  useEffect(() => {
    let cancelled = false;
    let url;
    setAudioUrl("");
    if (!cue) return;
    shadowDb("recordings", "readonly", "get", `${item.id}:${cue.id}`)
      .then((entry) => {
        if (cancelled || !entry?.blob) return;
        url = URL.createObjectURL(entry.blob);
        setAudioType(entry.blob.type);
        setAudioUrl(url);
      }).catch((e) => { if (!cancelled) setError(`无法读取本机录音：${e.message}`); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [item.id, cue?.id]);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => { if (video.current) video.current.playbackRate = rate; }, [rate]);
  useEffect(() => { loopRange.current = loop && cue ? { start: cue.start, end: cue.end } : null; }, [loop, cue?.id, cues]);
  const scrollCue = (index) => {
    const container = transcriptRef.current, target = cueRefs.current[index];
    if (!container || !target) return;
    const box = container.getBoundingClientRect(), row = target.getBoundingClientRect();
    if (row.top < box.top + 44 || row.bottom > box.bottom - 12) {
      container.scrollTop += row.top - box.top - container.clientHeight / 3;
    }
  };
  useEffect(() => { if (tab === "text" && active >= 0) scrollCue(active); }, [active, tab]);

  const playCue = (index, once = false) => {
    if (!cues.length || recording || pendingMic) return;
    const next = Math.max(0, Math.min(cues.length - 1, index));
    const range = cues[next];
    setSelected(next);
    setTime(range.start);
    if (loop) loopRange.current = { start: range.start, end: range.end };
    onceRange.current = once ? { end: range.end, index: next, start: range.start } : null;
    video.current.currentTime = range.start;
    video.current.play().catch((e) => setError(`播放失败：${e.message}`));
    scrollCue(next);
  };

  const timeUpdate = () => {
    const el = video.current;
    if (!el) return;
    if (recording || pendingMic) return;
    const range = loopRange.current;
    if (range && el.currentTime >= range.end - 0.04) {
      el.currentTime = range.start;
      setTime(range.start);
      return;
    }
    if (onceRange.current && el.currentTime >= onceRange.current.end - 0.04) {
      const range = onceRange.current;
      const stoppedAt = Math.max(range.start, range.end - 0.08);
      el.currentTime = stoppedAt;
      el.pause();
      onceRange.current = null;
      setSelected(range.index);
      setTime(stoppedAt);
      return;
    }
    setTime(el.currentTime);
    const index = cueAtTime(cues, el.currentTime);
    if (index >= 0) setSelected(index);
  };

  const startRecording = async () => {
    if (!cue || pendingMic || recording) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("当前环境不支持录音。请在桌面软件中打开，并允许麦克风权限。"); return;
    }
    setPendingMic(true);
    setError("");
    video.current.pause();
    recordingPosition.current = video.current.currentTime;
    const recordingKey = `${item.id}:${cue.id}`;
    const request = ++micRequest.current;
    let timeout;
    try {
      const acquisition = navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        if (!mounted.current || request !== micRequest.current) {
          stream.getTracks().forEach((track) => track.stop());
          throw new Error("麦克风请求已取消");
        }
        return stream;
      });
      const stream = await Promise.race([acquisition, new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("麦克风响应超时，请检查系统授权或输入设备后重试")), 15000);
      })]);
      streamRef.current = stream;
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
      const media = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      media.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      media.onerror = () => { if (mounted.current) setError("录音发生错误，请停止后重新录制。"); };
      media.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (!allowSave.current || !mounted.current) return;
        const blob = new Blob(chunks, { type: media.mimeType || type || "audio/webm" });
        if (!blob.size) { setError("没有录到声音，请检查麦克风后重试。"); setRecording(false); return; }
        setAudioType(blob.type);
        setAudioUrl(URL.createObjectURL(blob));
        try {
          await shadowDb("recordings", "readwrite", "put", { blob, createdAt: Date.now(), text: cue.text }, recordingKey);
          latestUpdate.current({ lastPracticedAt: Date.now() });
        } catch (e) { setError(`录音已生成，但保存失败：${e.message}。请先下载录音。`); }
        if (mounted.current) setRecording(false);
      };
      recorder.current = media;
      allowSave.current = true;
      media.start();
      setRecording(true);
    } catch (e) {
      if (mounted.current && request === micRequest.current) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        setError(`无法开始录音：${e.message}。请在系统设置中允许麦克风访问。`);
      }
    } finally {
      clearTimeout(timeout);
      if (request === micRequest.current) {
        micRequest.current += 1;
        if (mounted.current) setPendingMic(false);
      }
    }
  };

  const cancelMicrophone = () => { micRequest.current += 1; setPendingMic(false); };

  const stopRecording = () => { if (recorder.current?.state === "recording") recorder.current.stop(); };
  const setNote = (text) => update({ notes: { ...(saved.notes || {}), [cue?.id ?? "general"]: text } });
  const disabled = recording || pendingMic;
  const openTab = (next) => { if (disabled) return; if (next !== "text") video.current?.pause(); setTab(next); };
  useEffect(() => { onBusyChange?.(disabled); return () => onBusyChange?.(false); }, [disabled, onBusyChange]);

  return <section className={`shadow-player ${readingMode ? "is-reading" : ""}`}>
    <header className="shadow-player-header"><button className="shadow-back" disabled={disabled} onClick={onBack}><ArrowLeft size={18}/>返回素材库</button><button className={saved.favorite ? "shadow-favorite is-selected" : "shadow-favorite"} onClick={() => update({ favorite: !saved.favorite })}><BookmarkSimple weight={saved.favorite ? "fill" : "regular"} size={18}/>{saved.favorite ? "已收藏" : "收藏"}</button></header>
    <div className="shadow-player-layout"><div className="shadow-media-column">
      <video key={item.id} ref={video} src={item.url || assetUrl(item.media)} poster={item.imported ? undefined : assetUrl(item.poster)} controls={!disabled} playsInline preload="metadata" onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); e.currentTarget.currentTime = Math.min(saved.time || 0, Math.max(0, e.currentTarget.duration - 0.1)); e.currentTarget.playbackRate = rate; }} onPlay={(e) => { if (disabled) e.currentTarget.pause(); }} onSeeking={(e) => { if (disabled && recordingPosition.current !== null && Math.abs(e.currentTarget.currentTime - recordingPosition.current) > 0.01) e.currentTarget.currentTime = recordingPosition.current; }} onTimeUpdate={timeUpdate} onPause={() => update({ time: video.current?.currentTime || 0 })} onEnded={() => { if (!loop) update({ completed: true, time: 0 }); }} onError={() => setError("视频无法播放，请检查本地文件是否完整，或重新导入兼容的 MP4 视频。")}/>
      <div className="shadow-title"><h1>{item.title}</h1><p>{item.category} · {clockTime(duration)} · {cues.length ? `${cues.length} 个语句片段` : "无时间轴字幕"}</p><div className="shadow-media-meta"><span>本机离线素材</span><span>{cues.length ? `${cues.length} 条时间轴` : "可导入字幕"}</span><span>逐句跟读</span></div></div>
<aside className="shadow-practice-panel">
      <h2>逐句跟读</h2><p className="shadow-practice-step">先听原音，再录下自己的声音。</p>
      <blockquote>{cue?.text || "选择一句字幕，开始跟读。"}</blockquote>
      <div className="shadow-sentence-nav"><button disabled={!cues.length || cueIndex <= 0 || disabled} aria-label="上一句" onClick={() => playCue(cueIndex - 1)}><SkipBack size={20}/></button><span>{cues.length ? cueIndex + 1 : 0} / {cues.length}</span><button disabled={!cues.length || cueIndex >= cues.length - 1 || disabled} aria-label="下一句" onClick={() => playCue(cueIndex + 1)}><SkipForward size={20}/></button></div>
      <button className="shadow-listen" disabled={!cue || disabled} onClick={() => { setLoop(false); loopRange.current = null; playCue(cueIndex, true); }}><Play size={18}/>听这一句</button>
      {recording ? <button className="shadow-record is-recording" onClick={stopRecording}><Stop size={18} weight="fill"/>停止并保存录音</button> : <button className="shadow-record" disabled={!cue || pendingMic} onClick={startRecording}><Microphone size={18}/>{pendingMic ? "正在打开麦克风……" : "录下我的跟读"}</button>}
      {recording && <p role="status" className="shadow-recording-status">正在录音，请跟读上方这句话。</p>}
      {pendingMic && <button onClick={cancelMicrophone}>取消麦克风请求</button>}
      {audioUrl && <div className="shadow-recorded"><h3>我的录音</h3><audio key={audioUrl} src={audioUrl} controls/><a href={audioUrl} download={`${item.id}-sentence-${cueIndex + 1}.${audioType.includes("mp4") ? "m4a" : "webm"}`}>下载这句录音</a></div>}
      <button className="shadow-complete" aria-pressed={!!saved.completed} onClick={() => update({ completed: !saved.completed })}><Check size={17}/>{saved.completed ? "已完成练习" : "标记本篇已练"}</button>
    </aside></div><div className="shadow-viewer">
      <div className="shadow-toolbar">
        <label>倍速<select aria-label="播放倍速" value={rate} onChange={(e) => setRate(Number(e.target.value))}>{[0.5, 0.75, 1, 1.25, 1.5].map((s) => <option key={s} value={s}>{s}×</option>)}</select></label>
        <button className={loop ? "is-selected" : ""} disabled={!cue || disabled} aria-pressed={loop} onClick={() => setLoop(!loop)}><Repeat size={18}/>{loop ? "单句循环" : "顺序播放"}</button>
        <button aria-pressed={hidden} onClick={() => setHidden(!hidden)}>{hidden ? "显示原文" : "遮住原文"}</button>
        <button disabled={disabled} aria-pressed={readingMode} onClick={() => setReadingMode(!readingMode)}>{readingMode ? "退出阅读模式" : "阅读模式"}</button>
        <button aria-pressed={translations} onClick={() => setTranslations(!translations)}>{translations ? "隐藏译文" : "显示译文"}</button>
        <button disabled={disabled} onClick={() => openTab("words")}>单词训练</button>
        <span className="shadow-time">{clockTime(time)} / {clockTime(duration)}</span>
      </div>
      <div className="shadow-tabbar" role="tablist" aria-label="跟读内容">{[["text","原文"],["analysis","解析"],["words","单词"],["notes","笔记"],...(item.transcript?.length > 0 ? [["dialogue","视频课程"]] : [])].map(([value,label]) => <button key={value} role="tab" disabled={disabled} aria-selected={tab === value} onClick={() => openTab(value)}>{label}</button>)}</div>
      {error && <p className="shadow-error" role="alert">{error}</p>}
      {tab === "text" && <div ref={transcriptRef} className="shadow-transcript" role="tabpanel" aria-label="带时间轴的原文">
        <p className="shadow-subtitle-note">{item.imported ? "个人导入字幕" : "本机自动识别字幕，词语和时间轴可继续校对。"}</p>
        {loading ? <p className="shadow-empty" role="status">正在读取字幕……</p> : cues.length ? cues.map((c, i) => <article className={`shadow-cue-row ${i === cueIndex ? "is-current" : ""}`} key={c.id} ref={(el) => { cueRefs.current[i] = el; }}><button disabled={disabled} className={`shadow-cue ${i === cueIndex ? "is-current" : ""}`} onClick={() => playCue(i)}><time>{clockTime(c.start)}</time><span className={hidden ? "shadow-hidden-text" : ""}>{hidden ? "点击播放，听后跟读" : c.text}</span>{saved.notes?.[c.id] && <BookmarkSimple size={15} aria-label="有笔记"/>}</button>{translations && (c.translation || (saved.analysis?.[c.id]?.ai?.sourceText === c.text && saved.analysis[c.id].ai.translation)) && !hidden && <p className="shadow-inline-translation">{c.translation || saved.analysis?.[c.id]?.ai?.translation}</p>}<button className="shadow-cue-analysis" disabled={disabled} onClick={() => { setSelected(i); setTime(c.start); video.current.pause(); video.current.currentTime=c.start; setTab("analysis"); }}>解析与积累 · 第 {i+1} 句</button></article>) : <p className="shadow-empty">视频可以直接播放。导入同名 SRT / VTT 字幕后可逐句跟读。</p>}
      </div>}
      {(tab === "analysis" || tab === "words") && <ShadowStudyTools key={tab} tab={tab} cue={cue} saved={saved} update={update} playCue={(i,once) => { setLoop(false); loopRange.current=null; playCue(i,once); }} cues={cues} disabled={disabled} onAddExpression={onAddExpression}/>}
      <SubtitleEditor cues={cues} index={cueIndex} duration={duration} disabled={disabled} onSave={(next)=>{setCues(next);update({customCues:next});}}/>
      {tab === "notes" && <div className="shadow-notes" role="tabpanel"><p className="shadow-note-context">{cue?.text || item.title}</p><label htmlFor="shadow-note">这句话的表达、中文理解或发音提醒</label><textarea id="shadow-note" placeholder="写下你想记住的表达……" value={saved.notes?.[cue?.id ?? "general"] || ""} onChange={(e) => setNote(e.target.value)}/><p>笔记自动保存在本机。</p></div>}
      {tab === "dialogue" && <div className="shadow-official-dialogue" role="tabpanel"><p className="shadow-subtitle-note">来源页面提供的课程对话；与视频中的教学、重复练习段落分开显示。</p>{item.transcript.map((p, i) => <p key={i}>{p}</p>)}</div>}
      <details className="shadow-source"><summary>素材来源</summary><p>{item.attribution || "个人本地素材"}</p>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">原课程页面</a>}{item.rightsPolicyUrl && <a href={item.rightsPolicyUrl} target="_blank" rel="noreferrer">来源使用说明</a>}</details>
    </div></div>
  </section>;
}

export default function ShadowingLibrary({ onBusyChange, onAddExpression }) {
  const [library, setLibrary] = useState([]);
  const [imports, setImports] = useState([]);
  const [progress, setProgress] = useState(readProgress);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("全部");
  const [status, setStatus] = useState("正在读取本地素材库……");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [deleted, setDeleted] = useState(null);
  const progressRef = useRef(progress);

  useEffect(() => {
    const controller = new AbortController();
    fetch(LIBRARY_URL, { signal: controller.signal }).then((r) => {
      if (!r.ok) throw new Error("本地素材目录未找到"); return r.json();
    }).then((data) => { if (!Array.isArray(data.items)) throw new Error("素材目录格式不正确"); setLibrary(data.items); setStatus(""); })
      .catch((e) => { if (e.name !== "AbortError") { setStatus(""); setError(`${e.message}。可以先导入自己的 MP4 和字幕。`); } });
    shadowDb("assets", "readonly", "getAll").then(setImports).catch((e) => setError(`个人素材读取失败：${e.message}`));
    return () => controller.abort();
  }, []);

  const update = (id, patch) => {
    const next = { ...progressRef.current, [id]: { ...progressRef.current[id], ...patch, updatedAt: Date.now() } };
    progressRef.current = next;
    setProgress(next);
    try { writeProgress(next); } catch (e) { setError(`保存失败：${e.message}。请检查本机可用空间。`); }
  };

  const items = useMemo(() => [...imports.map((i) => ({ ...i, imported: true, category: "我的素材" })), ...library], [imports, library]);
  const shown = items.filter((i) => (filter === "全部" || (filter === "已收藏" ? progress[i.id]?.favorite : filter === "未练习" ? !progress[i.id]?.completed : i.category === filter)) && `${i.title} ${i.category}`.toLowerCase().includes(search.toLowerCase().trim()));
  const choose = (item) => {
    setError("");
    setSelected(item.imported ? { ...item, url: URL.createObjectURL(item.blob) } : item);
    window.scrollTo(0, 0);
  };
  const leave = () => { if (selected?.url) URL.revokeObjectURL(selected.url); setSelected(null); };

  const importFiles = async (files) => {
    const list = Array.from(files || []);
    const media = list.filter((f) => /\.(mp4|m4v|webm|mov|mp3|m4a|wav|ogg)$/i.test(f.name));
    if (!media.length) { setError("请选择视频或音频，并可同时选择同名 SRT / VTT 字幕。"); return; }
    setImporting(true); setError("");
    try {
      for (const file of media) {
        const stem = file.name.replace(/\.[^.]+$/, "");
        const subtitle = list.find((f) => f.name.replace(/\.(?:en\.)?(srt|vtt)$/i, "") === stem && /\.(srt|vtt)$/i.test(f.name));
        const cues = subtitle ? parseSubtitles(await subtitle.text()) : [];
        if (subtitle && !cues.length) throw new Error(`${subtitle.name} 中没有有效的时间轴字幕`);
        const item = { id: `local-${makeId()}`, title: stem, blob: file, cues, importedAt: Date.now() };
        await shadowDb("assets", "readwrite", "put", item);
        setImports((current) => [item, ...current]);
      }
    } catch (e) { setError(`导入未全部完成：${e.message}。已成功保存的文件仍可使用。`); }
    finally { setImporting(false); }
  };

  return <main className="shell shadow-shell">
    {error && <p role="alert" className="shadow-error">{error}</p>}
    {selected ? <Player key={selected.id} item={selected} saved={progress[selected.id] || {}} update={(patch) => update(selected.id, patch)} onBack={leave} onBusyChange={onBusyChange} onAddExpression={(entry) => onAddExpression?.({...entry,source:`shadowing:${selected.id}`,topics:[selected.category || "影子跟读"]})}/> : <section className="shadow-library">
      <div className="shadow-library-heading"><div><h1>影子跟读</h1><p>{library.length} 个离线视频{imports.length ? ` · ${imports.length} 个个人素材` : ""} · 从生活情景到发音训练</p></div><label className={`shadow-import ${importing ? "is-disabled" : ""}`}><UploadSimple size={18}/>{importing ? "正在保存素材……" : "导入视频与字幕"}<input aria-label="导入视频与同名字幕" type="file" accept="video/*,audio/*,.srt,.vtt" multiple disabled={importing} onChange={(e) => { importFiles(e.target.files); e.target.value = ""; }}/></label></div>
      <div className="shadow-catalog-layout"><aside className="shadow-catalog-sidebar"><h2>素材集合</h2>      <div className="shadow-categories" aria-label="素材分类">{["全部", "生活情景", "进阶情景", "发音训练"].map((name) => <button key={name} aria-pressed={filter === name} onClick={() => setFilter(name)}>{name}</button>)}</div>
      <div className="shadow-backup-tools"><button className="secondary" onClick={()=>exportStudyPdf({format:"ielts-shadowing-progress",version:1,progress},"IELTS-跟读笔记与字幕.pdf",{items,libraryUrl:LIBRARY_URL})}>导出笔记与字幕 PDF</button><label className="secondary">恢复笔记与字幕<input hidden type="file" accept="application/pdf,.pdf,application/json,.json" onChange={async(e)=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>40*1024*1024)throw new Error("备份超过 40 MB");const data=await readRestoreFile(file);if(data.format!=="ielts-shadowing-progress"||!data.progress||typeof data.progress!=="object"||Array.isArray(data.progress))throw new Error("请选择跟读笔记备份");validateProgress(data.progress);const next={...progressRef.current,...data.progress};writeProgress(next);progressRef.current=next;setProgress(next);}catch(error){setError(error.message);}finally{e.target.value="";}}}/></label><small>备份不含视频和录音；单句录音可在练习页下载。</small></div></aside><div className="shadow-catalog-content">      <div className="shadow-filters"><input aria-label="搜索跟读素材" placeholder="搜索课程或情景……" type="search" value={search} onChange={(e) => setSearch(e.target.value)}/><select aria-label="筛选跟读素材" value={filter} onChange={(e) => setFilter(e.target.value)}>{["全部", "生活情景", "进阶情景", "发音训练", "已收藏", "未练习", "我的素材"].map((f) => <option key={f}>{f}</option>)}</select><span>{shown.length} 个素材</span></div>
      {status && <p role="status" className="shadow-empty">{status}</p>}
{deleted&&<p role="status">已移除个人素材。<button className="text-link" onClick={async()=>{try{await shadowDb("assets","readwrite","put",deleted);setImports(list=>[deleted,...list.filter(i=>i.id!==deleted.id)]);setDeleted(null);}catch(e){setError(e.message);}}}>撤销移除</button></p>}<div className="shadow-library-list">{shown.map(item=><article className="shadow-library-row" key={item.id}><button onClick={()=>choose(item)} className="shadow-row-open">{item.poster?<img loading="lazy" src={assetUrl(item.poster)} alt=""/>:<span className="shadow-local-thumb"><Play size={28}/></span>}<span className="shadow-row-duration">{item.duration?clockTime(item.duration):"本地"}</span><span><small>{item.category}{progress[item.id]?.completed?" · 已练习":" · 未练习"}</small><strong>{item.title}</strong></span></button><div className="shadow-video-actions"><span className="shadow-video-state">{progress[item.id]?.completed?"可继续复习":"开始逐句练习"}</span><button className={progress[item.id]?.favorite?"shadow-row-bookmark is-selected":"shadow-row-bookmark"} aria-label={`${progress[item.id]?.favorite?"取消收藏":"收藏"} ${item.title}`} onClick={()=>update(item.id,{favorite:!progress[item.id]?.favorite})}><BookmarkSimple weight={progress[item.id]?.favorite?"fill":"regular"} size={19}/></button>{item.imported&&<button className="shadow-delete" onClick={async()=>{try{const original=imports.find(i=>i.id===item.id);await shadowDb("assets","readwrite","delete",item.id);setDeleted(original);setImports(list=>list.filter(i=>i.id!==item.id));}catch(e){setError(`移除失败：${e.message}`);}}}>移除</button>}</div></article>)}</div>      {!status && !shown.length && <p className="shadow-empty">没有匹配的素材。试试其他关键词或筛选条件。</p>}
    </div></div></section>}
  </main>;
}
