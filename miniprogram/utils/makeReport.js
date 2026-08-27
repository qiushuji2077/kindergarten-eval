const { matchGuide, inferAgeBand } = require('./guide');

function escapeXml(text) {
  return String(text || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n) {
  return new Uint8Array([n & 255, (n >>> 8) & 255]);
}

function u32(n) {
  return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
}

function concat(parts) {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  parts.forEach((p) => {
    out.set(p, o);
    o += p.length;
  });
  return out;
}

function utf8(str) {
  const s = unescape(encodeURIComponent(str));
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) b[i] = s.charCodeAt(i);
  return b;
}

function zipStore(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  files.forEach((f) => {
    const name = utf8(f.name);
    const data = typeof f.data === 'string' ? utf8(f.data) : f.data;
    const crc = crc32(data);
    const local = concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0),
      name, data,
    ]);
    const central = concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
      name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  });
  const center = concat(centrals);
  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(center.length), u32(offset), u16(0),
  ]);
  return concat(locals.concat([center, end]));
}

function wPara(text, opts = {}) {
  const sz = opts.size || 21;
  const align = opts.align === 'center' ? '<w:jc w:val="center"/>' : '';
  const after = opts.after != null ? opts.after : 80;
  const bold = opts.bold ? '<w:b/>' : '';
  return `<w:p><w:pPr>${align}<w:spacing w:after="${after}" w:line="360" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="宋体" w:eastAsia="宋体" w:hAnsi="宋体"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${bold}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function imagePara(relId, cx, cy) {
  const n = Number(String(relId).replace(/\D/g, '')) || 1;
  return `<w:p><w:pPr><w:spacing w:before="80" w:after="80"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="photo${n}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="image"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function tc(inner, span, width) {
  const spanXml = span > 1 ? `<w:gridSpan w:val="${span}"/>` : '';
  return `<w:tc><w:tcPr>${spanXml}<w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="center"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar></w:tcPr>${inner}</w:tc>`;
}

function labelValueRow(l1, v1, l2, v2) {
  return `<w:tr>${tc(wPara(l1), 1, 1600)}${tc(wPara(v1), 1, 3393)}${tc(wPara(l2), 1, 1600)}${tc(wPara(v2), 1, 3393)}</w:tr>`;
}

function narrativeParas(obs) {
  const text = String(obs.narrative || obs.voice_transcript || '').trim() || '（无文字实录）';
  return text.split(/\n/).map((line) => wPara(line, { after: 80 })).join('');
}

function stageParas(obs) {
  const parts = [wPara('发展状态', { after: 40 })];
  const hits = obs.guideHits || [];
  hits.forEach((g) => {
    parts.push(wPara(`《指南》${g.domain || ''}  ${g.area || ''}  ${g.goal || ''}`, { after: 20 }));
    if (g.typical) parts.push(wPara(`${g.ageBand || ''}：${g.typical}`, { after: 20 }));
    const keys = g.keywords && g.keywords.length
      ? g.keywords
      : String(g.keywordText || '').split('、').filter(Boolean);
    if (keys.length) parts.push(wPara(`（捕捉字段：${keys.join('、')}）`, { after: 40 }));
    if (g.reason) parts.push(wPara(`（${g.source === 'ai' ? 'AI 对应' : '对应'}：${g.reason}）`, { after: 40 }));
    if (g.coa) {
      parts.push(wPara(`${g.coa.domain || ''}  ${g.coa.indicator || ''}`, { after: 20 }));
      parts.push(wPara(`阶段${g.coa.level || ''}：对应《指南》上述典型表现。`, { after: 80 }));
    }
  });
  if (!hits.length) parts.push(wPara('（未标注发展阶段）', { after: 40 }));
  return parts.join('');
}

function observationTable(obs, childName, imageRels) {
  const date = String(obs.observed_at || '').replace('T', ' ').slice(0, 16);
  const mediaXml = (imageRels || []).map((img) => imagePara(img.relId, img.cx, img.cy)).join('');
  const videos = (obs.media || []).filter((m) => m.kind === 'video');
  const audios = (obs.media || []).filter((m) => m.kind === 'audio');
  const extra = [];
  if (videos.length) extra.push(wPara('（本条含视频，请在小程序记录中观看）', { after: 40 }));
  if (audios.length) extra.push(wPara('（本条含语音）', { after: 40 }));
  return `<w:tbl><w:tblPr><w:tblW w:w="9986" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="1600"/><w:gridCol w:w="3393"/><w:gridCol w:w="1600"/><w:gridCol w:w="3393"/></w:tblGrid>${labelValueRow('记录教师', obs.teacher_name || '', '观察时间', date)}${labelValueRow('记录班级', obs.class_name || '', '观察对象', childName)}<w:tr>${tc(`${wPara('观察实录', { after: 60 })}${narrativeParas(obs)}${mediaXml}${extra.join('')}`, 4, 9986)}</w:tr><w:tr>${tc(stageParas(obs), 4, 9986)}</w:tr></w:tbl>`;
}

function readFs(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      success: (res) => resolve(res.data),
      fail: (err) => reject(err),
    });
  });
}

