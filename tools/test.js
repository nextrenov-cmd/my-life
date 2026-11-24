// ロジックの自己テスト（DOM非依存部分）。npm test
import assert from 'node:assert/strict';
import { parseRoutineText, detectGoalCat, detectRoutineCat, ROUTINE_KB } from '../js/knowledge.js';
import { autoPlace, buildWeek } from '../js/planner.js';
import { indexEvents, routineStats, routineInsight, goalInsight, compareBaseline, weeklyProposals, dailyAdvice, sleepSessions } from '../js/analysis.js';
import { addDaysYmd, dowOf, parseYmd } from '../js/util.js';

let n = 0;
const t = (name, fn) => {
  fn();
  n++;
  console.log('ok -', name);
};

t('文章からルーティンを読み取る', () => {
  assert.deepEqual(parseRoutineText('毎朝5:30に起きたい'), { cat: 'wake', time: '05:30', freq: 7, days: [0, 1, 2, 3, 4, 5, 6] });
  const a = parseRoutineText('週2回筋トレしたい');
  assert.equal(a.cat, 'strength');
  assert.equal(a.freq, 2);
  assert.equal(parseRoutineText('毎日30分読書したい').duration, 30);
  assert.equal(parseRoutineText('毎日30分読書したい').cat, 'reading');
  assert.equal(parseRoutineText('毎晩今日の感想を書きたい').cat, 'journal');
  const b = parseRoutineText('22時30分から20分ストレッチ');
  assert.equal(b.time, '22:30');
  assert.equal(b.duration, 20);
  assert.deepEqual(parseRoutineText('月・木に筋トレ').days.sort(), [1, 4]);
  assert.equal(parseRoutineText('１時間勉強する').duration, 60);
  assert.equal(detectRoutineCat('早寝早起き'), 'sleep');
});

t('目標の分類', () => {
  assert.equal(detectGoalCat('午後の眠気を減らす'), 'sleepiness');
  assert.equal(detectGoalCat('筋肉を増やす'), 'muscle');
  assert.equal(detectGoalCat('疲れにくい身体をつくる'), 'fatigue');
  assert.equal(detectGoalCat('新しいことを勉強する'), 'study');
  assert.equal(detectGoalCat('家族との時間を増やす'), 'family');
});

const plan = {
  startDate: '2026-10-01',
  profile: { wake: '06:00', bed: '23:00', meals: { breakfast: '06:30', lunch: '12:00', dinner: '19:00' }, work: { days: [1, 2, 3, 4, 5], start: '08:30', end: '17:30' }, fatigue: 7, sleepiness: 7 },
  baseline: { fatigue: 7, sleepiness: 7 },
  goals: [
    { id: 'g1', text: '筋肉を増やす', cat: 'muscle', importance: 3 },
    { id: 'g2', text: '午後の眠気を減らす', cat: 'sleepiness', importance: 2 },
  ],
  fixed: [],
  routines: [
    { id: 'r1', text: '週2回筋トレ', cat: 'strength', days: [], time: '', duration: 60, freq: 2, goalIds: ['g1'] },
    { id: 'r2', text: '毎日20分読書', cat: 'reading', days: [0, 1, 2, 3, 4, 5, 6], time: '', duration: 20, freq: 7, goalIds: [] },
    { id: 'r3', text: '昼食改善', cat: 'meal', days: [], time: '', duration: 0, freq: 5, goalIds: ['g2'] },
    { id: 'r4', text: '23時に寝る', cat: 'sleep', days: [], time: '23:00', duration: 0, freq: 7, goalIds: ['g2'] },
  ],
};

t('自動配置：固定予定と重ならない', () => {
  plan.routines = autoPlace(plan, { g1: 3, g2: 2 });
  const st = plan.routines.find((r) => r.id === 'r1');
  assert.equal(st.days.length, 2);
  assert.ok(st.time, '時刻が入る');
  const [h] = st.time.split(':').map(Number);
  // 平日なら仕事後
  if (st.days.some((d) => d >= 1 && d <= 5)) assert.ok(h >= 18, `筋トレは仕事後 ${st.time}`);
  assert.deepEqual(plan.routines.find((r) => r.id === 'r3').days.sort(), [1, 2, 3, 4, 5]);
  const wk = buildWeek(plan);
  assert.equal(wk.days.length, 7);
  assert.ok(!wk.warnings.some((w) => w.text.includes('重なって')), JSON.stringify(wk.warnings));
  assert.ok(!wk.warnings.some((w) => w.text.includes('6時間未満')));
});

