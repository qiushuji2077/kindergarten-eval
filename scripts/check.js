'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),mp=path.join(root,'miniprogram');
let count=0;
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(file.endsWith('.js')){cp.execFileSync(process.execPath,['--check',file]);count++;}else if(file.endsWith('.json'))JSON.parse(fs.readFileSync(file,'utf8'));}}
walk(mp);walk(path.join(root,'tests'));const app=JSON.parse(fs.readFileSync(path.join(mp,'app.json')));
for(const route of app.pages){for(const ext of ['js','json','wxml','wxss'])if(!fs.existsSync(path.join(mp,route+'.'+ext)))throw new Error('Missing route file '+route+'.'+ext);}
for(const file of ['ai.js','domain.js','index.js','service.js','config.json']){if(fs.readFileSync(path.join(mp,'cloudfunctions/noticeService',file),'utf8')!==fs.readFileSync(path.join(mp,'cloudfunctions/evalService',file),'utf8'))throw new Error('Cloud alias mismatch '+file);}
console.log(`Syntax/JSON/routes passed; ${count} JavaScript files checked. Native WeChat compilation is a separate release gate.`);
