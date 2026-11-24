import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PDFDocument,StandardFonts} from 'pdf-lib';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const articles=JSON.parse(fs.readFileSync(path.join(root,'src/data/reading-question-bank.generated.json'),'utf8'));
for(const article of articles){
 const doc=await PDFDocument.create();doc.setTitle(article.title);doc.setAuthor('IELTSyn contributors');
 const page=doc.addPage([595.28,841.89]),regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 let y=780;
 const paragraph=(text,{font=regular,size=12}={})=>{let line='';for(const word of text.split(/\s+/)){if(font.widthOfTextAtSize(line+' '+word,size)>470){page.drawText(line,{x:60,y,font,size});y-=20;line=word;}else line+=(line?' ':'')+word;}if(line){page.drawText(line,{x:60,y,font,size});y-=28;}};
 paragraph(article.title,{font:bold,size:18});paragraph('Original demonstration - not an official IELTS question.',{size:10});
 for(const p of article.paragraphs)paragraph(p.id+'. '+p.text);
 for(const g of article.questionGroups){paragraph(g.instruction,{font:bold,size:11});for(const q of g.questions)paragraph(q.id+'. '+q.text);}
 y-=20;paragraph('Answer key for this original sample: '+article.questionGroups[0].questions[0].answer,{size:10});
 const file=path.join(root,'public',article.pdfUrl);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,await doc.save());
}
console.log('Generated original demonstration PDFs.');
