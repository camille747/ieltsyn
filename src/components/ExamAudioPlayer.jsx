import { useEffect, useRef, useState } from "react";
import { Button } from "./Common";

// This player belongs only to timed exams. Study and intensive listening keep their native controls.
export default function ExamAudioPlayer({ tracks, initialPosition, onCheckpoint }) {
  const [index, setIndex] = useState(() => Math.max(0, Math.min(initialPosition?.index || 0, tracks.length)));
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(initialPosition?.time || 0);
  const [error, setError] = useState("");
  const [volume, setVolume] = useState(1);
  const audio = useRef(null);
  const position = useRef({ index, time, started: Boolean(initialPosition?.started) });
  const checkpoint = useRef(onCheckpoint); checkpoint.current = onCheckpoint;
  const lastSaved = useRef(time);
  const continuePlayback = useRef(false);
  const loading = useRef(true);
  const finished = index >= tracks.length;
  const start = () => {
    setError("");
    audio.current?.play().then(() => { position.current.started = true; setPlaying(true); checkpoint.current(position.current); })
      .catch(() => { setPlaying(false); setError("音频未能开始播放，请检查输出设备后重试；已保存的播放位置保留。"); });
  };
  useEffect(() => () => { checkpoint.current(position.current); }, []);
  return <section className="exam-audio-player" aria-label="模考连续音频">
    <div><strong>{finished ? "本场听力音频播放完毕" : `正在使用 ${tracks[index]?.label} 音频`}</strong><p>开始后按顺序连续播放，不提供暂停、回退或倍速。切换题页不会切换音频；离开模考页面时保存播放位置。</p></div>
    {!finished && <>
      <audio key={index} ref={audio} preload="metadata" src={tracks[index]?.src}
        onLoadedMetadata={() => { audio.current.volume = volume; loading.current = true; audio.current.currentTime = position.current.index === index ? position.current.time : 0; loading.current = false; if (continuePlayback.current) start(); }}
        onPlay={() => setPlaying(true)} onPause={() => { setPlaying(false); checkpoint.current(position.current); }}
        onSeeking={() => { if (!loading.current && Math.abs(audio.current.currentTime - position.current.time) > 0.5) audio.current.currentTime = position.current.time; }}
        onTimeUpdate={() => { if (audio.current.seeking) return; const next = audio.current.currentTime; position.current = { index, time: next, started: position.current.started || !audio.current.paused }; setTime(next); if (Math.abs(next - lastSaved.current) >= 5) { lastSaved.current = next; checkpoint.current(position.current); } }}
        onEnded={() => { const next = index + 1; position.current = { index: next, time: 0, started: true }; checkpoint.current(position.current); loading.current = true; continuePlayback.current = true; lastSaved.current = 0; setTime(0); setPlaying(false); setIndex(next); }}
        onError={() => { setPlaying(false); setError("本段音频读取失败，请检查本地素材后重试。"); }}/>
      {!playing && <Button onClick={start}>{position.current.started ? "从已保存位置继续" : "开始模考音频"}</Button>}
      <span role="status">{playing ? "连续播放中" : "等待播放"} · {Math.floor(time/60)}:{String(Math.floor(time%60)).padStart(2,"0")}</span>
      <label>音量<input aria-label="模考音量" type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => { const value=Number(e.target.value); setVolume(value); if (audio.current) audio.current.volume = value; }}/></label>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
