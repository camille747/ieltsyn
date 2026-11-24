import { LearningWorkspace, ResourceEntry, StudyEmpty } from "../components/LearningUI";
import { useMemo, useState } from "react";
import writingDatabase from "../data/writing-topics.json";
import task1Topics from "../data/writing-task1.json";
import { writingResources, writingSupplementalResources } from "../data/static";
import { DocumentResourceGrid, DocumentViewer } from "../components/DocumentResourceLibrary";
import { Pagination, SearchField, Segmented, SelectField } from "../components/Common";
import ExamWorkspace from "../components/ExamWorkspace";
import WritingStudio from "../components/WritingStudio";
import TypingPractice from "../components/TypingPractice";
import PracticeHistory from "../components/PracticeHistory";
const task2Topics=writingDatabase.topics.map((item)=>({...item,task:"Task 2"}));
export default function Writing({intent}) {
 const [tab,setTab]=useState(intent?.tab||"topics");const [task,setTask]=useState("Task 2");const [search,setSearch]=useState("");const [category,setCategory]=useState("全部");const [page,setPage]=useState(1);const [selected,setSelected]=useState(null);const [resource,setResource]=useState(null);
 const topics=useMemo(()=>(task==="Task 1"?task1Topics:task2Topics).filter((t)=>(category==="全部"||t.primaryTopic===category)&&[t.essayQuestion,t.primaryTopic,t.questionType].join(" ").toLowerCase().includes(search.toLowerCase())),[task,category,search]);
 const mockItems=()=>({writing:[task1Topics[Math.floor(Math.random()*task1Topics.length)],task2Topics[Math.floor(Math.random()*task2Topics.length)]]});
 if(resource)return <DocumentViewer resource={resource} onClose={()=>setResource(null)}/>;
 if(selected)return <div className="page"><WritingStudio key={selected.id} topic={selected} onBack={()=>setSelected(null)}/></div>;
 return <div className="page"><LearningWorkspace title="写作" description="把想法，写清楚。" active={tab} onChange={setTab} options={[{value:"topics",label:"题库"},{value:"mock",label:"套题模式"},{value:"single",label:"单篇练习"},{value:"history",label:"练习记录"},{value:"typing",label:"打字训练"}]} aside={<p>Task 1 与 Task 2 独立练习，也可组合限时模考。草稿自动保存在本机。</p>}>{tab==="typing"?<TypingPractice/>:tab==="mock"?<ExamWorkspace mode="writing" selectedItems={mockItems}/>:tab==="history"?<PracticeHistory subject="写作"/>:<><div className="ui-content-heading"><div><h1>{tab==="single"?"选择一篇，开始写作":"写作题库"}</h1><p>从原题出发，练构思、表达与完整成文。</p></div></div><div className="ui-filter-panel"><div className="filter-row"><Segmented value={task} onChange={(v)=>{setTask(v);setCategory("全部");setPage(1);}} label="写作任务" options={["Task 1","Task 2"]}/><SearchField value={search} onChange={(v)=>{setSearch(v);setPage(1);}} placeholder="搜索原题或话题"/>{task==="Task 2"&&<SelectField value={category} onChange={(v)=>{setCategory(v);setPage(1);}} label="话题分类"><option>全部</option>{writingDatabase.primaryTopics.map((c)=><option key={c}>{c}</option>)}</SelectField>}</div></div><div className="ui-catalog-summary"><span>{topics.length} 道原题</span><span>{task==="Task 1"?"附原始图表":"按话题整理"}</span></div><div className="ui-resource-list">{topics.slice((page-1)*10,page*10).map(topic=><ResourceEntry key={topic.id} part={task==="Task 1"?"T1":"T2"} title={topic.essayQuestion} subtitle={topic.primaryTopic||topic.source} metadata={`${task} · ${topic.questionType||"写作原题"}`} onOpen={()=>setSelected(topic)}/>)}</div>{!topics.length&&<StudyEmpty title="没有匹配的原题" description="换个关键词或话题分类再试。"/>}<Pagination page={page} totalPages={Math.max(1,Math.ceil(topics.length/10))} onChange={setPage} label="写作题库分页"/><details className="writing-materials"><summary>方法、范文和原始写作资料</summary><DocumentResourceGrid resources={[...writingResources,...writingSupplementalResources].filter((r)=>r.task.includes(task))} onOpen={setResource}/></details></>}</LearningWorkspace></div>;
}
