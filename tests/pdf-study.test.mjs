import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PDFDocument,degrees} from 'pdf-lib';
import {validPdfInk,pdfInkSegments,exportAnnotatedPdf} from '../src/lib/pdfInk.js';
import {validateBackup} from '../src/lib/backup.js';
const stroke={color:'#a43f3f',width:.002,points:[[.1,.2],[.5,.8]]};
test('PDF marks stay bounded, back up safely and export onto original rotated and cropped pages',async()=>{
 assert.equal(validPdfInk({'1':[stroke]}),true);assert.equal(validPdfInk({'0':[stroke]}),false);assert.equal(validPdfInk({'1':[{...stroke,points:[[2,0]]}]}),false);
 assert.deepEqual(pdfInkSegments(stroke,200,100),[{start:{x:20,y:80},end:{x:100,y:19.999999999999996}}]);
 const doc=await PDFDocument.create();for(const rotation of [0,90,180,270]){const p=doc.addPage([300,500]);p.setCropBox(10,20,200,400);p.setRotation(degrees(rotation));}
 const original=await doc.save(),output=await exportAnnotatedPdf(original,Object.fromEntries([1,2,3,4].map(n=>[n,[stroke]])));
 const result=await PDFDocument.load(output);assert.equal(result.getPageCount(),4);assert.equal(result.getPage(1).getRotation().angle,90);assert.deepEqual(result.getPage(0).getCropBox(),{x:10,y:20,width:200,height:400});assert.ok(output.length>original.length);
 for(const page of result.getPages())assert.ok(page.node.Contents());
 const backup=value=>({format:'ielts-study-backup',version:1,values:value});
 assert.doesNotThrow(()=>validateBackup(backup({'ielts-pdf-ink-v1:doc':{'1':[stroke]},'ielts-pdf-ocr-v1:doc:1':{text:'Words',uncertain:false}})));
 assert.throws(()=>validateBackup(backup({'ielts-pdf-ink-v1:doc':{'1':[{...stroke,color:'bad'}]}})),/手写/);
 assert.throws(()=>validateBackup(backup({'ielts-pdf-ocr-v1:doc:1':{text:'Words'}})),/识别/);
});
