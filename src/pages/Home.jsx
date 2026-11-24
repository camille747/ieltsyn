import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  Headphones,
  NotePencil,
  Play,
} from "@phosphor-icons/react";
import { Button, SectionHeading, TextArrow } from "../components/Common";
import { getDailyQuote } from "../data/daily-quotes";
import { formatStudyTime, getStudyHistory, LOCAL_STUDY_EVENT } from "../lib/localStudyStore";

const subjects = [
  { title: "听力", label: "原创示例题库", description: "单篇练习、P1–P4 套题与提交后的精听复盘。", icon: Headphones, page: "listening", intent: { tab: "library" } },
  { title: "阅读", label: "原创阅读示例", description: "文章索引、套题练习、精读与背题复盘。", icon: BookOpenText, page: "reading", intent: { tab: "index" } },
  { title: "写作", label: "Task 1 & Task 2", description: "从单篇构思到限时写作，保存草稿与练习报告。", icon: NotePencil, page: "writing", intent: { tab: "topics" } },
];

export default function Home({ navigate }) {
  const [history, setHistory] = useState(() => getStudyHistory());
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const today = useMemo(() => new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(currentDate), [currentDate]);
  const dailyQuote = useMemo(() => getDailyQuote(currentDate), [currentDate]);

  useEffect(() => {
    const nextMidnight = new Date(currentDate);
    nextMidnight.setHours(24, 0, 0, 0);
    const timer = window.setTimeout(
      () => setCurrentDate(new Date()),
      Math.max(1000, nextMidnight.getTime() - Date.now() + 1000),
    );
    return () => window.clearTimeout(timer);
  }, [currentDate]);

  useEffect(() => {
    const refresh = () => setHistory(getStudyHistory());
    window.addEventListener(LOCAL_STUDY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LOCAL_STUDY_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const latest = history[0];
  const recent = history.slice(0, 3);


  return <div className="page study-home">
    <header className="page-heading"><div><h1>你的学习工作台</h1><p>{today} · 每次练习，按自己的节奏来。</p></div><Button variant="ghost" onClick={() => navigate("profile")}>我的学习档案</Button></header>
    <div className="study-home-grid"><div className="study-home-main">
      <section className="study-launch"><h2>{latest ? "接着上次，继续向前。" : "今天，从一次练习开始。"}</h2><p>{latest ? latest.title : "听懂一句，读透一篇，写好一段。选择一科，开始今天的学习。"}</p><Button icon={Play} onClick={() => latest ? navigate(latest.page,latest.intent) : navigate("listening",{tab:"library"})}>{latest ? "继续上次学习" : "开始听力练习"}</Button><div className="study-launch-context"><BookOpenText size={18}/><span>{latest ? `${latest.subject} · ${formatStudyTime(latest.updatedAt)}` : "练习、草稿和复盘保存在本机"}</span></div></section>
      <SectionHeading title="选择一科，专注练习"/>
      <div className="study-route-list">{subjects.map(({title,label,description,icon:Icon,page,intent})=><button className="study-route" key={page} onClick={()=>navigate(page,intent)}><span className="study-route-icon"><Icon size={26}/></span><span><strong>{title}</strong><small>{label}</small><p>{description}</p></span><ArrowRight size={23}/></button>)}</div>
      <button className="study-mock-link text-link" onClick={()=>navigate("mock")}><span>准备好完整练一次？进入听阅写模考</span><ArrowRight size={22}/></button>
    </div><aside className="study-home-journal"><section><h2>学习足迹</h2>{recent.length ? recent.map(item=><button className="study-journal-entry" key={item.id} onClick={()=>navigate(item.page,item.intent)}><time>{formatStudyTime(item.updatedAt)}</time><strong>{item.title}</strong><small>{item.detail||item.subject}</small></button>) : <p className="ui-journal-empty">完成第一次练习后，你的学习足迹会显示在这里。</p>}<TextArrow onClick={()=>navigate("review",{tab:"学习记录"})}>查看全部记录</TextArrow></section><div className="study-quote"><span>今日一句</span><p>{dailyQuote}</p></div></aside></div>
  </div>;
}
