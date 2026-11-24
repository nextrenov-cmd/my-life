// 今日の画面：ワンタップ記録＋今日のひとこと（1つだけ）
import { state, actions, rerender, logEvent, updateEvent, removeEvent, toast, openSheet, closeSheet, today, saveSettings } from '../core.js';
import { esc, DOW, parseYmd, tsToHHMM, fmtDur, dayKey, addDaysYmd, DAY_BOUNDARY_H, dowOf } from '../util.js';
import { ROUTINE_KB } from '../knowledge.js';
import { activeRoutines, MARKER_CATS } from '../planner.js';
import { dailyAdvice, routineDoneOn, weeklyProposals } from '../analysis.js';
import { ymd, mondayOf } from '../util.js';

const MEAL_LABEL = { breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食' };

function eventLabel(e) {
  switch (e.type) {
    case 'wake':
      return '起きた';
    case 'sleep':
      return '寝る';
    case 'meal':
      return `${MEAL_LABEL[e.data?.slot] || '食事'}${e.data?.amount ? `（${e.data.amount}）` : ''}${e.data?.note ? ` ${e.data.note}` : ''}`;
    case 'workout_start':
      return '筋トレ開始';
    case 'workout_end':
      return `筋トレ終了${e.data?.minutes ? `（${fmtDur(e.data.minutes)}）` : ''}`;
    case 'routine_done': {
      const r = state.plan.routines.find((x) => x.id === e.data?.routineId);
      return `✓ ${r ? r.text : 'ルーティン'}`;
    }
    case 'reflection':
      return '今日の感想';
    default:
      return e.type;
  }
}

function openWorkout() {
  const ws = state.events.filter((e) => e.type === 'workout_start' || e.type === 'workout_end').sort((a, b) => a.ts - b.ts);
  const last = ws.at(-1);
  if (last?.type === 'workout_start' && Date.now() - last.ts < 6 * 3600000) return last;
  return null;
}

function mealSlot(list) {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h >= DAY_BOUNDARY_H && h < 10.5) return 'breakfast';
  if (h >= 10.5 && h < 15.5) return 'lunch';
  return list.some((e) => e.type === 'meal' && e.data?.slot === 'dinner') ? 'snack' : 'dinner';
}

