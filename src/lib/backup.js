import { validTypingDraft } from "./typingPractice.js";
import { validPdfInk } from "./pdfInk.js";
import { LOCAL_STUDY_EVENT } from "./localStudyStore.js";
import { isReadingAnalysis, isReadingTextReport } from "./readingAi.js";
export function collectBackup() {
  const values = {};
  for (let i=0;i<localStorage.length;i++) {
    const key=localStorage.key(i);
    if (!key?.startsWith("ielts-")) continue;
    const raw=localStorage.getItem(key);try {values[key]=JSON.parse(raw);}catch {values[key]=raw;}
  }
  Object.assign(values,window.ieltsDesktop?.store?.snapshot?.()||{});
  return {format:"ielts-study-backup",version:1,exportedAt:Date.now(),values};
}
export function validateBackup(data) {
  if(data?.format!=="ielts-study-backup"||data.version!==1||!data.values||Array.isArray(data.values)||typeof data.values!=="object")throw new Error("请选择此应用生成的学习备份 PDF。");
  const entries=Object.entries(data.values);
  if(entries.length>10000||entries.some(([key,value])=>!key.startsWith("ielts-")||key.length>249||value===undefined))throw new Error("备份包含无效数据项。");
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  for(const [key,value] of entries){
    if(key==="ielts-typing-draft-v1"&&!validTypingDraft(value))throw new Error("打字训练备份格式有误。");
    if(key.startsWith("ielts-pdf-ink-v1:")&&!validPdfInk(value))throw new Error("PDF 手写批注备份格式有误。");
    if(key.startsWith("ielts-pdf-ocr-v1:")&&(!object(value)||typeof value.text!=="string"||value.text.length>30000||typeof value.uncertain!=="boolean"))throw new Error("PDF 文字识别备份格式有误。");
    if(key.startsWith("ielts-reading-ai-v1:") && (!object(value) || Object.keys(value).length > 100 || Object.values(value).some((item) => !object(item) || typeof item.input !== "string" || item.input.length > 100000 || !isReadingAnalysis(item.report))))throw new Error("阅读 AI 复盘备份格式有误。");
    if(key.startsWith("ielts-pdf-study-v1:")) {
      if(!object(value) || (value.note != null && typeof value.note !== "string") || (value.source != null && typeof value.source !== "string") || (value.report != null && (!isReadingTextReport(value.report) || typeof value.excerpt !== "string")) || (value.annotations != null && (!Array.isArray(value.annotations) || value.annotations.length > 500 || value.annotations.some((a) => !object(a) || typeof a.id !== "string" || typeof a.paragraphId !== "string" || !Number.isInteger(a.start) || !Number.isInteger(a.end) || a.start < 0 || a.end <= a.start || a.end > (value.source?.length || 0) || !["brown","yellow","red","blue","green","purple","orange"].includes(a.color) || typeof a.note !== "string"))))throw new Error("PDF 笔记或文字解析备份格式有误。");
    }
    if(key==="ielts-local-theme-v1" && !["light","dark"].includes(value))throw new Error("备份主题值无效。");
    if(/ielts-reading-status-v1|ielts-reading-review-notes-v1:|ielts-writing-draft-v2:/.test(key) && !object(value))throw new Error(`备份结构有误：${key}`);
    if(key.startsWith("ielts-writing-draft-v2:") && (typeof value.text!=="string" || typeof value.submitted!=="boolean"))throw new Error("写作草稿格式有误。");
    if(key.startsWith("ielts-exam-v2:") && value!==null){
      const subjects=key.endsWith(":writing")?["写作"]:["听力","阅读","写作"];
      if(!object(value)||typeof value.id!=="string"||!object(value.items)||!object(value.responses)||!Array.isArray(value.results)||!Number.isInteger(value.phase)||value.phase<0||value.phase>=subjects.length||!["active","locked","finished"].includes(value.status)||!(key.endsWith(":writing")?["writing"]:["listening","reading","writing"]).every(subject=>Array.isArray(value.items[subject])))throw new Error("模考进度格式有误。");
      if(!Number.isFinite(value.deadline))throw new Error("模考倒计时格式有误。");
      if(value.audioPlayback!=null){const audio=value.audioPlayback;if(!object(audio)||!Number.isInteger(audio.index)||audio.index<0||audio.index>(value.items.listening?.length||0)||!Number.isFinite(audio.time)||audio.time<0||typeof audio.started!=="boolean")throw new Error("模考音频播放位置无效。");}
    }
    if(/history-v1|wrong-items-v1|annotations-v1:/.test(key)&&!Array.isArray(value))throw new Error(`备份结构有误：${key}`);
    if(key==="ielts-local-study-history-v1"&&value.some((x)=>!x||typeof x.id!=="string"||typeof x.title!=="string"||!Number.isFinite(x.updatedAt)))throw new Error("练习记录格式有误。");
  }
  return data;
}
export function restoreBackup(data) {
  validateBackup(data);
  const entries=Object.entries(data.values);
  if(window.ieltsDesktop?.store?.restore){if(window.ieltsDesktop.store.restore(data.values)!==true)throw new Error("恢复失败，原数据仍保留。");}
  else {
    const before=entries.map(([key])=>[key,localStorage.getItem(key)]);
    try{for(const [key,value] of entries)localStorage.setItem(key,typeof value==="string"&&key==="ielts-local-theme-v1"?value:JSON.stringify(value));}
    catch(error){for(const [key,value] of before){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}throw new Error("本机存储空间不足，已撤回恢复操作。");}
  }
  if(data.values["ielts-local-theme-v1"]){const theme=data.values["ielts-local-theme-v1"];localStorage.setItem("ielts-local-theme-v1",theme);document.documentElement.dataset.theme=theme;}
  window.dispatchEvent(new CustomEvent(LOCAL_STUDY_EVENT));
}
