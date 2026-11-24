import assert from "node:assert/strict";
import {test} from "node:test";
import {createExam,changeExamAnswer,lockSection,advanceSection,secondsRemaining} from "../src/lib/examEngine.js";
import {calculateOverall,recordPracticeAttempt,getStudyHistory,deleteStudyActivity,restoreStudyActivity,getLatestSubjectScores} from "../src/lib/localStudyStore.js";
import {validateCues,toVtt,parseSubtitles} from "../speaking-app/src/speaking/shadowingStore.js";
import {buildQuestions} from "../speaking-app/src/speaking/sessionStore.js";
import fs from "node:fs";
test("exam deadline rejects late edits, locks once, advances in order and survives serialization",()=>{
 let state=createExam({listening:[{id:"a"}],reading:[],writing:[]},"full",1000);
 state=changeExamAnswer(state,"a",{q1:"boat"},2000);assert.equal(state.responses.a.q1,"boat");
 assert.strictEqual(changeExamAnswer(state,"a",{},state.deadline),state);assert.equal(secondsRemaining(state.deadline,state.deadline),0);
 state=JSON.parse(JSON.stringify(state));state=lockSection(state,{subject:"听力"},state.deadline+5000);assert.equal(state.results[0].durationSeconds,1800);
 assert.strictEqual(lockSection(state,{},9000000),state);assert.strictEqual(changeExamAnswer(state,"a",{},2000),state);
 state=advanceSection(state,2000000);assert.equal(state.phase,1);assert.equal(state.deadline,5600000);
 state=advanceSection(lockSection(state,{subject:"阅读"},2100000),2101500);assert.equal(state.phase,2);
 state=advanceSection(lockSection(state,{subject:"写作"},2200000),2201500);assert.equal(state.status,"finished");
 const writing=createExam({writing:[]},"writing",1000);assert.equal(writing.deadline,3601000);assert.equal(advanceSection(lockSection(writing,{},1001)).status,"finished");
});
test("Overall requires all four scores, applies IELTS quarter boundaries, accepts genuine zero",()=>{
 assert.equal(calculateOverall([6,6,6,7]),6.5);assert.equal(calculateOverall([6,6,7,8]),7);assert.equal(calculateOverall([6,6,6]),null);assert.equal(calculateOverall([0,0,0,0]),0);assert.equal(calculateOverall([9,9,9,10]),null);
});
test("repeated attempts retain distinct answers, latest score follows submission and deletion can undo",()=>{
 const values=new Map();globalThis.window={localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},dispatchEvent:()=>{}};globalThis.CustomEvent=class{};
 const first=recordPracticeAttempt({id:"reading:1",page:"reading",subject:"阅读",title:"Passage",score:6,responses:{1:"old"}});const second=recordPracticeAttempt({id:"reading:1",page:"reading",subject:"阅读",title:"Passage",score:7,responses:{1:"new"}});
 assert.notEqual(first.id,second.id);assert.equal(getStudyHistory().length,2);assert.equal(getStudyHistory().find(h=>h.id===first.id).responses[1],"old");
 deleteStudyActivity(second.id);assert.equal(getLatestSubjectScores().get("阅读").score,6);restoreStudyActivity(second);assert.equal(getStudyHistory().length,2);delete globalThis.window;
});
test("corrected subtitle timing validates overlap and VTT round trips",()=>{
 const cues=[{id:0,start:0.125,end:1.25,text:"Hello."},{id:1,start:2,end:3,text:"Welcome."}];assert.deepEqual(parseSubtitles(toVtt(cues)),cues);assert.equal(validateCues(cues,4),cues);
 assert.throws(()=>validateCues([{id:0,start:0,end:2,text:"A"},{id:1,start:1,end:3,text:"B"}],4),/重叠/);assert.throws(()=>validateCues([{start:0,end:5,text:"A"}],4),/时长/);
});
test("listening scoring accepts every imported answer and counts unordered multiple-choice answers once per slot",async()=>{
 const {calculateScore,expectedAnswer}=await import("../src/lib/listeningScoring.js");
 const bank=JSON.parse(fs.readFileSync(new URL("../src/data/listening-232-index.json",import.meta.url)));
 for(const item of bank){const data=JSON.parse(fs.readFileSync(new URL(`../public/data/listening-232/${item.id}.json`,import.meta.url)));const correct=Object.fromEntries(data.questionIds.map(id=>[`q${id}`,String(expectedAnswer(data,id)).split(/\s*\/\s*/)[0]]));assert.equal(calculateScore(data,correct),data.questionIds.length,item.id);assert.equal(calculateScore(data,{}),0,item.id);}
 const data={questionIds:["1","2"],answerKey:{multipleMap:{q1:"A",q2:"C"}},groups:[{type:"multiple",id:"1-2"}]};assert.equal(calculateScore(data,{"multi:1-2":["C","A"]}),2);assert.equal(calculateScore(data,{"multi:1-2":["A"]}),1);
});


