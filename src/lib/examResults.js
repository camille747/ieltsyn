import {calculateScore,expectedAnswer,responseForQuestion,answerMatches,findQuestion} from './listeningScoring.js';
import {articleQuestionIds,articleResults,scoreArticle} from './readingScoring.js';
import {estimateListeningBand,estimateAcademicReadingBand} from './localStudyStore.js';
import {examSections} from './examEngine.js';

export function buildExamResult(state, listeningData, automatic = false) {
  const subject=(state.mode==='writing'?[examSections[2]]:examSections)[state.phase].subject;
  const items=subject==='听力'?state.items.listening:subject==='阅读'?state.items.reading:state.items.writing;
  const responses=Object.fromEntries(items.map(item=>[item.id,state.responses[item.id]||(subject==='写作'?'':{})]));
  const details=items.map(item=>{
    const response=responses[item.id];
    if(subject==='听力'){
      const data=listeningData[item.id];
      if(!data)return {id:item.id,title:item.title,score:null,total:null,unscored:true};
      return {id:item.id,title:item.title,score:calculateScore(data,response),total:data.questionIds.length,questions:data.questionIds.map(id=>({id,...findQuestion(data,id),response:responseForQuestion(data,response,id),expected:expectedAnswer(data,id),correct:answerMatches(responseForQuestion(data,response,id),expectedAnswer(data,id))}))};
    }
    if(subject==='阅读')return {id:item.id,title:item.title,score:scoreArticle(item,response),total:articleQuestionIds(item).length,questions:articleResults(item,response)};
    return {id:item.id,title:item.essayQuestion,task:item.task||'Task 2',words:String(response).trim().split(/\s+/).filter(Boolean).length};
  });
  const unscored=details.some(detail=>detail.unscored);
  const rawScore=subject==='写作'||unscored?null:details.reduce((sum,d)=>sum+d.score,0);
  const rawTotal=subject==='写作'||unscored?null:details.reduce((sum,d)=>sum+d.total,0);
  return {subject,automatic,responses,details,rawScore,rawTotal,unscored,score:rawScore==null?null:(subject==='听力'?estimateListeningBand:estimateAcademicReadingBand)(rawScore,rawTotal)};
}

// A failed history write must never undo a deadline lock. Pending IDs are saved
// with the exam; retries update the same history entry, including after a restart.
export function flushExamHistory(state, record) {
  const pending=[];let error='';
  for(const subject of state.pendingHistory||[]){
    const result=state.results.find(result=>result.subject===subject);if(!result)continue;
    try{record({...result,id:`${state.id}:${subject}`,page:state.mode==='writing'?'writing':'mock',title:state.mode==='writing'?'写作限时套题':`连续模考 · ${subject}`,detail:`${result.automatic?'到时自动交卷':'已交卷'} · 已锁定`,locked:true,submitted:true,intent:{tab:'history'}});}
    catch{pending.push(subject);error='练习记录暂未写入，已锁定的答案仍保留在本场模考中。请重试保存或导出备份。';}
  }
  return {state:{...state,pendingHistory:pending},error};
}
