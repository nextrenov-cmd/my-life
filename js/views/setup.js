// 初回設定（5段階）と設定の見直し。途中でも自動保存し、次回は続きから再開できる。
import { state, actions, inputHandlers, rerender, go, saveDraftSoon, saveDraftNow, savePlan, toast, evidenceBadge, stars } from '../core.js';
import { esc, uid, clone, DOW, WEEK_ORDER, daysLabel, fmtDur, fromMin, dayKey, addDaysYmd, fmtDate } from '../util.js';
import { ROUTINE_KB, ROUTINE_CATS, GOAL_KB, GOAL_CATS, GOAL_PRESETS, ROUTINE_SUGGEST, STRENGTH_LABEL, detectGoalCat, parseRoutineText } from '../knowledge.js';
import { autoPlace, buildWeek, MARKER_CATS, kindLabel } from '../planner.js';
import { kvDel } from '../db.js';

const STEPS = ['理想の自分と目標', '現在の生活', '理想のルーティン', '1週間の予定', '未来の見通し'];

export function newDraft(mode = 'setup') {
  if (mode === 'edit' && state.plan) {
    const data = clone(state.plan);
    return { mode, step: 1, maxStep: 5, data };
  }
  return {
    mode: 'setup',
    step: 0,
    maxStep: 0,
    data: {
      goals: [],
      routines: [],
      fixed: [],
      profile: { wake: '06:30', bed: '23:00', meals: { breakfast: '07:00', lunch: '12:00', dinner: '19:00' }, work: { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' } },
    },
  };
}

const D = () => state.draft.data;
const importance = (data) => Object.fromEntries((data.goals || []).map((g) => [g.id, g.importance || 2]));

function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) {
    const k = ks[i];
    if (o[k] == null) o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {};
    o = o[k];
  }
  o[ks.at(-1)] = val;
}
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

inputHandlers.push((el, ev) => {
  if (!el.dataset.bind || !state.draft) return false;
  let v = el.value;
  if (el.dataset.type === 'num') v = v === '' ? '' : +v;
  setPath(D(), el.dataset.bind, v);
  const rm = el.dataset.bind.match(/^routines\.(\d+)\.(time|cat)$/);
  if (rm) {
    const r = D().routines[+rm[1]];
    if (rm[2] === 'time') delete r.autoTime;
  }
  if (ev.type === 'change' && el.dataset.rerender) rerender();
  saveDraftSoon();
  return true;
});

// ---------- 画面 ----------
export function renderSetup() {
  const d = state.draft;
  if (d.step === 0) return welcome();
  const body = [step1, step2, step3, step4, step5][d.step - 1]();
  const edit = d.mode === 'edit';
  return `
  <header class="setup-head">
    <div class="setup-title">${edit ? '設定の見直し' : '初回設定'}<span class="muted">　途中で閉じても自動保存されます</span></div>
    <ol class="steps">${STEPS.map((s, i) => {
      const n = i + 1;
      const cls = n === d.step ? 'cur' : n <= d.maxStep ? 'done' : '';
      return `<li class="${cls}"><button ${n <= d.maxStep ? `data-action="gotoStep" data-n="${n}"` : 'disabled'} aria-label="STEP${n} ${s}"><span>${n}</span></button></li>`;
    }).join('')}</ol>
    <h1><small>STEP ${d.step}</small>${STEPS[d.step - 1]}</h1>
  </header>
  <section class="setup-body">${body}</section>
  <footer class="setup-foot">
    ${d.step > 1 ? '<button class="btn ghost" data-action="prevStep">戻る</button>' : edit ? '<button class="btn ghost" data-action="cancelEdit">やめる</button>' : '<span></span>'}
    ${edit && d.step < 5 ? '<button class="btn ghost" data-action="finishSetup">保存して終了</button>' : ''}
    ${d.step < 5 ? `<button class="btn primary" data-action="nextStep">${d.step === 4 ? 'この1週間で承認' : '次へ'}</button>` : `<button class="btn primary" data-action="finishSetup">${edit ? '保存する' : 'この内容で始める'}</button>`}
  </footer>`;
}

