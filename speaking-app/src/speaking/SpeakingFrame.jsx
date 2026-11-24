import { useEffect, useState } from "react";
import { ClockCounterClockwise, GearSix, House, Microphone, Moon, Sun, Video } from "@phosphor-icons/react";
import { AppFrame } from "../../../src/components/LearningUI";
const navigation=[{id:"home",label:"首页",icon:House},{id:"practice",label:"口语练习",icon:Microphone},{id:"shadowing",label:"影子跟读",icon:Video},{id:"records",label:"练习记录",icon:ClockCounterClockwise},{id:"settings",label:"AI 设置",icon:GearSix}];
export default function SpeakingFrame({active,navigate,locked,children}) {
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem("ielts-speaking-theme-v1")==="dark"?"dark":"light";}catch{return "light";}});
  useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem("ielts-speaking-theme-v1",theme);}catch{/* The selected appearance remains available for this session. */}},[theme]);
  return <AppFrame active={active} navigate={navigate} navigation={navigation} product="口语学习" locked={locked} tools={<button className="studio-theme" onClick={()=>setTheme(theme==="dark"?"light":"dark")} aria-label={theme==="dark"?"切换浅色外观":"切换深色外观"}>{theme==="dark"?<Sun size={20}/>:<Moon size={20}/>}</button>}>{children}</AppFrame>;
}
