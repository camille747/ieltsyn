import {useRef,useState} from 'react';
export default function PdfInkLayer({strokes,onChange,enabled,color,width,size}){
 const svg=useRef(null),draft=useRef(null);const [current,setCurrent]=useState(null);
 const point=e=>{const r=svg.current.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];};
 const finish=()=>{if(!draft.current)return;const next=draft.current;draft.current=null;setCurrent(null);onChange([...strokes,next]);};
 return <svg ref={svg} className={`pdf-ink-layer${enabled?' drawing':''}`} viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-label="PDF 原页手写批注" onPointerDown={e=>{if(!enabled||e.button!==0||strokes.length>=1000)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);draft.current={color,width,points:[point(e)]};setCurrent({...draft.current});}} onPointerMove={e=>{if(!draft.current||draft.current.points.length>=5000)return;draft.current.points.push(point(e));setCurrent({...draft.current});}} onPointerUp={finish} onPointerCancel={()=>{draft.current=null;setCurrent(null);}}>
 {[...strokes,...(current?[current]:[])].map((s,i)=>s.points.length===1?<circle key={i} cx={s.points[0][0]*size.width} cy={s.points[0][1]*size.height} r={s.width*size.width/2} fill={s.color}/>:<polyline key={i} points={s.points.map(([x,y])=>`${x*size.width},${y*size.height}`).join(' ')} fill="none" stroke={s.color} strokeWidth={s.width*size.width} strokeLinecap="round" strokeLinejoin="round"/>)}
 </svg>;
}
