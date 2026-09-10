'use strict';
const D=require('./banli-domain');
const PREFIX='banli-v12:';
const SESSION=PREFIX+'session';
function getSession(){return wx.getStorageSync(SESSION)||null;}
function requireSession(){const s=getSession();if(!s){wx.reLaunch({url:'/pages/login/login'});return null;}return s;}
function rpc(action,payload={}){
 return new Promise((resolve,reject)=>{
  if(!wx.cloud)return reject(new Error('当前微信环境不支持云开发'));
  wx.cloud.callFunction({name:'noticeService',data:{...payload,action},config:{timeout:25000},success:r=>{
   const v=r.result;if(v&&v.error){const e=new Error(v.error);e.code=v.code;reject(e);}else resolve(v);
  },fail:()=>reject(new Error('云端未确认完成。请保留草稿，联网后重试。'))});
 });
}
function uid(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12)+'-'+Math.random().toString(36).slice(2,8);}
function put(key,value){try{wx.setStorageSync(key,value);}catch(_){throw new Error('本机存储空间不足，草稿尚未保存。请不要关闭当前页面。');}}
function demo(){
 const key=PREFIX+'demo';let data=wx.getStorageSync(key);
 if(!data||Date.now()-data.createdAt>7*86400000){
  const yesterday=new Date(Date.now()-86400000).toISOString();
  data={createdAt:Date.now(),children:[{id:'demo-a',name:'小禾（示例）',ageBand:'4-5岁'},{id:'demo-b',name:'小雨（示例）',ageBand:'4-5岁'},{id:'demo-c',name:'小满（示例）',ageBand:'5-6岁'}],observations:[
   {id:'demo-first',narrative:D.SCENARIOS[0].text,original_narrative:D.SCENARIOS[0].text,children:[{id:'demo-a',name:'小禾（示例）'}],child_ids:['demo-a'],observed_at:yesterday,teacher_name:'示例教师',class_name:'示例班',scene:'自主游戏',revision:1,media:[],source:'rule',suggestions:D.rules(D.SCENARIOS[0].text),review:D.reviewed({})}
  ]};put(key,data);
 }return data;
}
function saveDemo(data){put(PREFIX+'demo',data);}
async function enter(mode){
 const s=mode==='demo'?{mode:'demo',actorKey:'local-demo',classId:'demo',className:'示例班',kindergartenName:'演示园所',teacherId:'demo-teacher',teacherName:'示例教师',canManageChildren:true}:await rpc('session');
 put(SESSION,s);if(mode==='demo')demo();return s;
}
function scope(){const s=getSession();D.check(s,'请先进入班级');return s.actorKey+':'+s.classId;}
function draftKey(){return PREFIX+'draft:'+scope();}
function readDraft(){const v=wx.getStorageSync(draftKey());if(v&&Date.now()-v.savedAt<86400000)return v;if(v)wx.removeStorageSync(draftKey());return null;}
function saveDraft(value){put(draftKey(),{...value,savedAt:Date.now()});}
function clearDraft(){wx.removeStorageSync(draftKey());}
function cleanupLocalFiles(){
 try{const fs=wx.getFileSystemManager();const files=fs.readdirSync(wx.env.USER_DATA_PATH);files.filter(f=>f.startsWith('banli-v12-')).forEach(f=>{try{fs.unlinkSync(wx.env.USER_DATA_PATH+'/'+f);}catch(_){}});}catch(_){}
}
function logout(){const info=wx.getStorageInfoSync();(info.keys||[]).filter(k=>k.startsWith(PREFIX)).forEach(k=>wx.removeStorageSync(k));cleanupLocalFiles();wx.reLaunch({url:'/pages/login/login'});}
async function children(){return getSession().mode==='demo'?demo().children:rpc('children');}
async function addChild(name,ageBand,consentId){
 if(getSession().mode!=='demo')return rpc('createChild',{ageBand,consentId});
 const data=demo();D.check(data.children.length<30,'示例名单最多30名');const child={id:uid(),name:D.text(name,20)||'示例幼儿',ageBand};data.children.push(child);saveDemo(data);return child;
}
async function observations(options={}){
 D.dateRange(options.from,options.to);
 if(getSession().mode!=='demo')return rpc('observations',options);
 let rows=demo().observations.filter(r=>(!options.childId||r.child_ids.includes(options.childId))&&(!options.from||new Date(r.observed_at)>=new Date(options.from+'T00:00:00+08:00'))&&(!options.to||new Date(r.observed_at)<=new Date(options.to+'T23:59:59+08:00'))).sort((a,b)=>b.observed_at.localeCompare(a.observed_at));
 const offset=options.offset||0;return {items:rows.slice(offset,offset+50),hasMore:rows.length>offset+50,nextOffset:offset+50};
}
async function allObservations(options={}){let items=[],offset=0;for(let page=0;page<20;page++){const result=await observations({...options,offset});items=items.concat(result.items);if(!result.hasMore)return items;offset=result.nextOffset;}throw new Error('本次汇总超过1000条，请缩小日期范围后导出。');}
async function observation(id){if(getSession().mode!=='demo')return rpc('observation',{id});const row=demo().observations.find(x=>x.id===id);D.check(row,'记录未找到');return row;}
async function saveObservation(value){
 if(getSession().mode!=='demo')return rpc('saveObservation',value);
 const data=demo(),s=getSession();const index=data.observations.findIndex(x=>x.id===value.id);const old=index>=0?data.observations[index]:null;
 const repeated=!old&&data.observations.find(x=>x.requestId===value.requestId);if(repeated)return repeated;
 if(old)D.check(old.revision===value.revision,'记录已有更新，请重新打开');
 const chosen=data.children.filter(x=>value.childIds.includes(x.id));D.check(chosen.length,'请选择观察对象');
 const row={...old,id:old?old.id:'demo-'+uid(),requestId:value.requestId,narrative:D.text(value.narrative),original_narrative:old?old.original_narrative:D.text(value.narrative),children:chosen.map(({id,name})=>({id,name})),child_ids:chosen.map(x=>x.id),observed_at:old?old.observed_at:value.observedAt,teacher_id:s.teacherId,teacher_name:s.teacherName,class_name:s.className,revision:old?old.revision+1:1,media:old?old.media:[],suggestions:value.suggestions||[],source:value.source||'rule',scene:value.scene||'',review:{...D.reviewed(value.review),reviewedAt:value.review&&value.review.decision!=='pending'?new Date().toISOString():''}};
 if(old)data.observations[index]=row;else data.observations.unshift(row);saveDemo(data);return row;
}
async function mediaAccess(id){return getSession().mode==='demo'?[]:rpc('mediaAccess',{id});}
async function removeObservation(id){if(getSession().mode!=='demo')return rpc('deleteObservation',{id});const data=demo();data.observations=data.observations.filter(x=>x.id!==id);saveDemo(data);return {deleted:true};}
async function prepare(value){
 if(getSession().mode!=='demo')return rpc('prepareGuide',value);
 const scene=D.SCENARIOS.find(x=>x.text===value.text);return {text:D.redact(value.text,['小禾','小雨','小满']),ageBand:'4-5岁',scenarioId:scene?scene.id:'',prepareId:''};
}
async function analyze(value){
 if(getSession().mode!=='demo')return rpc('analyze',value);
 const scene=D.SCENARIOS.find(x=>x.id===value.scenarioId);
 if(scene&&value.text===D.redact(scene.text,['小禾','小雨','小满'])){
  try{return await rpc('demoAnalyze',{scenarioId:scene.id});}catch(_){return {suggestions:D.rules(value.text),source:'rule',message:'示例AI暂不可用，当前展示规则线索。'};}
 }
 return {suggestions:D.rules(value.text),source:'rule',message:'自由输入仅在本机做规则体验。内置示例可演示真实AI调用。'};
}
function persistFile(file){
 if(file.existing||file.path.includes('/banli-v12-'))return Promise.resolve(file);
 D.check(!file.size||file.size<=20*1024*1024,'单个附件请控制在20MB以内');
 const ext=file.kind==='audio'?'.mp3':file.kind==='video'?'.mp4':'.jpg';const path=wx.env.USER_DATA_PATH+'/banli-v12-'+uid()+ext;
 return new Promise((resolve,reject)=>wx.getFileSystemManager().saveFile({tempFilePath:file.path,filePath:path,success:r=>resolve({...file,path:r.savedFilePath||path}),fail:()=>reject(new Error('附件未能保存到本机，请保留页面并重试。'))}));
}
async function attach(row,file){
 const s=getSession();if(s.mode==='demo'){const data=demo(),r=data.observations.find(x=>x.id===row.id);if(!r.media.some(m=>m.path===file.path))r.media.push({id:file.id,path:file.path,fileID:file.path,kind:file.kind});r.revision++;saveDemo(data);return r;}
 const ext=file.kind==='audio'?'.mp3':file.kind==='video'?'.mp4':'.jpg';
 // Deterministic object path makes upload retries replace the same attachment.
 const cloudPath=`banli-v12/${s.actorKey}/${row.id}/${file.id.replace(/[^a-zA-Z0-9-]/g,'')}${ext}`;
 const fileID=await new Promise((resolve,reject)=>wx.cloud.uploadFile({cloudPath,filePath:file.path,success:r=>resolve(r.fileID),fail:()=>reject(new Error('文字已保存，附件上传尚未完成。请重试附件上传。'))}));
 return rpc('addMedia',{id:row.id,fileID,kind:file.kind});
}
function localDay(iso){const d=iso?new Date(iso):new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function dateLabel(iso){const d=new Date(iso);return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
module.exports={getSession,requireSession,rpc,enter,logout,uid,readDraft,saveDraft,clearDraft,children,addChild,observations,allObservations,observation,saveObservation,removeObservation,mediaAccess,prepare,analyze,persistFile,attach,localDay,dateLabel};
