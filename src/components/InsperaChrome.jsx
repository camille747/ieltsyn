import { useId, useRef, useState } from "react";
import { Check, Gear, ListChecks, NotePencil } from "@phosphor-icons/react";
import { readValue, writeValue } from "../lib/persistence";

const hasAnswer = (value) => typeof value === "string" ? Boolean(value.trim()) : Array.isArray(value) ? value.some(hasAnswer) : value && typeof value === "object" ? Object.values(value).some(hasAnswer) : false;

export default function InsperaChrome({ subject, part = 1, totalParts = 3, questionIds = [], responses = {}, activeQuestion, onQuestion, listening = false, questionLabels = {}, isAnswered, storageKey = "practice", contextLabel }) {
  const [panel, setPanel] = useState(null);
  const [notes, setNotes] = useState(() => readValue(`ielts-exam-notes-v1:${storageKey}`, ""));
  const [size, setSize] = useState(16);
  const [error, setError] = useState("");
  const header = useRef(null);
  const panelId = useId();
  const toggle = (name) => setPanel((current) => current === name ? null : name);
  const answered = (id) => isAnswered ? isAnswered(id) : hasAnswer(responses[id]);
  const changeSize = (value) => {
    setSize(value);
    header.current?.closest(".exam-surface")?.style.setProperty("--exam-body-size", `${value}px`);
  };
  return <>
    <header ref={header} className="inspera-chrome">
      <div className="inspera-brand"><a href="https://ieltsyn.com" target="_blank" rel="noreferrer">IELTSyn</a><span>本机练习</span></div>
      <nav className="inspera-tools" aria-label="考场工具">
        <button type="button" aria-expanded={panel === "messages"} aria-controls={panelId} onClick={() => toggle("messages")}><ListChecks size={16}/>练习信息</button>
        <button type="button" aria-expanded={panel === "options"} aria-controls={panelId} onClick={() => toggle("options")}><Gear size={16}/>显示设置</button>
        <button type="button" aria-expanded={panel === "notes"} aria-controls={panelId} onClick={() => toggle("notes")}><NotePencil size={16}/>笔记</button>
      </nav>
    </header>
    {panel && <section id={panelId} className="exam-tool-panel" aria-label="考场工具内容">
      {panel === "messages" && <><h2>本次{subject}练习</h2><p>共 {questionIds.length} {subject === "写作" ? "项任务" : "个题号"}，已填写 {questionIds.filter(answered).length} 项。{listening ? "提交后解锁原文与精听。" : "提交后锁定作答。"}</p><p>笔记保存在本机，不参与评分。</p></>}
      {panel === "options" && <label>答题区字号<select aria-label="答题区字号" value={size} onChange={(e) => changeSize(Number(e.target.value))}>{[16,18,20,22,24].map((n) => <option key={n} value={n}>{n}px</option>)}</select></label>}
      {panel === "notes" && <label>本次练习笔记<textarea aria-label="本次练习笔记" value={notes} onChange={(e) => { const text = e.target.value; setNotes(text); try { writeValue(`ielts-exam-notes-v1:${storageKey}`, text); setError(""); } catch (err) { setError(err.message); } }}/></label>}
      {error && <p role="alert">{error}</p>}
      <button type="button" className="exam-tool-close" onClick={() => setPanel(null)}>收起</button>
    </section>}
    <div className="inspera-context">
      <div><strong>{contextLabel || `Part ${part}`}</strong><span>{listening ? "Listen and answer the questions." : subject === "写作" ? "Write your answer in the space provided." : "Read the passage and answer the questions."}</span></div>
      {questionIds.length > 0 && <div className="inspera-question-strip" aria-label="题号导航">{questionIds.map((id) => <button type="button" key={id} aria-current={String(activeQuestion) === String(id) ? "step" : undefined} className={`${String(activeQuestion) === String(id) ? "active" : ""} ${answered(id) ? "answered" : ""}`} onClick={() => onQuestion?.(id)}>{questionLabels[id] || id}{answered(id) && <Check size={11}/>}</button>)}</div>}
      <small>{contextLabel ? subject : `Part ${part} / ${totalParts}`}</small>
    </div>
  </>;
}

export function InsperaBottomNav({ questionIds = [], activeQuestion, responses = {}, onQuestion, onSubmit, disabled = false, questionLabels = {}, isAnswered }) {
  const current = questionIds.findIndex((id) => String(id) === String(activeQuestion));
  const answered = (id) => isAnswered ? isAnswered(id) : hasAnswer(responses[id]);
  return <footer className="inspera-bottom-nav">
    <div className="inspera-bottom-actions"><button type="button" disabled={disabled || current <= 0} onClick={() => onQuestion?.(questionIds[current - 1])}>上一项</button><button type="button" disabled={disabled || current < 0 || current >= questionIds.length - 1} onClick={() => onQuestion?.(questionIds[current + 1])}>下一项</button></div>
    <nav aria-label="作答导航">{questionIds.map((id) => <button type="button" key={id} aria-current={String(activeQuestion) === String(id) ? "step" : undefined} className={`${String(activeQuestion) === String(id) ? "active" : ""} ${answered(id) ? "answered" : ""}`} onClick={() => onQuestion?.(id)}>{questionLabels[id] || id}</button>)}</nav>
    {onSubmit && <button type="button" className="inspera-review-button" disabled={disabled} onClick={onSubmit}><Check size={16}/>复核并交卷</button>}
  </footer>;
}
