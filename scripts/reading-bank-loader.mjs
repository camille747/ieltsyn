import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Node 24 requires JSON import attributes; the browser/Vite source intentionally does not.
export async function loadReadingBank(){const code=fs.readFileSync(path.join(root,'src/data/reading-question-bank.js'),'utf8').replace(/from "(\.\/.+?\.json)";/g,(_,name)=>`from ${JSON.stringify(pathToFileURL(path.resolve(root,'src/data',name)).href)} with {type:'json'};`);return (await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;}
