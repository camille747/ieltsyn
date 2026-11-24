// Highlight only text literally present in the passage; never invent a location.
export function readingEvidence(article,results,notes={}){
 const evidence=[];
 for(const q of results){
  const paragraph=notes[q.id]?.paragraph||q.explanation?.match(/([A-Z])\s*段/)?.[1];
  const quotes=[...(q.explanation||"").matchAll(/[“"‘]([^”"’\n]{16,})[”"’]/g)].map(m=>m[1]).filter(s=>/[a-z]{3}/i.test(s));
  if(!/^[A-Z]$|^(TRUE|FALSE|YES|NO|NOT GIVEN)$/i.test(q.expected||"")&&String(q.expected).length>=3)quotes.push(String(q.expected).split("/")[0].trim());
  let match;
  for(const p of article.paragraphs.filter(p=>!paragraph||p.id===paragraph)){
   for(const quote of quotes){const start=p.text.toLowerCase().indexOf(quote.toLowerCase());if(start>=0){match={id:`evidence:${q.id}`,paragraphId:`passage:${p.id}`,start,end:start+quote.length,color:"brown",note:`题 ${q.id} · 原文中与答案或解析相同的文字`};break;}}
   if(match)break;
  }
  if(match)evidence.push(match);
 }
 return evidence;
}
export function recallSentence(text){const sentence=text.split(/(?<=[.!?])\s+/)[0];const keyword=sentence.match(/\b[A-Za-z]{8,}\b/)?.[0];return {sentence,masked:keyword?sentence.replace(keyword,"________"):sentence};}
