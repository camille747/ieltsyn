import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadReadingBank} from './reading-bank-loader.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const file=relative=>assert.ok(fs.statSync(path.join(root,relative)).size>0,relative);
const listening=read('src/data/listening-232-index.json');
assert.equal(listening.length,4);
for(const item of listening){file(`public/data/listening-232/${item.id}.json`);file(`public/media/listening-232/${item.id}.mp3`);const q=read(`public/data/listening-232/${item.id}.json`);assert.ok(q.questionIds.length);assert.ok(q.transcriptLines.length);}
for(const part of ['P1','P2','P3','P4'])assert.ok(listening.some(item=>item.part===part),part);
const reading=await loadReadingBank();
for(const part of ['P1','P2','P3'])assert.ok(reading.some(item=>item.part===part),part);
for(const article of reading){file(`public${article.pdfUrl}`);file(`public${article.textUrl}`);assert.ok(article.questionGroups.length);}
for(const topic of read('src/data/writing-task1.json'))file(`public${topic.image}`);
assert.ok(read('src/data/writing-topics.json').topics.length);
const speaking=read('speaking-app/src/speaking/eic-bank.json');assert.ok(speaking.part1.length&&speaking.pairs.length);
assert.deepEqual(read('speaking-app/public/shadowing/library.json').items,[]);
file('src/assets/pdf/OFL.txt');file('LICENSE');
console.log('Original demo assets and first-use catalogs OK. No third-party study corpus is bundled.');
