'use strict';
const A=require('./banli-api'),D=require('./banli-domain'),privacy=require('./privacy');
const failure=(page,error)=>page.setData({busy:false,loading:false,error:error.message||'操作未完成，请重试。'});
const reviewLabel=v=>({pending:'待教师回看',accepted:'教师已确认',adjusted:'教师已调整',ignored:'保留实录'})[v||'pending'];
function login(){return {
  data:{accepted:false,busy:false,error:'',actorKey:''},
  onAgreement(e){this.setData({accepted:(e.detail.value||[]).includes('yes')});},
  async enter(e){
    if(this.data.busy)return;
    if(!this.data.accepted)return this.setData({error:'请先阅读并同意使用说明。'});
    this.setData({busy:true,error:''});
    try{await A.enter(e.currentTarget.dataset.mode);wx.switchTab({url:'/pages/feed/feed'});}
    catch(error){failure(this,error);try{const value=await A.rpc('accessInfo');this.setData({actorKey:value.actorKey});}catch(_){}}
    finally{this.setData({busy:false});}
  },
  legal(e){wx.navigateTo({url:'/pages/legal/'+e.currentTarget.dataset.type});}
};}
function feed(){return {
  data:{session:{},groups:[],q:'',filter:'all',loading:true,error:'',hasMore:false,draft:false,withheld:0},
  onShow(){this.session=A.requireSession();if(!this.session)return;this.setData({session:this.session,draft:!!A.readDraft()});this.load();},
  async load(more=false){
    if(more&&this.data.loading)return;this.setData({loading:true,error:''});
    try{const result=await A.observations({offset:more?this.offset||0:0});
      this.rows=more?(this.rows||[]).concat(result.items):result.items;this.offset=result.nextOffset;
      this.setData({hasMore:result.hasMore,withheld:(more?this.data.withheld:0)+(result.withheld||0)});this.render();
    }catch(error){failure(this,error);}
  },
  retry(){this.load();},more(){this.load(true);},onPullDownRefresh(){this.load().finally(()=>wx.stopPullDownRefresh());},
  search(e){this.setData({q:e.detail.value});this.render();},filter(e){this.setData({filter:e.currentTarget.dataset.value});this.render();},
  render(){
    const q=this.data.q.trim(),filter=this.data.filter,groups=[],map={};
    (this.rows||[]).filter(row=>{const status=(row.review||{}).decision||'pending';
      return (!q||(row.narrative+(row.children||[]).map(x=>x.name).join('')).includes(q))&&(filter==='all'||(filter==='pending'?status==='pending':['accepted','adjusted'].includes(status)));
    }).forEach(row=>{const day=A.localDay(row.observed_at);
      if(!map[day]){map[day]={day,items:[]};groups.push(map[day]);}
      map[day].items.push({...row,childNames:(row.children||[]).map(x=>x.name).join('、'),when:A.dateLabel(row.observed_at),
        status:reviewLabel((row.review||{}).decision),pending:!row.review||row.review.decision==='pending',mediaCount:(row.media||[]).length});
    });this.setData({groups,loading:false});
  },
  compose(){wx.navigateTo({url:'/pages/compose/compose'});},
  open(e){wx.navigateTo({url:'/pages/compose/compose?id='+encodeURIComponent(e.currentTarget.dataset.id)});},
  about(){wx.navigateTo({url:'/pages/about/about'});}
};}
function compose(){return {
  data:{session:{},kids:[],narrative:'',files:[],suggestions:[],source:'',review:{decision:'pending',note:'',next:'',ids:[]},reviewLabel:'待教师回看',error:'',busy:false,analyzing:false,previewOpen:false,previewText:'',aiMessage:'',draftStatus:'尚未保存',recording:false,showPrivacy:false,privacyContractName:'《用户隐私保护指引》',clock:'',date:'',time:'',editing:false,canPost:false,original:'',conflictText:'',scene:'自主游戏',scenes:['自主游戏','生活照料','户外活动','其他']},
  async onLoad(options){
    this.session=A.requireSession();if(!this.session)return;this.requestId=A.uid();this.setTime(new Date().toISOString());
    this.setData({session:this.session});privacy.bindPrivacyAuthorization(this);
    try{
      const kids=await A.children();this.setData({kids:kids.map(k=>({...k,on:false}))});
      if(options&&options.id)this.apply(await A.observation(options.id));
      else{
        const draft=A.readDraft();if(draft){
          if(draft.id){const live=await A.observation(draft.id);this.apply(live);if(draft.revision!==undefined&&draft.revision!==live.revision){this.draftConflict=true;this.setData({conflictText:draft.narrative||'',error:'本机草稿与云端版本不同，已保留云端内容。请对照下方草稿后再手动修改。'});this.refresh();return;}}
          this.analysisId=draft.analysisId||'';this.analysisPreserved=!!draft.analysisPreserved;
          this.requestId=draft.requestId||this.requestId;this.setTime(draft.observedAt||this.observedAt);
          this.setData({narrative:draft.narrative||'',files:draft.files||[],scene:draft.scene||'自主游戏',
            kids:this.data.kids.map(k=>({...k,on:(draft.childIds||[]).includes(k.id)})),suggestions:draft.suggestions||[],source:draft.source||'',
            review:D.reviewed(draft.review),reviewLabel:reviewLabel((draft.review||{}).decision),draftStatus:'已恢复本机草稿'});
        }
      }this.refresh();
    }catch(error){failure(this,error);}
  },
  onHide(){this.stopRecording();if(this.audio)this.audio.stop();if(!this.saved)this.keepDraft();},
  onUnload(){this.disposed=true;this.stopRecording();if(this.audio)this.audio.destroy();privacy.unbindPrivacyAuthorization(this);},
  setTime(iso){this.observedAt=iso;const d=new Date(iso);this.setData({clock:A.dateLabel(iso),date:A.localDay(iso),time:String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')});},
  date(e){if(this.data.editing)return;this.setTime(new Date(e.detail.value+'T'+this.data.time+':00+08:00').toISOString());this.keepDraft();},
  time(e){if(this.data.editing)return;this.setTime(new Date(this.data.date+'T'+e.detail.value+':00+08:00').toISOString());this.keepDraft();},
  refresh(){this.setData({canPost:this.data.kids.some(k=>k.on)&&(!!this.data.narrative.trim()||this.data.files.length>0)});},
  apply(row){
    this.row=row;this.requestId=row.requestId||this.requestId;this.setTime(row.observed_at);this.analysisId='';this.analysisPreserved=true;
    this.setData({editing:true,narrative:row.narrative||'',original:row.original_narrative&&row.original_narrative!==row.narrative?row.original_narrative:'',
      scene:row.scene||'其他',kids:this.data.kids.map(k=>({...k,on:row.child_ids.includes(k.id)})),
      files:(row.media||[]).map(m=>({...m,path:m.fileID||m.path,existing:true})),suggestions:row.suggestions||[],source:row.source||'rule',
      review:D.reviewed(row.review),reviewLabel:reviewLabel((row.review||{}).decision),draftStatus:this.session.mode==='demo'?'示例已保存在本机':'已从云端读取'});
    this.refresh();
    if(this.session.mode==='formal'&&row.media&&row.media.length)A.mediaAccess(row.id).then(urls=>{
      const byId=Object.fromEntries(urls.map(x=>[x.fileID,x.url]));this.setData({files:this.data.files.map(f=>({...f,path:byId[f.fileID]||f.path}))});
    }).catch(()=>this.setData({error:'部分附件暂时无法读取，实录仍然保留。'}));
  },
  ids(){return this.data.kids.filter(k=>k.on).map(k=>k.id);},
  invalidate(){this.analysisId='';this.analysisPreserved=false;this.prepareId='';this.previewSnapshot='';
    this.setData({suggestions:[],source:'',previewOpen:false,review:D.reviewed({}),reviewLabel:'待教师回看',aiMessage:''});},
  text(e){this.draftConflict=false;this.setData({narrative:e.detail.value,error:''});this.invalidate();this.refresh();this.keepDraft();},
  kid(e){if(this.data.editing)return;const id=e.currentTarget.dataset.id;
    this.setData({kids:this.data.kids.map(k=>k.id===id?{...k,on:!k.on}:k)});this.invalidate();this.refresh();this.keepDraft();},
  scene(e){this.setData({scene:e.currentTarget.dataset.value});this.keepDraft();},
  example(){if(this.session.mode!=='demo'||this.data.editing)return;this.invalidate();
    this.setData({narrative:D.SCENARIOS[0].text,kids:this.data.kids.map((k,i)=>({...k,on:i===0})),scene:'自主游戏'});this.refresh();this.keepDraft();},
  keepDraft(){
    if(!this.session||this.saved||this.draftConflict||(!this.data.narrative&&!this.data.files.length))return;
    try{A.saveDraft({id:this.row&&this.row.id,revision:this.row&&this.row.revision,requestId:this.requestId,narrative:this.data.narrative,childIds:this.ids(),files:this.data.files,observedAt:this.observedAt,
      scene:this.data.scene,analysisId:this.analysisId||'',analysisPreserved:!!this.analysisPreserved,review:this.data.review,suggestions:this.data.suggestions,source:this.data.source});
      this.setData({draftStatus:'草稿在本机 · 尚未同步'});
    }catch(error){this.setData({draftStatus:'草稿保存失败',error:error.message});}
  },
  mediaConsent(){
    if(this.session.mode==='demo')return true;const chosen=this.data.kids.filter(k=>k.on);
    if(!chosen.length||chosen.some(k=>k.allowMedia!==true)){this.setData({error:'请先选择已获得照片、音视频记录授权的观察对象。'});return false;}return true;
  },
  playAudio(e){
    const file=this.data.files.find(f=>f.id===e.currentTarget.dataset.id);if(!file)return;
    if(!this.audio){this.audio=wx.createInnerAudioContext();this.audio.onError(()=>this.setData({error:'录音暂时无法播放，请检查网络或回到原记录重试。'}));}
    this.audio.stop();this.audio.src=file.path;this.audio.play();
  },
  async chooseMedia(){
    if(!this.mediaConsent())return;if(this.data.files.length>=9)return this.setData({error:'每条观察最多9个附件。'});
    try{await privacy.ensurePrivacyAuthorized(this);wx.chooseMedia({count:9-this.data.files.length,mediaType:['image','video'],sourceType:['camera','album'],maxDuration:60,
      success:async result=>{try{
        const fresh=await Promise.all(result.tempFiles.map(file=>A.persistFile({id:A.uid(),path:file.tempFilePath,size:file.size,kind:file.fileType==='video'?'video':'photo'})));
        this.setData({files:this.data.files.concat(fresh),error:''});this.refresh();this.keepDraft();
      }catch(error){failure(this,error);}},
      fail:error=>{if(!/cancel/.test(error.errMsg||''))failure(this,new Error('未能打开相机或相册，请检查微信权限。'));}
    });}catch(error){failure(this,error);}
  },
  async voice(){
    if(!this.mediaConsent())return;if(this.data.recording){this.stopRecording();return;}
    if(this.data.files.length>=9)return this.setData({error:'每条观察最多9个附件。'});
    try{await privacy.ensurePrivacyAuthorized(this);
      if(!this.recorder){this.recorder=wx.getRecorderManager();
        this.recorder.onStop(async result=>{this.setData({recording:false});if(!result.tempFilePath)return;
          try{const file=await A.persistFile({id:A.uid(),path:result.tempFilePath,kind:'audio'});
            this.setData({files:this.data.files.concat([file]),draftStatus:'录音已留在本机'});this.refresh();this.keepDraft();
          }catch(error){failure(this,error);}});
        this.recorder.onError(()=>this.setData({recording:false,error:'录音未完成，请检查麦克风权限。'}));
      }
      this.recorder.start({duration:60000,sampleRate:16000,numberOfChannels:1,format:'mp3'});this.setData({recording:true,error:''});
    }catch(error){failure(this,error);}
  },
  stopRecording(){if(this.recorder&&this.data.recording)this.recorder.stop();},
  removeFile(e){const file=this.data.files.find(x=>x.id===e.currentTarget.dataset.id);
    if(file&&file.existing)return this.setData({error:'已入库附件随整条观察保留；删除整条观察可同步清除附件。'});
    this.setData({files:this.data.files.filter(x=>x.id!==e.currentTarget.dataset.id)});this.refresh();this.keepDraft();
  },
  async prepare(){
    if(this.data.analyzing||this.data.busy)return;
    if(!this.ids().length||!this.data.narrative.trim())return this.setData({error:'先选择孩子，写下一段具体实录。'});
    this.setData({analyzing:true,error:''});const snapshot=this.data.narrative+'|'+this.ids().join(',');
    try{const result=await A.prepare({text:this.data.narrative,childIds:this.ids()});
      if(snapshot!==this.data.narrative+'|'+this.ids().join(','))return;
      this.prepareId=result.prepareId||'';this.scenarioId=result.scenarioId||'';this.previewSnapshot=snapshot;
      this.setData({previewOpen:true,previewText:result.text});
    }catch(error){failure(this,error);}finally{this.setData({analyzing:false});}
  },
  previewText(e){this.setData({previewText:e.detail.value});},closePreview(){this.setData({previewOpen:false});},
  async analyze(){
    if(this.data.analyzing)return;const snapshot=this.data.narrative+'|'+this.ids().join(',');
    if(snapshot!==this.previewSnapshot)return this.setData({error:'实录已变化，请重新预览。'});
    this.setData({analyzing:true,error:''});
    try{const result=await A.analyze({text:this.data.previewText,childIds:this.ids(),prepareId:this.prepareId,scenarioId:this.scenarioId,aiConfirmed:true});
      if(snapshot!==this.data.narrative+'|'+this.ids().join(','))return;
      this.analysisId=result.analysisId||'';this.analysisPreserved=false;
      this.setData({suggestions:result.suggestions||[],source:result.source||'rule',aiMessage:result.message||'',previewOpen:false,review:D.reviewed({}),reviewLabel:'待教师回看'});
      this.keepDraft();
    }catch(error){failure(this,error);}finally{this.setData({analyzing:false});}
  },
  decide(e){
    const decision=e.currentTarget.dataset.value,ids=decision==='ignored'?[]:this.data.suggestions.map(s=>s.id);
    this.setData({review:{...this.data.review,decision,ids,next:decision==='ignored'?'':this.data.review.next||this.data.suggestions.map(s=>s.next).join('\n')},reviewLabel:reviewLabel(decision)});this.keepDraft();
  },
  note(e){this.setData({review:{...this.data.review,note:e.detail.value}});this.keepDraft();},
  next(e){this.setData({review:{...this.data.review,next:e.detail.value}});this.keepDraft();},
  async submit(){
    if(this.data.busy||!this.data.canPost)return;
    if(this.data.recording)return this.setData({error:'请先结束录音。'});
    if(this.data.review.decision==='adjusted'&&!this.data.review.note.trim())return this.setData({error:'请写下调整后的教师判断。'});
    this.setData({busy:true,error:''});
    try{
      const value={id:this.row&&this.row.id,revision:this.row&&this.row.revision,requestId:this.requestId,observedAt:this.observedAt,
        narrative:this.data.narrative,scene:this.data.scene,childIds:this.ids(),hasMedia:this.data.files.length>0,review:this.data.review,
        suggestions:this.data.suggestions,source:this.data.source,analysisId:this.analysisId,preserveAnalysis:!!this.analysisPreserved};
      let row=await A.saveObservation(value);this.row=row;this.analysisPreserved=true;this.setData({editing:true});
      for(const file of this.data.files.filter(f=>!f.existing)){
        row=await A.attach(row,file);this.row=row;this.setData({files:this.data.files.map(f=>f.id===file.id?{...f,existing:true}:f)});
      }
      this.saved=true;A.clearDraft();this.setData({draftStatus:this.session.mode==='demo'?'已保存在本机示例':'已保存到云端'});
      wx.showToast({title:'观察已保存',icon:'success'});wx.navigateBack();
    }catch(error){this.keepDraft();failure(this,error);}finally{this.setData({busy:false});}
  },
  remove(){if(!this.row)return;wx.showModal({title:'删除这条观察？',content:'这条实录及其云端附件将被清除。已分享出去的Word文件需另行处理。',confirmText:'确认删除',
    success:async result=>{if(!result.confirm)return;try{await A.removeObservation(this.row.id);this.saved=true;A.clearDraft();wx.navigateBack();}catch(error){failure(this,error);}}
  });},
  onAgreePrivacy(){privacy.finishPrivacyAuthorization(this,true);},onDisagreePrivacy(){privacy.finishPrivacyAuthorization(this,false);},openPrivacyDoc(){privacy.openPrivacyContract();}
};}
function kids(){return {
  data:{session:{},list:[],name:'',consentId:'',ageBands:D.AGE_BANDS,ageIndex:1,error:'',busy:false},
  async onShow(){this.session=A.requireSession();if(!this.session)return;this.setData({session:this.session});try{this.setData({list:await A.children()});}catch(error){failure(this,error);}},
  name(e){this.setData({name:e.detail.value});},consent(e){this.setData({consentId:e.detail.value});},age(e){this.setData({ageIndex:Number(e.detail.value)});},
  async add(){if(this.data.busy)return;this.setData({busy:true,error:''});
    try{await A.addChild(this.data.name,this.data.ageBands[this.data.ageIndex],this.data.consentId);this.setData({name:'',consentId:'',list:await A.children()});}
    catch(error){failure(this,error);}finally{this.setData({busy:false});}}
};}
function exportPage(){return {
  data:{session:{},kids:[],kidIndex:0,from:'',to:'',rows:[],loaded:false,summary:'',error:'',busy:false,filePath:'',includePhotos:true,reportHint:''},
  async onShow(){this.session=A.requireSession();if(!this.session)return;const end=A.localDay(),start=end.slice(0,8)+'01';
    this.setData({session:this.session,from:this.data.from||start,to:this.data.to||end});try{this.setData({kids:await A.children()});}catch(error){failure(this,error);}},
  invalidate(){this.setData({rows:[],loaded:false,filePath:'',summary:'',reportHint:''});},
  kid(e){this.setData({kidIndex:Number(e.detail.value)});this.invalidate();},
  from(e){this.setData({from:e.detail.value});this.invalidate();},to(e){this.setData({to:e.detail.value});this.invalidate();},
  summary(e){this.setData({summary:e.detail.value,filePath:''});},photos(e){this.setData({includePhotos:e.detail.value,filePath:''});},
  draftSummary(){
    const notes=this.data.rows.map(D.forReport).filter(r=>r.teacherNote);
    this.setData({summary:notes.map(r=>A.dateLabel(r.observed_at)+'：'+r.teacherNote).join('\n').slice(0,2000),filePath:'',reportHint:notes.length?'已汇集教师确认的摘记，请编辑成自己的阶段回看。':'暂无已确认的教师摘记，可直接写下自己的回看。'});
  },
  async review(){
    if(this.data.busy)return;const child=this.data.kids[this.data.kidIndex];if(!child)return this.setData({error:'请先添加观察对象。'});
    this.setData({busy:true,error:'',filePath:''});
    try{const rows=await A.allObservations({childId:child.id,from:this.data.from,to:this.data.to});
      this.setData({rows:rows.map(row=>({...row,when:A.dateLabel(row.observed_at),status:reviewLabel((row.review||{}).decision)})),loaded:true});
    }catch(error){failure(this,error);}finally{this.setData({busy:false});}
  },
  async download(){
    if(this.data.busy)return;if(!this.data.loaded)return this.review();
    if(!this.data.rows.length)return this.setData({error:'这个日期范围还没有观察记录。'});
    this.setData({busy:true,error:''});
    try{
      if(this.session.mode==='formal'){
        const fresh=await A.allObservations({childId:this.data.kids[this.data.kidIndex].id,from:this.data.from,to:this.data.to});
        const signature=rows=>JSON.stringify(rows.map(row=>[row.id,row.revision]));
        if(signature(fresh)!==signature(this.data.rows)){this.setData({loaded:false,rows:[],filePath:''});throw new Error('授权或观察记录已有变化，请重新回看后再导出。');}
      }
      const {writeReport}=require('./banli-report');
      const result=await writeReport({session:this.session,child:this.data.kids[this.data.kidIndex],rows:this.data.rows,summary:this.data.summary,includePhotos:this.data.includePhotos,from:this.data.from,to:this.data.to});
      this.setData({filePath:result.filePath,reportHint:result.missing?`${result.missing}张照片未能嵌入，报告中已注明，请检查后再分享。`:'Word已生成。分享前请确认接收人的查看权限。'});
      wx.openDocument({filePath:result.filePath,fileType:'docx',showMenu:true});
    }catch(error){failure(this,error);}finally{this.setData({busy:false});}
  },
  share(){if(!this.data.filePath)return;wx.shareFileMessage({filePath:this.data.filePath,fileName:'班里手记_观察汇总.docx',fail:()=>this.setData({error:'分享未完成，文件仍保留在本机。'})});}
};}
function about(){return {
  data:{session:{},version:'1.2.0-review'},onShow(){this.setData({session:A.getSession()||{}});},
  legal(e){wx.navigateTo({url:'/pages/legal/'+e.currentTarget.dataset.type});},
  logout(){wx.showModal({title:'退出并清除本机副本？',content:'本机草稿、示例记录及本版导出的文件将清除，正式云端记录保持不变。',success:result=>{if(result.confirm)A.logout();}});}
};}
function legal(){return {data:{session:{}},onShow(){this.setData({session:A.getSession()||{}});}};}
module.exports={login,feed,compose,kids,exportPage,about,legal};
