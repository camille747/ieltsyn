import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('patched packaging matchers retain both product file selections and legacy callable consumers',()=>{
 for(const consumer of ['app-builder-lib','@electron/universal']){
  const local=createRequire(require.resolve(consumer));
  assert.equal(local('minimatch/package.json').version,'11.0.1',consumer);
  const {minimatch}=local('minimatch');
  assert.equal(minimatch('nested/Info.plist','*.plist',{matchBase:true}),true);
  require(consumer);
 }
 // Legacy consumers use the callable v3 API; overriding all minimatch versions breaks them.
 for(const consumer of ['glob','dir-compare']){
  const local=createRequire(require.resolve(consumer));
  assert.equal(typeof local('minimatch'),'function',consumer);
  assert.equal(local('minimatch')('a/b.js','**/*.js'),true);
 }
 const {getMainFileMatchers,getFileMatchers}=require('app-builder-lib/out/fileMatcher.js');
 const configs=[require('../package.json').build,require('../speaking-builder.config.cjs')];
 for(const [i,config] of configs.entries()){
  const output=path.join(root,config.directories.output),destination=path.join(root,'work/virtual-packaging-test');
  const info={projectDir:root,buildResourcesDir:'build',config,isPrepackedAppAsar:false,debugLogger:{isEnabled:false}};
  const main=getMainFileMatchers(root,destination,p=>p,config.mac,{info},output,false).map(m=>m.createFilter());
  const included=p=>main.some(f=>f(path.join(root,p),{isDirectory:()=>false}));
  const prefix=i?'speaking-app/dist':'dist';
  for(const p of [`${prefix}/index.html`,`${prefix}/assets/app.js`,'desktop/preload.cjs','package.json'])assert.equal(included(p),true,p);
  for(const p of ['.env','work/private.json','src/App.jsx','node_modules/secret/index.js',i?'dist/index.html':'speaking-app/dist/index.html'])assert.equal(included(p),false,p);
  const unpack=getFileMatchers(config,'asarUnpack',destination,{macroExpander:p=>p,customBuildOptions:config.mac,globalOutDir:output,defaultSrc:root}).map(m=>m.createFilter());
  const media=i?'speaking-app/dist/shadowing/media/lesson.mp4':'dist/media/listening-232/232-001.mp3';
  assert.equal(unpack.some(f=>f(path.join(root,media),{isDirectory:()=>false})),true,media);
 }
});
