const localStore = require('./localStore');

const CLOUD_FN = 'noticeService';

function unwrap(res) {
  const body = res && res.result !== undefined ? res.result : res;
  if (body && body.error) throw new Error(body.error);
  return body;
}

function callCloud(action, payload = {}, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    if (!wx.cloud) {
      reject(new Error('当前基础库不支持云开发'));
      return;
    }
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, new Error('云函数超时')), timeoutMs);
    wx.cloud.callFunction({
      name: CLOUD_FN,
      data: { action, ...payload },
      success: (res) => {
        try {
          finish(resolve, unwrap(res));
        } catch (err) {
          finish(reject, err);
        }
      },
      fail: (err) => finish(reject, new Error(err.errMsg || '云函数调用失败')),
    });
  });
}

function mergeMedia(a, b) {
  const list = [];
  const seen = {};
  (a || []).concat(b || []).forEach((m) => {
    const key = m.fileID || m.filename || m.path || m.id;
    if (!key || seen[key]) return;
    seen[key] = true;
    list.push(m);
  });
  return list;
}

function longer(a, b) {
  return String(a || '').length >= String(b || '').length ? a || b || '' : b || '';
}

function mergeRows(cloudRows, localRows) {
  const map = {};
  const take = (row) => {
    if (!row || !row.id) return;
    const prev = map[row.id];
    if (!prev) {
      map[row.id] = row;
      return;
    }
    map[row.id] = Object.assign({}, prev, row, {
      narrative: longer(row.narrative, prev.narrative),
      voice_transcript: longer(row.voice_transcript, prev.voice_transcript),
      guideHits:
        (row.guideHits || []).length >= (prev.guideHits || []).length ? row.guideHits : prev.guideHits,
      media: mergeMedia(prev.media, row.media),
      children: (row.children && row.children.length) ? row.children : prev.children,
    });
  };
  (cloudRows || []).forEach(take);
  (localRows || []).forEach(take);
  return Object.values(map).sort((a, b) =>
    String(b.observed_at || '').localeCompare(String(a.observed_at || '')),
  );
}

