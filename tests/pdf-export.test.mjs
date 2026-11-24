import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {buildStudyDocument} from '../src/lib/studyDocuments.js';
import {createReportPdf,readRestoreFile} from '../src/lib/pdfReport.js';

const root=new URL('../',import.meta.url);
const json=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const flatten=doc=>doc.blocks.map(b=>b.text||b.caption||'').join('\n');
const report={score:6.5,summary:'自动测试样例：观点清楚，论证需要展开。',criteria:Object.fromEntries(['task','coherence','lexical','grammar'].map(k=>[k,{score:6.5,feedback:'自动测试：补充原句证据与具体建议。'}])),grammar:[{original:'People learns skills.',replacement:'People learn skills.',reason:'主谓一致。'}],logic:[{original:'Education is useful.',suggestion:'Explain how classroom feedback improves practical skills.',reason:'补充论点与例子。'}],advice:['补充实例','检查主谓一致'],revisedEssay:'This is a test example of a revised essay, not a real learner assessment.',provider:'测试',model:'测试模型'};
const topic={id:'test-writing',task:'Task 2',essayQuestion:'Should adults learn practical skills by themselves or from a teacher?'};
const writing={topic,text:'People learns skills.\nEducation is useful.',report,reviewNotes:{plan:'检查主谓一致',grammar:'learn 使用原形',logic:'补充例子'}};

test('writing PDF contains prompt, original, four criteria, evidence, revision and all review notes',async()=>{
  const doc=await buildStudyDocument(writing),text=flatten(doc);
  for(const expected of [topic.essayQuestion,writing.text,'任务完成 / 回应','连贯与衔接','词汇资源','语法多样性','People learn skills.','主谓一致','完整润色范文','补充例子'])assert.ok(text.includes(expected),expected);
  const pending=flatten(await buildStudyDocument({topic,text:'Draft only.'}));assert.match(pending,/尚未生成 AI 批改/);assert.ok(!pending.includes('6.5'));
});

test('exam export includes original questions and graphs, submitted answers and key, but protects unsubmitted answer keys',async()=>{
  const listening=await json('public/data/listening-232/232-001.json');
  const reading={id:'reading-test',title:'Reading Test',part:'P1',paragraphs:[{id:'A',text:'Teachers give feedback.'}],questionGroups:[{id:'g1',title:'Question 1',instruction:'Choose YES or NO.',questions:[{id:'1',text:'Teachers give feedback.',answer:'YES'}]}]};
  const exam={items:{listening:[{id:'232-001',title:listening.title,collection:'232'}],reading:[reading],writing:[topic]},responses:{'232-001':{q1:'wrong'},'reading-test':{'1':'YES'},'test-writing':writing.text},results:[{subject:'听力',score:2,rawScore:0,rawTotal:10,responses:{'232-001':{q1:'wrong'}}},{subject:'阅读',score:9,rawScore:1,rawTotal:1,responses:{'reading-test':{'1':'YES'}}},{subject:'写作',score:6.5,responses:{'test-writing':writing.text}}],writingReports:{'test-writing':report}};
  const context={listeningData:{'232-001':listening}};
  const text=flatten(await buildStudyDocument(exam,context));
  for(const s of [listening.title,listening.groups[0].instruction,'你的答案：wrong','正确答案：','Teachers give feedback.',topic.essayQuestion,report.summary])assert.ok(text.includes(s),s);
  const active=flatten(await buildStudyDocument({...exam,results:[]},context));assert.ok(!active.includes('正确答案：'));assert.match(active,/当前草稿/);
  const graph=await buildStudyDocument({topic:{...topic,task:'Task 1',image:'/graph.png'},text:'Graph essay.'});assert.ok(graph.blocks.some(b=>b.type==='image'&&b.src==='/graph.png'));
});

test('listening matching and multiple questions are not lost during export',async()=>{
  const data={questionIds:['1','2','3'],answerKey:{matching:{q1:'A'},multipleMap:{q2:'B',q3:'C'}},groups:[{type:'matching',questions:[['1','Match this question.']]},{id:'2-3',type:'multiple',questionText:'Choose TWO letters.',instruction:'Select two.',limit:2,options:[['B','Beta'],['C','Charlie']]}]};
  const doc=await buildStudyDocument({subject:'听力',title:'Matching test',review:true,intent:{itemId:'test'},responses:{q1:'A','multi:2-3':['B','C']}},{listeningData:{test:data}});
  const text=flatten(doc);for(const s of ['题 1','题 2','题 3','Match this question.','Choose TWO letters.','正确答案：B','正确答案：C'])assert.ok(text.includes(s),s);
});

