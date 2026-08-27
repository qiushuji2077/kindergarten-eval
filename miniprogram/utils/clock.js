function pad(n) {
  return String(n).padStart(2, '0');
}

function clockLabel(d = new Date()) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoLocal(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function clockLabelFromIso(iso) {
  const m = String(iso || '').match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return clockLabel();
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日 ${m[4]}:${m[5]}`;
}

module.exports = { clockLabel, clockLabelFromIso, isoLocal };
