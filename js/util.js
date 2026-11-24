// 汎用ユーティリティ（DOM非依存の部分はテスト可能）

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const pad = (n) => String(n).padStart(2, '0');
export const clone = (o) => JSON.parse(JSON.stringify(o));

export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const addDaysYmd = (s, n) => ymd(addDays(parseYmd(s), n));
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
export const dowOf = (s) => parseYmd(s).getDay();

// 1日の区切りは午前4時（深夜0時過ぎの「寝る」を前日として扱う）
export const DAY_BOUNDARY_H = 4;
export const dayKey = (ts = Date.now()) => ymd(new Date(ts - DAY_BOUNDARY_H * 3600000));

export const toMin = (hhmm) => {
  if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};
export const fromMin = (m) => {
  m = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};
export const tsToHHMM = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
// 就寝時刻を比較用の分に。正午より前は翌日扱いで+1440（例: 0:30 → 1470）
export const nightMin = (m) => (m == null ? null : m < 12 * 60 ? m + 1440 : m);
export const tsToNightMin = (ts) => {
  const d = new Date(ts);
  return nightMin(d.getHours() * 60 + d.getMinutes());
};

export const DOW = ['日', '月', '火', '水', '木', '金', '土'];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 月曜はじまり

export const mondayOf = (d) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(x, -((x.getDay() + 6) % 7));
};

export const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
export const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const fmtDur = (min) => {
  if (min == null) return '—';
  min = Math.round(min);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}分`;
  return m ? `${h}時間${m}分` : `${h}時間`;
};

export const fmtDate = (s) => {
  const d = parseYmd(s);
  return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`;
};

export const daysLabel = (days) => {
  if (!days || !days.length) return '曜日未定';
  if (days.length === 7) return '毎日';
  const set = new Set(days);
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return '平日';
  if (days.length === 2 && set.has(0) && set.has(6)) return '土日';
  return WEEK_ORDER.filter((d) => set.has(d)).map((d) => DOW[d]).join('・');
};
