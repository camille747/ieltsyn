export const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
export function readStored(key,fallback) {
 try { const store=window.ieltsDesktop?.store;const value=store?.get(key);if(value!=null)return value;const legacy=localStorage.getItem(key);if(!legacy)return fallback;const parsed=JSON.parse(legacy);if(store&&store.set(key,parsed)===false)throw new Error("无法保存");return parsed; }catch{return fallback;}
}
export function writeStored(key,value) {if(window.ieltsDesktop?.store){if(window.ieltsDesktop.store.set(key,value)===false)throw new Error("本机保存失败，请先导出当前练习。");}else localStorage.setItem(key,JSON.stringify(value));}
export const SESSION_KEY="ielts-speaking-sessions-v1";
export function readSessions(){const list=readStored(SESSION_KEY,[]);return Array.isArray(list)?list:[];}
export async function recordingDb(operation,...args){
 const db=await new Promise((resolve,reject)=>{const req=indexedDB.open("ielts-speaking-recordings-v1",1);req.onupgradeneeded=()=>req.result.createObjectStore("recordings");req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction("recordings",operation==="get"?"readonly":"readwrite");const request=tx.objectStore("recordings")[operation](...args);tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error||request.error);tx.onabort=()=>reject(tx.error||new Error("录音保存中断"));});}finally{db.close();}
}
export function download(value,filename) {if(!(value instanceof Blob))throw new Error("文档请使用 PDF 导出。");const url=URL.createObjectURL(value);const link=document.createElement("a");link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
export const countWords=(text="")=>text.trim().split(/\s+/).filter(Boolean).length;
export function buildQuestions(topic,pair) {return [...topic.questions.map((text,index)=>({id:`${topic.id}:${index}`,part:"part1",text})),{id:`${pair.id}:part2`,part:"part2",text:pair.title,cue:pair.cue},...pair.part3.map((text,index)=>({id:`${pair.id}:part3:${index}`,part:"part3",text}))];}