test('PDFs remain readable documents and preserve recoverable data including audio and legacy import',async()=>{
  const fontBytes=await readFile(new URL('src/assets/pdf/NotoSansSC-Regular.ttf',root));
  const restore={format:'ielts-speaking-session',version:2,session:{id:'pdf-test',questions:[{id:'q',part:'part1',text:'What do you study?'}],drafts:{q:'I study English.'},recordingKeys:{q:'audio'},targetBand:7},recordings:{audio:'data:audio/wav;base64,UklGRg=='}};
  const doc=await buildStudyDocument(restore);
  doc.blocks.push(...Array.from({length:75},(_,i)=>({type:'text',text:`第 ${i+1} 段 · 中英文混排分页检查。 Education gives people the tools to understand the world.\n${'Practice and feedback help students improve their skills. '.repeat(4)}`})));
  const bytes=await createReportPdf(doc,{fontBytes});assert.equal(new TextDecoder().decode(bytes.slice(0,5)),'%PDF-');
  const pdf=await PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>3);
  assert.deepEqual(await readRestoreFile(new Blob([bytes])),restore);
  assert.deepEqual(await readRestoreFile(new Blob([JSON.stringify(restore)])),restore);
  const plain=await createReportPdf({title:'普通报告',blocks:[]},{fontBytes});await assert.rejects(()=>readRestoreFile(new Blob([plain])),/不含.*恢复数据/);
  const folder=new URL('.impeccable/review/pdf-export/',root);await mkdir(folder,{recursive:true});await writeFile(new URL('pagination-and-restore-sample.pdf',folder),bytes);
  await writeFile(new URL('writing-sample.pdf',folder),await createReportPdf(await buildStudyDocument(writing),{fontBytes}));
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=getDocument({data:bytes.slice(),isEvalSupported:false});const loaded=await task.promise;
  let text='';for(let i=1;i<=loaded.numPages;i++){const p=await loaded.getPage(i),content=await p.getTextContent();text+=content.items.map(x=>x.str).join(' ');for(const item of content.items){assert.ok(item.transform[5]>=20&&item.transform[5]<=842,'text within page height');}}
  await task.destroy();
  const normalized=text.replace(/\s+/g,'');
  for(const s of ['口语练习与反馈报告','I study English.','第 75 段','Education gives people'])assert.ok(normalized.includes(s.replace(/\s+/g,'')),s);
});

test('phrase and shadow documents include actual content and are restorable',async()=>{
  const phrases={format:'ielts-language-bank',phrases:[{text:'on the other hand',topics:['观点','写作']}]};const a=await buildStudyDocument(phrases);assert.match(flatten(a),/on the other hand/);assert.equal(a.restore,phrases);
  const shadow={format:'ielts-shadowing-progress',version:1,progress:{clip:{customCues:[{id:'c',start:1,end:3,text:'Hello there.',translation:'你好。'}],notes:{c:'注意连读'},vocabulary:[{word:'hello',meaning:'你好'}],analysis:{c:{grammar:'问候语'}}}}};const b=await buildStudyDocument(shadow,{items:[{id:'clip',title:'Welcome'}]});for(const s of ['Welcome','Hello there.','你好。','注意连读','问候语'])assert.ok(flatten(b).includes(s),s);assert.equal(b.restore,shadow);
});

test('history suite export restores task prompts and question images alongside saved results',async()=>{
  const topic={id:'t1',task:'Task 1',essayQuestion:'Describe this chart.',image:'/chart.png'};
  const doc=await buildStudyDocument({subject:'写作',title:'写作套题',submitted:true,responses:{t1:'My chart essay.'},details:[{id:'t1',task:'Task 1',title:'Describe this chart.',aiReport:report}]},{writingTopics:[topic]});
  assert.ok(doc.blocks.some(b=>b.type==='image'&&b.src==='/chart.png'));assert.match(flatten(doc),/My chart essay/);assert.ok(flatten(doc).includes(report.summary));
});
