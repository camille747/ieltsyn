import {useEffect,useRef,useState} from "react";
export default function useRecorder(onComplete) {
 const [backupUrl,setBackupUrl]=useState("");const backup=useRef("");
 const [state,setState]=useState("idle");const [error,setError]=useState("");const current=useRef(null);const complete=useRef(onComplete);complete.current=onComplete;const mounted=useRef(true);
 const cancel=()=>{const task=current.current;if(task){task.cancelled=true;clearTimeout(task.timeout);task.stream?.getTracks().forEach((t)=>t.stop());if(task.recorder?.state==="recording")task.recorder.stop();current.current=null;}if(mounted.current)setState("idle");};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;cancel();if(backup.current)URL.revokeObjectURL(backup.current);};},[]);
 const start=async(context)=>{
  if(current.current)return;if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setError("当前环境无法录音，请使用桌面 App 或本机预览。");return;}
  if(backup.current){URL.revokeObjectURL(backup.current);backup.current="";setBackupUrl("");}
  const task={cancelled:false,context,chunks:[],startedAt:Date.now()};current.current=task;setState("requesting");setError("");
  task.timeout=setTimeout(()=>{if(current.current===task){cancel();setError("麦克风请求超时。请检查系统权限后重试。");}},15000);
  try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});task.stream=stream;if(task.cancelled||!mounted.current){stream.getTracks().forEach((t)=>t.stop());return;}clearTimeout(task.timeout);const mime=["audio/webm;codecs=opus","audio/webm","audio/mp4"].find((type)=>MediaRecorder.isTypeSupported(type));const media=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);task.recorder=media;task.mime=media.mimeType;
   media.ondataavailable=(event)=>{if(event.data.size)task.chunks.push(event.data);};
   media.onerror=()=>{if(!task.cancelled){cancel();setError("录音设备中断，请检查麦克风后重试。");}};
   media.onstop=async()=>{stream.getTracks().forEach((t)=>t.stop());if(task.cancelled||!mounted.current)return;setState("saving");const blob=new Blob(task.chunks,{type:task.mime});try{if(!blob.size)throw new Error("录音为空");await complete.current(blob,task.context,Math.round((Date.now()-task.startedAt)/1000));}catch(e){if(mounted.current){backup.current=URL.createObjectURL(blob);setBackupUrl(backup.current);setError(`录音保存失败：${e.message}。请下载本次录音。`);}}finally{if(current.current===task)current.current=null;if(mounted.current)setState("idle");}};
   media.start();setState("recording");
  }catch(e){clearTimeout(task.timeout);task.stream?.getTracks().forEach((t)=>t.stop());if(!task.cancelled&&mounted.current){current.current=null;setState("idle");setError(e.name==="NotAllowedError"?"麦克风未授权。请在系统设置中允许后重试。":`无法录音：${e.message}`);}}
 };
 const stop=()=>{if(current.current?.recorder?.state==="recording"){setState("saving");current.current.recorder.stop();}};
 return {state,error,backupUrl,start,stop,cancel,busy:state!=="idle"};
}
