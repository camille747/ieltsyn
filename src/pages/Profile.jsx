import { useEffect, useMemo, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { PageHeading, Button } from "../components/Common";
import PracticeHistory from "../components/PracticeHistory";
import { calculateOverall, getLatestSubjectScores, getStudyHistory, LOCAL_STUDY_EVENT } from "../lib/localStudyStore";
import { readValue, writeValue } from "../lib/persistence";
import { localDayKey, studyCalendar, subjectStudySummary } from "../lib/studyCalendar";
const subjects = ["听力", "阅读", "写作"];
const speakingKey = "ielts-manual-speaking-band-v1";
const duration = (seconds) => `${Math.floor(seconds/3600)} 小时 ${Math.floor(seconds%3600/60)} 分`;
export default function Profile() {
  const [history,setHistory] = useState(getStudyHistory);
  const [speaking,setSpeaking] = useState(() => readValue(speakingKey,null));
  const [band,setBand] = useState(7);
  const [date,setDate] = useState(() => localDayKey(Date.now()));
  const [notice,setNotice] = useState("");
  const [view,setView] = useState("概览");
  const [month,setMonth] = useState(() => new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [selectedDay,setSelectedDay] = useState("");
  useEffect(() => {
    const refresh = () => { setHistory(getStudyHistory()); setSpeaking(readValue(speakingKey,null)); };
    window.addEventListener(LOCAL_STUDY_EVENT,refresh);
    return () => window.removeEventListener(LOCAL_STUDY_EVENT,refresh);
  },[]);
  const latest = useMemo(() => getLatestSubjectScores(),[history]);
  const overall = calculateOverall([...subjects.map((s) => latest.get(s)?.score),speaking?.score]);
  const calendar = useMemo(() => studyCalendar(history),[history]);
  const total = subjectStudySummary(calendar.attempts,"概览");
  const summary = subjectStudySummary(calendar.attempts,view);
  const daysInMonth = new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const offset = (month.getDay()+6)%7;
  const changeMonth = (delta) => { setMonth(new Date(month.getFullYear(),month.getMonth()+delta,1)); setSelectedDay(""); };
  const saveSpeaking = (value) => {
    try { writeValue(speakingKey,value); setSpeaking(value); setNotice(value ? "口语成绩已保存，仅用于本机四科估分。" : "口语登记已移除。"); }
    catch(e) { setNotice(e.message); }
  };
  return <div className="page profile-page">
    <PageHeading title={<>我的 <em>学习档案</em></>} description="本机单用户档案，记录每一次练习。成绩均为练习估分。"/>
    <div className="ui-profile-layout"><aside className="ui-profile-scores"><section className="ui-profile-overall"><h2>四科练习估分</h2><strong>{overall==null?"—":overall.toFixed(1)}</strong><p>Overall · 四科齐全后按 IELTS 半分规则计算，仅供练习参考。</p></section>{[...subjects,"口语"].map(subject=>{const entry=subject==="口语"?speaking:latest.get(subject);return <section className="ui-profile-subject" key={subject}><b>{subject}</b><strong>{Number.isFinite(entry?.score)?entry.score.toFixed(1):"—"}</strong><time>{entry?new Date(entry.submittedAt||entry.updatedAt).toLocaleDateString("zh-CN"):"待完成有效评分"}</time><small>{subject==="口语"?"独立口语 App · 手动登记":"最近一次有效练习"}</small></section>;})}
    <details className="manual-score"><summary>登记独立口语 App 的练习估分</summary><p>两个应用独立保存数据。在此登记口语分数及日期，用于四科平均；来源标记为手动登记。口语时长在独立 App 查看。</p><label>口语估分 <select value={band} onChange={(e) => setBand(Number(e.target.value))}>{Array.from({length:19},(_,i) => i/2).map((n) => <option key={n} value={n}>{n.toFixed(1)}</option>)}</select></label><label>练习日期 <input type="date" value={date} max={localDayKey(Date.now())} onChange={(e) => setDate(e.target.value)}/></label><Button disabled={!date} onClick={() => saveSpeaking({score:band,submittedAt:new Date(`${date}T12:00:00`).getTime(),manual:true})}>保存口语成绩</Button>{speaking && <Button variant="ghost" onClick={() => saveSpeaking(null)}>移除登记</Button>}{notice && <p role="status">{notice}</p>}</details>
    </aside><div className="ui-profile-journal"><div className="ui-content-heading"><div><h2>学习日历</h2><p>已提交 {total.count} 次练习 · 累计 {duration(total.seconds)}</p></div></div><div className="profile-study-tabs" role="group" aria-label="学习统计科目">{["概览",...subjects].map((s) => <button key={s} aria-pressed={view === s} onClick={() => { setView(s); setSelectedDay(""); }}>{s}</button>)}</div>
    <section className="profile-study-summary" aria-label="打卡与时长"><div><span>{view === "概览" ? "连续学习" : `${view}累计时长`}</span><strong>{view === "概览" ? `${calendar.current} 天` : duration(summary.seconds)}</strong></div><dl><div><dt>最长连续</dt><dd>{calendar.longest} 天</dd></div><div><dt>{view === "概览" ? "累计学习" : "本科提交"}</dt><dd>{view === "概览" ? `${calendar.days.size} 天` : `${summary.count} 次`}</dd></div></dl></section>
    <section className="profile-calendar" aria-label="学习日历"><header><Button variant="ghost" aria-label="上个月" onClick={() => changeMonth(-1)} icon={CaretLeft}/><h2>{month.getFullYear()} 年 {month.getMonth()+1} 月</h2><div><Button variant="text" onClick={() => { setMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1)); setSelectedDay(localDayKey(Date.now())); }}>今天</Button><Button variant="ghost" aria-label="下个月" onClick={() => changeMonth(1)} icon={CaretRight}/></div></header>
      <div className="profile-calendar-grid">{["一","二","三","四","五","六","日"].map((d) => <span className="calendar-weekday" key={d}>周{d}</span>)}{Array.from({length:offset},(_,i) => <span key={`empty-${i}`} aria-hidden="true"/>)}{Array.from({length:daysInMonth},(_,i) => {
        const key = localDayKey(new Date(month.getFullYear(),month.getMonth(),i+1));
        const entries = (calendar.days.get(key)||[]).filter((entry) => view === "概览" || entry.subject === view);
        const score = [...entries].sort((a,b) => (b.submittedAt||b.updatedAt)-(a.submittedAt||a.updatedAt)).find((entry) => Number.isFinite(entry.score));
        return <button key={key} className={`${entries.length ? "has-study" : ""} ${key === localDayKey(Date.now()) ? "is-today" : ""}`} aria-label={`${key}，${entries.length} 次提交${score ? `，最近估分 ${score.score}` : ""}`} aria-pressed={selectedDay === key} onClick={() => setSelectedDay(selectedDay === key ? "" : key)}><span>{i+1}</span><small>{score ? `${score.score.toFixed(1)} 分` : entries.length ? `${entries.length} 次` : ""}</small></button>;
      })}</div><p className="profile-calendar-hint">有色日期代表已提交练习，点击查看当天记录。日历分数显示所选范围当天最近一次有效估分。</p>
    </section>
    <div className="profile-record-heading"><h2>{selectedDay ? `${selectedDay} 的练习记录` : "全部练习记录"}</h2>{selectedDay && <Button variant="text" onClick={() => setSelectedDay("")}>查看全部日期</Button>}</div>
    <PracticeHistory key={view} subject={view === "概览" ? undefined : view} date={selectedDay}/>
    </div></div>
  </div>;
}