export function renderToday() {
  const t = today();
  const d = parseYmd(t);
  const ix = state.ix;
  const list = ix.byDate.get(t) || [];
  const wake = list.find((e) => e.type === 'wake');
  const sleep = list.find((e) => e.type === 'sleep');
  const meals = list.filter((e) => e.type === 'meal');
  const refl = list.find((e) => e.type === 'reflection');
  const ow = openWorkout();
  const adv = dailyAdvice({ plan: state.plan, ix, checkups: state.checkups, settings: state.settings }, t);
  const h = new Date().getHours();
  const greet = h >= DAY_BOUNDARY_H && h < 10 ? 'おはようございます' : h < 18 && h >= 10 ? 'こんにちは' : 'こんばんは';

  // 数日記録がなくても責めない
  let welcomeBack = '';
  const recent = [1, 2, 3].map((n) => (ix.byDate.get(addDaysYmd(t, -n)) || []).length);
  if (state.events.length && !list.length && recent.every((n) => n === 0)) welcomeBack = '<p class="muted">おかえりなさい。今日からまた気軽にどうぞ。</p>';

  const dow = dowOf(t);
  const rs = activeRoutines(state.plan).filter((r) => !MARKER_CATS.has(r.cat) && r.days?.includes(dow));
  const weekKey = ymd(mondayOf(d));
  const props = weeklyProposals(state.plan, ix, t);
  const decided = state.proposals[weekKey] || {};
  const pending = props.filter((p) => !decided[p.id]).length;

  const tap = (action, label, sub, done, cls = '') =>
    `<button class="tap ${done ? 'done' : ''} ${cls}" data-action="${action}"><span class="tap-label">${label}</span>${sub ? `<span class="tap-sub">${sub}</span>` : ''}</button>`;

  return `
  <header class="page-head">
    <div class="muted">${d.getMonth() + 1}月${d.getDate()}日（${DOW[d.getDay()]}）</div>
    <h1>${greet}</h1>${welcomeBack}
  </header>
  <section class="card advice ${adv.kind === 'medical' ? 'medical' : ''}">
    <div class="advice-label">今日のひとこと</div>
    <p>${esc(adv.text)}</p>
    ${adv.action ? `<button class="btn small" data-action="${adv.action}">${esc(adv.actionLabel)}</button>` : ''}
  </section>
  ${pending ? `<a class="card banner" href="#/review"><b>今週の振り返り</b>：来週に向けた提案が${pending}件あります <span aria-hidden="true">›</span></a>` : ''}
  <section class="taps">
    ${tap('tapWake', '起きた', wake ? `${tsToHHMM(wake.ts)} 記録済み` : '', !!wake)}
    ${tap('tapMeal', '食べた', meals.length ? meals.map((m) => MEAL_LABEL[m.data?.slot] || '食事').join('・') : '', false)}
    ${ow ? tap('tapWorkoutEnd', '筋トレ終了', `${tsToHHMM(ow.ts)}開始・${fmtDur((Date.now() - ow.ts) / 60000)}`, false, 'active') : tap('tapWorkoutStart', '筋トレ開始', list.some((e) => e.type === 'workout_end') ? '今日は実施済み' : '', false)}
    ${tap('tapReflect', '今日の感想', refl ? '記録済み・編集' : '', !!refl)}
    ${tap('tapSleep', '寝る', sleep ? `${tsToHHMM(sleep.ts)} 記録済み` : '', !!sleep, 'wide')}
  </section>
  ${rs.length ? `<section class="card"><h3>今日のルーティン</h3><ul class="checks">${rs.map((r) => {
    const done = routineDoneOn(ix, r, t);
    const kb = ROUTINE_KB[r.cat] || ROUTINE_KB.custom;
    return `<li><button class="check ${done ? 'on' : ''}" data-action="toggleRoutine" data-r="${r.id}" aria-pressed="${done}"><span class="box">${done ? '✓' : ''}</span><span class="glyph c-${r.cat}">${kb.glyph}</span><span class="grow">${esc(r.text)}<br><span class="muted small">${r.time || ''}${r.duration ? `・${r.duration}分` : ''}</span></span></button><a class="more-link" href="#/routine/${r.id}" aria-label="期待できる変化を見る">›</a></li>`;
  }).join('')}</ul></section>` : ''}
  <section class="card">
    <h3>今日の記録</h3>
    ${list.length ? `<ul class="log">${list.map((e) => `<li><button class="log-row" data-action="editEvent" data-id="${e.id}"><time>${tsToHHMM(e.ts)}</time><span>${esc(eventLabel(e))}</span><span class="muted small">修正</span></button></li>`).join('')}</ul>` : '<p class="muted small">まだ記録はありません。上のボタンをタップするだけで記録できます。</p>'}
    <button class="btn ghost small" data-action="addPast">記録し忘れを追加</button>
  </section>`;
}

// ---------- 操作 ----------
function tsFor(date, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const x = parseYmd(date);
  x.setHours(h, m, 0, 0);
  if (h < DAY_BOUNDARY_H) x.setDate(x.getDate() + 1);
  return x.getTime();
}

function mealSheet(e) {
  const r = activeRoutines(state.plan).find((x) => x.cat === 'meal' && x.days?.includes(dowOf(e.date)));
  openSheet(`${MEAL_LABEL[e.data.slot]}を記録しました`, `
    <p class="muted small">詳しい記録は任意です。そのまま閉じてもOKです。</p>
    <span class="field-label">量</span>
    <div class="seg">${['少なめ', '普通', '多め'].map((a) => `<button class="${e.data.amount === a ? 'on' : ''}" data-action="mealAmount" data-id="${e.id}" data-v="${a}">${a}</button>`).join('')}</div>
    <label>内容<input id="mealNote" value="${esc(e.data.note || '')}" placeholder="例：ラーメン＋半ライス、サラダ"></label>
    ${r ? `<button class="btn ghost" data-action="mealRoutine" data-r="${r.id}">「${esc(r.text)}」を実施した</button>` : ''}
    <button class="btn primary" data-action="mealSave" data-id="${e.id}">保存</button>`);
}

