import { PageHeading } from "../components/Common";
import ExamWorkspace from "../components/ExamWorkspace";
import { listeningLibrary } from "./Listening";
import readingQuestionBank from "../data/reading-question-bank";
import writingDatabase from "../data/writing-topics.json";
import task1Topics from "../data/writing-task1.json";
const pick = (items) => items[Math.floor(Math.random()*items.length)];
export default function MockExam() {
  const selectedItems = ()=>({listening:["P1","P2","P3","P4"].map((part)=>pick(listeningLibrary.filter((item)=>item.collection==="232" && item.part===part))),reading:["P1","P2","P3"].map((part)=>pick(readingQuestionBank.filter((item)=>item.part===part))),writing:[pick(task1Topics),{...pick(writingDatabase.topics),task:"Task 2"}]});
  return <div className="page"><PageHeading title={<>整套 <em>模考</em></>} description="在同一考场完成听力、阅读与写作；每段独立计时并交卷锁定。"/><ExamWorkspace selectedItems={selectedItems}/></div>;
}
