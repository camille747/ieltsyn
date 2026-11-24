import { useEffect, useState } from "react";
import { ClockCounterClockwise, Trash } from "@phosphor-icons/react";
import { Button } from "./Common";
import { StudyEmpty } from "./LearningUI";
import { deleteStudyActivity, getStudyHistory, LOCAL_STUDY_EVENT, restoreStudyActivity } from "../lib/localStudyStore";
import { exportStudyPdf } from "../lib/studyDocuments";
import { localDayKey } from "../lib/studyCalendar";
function AnswerList({value,details=[]}) {
  if(typeof value!=="object"||value===null)return <p className="preserve-lines">{String(value||"未作答")}</p>;
  if(Array.isArray(value))return <p>{value.join("、")||"未作答"}</p>;
  return <dl className="history-answers">{Object.entries(value).map(([key,answer])=><div key={key}><dt>{details.find(d=>d.id===key)?.title||(/^\d+$/.test(key)?`题 ${key}`:key==="essay"?"作文":"作答")}</dt><dd><AnswerList value={answer}/></dd></div>)}</dl>;
}
export default function PracticeHistory({subject,onOpen,date}) {
  const [history,setHistory]=useState(getStudyHistory);
  const [selectedId,setSelectedId]=useState(null);
  const [deleted,setDeleted]=useState(null);
  const [filter,setFilter]=useState("全部");
  useEffect(()=>{const refresh=()=>setHistory(getStudyHistory());window.addEventListener(LOCAL_STUDY_EVENT,refresh);return()=>window.removeEventListener(LOCAL_STUDY_EVENT,refresh);},[]);
  useEffect(()=>setSelectedId(null),[subject,date,filter]);
  const items=history.filter(item=>(!subject||item.subject===subject)&&(filter==="全部"||item.subject===filter)&&(!date||((item.submitted||item.attempt)&&localDayKey(item.submittedAt||item.updatedAt)===date)));
  const selected=items.find(item=>item.id===selectedId);
  return <section className="practice-history-view">
    <div className="ui-history-toolbar"><span>{items.length} 条{subject||"学习"}记录{date?` · ${date}`:" · 保存在本机"}</span>{!subject&&<label>科目<select value={filter} onChange={e=>setFilter(e.target.value)}>{["全部","听力","阅读","写作","口语"].map(s=><option key={s}>{s}</option>)}</select></label>}</div>
    {deleted&&<div className="history-undo" role="status">记录已删除<Button variant="text" onClick={()=>{restoreStudyActivity(deleted);setDeleted(null);}}>撤销删除</Button></div>}
    {items.length?<div className="ui-history-layout"><div className="ui-history-list" aria-label="练习记录列表">{items.map(item=><article className={`ui-history-row ${selectedId===item.id?"is-selected":""}`} key={item.id}><button className="ui-history-open" aria-pressed={selectedId===item.id} onClick={()=>setSelectedId(item.id)}><span>{item.subject} · {new Date(item.submittedAt||item.updatedAt).toLocaleString("zh-CN")}</span><strong>{item.title}</strong><small>{item.detail||"草稿"}{Number.isFinite(item.score)?` · 练习估分 ${item.score}`:""}</small></button><button className="ui-history-delete" aria-label={`删除${item.title}记录`} title="删除，可撤销" onClick={()=>{deleteStudyActivity(item.id);setDeleted(item);if(selectedId===item.id)setSelectedId(null);}}><Trash size={18}/></button></article>)}</div>
    {selected?<article className="ui-history-detail" aria-label="所选练习详情"><h2>{selected.title}</h2><p>{new Date(selected.submittedAt||selected.updatedAt).toLocaleString("zh-CN")} · {selected.detail||"练习草稿"}</p>{Number.isFinite(selected.score)&&<p>练习估分 <b>{selected.score} 分</b>{selected.rawTotal?` · 答对 ${selected.rawScore}/${selected.rawTotal}`:""}</p>}{onOpen&&(selected.intent?.itemId||selected.intent?.articleId||selected.intent?.archiveItemId||selected.prompt)&&<Button onClick={()=>onOpen(selected)}>打开原题与复盘</Button>}<details open><summary>本次作答</summary><AnswerList value={selected.responses||{}} details={selected.details}/></details>{selected.details?.map(d=><details key={d.id}><summary>{d.title}</summary>{d.questions?.map(q=><p key={q.id}>题 {q.id}：{q.correct?"正确":"错误"} · 你的答案 {String(q.response)} · 正确答案 {q.expected}</p>)}</details>)}<Button variant="ghost" onClick={()=>exportStudyPdf(selected,"IELTS-练习记录.pdf")}>导出本次记录 PDF</Button></article>:<StudyEmpty icon={ClockCounterClockwise} title="选择一条记录" description="在左侧选择练习，对照当次作答、分数与复盘。"/>}</div>:<StudyEmpty icon={ClockCounterClockwise} title={`还没有${subject||""}练习记录`} description={date?"这个日期没有已提交的练习，可以选择其他日期。":"完成一次练习后，作答和复盘会保存在这里。"}/>}
  </section>;
}
