// 週間予定と、週次の振り返り・翌週の提案
import { state, actions, today, rerender, go, savePlan, saveProposals, toast, evidenceBadge } from '../core.js';
import { esc, ymd, mondayOf, parseYmd, fmtDate, addDaysYmd, daysBetween } from '../util.js';
import { weekView, newDraft } from './setup.js';
import { weeklyProposals, weekSummary, routineStats, paceText, compareBaseline, sleepSummary, METRIC_LABEL } from '../analysis.js';
import { saveDraftNow } from '../core.js';

export function renderWeek() {
  return `<header class="page-head"><h1>1週間の予定</h1><p class="muted">承認済みの「理想の1週間」です。</p></header>
  ${weekView(state.plan, false)}
  <button class="btn ghost" data-action="editPlan" data-step="3">ルーティン・予定を見直す</button>`;
}

export function renderReview() {
  const plan = state.plan;
  const t = today();
  const days = daysBetween(plan.startDate, t);
  const weekKey = ymd(mondayOf(parseYmd(t)));
  const decided = state.proposals[weekKey] || {};
  const props = weeklyProposals(plan, state.ix, t);
  const sum = weekSummary(plan, state.ix, t);

  const props_html =
    days < 7
      ? `<p class="muted">初回設定から1週間たつと、記録をもとに翌週の予定を提案します（あと${7 - days}日）。</p>`
      : props.length
        ? props.map((p) => {
            const st = decided[p.id];
            return `<div class="proposal ${st || ''}"><p>${esc(p.text)}</p>${st ? `<p class="muted small">${st === 'accepted' ? '✓ 承認しました' : '見送りました'}</p>` : `<div class="row gap"><button class="btn ghost small" data-action="decline" data-id="${p.id}">見送る</button><button class="btn primary small" data-action="accept" data-id="${p.id}">承認する</button></div>`}</div>`;
          }).join('')
        : '<p class="muted">今週は特に変更の提案はありません。今の予定で続けてみましょう。</p>';

  const comps = ['sleepiness', 'fatigue'].map((k) => ({ k, c: compareBaseline(plan, state.ix, k, t) }));
  const sl = sleepSummary(state.ix, t);

  return `<header class="page-head"><h1>振り返り</h1><p class="muted">${fmtDate(addDaysYmd(t, -6))}〜${fmtDate(t)}・開始から${days + 1}日目</p></header>
  <section class="card"><h3>来週への提案</h3><p class="muted small">提案は、承認するまで予定に反映されません。</p>${props_html}</section>
  <section class="card"><h3>この7日間</h3>
    <ul class="sum">${sum.map(({ r, s, d }) => `<li><a href="#/routine/${r.id}"><span class="grow">${esc(r.text)}</span><b>${d}</b><span class="muted">／予定${s}</span></a></li>`).join('')}</ul>
  </section>
  <section class="card"><h3>目標と実績（直近4週間）</h3>
    ${plan.routines.filter((r) => r.active !== false && r.days?.length < 7).map((r) => {
      const st = routineStats(plan, state.ix, r, t);
      return st.scheduled ? `<p class="ins">${evidenceBadge('B')} 「${esc(r.text)}」：${st.days >= 28 ? '4週間' : st.days + '日間'}で${st.doneAll}回（予定${st.scheduled}回）。${paceText(st.doneAll, st.scheduled)}</p>` : '';
    }).join('')}
    ${comps.map(({ k, c }) => (c.status === 'ok' ? `<p class="ins">${evidenceBadge('B')} ${METRIC_LABEL[k]}：${c.baseLabel} ${c.base}/10 → 最近 ${c.recentAvg}/10（原因は断定できません）</p>` : `<p class="ins">${evidenceBadge('C')} ${METRIC_LABEL[k]}：記録が不足しているため、まだ比較できません。</p>`)).join('')}
    ${sl.status === 'ok' ? '' : `<p class="ins">${evidenceBadge('C')} 睡眠：「寝る」「起きた」の記録が${sl.n}日分のため、まだ傾向は判断できません。</p>`}
  </section>
  ${(plan.history || []).length ? `<details class="card more"><summary>変更の履歴</summary><ul class="small">${[...plan.history].reverse().map((h) => `<li>${fmtDate(h.date)}：${esc(h.text)}</li>`).join('')}</ul></details>` : ''}`;
}

function findProposal(id) {
  return weeklyProposals(state.plan, state.ix, today()).find((p) => p.id === id);
}

Object.assign(actions, {
  async accept(el) {
    const p = findProposal(el.dataset.id);
    if (!p) return rerender();
    const weekKey = ymd(mondayOf(parseYmd(today())));
    if (p.change.type === 'setDays') {
      const r = state.plan.routines.find((x) => x.id === p.change.routineId);
      r.days = p.change.days;
      r.freq = r.days.length;
      delete r.autoDays;
    }
    state.plan.history = [...(state.plan.history || []), { date: today(), text: `提案を承認：${p.text.split('？')[0].slice(0, 60)}` }];
    state.proposals[weekKey] = { ...(state.proposals[weekKey] || {}), [p.id]: 'accepted' };
    await savePlan();
    await saveProposals();
    toast(p.change.type === 'setDays' ? '予定を変更しました' : '承認しました');
    rerender();
  },
  async decline(el) {
    const weekKey = ymd(mondayOf(parseYmd(today())));
    state.proposals[weekKey] = { ...(state.proposals[weekKey] || {}), [el.dataset.id]: 'declined' };
    await saveProposals();
    rerender();
  },
  async editPlan(el) {
    state.draft = newDraft('edit');
    state.draft.step = +(el.dataset.step || 1);
    await saveDraftNow();
    go('#/setup');
  },
});