function pathToAction(path, method) {
  const [rawPath, qs] = path.split('?');
  const query = {};
  if (qs) {
    qs.split('&').forEach((pair) => {
      const [k, v] = pair.split('=');
      query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }
  const textCreate = rawPath === '/api/observations/text' && method === 'POST';
  const mediaAdd = /^\/api\/observations\/([^/]+)\/media$/.exec(rawPath);
  const report = /^\/api\/reports\/child\/([^/]+)\/docx$/.exec(rawPath);
  if (rawPath === '/api/classes') return { action: 'classes', payload: {} };
  if (rawPath === '/api/teachers') return { action: 'teachers', payload: query };
  if (rawPath === '/api/children' && method === 'GET') return { action: 'children', payload: query };
  if (rawPath === '/api/children' && method === 'POST') return { action: 'createChild' };
  if (rawPath === '/api/guide/match') return { action: 'matchGuide' };
  if (rawPath === '/api/guide/summarize') return { action: 'summarize' };
  if (rawPath === '/api/observations' && method === 'GET') return { action: 'observations', payload: query };
  if (rawPath === '/api/reports/child/text') return { action: 'reportText' };
  if (textCreate) return { action: 'createObservation' };
  if (rawPath === '/api/observations/update' && method === 'POST') return { action: 'updateObservation' };
  if (mediaAdd) return { action: 'addMedia', payload: { observationId: mediaAdd[1] } };
  if (report) return { action: 'reportDocx', payload: { childId: report[1], ...query } };
  return null;
}

function request(path, method = 'GET', data) {
  const mapped = pathToAction(path, method);
  const payload = mapped ? { ...(mapped.payload || {}), ...(data || {}) } : null;
  if (!mapped) return Promise.reject(new Error('无对应接口'));
  const action = mapped.action;
  if (action === 'observations') {
    return Promise.all([
      callCloud(action, payload, 12000).catch(() => null),
      localStore.handle(action, payload),
    ]).then(([cloud, local]) => mergeRows(Array.isArray(cloud) ? cloud : null, local));
  }
  const timeout =
    action === 'createObservation' || action === 'addMedia' || action === 'updateObservation'
      ? 20000
      : action === 'matchGuide' || action === 'summarize'
        ? 22000
        : 12000;
  return callCloud(action, payload, timeout)
    .then((res) => {
      if (action === 'createObservation' || action === 'updateObservation') {
        localStore.upsertObservation(res);
      }
      return res;
    })
    .catch((cloudErr) =>
      localStore.handle(action, payload).catch(() => Promise.reject(cloudErr)),
    );
}

function persistFiles(files) {
  return Promise.all(
    (files || []).map((f, i) =>
      persistMediaFile(f.path, f.kind, i).then((path) => Object.assign({}, f, { path })),
    ),
  );
}

function persistMediaFile(filePath, kind, index) {
  const ext = kind === 'video' ? '.mp4' : kind === 'audio' ? '.mp3' : '.jpg';
  const dest = `${wx.env.USER_DATA_PATH}/obs-${Date.now()}-${index || 0}-${Math.random().toString(36).slice(2, 6)}${ext}`;
  return new Promise((resolve) => {
    const fs = wx.getFileSystemManager();
    fs.saveFile({
      tempFilePath: filePath,
      filePath: dest,
      success: (r) => resolve(r.savedFilePath || dest),
      fail: () => {
        fs.copyFile({
          srcPath: filePath,
          destPath: dest,
          success: () => resolve(dest),
          fail: () => resolve(filePath),
        });
      },
    });
  });
}

function extOf(filePath) {
  const m = /\.([a-z0-9]+)$/i.exec(filePath || '');
  return m ? `.${m[1].toLowerCase()}` : '';
}

function kindOf(filePath) {
  const ext = extOf(filePath);
  if (['.mp4', '.mov', '.m4v'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext)) return 'audio';
  return 'photo';
}

function saveMediaRecord(observationId, fileID, kind) {
  const payload = { observationId, fileID, path: fileID, kind };
  return callCloud('addMedia', payload, 8000)
    .then((res) => {
      localStore.handle('addMedia', payload).catch(() => {});
      return res;
    })
    .catch(() => localStore.handle('addMedia', payload).catch(() => null));
}

function uploadMedia(observationId, filePath) {
  const kind = kindOf(filePath);
  const saveLocal = () => saveMediaRecord(observationId, filePath, kind).catch(() => null);
  if (!wx.cloud) return saveLocal();
  const cloudPath = `obs/${observationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extOf(filePath) || (kind === 'video' ? '.mp4' : kind === 'audio' ? '.mp3' : '.jpg')}`;
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => saveLocal().then(finish), 15000);
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: (up) => {
        saveMediaRecord(observationId, up.fileID, kind)
          .then(finish)
          .catch(() => saveLocal().then(finish));
      },
      fail: () => saveLocal().then(finish),
    });
  });
}

function mediaUrl(filename) {
  if (!filename) return '';
  return filename;
}

function downloadReport(childId, name) {
  const session = wx.getStorageSync('session') || {};
  const kindergartenName = String(session.kindergartenName || '').trim() || '幼儿园';
  const { writeChildReport } = require('./makeReport');
  const q = [
    `childId=${encodeURIComponent(childId)}`,
    session.classId ? `classId=${encodeURIComponent(session.classId)}` : '',
    'limit=80',
  ]
    .filter(Boolean)
    .join('&');
  return request(`/api/observations?${q}`).then((rows) => {
    const list = rows || [];
    if (!list.length) return Promise.reject(new Error('还没有可导出的观察。先去记一条。'));
    const className = (list[0] && list[0].class_name) || session.className || '';
    const excerpts = list.slice(0, 12).map((o) => ({
      at: o.observed_at,
      text: (o.narrative || o.voice_transcript || '').slice(0, 160),
    }));
    return request('/api/guide/summarize', 'POST', {
      childName: name,
      className,
      observations: excerpts,
    })
      .catch(() => ({ interpret: '' }))
      .then((ai) =>
        writeChildReport({
          kindergartenName,
          childName: name,
          className,
          observations: list,
          aiSummary: (ai && ai.interpret) || '',
        }),
      );
  });
}

module.exports = { request, uploadMedia, mediaUrl, downloadReport, persistFiles };
