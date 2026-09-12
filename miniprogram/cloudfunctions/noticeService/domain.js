'use strict';
// Project-authored prompts. These are NOT the verbatim Guide or a developmental scale.
const REFERENCE_VERSION = 'banli-observation-prompts/1.2';
const REFERENCES = [
  {id:'peer',domain:'社会',goal:'同伴交往',keys:['一起','轮流','商量','分享','争抢'],next:'下次遇到相似情境时，留意孩子怎样表达需要、回应同伴。'},
  {id:'emotion',domain:'健康',goal:'情绪表达',keys:['生气','难过','害怕','安慰','平静'],next:'继续记录情绪发生的情境，以及孩子寻求或接受了怎样的支持。'},
  {id:'language',domain:'语言',goal:'倾听与表达',keys:['说','告诉','因为','解释','问'],next:'保留孩子的原话，也留意同伴怎样回应。'},
  {id:'explore',domain:'科学',goal:'探究与尝试',keys:['试','发现','为什么','倒了','比较','重新'],next:'再遇到困难时，孩子会尝试哪些办法？哪些条件发生了变化？'},
  {id:'math',domain:'科学',goal:'数量与空间',keys:['数了','几个','长短','排序','形状','上面','下面'],next:'留意孩子如何比较、操作和说明自己的发现。'},
  {id:'selfcare',domain:'健康',goal:'生活自理',keys:['洗手','穿鞋','整理','吃饭','收拾'],next:'观察孩子独立完成了哪些部分，在哪些环节需要支持。'},
  {id:'art',domain:'艺术',goal:'感受与表达',keys:['画','音乐','唱','跳舞','颜色','扮演'],next:'听听孩子怎样介绍作品、动作或角色中的想法。'}
];
const SCENARIOS = [
  {id:'blocks',title:'积木倒下以后',text:'积木倒了，小禾说：“我们一起修好。”他扶住底下的积木，请同伴再放一块，试了两次。'},
  {id:'water',title:'水为什么漏出来',text:'小禾把水倒进有孔的杯子，发现水从下面流出。他换了一只杯子，再试了一次，说：“这个没有洞。”'},
  {id:'care',title:'收拾午餐之后',text:'午餐后，小禾自己把餐盘放回架子，发现桌上还有米粒，又拿来抹布擦了一遍。'}
];
const AGE_BANDS = ['3-4岁','4-5岁','5-6岁','混龄或待核对'];
function text(value,max=2000) {
  return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim().slice(0,max);
}
function check(condition,message,code='VALIDATION') {
  if(!condition){const error=new Error(message);error.code=code;throw error;}
}
function redact(value,names=[]) {
  let out=text(value,2000);
  [...new Set(names.filter(Boolean).map(String))].sort((a,b)=>b.length-a.length).forEach(name=>{out=out.split(name).join('〔已隐去身份〕');});
  return out.replace(/https?:\/\/\S+/gi,'〔链接已移除〕')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'〔邮箱已移除〕')
    .replace(/\b\d{17}[0-9Xx]\b/g,'〔证件号已移除〕')
    .replace(/(?:\+?86[- ]?)?1[3-9]\d{9}\b/g,'〔电话已移除〕')
    .replace(/\d{4}[-年/]\d{1,2}[-月/]\d{1,2}日?/g,'〔日期已移除〕');
}
function rules(value) {
  const raw=text(value);
  return REFERENCES.map(r=>({r,key:r.keys.find(k=>raw.includes(k))})).filter(x=>x.key).slice(0,3)
    .map(({r,key})=>({id:r.id,domain:r.domain,goal:r.goal,evidence:key,
      reason:'文字中出现了这一线索，请结合当时情境判断是否相关。',next:r.next,source:'rule'}));
}
function sanitizeSuggestions(raw,value) {
  const blocked=/诊断|发育迟缓|智商|多动症|自闭|落后于|优于同龄|达到.{0,5}阶段|得分|分数|等级/;
  const arr=Array.isArray(raw)?raw:[];const seen=new Set();
  return arr.slice(0,8).map(item=>{
    if(!item||typeof item!=='object')return null;
    const ref=REFERENCES.find(r=>r.id===item.id);const evidence=text(item.evidence,180);
    if(!ref||seen.has(ref.id)||!evidence||!String(value).includes(evidence))return null;
    const reason=text(item.reason,200),next=text(item.next,200);
    if(!reason||blocked.test(reason+next))return null;seen.add(ref.id);
    return {id:ref.id,domain:ref.domain,goal:ref.goal,evidence,reason,next:next||ref.next,source:'ai'};
  }).filter(Boolean).slice(0,3);
}
function validDate(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
  const d=new Date(value+'T00:00:00Z');
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
}
function dateRange(from,to) {
  check(!from||validDate(from),'开始日期无效');check(!to||validDate(to),'结束日期无效');
  check(!(from&&to)||from<=to,'开始日期不能晚于结束日期');return {from:from||'',to:to||''};
}
function reviewed(value) {
  const v=value||{};const decision=['accepted','adjusted','ignored'].includes(v.decision)?v.decision:'pending';
  return {decision,note:text(v.note,1000),next:text(v.next,400),ids:Array.isArray(v.ids)?[...new Set(v.ids)].filter(id=>REFERENCES.some(r=>r.id===id)).slice(0,3):[]};
}
function forReport(row) {
  const r=reviewed(row.review);const confirmed=['accepted','adjusted'].includes(r.decision);
  return {...row,review:{...r,reviewedAt:row.review&&row.review.reviewedAt||''},
    suggestions:confirmed?(row.suggestions||[]).filter(s=>r.ids.includes(s.id)):[],
    teacherNote:confirmed?r.note:'',nextObservation:confirmed?r.next:''};
}
module.exports={REFERENCES,REFERENCE_VERSION,SCENARIOS,AGE_BANDS,text,check,redact,rules,sanitizeSuggestions,dateRange,reviewed,forReport};