function workoutSheet(e) {
  const prev = [...state.events].filter((x) => x.type === 'workout_end' && x.id !== e.id && x.data?.sets?.length).sort((a, b) => b.ts - a.ts)[0];
  const sets = e.data.sets?.length ? e.data.sets : (prev?.data.sets || [{ name: '', weight: '', reps: '' }]).map((s) => ({ name: s.name, weight: s.weight, reps: s.reps }));
  state.ui.sets = sets;
  openSheet('おつかれさまでした', `
    <p class="muted small">${e.data.minutes ? `${fmtDur(e.data.minutes)}のトレーニングを記録しました。` : ''}重量・回数の記録は任意です（前回の内容を表示しています）。</p>
    <div id="sets">${setRows(sets)}</div>
    <button class="btn ghost small" data-action="addSet">＋ 種目を追加</button>
    <button class="btn primary" data-action="saveSets" data-id="${e.id}">保存</button>`);
}
const setRows = (sets) =>
  sets
    .map(
      (s, i) => `<div class="set-row">
    <input data-set="${i}" data-k="name" value="${esc(s.name)}" placeholder="種目" aria-label="種目">
    <input data-set="${i}" data-k="weight" type="number" inputmode="decimal" value="${esc(s.weight)}" placeholder="kg" aria-label="重量kg">
    <input data-set="${i}" data-k="reps" type="number" inputmode="numeric" value="${esc(s.reps)}" placeholder="回" aria-label="回数">
  </div>`
    )
    .join('');

function readSets() {
  const sets = state.ui.sets || [];
  document.querySelectorAll('[data-set]').forEach((el) => {
    sets[+el.dataset.set][el.dataset.k] = el.value;
  });
  return sets;
}

const scaleSel = (id, val, label) =>
  `<label>${label}<select id="${id}"><option value="">—</option>${Array.from({ length: 11 }, (_, i) => `<option value="${i}" ${String(val ?? '') === String(i) ? 'selected' : ''}>${i}</option>`).join('')}</select></label>`;

function reflectSheet() {
  const t = today();
  const e = (state.ix.byDate.get(t) || []).find((x) => x.type === 'reflection');
  const d = e?.data || {};
  openSheet('今日の感想', `
    <textarea id="rText" rows="4" placeholder="一言だけでも大丈夫です">${esc(d.text || '')}</textarea>
    <p class="muted small">数字は任意です（0〜10）。変化の確認に使います。</p>
    <div class="grid3">${scaleSel('rFatigue', d.fatigue, '疲労度')}${scaleSel('rSleepiness', d.sleepiness, '午後の眠気')}${scaleSel('rMood', d.mood, '気分')}</div>
    <label>体重(kg)<span class="muted small"> 任意</span><input id="rWeight" type="number" inputmode="decimal" step="0.1" value="${esc(d.weight ?? '')}"></label>
    <button class="btn primary" data-action="saveReflect">保存</button>`);
}