test("backup preflight rejects corrupt exam and drafts before mutation; failed restore rolls back",async()=>{
 const {validateBackup,restoreBackup}=await import("../src/lib/backup.js");
 const wrap=values=>({format:"ielts-study-backup",version:1,values});
 const exam=createExam({listening:[],reading:[],writing:[]},"full",1000);
 assert.doesNotThrow(()=>validateBackup(wrap({"ielts-exam-v2:full":exam,"ielts-exam-v2:writing":createExam({writing:[]},"writing",1000)})));
 for(const values of [{"other-key":[]},{"ielts-exam-v2:full":{}},{"ielts-local-theme-v1":"broken"},{"ielts-writing-draft-v2:1":[]},{"ielts-reading-status-v1":"bad"},{"ielts-local-study-history-v1":[{id:"1"}]}])assert.throws(()=>validateBackup(wrap(values)));
 const original=new Map([["ielts-one",JSON.stringify({answer:"original"})]]);let fail=true;
 const storage={getItem:k=>original.get(k)??null,setItem:(k,v)=>{if(k==="ielts-two"&&fail){fail=false;throw new Error("quota");}original.set(k,v);},removeItem:k=>original.delete(k)};
 globalThis.window={localStorage:storage,dispatchEvent:()=>{}};globalThis.localStorage=storage;
 assert.throws(()=>restoreBackup(wrap({"ielts-one":{answer:"changed"},"ielts-two":{}})),/撤回/);
 assert.deepEqual(JSON.parse(original.get("ielts-one")),{answer:"original"});assert.equal(original.has("ielts-two"),false);delete globalThis.window;delete globalThis.localStorage;
});

test("shadowing backups reject corrupt subtitle and progress shapes before restore",async()=>{
 const {validateProgress}=await import("../speaking-app/src/speaking/shadowingStore.js");
 assert.doesNotThrow(()=>validateProgress({lesson:{time:12,favorite:true,notes:{0:"note"},customCues:[{id:0,start:0,end:1,text:"Hello"}]}}));
 for(const progress of [[],{lesson:"bad"},{lesson:{time:-1}},{lesson:{completed:"yes"}},{lesson:{notes:{0:3}}},{lesson:{customCues:[{start:0,end:1,text:3}]}}])assert.throws(()=>validateProgress(progress));
});

test("study calendar ignores resume snapshots, handles year boundaries and current streak", async () => {
 const {studyCalendar,localDayKey,subjectStudySummary} = await import("../src/lib/studyCalendar.js");
 const entry=(id,day,subject="阅读",durationSeconds=60)=>({id,subject,durationSeconds,submitted:true,submittedAt:new Date(`${day}T12:00:00`).getTime()});
 const history=[entry("1","2025-12-30"),entry("2","2025-12-31"),entry("3","2026-01-01"),entry("4","2026-01-01","听力",120),{id:"snapshot",review:true,updatedAt:Date.now()}];
 const calendar=studyCalendar(history,new Date("2026-01-02T09:00:00"));
 assert.equal(calendar.attempts.length,4);assert.equal(calendar.current,3);assert.equal(calendar.longest,3);assert.equal(calendar.days.get("2026-01-01").length,2);
 assert.deepEqual(subjectStudySummary(calendar.attempts,"阅读"),{count:3,seconds:180});
 assert.equal(studyCalendar(history,new Date("2026-01-03T09:00:00")).current,0);
 assert.equal(localDayKey(new Date(2026,0,1,0,15)),"2026-01-01");assert.equal(localDayKey("bad"),"");
});