t('睡眠不足の警告', () => {
  const p2 = { ...plan, profile: { ...plan.profile, wake: '05:00', bed: '00:30' } };
  p2.routines = plan.routines.filter((r) => r.cat !== 'sleep');
  assert.ok(buildWeek(p2).warnings.some((w) => w.text.includes('6時間未満')));
});

// 4週間分の記録を合成（筋トレは月曜だけ毎回休む、眠気は 7 → 4）
const today = '2026-11-24';
const events = [];
let id = 0;
const ts = (date, hh, mm) => {
  const d = parseYmd(date);
  d.setHours(hh, mm, 0, 0);
  return d.getTime();
};
const st = plan.routines.find((r) => r.id === 'r1');
for (let i = 0; i < 55; i++) {
  const date = addDaysYmd('2026-10-01', i);
  if (date > today) break;
  const dow = dowOf(date);
  events.push({ id: String(id++), type: 'wake', date, ts: ts(date, 6, 5), data: {} });
  const next = addDaysYmd(date, 1);
  if (date < today) events.push({ id: String(id++), type: 'sleep', date, ts: i % 3 ? ts(date, 23, 10) : ts(next, 0, 20), data: {} });
  if (st.days.includes(dow) && dow !== st.days[0]) {
    events.push({ id: String(id++), type: 'workout_start', date, ts: ts(date, 18, 30), data: {} });
    events.push({ id: String(id++), type: 'workout_end', date, ts: ts(date, 19, 20), data: { sets: [{ name: 'スクワット', weight: 40 + i, reps: 10 }] } });
  }
  events.push({ id: String(id++), type: 'reflection', date, ts: ts(date, 22, 0), data: { sleepiness: i < 30 ? 7 : 4, fatigue: 6 } });
}
const ix = indexEvents(events);

t('睡眠セッションの計算', () => {
  const ss = sleepSessions(ix);
  assert.ok(ss.length > 40);
  assert.ok(ss.every((s) => s.minutes > 300 && s.minutes < 480));
});

t('達成状況（4週間）', () => {
  const s = routineStats(plan, ix, st, today);
  assert.equal(s.days, 28);
  assert.ok(s.scheduled >= 7 && s.scheduled <= 8, `予定 ${s.scheduled}`);
  assert.ok(s.doneAll >= 3 && s.doneAll <= 4, `実施 ${s.doneAll}`);
  const ins = routineInsight(plan, ix, st, today);
  assert.equal(ins.status.evidence, 'B');
  assert.ok(ins.actual.some((a) => a.text.includes('重量が上がっている')));
  assert.ok(ins.next.includes('曜日'), ins.next);
});

t('初回値との比較は断定しない', () => {
  const c = compareBaseline(plan, ix, 'sleepiness', today);
  assert.equal(c.status, 'ok');
  assert.equal(c.recentAvg, 4);
  const g = goalInsight(plan, ix, plan.goals[1], today);
  const txt = g.actual.map((a) => a.text).join('');
  assert.ok(txt.includes('原因は断定できません'), txt);
  assert.ok(!/\d+\s*[%％]\s*改善/.test(txt));
});

t('データ不足は C で表示', () => {
  const empty = indexEvents([]);
  const c = compareBaseline(plan, empty, 'fatigue', today);
  assert.equal(c.status, 'insufficient');
  const g = goalInsight(plan, empty, plan.goals[1], today);
  assert.equal(g.actual[0].evidence, 'C');
});

t('週次の提案：実施できない曜日の変更（承認前は確定しない）', () => {
  const ps = weeklyProposals(plan, ix, today);
  const mv = ps.find((p) => p.change.type === 'setDays');
  assert.ok(mv, JSON.stringify(ps));
  assert.ok(mv.text.includes('変更してみませんか'));
  assert.ok(!mv.change.days.includes(st.days[0]));
  assert.notDeepEqual(st.days, mv.change.days);
});

t('今日のアドバイスは1つ', () => {
  const a = dailyAdvice({ plan, ix, checkups: [], settings: {} }, today);
  assert.equal(typeof a.text, 'string');
  const m = dailyAdvice({ plan, ix, checkups: [{ id: 'c1', date: '2026-06-01', judgement: '要再検査' }], settings: {} }, today);
  assert.equal(m.kind, 'medical');
});

t('知見データに断定的な数値予測がない', () => {
  const all = JSON.stringify(ROUTINE_KB);
  assert.ok(!/[0-9０-９]+\s*[%％]/.test(all), '割合表現なし');
  assert.ok(!/必ず/.test(all));
});

console.log(`\n${n} tests passed`);
