// 起動・画面切り替え・操作の受け付け
import { state, actions, inputHandlers, setRenderer, rerender, reindex, closeSheet } from './core.js';
import { kvGet, allEvents, allCheckups } from './db.js';
import { renderSetup, newDraft } from './views/setup.js';
import { renderToday } from './views/today.js';
import { renderGoals, renderGoal, renderRoutine } from './views/future.js';
import { renderWeek, renderReview } from './views/review.js';
import { renderMore, renderAbout, renderExperts, renderCheckups, renderCheckup, renderCoach, renderBackup } from './views/more.js';
import { esc } from './util.js';

const TABS = [
  ['today', '今日', 'M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z'],
  ['goals', '目標', 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7a5 5 0 100 10 5 5 0 000-10zM12 11a1 1 0 100 2 1 1 0 000-2z'],
  ['week', '週間', 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4'],
  ['review', '振り返り', 'M4 19V9M10 19V5M16 19v-7M22 19H2'],
  ['more', 'その他', 'M5 12h.01M12 12h.01M19 12h.01'],
];

function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'today';
  const [name, id] = h.split('/');
  return { name, id };
}

function render() {
  const app = document.getElementById('app');
  const nav = document.getElementById('nav');
  let { name, id } = route();

  if (!state.plan || name === 'setup') {
    if (!state.draft) state.draft = newDraft(state.plan ? 'edit' : 'setup');
    app.innerHTML = renderSetup();
    nav.hidden = true;
    document.body.classList.add('setup-mode');
    return;
  }
  document.body.classList.remove('setup-mode');
  nav.hidden = false;

  const views = {
    today: renderToday,
    goals: renderGoals,
    goal: () => renderGoal(id),
    routine: () => renderRoutine(id),
    week: renderWeek,
    review: renderReview,
    more: renderMore,
    about: renderAbout,
    experts: renderExperts,
    checkups: renderCheckups,
    checkup: () => renderCheckup(id),
    coach: renderCoach,
    backup: renderBackup,
  };
  const fn = views[name] || renderToday;
  try {
    app.innerHTML = fn();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="card"><h3>表示中にエラーが発生しました</h3><p class="small pre">${esc(e.message)}</p><a class="btn" href="#/today">今日の画面へ</a></div>`;
  }
  const tab = { goal: 'goals', routine: 'goals', about: 'more', experts: 'more', checkups: 'more', checkup: 'more', coach: 'more', backup: 'more' }[name] || name;
  nav.innerHTML = TABS.map(([k, label, d]) => `<a href="#/${k}" class="${k === tab ? 'on' : ''}" ${k === tab ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg><span>${label}</span></a>`).join('');
}

let lastHash = location.hash;
window.addEventListener('hashchange', () => {
  closeSheet();
  render();
  if (location.hash !== lastHash) window.scrollTo(0, 0);
  lastHash = location.hash;
});

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.tagName === 'FORM') return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  ev.preventDefault();
  if (el.dataset.busy) return;
  el.dataset.busy = '1';
  try {
    await fn(el, ev);
  } catch (e) {
    console.error(e);
    alert('エラーが発生しました：' + e.message);
  } finally {
    delete el.dataset.busy;
  }
});

document.addEventListener('submit', (ev) => {
  const a = ev.target.dataset.actionSubmit;
  if (!a) return;
  ev.preventDefault();
  actions[a]?.(ev.target, ev);
});

const onInput = (ev) => {
  const el = ev.target;
  if (ev.type === 'change' && el.dataset.actionChange) return actions[el.dataset.actionChange]?.(el, ev);
  for (const h of inputHandlers) if (h(el, ev)) return;
};
document.addEventListener('input', onInput);
document.addEventListener('change', onInput);

// テキストエリアの高さを内容に合わせる
document.addEventListener('input', (ev) => {
  if (ev.target.tagName === 'TEXTAREA' && ev.target.rows === 1) {
    ev.target.style.height = 'auto';
    ev.target.style.height = ev.target.scrollHeight + 'px';
  }
});

async function boot() {
  try {
    const [plan, draft, settings, proposals, events, checkups, todos] = await Promise.all([kvGet('plan'), kvGet('draft'), kvGet('settings'), kvGet('proposals'), allEvents(), allCheckups(), kvGet('todos')]);
    Object.assign(state, { plan: plan || null, draft: draft || null, settings: settings || {}, proposals: proposals || {}, events: events || [], checkups: checkups || [], todos: todos || [] });
    reindex();
  } catch (e) {
    document.getElementById('app').innerHTML = `<div class="card"><h3>データを読み込めませんでした</h3><p class="small">${esc(e.message)}</p><p class="small">プライベートモードでは端末内保存が使えない場合があります。</p></div>`;
    return;
  }
  setRenderer(render);
  if (state.draft && state.draft.mode === 'edit' && route().name !== 'setup') state.draft = null;
  if (!state.plan && state.draft?.step > 0) setTimeout(() => import('./core.js').then((c) => c.toast('前回の続きから再開しました')), 300);
  render();
  // 端末内データが自動削除されにくくする
  navigator.storage?.persist?.().catch(() => {});
  // 日付が変わったら再描画
  let day = new Date().getDate();
  setInterval(() => {
    if (new Date().getDate() !== day) {
      day = new Date().getDate();
      rerender();
    }
  }, 60000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && rerender());
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // 新しい版が公開されたら、自動で切り替えて再読み込みする（入力途中のシートがある間は待つ）
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    const reload = () => (document.getElementById('sheet').classList.contains('open') ? setTimeout(reload, 2000) : location.reload());
    reload();
  });
  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => {})))
    .catch(() => {});
}
boot();
