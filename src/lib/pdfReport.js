import { PDFDocument, StandardFonts, PDFName, PDFDict, PDFArray, PDFRawStream, decodePDFRawStream, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const FONT_URL = new URL('../assets/pdf/NotoSansSC-Regular.ttf', import.meta.url);
const RESTORE_NAME = 'ielts-restore.dat';
let fontPromise;
const ink = rgb(.16,.17,.22), muted = rgb(.38,.39,.45), purple = rgb(.29,.23,.49), line = rgb(.83,.82,.87);
const clean = value => String(value ?? '').replace(/\r\n?/g,'\n').replace(/\t/g,'    ').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');

/** A4, selectable Unicode text, embedded offline font and bounded page layout. */
export async function createReportPdf(document, {fontBytes, loadImage} = {}) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  if (!fontBytes) {
    fontPromise ||= fetch(FONT_URL).then(r=>{if(!r.ok)throw new Error('中文字体读取失败，请刷新后重试。');return r.arrayBuffer();}).catch(e=>{fontPromise=null;throw e;});
    fontBytes = await fontPromise;
  }
  // Keep the original glyph IDs. Fontkit's subsetter drops composite outlines
  // in this CJK face even when the PDF's text extraction still looks correct.
  const font = await pdf.embedFont(fontBytes,{subset:false});
  const latin = await pdf.embedFont(StandardFonts.Helvetica);
  const runs=text=>text.match(/[\x20-\x7e]+|[^\x20-\x7e]+/gu)||[];
  const face=text=>/^[\x20-\x7e]+$/.test(text)?latin:font;
  pdf.setTitle(clean(document.title)); pdf.setAuthor('IELTSyn'); pdf.setCreator('IELTSyn PDF Reports');
  const width=595.28,height=841.89,margin=48,bodyWidth=width-margin*2,bottom=58;
  let page,y;
  const newPage=()=>{page=pdf.addPage([width,height]);y=height-62;};
  const ensure=space=>{if(y-space<bottom)newPage();};
  const measure=(text,size)=>runs(text).reduce((sum,run)=>sum+face(run).widthOfTextAtSize(run,size),0);
  const draw=(target,value,x,baseline,size,color)=>{for(const run of runs(value)){const f=face(run);target.drawText(run,{x,y:baseline,size,font:f,color});x+=f.widthOfTextAtSize(run,size);}};
  const wrap=(value,size,available=bodyWidth)=>{
    const lines=[];
    for(const paragraph of clean(value).split('\n')) {
      if(!paragraph){lines.push('');continue;}
      let current='';
      const tokens=paragraph.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*|[^\x00-\x7F]|[^A-Za-z0-9]/gu)||[];
      for(const token of tokens){
        if(measure(current+token,size)<=available){current+=token;continue;}
        if(current.trim())lines.push(current.trimEnd()); current='';
        for(const char of token){if(current&&measure(current+char,size)>available){lines.push(current);current='';}current+=char;}
      }
      lines.push(current.trimEnd());
    }
    return lines;
  };
  const text=(value,{size=10.5,color=ink,after=10,leading=size*1.65}={})=>{
    for(const row of wrap(value,size)){ensure(leading);if(row)draw(page,row,margin,y-size,size,color);y-=leading;}
    y-=after;
  };
  newPage();
  text(document.title,{size:24,color:purple,after:12,leading:33});
  if(document.subtitle)text(document.subtitle,{size:10,color:muted,after:18});
  page.drawLine({start:{x:margin,y},end:{x:width-margin,y},thickness:1,color:line});y-=22;
  for(const block of document.blocks||[]){
    if(block.type==='heading') {
      const size=block.level===2?12:16;
      ensure(wrap(block.text,size).length*size*1.5+45); y-=8;
      text(block.text,{size,color:purple,after:10,leading:size*1.5});
    } else if(block.type==='image') {
      try {
        const bytes=await (loadImage?loadImage(block.src):fetch(block.src).then(r=>{if(!r.ok)throw Error('image');return r.arrayBuffer();}));
        const data=new Uint8Array(bytes);const img=data[0]===0x89?await pdf.embedPng(data):await pdf.embedJpg(data);
        const scale=Math.min(bodyWidth/img.width,390/img.height,1);const w=img.width*scale,h=img.height*scale;
        ensure(h+30);page.drawImage(img,{x:margin+(bodyWidth-w)/2,y:y-h,width:w,height:h});y-=h+12;
        if(block.caption)text(block.caption,{size:9,color:muted,after:12});
      }catch{throw new Error(`题目图片无法导出：${block.caption||'原题图表'}。请确认本地资料可读后重试。`);}
    } else if(block.type==='rule'){
      ensure(22);page.drawLine({start:{x:margin,y},end:{x:width-margin,y},thickness:.6,color:line});y-=18;
    } else text(block.text,{size:block.type==='meta'?9.5:10.5,color:block.type==='meta'?muted:ink});
  }
  const pages=pdf.getPages();
  pages.forEach((p,i)=>{
    p.drawLine({start:{x:margin,y:43},end:{x:width-margin,y:43},thickness:.5,color:line});
    draw(p,'IELTSyn · 本机学习资料',margin,28,8,muted);
    const label=`${i+1} / ${pages.length}`;draw(p,label,width-margin-measure(label,8),28,8,muted);
  });
  if(document.restore)await pdf.attach(new TextEncoder().encode(JSON.stringify(document.restore)),RESTORE_NAME,{mimeType:'application/octet-stream',description:'IELTSyn 本机学习恢复数据'});
  return pdf.save();
}