test("exam audio backup permits completed playlist checkpoint and rejects invalid playback state", async () => {
 const {validateBackup}=await import("../src/lib/backup.js");
 const exam=createExam({listening:[{id:"a"}],reading:[],writing:[]},"full",1000);
 const wrap=audioPlayback=>({format:"ielts-study-backup",version:1,values:{"ielts-exam-v2:full":{...exam,audioPlayback}}});
 assert.doesNotThrow(()=>validateBackup(wrap({index:1,time:0,started:true})));
 for(const audio of [{index:-1,time:0,started:false},{index:2,time:0,started:true},{index:0,time:-1,started:true},{index:0,time:3,started:"yes"}])assert.throws(()=>validateBackup(wrap(audio)),/播放位置/);
});

test("all listening alternative answers are individually accepted; empty and excess multi answers cannot inflate scores",async()=>{
 const {calculateScore,expectedAnswer,answerMatches}=await import('../src/lib/listeningScoring.js');
 const bank=JSON.parse(fs.readFileSync(new URL('../src/data/listening-232-index.json',import.meta.url)));
 let variants=0;
 for(const item of bank){const data=JSON.parse(fs.readFileSync(new URL(`../public/data/listening-232/${item.id}.json`,import.meta.url)));for(const id of data.questionIds){const expected=expectedAnswer(data,id);for(const value of String(expected).split(/\s*\/\s*/)){variants++;assert.equal(answerMatches(value,expected),true,`${item.id} q${id}: ${value}`);}assert.equal(answerMatches('',expected),false);}}
 assert.ok(variants>=bank.length);
 const data={questionIds:['1','2'],answerKey:{multipleMap:{q1:'A',q2:'C'}},groups:[{id:'1-2',type:'multiple',limit:2}]};
 assert.equal(calculateScore(data,{'multi:1-2':['A','A']}),1);
 assert.equal(calculateScore(data,{'multi:1-2':['B','D','A','C']}),0);
 assert.equal(calculateScore(data,{q1:'A',q2:'A'}),1);
 assert.equal(answerMatches('  9   months ','nine months/9 months/9 months ago'),true);
});

