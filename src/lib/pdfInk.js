export const inkColors=['#a43f3f','#88602f','#246695','#35734b'];
export function validPdfInk(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>2000)return false;
 let total=0;
 return Object.entries(value).every(([page,strokes])=>/^[1-9]\d{0,4}$/.test(page)&&Array.isArray(strokes)&&strokes.length<=1000&&strokes.every(s=>s&&inkColors.includes(s.color)&&Number.isFinite(s.width)&&s.width>=.0005&&s.width<=.03&&Array.isArray(s.points)&&s.points.length>0&&s.points.length<=5000&&(total+=s.points.length)<=200000&&s.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&v>=0&&v<=1))));
}
export function pdfInkSegments(stroke,width,height){
 const points=stroke.points.map(([x,y])=>[x*width,(1-y)*height]);
 if(points.length===1)points.push([points[0][0]+.01,points[0][1]]);
 return points.slice(1).map((end,index)=>({start:{x:points[index][0],y:points[index][1]},end:{x:end[0],y:end[1]}}));
}
export async function exportAnnotatedPdf(bytes,ink){
 if(!validPdfInk(ink))throw new Error('批注数据无效，请先导出学习备份。');
 const {PDFDocument,rgb}=await import('pdf-lib');
 const pdf=await PDFDocument.load(bytes);const pages=pdf.getPages();
 for(const [number,strokes] of Object.entries(ink)){
  const page=pages[Number(number)-1];if(!page)continue;
  // pdf.js displays the CropBox with page rotation. Put marks into that same
  // coordinate system, then map each point back to the original PDF space.
  const crop=page.getCropBox(),rotation=((page.getRotation().angle%360)+360)%360;
  const displayWidth=rotation%180?crop.height:crop.width,displayHeight=rotation%180?crop.width:crop.height;
  const mapPoint=({x,y})=>{
   if(rotation===90)return {x:crop.x+crop.width-y,y:crop.y+x};
   if(rotation===180)return {x:crop.x+crop.width-x,y:crop.y+crop.height-y};
   if(rotation===270)return {x:crop.x+y,y:crop.y+crop.height-x};
   return {x:crop.x+x,y:crop.y+y};
  };
  for(const stroke of strokes){const hex=stroke.color.slice(1),color=rgb(...[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255));for(const segment of pdfInkSegments(stroke,displayWidth,displayHeight))page.drawLine({start:mapPoint(segment.start),end:mapPoint(segment.end),color,thickness:stroke.width*displayWidth,lineCap:1});}
 }
 return pdf.save();
}
