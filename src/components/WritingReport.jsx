import { useState } from "react";
import { ArrowClockwise, ArrowLeft, DownloadSimple } from "@phosphor-icons/react";
import { Button, PageHeading } from "./Common";
import { WritingPrompt, wordCount } from "./ExamWorkspace";
import { isWritingReport } from "../lib/aiReports";

const criteria = [
  ["任务完成 / 回应", "Task Achievement / Response", "检查是否回答题目各部分，Task 1 是否概括主要特征，Task 2 是否清楚表达并支持观点。"],
  ["连贯与衔接", "Coherence and Cohesion", "检查段落组织、论点推进、指代和衔接是否清楚自然。"],
  ["词汇资源", "Lexical Resource", "检查选词准确性、搭配、拼写以及词汇使用范围。"],
  ["语法多样性与准确性", "Grammatical Range and Accuracy", "检查句式范围、语法准确性和标点。"]
];
export default function WritingReport({ topic, state, onNote, onRetry, onBack, onExport, onGenerate, busy = false, error = "" }) {
  const [tab,setTab] = useState("overall");
  const [summary,setSummary] = useState("evaluation");
  const [showPrompt,setShowPrompt] = useState(false);
  const notes = state.reviewNotes || {};
  const report = isWritingReport(state.report) ? state.report : null;
  return <div className="writing-report-page">
    <PageHeading title={<>本次写作 <em>练习报告</em></>} description={`${topic.task || "Task 2"} · ${wordCount(state.text)} words · ${new Date(state.submittedAt).toLocaleString("zh-CN")}`}/>
    <div className="writing-report-actions"><Button variant="ghost" icon={ArrowLeft} disabled={busy} onClick={onBack}>返回</Button>{onRetry&&<Button variant="ghost" icon={ArrowClockwise} disabled={busy} onClick={onRetry}>再答一遍</Button>}<Button variant="ghost" icon={DownloadSimple} onClick={onExport}>导出批改与笔记 PDF</Button><Button variant="text" aria-expanded={showPrompt} onClick={() => setShowPrompt(!showPrompt)}>{showPrompt ? "收起题目" : "查看原题"}</Button><Button disabled={busy||!state.text?.trim()} onClick={onGenerate}>{busy?"正在评阅本篇……":report?"重新生成 AI 批改":"生成 AI 批改"}</Button></div>
    {error&&<p role="alert" className="writing-report-pending">{error}</p>}
    {showPrompt && <WritingPrompt topic={topic}/>}
    <div className="ui-writing-report-desk"><aside className="ui-writing-report-outline">    <section className="writing-report-score" aria-busy={busy}><div><span>练习估分 / 9</span><strong>{report?.score?.toFixed(1)??"—"}</strong><small>{report?`${report.provider} · ${report.model}`:busy?"正在 AI 评阅":"尚未生成 AI 批改"}</small></div><p>{report?report.summary:"点击生成，将本篇题目、作文及 Task 1 图表发送至百炼评阅。原作文保持锁定，批改结果保存在本机。"}{report&&<small>仅供练习参考，不代表官方 IELTS 成绩。</small>}</p></section>
    <div className="writing-report-tabs" role="tablist" aria-label="写作报告">{[["overall","总体评价"],["grammar","语法精批"],["logic","逻辑优化"]].map(([value,label]) => <button key={value} id={`report-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls="writing-report-panel" onClick={() => setTab(value)}>{label}</button>)}</div>
</aside><div className="ui-writing-report-body">    <div className="writing-report-layout"><section id="writing-report-panel" role="tabpanel" aria-labelledby={`report-tab-${tab}`}>
      {tab === "overall" ? <>
        <div className="writing-report-subtabs" role="group" aria-label="总体评价内容"><button aria-pressed={summary === "evaluation"} onClick={() => setSummary("evaluation")}>综合评价</button><button aria-pressed={summary === "advice"} onClick={() => setSummary("advice")}>提分建议</button></div>
        {!report&&<p className="writing-report-pending">{summary === "evaluation" ? "暂无 AI 综合评价。以下是自查方向。" : "生成批改后可在此查看本篇的提分建议。"}</p>}
        {summary === "evaluation" ? <div className="writing-report-criteria">{criteria.map(([title,english,hint],index) => {const result=report?.criteria?.[["task","coherence","lexical","grammar"][index]];return <details key={title}><summary><span className="writing-criterion-score" aria-label={result?`练习估分 ${result.score}`:"待评分"}>{result?.score?.toFixed(1)??"—"}</span><span><strong>{title}</strong><small>{english}</small></span><span>{result?"本篇评价":"自查方向"}</span></summary><p>{result?.feedback||hint}</p></details>;})}</div> : <>{report?.advice?.length>0&&<ul>{report.advice.map((advice,index)=><li key={index}>{advice}</li>)}</ul>}<label className="writing-review-note">我的修改计划<textarea value={notes.plan || ""} onChange={(e) => onNote("plan",e.target.value)} placeholder="记录下次作答想改进的重点……"/></label></>}
        {report?.revisedEssay&&<details><summary>查看完整润色范文</summary><p className="preserve-lines">{report.revisedEssay}</p></details>}
      </> : <>
        <h2>{tab === "grammar" ? "语法与用词复盘" : "段落与逻辑复盘"}</h2>{!report?<p className="writing-report-pending">生成 AI 批改后，在此展示原文证据与修改建议。</p>:report[tab]?.length?report[tab].map((item,index)=><section className="ai-evidence" key={index}><blockquote>{item.original}</blockquote><p>{item.replacement||item.suggestion}</p><p>{item.reason}</p></section>):<p>本次模型未列出此类具体修改。</p>}
        <label className="writing-review-note">{tab === "grammar" ? "我的语法与用词笔记" : "我的逻辑与段落笔记"}<textarea value={notes[tab] || ""} onChange={(e) => onNote(tab,e.target.value)} placeholder={tab === "grammar" ? "摘录原句，写下问题、修改和原因……" : "记录段落主旨、论证缺口和重写思路……"}/></label>
      </>}
      <p className="writing-report-save-note">复盘笔记自动保存于本机；重新作答前可导出保留。</p>
    </section><aside className="writing-report-original"><h2>本次原作文</h2><p className="preserve-lines">{state.text || "本次未填写作文。"}</p></aside></div>
    </div></div>
  </div>;
}
