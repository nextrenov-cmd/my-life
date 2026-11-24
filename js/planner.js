// 週間プランの作成（ルールベース・端末内）
// 固定予定（仕事・食事・その他）を優先し、その空き時間にルーティンを配置する。

import { toMin, fromMin, nightMin, WEEK_ORDER, DOW, clone, clamp } from './util.js';
import { ROUTINE_KB } from './knowledge.js';

const MEAL_LEN = 30;
export const MARKER_CATS = new Set(['wake', 'sleep']);
// 重なっても問題ない組み合わせ（例：仕事中の集中タイム、食事中の家族時間）
const OVERLAP_OK = { work_focus: ['work'], meal: ['meal', 'work'], family: ['meal'] };

export const activeRoutines = (plan) => (plan.routines || []).filter((r) => r.active !== false);
const prof = (plan) => plan.profile || {};

export function wakeFor(plan, dow) {
  let w = toMin(prof(plan).wake);
  for (const r of activeRoutines(plan)) if (r.cat === 'wake' && r.time && r.days?.includes(dow)) w = toMin(r.time);
  return w ?? 390;
}
export function bedFor(plan, dow) {
  let b = toMin(prof(plan).bed);
  for (const r of activeRoutines(plan)) if (r.cat === 'sleep' && r.time && r.days?.includes(dow)) b = toMin(r.time);
  return nightMin(b ?? 1380);
}
export const sleepMinutes = (plan, dow) => wakeFor(plan, (dow + 1) % 7) + 1440 - bedFor(plan, dow);

export const isWorkday = (plan, dow) => {
  const w = prof(plan).work || {};
  return !!(w.days?.includes(dow) && toMin(w.start) != null && toMin(w.end) != null);
};

export function busyBlocks(plan, dow) {
  const out = [];
  const p = prof(plan);
  const w = p.work || {};
  if (isWorkday(plan, dow)) {
    const s = toMin(w.start);
    let e = toMin(w.end);
    if (e <= s) e += 1440;
    out.push({ start: s, end: e, label: '仕事', kind: 'work' });
  }
  const meals = p.meals || {};
  [['breakfast', '朝食'], ['lunch', '昼食'], ['dinner', '夕食']].forEach(([k, label]) => {
    const t = toMin(meals[k]);
    if (t != null) out.push({ start: t, end: t + MEAL_LEN, label, kind: 'meal' });
  });
  (plan.fixed || []).forEach((f) => {
    if (!f.days?.includes(dow)) return;
    const s = toMin(f.start);
    let e = toMin(f.end);
    if (s == null) return;
    if (e == null) e = s + 60;
    if (e <= s) e += 1440;
    out.push({ start: s, end: e, label: f.label || '固定予定', kind: 'fixed', ref: f.id });
  });
  return out;
}

function absStart(time, wake) {
  const t = toMin(time);
  if (t == null) return null;
  return t < wake - 180 ? t + 1440 : t;
}

export function routineBlocks(plan, dow, exceptId) {
  const wake = wakeFor(plan, dow);
  return activeRoutines(plan)
    .filter((r) => r.id !== exceptId && !MARKER_CATS.has(r.cat) && r.days?.includes(dow) && r.time)
    .map((r) => {
      const s = absStart(r.time, wake);
      return { start: s, end: s + (+r.duration || 0), label: r.text, kind: 'routine', cat: r.cat, ref: r.id };
    });
}

export function gaps(start, end, blocks) {
  const segs = blocks
    .filter((b) => b.end > b.start)
    .map((b) => [Math.max(b.start, start), Math.min(b.end, end)])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  const out = [];
  let cur = start;
  for (const [a, b] of segs) {
    if (a > cur) out.push([cur, a]);
    cur = Math.max(cur, b);
  }
  if (end > cur) out.push([cur, end]);
  return out;
}

const overlaps = (a, b) => a.start < b.end && b.start < a.end;

function fits(plan, r, dow, start) {
  const dur = +r.duration || 0;
  const wake = wakeFor(plan, dow);
  const bed = bedFor(plan, dow);
  const blk = { start, end: start + Math.max(dur, 1) };
  if (blk.start < wake || blk.end > bed) return false;
  const ok = OVERLAP_OK[r.cat] || [];
  if (busyBlocks(plan, dow).some((b) => !ok.includes(b.kind) && overlaps(b, blk))) return false;
  if (dur > 0 && routineBlocks(plan, dow, r.id).some((b) => b.end > b.start && overlaps(b, blk))) return false;
  return true;
}

