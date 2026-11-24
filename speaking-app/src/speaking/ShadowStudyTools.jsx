import { useEffect, useRef, useState } from "react";
import { Play, Plus, Trash } from "@phosphor-icons/react";
import { requestShadowAnalysis } from "./modelAdapter";

export default function ShadowStudyTools({ tab, cue, saved, update, playCue, cues, disabled, onAddExpression }) {
  const [text, setText] = useState("");
  const [meaning, setMeaning] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [index, setIndex] = useState(0);
  const [notice, setNotice] = useState("");
  const [removed, setRemoved] = useState(null);
  const [question, setQuestion] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const aiRequest = useRef(null), latest = useRef({ saved, update, cue });
  latest.current = { saved, update, cue };
  useEffect(() => () => { aiRequest.current?.abort(); }, []);
  useEffect(() => { aiRequest.current?.abort(); aiRequest.current = null; setAiBusy(false); }, [cue?.id]);
  const entries = saved.vocabulary || [];
  const entry = entries[Math.min(index, entries.length - 1)];
  useEffect(() => setIndex((current) => Math.max(0, Math.min(current, entries.length - 1))), [entries.length]);
  const analysis = saved.analysis?.[cue?.id] || {};
  useEffect(() => { setNotice(""); setQuestion(""); }, [cue?.id,tab]);
  useEffect(() => setRevealed(false), [entry?.id]);
  const patchAnalysis = (field,value) => update({analysis:{...(saved.analysis || {}),[cue.id]:{...analysis,[field]:value}}});
  const generate = async (followup = "") => {
    if (!cue || aiRequest.current) return;
    const original = cue, controller = new AbortController(); aiRequest.current = controller; setAiBusy(true); setNotice("");
    try {
      const result = await requestShadowAnalysis({ sentence: original.text, question: followup }, controller.signal);
      const current = latest.current;
      if (controller.signal.aborted || current.cue?.id !== original.id || current.cue?.text !== original.text) return;
      const previous = current.saved.analysis?.[original.id] || {};
      current.update({analysis:{...current.saved.analysis,[original.id]:{...previous,...(followup?{aiQuestions:[...(previous.aiQuestions || []),{question:followup,answer:result.answer,model:result.model}]}:{ai:{...result,sourceText:original.text}})}}});
      if (followup) setQuestion(""); setNotice("AI 解析已保存到本机，你的个人笔记仍保留。");
    } catch (e) { if (!controller.signal.aborted) setNotice(e.message); }
    finally { if (aiRequest.current === controller) { aiRequest.current = null; if (!controller.signal.aborted) setAiBusy(false); } }
  };
  const ai = analysis.ai?.sourceText === cue?.text ? analysis.ai : null;
  const add = (e) => {
    e.preventDefault(); if (!text.trim() || !cue) return;
    if (entries.some((item) => item.text.toLowerCase() === text.trim().toLowerCase() && item.cueId === cue.id)) { setNotice("这句话中已积累这个表达。"); return; }
    update({vocabulary:[...entries,{id:crypto.randomUUID(),text:text.trim(),meaning:meaning.trim(),example:cue.text,cueId:cue.id,learned:false}]});
    setText(""); setMeaning(""); setNotice("已加入本篇单词训练。");
  };
  const listen = () => { const at = cues.findIndex((c) => c.id === entry.cueId); if (at >= 0) playCue(at,true); };
  return <section className="shadow-study-tools" role="tabpanel" aria-label={tab === "analysis" ? "当前句解析" : "单词训练"}>
    {tab === "analysis" ? <>
      <h2>当前句解析</h2><blockquote>{cue?.text || "选择一句原文开始整理。"}</blockquote>
      {cue?.translation && <p className="shadow-inline-translation">{cue.translation}</p>}
      <p className="shadow-subtitle-note">生成时只发送当前句及你的问题至百炼，解析与个人笔记保存在本机。</p>
      <button disabled={!cue || disabled || aiBusy} onClick={() => generate()}>{aiBusy?"正在分析当前句……":ai?"重新生成本句解析":"生成翻译与句子解析"}</button>
      {ai&&<div className="shadow-ai-analysis"><h3>本句翻译</h3><p>{ai.translation}</p><h3>搭配与表达</h3><p>{ai.collocations}</p><h3>语法与意群</h3><p>{ai.grammar}</p><small>百炼 · {ai.model} · AI 解析，请结合原文核对</small></div>}
      <label>搭配积累<textarea disabled={!cue || disabled} value={analysis.collocations || ""} placeholder="记录这句话中的常用搭配、含义与例句" onChange={(e) => patchAnalysis("collocations",e.target.value)}/></label>
      <label>语法分析<textarea disabled={!cue || disabled} value={analysis.grammar || ""} placeholder="记录意群、句子结构与自己的疑问" onChange={(e) => patchAnalysis("grammar",e.target.value)}/></label>
      <h3>继续提问</h3><p>围绕当前句询问语法、搭配或含义。</p>
      {(analysis.questions || []).map((q,i) => <p className="shadow-saved-question" key={i}>{q}</p>)}
      {(analysis.aiQuestions || []).map((item,i)=><div className="shadow-saved-question" key={i}><strong>{item.question}</strong><p>{item.answer}</p></div>)}
      <form onSubmit={(e) => { e.preventDefault(); if (question.trim()) generate(question.trim()); }}><label>关于这句话的问题<input value={question} disabled={disabled||aiBusy} onChange={(e) => setQuestion(e.target.value)} placeholder="如：这里为什么使用过去完成时？"/></label><button disabled={!cue || disabled || aiBusy || !question.trim()} type="submit">{aiBusy?"正在回答……":"向 AI 提问"}</button></form>
    </> : <>
      <h2>单词训练</h2><p>从本篇原文积累表达，先回忆含义，再对照原句。</p>
      {entry ? <div className="shadow-word-recall"><span>{Math.min(index,entries.length-1)+1} / {entries.length} · {entry.learned ? "已掌握" : "待复习"}</span><h3>{entry.text}</h3><button aria-pressed={revealed} onClick={() => setRevealed(!revealed)}>{revealed ? "遮住含义" : "显示含义与原句"}</button>{revealed && <><p>{entry.meaning || "尚未填写含义，可回到积累表单补充。"}</p><blockquote>{entry.example}</blockquote></>}<button disabled={disabled} onClick={listen}><Play size={16}/>听原句</button><div className="shadow-word-nav"><button disabled={index <= 0} onClick={() => setIndex(Math.max(0,index-1))}>上一个</button><button aria-pressed={entry.learned} onClick={() => update({vocabulary:entries.map((item) => item.id === entry.id ? {...item,learned:!item.learned} : item)})}>{entry.learned ? "改为待复习" : "标记已掌握"}</button><button disabled={index >= entries.length-1} onClick={() => setIndex(index+1)}>下一个</button></div></div> : <p className="shadow-empty">本篇还没有积累表达。选一句原文，在下方添加。</p>}
    </>}
    <form className="shadow-vocabulary-form" onSubmit={add}><h3>积累当前句中的表达</h3><label>单词或短语<input aria-label="要积累的单词或短语" disabled={!cue || disabled} value={text} onChange={(e) => setText(e.target.value)} placeholder="输入想记住的词或搭配"/></label><label>含义 / 使用提醒<input aria-label="表达含义" disabled={disabled} value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder="写下你的中文理解"/></label><button type="submit" disabled={!cue || disabled || !text.trim()}><Plus size={16}/>加入单词训练</button></form>
    {entries.length > 0 && <details><summary>本篇表达积累 · {entries.length} 条</summary>{entries.map((item) => <div className="shadow-word-row" key={item.id}><div><strong>{item.text}</strong><label>含义<input aria-label={`${item.text} 的含义`} value={item.meaning} onChange={(e) => update({vocabulary:entries.map((word) => word.id === item.id ? {...word,meaning:e.target.value} : word)})}/></label></div><button onClick={() => { try { onAddExpression?.(item); setNotice("已保存到口语首页的个人表达积累。"); } catch(e) { setNotice(e.message); } }}>加入个人表达</button><button aria-label={`移除 ${item.text}`} onClick={() => { setRemoved(item); update({vocabulary:entries.filter((word) => word.id !== item.id)}); setIndex(0); }}><Trash size={16}/></button></div>)}</details>}
    {removed && <p role="status">已移除 {removed.text}。<button onClick={() => { update({vocabulary:[...entries.filter((word) => word.id !== removed.id),removed]}); setRemoved(null); }}>撤销</button></p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
