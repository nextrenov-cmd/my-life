// 目標一覧・未来予測画面（目標／ルーティン）
import { state, actions, today, evidenceBadge, stars, rerender } from '../core.js';
import { esc, fmtDate, daysLabel, addDaysYmd, fmtDur, round1 } from '../util.js';
import { ROUTINE_KB, GOAL_KB, STRENGTH_LABEL, EVIDENCE } from '../knowledge.js';
import { activeRoutines } from '../planner.js';
import { goalInsight, routineInsight, checkpointStage, metricSeries, sleepSessions, METRIC_LABEL } from '../analysis.js';
import { expertsFor, COACH } from '../experts.js';

const line = (x) => `<p class="ins">${evidenceBadge(x.evidence)} ${esc(x.text)}</p>`;

export function renderGoals() {
  const plan = state.plan;
  const t = today();
  return `
  <header class="page-head"><h1>目標</h1><p class="muted">タップすると、今の状態・期待できること・次の行動を確認できます。</p></header>
  <div class="list">${plan.goals.map((g) => {
    const ins = goalInsight(plan, state.ix, g, t);
    return `<a class="card goal-card" href="#/goal/${g.id}">
      <div class="row"><span class="imp" aria-label="重要度">${stars(g.importance || 2)}</span><span class="tag">${esc(GOAL_KB[g.cat]?.label || '')}</span></div>
      <h3>${esc(g.text)}</h3>
      <p class="small">${evidenceBadge(ins.now.evidence)} ${esc(ins.now.text)}</p>
      <span class="chev" aria-hidden="true">›</span></a>`;
  }).join('')}</div>
  <h3 class="sec">ルーティン</h3>
  <div class="list">${activeRoutines(plan).map((r) => {
    const kb = ROUTINE_KB[r.cat] || ROUTINE_KB.custom;
    return `<a class="card r-card" href="#/routine/${r.id}"><span class="glyph c-${r.cat}">${kb.glyph}</span><span class="grow"><b>${esc(r.text)}</b><br><span class="muted small">${daysLabel(r.days)} ${r.time || ''}・${esc(kb.expects[0])}</span></span><span class="chev" aria-hidden="true">›</span></a>`;
  }).join('')}</div>
  ${legend()}`;
}

function legend() {
  return `<details class="card legend"><summary>A・B・C の見方</summary>
    <ul>${Object.values(EVIDENCE).map((e) => `<li>${evidenceBadge(e.label)} <b>${e.name}</b>：${esc(e.desc)}</li>`).join('')}</ul></details>`;
}

function checkpoints(kbList, start, t) {
  const st = checkpointStage(start, t);
  return `<ul class="cp">${st.pts.map((p) => `<li class="${st.current === p.key ? 'now' : p.date <= t ? 'past' : ''}"><b>${p.label}（${fmtDate(p.date)}）${st.current === p.key ? ' ← 次の確認' : p.date <= t ? ' 済' : ''}</b>${kbList.map((kb) => `<div class="small">${kbList.length > 1 ? `<span class="muted">${esc(kb.label)}：</span>` : ''}${esc(kb.checkpoints[p.key])}</div>`).join('')}</li>`).join('')}</ul>
  ${st.current === 'done' ? '<p class="small">3か月を過ぎました。目標やルーティンの見直しも検討しましょう。</p>' : ''}`;
}

function refsBlock(kbList) {
  const refs = [...new Map(kbList.flatMap((kb) => kb.refs).map((r) => [r.t, r])).values()];
  if (!refs.length) return '';
  return `<details class="refs"><summary>参考資料（${refs.length}）</summary><ul>${refs.map((x) => `<li>${esc(x.t)}<br><span class="muted">${esc(x.n)}</span></li>`).join('')}</ul></details>`;
}

function expertNote(domains) {
  const ex = expertsFor(domains);
  if (!ex.length) return '';
  return `<p class="muted small coach-note">${COACH.name}より（参照した視点：${ex.map((e) => esc(e.field)).join('・')}）</p>`;
}

