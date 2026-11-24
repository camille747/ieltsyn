import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const problems=[];let count=0;
const excluded=new Set(['.git','node_modules','dist','release','work','.tools','.impeccable']);
function scan(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
 if(excluded.has(entry.name)||entry.name==='.DS_Store')continue;
 const file=path.join(directory,entry.name),rel=path.relative(root,file);
 if(entry.isSymbolicLink()){problems.push(`${rel}: symlinks are not public release files`);continue;}
 if(entry.isDirectory()){scan(file);continue;}
 count++;
 if((entry.name.startsWith('.env')&&entry.name!=='.env.example')||/\.(pem|key)$/i.test(entry.name)||entry.name==='ai.json'||/study-data|backup\.json|engine\.js/.test(entry.name))problems.push(`${rel}: private configuration or user data`);
 if(fs.statSync(file).size>45*1024*1024)problems.push(`${rel}: unexpectedly large file`);
 if(!/\.(?:js|jsx|mjs|cjs|json|css|md|txt|yml|yaml|html|command|example)$/.test(entry.name)&&!['LICENSE','.gitignore','.nvmrc'].includes(entry.name))continue;
 const text=fs.readFileSync(file,'utf8');
 const privateSource = new RegExp('(?:/Users/[A-Za-z0-9_-]+|WeChat'+'Bridge|bcnrww'+'x6shx4\\.feishu\\.cn)');
 if(privateSource.test(text))problems.push(`${rel}: private machine path or customer source link`);
 const keys=text.match(/sk-[A-Za-z0-9._-]{16,}/g)||[];
 if(keys.some(key=>!/(fixture|not-real|not-a-real|environment-fixture)/.test(key)))problems.push(`${rel}: possible API credential`);
 if(/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(text))problems.push(`${rel}: private key`);
}}
scan(root);
if(problems.length){console.error(problems.join('\n'));process.exitCode=1;}else console.log(`Release source check passed (${count} files): no credentials, private paths, customer links, profiles or large content bundles.`);