function prefTime(plan, r, dow) {
  const p = prof(plan);
  const w = p.work || {};
  const work = isWorkday(plan, dow);
  const wake = wakeFor(plan, dow);
  const bed = bedFor(plan, dow);
  const dinner = toMin(p.meals?.dinner);
  const lunch = toMin(p.meals?.lunch);
  const afterWork = work ? toMin(w.end) + 30 : null;
  const dur = +r.duration || 0;
  switch (r.cat) {
    case 'strength':
      return work ? afterWork : 600;
    case 'cardio':
      return wake + 30;
    case 'reading':
      return bed - dur - 30;
    case 'journal':
      return bed - dur - 10;
    case 'study':
      return work ? (dinner != null ? dinner + 60 : afterWork + 60) : 540;
    case 'sauna':
      return work ? afterWork + 60 : 900;
    case 'family':
      return work ? dinner ?? 1140 : 840;
    case 'work_focus':
      return work ? toMin(w.start) : wake + 60;
    case 'meal':
      return lunch ?? 720;
    default:
      return work ? (dinner != null ? dinner + 45 : afterWork + 30) : 600;
  }
}

function candidates(pref) {
  const out = [pref];
  for (let k = 15; k <= 8 * 60; k += 15) out.push(pref + k, pref - k);
  return out.map((m) => Math.round(m / 5) * 5);
}

function pickTime(plan, r) {
  const days = r.days?.length ? r.days : [1];
  // 予定曜日のうち多数派（勤務日/休日）を基準に希望時刻を決める
  const workCount = days.filter((d) => isWorkday(plan, d)).length;
  const base = days.find((d) => isWorkday(plan, d) === workCount * 2 >= days.length) ?? days[0];
  let best = null;
  let bestScore = -1;
  for (const t of candidates(prefTime(plan, r, base))) {
    const score = days.filter((d) => fits(plan, r, d, t)).length;
    if (score > bestScore) {
      best = t;
      bestScore = score;
      if (score === days.length) break;
    }
  }
  return fromMin(best ?? prefTime(plan, r, base));
}

function spread(freq, offset) {
  const pos = [];
  for (let i = 0; i < freq; i++) pos.push(Math.round((i * 7) / freq));
  return pos.map((p) => WEEK_ORDER[(p + offset) % 7]);
}

export function hasRoom(plan, r, dow) {
  const dur = +r.duration || 0;
  if (r.time) return fits(plan, r, dow, absStart(r.time, wakeFor(plan, dow)));
  const g = gaps(wakeFor(plan, dow), bedFor(plan, dow), [...busyBlocks(plan, dow), ...routineBlocks(plan, dow, r.id)]);
  return g.some(([a, b]) => b - a >= dur + 15);
}

function pickDays(plan, r) {
  const freq = clamp(+r.freq || 3, 1, 7);
  if (freq >= 7) return [0, 1, 2, 3, 4, 5, 6];
  const workDays = (prof(plan).work?.days || []).slice();
  if (['meal', 'work_focus'].includes(r.cat) && workDays.length && freq === workDays.length) return workDays;
  if (r.cat === 'family' && freq <= 2) return freq === 2 ? [6, 0] : [0];
  let best = null;
  let bestScore = -1;
  for (let off = 0; off < 7; off++) {
    const ds = spread(freq, off);
    let score = ds.filter((d) => hasRoom(plan, r, d)).length * 10;
    // 休日がある人は、時間のかかる運動を休日に寄せすぎない程度に評価
    if (r.cat === 'sauna') score += ds.filter((d) => !isWorkday(plan, d)).length;
    if (score > bestScore) {
      best = ds;
      bestScore = score;
    }
  }
  return best;
}

// 曜日・時刻が未設定のルーティンを自動配置する（設定済みの項目は変更しない）
export function autoPlace(plan, goalImportance = {}) {
  const work = clone(plan);
  const p = prof(work);
  const prio = (r) => Math.max(0, ...(r.goalIds || []).map((g) => goalImportance[g] || 0));
  const order = [...activeRoutines(work)].sort((a, b) => prio(b) - prio(a));
  for (const r of order) {
    if (MARKER_CATS.has(r.cat)) {
      if (!r.days?.length) {
        r.days = [0, 1, 2, 3, 4, 5, 6];
        r.autoDays = true;
      }
      if (!r.time) {
        r.time = r.cat === 'wake' ? p.wake || '06:30' : p.bed || '23:00';
        r.autoTime = true;
      }
      continue;
    }
    if (!r.days?.length) {
      r.days = pickDays(work, r);
      r.autoDays = true;
    }
    if (!r.time) {
      r.time = pickTime(work, r);
      r.autoTime = true;
    }
  }
  return work.routines;
}