// ---- 簡易グラフ（単一系列・凡例なし・ポイントにツールチップ・表表示つき）
function chart(series, { label, unit = '', base = null, lowerBetter = false, decimals = 0 }) {
  if (series.length < 2) return `<p class="muted small">グラフを表示するには記録が2件以上必要です。</p>`;
  const W = 320;
  const H = 140;
  const P = { l: 30, r: 10, t: 12, b: 22 };
  const vals = series.map((s) => s.v).concat(base != null ? [base] : []);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi === lo) {
    hi += 1;
    lo -= 1;
  }
  const x = (i) => P.l + (i * (W - P.l - P.r)) / Math.max(1, series.length - 1);
  const y = (v) => P.t + ((hi - v) * (H - P.t - P.b)) / (hi - lo);
  const fmt = (v) => (decimals ? round1(v) : Math.round(v));
  const path = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.v).toFixed(1)}`).join('');
  const id = 'c' + Math.random().toString(36).slice(2, 7);
  return `<figure class="chart">
    <figcaption>${esc(label)}${lowerBetter ? '<span class="muted small">（低いほど軽い）</span>' : ''}</figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}の推移">
      <line class="axis" x1="${P.l}" x2="${W - P.r}" y1="${H - P.b}" y2="${H - P.b}"/>
      <text class="tick" x="${P.l - 4}" y="${y(hi) + 4}" text-anchor="end">${fmt(hi)}</text>
      <text class="tick" x="${P.l - 4}" y="${y(lo) + 4}" text-anchor="end">${fmt(lo)}</text>
      ${base != null ? `<line class="base" x1="${P.l}" x2="${W - P.r}" y1="${y(base)}" y2="${y(base)}"/><text class="tick" x="${W - P.r}" y="${y(base) - 4}" text-anchor="end">初回 ${fmt(base)}</text>` : ''}
      <path class="series" d="${path}"/>
      ${series.map((s, i) => `<g class="pt"><circle class="hit" cx="${x(i)}" cy="${y(s.v)}" r="12"/><circle class="dot" cx="${x(i)}" cy="${y(s.v)}" r="4"/><title>${fmtDate(s.date)}：${fmt(s.v)}${unit}</title></g>`).join('')}
      <text class="tick" x="${P.l}" y="${H - 6}">${fmtDate(series[0].date)}</text>
      <text class="tick" x="${W - P.r}" y="${H - 6}" text-anchor="end">${fmtDate(series.at(-1).date)}</text>
    </svg>
    <details class="table-view"><summary>表で見る</summary><table><thead><tr><th>日付</th><th>${esc(label)}</th></tr></thead><tbody>${series.map((s) => `<tr><td>${fmtDate(s.date)}</td><td>${fmt(s.v)}${unit}</td></tr>`).join('')}</tbody></table></details>
  </figure>`;
}

function metricChart(key, plan, t) {
  const from = addDaysYmd(t, -59);
  if (key === 'sleepHours') {
    const ss = sleepSessions(state.ix).filter((s) => s.date >= from);
    return chart(ss.map((s) => ({ date: s.date, v: s.minutes / 60 })), { label: '睡眠時間', unit: '時間', decimals: 1 });
  }
  if (!['fatigue', 'sleepiness', 'weight', 'mood'].includes(key)) return '';
  const base = plan.baseline?.[key];
  return chart(metricSeries(state.ix, key, from, t), {
    label: METRIC_LABEL[key],
    unit: key === 'weight' ? 'kg' : '',
    base: base === '' || base == null ? null : +base,
    lowerBetter: key !== 'weight' && key !== 'mood',
    decimals: key === 'weight' ? 1 : 0,
  });
}

export function renderGoal(id) {
  const plan = state.plan;
  const g = plan.goals.find((x) => x.id === id);
  if (!g) return '<p class="empty">目標が見つかりません。</p>';
  const t = today();
  const ins = goalInsight(plan, state.ix, g, t);
  const kbs = [...new Map(ins.routines.map((x) => [x.r.cat, x.kb])).values()];
  const expects = kbs.flatMap((kb) => kb.expects.slice(0, 2).map((e) => ({ e, kb })));
  const st = checkpointStage(plan.startDate, t);
  return `
  <a class="back" href="#/goals">‹ 目標</a>
  <header class="page-head"><div class="row"><span class="imp">${stars(g.importance || 2)}</span><span class="tag">${esc(ins.g.label)}</span></div><h1>${esc(g.text)}</h1>
  <p class="muted small">① 今の目標 ・ 開始から${st.day}日目</p></header>

  <section class="card focus"><h3>② 今の状態</h3>${line(ins.now)}${ins.actual.slice(0, 1).map(line).join('')}</section>
  <section class="card focus"><h3>③ 続けることで期待できること</h3>
    ${expects.length ? `<ul class="expects">${expects.map((x) => `<li>${evidenceBadge('A')} ${esc(x.e)}${kbs.length > 1 ? ` <span class="muted small">（${esc(x.kb.label)}）</span>` : ''}</li>`).join('')}</ul>` : '<p class="muted">関連するルーティンを登録すると表示されます。</p>'}
  </section>
  <section class="card focus next"><h3>⑦ 次の行動</h3><p>${esc(ins.next)}</p>${expertNote([g.cat, ...ins.routines.map((x) => x.r.cat)])}</section>

  <details class="card more"><summary>④ なぜその効果が期待できるのか</summary>
    ${kbs.map((kb) => `<h4>${esc(kb.label)} <span class="muted small">${STRENGTH_LABEL[kb.strength]}</span></h4><p>${esc(kb.why)}</p><p class="uncert">${esc(kb.uncertainty)}</p>`).join('')}
    ${refsBlock(kbs)}
  </details>
  <details class="card more"><summary>⑤ 1週間・1か月・3か月の確認ポイント</summary>${checkpoints(kbs.length ? kbs : [ROUTINE_KB.custom], plan.startDate, t)}</details>
  <details class="card more"><summary>⑥ 実際の記録による変化</summary>
    ${ins.actual.map(line).join('') || '<p class="muted small">比較できる記録はまだありません。</p>'}
    ${metricChart(ins.g.metric, plan, t)}
    ${ins.routines.map((x) => `<a class="r-mini" href="#/routine/${x.r.id}"><span class="glyph c-${x.r.cat}">${x.kb.glyph}</span><span class="grow">${esc(x.r.text)}<br><span class="small">${evidenceBadge(x.status.evidence)} ${esc(x.status.text)}</span></span>›</a>`).join('')}
  </details>`;
}

export function renderRoutine(id) {
  const plan = state.plan;
  const r = plan.routines.find((x) => x.id === id);
  if (!r) return '<p class="empty">ルーティンが見つかりません。</p>';
  const t = today();
  const ins = routineInsight(plan, state.ix, r, t);
  const kb = ins.kb;
  const goals = plan.goals.filter((g) => r.goalIds?.includes(g.id));
  const metric = { sleep: 'sleepHours', wake: 'sleepHours', meal: 'sleepiness', journal: 'mood' }[r.cat];
  return `
  <a class="back" href="#/goals">‹ 目標</a>
  <header class="page-head"><div class="row"><span class="glyph c-${r.cat}">${kb.glyph}</span><span class="tag">${esc(kb.label)}</span></div>
  <h1>${esc(r.text)}</h1><p class="muted small">① ${daysLabel(r.days)} ${r.time || ''}${r.duration ? `・${r.duration}分` : ''}${goals.length ? `　→ ${goals.map((g) => esc(g.text)).join('、')}` : ''}</p></header>

  <section class="card focus"><h3>② 今日までの達成状況</h3>${line(ins.status)}</section>
  <section class="card focus"><h3>③ 期待できること <span class="muted small">${STRENGTH_LABEL[kb.strength]}</span></h3>
    <ul class="expects">${kb.expects.map((e) => `<li>${evidenceBadge('A')} ${esc(e)}</li>`).join('')}</ul>
    <h4>確認する項目</h4><div class="chips">${kb.metrics.map((m) => `<span class="chip">${esc(m)}</span>`).join('')}</div>
  </section>
  <section class="card focus next"><h3>⑦ 次の行動</h3><p>${esc(ins.next)}</p>${expertNote([r.cat])}</section>

  <details class="card more"><summary>④ なぜその効果が期待できるのか</summary><p>${esc(kb.why)}</p><p class="uncert">${esc(kb.uncertainty)}</p>${refsBlock([kb])}</details>
  <details class="card more"><summary>⑤ 1週間・1か月・3か月の確認ポイント</summary>${checkpoints([kb], r.since && r.since > plan.startDate ? r.since : plan.startDate, t)}</details>
  <details class="card more"><summary>⑥ 実際の記録による変化</summary>${ins.actual.map(line).join('') || '<p class="muted small">比較できる記録はまだありません。</p>'}${metric ? metricChart(metric, plan, t) : ''}</details>
  ${kb.cautions.length ? `<details class="card more"><summary>注意点</summary><ul>${kb.cautions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></details>` : ''}
  <details class="card more"><summary>実現しやすくする工夫</summary><ul>${kb.tips.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></details>`;
}
