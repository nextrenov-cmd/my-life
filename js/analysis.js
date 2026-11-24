// 記録の集計と、ルールベースの分析・提案（端末内）
// 方針：一般的な知見(A)・本人の記録(B)・判断できない(C) を区別し、原因や将来の数値を断定しない。

import { toMin, fromMin, nightMin, tsToNightMin, addDaysYmd, daysBetween, dowOf, avg, round1, fmtDur, DOW, WEEK_ORDER, ymd, mondayOf, parseYmd } from './util.js';
import { ROUTINE_KB, GOAL_KB, CHECKUP_ALERT } from './knowledge.js';
import { activeRoutines, MARKER_CATS, hasRoom, isWorkday } from './planner.js';

const MIN_POINTS = 5; // 比較に必要な最低記録数
const RECENT_DAYS = 14;

export function indexEvents(events) {
  const byDate = new Map();
  for (const e of events) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  }
  for (const list of byDate.values()) list.sort((a, b) => a.ts - b.ts);
  return { events, byDate };
}
const on = (ix, date) => ix.byDate.get(date) || [];
const minuteOf = (ts) => {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
};

export function sleepSessions(ix) {
  const sw = ix.events.filter((e) => e.type === 'sleep' || e.type === 'wake').sort((a, b) => a.ts - b.ts);
  const out = [];
  for (let i = 0; i < sw.length - 1; i++) {
    const s = sw[i];
    const w = sw[i + 1];
    if (s.type !== 'sleep' || w.type !== 'wake') continue;
    const minutes = (w.ts - s.ts) / 60000;
    if (minutes >= 120 && minutes <= 16 * 60) out.push({ date: w.date, bedDate: s.date, minutes, bedNight: tsToNightMin(s.ts), wakeMin: minuteOf(w.ts) });
  }
  return out;
}

export const wakeOn = (ix, date) => on(ix, date).find((e) => e.type === 'wake');
export const sleepOn = (ix, date) => on(ix, date).find((e) => e.type === 'sleep');
export const reflectionOn = (ix, date) => on(ix, date).find((e) => e.type === 'reflection');

export function routineDoneOn(ix, r, date) {
  const list = on(ix, date);
  if (list.some((e) => e.type === 'routine_done' && e.data?.routineId === r.id)) return true;
  switch (r.cat) {
    case 'wake': {
      const w = list.find((e) => e.type === 'wake');
      return !!w && toMin(r.time) != null && minuteOf(w.ts) <= toMin(r.time) + 15;
    }
    case 'sleep': {
      const s = list.find((e) => e.type === 'sleep');
      return !!s && toMin(r.time) != null && tsToNightMin(s.ts) <= nightMin(toMin(r.time)) + 15;
    }
    case 'strength':
      return list.some((e) => e.type === 'workout_start' || e.type === 'workout_end');
    case 'journal':
      return list.some((e) => e.type === 'reflection');
    default:
      return false;
  }
}

export const routineSince = (plan, r) => (r.since && r.since > plan.startDate ? r.since : plan.startDate);

export function routineStats(plan, ix, r, today, windowDays = 28) {
  const since = routineSince(plan, r);
  const from = daysBetween(since, today) >= windowDays ? addDaysYmd(today, -(windowDays - 1)) : since;
  const byDow = {};
  WEEK_ORDER.forEach((d) => (byDow[d] = { s: 0, d: 0 }));
  const offDone = {};
  let scheduled = 0;
  let doneAll = 0;
  let doneSched = 0;
  let minutes = 0;
  const days = daysBetween(from, today) + 1;
  for (let i = 0; i < days; i++) {
    const date = addDaysYmd(from, i);
    const dow = dowOf(date);
    const sched = r.days?.includes(dow);
    const ok = routineDoneOn(ix, r, date);
    if (ok) {
      doneAll++;
      const ev = on(ix, date).find((e) => e.type === 'routine_done' && e.data?.routineId === r.id);
      minutes += +(ev?.data?.minutes ?? r.duration ?? 0) || 0;
    }
    // 今日はまだ終わっていないので、未実施なら予定数に含めない
    if (sched && !(date === today && !ok)) {
      scheduled++;
      byDow[dow].s++;
      if (ok) {
        doneSched++;
        byDow[dow].d++;
      }
    } else if (!sched && ok) offDone[dow] = (offDone[dow] || 0) + 1;
  }
  const rate = scheduled ? Math.min(1, doneAll / scheduled) : null;
  return { from, days, scheduled, doneAll, doneSched, rate, byDow, offDone, minutes };
}