function downloadCloud(fileID) {
  return new Promise((resolve) => {
    if (!wx.cloud || String(fileID).indexOf('cloud://') !== 0) {
      resolve('');
      return;
    }
    wx.cloud.downloadFile({
      fileID,
      success: (d) => resolve(d.tempFilePath),
      fail: () => resolve(''),
    });
  });
}

function compressIfNeeded(src) {
  return new Promise((resolve) => {
    if (!wx.compressImage) {
      resolve(src);
      return;
    }
    wx.compressImage({
      src,
      quality: 70,
      success: (r) => resolve(r.tempFilePath || src),
      fail: () => resolve(src),
    });
  });
}

function toBytes(data) {
  if (!data) return new Uint8Array(0);
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(0);
}

function detectExt(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg';
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50) return 'png';
  return 'jpg';
}

function pickPhotos(media) {
  const photos = (media || []).filter((m) => !m.kind || m.kind === 'photo');
  const cloud = photos.filter((m) => String(m.fileID || m.filename || '').indexOf('cloud://') === 0);
  const local = photos.filter((m) => {
    const p = m.fileID || m.filename || m.path || '';
    return p && String(p).indexOf('cloud://') !== 0;
  });
  return (cloud.length ? cloud : local).slice(0, 2);
}

async function loadPhotoBytes(item) {
  const raw = item.fileID || item.filename || item.path || '';
  let path = raw;
  if (String(raw).indexOf('cloud://') === 0) {
    path = await downloadCloud(raw);
  }
  if (!path) return null;
  try {
    const compressed = await compressIfNeeded(path);
    const data = toBytes(await readFs(compressed));
    if (!data.length) return null;
    return { bytes: data, ext: detectExt(data) };
  } catch {
    return null;
  }
}

function enrichObservation(obs) {
  const text = `${obs.narrative || ''}\n${obs.voice_transcript || ''}`.trim();
  const hits = obs.guideHits && obs.guideHits.length
    ? obs.guideHits
    : matchGuide(text, inferAgeBand({ className: obs.class_name, observedAt: obs.observed_at }));
  return Object.assign({}, obs, { guideHits: hits });
}

async function writeChildReport({ kindergartenName, childName, className, observations, aiSummary }) {
  const kg = String(kindergartenName || '').trim() || '幼儿园';
  const rows = (observations || []).map(enrichObservation);
  const dates = rows.map((o) => String(o.observed_at || '').slice(0, 10)).filter(Boolean).sort();
  const reportDate = new Date().toISOString().slice(0, 10);
  const mediaFiles = [];
  const rels = ['<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'];
  const perObsImages = [];
  let imgIndex = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const photos = pickPhotos(rows[i].media);
    const loaded = [];
    for (let p = 0; p < photos.length; p += 1) {
      const got = await loadPhotoBytes(photos[p]);
      if (!got) continue;
      imgIndex += 1;
      const relId = `rIdImg${imgIndex}`;
      const name = `word/media/image${imgIndex}.${got.ext}`;
      mediaFiles.push({ name, data: got.bytes, ext: got.ext });
      rels.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${imgIndex}.${got.ext}"/>`);
      loaded.push({ relId, cx: 4000500, cy: 2667000 });
    }
    perObsImages.push(loaded);
  }

  const cover = [
    wPara(kg, { size: 44, align: 'center', after: 80 }),
    wPara('儿童观察记录汇总', { size: 44, align: 'center', after: 200 }),
    wPara(`儿童姓名：${childName || ''}`, { size: 32, align: 'center', after: 40 }),
    wPara(`班级名称：${className || ''}`, { size: 32, align: 'center', after: 40 }),
    wPara(`观察始于：${dates[0] || '—'}`, { size: 28, align: 'center', after: 40 }),
    wPara(`观察截止：${dates[dates.length - 1] || '—'}`, { size: 28, align: 'center', after: 40 }),
    wPara(`报告日期：${reportDate}`, { size: 28, align: 'center', after: 40 }),
    wPara(`本报告共包含记录${rows.length}篇。`, { size: 28, after: 80 }),
  ];
  if (aiSummary) {
    cover.push(wPara('AI 发展综述（供教研参考，不替代教师判断）', { size: 28, after: 40, bold: true }));
    cover.push(wPara(aiSummary, { size: 28, after: 200 }));
  } else {
    cover[cover.length - 1] = wPara(`本报告共包含记录${rows.length}篇。`, { size: 28, after: 200 });
  }
  const coverXml = cover.join('');

  const tables = rows
    .map((obs, i) => observationTable(obs, childName, perObsImages[i]) + wPara(' ', { after: 240 }))
    .join('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${coverXml}${tables}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="960" w:bottom="1440" w:left="960"/></w:sectPr></w:body></w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;

  const pkgRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="宋体" w:eastAsia="宋体"/><w:sz w:val="21"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;

  const zipFiles = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: pkgRels },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/_rels/document.xml.rels', data: docRels },
    { name: 'word/styles.xml', data: styles },
  ].concat(mediaFiles);

  const buf = zipStore(zipFiles);
  const filePath = `${wx.env.USER_DATA_PATH}/obs-report-${Date.now()}.docx`;
  const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().writeFile({
      filePath,
      data,
      encoding: 'binary',
      success: () => resolve(filePath),
      fail: (err) => reject(new Error(err.errMsg || '写入报告失败')),
    });
  });
}

module.exports = { writeChildReport, enrichObservation };
