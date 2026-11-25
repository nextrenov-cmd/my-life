// アプリ全体の状態・保存・共通UI
import { kvSet, putEvent, deleteEvent } from './db.js';
import { uid, dayKey, esc } from './util.js';
import { indexEvents } from './analysis.js';

export const state = {
  plan: null, // 承認済みの設定（目標・生活・ルーティン）
  draft: null, // 初回設定／見直しの途中データ
  settings: {},
  proposals: {}, // 週ごとの提案と承認状況
  events: [],
  checkups: [],
  todos: [], // やること
  ix: indexEvents([]),
  ui: {},
};

export const actions = {}; // data-action 名 → (el, ev) => void
export const inputHandlers = []; // (el, ev) => boolean（処理したら true）

let renderer = null;
export const setRenderer = (f) => (renderer = f);
export const rerender = () => renderer && renderer();
export const go = (hash) => {
  if (location.hash === hash) rerender();
  else location.hash = hash;
};

export const today = () => dayKey();

export const savePlan = () => kvSet('plan', state.plan);
export const saveSettings = () => kvSet('settings', state.settings);
export const saveProposals = () => kvSet('proposals', state.proposals);

let draftTimer = null;
export function saveDraftSoon() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => kvSet('draft', state.draft), 400);
}
export const saveDraftNow = () => {
  clearTimeout(draftTimer);
  return kvSet('draft', state.draft);
};

export function reindex() {
  state.ix = indexEvents(state.events);
}

export async function logEvent(type, data = {}, ts = Date.now()) {
  const e = { id: uid(), type, ts, date: dayKey(ts), data };
  await putEvent(e);
  state.events.push(e);
  reindex();
  return e;
}
export async function updateEvent(e) {
  e.date = dayKey(e.ts);
  await putEvent(e);
  reindex();
}
export async function removeEvent(id) {
  await deleteEvent(id);
  state.events = state.events.filter((e) => e.id !== id);
  reindex();
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

export function openSheet(title, html) {
  const el = document.getElementById('sheet');
  el.innerHTML = `<div class="sheet-backdrop" data-action="closeSheet"></div>
  <div class="sheet-panel" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-action="closeSheet" aria-label="閉じる">×</button></div>
    <div class="sheet-body">${html}</div>
  </div>`;
  el.classList.add('open');
  const first = el.querySelector('input, textarea, select');
  if (first && !first.matches('[type=checkbox]')) setTimeout(() => first.focus(), 50);
}
export function closeSheet() {
  const el = document.getElementById('sheet');
  el.classList.remove('open');
  el.innerHTML = '';
}
actions.closeSheet = closeSheet;

// 小さな部品
export const evidenceBadge = (lv) => `<span class="ev ev-${lv}" title="${{ A: '科学的知見に基づく一般的な期待効果', B: 'あなたの記録から確認できる傾向', C: '記録不足のため判断できない' }[lv]}">${lv}</span>`;
export const stars = (n) => '●'.repeat(n) + '○'.repeat(3 - n);
