const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  VerticalAlign,
  ImageRun,
} = require('docx');
const QRCode = require('qrcode');

const PAGE_W = 9986;
const COLS = [1600, 3393, 1600, 3393];
const INK = '3D3D3D';
const thin = { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 0 };
const borders = { top: thin, bottom: thin, left: thin, right: thin };
const noPad = { top: 40, bottom: 40, left: 80, right: 80 };

function run(text, opts = {}) {
  return new TextRun({
    text: text ?? '',
    font: '宋体',
    size: opts.size ?? 21,
    color: opts.color ?? INK,
    bold: opts.bold ?? false,
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { after: opts.after ?? 0, before: opts.before ?? 0, line: 360 },
    children: [run(text, opts)],
  });
}

function cell(children, { span = 1, width, fill } = {}) {
  return new TableCell({
    borders,
    columnSpan: span,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    shading: fill ? { type: 'clear', fill, color: 'auto' } : undefined,
    margins: noPad,
    children: Array.isArray(children) ? children : [children],
  });
}

function labelValueRow(l1, v1, l2, v2) {
  return new TableRow({
    children: [
      cell(p(l1, { size: 21 }), { width: COLS[0] }),
      cell(p(v1, { size: 21 }), { width: COLS[1] }),
      cell(p(l2, { size: 21 }), { width: COLS[2] }),
      cell(p(v2, { size: 21 }), { width: COLS[3] }),
    ],
  });
}

async function mediaBlocks(obs, imageMap) {
  const out = [];
  const photos = (obs.media || []).filter((m) => m.kind === 'photo');
  for (const photo of photos.slice(0, 2)) {
    const fileID = photo.fileID || photo.filename;
    const data = imageMap[fileID];
    if (!data) continue;
    const isPng = (photo.mime_type || '').includes('png') || String(fileID).endsWith('.png');
    out.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [
          new ImageRun({
            type: isPng ? 'png' : 'jpg',
            data,
            transformation: { width: 420, height: 280 },
            altText: { title: 'photo', description: '观察照片', name: 'photo' },
          }),
        ],
      }),
    );
  }
  const videos = (obs.media || []).filter((m) => m.kind === 'video');
  for (const v of videos) {
    const url = v.tempUrl || '';
    if (!url) continue;
    out.push(p('(扫码观看记录视频，建议使用微信扫一扫)', { size: 21, after: 60 }));
    try {
      const png = await QRCode.toBuffer(url, { width: 140, margin: 1 });
      out.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new ImageRun({
              type: 'png',
              data: png,
              transformation: { width: 88, height: 88 },
              altText: { title: 'qr', description: '视频二维码', name: 'qr' },
            }),
          ],
        }),
      );
    } catch {
      out.push(p(`视频链接：${url}`, { size: 18 }));
    }
  }
  return out;
}

function stageParas(obs) {
  const out = [p('发展状态', { size: 21, after: 40 })];
  if (obs.guideHits?.length) {
    for (const g of obs.guideHits) {
      out.push(p(`《指南》${g.domain}  ${g.area}  ${g.goal}`, { size: 21, after: 20 }));
      out.push(p(`${g.ageBand}：${g.typical}`, { size: 21, after: 20 }));
      if (g.keywords?.length) {
        out.push(p(`（捕捉字段：${g.keywords.join('、')}）`, { size: 21, after: 80 }));
      }
    }
  }
  if (!obs.guideHits?.length) out.push(p('（未标注发展阶段）', { size: 21 }));
  return out;
}

async function observationTable(obs, childName, imageMap) {
  const date = String(obs.observed_at || '').slice(0, 10);
  const narrative = obs.narrative || obs.voice_transcript || '（无文字实录）';
  const mediaParas = await mediaBlocks(obs, imageMap);
  return       new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: COLS,
    rows: [
      labelValueRow('记录教师', obs.teacher_name, '观察时间', date),
      labelValueRow('记录班级', obs.class_name, '观察对象', childName),
      new TableRow({
        children: [
          cell(
            [p('观察实录', { size: 21, after: 60 }), p(narrative, { size: 21, after: 80 }), ...mediaParas],
            { span: 4, width: PAGE_W },
          ),
        ],
      }),
      new TableRow({
        children: [cell(stageParas(obs), { span: 4, width: PAGE_W })],
      }),
    ],
  });
}

async function buildChildReport({ child, observations, meta, kindergartenName, imageMap }) {
  const reportDate = new Date().toISOString().slice(0, 10);
  const children = [
    p(kindergartenName, { size: 52, align: AlignmentType.CENTER, after: 80 }),
    p('儿童观察记录汇总', { size: 52, align: AlignmentType.CENTER, after: 200 }),
    p(`儿童姓名：${child.name}`, { size: 36, align: AlignmentType.CENTER, after: 40 }),
    p(`班级名称：${child.class_name}`, { size: 36, align: AlignmentType.CENTER, after: 40 }),
    p(`观察始于：${meta.from || '—'}`, { size: 36, align: AlignmentType.CENTER, after: 40 }),
    p(`观察截止：${meta.to || '—'}`, { size: 36, align: AlignmentType.CENTER, after: 40 }),
    p(`报告日期：${reportDate}`, { size: 36, align: AlignmentType.CENTER, after: 80 }),
    p(`本报告共包含记录${meta.total}篇。`, { size: 36, after: 200 }),
  ];
  for (const obs of observations) {
    children.push(await observationTable(obs, child.name, imageMap || {}));
    children.push(new Paragraph({ spacing: { after: 240 }, children: [] }));
  }
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 960, bottom: 1440, left: 960 },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}

module.exports = { buildChildReport };