Object.assign(actions, {
  async tapWake() {
    const t = today();
    if ((state.ix.byDate.get(t) || []).some((e) => e.type === 'wake')) return toast('今日の起床は記録済みです（修正は「今日の記録」から）');
    await logEvent('wake');
    toast('おはようございます');
    rerender();
  },
  async tapSleep() {
    const t = today();
    if ((state.ix.byDate.get(t) || []).some((e) => e.type === 'sleep')) return toast('就寝は記録済みです');
    await logEvent('sleep');
    toast('おやすみなさい');
    rerender();
  },
  async tapMeal() {
    const t = today();
    const e = await logEvent('meal', { slot: mealSlot(state.ix.byDate.get(t) || []) });
    rerender();
    mealSheet(e);
  },
  mealAmount(el) {
    const e = state.events.find((x) => x.id === el.dataset.id);
    e.data.amount = el.dataset.v;
    el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
  },
  async mealRoutine(el) {
    if (!routineDoneOn(state.ix, state.plan.routines.find((r) => r.id === el.dataset.r), today())) await logEvent('routine_done', { routineId: el.dataset.r });
    el.textContent = '✓ 実施を記録しました';
    el.disabled = true;
  },
  async mealSave(el) {
    const e = state.events.find((x) => x.id === el.dataset.id);
    e.data.note = document.getElementById('mealNote').value.trim();
    await updateEvent(e);
    closeSheet();
    rerender();
  },
  async tapWorkoutStart() {
    await logEvent('workout_start');
    toast('筋トレを開始しました。終わったら「終了」をタップ');
    rerender();
  },
  async tapWorkoutEnd() {
    const ow = openWorkout();
    const e = await logEvent('workout_end', { minutes: ow ? Math.round((Date.now() - ow.ts) / 60000) : null, sets: [] });
    rerender();
    workoutSheet(e);
  },
  addSet() {
    const sets = readSets();
    sets.push({ name: '', weight: '', reps: '' });
    document.getElementById('sets').innerHTML = setRows(sets);
  },
  async saveSets(el) {
    const e = state.events.find((x) => x.id === el.dataset.id);
    e.data.sets = readSets().filter((s) => s.name.trim());
    await updateEvent(e);
    closeSheet();
    toast('記録しました');
    rerender();
  },
  tapReflect() {
    reflectSheet();
  },
  async saveReflect() {
    const v = (id) => document.getElementById(id).value;
    const data = { text: v('rText').trim(), fatigue: v('rFatigue'), sleepiness: v('rSleepiness'), mood: v('rMood'), weight: v('rWeight') };
    const e = (state.ix.byDate.get(today()) || []).find((x) => x.type === 'reflection');
    if (e) {
      e.data = data;
      await updateEvent(e);
    } else await logEvent('reflection', data);
    closeSheet();
    toast('今日の感想を保存しました');
    rerender();
  },
  async toggleRoutine(el) {
    const r = state.plan.routines.find((x) => x.id === el.dataset.r);
    const t = today();
    if (r.cat === 'strength' && !routineDoneOn(state.ix, r, t)) return actions.tapWorkoutStart();
    if (r.cat === 'journal' && !routineDoneOn(state.ix, r, t)) return reflectSheet();
    const ev = (state.ix.byDate.get(t) || []).find((e) => e.type === 'routine_done' && e.data?.routineId === r.id);
    if (ev) await removeEvent(ev.id);
    else if (!routineDoneOn(state.ix, r, t)) await logEvent('routine_done', { routineId: r.id, minutes: r.duration || null });
    else return toast('記録済みです（修正は「今日の記録」から）');
    rerender();
  },
  editEvent(el) {
    const e = state.events.find((x) => x.id === el.dataset.id);
    openSheet('記録の修正', `
      <p><b>${esc(eventLabel(e))}</b></p>
      <label>時刻<input type="time" id="evTime" value="${tsToHHMM(e.ts)}"></label>
      ${e.type === 'reflection' ? '<button class="btn ghost" data-action="tapReflect">内容を編集</button>' : ''}
      <div class="row gap"><button class="btn danger" data-action="delEvent" data-id="${e.id}">削除</button><button class="btn primary grow" data-action="saveEventTime" data-id="${e.id}">保存</button></div>`);
  },
  async saveEventTime(el) {
    const e = state.events.find((x) => x.id === el.dataset.id);
    const v = document.getElementById('evTime').value;
    if (v) {
      e.ts = tsFor(e.date, v);
      await updateEvent(e);
    }
    closeSheet();
    rerender();
  },
  async delEvent(el) {
    await removeEvent(el.dataset.id);
    closeSheet();
    toast('削除しました');
    rerender();
  },
  addPast() {
    const t = today();
    openSheet('記録し忘れを追加', `
      <label>記録<select id="pType"><option value="wake">起きた</option><option value="sleep">寝る</option><option value="meal">食べた</option><option value="workout_start">筋トレ開始</option><option value="workout_end">筋トレ終了</option></select></label>
      <label>日付<select id="pDate"><option value="${t}">今日</option><option value="${addDaysYmd(t, -1)}">昨日</option><option value="${addDaysYmd(t, -2)}">一昨日</option></select></label>
      <label>時刻<input type="time" id="pTime" value="${tsToHHMM(Date.now())}"></label>
      <p class="muted small">深夜0時〜${DAY_BOUNDARY_H}時の「寝る」は前日の夜として扱います。</p>
      <button class="btn primary" data-action="savePast">追加</button>`);
  },
  async savePast() {
    const type = document.getElementById('pType').value;
    const date = document.getElementById('pDate').value;
    const time = document.getElementById('pTime').value;
    if (!time) return toast('時刻を入力してください');
    const ts = tsFor(date, time);
    const data = type === 'meal' ? { slot: +time.split(':')[0] < 11 ? 'breakfast' : +time.split(':')[0] < 16 ? 'lunch' : 'dinner' } : {};
    await logEvent(type, data, ts);
    closeSheet();
    toast(`${dayKey(ts) === today() ? '今日' : '過去'}の記録を追加しました`);
    rerender();
  },
  async ackCheckup() {
    const latest = [...state.checkups].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    state.settings.checkupAck = latest?.id;
    await saveSettings();
    rerender();
  },
});
