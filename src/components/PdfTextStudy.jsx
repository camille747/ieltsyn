import { useEffect, useRef, useState } from "react";
import AnnotatableText from "./AnnotatableText";
import { Button } from "./Common";
import { readValue, writeValue } from "../lib/persistence";
import { requestAi } from "../lib/aiClient";
import { isReadingTextReport } from "../lib/readingAi";

export default function PdfTextStudy({ text, documentId, page, title, ocr = false }) {
  const key = `ielts-pdf-study-v1:${documentId}:${page}`;
  const [saved, setSaved] = useState(() => readValue(key, {}));
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef(null), contentRef = useRef(null);
  const savedRef = useRef(saved); savedRef.current = saved;
  const annotations = saved.source === text && Array.isArray(saved.annotations) ? saved.annotations : [];
  const report = saved.source === text && typeof saved.excerpt === "string" && isReadingTextReport(saved.report) && saved.report.vocabulary.every((item) => saved.excerpt.includes(item.term)) ? saved.report : null;
  useEffect(() => () => controller.current?.abort(), []);
  const persist = (patch) => {
    const next = { ...savedRef.current, ...patch };
    savedRef.current = next; setSaved(next);
    try { writeValue(key, next); } catch { setError("本机保存失败，请先复制当前笔记或解析，再检查存储空间。"); }
  };
  const selectText = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !contentRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) return;
    const value = selection.toString().trim();
    if (value) setSelected(value);
  };
  const analyze = async () => {
    if (busy) return;
    const excerpt = selected.trim() || text;
    if (!excerpt || excerpt.length > 8000) { setError("请先在左侧选中 8,000 字符以内的文字，再生成解析。"); return; }
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError("");
    try {
      const result = await requestAi("reading/text", { text: excerpt }, abort.signal);
      if (abort.signal.aborted) return;
      if (!isReadingTextReport(result) || result.vocabulary.some((item) => !excerpt.includes(item.term))) throw new Error("解析没有通过原文核对，请重试。");
      persist({ source: text, excerpt, report: result });
    } catch (e) { if (!abort.signal.aborted) setError(e.message); }
    finally { if (controller.current === abort) { controller.current = null; setBusy(false); } }
  };
  return <div className="pdf-text-study">
    <div className="pdf-extracted-copy" ref={contentRef} onMouseUp={selectText} onKeyUp={selectText}>
      <h3>{title} · 第 {page} 页</h3>
      {ocr&&<p className="reading-ai-source">本页为 AI 识别文字，可能存在错漏，请对照 PDF 原页。手写批注请在原页查看，文字批注独立保存。</p>}
      <p className="reading-ai-source">选中单词或句子后可翻译解析；选中后右键可选择颜色、添加笔记。提取文字的顺序以 PDF 排版为准，图表请切回原页。</p>
      {text ? <AnnotatableText as="div" className="pdf-study-passage" text={text} targetId={`pdf:${documentId}:${page}`} annotations={annotations} setAnnotations={(next) => persist({ annotations: next, source: text })}/> : <p>这一页没有可提取的文字，可能是扫描图片。请切回原页阅读；可点击上方“识别本页文字”处理扫描页。</p>}
    </div>
    <aside className="pdf-study-tools">
      <h3>翻译与词义</h3>
      <label className="review-note-field">当前选中内容<textarea value={selected} onChange={(e) => setSelected(e.target.value)} placeholder="选中左侧单词或句子；留空时解析本页文字" maxLength={8000}/></label>
      <div className="review-controls"><Button disabled={busy || !text} onClick={analyze}>{busy ? "正在解析…" : selected ? "解析选中文字" : "解析本页文字"}</Button>{selected && <Button variant="text" onClick={() => setSelected("")}>清空选择</Button>}{busy && <Button variant="text" onClick={() => controller.current?.abort()}>取消</Button>}</div>
      <p className="reading-ai-source">点击后仅发送所选文字给百炼，PDF 文件保留在本机。AI 结果可能有误，请结合原文核对。</p>
      {error && <p role="alert">{error}</p>}
      {report && <div className="pdf-text-report"><details><summary>本次分析原文</summary><p>{saved.excerpt}</p></details><h4>中文翻译</h4><p>{report.translation}</p><h4>句式与意群</h4><p>{report.grammar}</p>{report.vocabulary.length > 0 && <><h4>语境词汇</h4><dl>{report.vocabulary.map((item, index) => <div key={index}><dt>{item.term}</dt><dd>{item.meaning}</dd></div>)}</dl></>}<p className="reading-ai-source">{report.provider || "阿里云百炼"} · {report.model}</p></div>}
      <label className="review-note-field">本页笔记<textarea value={saved.note || ""} onChange={(e) => persist({ note: e.target.value })} placeholder="记录本页要点，与 AI 解析分别保存"/></label>
    </aside>
  </div>;
}
