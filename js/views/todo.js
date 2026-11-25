// やること（ToDo）：自由に登録・保存。終わっていないものは翌日に持ち越す（責めない表示）
import { state, actions, rerender, toast, openSheet, closeSheet, today } from '../core.js';
import { kvSet } from '../db.js';
import { esc, uid, fmtDate, addDaysYmd } from '../util.js';

const save = () => kvSet('todos', state.todos);
const byTime = (a, b) => (a.time || '99') .localeCompare(b.time || '99') || a.createdAt - b.createdAt;

export function todoSection() {
  const t = today();
  const all = state.todos || [];
  const open = all.filter((x) => !x.done && (!x.date || x.date <= t)).sort((a, b) => (a.date || t).localeCompare(b.date || t) || byTime(a, b));
  const doneToday = all.filter((x) => x.done && x.doneDate === t);
  const later = all.filter((x) => !x.done && x.date && x.date > t);

  const row = (x) => `<li><button class="check ${x.done ? 'on' : ''}" data-action="toggleTodo" data-id="${x.id}" aria-pressed="${!!x.done}"><span class="box">${x.done ? '✓' : ''}</span></button>
    <button class="todo-text" data-action="editTodo" data-id="${x.id}"><span class="${x.done ? 'done-text' : ''}">${esc(x.text)}</span>${x.time || (x.date && x.date < t && !x.done) || x.memo ? `<br><span class="muted small">${x.time ? x.time + ' ' : ''}${x.date && x.date < t && !x.done ? `${fmtDate(x.date)}から持ち越し ` : ''}${x.memo ? '・メモあり' : ''}</span>` : ''}</button></li>`;

  return `<section class="card todo">
    <h3>やること</h3>
    <form class="add-row" data-action-submit="addTodo">
      <input id="newTodo" placeholder="例：健診の予約をする" aria-label="やることを入力" autocomplete="off">
      <button class="btn primary">追加</button>
    </form>
    ${open.length ? `<ul class="checks">${open.map(row).join('')}</ul>` : `<p class="muted small">${doneToday.length ? '今日のやることは全部終わりました。' : 'やることを書いて「追加」を押すと保存されます。'}</p>`}
    ${doneToday.length ? `<details class="todo-done"><summary class="muted small">終わったこと（${doneToday.length}）</summary><ul class="checks">${doneToday.map(row).join('')}</ul></details>` : ''}
    ${later.length ? `<button class="btn ghost small" data-action="showLater">明日以降のやること（${later.length}件）</button>` : ''}
  </section>`;
}

function editSheet(x) {
  const t = today();
  const opt = (v, l) => `<option value="${v}" ${(x.date || '') === v ? 'selected' : ''}>${l}</option>`;
  const custom = x.date && ![t, addDaysYmd(t, 1)].includes(x.date);
  openSheet(x.id ? 'やることの修正' : 'やること', `
    <label>内容<input id="tdText" value="${esc(x.text)}"></label>
    <div class="grid2">
      <label>いつ<select id="tdWhen">${opt(t, '今日')}${opt(addDaysYmd(t, 1), '明日')}${opt('', '日付なし')}${custom ? opt(x.date, fmtDate(x.date)) : ''}<option value="pick">日付を選ぶ…</option></select></label>
      <label>時刻<span class="muted small"> 任意</span><input type="time" id="tdTime" value="${esc(x.time || '')}"></label>
    </div>
    <label id="tdPickWrap" hidden>日付<input type="date" id="tdPick" value="${esc(x.date || t)}"></label>
    <label>メモ<span class="muted small"> 任意</span><textarea id="tdMemo" rows="2">${esc(x.memo || '')}</textarea></label>
    <div class="row gap"><button class="btn danger" data-action="delTodo" data-id="${x.id}">削除</button><button class="btn primary grow" data-action="saveTodo" data-id="${x.id}">保存</button></div>`);
  document.getElementById('tdWhen').addEventListener('change', (e) => (document.getElementById('tdPickWrap').hidden = e.target.value !== 'pick'));
}

Object.assign(actions, {
  async addTodo() {
    const el = document.getElementById('newTodo');
    const text = el.value.trim();
    if (!text) return;
    state.todos.push({ id: uid(), text, date: today(), time: '', memo: '', done: false, createdAt: Date.now() });
    await save();
    rerender();
    document.getElementById('newTodo')?.focus();
  },
  async toggleTodo(el) {
    const x = state.todos.find((y) => y.id === el.dataset.id);
    x.done = !x.done;
    x.doneDate = x.done ? today() : null;
    await save();
    if (x.done) toast('おつかれさまでした');
    rerender();
  },
  editTodo(el) {
    editSheet(state.todos.find((y) => y.id === el.dataset.id));
  },
  async saveTodo(el) {
    const x = state.todos.find((y) => y.id === el.dataset.id);
    const text = document.getElementById('tdText').value.trim();
    if (!text) return toast('内容を入力してください');
    const when = document.getElementById('tdWhen').value;
    x.text = text;
    x.date = when === 'pick' ? document.getElementById('tdPick').value || today() : when;
    x.time = document.getElementById('tdTime').value;
    x.memo = document.getElementById('tdMemo').value.trim();
    await save();
    closeSheet();
    toast('保存しました');
    rerender();
  },
  async delTodo(el) {
    state.todos = state.todos.filter((y) => y.id !== el.dataset.id);
    await save();
    closeSheet();
    toast('削除しました');
    rerender();
  },
  showLater() {
    const t = today();
    const later = state.todos.filter((x) => !x.done && x.date && x.date > t).sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b));
    openSheet('明日以降のやること', `<ul class="later">${later.map((x) => `<li><button class="log-row" data-action="editTodo" data-id="${x.id}"><time>${fmtDate(x.date)}</time><span>${esc(x.text)}${x.time ? ` <span class="muted small">${x.time}</span>` : ''}</span></button></li>`).join('')}</ul>`);
  },
});
