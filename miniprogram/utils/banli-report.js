'use strict';
// A small, dependency-free OOXML writer for the native mini program.
const D=require('./banli-domain');
const A=require('./banli-api');
const NS='http://schemas.openxmlformats.org/';
const xml=s=>String(s==null?'':s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function utf8(s){const str=unescape(encodeURIComponent(s));return Uint8Array.from(str,c=>c.charCodeAt(0));}
function join(parts){const out=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}
function num(value,size){const bytes=new Uint8Array(size);for(let i=0;i<size;i++)bytes[i]=(value>>>(8*i))&255;return bytes;}
function crc(bytes){let value=0xffffffff;for(const byte of bytes){value^=byte;for(let n=0;n<8;n++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;}
function zip(files){let offset=0;const local=[],central=[];for(const f of files){const name=utf8(f.name),data=typeof f.data==='string'?utf8(f.data):f.data,check=crc(data);const head=join([num(0x04034b50,4),num(20,2),num(0x800,2),num(0,2),num(0,2),num(33,2),num(check,4),num(data.length,4),num(data.length,4),num(name.length,2),num(0,2),name,data]);local.push(head);central.push(join([num(0x02014b50,4),num(20,2),num(20,2),num(0x800,2),num(0,2),num(0,2),num(33,2),num(check,4),num(data.length,4),num(data.length,4),num(name.length,2),num(0,2),num(0,2),num(0,2),num(0,2),num(0,4),num(offset,4),name]));offset+=head.length;}const directory=join(central);return join([...local,directory,join([num(0x06054b50,4),num(0,2),num(0,2),num(files.length,2),num(files.length,2),num(directory.length,4),num(offset,4),num(0,2)])]);}
function p(value,style='Normal'){return String(value||'').split('\n').map(line=>`<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r></w:p>`).join('');}
function image(ref){const width=Math.min(5486400,Math.round(ref.width/ref.height*4114800)),height=Math.round(width/ref.width*ref.height);return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width}" cy="${height}"/><wp:docPr id="${ref.number}" name="观察附件${ref.number}" descr="${xml(ref.description||'经授权的观察照片')}"/><a:graphic><a:graphicData uri="${NS}drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="photo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdPhoto${ref.number}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;}
function buildReport({session,child,rows,summary,from,to,photoGroups=[],missingGroups=[]}){
 D.dateRange(from,to);const reviewed=rows.map(D.forReport),files=[],rels=[];let count=0;
 const parts=[p('班里手记','Title'),p('儿童观察记录汇总','Subtitle'),p(session.mode==='demo'?'示例体验 · 不作为真实儿童发展记录':'内部资料 · 仅供已获授权的教师与监护人查看','Caption'),p((session.kindergartenName||'幼儿园')+' · '+(session.className||''),'Metadata'),p('观察对象：'+child.name,'Metadata'),p('观察范围：'+from+' 至 '+to,'Metadata'),p('这些记录保留具体情境与教师理解，未用于评分、排名或诊断。','Caption')];
 if(D.text(summary))parts.push(p('教师阶段回看','Heading1'),p(D.text(summary,2000)),p('以上文字由教师编辑与确认。','Caption'));
 parts.push(p('逐条观察','Heading1'));
 reviewed.forEach((row,index)=>{
  parts.push(p(`${index+1}. ${A.dateLabel(row.observed_at)}  ${row.scene||''}`,'Heading2'));
  parts.push(p(`记录教师：${row.teacher_name||''} · ${['accepted','adjusted'].includes(row.review.decision)?'教师已回看':'保留实录，尚无确认后的解读'}`,'Metadata'));
  parts.push(p('观察实录','Label'),p(row.narrative||'（本条以附件记录，未填写文字实录。）'));
  for(const img of photoGroups[index]||[]){count++;const filename=`image${count}.${img.ext}`;files.push({name:'word/media/'+filename,data:img.bytes});rels.push(`<Relationship Id="rIdPhoto${count}" Type="${NS}officeDocument/2006/relationships/image" Target="media/${filename}"/>`);parts.push(image({...img,number:count}));}
  if(missingGroups[index])parts.push(p(`有${missingGroups[index]}张照片未能嵌入，请返回小程序核对原记录。`,'Caption'));
  const totalPhotos=(row.media||[]).filter(m=>m.kind==='photo').length;
  if(totalPhotos>2)parts.push(p('本报告每条最多附2张照片，其余附件请在小程序中查看。','Caption'));
  if((row.media||[]).some(m=>m.kind==='audio'||m.kind==='video'))parts.push(p('本条含录音或视频，请在小程序内经授权查看。','Caption'));
  if(row.suggestions.length){parts.push(p('教师确认的观察线索','Label'));for(const s of row.suggestions){parts.push(p(`${s.domain} · ${s.goal}（${s.source==='ai'?'AI辅助，教师确认':'规则提示，教师确认'}）`));parts.push(p(`线索原文：“${s.evidence}”`));if(s.reason)parts.push(p(s.reason));}parts.push(p('方向名称由本项目整理，非《指南》原文、量表或发展等级。','Caption'));}
  if(row.teacherNote)parts.push(p('教师摘记','Label'),p(row.teacherNote));
  if(row.nextObservation)parts.push(p('继续观察','Label'),p(row.nextObservation));
 });
 parts.push(p('使用提醒','Heading1'),p('本文件包含儿童观察资料。分享前请确认接收人的查看权限；离开小程序后，文件无法自动撤回。请依园所约定妥善保管与删除。','Caption'));
 const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${NS}wordprocessingml/2006/main" xmlns:r="${NS}officeDocument/2006/relationships" xmlns:wp="${NS}drawingml/2006/wordprocessingDrawing" xmlns:a="${NS}drawingml/2006/main" xmlns:pic="${NS}drawingml/2006/picture"><w:body>${parts.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:bottom="1134" w:left="1417" w:right="1417" w:header="567" w:footer="567"/></w:sectPr></w:body></w:document>`;
 const style=(id,size,color,bold=false,before=0,after=140)=>`<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${id}"/><w:basedOn w:val="Normal"/><w:pPr>${id.startsWith('Heading')||id==='Label'?'<w:keepNext/>':''}<w:spacing w:before="${before}" w:after="${after}" w:line="340" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="${size}"/><w:color w:val="${color}"/>${bold?'<w:b/>':''}</w:rPr></w:style>`;
 const styles=`<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="${NS}wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:widowControl/><w:spacing w:after="140" w:line="340" w:lineRule="auto"/></w:pPr></w:style>${style('Title',44,'244D3F',true,0,140)}${style('Subtitle',30,'244D3F',true)}${style('Heading1',28,'244D3F',true,280,160)}${style('Heading2',24,'244D3F',true,220,140)}${style('Label',22,'244D3F',true,100,80)}${style('Metadata',20,'526659')}${style('Caption',18,'69776C',false,40,120)}</w:styles>`;
 const defaults=['<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>','<Default Extension="xml" ContentType="application/xml"/>','<Default Extension="jpg" ContentType="image/jpeg"/>','<Default Extension="png" ContentType="image/png"/>'];
 return zip([{name:'[Content_Types].xml',data:`<?xml version="1.0"?><Types xmlns="${NS}package/2006/content-types">${defaults.join('')}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`},
 {name:'_rels/.rels',data:`<?xml version="1.0"?><Relationships xmlns="${NS}package/2006/relationships"><Relationship Id="rIdDoc" Type="${NS}officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`},
 {name:'word/document.xml',data:doc},{name:'word/styles.xml',data:styles},
 {name:'word/_rels/document.xml.rels',data:`<?xml version="1.0"?><Relationships xmlns="${NS}package/2006/relationships"><Relationship Id="rIdStyle" Type="${NS}officeDocument/2006/relationships/styles" Target="styles.xml"/>${rels.join('')}</Relationships>`},...files]);
}
const call=(object,name,args)=>new Promise((resolve,reject)=>object[name]({...args,success:resolve,fail:reject}));
async function loadImage(src){
 let path=src;if(/^https:\/\//.test(src)){const got=await call(wx,'downloadFile',{url:src});D.check(got.statusCode===200,'图片下载失败');path=got.tempFilePath;}
 if(wx.compressImage){try{path=(await call(wx,'compressImage',{src:path,quality:70})).tempFilePath;}catch(_){}}
 const info=await call(wx,'getImageInfo',{src:path});D.check(info.width>0&&info.height>0,'图片尺寸无效');
 const read=await call(wx.getFileSystemManager(),'readFile',{filePath:path});const bytes=read.data instanceof Uint8Array?read.data:new Uint8Array(read.data);
 const ext=bytes[0]===0xff&&bytes[1]===0xd8?'jpg':bytes[0]===137&&bytes[1]===80?'png':'';D.check(ext,'图片格式暂不支持嵌入');
 return {bytes,ext,width:info.width,height:info.height};
}
async function writeReport(options){
 const photoGroups=[],missingGroups=[];let budget=0,missing=0;
 for(const row of options.rows){const imgs=[];let absent=0;
  if(options.includePhotos){const photos=(row.media||[]).filter(m=>m.kind==='photo').slice(0,2);let urls={};
   if(options.session.mode==='formal'&&photos.length){try{urls=Object.fromEntries((await A.mediaAccess(row.id)).map(m=>[m.fileID,m.url]));}catch(_){}}
   for(const photo of photos){try{const path=options.session.mode==='demo'?(photo.path||photo.fileID):urls[photo.fileID];D.check(path,'图片未获得访问授权');const img=await loadImage(path);D.check(budget+img.bytes.length<=12*1024*1024,'报告照片超过本版容量上限');budget+=img.bytes.length;imgs.push(img);}catch(_){absent++;}}
  }photoGroups.push(imgs);missingGroups.push(absent);missing+=absent;
 }
 const data=buildReport({...options,photoGroups,missingGroups}),filePath=wx.env.USER_DATA_PATH+'/banli-v12-'+Date.now()+'-'+A.uid()+'.docx';
 await call(wx.getFileSystemManager(),'writeFile',{filePath,data:data.buffer});return {filePath,missing};
}
module.exports={writeReport,buildReport,zip,xml};