function welcome() {
  return `<section class="welcome">
    <div class="logo-mark">ML</div>
    <h1>MY LIFE</h1>
    <p class="lead">最初はしっかり設定、あとは簡単に続ける。</p>
    <ol class="welcome-list">
      <li><b>はじめに一度だけ</b>、目標・今の生活・理想のルーティンを登録します（5ステップ・15分ほど）。</li>
      <li>それをもとに、<b>1週間の予定</b>と<b>続けると期待できる変化</b>を整理します。</li>
      <li>その後は<b>ワンタップの記録</b>だけ。変化はアプリが記録から確認します。</li>
    </ol>
    <p class="muted small">データはこの端末の中だけに保存されます。答えたくない項目は空欄のままで大丈夫です。</p>
    <button class="btn primary big" data-action="startSetup">はじめる</button>
  </section>`;
}

function step1() {
  const goals = D().goals;
  const have = new Set(goals.map((g) => g.text));
  return `
  <p class="lead">実現したいことを、あなたの言葉で書いてください。いくつでも登録できます。</p>
  <div class="chips">${GOAL_PRESETS.filter((p) => !have.has(p)).map((p) => `<button class="chip add" data-action="addGoal" data-text="${esc(p)}">＋ ${esc(p)}</button>`).join('')}</div>
  <form class="add-row" data-action-submit="addGoalForm">
    <input id="newGoal" placeholder="例：子どもと週末に出かける" aria-label="目標を入力">
    <button class="btn primary">追加</button>
  </form>
  <div class="list">${goals.length ? goals.map(goalEditor).join('') : '<p class="empty">まだ目標がありません。上の例から選ぶか、自由に入力してください。</p>'}</div>`;
}

function goalEditor(g, i) {
  return `<div class="card goal-edit">
    <div class="row"><textarea rows="1" data-bind="goals.${i}.text" aria-label="目標">${esc(g.text)}</textarea>
    <button class="icon-btn" data-action="delGoal" data-i="${i}" aria-label="削除">×</button></div>
    <div class="row wrap gap">
      <span class="field-label">重要度</span>
      <div class="seg">${[3, 2, 1].map((v) => `<button class="${(g.importance || 2) === v ? 'on' : ''}" data-action="setImp" data-i="${i}" data-v="${v}">${{ 3: '高', 2: '中', 1: '低' }[v]}</button>`).join('')}</div>
      <label class="inline">分類 <select data-bind="goals.${i}.cat">${GOAL_CATS.map((c) => `<option value="${c}" ${g.cat === c ? 'selected' : ''}>${GOAL_KB[c].label}</option>`).join('')}</select></label>
    </div>
  </div>`;
}