test('full 150-minute exam replay checks every second, deadline locks, restarts and idempotent history recovery',async()=>{
 const {buildExamResult,flushExamHistory}=await import('../src/lib/examResults.js');
 const {loadReadingBank}=await import('../scripts/reading-bank-loader.mjs');
 const bank=JSON.parse(fs.readFileSync(new URL('../src/data/listening-232-index.json',import.meta.url)));
 const listening=['P1','P2','P3','P4'].map(part=>bank.find(item=>item.part===part));
 assert.ok(listening.every(Boolean));
 const data=Object.fromEntries(listening.map(item=>[item.id,JSON.parse(fs.readFileSync(new URL(`../public/data/listening-232/${item.id}.json`,import.meta.url)))]));
 const reading=(await loadReadingBank()).slice(0,3),writing=[{id:'w1',task:'Task 1',essayQuestion:'Describe the chart.'},{id:'w2',task:'Task 2',essayQuestion:'Discuss education.'}];
 let state=createExam({listening,reading,writing},'full',1000),seconds=0;const history=new Map();let fail=true;
 const record=entry=>{if(fail)throw new Error('disk full');history.set(entry.id,entry);};
 for(const subject of ['听力','阅读','写作']){
  const deadline=state.deadline;
  for(let now=state.sectionStartedAt;now<deadline;now+=1000){assert.ok(secondsRemaining(deadline,now)>0);seconds++;if(seconds%600===0)state=JSON.parse(JSON.stringify(state));}
  state=changeExamAnswer(state,subject,subject==='写作'?'My essay.':{q1:'answer'},deadline-1);
  assert.strictEqual(changeExamAnswer(state,subject,{},deadline),state);
  state=lockSection(state,buildExamResult(state,data,true),deadline);state.pendingHistory=[...(state.pendingHistory||[]),subject];
  assert.equal(state.status,'locked');assert.strictEqual(changeExamAnswer(state,subject,'late',deadline+1),state);
  const failed=flushExamHistory(state,record);assert.ok(failed.error);state=failed.state;
  assert.equal(state.results.at(-1).durationSeconds,subject==='听力'?1800:3600);
  state=JSON.parse(JSON.stringify(advanceSection(state,deadline+1500)));
 }
 assert.equal(seconds,9000);assert.equal(state.status,'finished');assert.equal(history.size,0);assert.deepEqual(state.pendingHistory,['听力','阅读','写作']);
 fail=false;const recovered=flushExamHistory(state,record);assert.equal(recovered.error,'');assert.equal(history.size,3);assert.deepEqual(recovered.state.pendingHistory,[]);
 flushExamHistory(state,record);assert.equal(history.size,3);assert.equal(state.responses.写作,'My essay.');
 const missing=buildExamResult({...state,status:'active',phase:0},{},true);assert.equal(missing.score,null);assert.equal(missing.rawScore,null);assert.equal(missing.unscored,true);assert.ok(missing.details.every(d=>d.unscored));
 const repaired=buildExamResult({...state,status:'active',phase:0},data,true);assert.equal(repaired.unscored,false);assert.ok(Number.isFinite(repaired.score));
});

test('typing metrics count edits, missing and extra characters without confusing WPM with IELTS bands',async()=>{
 const {typingMetrics,validTypingDraft}=await import('../src/lib/typingPractice.js');
 assert.deepEqual(typingMetrics('hello world','hello',60),{characters:5,differences:0,accuracy:100,wpm:1,progress:45});
 assert.equal(typingMetrics('hello','hxllo',60).accuracy,80);assert.equal(typingMetrics('hello','hello!',60).differences,1);assert.equal(typingMetrics('hello','',0).wpm,0);
 const draft={target:'hello',typed:'hel',startedAt:1000,deadline:61000,duration:60,status:'active'};
 assert.equal(validTypingDraft(draft),true);assert.equal(validTypingDraft({...draft,deadline:1200}),false);assert.equal(validTypingDraft({...draft,typed:[]}),false);
});


test('original demo reading passages score correctly without proprietary source data',async()=>{
 const {loadReadingBank}=await import('../scripts/reading-bank-loader.mjs');
 const {scoreArticle,articleQuestionIds,articleResults}=await import('../src/lib/readingScoring.js');
 const bank=await loadReadingBank();assert.equal(bank.length,3);
 for(const article of bank){const responses=Object.fromEntries(article.questionGroups.flatMap(g=>g.questions.map(q=>[q.id,q.answer])));assert.equal(scoreArticle(article,responses),articleQuestionIds(article).length);assert.equal(scoreArticle(article,{}),0);assert.ok(articleResults(article,responses).every(q=>q.correct));}
});

test('three-choice listening ranges retain the middle question and score each unique choice once',async()=>{
 const {multipleQuestionIds,findQuestion,hasResponseForQuestion,calculateScore}=await import('../src/lib/listeningScoring.js');
 const group={id:'1-3',type:'multiple',limit:3,questionText:'Choose three workshop activities.',questions:[{id:'1'},{id:'3'}]};
 const data={questionIds:['1','2','3'],groups:[group],answerKey:{multipleMap:{q1:'A',q2:'C',q3:'E'}}};
 assert.deepEqual(multipleQuestionIds(group),['1','2','3']);
 assert.equal(findQuestion(data,'2').text,group.questionText);
 assert.equal(calculateScore(data,{'multi:1-3':['E','C','A']}),3);
 assert.equal(calculateScore(data,{'multi:1-3':['A','A','A']}),1);
 assert.equal(hasResponseForQuestion(data,{'multi:1-3':['A','','E']},'2'),false);
});
