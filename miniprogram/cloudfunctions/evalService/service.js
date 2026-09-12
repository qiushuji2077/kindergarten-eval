'use strict';
const crypto=require('crypto');
const D=require('./domain');
const hash=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
const cleanDoc=doc=>{if(!doc)return null;const {_openid,...rest}=doc;return {...rest,id:doc._id||doc.id};};
function createService({store,analyze,deleteFiles,getFileUrls=async()=>[],config={},now=()=>new Date()}){
  const clock=()=>now().toISOString();
  const validConsent=c=>!!(c&&c.status==='active'&&c.observe===true&&c.reference&&c.displayName&&(!c.expiresAt||(Number.isFinite(Date.parse(c.expiresAt))&&Date.parse(c.expiresAt)>now().getTime())));
  async function context(openid){
    D.check(openid,'请通过微信小程序进入','UNAUTHENTICATED');
    D.check(config.formalEnabled&&config.operator&&config.contact,'真实班级尚未开放；请先使用示例体验。','FORMAL_DISABLED');
    const actorKey=hash(openid),m=await store.get('banli_memberships',actorKey);
    D.check(m&&m.status==='active'&&m.privacyReady===true,'尚未获得园所授权，请联系项目负责人。','FORBIDDEN');
    const cls=await store.get('banli_classes',m.classId),teacher=await store.get('banli_teachers',m.teacherId);
    D.check(cls&&teacher&&m.tenantId&&cls.tenant_id===m.tenantId&&teacher.tenant_id===m.tenantId&&teacher.class_id===m.classId,'班级授权信息不完整','FORBIDDEN');
    return {actorKey,tenantId:m.tenantId,classId:m.classId,teacherId:m.teacherId,teacher,cls,canManageChildren:m.canManageChildren===true};
  }
  async function consentFor(ctx,child){
    D.check(child&&child.class_id===ctx.classId&&child.tenant_id===ctx.tenantId,'无权访问该幼儿','FORBIDDEN');
    const c=child.consent_id&&await store.get('banli_consents',child.consent_id);
    D.check(validConsent(c)&&c.class_id===ctx.classId&&c.tenant_id===ctx.tenantId&&c.displayName===child.name,'该幼儿的监护人授权尚未完成或已撤回','CONSENT_REQUIRED');return c;
  }
  async function children(ctx){
    const rows=await store.query('banli_children',{class_id:ctx.classId,tenant_id:ctx.tenantId},{limit:100});
    const allowed=[];
    for(const row of rows){try{const c=await consentFor(ctx,row);allowed.push({...cleanDoc(row),allowAI:c.ai===true,allowMedia:c.media===true});}catch(e){if(e.code!=='CONSENT_REQUIRED')throw e;}}
    return allowed;
  }
  async function rowFor(ctx,id,write=false){
    const row=typeof id==='string'&&id?await store.get('banli_observations',id):null;
    D.check(row&&row.class_id===ctx.classId&&row.tenant_id===ctx.tenantId,'记录不存在或无访问权限','FORBIDDEN');
    if(write)D.check(row.teacher_id===ctx.teacherId,'仅记录教师可以修改或删除','FORBIDDEN');return row;
  }
  async function selected(ctx,ids){
    D.check(Array.isArray(ids)&&ids.length>0&&ids.length<=10&&ids.every(x=>typeof x==='string'),'请选择1至10名观察对象');
    const out=[];for(const id of [...new Set(ids)]){const child=await store.get('banli_children',id);const consent=await consentFor(ctx,child);out.push({child:cleanDoc(child),consent});}return out;
  }
  async function observationAccess(ctx,row){for(const id of row.child_ids||[])await consentFor(ctx,await store.get('banli_children',id));return row;}
  function mediaAllowed(fileID,ctx,id){
    return typeof fileID==='string'&&fileID.startsWith('cloud://')&&!fileID.includes('..')&&fileID.split('/').slice(3).join('/').startsWith(`banli-v12/${ctx.actorKey}/${id}/`)&&/\.(jpg|jpeg|png|webp|mp4|mov|m4a|mp3|aac|wav)$/i.test(fileID);
  }
  async function handle(event,openid){
    const e=event||{};D.check(openid,'请通过微信小程序进入','UNAUTHENTICATED');const actorKey=hash(openid);
    if(e.action==='accessInfo')return {actorKey,operator:config.operator||'',contact:config.contact||'',formalEnabled:!!config.formalEnabled,version:'1.2.0-review'};
    if(e.action==='demoAnalyze'){
      const scene=D.SCENARIOS.find(s=>s.id===e.scenarioId);D.check(scene,'请选择内置示例');
      await store.budget(`${actorKey}:${clock().slice(0,10)}`,12);return analyze(D.redact(scene.text,['小禾']),'4-5岁');
    }
    const ctx=await context(openid);
    if(e.classId)D.check(e.classId===ctx.classId,'无权访问该班级','FORBIDDEN');
    if(e.teacherId)D.check(e.teacherId===ctx.teacherId,'不能冒用其他教师','FORBIDDEN');
    if(e.action==='session')return {mode:'formal',actorKey,classId:ctx.classId,className:ctx.cls.name,kindergartenName:ctx.cls.kindergartenName||'',teacherId:ctx.teacherId,teacherName:ctx.teacher.name,canManageChildren:ctx.canManageChildren,operator:config.operator,contact:config.contact};
    if(e.action==='children')return children(ctx);
    if(e.action==='createChild'){
      D.check(ctx.canManageChildren,'请由已获授权的班级负责人添加幼儿','FORBIDDEN');
      const consent=await store.get('banli_consents',D.text(e.consentId,100));
      D.check(validConsent(consent)&&consent.class_id===ctx.classId&&consent.tenant_id===ctx.tenantId,'请先登记有效的监护人授权记录','CONSENT_REQUIRED');
      D.check(D.AGE_BANDS.includes(e.ageBand),'请选择年龄段');
      const id='child-'+hash(ctx.classId+e.consentId).slice(0,32);
      const row={_id:id,name:consent.displayName,ageBand:e.ageBand,consent_id:e.consentId,class_id:ctx.classId,tenant_id:ctx.tenantId,created_at:clock()};
      await store.createOnce('banli_children',id,row);return cleanDoc(await store.get('banli_children',id));
    }
    if(e.action==='observations'){
      const range=D.dateRange(e.from,e.to);const offset=Math.max(0,Math.floor(Number(e.offset)||0));D.check(offset<=5000,'记录较多，请缩小日期范围。');
      const where={class_id:ctx.classId,tenant_id:ctx.tenantId,deleted:false};
      if(e.childId){await consentFor(ctx,await store.get('banli_children',e.childId));where.child_ids=e.childId;}
      const raw=await store.query('banli_observations',where,{offset,limit:51,from:range.from,to:range.to});
      const items=[];let withheld=0;
      for(const row of raw.slice(0,50)){try{await observationAccess(ctx,row);items.push(cleanDoc(row));}catch(err){if(err.code!=='CONSENT_REQUIRED')throw err;withheld++;}}
      return {items,hasMore:raw.length>50,nextOffset:offset+50,withheld};
    }
    if(e.action==='observation'){const row=await rowFor(ctx,e.id);D.check(!row.deleted,'记录已删除');return cleanDoc(await observationAccess(ctx,row));}
    if(e.action==='prepareGuide'||e.action==='analyze'){
      const targets=await selected(ctx,e.childIds);
      D.check(targets.every(x=>x.consent.ai===true),'监护人授权范围暂未包含AI辅助处理；仍可保存观察。','AI_NOT_CONSENTED');
      const roster=await store.query('banli_children',{class_id:ctx.classId,tenant_id:ctx.tenantId},{limit:100});
      const names=roster.map(c=>c.name).concat([ctx.cls.name,ctx.cls.kindergartenName,ctx.teacher.name]);
      const safe=D.redact(e.text,names);D.check(safe.length>=6,'请先补充一段具体实录');
      const bands=[...new Set(targets.map(x=>x.child.ageBand))];const ageBand=bands.length===1?bands[0]:'混龄或待核对';
      if(e.action==='prepareGuide'){
        const prepareId='prep-'+crypto.randomBytes(16).toString('hex');
        await store.createOnce('banli_preparations',prepareId,{_id:prepareId,actorKey,classId:ctx.classId,originalHash:hash(D.text(e.text)),childIds:targets.map(x=>x.child.id).sort(),ageBand,expiresAt:new Date(now().getTime()+86400000).toISOString()});
        return {text:safe,ageBand,prepareId};
      }
      D.check(e.aiConfirmed===true,'请先检查并确认发送给AI的文字','CONFIRM_REQUIRED');
      const prepared=await store.get('banli_preparations',D.text(e.prepareId,80));
      D.check(prepared&&prepared.actorKey===actorKey&&prepared.classId===ctx.classId&&prepared.expiresAt>clock()&&JSON.stringify(prepared.childIds)===JSON.stringify(targets.map(x=>x.child.id).sort()),'请重新预览要发送的文字','STALE_ANALYSIS');
      await store.budget(`${actorKey}:${clock().slice(0,10)}`,60);
      const result=await analyze(safe,ageBand);const analysisId='analysis-'+crypto.randomBytes(16).toString('hex');
      await store.createOnce('banli_analyses',analysisId,{_id:analysisId,...result,actorKey,classId:ctx.classId,originalHash:prepared.originalHash,childIds:prepared.childIds,expiresAt:prepared.expiresAt});
      return {...result,analysisId};
    }
    if(e.action==='saveObservation'){
      const targets=await selected(ctx,e.childIds);
      if(e.hasMedia)D.check(targets.every(x=>x.consent.media===true),'请先取得附件记录授权，再保存照片或音视频','CONSENT_REQUIRED');
      const narrative=D.text(e.narrative,2000);D.check(narrative||e.hasMedia,'请留下文字、照片或录音');
      const old=e.id?await rowFor(ctx,e.id,true):null;D.check(!old||!old.deleted,'记录已删除');
      const requestId=D.text(e.requestId,80);D.check(old||/^[a-zA-Z0-9-]{12,80}$/.test(requestId),'缺少有效的保存编号');
      const obsId=old?old._id:'obs-'+hash(actorKey+':'+requestId).slice(0,32);
      const review=D.reviewed(e.review);D.check(review.decision!=='adjusted'||review.note,'调整后请写下教师的判断');
      let source='rule',suggestions=D.rules(narrative);
      if(old&&e.preserveAnalysis===true&&old.narrative!==narrative)D.check(false,'实录已变化，请重新核对观察线索','STALE_ANALYSIS');
      if(old&&e.preserveAnalysis===true&&old.narrative===narrative){source=old.source||'rule';suggestions=old.suggestions||[];}
      else if(e.analysisId){
        const receipt=await store.get('banli_analyses',D.text(e.analysisId,80));
        D.check(receipt&&receipt.actorKey===actorKey&&receipt.classId===ctx.classId&&receipt.expiresAt>clock()&&receipt.originalHash===hash(narrative)&&JSON.stringify(receipt.childIds)===JSON.stringify(targets.map(x=>x.child.id).sort()),'实录或对象已变化，请重新查看辅助线索','STALE_ANALYSIS');
        source=receipt.source;suggestions=receipt.suggestions;
      }
      review.ids=review.ids.filter(id=>suggestions.some(x=>x.id===id));
      const inputTime=old?old.observed_at:String(e.observedAt||'');D.check(!Number.isNaN(Date.parse(inputTime)),'观察时间无效');
      const obsTime=new Date(inputTime).toISOString();D.check(Date.parse(obsTime)<=now().getTime()+300000,'观察时间不能在未来');
      if(old)D.check(JSON.stringify([...old.child_ids].sort())===JSON.stringify(targets.map(x=>x.child.id).sort()),'已保存记录的观察对象保持不变');
      const row={_id:obsId,tenant_id:ctx.tenantId,class_id:ctx.classId,class_name:ctx.cls.name,teacher_id:ctx.teacherId,teacher_name:ctx.teacher.name,
        child_ids:targets.map(x=>x.child.id),children:targets.map(x=>({id:x.child.id,name:x.child.name})),narrative,original_narrative:old?(old.original_narrative||old.narrative):narrative,
        observed_at:obsTime,created_at:old?old.created_at:clock(),updated_at:clock(),revision:old?old.revision+1:1,media:old?old.media||[]:[],suggestions,source,
        review:{...review,reviewedAt:review.decision==='pending'?'':clock(),reviewedBy:ctx.teacherId},scene:D.text(e.scene,30),referenceVersion:D.REFERENCE_VERSION,deleted:false,requestId:old?old.requestId:requestId};
      if(old)await store.replaceVersion('banli_observations',obsId,Number(e.revision),row);
      else await store.createOnce('banli_observations',obsId,row);
      const saved=await store.get('banli_observations',obsId);
      D.check(saved.narrative===narrative&&JSON.stringify([...saved.child_ids].sort())===JSON.stringify(targets.map(x=>x.child.id).sort()),'该保存编号已有记录，请先回看后再修改','IDEMPOTENCY_CONFLICT');return cleanDoc(saved);
    }
    if(e.action==='mediaAccess'){
      const row=await rowFor(ctx,e.id);D.check(!row.deleted,'记录已删除');const targets=await selected(ctx,row.child_ids);
      D.check(targets.every(x=>x.consent.media===true),'附件授权尚未完成或已撤回','CONSENT_REQUIRED');return getFileUrls((row.media||[]).map(m=>m.fileID));
    }
    if(e.action==='addMedia'){
      const row=await rowFor(ctx,e.id,true);D.check(!row.deleted,'记录已删除');const targets=await selected(ctx,row.child_ids);
      D.check(targets.every(x=>x.consent.media===true),'该观察对象尚未授权图片或音视频记录','CONSENT_REQUIRED');
      D.check(mediaAllowed(e.fileID,ctx,row._id),'附件路径不属于当前记录','FORBIDDEN');D.check(['photo','audio','video'].includes(e.kind),'附件类型无效');
      const media=(row.media||[]).slice();if(media.some(m=>m.fileID===e.fileID))return cleanDoc(row);D.check(media.length<9,'每条最多9个附件');
      media.push({id:hash(e.fileID).slice(0,24),fileID:e.fileID,kind:e.kind});
      await store.replaceVersion('banli_observations',row._id,row.revision,{...row,media,revision:row.revision+1,updated_at:clock()});return cleanDoc(await store.get('banli_observations',row._id));
    }
    if(e.action==='deleteObservation'){
      const row=await rowFor(ctx,e.id,true);
      if(!row.deleted)await store.replaceVersion('banli_observations',row._id,row.revision,{...row,deleted:true,revision:row.revision+1});
      await deleteFiles((row.media||[]).map(m=>m.fileID));await store.remove('banli_observations',row._id);return {deleted:true};
    }
    D.check(false,'当前版本不支持此操作','UNSUPPORTED');
  }
  return {handle,context};
}
module.exports={createService,hash};
