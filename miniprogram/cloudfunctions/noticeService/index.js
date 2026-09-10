'use strict';
const cloud=require('wx-server-sdk');
const {createService}=require('./service');
const {analyze}=require('./ai');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV,timeout:20000});
const db=cloud.database(),_=db.command;
// Transactions support doc() only. Never turn permission/network errors into an absent row.
const read=async (client,col,id)=>{
 try {
  const result=await client.collection(col).doc(id).get();
  return Array.isArray(result.data)?result.data[0]||null:result.data||null;
 } catch(error) {
  // wx-server-sdk may reject a missing single document. Do not swallow collection/permission errors.
  if (/document with _id .+ does not exist/i.test(String(error.errMsg||error.message||''))) return null;
  throw error;
 }
};
const dataOf=row=>{const {_id,...data}=row;return data;};
const store={
 get:(col,id)=>read(db,col,id),
 async query(col,where,opt={}){
  let conditions={...where};if(where.child_ids)conditions.child_ids=_.in([where.child_ids]);
  if(opt.from||opt.to){const cs=[];if(opt.from)cs.push(_.gte(new Date(opt.from+'T00:00:00+08:00').toISOString()));if(opt.to)cs.push(_.lte(new Date(opt.to+'T23:59:59+08:00').toISOString()));conditions.observed_at=cs.length===1?cs[0]:_.and(cs);}
  let q=db.collection(col).where(conditions);if(col==='banli_observations')q=q.orderBy('observed_at','desc').orderBy('_id','desc');
  const result=await q.skip(opt.offset||0).limit(opt.limit||100).get();return result.data||[];
 },
 createOnce:(col,id,row)=>db.runTransaction(async tx=>{if(!await read(tx,col,id))await tx.collection(col).doc(id).set({data:dataOf(row)});}),
 replaceVersion:(col,id,version,row)=>db.runTransaction(async tx=>{const old=await read(tx,col,id);if(!old||old.revision!==version){const err=new Error('记录已有新版本，请重新打开后再修改');err.code='CONFLICT';throw err;}await tx.collection(col).doc(id).set({data:dataOf(row)});}),
 remove:(col,id)=>db.collection(col).doc(id).remove(),
 budget:(id,max)=>db.runTransaction(async tx=>{const key=require('./service').hash(id);const old=await read(tx,'banli_budgets',key);const count=(old&&old.count)||0;if(count>=max){const err=new Error('今天的AI试用次数已用完，仍可继续记录与导出');err.code='RATE_LIMIT';throw err;}await tx.collection('banli_budgets').doc(key).set({data:{count:count+1,day:id.slice(-10)}});})
};
const service=createService({store,analyze,getFileUrls:async list=>{if(!list.length)return [];const result=await cloud.getTempFileURL({fileList:list});return result.fileList.filter(f=>f.status===0).map(f=>({fileID:f.fileID,url:f.tempFileURL}));},deleteFiles:async list=>{if(!list.length)return;const result=await cloud.deleteFile({fileList:list});if((result.fileList||[]).some(f=>f.status!==0))throw new Error('记录已隐藏，部分附件尚未清除，请联系负责人完成清理');},
 config:{formalEnabled:process.env.BANLI_FORMAL_ENABLED==='true',operator:process.env.BANLI_OPERATOR_NAME,contact:process.env.BANLI_PRIVACY_CONTACT}});
exports.main=async event=>{try{return await service.handle(event,cloud.getWXContext().OPENID);}catch(err){return {error:err.code?err.message:'服务暂未完成，请保留草稿后重试',code:err.code||'SERVICE_ERROR'};}};
