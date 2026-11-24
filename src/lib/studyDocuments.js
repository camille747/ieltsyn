import { downloadReport, readRestoreFile } from './pdfReport.js';
import { articleResults } from './readingScoring.js';
import { answerMatches, expectedAnswer, findQuestion, responseForQuestion, multipleQuestionIds } from './listeningScoring.js';
import { readValue } from './persistence.js';
import { matchingReadingAnalysis, readingAnalysisPayload } from './readingAi.js';

const h=(text,level=1)=>({type:'heading',text,level});
const p=text=>({type:'text',text:String(text??'')});
const m=text=>({type:'meta',text});
const val=value=>Array.isArray(value)?value.map(val).join('、'):value==null||value===''?'未作答':String(value);
const date=value=>value?new Date(value).toLocaleString('zh-CN'):'未记录时间';
const stamp=()=>`生成时间：${new Date().toLocaleString('zh-CN')} · 成绩仅为练习估分`;
const labelMap={report:'AI 反馈',plan:'修改计划',grammar:'语法与用词',logic:'逻辑与段落',note:'笔记',notes:'笔记',text:'内容',selectedText:'摘录',quote:'原文摘录',translation:'译文',meaning:'释义',term:'词汇',word:'单词',phrase:'短语',collocations:'搭配积累',explanation:'解析',approach:'解题思路',cause:'错因',reason:'原因',synonyms:'同义替换',vocabulary:'词汇积累',evidence:'原文依据',paragraph:'定位段落',paragraphId:'段落',questionId:'题号',questionPhrase:'题目表达',passagePhrase:'原文表达',question:'问题',answer:'回答',feedback:'反馈',summary:'评价',sourceText:'原句',ai:'AI 解析',aiQuestions:'AI 问答',questions:'个人问题',correct:'是否正确',title:'标题',status:'状态',done:'已做',reviewed:'已复盘',color:'标注颜色',value:'内容',score:'估分',date:'日期'};
function readable(value,blocks,label='') {
  if(value==null||value==='')return;
  if(typeof value!=='object'){blocks.push(p(`${label?label+'：':''}${typeof value==='boolean'?(value?'是':'否'):value}`));return;}
  if(Array.isArray(value)){value.forEach((v,i)=>readable(v,blocks,label?`${label} ${i+1}`:''));return;}
  for(const [key,v]of Object.entries(value)){
    if(labelMap[key]||/^[\u3400-\u9fff]/.test(key))readable(v,blocks,labelMap[key]||key);
    else if(/^\d+$/.test(key))readable(v,blocks,`题 ${key}`);
  }
}
function writingFeedback(report,blocks){
  blocks.push(h('AI 写作批改',2));
  if(!report){blocks.push(p('尚未生成 AI 批改。本文件保留本次原作文，不提供虚构评分。'));return;}
  blocks.push(p(`练习估分：${report.score??'待评分'} / 9`),p(report.summary||''));
  for(const [key,label]of [['task','任务完成 / 回应'],['coherence','连贯与衔接'],['lexical','词汇资源'],['grammar','语法多样性与准确性']]){
    const c=report.criteria?.[key];if(c)blocks.push(h(`${label} · ${c.score} 分`,2),p(c.feedback));
  }
  for(const [key,title]of [['grammar','语法与用词精批'],['logic','逻辑与段落优化']]){
    if(!report[key]?.length)continue;blocks.push(h(title,2));
    report[key].forEach((r,i)=>blocks.push(p(`${i+1}. 原句：${r.original}\n修改：${r.replacement||r.suggestion}\n原因：${r.reason}`)));
  }
  if(report.advice?.length)blocks.push(h('提分建议',2),p(report.advice.map((a,i)=>`${i+1}. ${a}`).join('\n')));
  if(report.revisedEssay)blocks.push(h('完整润色范文',2),p(report.revisedEssay));
  blocks.push(m([report.provider,report.model,'AI 反馈仅供练习参考，不代表官方 IELTS 成绩。'].filter(Boolean).join(' · ')));
}
export function writingBlocks(topic,state){
  const blocks=[h(`${topic.task||'Task 2'} · 题目`),p(topic.essayQuestion||topic.title||'原题未保存')];
  if(topic.image)blocks.push({type:'image',src:topic.image,caption:'Task 1 原题图表与题干'});
  blocks.push(h('本次原作文'),p(state.text||'本次未作答。'));
  writingFeedback(state.report||state.aiReport,blocks);
  if(state.reviewNotes&&Object.values(state.reviewNotes).some(Boolean)){blocks.push(h('我的复盘笔记'));readable(state.reviewNotes,blocks);}
  return blocks;
}
function optionsText(options){return (options||[]).map(o=>Array.isArray(o)?`${o[0]}. ${o[1]}`:typeof o==='string'?o:`${o.value??o.label??''}. ${o.text??o.label??''}`).join('\n');}
function answerBlocks(questions,blocks,reveal=true){
  for(const q of questions||[]){
    blocks.push(h(`题 ${q.id}${reveal&&typeof q.correct==='boolean'?` · ${q.correct?'正确':'需复盘'}`:''}`,2));
    if(q.text)blocks.push(p(q.text));if(q.options?.length)blocks.push(p(optionsText(q.options)));
    blocks.push(p(`你的答案：${val(q.response)}`));
    if(reveal){blocks.push(p(`正确答案：${q.expected==null?'原记录未保存':val(q.expected)}`));if(q.explanation)blocks.push(p(`解析：${q.explanation}`));}
  }
}
async function getListening(item){
  if(item.groups)return item;
  const path=`/data/listening${item.collection==='232'||String(item.id).startsWith('232-')?'-232':''}/${item.id}.json`;
  const r=await fetch(path);if(!r.ok)throw new Error(`无法读取听力原题：${item.title||item.id}`);return r.json();
}
function listeningBlocks(data,responses,blocks,reveal,stored){
  const seen=new Set();
  for(const g of data.groups||[]){
    if(g.title)blocks.push(h(g.title,2));if(g.instruction)blocks.push(p(g.instruction));
    if(g.options)blocks.push(p(optionsText(g.options)));
    for(const src of [g.image,...(g.images||[])].filter(Boolean))blocks.push({type:'image',src:typeof src==='string'?src:src.src,caption:'听力原题图'});
    const ids=g.type==='multiple'?multipleQuestionIds(g):(g.questions||[]).map(q=>String(Array.isArray(q)?q[0]:q.id));
    const qs=(data.questionIds||[]).filter(id=>ids.includes(String(id))&&!seen.has(String(id))).map(id=>{seen.add(String(id));const response=responseForQuestion(data,responses,id),expected=expectedAnswer(data,id);return {id,...findQuestion(data,id),response,expected,correct:answerMatches(response,expected)};});
    answerBlocks(qs,blocks,reveal);
  }
  answerBlocks((data.questionIds||[]).filter(id=>!seen.has(String(id))).map(id=>{
    const saved=stored?.find(q=>String(q.id)===String(id));
    const response=responseForQuestion(data,responses,id),expected=expectedAnswer(data,id);
    return saved||{id,...findQuestion(data,id),response,expected,correct:answerMatches(response,expected)};
  }),blocks,reveal);
}
function readingBlocks(article,responses,blocks,reveal,stored){
  if(article.intro)blocks.push(p(article.intro));
  for(const para of article.paragraphs||[])blocks.push(p(`${para.id}. ${para.text}`));
  for(const group of article.questionGroups||[]){
    if(group.title)blocks.push(h(group.title,2));if(group.instruction)blocks.push(p(group.instruction));
    if(group.context)blocks.push(p(group.context));if(group.options?.length)blocks.push(p(optionsText(group.options)));
    answerBlocks((stored||articleResults(article,responses)).filter(q=>String(q.groupId)===String(group.id)),blocks,reveal);
  }
}
function readingNotes(article,responses,blocks,context,reveal){
  const get=key=>context.values?.[key]??readValue(key,null);
  const notes=get(`ielts-reading-review-notes-v1:${article.id}`),annotations=get(`ielts-reading-annotations-v1:${article.id}`);
  if(notes&&Object.values(notes).some(Boolean)){blocks.push(h('我的阅读复盘笔记'));readable(notes,blocks);}
  if(annotations?.length){blocks.push(h('我的原文批注'));readable(annotations,blocks);}
  if(!reveal)return;
  const entries=get(`ielts-reading-ai-v1:${article.id}`)||{};
  for(const q of articleResults(article,responses)){
    const report=matchingReadingAnalysis(entries[q.id],readingAnalysisPayload(article,q));
    if(report){blocks.push(h(`题 ${q.id} · 已有 AI 解析`,2));readable(report,blocks);}
  }
}
export async function examBlocks(exam,context={}){
  const blocks=[];
  for(const [key,subject]of [['listening','听力'],['reading','阅读'],['writing','写作']]){
    const items=exam.items?.[key]||[];if(!items.length)continue;
    const result=exam.results?.find(r=>r.subject===subject);
    blocks.push(h(subject),m(result?`${Number.isFinite(result.score)?`练习估分 ${result.score} / 9`:'成绩待评阅'}${result.rawTotal?` · 答对 ${result.rawScore}/${result.rawTotal}`:''} · 已交卷锁定`:'当前草稿 · 尚未交卷，不展示参考答案'));
    for(const item of items){
      const detail=result?.details?.find(d=>d.id===item.id);
      const responses=result?.responses?.[item.id]??exam.responses?.[item.id]??(key==='writing'?'':{});
      if(key==='writing'){blocks.push(...writingBlocks(item,{text:responses,report:exam.writingReports?.[item.id]||detail?.aiReport,reviewNotes:exam.writingReviewNotes?.[item.id]}));continue;}
      blocks.push(h(item.title||item.id,2));
      if(key==='reading'){readingBlocks(item,responses,blocks,Boolean(result),detail?.questions);readingNotes(item,responses,blocks,context,Boolean(result));}
      else listeningBlocks(context.listeningData?.[item.id]||await getListening(item),responses,blocks,Boolean(result),detail?.questions);
    }
  }
  return blocks;
}
async function historyBlocks(record,context={}){
  const blocks=[h(record.title||'练习记录'),m(`${record.subject||'学习'} · ${date(record.submittedAt||record.updatedAt)}${Number.isFinite(record.score)?` · 练习估分 ${record.score} / 9`:''}${record.rawTotal?` · 答对 ${record.rawScore}/${record.rawTotal}`:''}`)];
  if(record.typing)return [...blocks,...typingBlocks(record.typing)];
  if(record.prompt){
    const draft=context.values?.[`ielts-writing-draft-v2:${record.prompt.id}`]??readValue(`ielts-writing-draft-v2:${record.prompt.id}`,null);
    const notes=record.reviewNotes||(draft&&record.id?.endsWith(`:${draft.startedAt}`)?draft.reviewNotes:null);
    return [...blocks,...writingBlocks(record.prompt,{text:record.responses?.essay,report:record.aiReport,reviewNotes:notes})];
  }
  const reveal=Boolean(record.submitted||record.review||record.locked);
  if(record.subject==='听力'&&record.intent?.itemId){
    const data=context.listeningData?.[record.intent.itemId]||await getListening({id:record.intent.itemId});listeningBlocks(data,record.responses||{},blocks,reveal);
  }else if(record.subject==='阅读'&&(record.intent?.archiveItemId||record.intent?.articleId)){
    const bank=context.readingBank||(await import('../data/reading-question-bank.js')).default;
    const article=bank.find(a=>(record.intent.archiveItemId&&a.archiveItemId===record.intent.archiveItemId)||(record.intent.articleId!=null&&String(a.articleId)===String(record.intent.articleId)));
    if(article){readingBlocks(article,record.responses||{},blocks,reveal);readingNotes(article,record.responses||{},blocks,context,reveal);}else{blocks.push(p('原题已不在当前题库中，以下保留原记录的作答。'));responseBlocks(record.responses,blocks);}
  }else if(record.details?.length){
    let readingBank,writingTopics;
    if(record.subject==='阅读')readingBank=context.readingBank||(await import('../data/reading-question-bank.js')).default;
    if(record.subject==='写作')writingTopics=context.writingTopics||[...(await import('../data/writing-task1.json')).default,...(await import('../data/writing-topics.json')).default.topics];
    for(const detail of record.details){
      const responses=record.responses?.[detail.id];
      if(record.subject==='写作'){
        const topic=writingTopics.find(t=>t.id===detail.id)||{task:detail.task,essayQuestion:detail.title};
        blocks.push(...writingBlocks(topic,{text:responses,report:detail.aiReport||record.aiReports?.[detail.id]}));continue;
      }
      blocks.push(h(detail.title||detail.task||'本部分作答',2));
      if(record.subject==='听力'){
        const data=context.listeningData?.[detail.id]||await getListening(detail);listeningBlocks(data,responses||{},blocks,reveal,detail.questions);continue;
      }
      const article=readingBank?.find(a=>a.id===detail.id);
      if(article){readingBlocks(article,responses||{},blocks,reveal,detail.questions);readingNotes(article,responses||{},blocks,context,reveal);continue;}
      if(detail.questions?.length)answerBlocks(detail.questions,blocks,reveal);
      else{responseBlocks(record.responses?.[detail.id],blocks);if(detail.aiReport||record.aiReports?.[detail.id])writingFeedback(detail.aiReport||record.aiReports[detail.id],blocks);}
    }
  }else responseBlocks(record.responses,blocks);
  if(record.aiReport&&!record.prompt)writingFeedback(record.aiReport,blocks);
  return blocks;
}
function responseBlocks(responses,blocks){
  if(responses==null){blocks.push(p('尚无作答。'));return;}
  if(typeof responses!=='object'){blocks.push(p(responses||'未作答'));return;}
  for(const [key,value]of Object.entries(responses)){
    if(Array.isArray(value))blocks.push(p(`${/^q?\d/.test(key)?'题 '+key.replace(/^q/,''):'所选答案'}：${val(value)}`));
    else if(value&&typeof value==='object')responseBlocks(value,blocks);
    else blocks.push(p(`${/^q?\d/.test(key)?'题 '+key.replace(/^q/,''):key==='essay'?'原作文':'本次作答'}：${val(value)}`));
  }
}
function typingBlocks(draft){
  const metrics=draft.metrics||{};
  return [h('打字练习'),m(`开始：${date(draft.startedAt)} · ${draft.status==='finished'?'已结束':'练习中'}`),p(`速度：${metrics.wpm??'待统计'} WPM · 准确率：${metrics.accuracy??'待统计'}% · 进度：${metrics.progress??'待统计'}%`),h('练习原文',2),p(draft.target||''),h('本次输入',2),p(draft.typed||'未输入')];
}
function speakingBlocks(session){
  const report=session.report,blocks=[h(session.topic||'口语连续练习'),m(`目标 ${session.targetBand||7} 分 · ${date(session.completedAt||session.updatedAt||session.createdAt)}`)];
  if(report){blocks.push(h('AI 练习反馈'),p(`词汇资源：${report.scores?.lexical??'待评阅'} / 9\n${report.feedback?.lexical||''}\n语法多样性：${report.scores?.grammar??'待评阅'} / 9\n${report.feedback?.grammar||''}`),m('本报告依据回答文字；不提供发音、实际流利度或口语总分。'));}
  else blocks.push(p('尚未生成 AI 反馈，以下为本轮已保存的回答。'));
  for(const [index,q]of(session.questions||[]).entries()){
    const a=session.answers?.find(a=>a.id===q.id),feedback=report?.answers?.find(a=>a.id===q.id);
    blocks.push(h(`${q.part?.replace('part','Part ')} · 第 ${index+1} 题`,2),p(q.text));if(q.cue)blocks.push(p(Array.isArray(q.cue)?q.cue.join('\n'):q.cue));
    blocks.push(p(`原回答：\n${session.drafts?.[q.id]??a?.answer??'未作答'}`));
    if(session.recordingKeys?.[q.id])blocks.push(m('本题有本机录音；含录音的 PDF 备份重新导入应用后可回放。'));
    if(feedback)blocks.push(p(`回答润色：\n${feedback.polished}`),p(`目标分数范例：\n${feedback.example}`),p(`语法与用词建议：\n${feedback.notes}`));
  }
  return blocks;
}
const time=seconds=>`${Math.floor((seconds||0)/60)}:${String(Math.floor((seconds||0)%60)).padStart(2,'0')}`;
export function subtitleBlocks(cues){return cues.flatMap((cue,i)=>[h(`${i+1} · ${time(cue.start)} - ${time(cue.end)}`,2),p(cue.text),...(cue.translation?[p(cue.translation)]:[])]);}
async function shadowBlocks(data,context){
  const blocks=[];
  for(const [id,saved]of Object.entries(data.progress||{})){
    const item=context.items?.find(i=>i.id===id);
    blocks.push(h(item?.title||'影子跟读素材'),m(`${saved.completed?'已完成':'练习中'} · ${saved.favorite?'已收藏 · ':''}${date(saved.updatedAt)}`));
    let cues=saved.customCues||item?.cues||[];
    if(typeof cues==='string'){const r=await fetch(new URL(cues,context.libraryUrl));if(!r.ok)throw new Error(`字幕读取失败：${item?.title||id}`);const value=await r.json();cues=value.cues||value;}
    if(Array.isArray(cues))blocks.push(...subtitleBlocks(cues));
    if(saved.notes&&Object.values(saved.notes).some(Boolean)){blocks.push(h('我的笔记',2));Object.entries(saved.notes).forEach(([key,value])=>{if(value)blocks.push(p(`${cues.find?.(c=>String(c.id)===key)?.text||'笔记'}\n${value}`));});}
    if(saved.analysis){blocks.push(h('句子解析与问答',2));Object.values(saved.analysis).forEach(a=>readable(a,blocks));}
    if(saved.vocabulary?.length){blocks.push(h('词汇积累',2));readable(saved.vocabulary,blocks);}
  }
  return blocks.length?blocks:[p('尚未保存跟读记录或笔记。')];
}
export async function buildStudyDocument(value,context={}){
  let title='学习记录',blocks=[],restore;
  if(value.format==='ielts-study-backup'){
    title='学习档案与备份';restore=value;
    const values=value.values||{};context={...context,values};blocks.push(p(`备份时间：${date(value.exportedAt)}\n包含练习、草稿、批注与复盘；这份原始 PDF 可重新导入本应用恢复。`));
    for(const record of values['ielts-local-study-history-v1']||[])blocks.push(...await historyBlocks(record,context),{type:'rule'});
    for(const [key,stored]of Object.entries(values)){
      if(key==='ielts-local-study-history-v1'||stored==null)continue;
      if(key.startsWith('ielts-exam-v2:'))blocks.push(h('保存中的模考'),...await examBlocks(stored,context));
      else if(key.startsWith('ielts-writing-draft-v2:')){blocks.push(h('写作草稿'),p(stored.text||'未作答'));if(stored.report)writingFeedback(stored.report,blocks);readable(stored.reviewNotes,blocks);}
      else if(key.includes('typing')&&stored.target)blocks.push(...typingBlocks(stored));
      else if(/notes|annotations|analysis|reading-ai|pdf-study|pdf-ocr|vocabulary|wrong-items/.test(key)){const section=[];readable(stored,section);if(section.length)blocks.push(h(key.includes('pdf')?'PDF 学习笔记':'阅读批注与复盘'),...section);}
    }
  }else if(value.format==='ielts-speaking-session'){title='口语练习与反馈报告';blocks=speakingBlocks(value.session);restore=value;}
  else if(value.format==='ielts-language-bank'){title='个人表达积累';restore=value;blocks=value.phrases.length?value.phrases.flatMap((v,i)=>[h(`${i+1}. ${v.text}`,2),m(`关联话题：${v.topics?.join('、')||'未分类'}`)]):[p('尚未收藏个人表达。')];}
  else if(value.format==='ielts-shadowing-progress'){title='影子跟读 · 字幕与笔记';restore=value;blocks=await shadowBlocks(value,context);}
  else if(value.format==='ielts-subtitles'){title='跟读字幕';blocks=subtitleBlocks(value.cues);}
  else if(value.items&&value.responses){title='模考答案与学习报告';blocks=await examBlocks(value,context);}
  else if(value.topic){title='写作答案与批改报告';blocks=writingBlocks(value.topic,value);}
  else if(value.target&&typeof value.typed==='string'){title='英语打字练习报告';blocks=typingBlocks(value);}
  else{title='练习记录与复盘';blocks=await historyBlocks(value,context);}
  return {title,subtitle:stamp(),blocks,restore};
}
export async function exportStudyPdf(value,filename,context={}){
  return downloadReport(()=>buildStudyDocument(value,context),filename);
}
export {readRestoreFile};
