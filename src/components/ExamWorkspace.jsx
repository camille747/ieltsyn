import { exportStudyPdf } from "../lib/studyDocuments";
import { StepOutline } from "./LearningUI";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Clock, LockSimple, Play } from "@phosphor-icons/react";
import { Button, PageHeading, Segmented } from "./Common";
import { PracticeGroup, listeningDataPath, listeningAudioPath } from "../pages/Listening";
import { ReadingPassage, ReadingQuestionGroup, articleQuestionIds, articleResults } from "./ReadingPractice";
import { createExam, examSections, secondsRemaining, changeExamAnswer, lockSection, advanceSection } from "../lib/examEngine";
import { readValue, writeValue } from "../lib/persistence";
import { recordStudyActivity } from "../lib/localStudyStore";
import { requestWritingFeedback } from "../lib/aiClient";
import { writingSectionBand } from "../lib/aiReports";
import WritingReport from "./WritingReport";
import InsperaChrome, { InsperaBottomNav } from "./InsperaChrome";
import ExamAudioPlayer from "./ExamAudioPlayer";
import { buildExamResult, flushExamHistory } from "../lib/examResults";
import { hasResponseForQuestion } from "../lib/listeningScoring";

export const wordCount = (text = "") => text.trim().split(/\s+/).filter(Boolean).length;
const format = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2,"0")}:${(seconds % 60).toString().padStart(2,"0")}`;
export function WritingPrompt({ topic }) {
  return <section className="exam-writing-prompt"><h2>{topic.task || "Task 2"}</h2><p>{topic.essayQuestion}</p>{topic.image && <img src={topic.image} alt="Task 1 原题图表与题干"/>}<small>{topic.source || [topic.sourceSheet, topic.sourceRow && `第 ${topic.sourceRow} 行`].filter(Boolean).join(" · ")}</small></section>;
}
export default function ExamWorkspace({ mode = "full", selectedItems, onExit, onActiveChange = () => {} }) {
  const storeKey = `ielts-exam-v2:${mode}`;
  const [exam, setExam] = useState(() => readValue(storeKey));
  const [selection, setSelection] = useState(0);
  const [focusedNav, setFocusedNav] = useState(null);
  const [remaining, setRemaining] = useState(() => secondsRemaining(exam?.deadline || 0));
  const [annotations, setAnnotations] = useState([]);
  const [error, setError] = useState("");
  const [storageError,setStorageError] = useState("");
  const [historyError,setHistoryError] = useState("");
  const [loadError,setLoadError] = useState("");
  const [loadAttempt,setLoadAttempt] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [writingReview,setWritingReview] = useState(null);
  const [aiBusy,setAiBusy] = useState(false);
  const aiRequest = useRef(null);
  useEffect(()=>()=>aiRequest.current?.abort(),[]);
  const latest = useRef(exam); latest.current = exam;
  const sections = mode === "writing" ? [examSections[2]] : examSections;
  const subject = sections[exam?.phase || 0]?.subject;
  const items = subject === "听力" ? exam?.items.listening : subject === "阅读" ? exam?.items.reading : exam?.items.writing;
  const item = items?.[selection] || items?.[0];
  const [listeningData, setListeningData] = useState({});
  const ready = subject !== "听力" || (items || []).every((entry) => listeningData[entry.id]);
  const persist = (value) => { try { writeValue(storeKey, value); setStorageError(""); return true; } catch(e) { setStorageError(e.message); return false; } };
  const commit = (value) => { latest.current = value; setExam(value); persist(value); };
  useEffect(() => { onActiveChange(Boolean(exam && exam.status !== "finished")); }, [exam?.status]);
  useEffect(() => {
    if (!exam?.items?.listening?.length) return;
    const controller=new AbortController();setLoadError("");
    Promise.all(exam.items.listening.map(async (entry) => { const response = await fetch(`/${listeningDataPath(entry)}`,{signal:controller.signal}); if (!response.ok) throw new Error(`${entry.title} 题目读取失败`); const data=await response.json();if(!Array.isArray(data.questionIds)||!Array.isArray(data.groups)||!data.answerKey)throw new Error(`${entry.title} 题目内容无效`);return [entry.id,data]; })).then((entries) => { if (!controller.signal.aborted) setListeningData(Object.fromEntries(entries)); }).catch((e) => { if (!controller.signal.aborted) setLoadError(`${e.message}，可以重新读取；已填答案仍保留。到时仍将锁定并进入下一科。`); });
    return () => controller.abort();
  }, [exam?.id,loadAttempt]);
  const retryHistory = () => {if(!latest.current)return;const result=flushExamHistory(latest.current,recordStudyActivity);setHistoryError(result.error);commit(result.state);};
  useEffect(()=>{if(exam?.pendingHistory?.length)retryHistory();},[exam?.id,exam?.pendingHistory?.join("|")]);
  useEffect(()=>{
    if(!exam||!Object.keys(listeningData).length)return;
    const old=exam.results.find(result=>result.subject==="听力"&&result.unscored);
    if(!old||!exam.items.listening.every(item=>listeningData[item.id]))return;
    const repaired={...old,...buildExamResult({...exam,phase:0},listeningData,old.automatic)};
    commit({...latest.current,results:latest.current.results.map(result=>result===old?repaired:result),pendingHistory:[...new Set([...(latest.current.pendingHistory||[]),"听力"])]});
  },[listeningData,exam?.id,exam?.results]);
  const submit = (automatic = false) => {
    const state = latest.current;
    if (!state || state.status !== "active" || (!automatic && !ready)) return;
    const next = lockSection(state, buildExamResult(state,listeningData,automatic));
    const result = next.results.at(-1);
    next.pendingHistory=[...new Set([...(state.pendingHistory||[]),result.subject])];
    setConfirming(false); commit(next);
  };
  const submitRef = useRef(submit); submitRef.current = submit;
  useEffect(() => {
    if (exam?.status !== "active") return;
    const tick = () => { const left = secondsRemaining(latest.current.deadline); setRemaining(left); if (!left) submitRef.current(true); };
    tick(); const timer = setInterval(tick,500); return () => clearInterval(timer);
  }, [exam?.id,exam?.phase,exam?.status,ready]);
  useEffect(() => {
    if (exam?.status !== "locked") return;
    const timer = setTimeout(()=>{ commit(advanceSection(latest.current)); setSelection(0); setAnnotations([]); },1500);
    return ()=>clearTimeout(timer);
  },[exam?.status,exam?.phase]);
  const setAnswer = (key,value) => { const next = changeExamAnswer(latest.current,key,value); if (next !== latest.current) commit(next); else if (secondsRemaining(latest.current.deadline)===0) submit(true); };
  const start = () => { if (!selectedItems) return; commit(createExam(typeof selectedItems === "function" ? selectedItems() : selectedItems,mode)); setSelection(0); setAnnotations([]); };
  const generateWriting = async () => {
    const snapshot=latest.current, topic=snapshot?.items.writing.find((item)=>item.id===writingReview);
    if(!topic||aiRequest.current||snapshot.status!=="finished")return;
    const writing=snapshot.results.find((result)=>result.subject==="写作"), controller=new AbortController();
    aiRequest.current=controller;setAiBusy(true);setError("");
    try {
      const report=await requestWritingFeedback(topic,writing.responses[topic.id]||"",controller.signal);
      if(controller.signal.aborted||latest.current?.id!==snapshot.id)return;
      const reports={...latest.current.writingReports,[topic.id]:report};
      const score=writingSectionBand(snapshot.items.writing,reports);
      const results=latest.current.results.map((result)=>result.subject!=="写作"?result:{...result,score,aiReports:reports,details:result.details.map((detail)=>detail.id===topic.id?{...detail,aiReport:report}:detail)});
      commit({...latest.current,writingReports:reports,results,pendingHistory:[...new Set([...(latest.current.pendingHistory||[]),"写作"])]});
    }catch(e){if(!controller.signal.aborted)setError(e.message);}
    finally{if(aiRequest.current===controller){aiRequest.current=null;if(!controller.signal.aborted)setAiBusy(false);}}
  };
  const alerts = (storageError||historyError||loadError||error) ? <div className="error-panel" role="alert">{[storageError,historyError,loadError,error].filter(Boolean).map(message=><p key={message}>{message}</p>)}{storageError&&<Button onClick={()=>persist(latest.current)}>重试保存本场</Button>}{historyError&&<Button onClick={retryHistory}>重试写入记录</Button>}{loadError&&<Button onClick={()=>setLoadAttempt(value=>value+1)}>重新读取题目</Button>}{exam&&<Button onClick={()=>exportStudyPdf(latest.current,"IELTS-当前答案.pdf",{listeningData})}>导出当前答案 PDF</Button>}</div> : null;
  if(exam?.status==="finished"&&writingReview){
    const topic=exam.items.writing.find((item)=>item.id===writingReview), writing=exam.results.find((result)=>result.subject==="写作");
    if(topic&&writing)return <WritingReport topic={topic} state={{text:writing.responses[topic.id]||"",submittedAt:writing.submittedAt,report:exam.writingReports?.[topic.id],reviewNotes:exam.writingReviewNotes?.[topic.id]}} busy={aiBusy} error={error} onGenerate={generateWriting} onBack={()=>{setWritingReview(null);setError("");}} onExport={()=>exportStudyPdf({topic,text:writing.responses[topic.id],report:exam.writingReports?.[topic.id],reviewNotes:exam.writingReviewNotes?.[topic.id]},"IELTS-模考写作批改.pdf")} onNote={(field,value)=>{const current=latest.current;commit({...current,writingReviewNotes:{...current.writingReviewNotes,[topic.id]:{...current.writingReviewNotes?.[topic.id],[field]:value}}});}}/>;
  }
  if (!exam) return <section className="ui-exam-preflight"><div className="ui-exam-intro"><h2>{mode==="writing"?"给写作一次完整演练":"在同一节奏里，完成三科"}</h2><p>{mode==="writing"?"Task 1 与 Task 2 独立作答，共享 60 分钟。":"听力、阅读、写作依次进行，每段独立计时。"} 答案实时保存在本机；提交后锁定，到时自动进入下一科。</p><Button icon={Play} disabled={!selectedItems} onClick={start}>开始{mode==="writing"?"写作模考":"连续模考"}</Button></div><div className="ui-exam-sequence"><h3>本次考试安排</h3><StepOutline steps={mode==="writing"?[{title:"Task 1",description:"至少 150 词 · 建议 20 分钟"},{title:"Task 2",description:"至少 250 词 · 建议 40 分钟"}]:[{title:"听力 · 30 分钟",description:"P1–P4，提交后锁定答案"},{title:"阅读 · 60 分钟",description:"P1–P3，独立计时与交卷"},{title:"写作 · 60 分钟",description:"Task 1 + Task 2，保存完整作文"}]}/></div></section>;
  if (exam.status === "finished") return <div className="exam-report">{alerts}<h2>模考已完成</h2><p>答案已锁定。听读分数为练习估分；写作可逐篇生成 AI 批改，两篇完成后按 Task 2 双倍权重计算练习估分。</p>{exam.results.map((result)=><section key={result.subject}><h3>{result.subject} {result.score == null ? "已保存" : `${result.score.toFixed(1)} 分${result.rawTotal==null?" · AI 练习估分":` · ${result.rawScore}/${result.rawTotal}`}`}</h3>{result.unscored&&<p>部分题目未能读取，本科暂不计分。答案已锁定保存，重新读取题目后会补算成绩。</p>}{result.details.map((detail)=><details key={detail.id}><summary>{detail.task || detail.title} · {detail.words == null ? detail.unscored ? "暂未计分" : `${detail.score}/${detail.total}` : `${detail.words} words`}</summary>{detail.unscored ? <pre className="preserve-lines">{JSON.stringify(result.responses[detail.id]||{},null,2)}</pre> : detail.questions ? detail.questions.map((q)=><p key={q.id}>题 {q.id} · {q.correct ? "正确" : "错误"} · 你的答案：{Array.isArray(q.response)?q.response.join(", "):q.response} · 正确答案：{q.expected}</p>) : <><p className="preserve-lines">{result.responses[detail.id] || "未作答"}</p><Button disabled={!result.responses[detail.id]?.trim()} onClick={()=>setWritingReview(detail.id)}>{exam.writingReports?.[detail.id]?"查看 AI 写作批改":"生成本篇 AI 写作批改"}</Button></>}</details>)}</section>)}<Button onClick={()=>exportStudyPdf(exam,`IELTS-${exam.id.replaceAll(":","-")}.pdf`,{listeningData})}>导出本次答案 PDF</Button><Button variant="ghost" onClick={()=>{if((storageError||historyError)&&!window.confirm("本场仍有未成功保存的内容。请先导出当前答案 PDF；确定离开并开始新练习吗？"))return;commit(null);onExit?.();}}>开始新的练习</Button></div>;
  if (exam.status === "locked") return <section className="exam-locked" role="status">{alerts}<LockSimple size={28}/><h2>{subject}已提交并锁定</h2><p>{exam.phase+1 < sections.length ? "正在进入下一科……" : "正在整理本次记录……"}</p></section>;
  const response = exam.responses[item?.id] || {};
  const navItems = items.flatMap((entry) => (subject === "写作" ? [entry.task || "Task 2"] : subject === "听力" ? listeningData[entry.id]?.questionIds || [] : articleQuestionIds(entry)).map((localId) => ({id:`${entry.id}::${localId}`,itemId:entry.id,localId})));
  const questionIds = navItems.map((entry) => entry.id);
  const questionLabels = Object.fromEntries(navItems.map((entry,index) => [entry.id, subject === "写作" ? entry.localId : index + 1]));
  const activeQuestion = navItems.find((entry) => entry.itemId === item?.id && entry.id === focusedNav)?.id || navItems.find((entry) => entry.itemId === item?.id)?.id;
  const answered = (id) => {
    const target = navItems.find((entry) => entry.id === id);
    if (!target) return false;
    const value = exam.responses[target.itemId];
    if (subject === "写作") return Boolean(value?.trim());
    if (subject === "听力") return hasResponseForQuestion(listeningData[target.itemId], value || {}, target.localId);
    const article = items.find((entry) => entry.id === target.itemId);
    const result = articleResults(article,value || {}).find((entry) => String(entry.id) === String(target.localId));
    return result?.multi ? Boolean(value?.[result.groupId]?.length) : Boolean(String(value?.[target.localId] || "").trim());
  };
  const navigateQuestion = (id) => {
    const target = navItems.find((entry) => entry.id === id);
    if (!target) return;
    setSelection(items.findIndex((entry) => entry.id === target.itemId)); setFocusedNav(id);
    window.setTimeout(() => {
      let localId = target.localId;
      if (subject === "阅读") { const article = items.find((entry) => entry.id === target.itemId); const group = article.questionGroups.find((g) => g.type === "multi" && g.answerIds?.map(String).includes(String(localId))); localId = group?.answerIds?.[0] || localId; }
      document.getElementById(subject === "写作" ? "exam-essay" : `question-${localId}`)?.scrollIntoView({block:"center"});
    },0);
  };
  const audioTracks = (exam.items.listening || []).map((entry) => ({ label:entry.part, src:`/${listeningAudioPath(entry)}` }));
  return <div className="exam-workspace exam-surface"><InsperaChrome key={`${exam.id}:${exam.phase}`} storageKey={`${exam.id}:${exam.phase}`} subject={subject} part={selection+1} totalParts={items.length} contextLabel={subject === "写作" ? item.task : undefined} questionIds={questionIds} questionLabels={questionLabels} activeQuestion={activeQuestion} isAnswered={answered} onQuestion={navigateQuestion} listening={subject === "听力"}/><header className="exam-toolbar"><strong>{subject}考场</strong><span>第 {exam.phase+1}/{sections.length} 科</span><span className={remaining < 300 ? "exam-time low" : "exam-time"}><Clock size={18}/>{format(remaining)}</span><Button icon={LockSimple} disabled={!ready} onClick={()=>setConfirming(true)}>提交本段</Button></header>{alerts}{confirming&&<section className="exam-confirm" role="alert"><p>{questionIds.length} 项中已填写 {questionIds.filter(answered).length} 项；还有 {questionIds.filter((id) => !answered(id)).length} 项未填写。交卷后无法修改本段答案，确定提交？</p><Button onClick={()=>submit(false)}>确认交卷</Button><Button variant="ghost" onClick={()=>setConfirming(false)}>继续作答</Button></section>}<div className="exam-parts">{items.map((entry,index)=><button key={entry.id} className={selection===index?"active":""} onClick={()=>{setSelection(index);setFocusedNav(null);setAnnotations([]);}}>{subject === "写作" ? entry.task || "Task 2" : `${entry.part} · ${index+1}`}</button>)}</div>{!ready?<p role="status">正在读取本地题目……</p>:subject === "听力"?<><div className="exam-audio"><h2>{item.title}</h2><ExamAudioPlayer key={exam.id} tracks={audioTracks} initialPosition={exam.audioPlayback} onCheckpoint={(position) => { const state=latest.current; if(state?.status === "active" && sections[state.phase]?.subject === "听力") commit({...state,audioPlayback:{...position}}); }}/></div><div className="question-paper">{listeningData[item.id].groups.map((group,index)=><PracticeGroup key={`${item.id}:${index}`} group={group} groupKey={String(index)} responses={response} setResponse={(key,value)=>setAnswer(item.id,{...response,[key]:value})} answerKey={{}} review={false} annotations={annotations} setAnnotations={setAnnotations}/>)}</div></>:subject === "阅读"?<div className="reading-practice-layout"><ReadingPassage article={item} annotations={annotations} setAnnotations={setAnnotations}/><aside className="reading-questions-panel">{item.questionGroups.map((group)=><ReadingQuestionGroup key={group.id} group={group} responses={response} setResponse={(key,value)=>setAnswer(item.id,{...response,[key]:value})} submitted={false} annotations={annotations} setAnnotations={setAnnotations}/>)}</aside></div>:<div className="exam-writing-grid"><WritingPrompt topic={item}/><section className="exam-editor"><label htmlFor="exam-essay">{item.task || "Task 2"} 答案</label><textarea id="exam-essay" value={typeof exam.responses[item.id] === "string"?exam.responses[item.id]:""} onChange={(event)=>setAnswer(item.id,event.target.value)} spellCheck={false}/><span>{wordCount(exam.responses[item.id] || "")} words · 至少 {(item.task || "Task 2") === "Task 1" ? 150 : 250} 词</span></section></div>}<InsperaBottomNav questionIds={questionIds} questionLabels={questionLabels} activeQuestion={activeQuestion} isAnswered={answered} onQuestion={navigateQuestion} onSubmit={() => setConfirming(true)} disabled={!ready}/><p className="exam-save-note">本机自动保存 · 刷新后恢复倒计时 · 到时自动提交本段</p></div>;
}