export function paceText(done, target) {
  if (!target) return '';
  const r = done / target;
  if (r >= 1) return '目標どおりのペースです。';
  if (r >= 0.85) return '目標に近いペースです。';
  if (r >= 0.5) return '目標の半分以上を実施できています。';
  if (r > 0) return '目標より少なめのペースです。曜日や時間を見直すと続けやすくなるかもしれません。';
  return 'まだ実施の記録はありません。最初の1回を小さく始めてみましょう。';
}

export function metricSeries(ix, key, fromDate, toDate) {
  const out = [];
  for (const e of ix.events) {
    if (e.type !== 'reflection') continue;
    if (fromDate && e.date < fromDate) continue;
    if (toDate && e.date > toDate) continue;
    const v = e.data?.[key];
    if (v !== '' && v != null && !Number.isNaN(+v)) out.push({ date: e.date, v: +v });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export const METRIC_LABEL = { fatigue: '疲労度', sleepiness: '午後の眠気', mood: '気分', weight: '体重' };

// 初回設定時の値（ベースライン）と直近の記録を比較
export function compareBaseline(plan, ix, key, today) {
  const raw = plan.baseline?.[key] ?? plan.profile?.[key];
  const base = raw === '' || raw == null ? null : +raw;
  const recent = metricSeries(ix, key, addDaysYmd(today, -(RECENT_DAYS - 1)), today);
  if (recent.length < MIN_POINTS) return { status: 'insufficient', n: recent.length, base };
  const ra = avg(recent.map((x) => x.v));
  if (base == null || Number.isNaN(base)) {
    // 初回値がない場合は、記録の前半と後半で比較
    const all = metricSeries(ix, key);
    if (all.length < MIN_POINTS * 2) return { status: 'nobase', recentAvg: round1(ra), n: recent.length };
    const first = avg(all.slice(0, MIN_POINTS).map((x) => x.v));
    return { status: 'ok', base: round1(first), baseLabel: '記録を始めた頃', recentAvg: round1(ra), diff: round1(ra - first), n: recent.length };
  }
  return { status: 'ok', base, baseLabel: '初回設定時', recentAvg: round1(ra), diff: round1(ra - base), n: recent.length };
}

export function sleepSummary(ix, today) {
  const ss = sleepSessions(ix);
  const recent = ss.filter((s) => s.date > addDaysYmd(today, -RECENT_DAYS) && s.date <= today);
  if (recent.length < MIN_POINTS) return { status: 'insufficient', n: recent.length };
  const ra = avg(recent.map((s) => s.minutes));
  const res = { status: 'ok', n: recent.length, recentAvg: ra, avgBed: avg(recent.map((s) => s.bedNight)), avgWake: avg(recent.map((s) => s.wakeMin)) };
  const early = ss.slice(0, 7);
  if (ss.length >= recent.length + 7 && early.length === 7) res.earlyAvg = avg(early.map((s) => s.minutes));
  return res;
}

export function strengthProgress(ix) {
  const by = {};
  for (const e of [...ix.events].sort((a, b) => a.ts - b.ts)) {
    if (e.type !== 'workout_end' || !Array.isArray(e.data?.sets)) continue;
    for (const s of e.data.sets) {
      const name = (s.name || '').trim();
      const w = +s.weight;
      if (!name || !w) continue;
      by[name] = by[name] || { first: w, last: w, sessions: 0 };
      by[name].last = w;
      by[name].sessions++;
    }
  }
  const names = Object.keys(by);
  return { names, improved: names.filter((n) => by[n].sessions >= 2 && by[n].last > by[n].first), by };
}

// 確認ポイント（1週間・1か月・3か月）
export function checkpointStage(startDate, today) {
  const n = daysBetween(startDate, today);
  const pts = [
    { key: 'w1', label: '1週間', date: addDaysYmd(startDate, 7) },
    { key: 'm1', label: '1か月', date: addDaysYmd(startDate, 30) },
    { key: 'm3', label: '3か月', date: addDaysYmd(startDate, 90) },
  ];
  const current = n < 7 ? 'w1' : n < 30 ? 'm1' : n < 90 ? 'm3' : 'done';
  return { day: n + 1, pts, current };
}

// ルーティン1件の「実際の記録による変化」と「次に改善すること」
export function routineInsight(plan, ix, r, today) {
  const kb = ROUTINE_KB[r.cat] || ROUTINE_KB.custom;
  const st = routineStats(plan, ix, r, today);
  const actual = [];
  let next = '';
  const weeks = round1(st.days / 7);
  const periodLabel = st.days >= 28 ? '4週間' : `${st.days}日間`;

  let status;
  if (st.scheduled === 0 && st.doneAll === 0) status = { evidence: 'C', text: '予定日がまだ来ていないため、達成状況は判断できません。' };
  else
    status = {
      evidence: 'B',
      text: `${periodLabel}で${st.doneAll}回実施しています（予定${st.scheduled}回）。${paceText(st.doneAll, st.scheduled)}`,
    };

  if (st.days < 7) actual.push({ evidence: 'C', text: `記録開始から${st.days}日目です。変化を比較するには、もう少し記録が必要です。` });

  switch (r.cat) {
    case 'strength': {
      const p = strengthProgress(ix);
      if (p.improved.length) actual.push({ evidence: 'B', text: `前回より重量が上がっている種目があります（${p.improved.slice(0, 3).join('、')}）。` });
      else if (p.names.length) actual.push({ evidence: 'B', text: `記録している種目：${p.names.slice(0, 4).join('、')}。重量の変化はまだ見られないか、比較できる回数が足りません。` });
      else actual.push({ evidence: 'C', text: '重量の記録がないため、重量の変化は判断できません（「終了」後に任意で記録できます）。' });
      next = st.rate != null && st.rate >= 0.9 && st.scheduled >= 6 ? '安定して続けられています。フォームを保てる範囲で、重量か回数を少しずつ上げることを検討しましょう。' : '';
      break;
    }
    case 'sleep':
    case 'wake': {
      const s = sleepSummary(ix, today);
      if (s.status === 'ok') {
        actual.push({ evidence: 'B', text: `直近${RECENT_DAYS}日の平均睡眠時間は約${fmtDur(s.recentAvg)}、平均の起床は${fromMin(s.avgWake)}ごろです（${s.n}日分）。` });
        if (s.earlyAvg != null) {
          const d = s.recentAvg - s.earlyAvg;
          actual.push({ evidence: 'B', text: Math.abs(d) < 15 ? `記録を始めた頃（約${fmtDur(s.earlyAvg)}）とほぼ同じです。` : `記録を始めた頃（約${fmtDur(s.earlyAvg)}）より${d > 0 ? '長く' : '短く'}なっています。` });
        }
        if (r.cat === 'sleep' && toMin(r.time) != null && s.avgBed > nightMin(toMin(r.time)) + 30) next = `平均の就寝が${fromMin(s.avgBed)}ごろで、目標より遅めです。夜の予定を少し早めに切り上げる工夫を検討しましょう。`;
      } else actual.push({ evidence: 'C', text: `「寝る」「起きた」の記録が${s.n}日分のため、睡眠時間の傾向はまだ判断できません（${MIN_POINTS}日分から表示します）。` });
      break;
    }
    case 'meal': {
      const c = compareBaseline(plan, ix, 'sleepiness', today);
      actual.push(baselineLine(c, 'sleepiness', ['食事']));
      break;
    }
    case 'journal': {
      const n = ix.events.filter((e) => e.type === 'reflection' && e.date >= st.from).length;
      actual.push({ evidence: 'B', text: `${periodLabel}で${n}日、感想を記録しています。` });
      break;
    }
    default:
      if (st.minutes) actual.push({ evidence: 'B', text: `${periodLabel}の合計は約${fmtDur(st.minutes)}です。` });
  }

  if (!next) next = nextStep(st, r, kb);
  return { kb, stats: st, status, actual, next, weeks };
}

function worstDow(st) {
  let w = null;
  for (const d of WEEK_ORDER) {
    const x = st.byDow[d];
    if (x.s >= 2 && x.d === 0) w = d;
  }
  return w;
}

function nextStep(st, r, kb) {
  if (st.scheduled === 0) return kb.tips[0] || '予定日になったら、ワンタップで記録してみましょう。';
  const wd = worstDow(st);
  if (wd != null) return `${DOW[wd]}曜日は実施が難しいようです。振り返り画面で曜日の変更を検討できます。`;
  if (st.rate < 0.5) return '予定の回数を少し減らすか、所要時間を短くすると続けやすくなるかもしれません。';
  if (st.rate >= 0.9) return '安定して続けられています。この調子で記録を続けましょう。';
  return kb.tips[0] || '記録を続けて、変化を確認しましょう。';
}

function baselineLine(c, key, causes) {
  const label = METRIC_LABEL[key];
  if (c.status === 'insufficient') return { evidence: 'C', text: `直近${RECENT_DAYS}日の${label}の記録が${c.n}件のため、比較はまだできません（${MIN_POINTS}件から比較します）。` };
  if (c.status === 'nobase') return { evidence: 'B', text: `直近の${label}の平均は${c.recentAvg}/10です。比較できる初回の値がないため、変化はまだ判断できません。` };
  const lowerBetter = key === 'fatigue' || key === 'sleepiness';
  const head = `${c.baseLabel}の${label}：${c.base}${key === 'weight' ? 'kg' : '/10'}、最近の平均：${c.recentAvg}${key === 'weight' ? 'kg' : '/10'}。`;
  if (key === 'weight') return { evidence: 'B', text: `${head}体重は水分などでも日々変動するため、長めの期間で確認しましょう。` };
  if (Math.abs(c.diff) < 1) return { evidence: 'B', text: `${head}記録上、大きな変化はまだ見られません。` };
  const better = lowerBetter ? c.diff < 0 : c.diff > 0;
  const causeText = causes?.length ? `${causes.join('や')}の変更が関係している可能性がありますが、原因は断定できません。` : '原因は断定できません。';
  return {
    evidence: 'B',
    text: better ? `${head}記録上、${label}が以前より${lowerBetter ? '軽く' : '良く'}なっています。${causeText}` : `${head}記録上、${label}が以前より${lowerBetter ? '強く' : '低く'}なっています。忙しさや体調など、さまざまな要因が考えられます。`,
  };
}

export function linkedRoutines(plan, goal) {
  const rs = activeRoutines(plan);
  const linked = rs.filter((r) => r.goalIds?.includes(goal.id));
  if (linked.length) return linked;
  const sug = GOAL_KB[goal.cat]?.suggest || [];
  return rs.filter((r) => sug.includes(r.cat));
}

// 目標1件の未来予測画面用データ
export function goalInsight(plan, ix, goal, today) {
  const g = GOAL_KB[goal.cat] || GOAL_KB.custom;
  const rs = linkedRoutines(plan, goal);
  const ins = rs.map((r) => ({ r, ...routineInsight(plan, ix, r, today) }));
  const causes = [...new Set(rs.map((r) => (ROUTINE_KB[r.cat] || ROUTINE_KB.custom).label))];
  const actual = [];
  let now;

  const totalS = ins.reduce((s, x) => s + x.stats.scheduled, 0);
  const totalD = ins.reduce((s, x) => s + Math.min(x.stats.doneAll, x.stats.scheduled || x.stats.doneAll), 0);

  if (['fatigue', 'sleepiness', 'weight'].includes(g.metric)) {
    const c = compareBaseline(plan, ix, g.metric, today);
    actual.push(baselineLine(c, g.metric, causes));
  } else if (g.metric === 'sleepHours') {
    const s = sleepSummary(ix, today);
    actual.push(
      s.status === 'ok'
        ? { evidence: 'B', text: `直近の平均：就寝${fromMin(s.avgBed)}ごろ・起床${fromMin(s.avgWake)}ごろ・睡眠約${fmtDur(s.recentAvg)}（${s.n}日分）。` }
        : { evidence: 'C', text: `睡眠の記録が${s.n}日分のため、まだ傾向は判断できません。` }
    );
  } else if (g.metric === 'workouts') {
    const p = strengthProgress(ix);
    if (p.improved.length) actual.push({ evidence: 'B', text: `重量が上がっている種目：${p.improved.slice(0, 3).join('、')}。` });
  }

  if (!rs.length) now = { evidence: 'C', text: 'この目標につながるルーティンがまだ登録されていません。設定の見直しから追加できます。' };
  else if (!totalS) now = { evidence: 'C', text: '予定日がまだ来ていないため、達成状況は判断できません。' };
  else now = { evidence: 'B', text: `関連するルーティンの実施：${totalD}回／予定${totalS}回（${Math.round((totalD / totalS) * 100)}%）。` };

  const nexts = ins.map((x) => x.next).filter(Boolean);
  return { g, routines: ins, now, actual, next: nexts[0] || '関連するルーティンを1つ選んで、まずは記録を続けましょう。', causes };
}

// 今日の重要なアドバイスを1つだけ選ぶ
export function dailyAdvice({ plan, ix, checkups, settings }, today) {
  const latest = [...(checkups || [])].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (latest && CHECKUP_ALERT.includes(latest.judgement) && settings?.checkupAck !== latest.id)
    return { kind: 'medical', text: `健康診断で「${latest.judgement}」の判定があります。医療機関の指示を優先してください。受診の予定は決まっていますか？`, action: 'ackCheckup', actionLabel: '受診済み・予定あり' };

  const rs = activeRoutines(plan);
  const dow = dowOf(today);
  const lastNight = sleepSessions(ix).find((s) => s.date === today);
  if (lastNight && lastNight.minutes < 360)
    return { kind: 'sleep', text: `昨夜の睡眠は約${fmtDur(lastNight.minutes)}でした。今夜は少し早めに休む準備を始めると良さそうです。` };

  const st = rs.find((r) => r.cat === 'strength' && r.days?.includes(dow));
  if (st && !routineDoneOn(ix, st, today)) return { kind: 'strength', text: `今日は「${st.text}」の予定日です。始めるときは「開始」をタップするだけでOKです。` };

  const meal = rs.find((r) => r.cat === 'meal' && r.days?.includes(dow));
  if (meal && !routineDoneOn(ix, meal, today) && new Date().getHours() < 14) return { kind: 'meal', text: `今日の食事：「${meal.text}」。食後の眠気を感想に残すと、変化が分かりやすくなります。` };

  const todays = rs.filter((r) => !MARKER_CATS.has(r.cat) && r.days?.includes(dow) && !routineDoneOn(ix, r, today));
  if (todays.length) {
    const r = todays[0];
    const kb = ROUTINE_KB[r.cat] || ROUTINE_KB.custom;
    const tip = kb.tips[daysBetween(plan.startDate, today) % kb.tips.length] || '';
    return { kind: 'routine', text: `${r.time ? r.time + ' ' : ''}「${r.text}」。${tip}` };
  }
  if (!reflectionOn(ix, today)) return { kind: 'reflect', text: '今日の感想を一言だけでも残すと、振り返りが具体的になります。' };
  return { kind: 'rest', text: '今日の記録はばっちりです。ゆっくり休みましょう。' };
}

// 週次の振り返りと翌週の提案（承認されるまで確定しない）
export function weeklyProposals(plan, ix, today) {
  const out = [];
  if (daysBetween(plan.startDate, today) < 7) return out;
  const rs = activeRoutines(plan);

  for (const r of rs) {
    if (MARKER_CATS.has(r.cat) || !r.days?.length || r.days.length >= 7) continue;
    const st = routineStats(plan, ix, r, today);
    const bad = WEEK_ORDER.find((d) => r.days.includes(d) && st.byDow[d].s >= 2 && st.byDow[d].d === 0);
    if (bad == null) continue;
    const taken = new Set(r.days);
    const cands = WEEK_ORDER.filter((d) => !taken.has(d) && hasRoom(plan, r, d))
      .filter((d) => r.cat !== 'strength' || !(taken.has((d + 1) % 7) && (d + 1) % 7 !== bad) && !(taken.has((d + 6) % 7) && (d + 6) % 7 !== bad))
      .sort((a, b) => (st.offDone[b] || 0) - (st.offDone[a] || 0) || (isWorkday(plan, a) ? 1 : 0) - (isWorkday(plan, b) ? 1 : 0));
    if (!cands.length) continue;
    const to = cands[0];
    const newDays = r.days.filter((d) => d !== bad).concat(to);
    out.push({
      id: `move-${r.id}-${bad}-${to}`,
      text: `「${r.text}」を${DOW[bad]}曜日に実施できない日が続いています。${DOW[to]}曜日に変更してみませんか？（変更後：${WEEK_ORDER.filter((d) => newDays.includes(d)).map((d) => DOW[d]).join('・')}）`,
      change: { type: 'setDays', routineId: r.id, days: newDays },
    });
    if (out.length >= 2) break;
  }

  const sleepR = rs.find((r) => r.cat === 'sleep');
  const target = nightMin(toMin(sleepR?.time || plan.profile?.bed));
  const week = sleepSessions(ix).filter((s) => s.bedDate > addDaysYmd(today, -8));
  if (target != null) {
    const late = week.filter((s) => s.bedNight > target + 30);
    if (late.length >= 3)
      out.push({
        id: `bed-${ymd(mondayOf(parseYmd(today)))}`,
        text: `最近は${fromMin(target + 30)}以降の就寝が増えています（直近${late.length}日）。夜の自由時間を少し早めに切り上げる案があります。`,
        change: { type: 'note', note: '夜の自由時間を早めに切り上げる' },
      });
  }

  const c = compareBaseline(plan, ix, 'sleepiness', today);
  if (c.status === 'ok' && c.diff <= -1)
    out.push({
      id: `slp-${ymd(mondayOf(parseYmd(today)))}`,
      text: '昼食後の眠気が軽くなっています。現在の食事・睡眠の記録を継続して確認しましょう。',
      change: { type: 'note', note: '現在の取り組みを継続' },
    });

  for (const r of rs) {
    if (MARKER_CATS.has(r.cat) || (r.days?.length || 0) < 3) continue;
    const st = routineStats(plan, ix, r, today);
    if (st.days >= 14 && st.scheduled >= 6 && st.rate < 0.4) {
      const ranked = [...r.days].sort((a, b) => st.byDow[a].d / (st.byDow[a].s || 1) - st.byDow[b].d / (st.byDow[b].s || 1));
      const drop = ranked[0];
      out.push({
        id: `less-${r.id}-${drop}`,
        text: `「${r.text}」は予定より少なめのペースです。無理なく続けられるよう、${DOW[drop]}曜日を外して週${r.days.length - 1}回にしてみませんか？`,
        change: { type: 'setDays', routineId: r.id, days: r.days.filter((d) => d !== drop) },
      });
      break;
    }
  }
  return out.slice(0, 3);
}

export function weekSummary(plan, ix, today) {
  const from = addDaysYmd(today, -6);
  const rs = activeRoutines(plan);
  return rs.map((r) => {
    let s = 0;
    let d = 0;
    for (let i = 0; i < 7; i++) {
      const date = addDaysYmd(from, i);
      if (date < routineSince(plan, r)) continue;
      const sched = r.days?.includes(dowOf(date));
      const ok = routineDoneOn(ix, r, date);
      if (sched && !(date === today && !ok)) s++;
      if (ok) d++;
    }
    return { r, s, d };
  });
}