/** Only our named attachment is read; existing JSON backups remain importable. */
export async function readRestoreFile(file) {
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')return JSON.parse(new TextDecoder().decode(bytes));
  const pdf=await PDFDocument.load(bytes);
  const names=pdf.catalog.lookupMaybe(PDFName.of('Names'),PDFDict);
  const embedded=names?.lookupMaybe(PDFName.of('EmbeddedFiles'),PDFDict);
  const find=tree=>{
    const entries=tree?.lookupMaybe(PDFName.of('Names'),PDFArray);
    for(let i=0;entries&&i<entries.size();i+=2){
      if(entries.lookup(i)?.decodeText?.()!==RESTORE_NAME)continue;
      const spec=entries.lookup(i+1,PDFDict),ef=spec.lookup(PDFName.of('EF'),PDFDict);
      const stream=ef.lookup(PDFName.of('F'),PDFRawStream);
      return JSON.parse(new TextDecoder().decode(decodePDFRawStream(stream).decode()));
    }
    const kids=tree?.lookupMaybe(PDFName.of('Kids'),PDFArray);
    for(let i=0;kids&&i<kids.size();i++){const result=find(kids.lookup(i,PDFDict));if(result)return result;}
    return null;
  };
  const data=find(embedded);
  if(!data)throw new Error('这份 PDF 不含本应用的恢复数据，请选择由“导出 PDF”生成的原文件。');
  return data;
}

let exporting=false;
export async function downloadReport(document, filename) {
  if(exporting)return;
  exporting=true;
  const message=window.document.createElement('div'); message.setAttribute('role','status');
  Object.assign(message.style,{position:'fixed',bottom:'24px',right:'24px',zIndex:9999,maxWidth:'min(400px,calc(100vw - 48px))',padding:'16px 20px',border:'1px solid #d1cbe4',borderRadius:'12px',background:'#f0edfa',color:'#30284d',font:'14px/1.6 sans-serif',boxShadow:'0 6px 24px #0002'});
  message.textContent='正在排版并生成 PDF，请稍候……';window.document.body.append(message);
  try {
    const data=await createReportPdf(typeof document==='function'?await document():await document);
    const url=URL.createObjectURL(new Blob([data],{type:'application/pdf'}));
    const a=window.document.createElement('a');a.href=url;a.download=filename.replace(/\.[^.]+$/,'')+'.pdf';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);message.textContent='PDF 已生成，请在下载列表中打开。';setTimeout(()=>message.remove(),5000);
    return true;
  }catch(error){message.setAttribute('role','alert');message.textContent=`PDF 导出失败：${error.message}`;const close=window.document.createElement('button');close.textContent='关闭';close.onclick=()=>message.remove();message.append(close);return false;}
  finally{exporting=false;}
}