export function buildWeek(plan) {
  const days = WEEK_ORDER.map((dow) => {
    const wake = wakeFor(plan, dow);
    const bed = bedFor(plan, dow);
    const busy = busyBlocks(plan, dow);
    const rb = routineBlocks(plan, dow);
    const g = gaps(wake, bed, [...busy, ...rb]);
    const free = g.reduce((s, [a, b]) => s + (b - a), 0);
    const routineMin = rb.reduce((s, b) => s + (b.end - b.start), 0);
    const blocks = [
      { start: wake, end: wake, label: '起床', kind: 'wake' },
      ...busy,
      ...rb,
      ...g.filter(([a, b]) => b - a >= 30).map(([a, b]) => ({ start: a, end: b, label: '自由時間', kind: 'free' })),
      { start: bed, end: bed, label: '就寝', kind: 'sleep' },
    ].sort((a, b) => a.start - b.start || (a.kind === 'wake' ? -1 : 1));
    return { dow, wake, bed, blocks, free, routineMin, sleepMin: sleepMinutes(plan, dow) };
  });
  return { days, warnings: feasibility(plan, days) };
}

export function feasibility(plan, days) {
  const W = [];
  const rs = activeRoutines(plan);

  const shortSleep = days.filter((d) => d.sleepMin < 360);
  if (shortSleep.length)
    W.push({
      level: 'warn',
      text: `睡眠時間が6時間未満になる日があります（${shortSleep.map((d) => DOW[d.dow]).join('・')}）。睡眠ガイドでは成人はおおむね6時間以上が目安とされています。就寝または起床時刻の見直しをおすすめします。`,
    });

  const conflicts = new Set();
  const outside = new Set();
  for (const d of days) {
    const busy = busyBlocks(plan, d.dow);
    const rb = routineBlocks(plan, d.dow);
    for (const b of rb) {
      const r = rs.find((x) => x.id === b.ref);
      const ok = OVERLAP_OK[r?.cat] || [];
      if (b.end > b.start) {
        busy.filter((x) => !ok.includes(x.kind) && overlaps(x, b)).forEach((x) => conflicts.add(`「${b.label}」と${x.label}（${DOW[d.dow]}）`));
        rb.filter((x) => x.ref !== b.ref && x.end > x.start && overlaps(x, b) && x.ref > b.ref).forEach((x) => conflicts.add(`「${b.label}」と「${x.label}」（${DOW[d.dow]}）`));
      }
      if (b.start < d.wake || b.end > d.bed) outside.add(`「${b.label}」（${DOW[d.dow]}）`);
    }
  }
  if (conflicts.size) W.push({ level: 'warn', text: `時間が重なっている予定があります：${[...conflicts].slice(0, 4).join('、')}${conflicts.size > 4 ? ' など' : ''}` });
  if (outside.size) W.push({ level: 'warn', text: `起床前または就寝後に入っている予定があります：${[...outside].slice(0, 3).join('、')}` });

  const tight = days.filter((d) => d.routineMin > 0 && d.free < 30);
  if (tight.length)
    W.push({ level: 'warn', text: `${tight.map((d) => DOW[d.dow]).join('・')}曜日は自由時間がほとんど残りません。予定の詰め込みすぎに注意しましょう。` });

  const habits = rs.filter((r) => !MARKER_CATS.has(r.cat));
  if (habits.length > 5)
    W.push({
      level: 'info',
      text: `新しく始める習慣が${habits.length}個あります。一度に多く始めると続けにくくなる傾向があるため、重要度の高いものから2〜3個で始め、慣れてから追加する方法もあります。`,
    });

  const st = rs.filter((r) => r.cat === 'strength');
  const stDays = new Set(st.flatMap((r) => r.days || []));
  const consecutive = WEEK_ORDER.filter((d) => stDays.has(d) && stDays.has((d + 1) % 7));
  if (consecutive.length && stDays.size < 6)
    W.push({ level: 'info', text: '筋トレが連続する曜日があります。同じ部位を続けて強く鍛える場合は、回復の日を挟むのが一般的です（部位を分ける場合は問題ありません）。' });

  const unplaced = rs.filter((r) => !MARKER_CATS.has(r.cat) && (!r.days?.length || !r.time));
  if (unplaced.length) W.push({ level: 'info', text: `曜日や時刻が未定のルーティンが${unplaced.length}件あります。` });

  return W;
}

export const kindLabel = (b) => {
  if (b.kind === 'routine') return ROUTINE_KB[b.cat]?.label || '習慣';
  return { work: '仕事', meal: '食事', fixed: '固定予定', free: '自由時間', wake: '起床', sleep: '就寝' }[b.kind] || '';
};
