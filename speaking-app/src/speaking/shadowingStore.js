const KEY = "ielts-speaking-shadowing-progress-v1";

export function readProgress() {
  try {
    const value = window.ieltsDesktop?.store?.get(KEY) ?? JSON.parse(localStorage.getItem(KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

export function writeProgress(value) {
  if (window.ieltsDesktop?.store) {
    if (!window.ieltsDesktop.store.set(KEY, value)) throw new Error("无法保存跟读进度");
  } else localStorage.setItem(KEY, JSON.stringify(value));
}

async function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("ielts-speaking-shadowing-v1", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("assets", { keyPath: "id" });
      req.result.createObjectStore("recordings");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function shadowDb(store, mode, operation, ...args) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const request = tx.objectStore(store)[operation](...args);
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error || request.error);
      tx.onabort = () => reject(tx.error || new Error("本机存储写入中断"));
    });
  } finally { db.close(); }
}

export function cueAtTime(cues, time) {
  let lo = 0, hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (time < cues[mid].start) hi = mid - 1;
    else if (time >= cues[mid].end) lo = mid + 1;
    else return mid;
  }
  return -1;
}

export function parseSubtitles(text) {
  const timestamp = (value) => {
    const parts = value.replace(",", ".").split(":").map(Number);
    return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  };
  const cues = [];
  for (const block of text.replace(/^\uFEFF/, "").replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = block.trim().split("\n");
    const line = lines.findIndex((s) => s.includes("-->"));
    if (line < 0) continue;
    const match = lines[line].match(/((?:\d+:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d+:)?\d{2}:\d{2}[.,]\d{3})/);
    if (!match) continue;
    const start = timestamp(match[1]), end = timestamp(match[2]);
    const content = lines.slice(line + 1).join(" ").replace(/<[^>]*>/g, "").trim();
    if (Number.isFinite(start) && end > start && content) cues.push({ start, end, text: content });
  }
  return cues.sort((a, b) => a.start - b.start).map((cue, id) => ({ ...cue, id }));
}

export const clockTime = (seconds = 0) => {
  const total = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export function validateCues(cues,duration=0){
 if(!Array.isArray(cues)||!cues.length||cues.length>10000)throw new Error("字幕需包含有效时间轴语句。");
 for(let i=0;i<cues.length;i++){const cue=cues[i];if(!Number.isFinite(cue.start)||!Number.isFinite(cue.end)||cue.start<0||cue.end<=cue.start||(typeof cue.text!=="string"||!cue.text.trim()))throw new Error(`第 ${i+1} 句的文字或时间无效。`);if(duration&&cue.end>duration+0.05)throw new Error(`第 ${i+1} 句超出了素材时长。`);if(i&&cue.start<cues[i-1].end)throw new Error(`第 ${i+1} 句与上一句时间重叠，请调整时间。`);}
 return cues;
}
export function toVtt(cues){const stamp=(seconds)=>{const ms=Math.round(seconds*1000);return `${String(Math.floor(ms/3600000)).padStart(2,"0")}:${String(Math.floor(ms%3600000/60000)).padStart(2,"0")}:${String(Math.floor(ms%60000/1000)).padStart(2,"0")}.${String(ms%1000).padStart(3,"0")}`;};return "WEBVTT\n\n"+cues.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n${c.translation||""}`.trim()).join("\n\n")+"\n";}

export function validateProgress(progress) {
 if(!progress||typeof progress!=="object"||Array.isArray(progress)||Object.keys(progress).length>10000)throw new Error("跟读备份结构无效。");
 for(const entry of Object.values(progress)){
  if(!entry||typeof entry!=="object"||Array.isArray(entry))throw new Error("跟读备份包含无效素材进度。");
  if(entry.time!=null&&(!Number.isFinite(entry.time)||entry.time<0))throw new Error("跟读备份播放位置无效。");
  for(const flag of ["favorite","completed"])if(entry[flag]!=null&&typeof entry[flag]!=="boolean")throw new Error("跟读备份标记无效。");
  if(entry.notes!=null&&(typeof entry.notes!=="object"||Array.isArray(entry.notes)||Object.values(entry.notes).some(note=>typeof note!=="string")))throw new Error("跟读备份笔记无效。");
  if(entry.customCues!=null)validateCues(entry.customCues);
  if(entry.analysis!=null){
   if(typeof entry.analysis!=="object"||Array.isArray(entry.analysis))throw new Error("跟读备份解析无效。");
   for(const note of Object.values(entry.analysis)) {
    if(note?.ai!=null&&(!note.ai||["sourceText","translation","collocations","grammar"].some(k=>typeof note.ai[k]!=="string")))throw new Error("跟读备份 AI 解析无效。");
    if(note?.aiQuestions!=null&&(!Array.isArray(note.aiQuestions)||note.aiQuestions.some(q=>!q||typeof q.question!=="string"||typeof q.answer!=="string")))throw new Error("跟读备份 AI 问答无效。");
    if(!note||typeof note!=="object"||Array.isArray(note)||(note.collocations!=null&&typeof note.collocations!=="string")||(note.grammar!=null&&typeof note.grammar!=="string")||(note.questions!=null&&(!Array.isArray(note.questions)||note.questions.some(q=>typeof q!=="string"))))throw new Error("跟读备份解析内容无效。");
   }
  }
  if(entry.vocabulary!=null&&(!Array.isArray(entry.vocabulary)||entry.vocabulary.length>10000||entry.vocabulary.some(word=>!word||typeof word.id!=="string"||typeof word.text!=="string"||!word.text.trim()||typeof word.meaning!=="string"||typeof word.example!=="string"||!["string","number"].includes(typeof word.cueId)||typeof word.learned!=="boolean")||new Set(entry.vocabulary.map(word=>word.id)).size!==entry.vocabulary.length))throw new Error("跟读备份表达积累无效。");
 }
 return progress;
}