const sel = (bind, opts, val, extra = '') =>
  `<select data-bind="${bind}" ${extra}>${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(val ?? '') === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const scale = (bind, val) => sel(bind, [['', '回答しない'], ...Array.from({ length: 11 }, (_, i) => [i, `${i}${i === 0 ? '（なし）' : i === 10 ? '（とても強い）' : ''}`])], val, 'data-type="num"');
const time = (bind, val, label) => `<label>${label}<input type="time" data-bind="${bind}" value="${esc(val || '')}"></label>`;

function dayChips(action, days, attrs) {
  const set = new Set(days || []);
  return `<div class="days">${WEEK_ORDER.map((d) => `<button class="day ${set.has(d) ? 'on' : ''}" data-action="${action}" data-d="${d}" ${attrs} aria-pressed="${set.has(d)}">${DOW[d]}</button>`).join('')}</div>`;
}

function step2() {
  const p = D().profile;
  const fx = D().fixed || [];
  return `
  <p class="lead">今の生活を教えてください。提案の精度が上がります。<br><span class="muted">答えたくない項目は空欄・「回答しない」のままで大丈夫です。</span></p>
  <div class="card"><h3>睡眠</h3><div class="grid2">${time('profile.wake', p.wake, '起床時間')}${time('profile.bed', p.bed, '就寝時間')}</div></div>
  <div class="card"><h3>食事</h3>
    <div class="grid3">${time('profile.meals.breakfast', p.meals?.breakfast, '朝食')}${time('profile.meals.lunch', p.meals?.lunch, '昼食')}${time('profile.meals.dinner', p.meals?.dinner, '夕食')}</div>
    <label>よく食べる内容<textarea rows="2" data-bind="profile.mealNote" placeholder="例：昼は麺＋ライスのセットが多い">${esc(p.mealNote || '')}</textarea></label>
  </div>
  <div class="card"><h3>仕事</h3>
    <span class="field-label">仕事の曜日</span>${dayChips('toggleWorkDay', p.work?.days)}
    <div class="grid2">${time('profile.work.start', p.work?.start, '開始')}${time('profile.work.end', p.work?.end, '終了')}</div>
    <label>休日・勤務の補足<input data-bind="profile.holidayNote" value="${esc(p.holidayNote || '')}" placeholder="例：第2・4土曜は出勤"></label>
  </div>
  <div class="card"><h3>その他の固定予定</h3>
    <p class="muted small">送迎・習い事など、毎週決まっている予定があれば登録してください。週間予定で優先されます。</p>
    ${fx.map((f, i) => `<div class="fixed-row">
        <div class="row"><input data-bind="fixed.${i}.label" value="${esc(f.label || '')}" placeholder="予定の名前"><button class="icon-btn" data-action="delFixed" data-i="${i}" aria-label="削除">×</button></div>
        ${dayChips('toggleFixedDay', f.days, `data-i="${i}"`)}
        <div class="grid2">${time(`fixed.${i}.start`, f.start, '開始')}${time(`fixed.${i}.end`, f.end, '終了')}</div></div>`).join('')}
    <button class="btn ghost small" data-action="addFixed">＋ 固定予定を追加</button>
  </div>
  <div class="card"><h3>運動・習慣</h3><div class="grid2">
    <label>運動頻度${sel('profile.exercise', [['', '回答しない'], ['none', 'ほとんどしない'], ['w1', '週1回くらい'], ['w23', '週2〜3回'], ['w4', '週4回以上']], p.exercise)}</label>
    <label>筋トレ経験${sel('profile.strengthExp', [['', '回答しない'], ['none', 'なし'], ['little', '少しある'], ['y1', '1年以上'], ['y3', '3年以上']], p.strengthExp)}</label>
    <label>サウナ習慣${sel('profile.sauna', [['', '回答しない'], ['none', 'なし'], ['m', '月に数回'], ['w12', '週1〜2回'], ['w3', '週3回以上']], p.sauna)}</label>
  </div></div>
  <div class="card"><h3>今の体調</h3><p class="muted small">あとで変化を比べる基準になります（0〜10）。</p><div class="grid2">
    <label>疲労度${scale('profile.fatigue', p.fatigue)}</label>
    <label>午後の眠気${scale('profile.sleepiness', p.sleepiness)}</label>
  </div>
    <label>今の悩み<textarea rows="2" data-bind="profile.worries" placeholder="例：昼食後に眠くなって仕事に集中できない">${esc(p.worries || '')}</textarea></label>
  </div>
  <div class="card"><h3>健康・運動の提案に使う情報 <span class="tag">任意</span></h3><div class="grid3">
    <label>年齢<input type="number" inputmode="numeric" data-type="num" data-bind="profile.age" value="${esc(p.age ?? '')}"></label>
    <label>身長(cm)<input type="number" inputmode="decimal" data-type="num" data-bind="profile.height" value="${esc(p.height ?? '')}"></label>
    <label>体重(kg)<input type="number" inputmode="decimal" data-type="num" data-bind="profile.weight" value="${esc(p.weight ?? '')}"></label>
  </div>
    <label>健康上の制限・治療中のこと<textarea rows="2" data-bind="profile.limits" placeholder="例：腰痛があるので重い前屈は避けたい">${esc(p.limits || '')}</textarea></label>
    <p class="muted small">治療中の病気がある場合、運動や食事の変更は主治医の指示を優先してください。</p>
  </div>`;
}

function step3() {
  const data = D();
  const rs = data.routines;
  const have = new Set(rs.map((r) => r.cat));
  const sugCats = [...new Set(data.goals.flatMap((g) => GOAL_KB[g.cat]?.suggest || []))].filter((c) => !have.has(c));
  if (!have.has('journal')) sugCats.push('journal');
  return `
  <p class="lead">理想のルーティンを、あなたの言葉で登録してください。<br><span class="muted">例：「毎朝5:30に起きたい」「週2回筋トレしたい」「毎日30分読書したい」</span></p>
  ${sugCats.length ? `<div class="chips"><span class="field-label">目標からのおすすめ</span>${sugCats.map((c) => `<button class="chip add" data-action="addSuggest" data-cat="${c}">＋ ${esc(ROUTINE_SUGGEST[c]?.text || ROUTINE_KB[c].label)}</button>`).join('')}</div>` : ''}
  <form class="add-row" data-action-submit="addRoutineForm">
    <input id="newRoutine" placeholder="例：毎晩今日の感想を書きたい" aria-label="ルーティンを入力">
    <button class="btn primary">追加</button>
  </form>
  <p class="muted small">時刻・曜日・回数・時間は文章から読み取ります。曜日や時刻を空欄にすると、次のステップで空き時間に自動配置します。</p>
  ${rs.filter((r) => !MARKER_CATS.has(r.cat)).length > 5 ? '<div class="note warn">新しい習慣が多めです。一度に多く始めると続けにくくなる傾向があるため、重要度の高いものから始める方法もあります。</div>' : ''}
  <div class="list">${rs.length ? rs.map(routineEditor).join('') : '<p class="empty">まだルーティンがありません。</p>'}</div>`;
}

function routineEditor(r, i) {
  const kb = ROUTINE_KB[r.cat] || ROUTINE_KB.custom;
  const marker = MARKER_CATS.has(r.cat);
  const goals = D().goals;
  return `<div class="card r-edit">
    <div class="row"><span class="glyph c-${r.cat}">${kb.glyph}</span><textarea rows="1" data-bind="routines.${i}.text" aria-label="ルーティン">${esc(r.text)}</textarea>
    <button class="icon-btn" data-action="delRoutine" data-i="${i}" aria-label="削除">×</button></div>
    <div class="grid2">
      <label>種類${sel(`routines.${i}.cat`, ROUTINE_CATS.map((c) => [c, ROUTINE_KB[c].label]), r.cat, 'data-rerender="1"')}</label>
      <label>${r.cat === 'wake' ? '起床時刻' : r.cat === 'sleep' ? '就寝時刻' : '実施時刻'}<input type="time" data-bind="routines.${i}.time" value="${esc(r.time || '')}"></label>
      ${marker ? '' : `<label>所要時間（分）<input type="number" inputmode="numeric" min="0" step="5" data-type="num" data-bind="routines.${i}.duration" value="${esc(r.duration ?? '')}"></label>`}
      <label>週の回数${sel(`routines.${i}.freq`, [1, 2, 3, 4, 5, 6, 7].map((n) => [n, n === 7 ? '毎日' : `週${n}回`]), r.freq || (r.days?.length || 3), 'data-type="num"')}</label>
    </div>
    <span class="field-label">曜日 <span class="muted">（未選択なら自動配置）</span></span>${dayChips('toggleRoutineDay', r.days, `data-i="${i}"`)}
    ${goals.length ? `<span class="field-label">つながる目標</span><div class="chips">${goals.map((g) => `<button class="chip ${r.goalIds?.includes(g.id) ? 'on' : ''}" data-action="toggleRoutineGoal" data-i="${i}" data-g="${g.id}">${esc(g.text)}</button>`).join('')}</div>` : ''}
  </div>`;
}

function weekView(plan, interactive) {
  const wk = buildWeek(plan);
  const cur = state.ui.weekDay ?? WEEK_ORDER[0];
  const day = wk.days.find((x) => x.dow === cur);
  const rs = (plan.routines || []).filter((r) => r.active !== false);
  return `
  ${wk.warnings.map((w) => `<div class="note ${w.level}">${esc(w.text)}</div>`).join('')}
  <div class="card">
    <h3>週の概要</h3>
    <div class="matrix" role="table">
      <div class="m-row m-head" role="row"><span></span>${WEEK_ORDER.map((d) => `<span>${DOW[d]}</span>`).join('')}</div>
      ${rs.map((r) => `<div class="m-row" role="row"><span class="m-name" title="${esc(r.text)}"><i class="dot c-${r.cat}"></i>${esc(r.text)}</span>${WEEK_ORDER.map((d) => {
        const on = r.days?.includes(d);
        return interactive ? `<button class="m-cell ${on ? 'on' : ''}" data-action="toggleCell" data-r="${r.id}" data-d="${d}" aria-label="${esc(r.text)} ${DOW[d]}曜 ${on ? 'あり' : 'なし'}">${on ? '●' : ''}</button>` : `<span class="m-cell ${on ? 'on' : ''}">${on ? '●' : ''}</span>`;
      }).join('')}</div>`).join('')}
    </div>
    ${interactive ? '<p class="muted small">●をタップすると曜日を変更できます。</p>' : ''}
  </div>
  <div class="card">
    <div class="day-tabs" role="tablist">${wk.days.map((x) => `<button role="tab" aria-selected="${x.dow === cur}" class="${x.dow === cur ? 'on' : ''}" data-action="weekDay" data-d="${x.dow}">${DOW[x.dow]}</button>`).join('')}</div>
    <div class="day-meta muted small">睡眠 約${fmtDur(day.sleepMin)}・自由時間 約${fmtDur(day.free)}</div>
    <ol class="timeline">${day.blocks.map((b) => `<li class="tl tl-${b.kind} ${b.cat ? 'c-' + b.cat : ''}"><time>${fromMin(b.start)}${b.end > b.start ? '–' + fromMin(b.end) : ''}</time><span class="tl-label">${esc(b.label)}</span><span class="tl-kind">${esc(kindLabel(b))}</span></li>`).join('')}</ol>
  </div>`;
}
export { weekView };

function step4() {
  return `<p class="lead">仕事などの固定予定を優先して、ルーティンを配置しました。確認して、よければ承認してください。</p>
  ${weekView(D(), true)}
  <div class="row gap"><button class="btn ghost small" data-action="replace">自動配置をやり直す</button><button class="btn ghost small" data-action="gotoStep" data-n="3">ルーティンを編集</button></div>`;
}

export function outlookCard(r, open) {
  const kb = ROUTINE_KB[r.cat] || ROUTINE_KB.custom;
  const start = state.draft?.data?.startDate || state.plan?.startDate || dayKey();
  return `<details class="card outlook" ${open ? 'open' : ''}>
    <summary><span class="glyph c-${r.cat}">${kb.glyph}</span><span class="grow"><b>${esc(r.text)}</b><br><span class="muted small">${daysLabel(r.days)} ${r.time || ''}${r.duration ? `・${r.duration}分` : ''}</span></span></summary>
    <div class="ol-body">
      <h4>${evidenceBadge('A')} 続けることで期待できること <span class="muted small">${STRENGTH_LABEL[kb.strength]}</span></h4>
      <ul>${kb.expects.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h4>なぜ期待できるのか</h4><p>${esc(kb.why)}</p>
      <h4>変化を確認する指標</h4><div class="chips">${kb.metrics.map((m) => `<span class="chip">${esc(m)}</span>`).join('')}</div>
      <h4>いつ振り返るか</h4>
      <ul class="cp">${[['w1', '1週間', 7], ['m1', '1か月', 30], ['m3', '3か月', 90]].map(([k, l, n]) => `<li><b>${l}後（${fmtDate(addDaysYmd(start, n))}）</b>${esc(kb.checkpoints[k])}</li>`).join('')}</ul>
      ${kb.cautions.length ? `<h4>注意点</h4><ul>${kb.cautions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <h4>実現しやすくする工夫</h4><ul>${kb.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="uncert">${esc(kb.uncertainty)}</p>
      ${kb.refs.length ? `<details class="refs"><summary>参考資料</summary><ul>${kb.refs.map((x) => `<li>${esc(x.t)}<br><span class="muted">${esc(x.n)}</span></li>`).join('')}</ul></details>` : ''}
    </div>
  </details>`;
}

function step5() {
  const data = D();
  return `<p class="lead">設定したルーティンを続けると、どんな変化が期待できるかをまとめました。タップすると詳しく見られます。</p>
  <p class="muted small">${evidenceBadge('A')} は一般的な知見で、あなたに必ず起こる結果ではありません。実際の変化は、記録をもとに ${evidenceBadge('B')} として表示します。</p>
  <div class="list">${data.routines.filter((r) => r.active !== false).map((r) => outlookCard(r, false)).join('')}</div>
  <div class="card"><h3>目標</h3><ul class="goal-sum">${data.goals.map((g) => `<li><span class="imp">${stars(g.importance || 2)}</span>${esc(g.text)}</li>`).join('') || '<li class="muted">未登録</li>'}</ul></div>
  <h3 class="sec">1週間のスケジュール</h3>
  ${weekView(data, false)}`;
}

// ---------- 操作 ----------
const draftGoal = (text) => ({ id: uid(), text, importance: 2, cat: detectGoalCat(text) });

function addRoutineFrom(text, extra = {}) {
  const parsed = parseRoutineText(text);
  const r = { id: uid(), text, cat: parsed.cat, days: parsed.days || [], time: parsed.time || '', duration: parsed.duration ?? ROUTINE_SUGGEST[parsed.cat]?.duration ?? 30, freq: parsed.freq || ROUTINE_SUGGEST[parsed.cat]?.freq || 3, goalIds: [], active: true, ...extra };
  if (MARKER_CATS.has(r.cat)) r.duration = 0;
  // つながる目標を自動で推定
  r.goalIds = D().goals.filter((g) => (GOAL_KB[g.cat]?.suggest || []).includes(r.cat)).map((g) => g.id);
  D().routines.push(r);
}

Object.assign(actions, {
  startSetup() {
    state.draft.step = 1;
    state.draft.maxStep = Math.max(state.draft.maxStep, 1);
    saveDraftNow();
    rerender();
  },
  gotoStep(el) {
    moveTo(+el.dataset.n);
  },
  prevStep() {
    moveTo(state.draft.step - 1);
  },
  nextStep() {
    const d = state.draft;
    if (d.step === 1 && !D().goals.some((g) => g.text.trim())) return toast('目標を1つ以上登録してください');
    if (d.step === 3 && !D().routines.length) return toast('ルーティンを1つ以上登録してください');
    moveTo(d.step + 1);
  },
  addGoal(el) {
    D().goals.push(draftGoal(el.dataset.text));
    saveDraftSoon();
    rerender();
  },
  addGoalForm() {
    const v = document.getElementById('newGoal').value.trim();
    if (!v) return;
    D().goals.push(draftGoal(v));
    saveDraftSoon();
    rerender();
    document.getElementById('newGoal')?.focus();
  },
  delGoal(el) {
    const g = D().goals.splice(+el.dataset.i, 1)[0];
    D().routines.forEach((r) => (r.goalIds = (r.goalIds || []).filter((x) => x !== g.id)));
    saveDraftSoon();
    rerender();
  },
  setImp(el) {
    D().goals[+el.dataset.i].importance = +el.dataset.v;
    saveDraftSoon();
    rerender();
  },
  toggleWorkDay(el) {
    const w = (D().profile.work = D().profile.work || {});
    w.days = toggle(w.days, +el.dataset.d);
    saveDraftSoon();
    rerender();
  },
  addFixed() {
    D().fixed = D().fixed || [];
    D().fixed.push({ id: uid(), label: '', days: [], start: '', end: '' });
    saveDraftSoon();
    rerender();
  },
  delFixed(el) {
    D().fixed.splice(+el.dataset.i, 1);
    saveDraftSoon();
    rerender();
  },
  toggleFixedDay(el) {
    const f = D().fixed[+el.dataset.i];
    f.days = toggle(f.days, +el.dataset.d);
    saveDraftSoon();
    rerender();
  },
  addSuggest(el) {
    const s = ROUTINE_SUGGEST[el.dataset.cat];
    addRoutineFrom(s.text, { cat: s.cat, freq: s.freq, duration: s.duration, days: s.freq === 7 ? [0, 1, 2, 3, 4, 5, 6] : [] });
    const r = D().routines.at(-1);
    r.cat = s.cat;
    r.goalIds = D().goals.filter((g) => (GOAL_KB[g.cat]?.suggest || []).includes(s.cat)).map((g) => g.id);
    saveDraftSoon();
    rerender();
  },
  addRoutineForm() {
    const v = document.getElementById('newRoutine').value.trim();
    if (!v) return;
    addRoutineFrom(v);
    saveDraftSoon();
    rerender();
    document.getElementById('newRoutine')?.focus();
  },
  delRoutine(el) {
    D().routines.splice(+el.dataset.i, 1);
    saveDraftSoon();
    rerender();
  },
  toggleRoutineDay(el) {
    const r = D().routines[+el.dataset.i];
    r.days = toggle(r.days, +el.dataset.d);
    if (r.days.length) r.freq = r.days.length;
    delete r.autoDays;
    saveDraftSoon();
    rerender();
  },
  toggleRoutineGoal(el) {
    const r = D().routines[+el.dataset.i];
    r.goalIds = toggle(r.goalIds, el.dataset.g);
    saveDraftSoon();
    rerender();
  },
  toggleCell(el) {
    const r = D().routines.find((x) => x.id === el.dataset.r);
    r.days = toggle(r.days, +el.dataset.d);
    if (r.days.length) r.freq = r.days.length;
    delete r.autoDays;
    saveDraftSoon();
    rerender();
  },
  weekDay(el) {
    state.ui.weekDay = +el.dataset.d;
    rerender();
  },
  replace() {
    D().routines.forEach((r) => {
      if (r.autoDays) r.days = [];
      if (r.autoTime) r.time = '';
    });
    D().routines = autoPlace(D(), importance(D()));
    saveDraftSoon();
    rerender();
    toast('空き時間に配置し直しました');
  },
  async finishSetup() {
    await commit();
  },
  async cancelEdit() {
    state.draft = null;
    await kvDel('draft');
    go('#/more');
  },
});

function toggle(arr, v) {
  const s = new Set(arr || []);
  s.has(v) ? s.delete(v) : s.add(v);
  return [...s];
}

function moveTo(n) {
  const d = state.draft;
  n = Math.max(1, Math.min(5, n));
  if (n >= 4) D().routines = autoPlace(D(), importance(D()));
  d.step = n;
  d.maxStep = Math.max(d.maxStep || 0, n);
  saveDraftNow();
  rerender();
  window.scrollTo(0, 0);
}

async function commit() {
  const d = state.draft;
  const data = clone(d.data);
  data.goals = data.goals.filter((g) => g.text.trim());
  data.routines = autoPlace(data, importance(data));
  const t = dayKey();
  if (d.mode === 'setup' || !state.plan) {
    data.startDate = t;
    data.history = [{ date: t, text: '初回設定を完了しました' }];
    const p = data.profile || {};
    data.baseline = { date: t, fatigue: p.fatigue, sleepiness: p.sleepiness, weight: p.weight };
  } else {
    const old = new Set(state.plan.routines.map((r) => r.id));
    data.routines.forEach((r) => {
      if (!old.has(r.id)) r.since = t;
    });
    data.startDate = state.plan.startDate;
    data.baseline = state.plan.baseline;
    data.history = [...(state.plan.history || []), { date: t, text: '設定を見直しました' }];
  }
  data.approvedAt = Date.now();
  state.plan = data;
  await savePlan();
  state.draft = null;
  await kvDel('draft');
  toast(d.mode === 'edit' ? '設定を保存しました' : '設定が完了しました。今日から始めましょう');
  go('#/today');
}
