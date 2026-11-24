// その他：健康診断・AIコーチ・設定の見直し・バックアップ
import { state, actions, today, rerender, go, toast, evidenceBadge, saveSettings } from '../core.js';
import { esc, uid, fmtDate, addDaysYmd, avg, fmtDur, round1, ymd, daysBetween } from '../util.js';
import { ROUTINE_KB, ROUTINE_CATS, CHECKUP_ITEMS, CHECKUP_JUDGEMENTS, CHECKUP_ALERT } from '../knowledge.js';
import { activeRoutines } from '../planner.js';
import { routineInsight, sleepSessions, metricSeries, compareBaseline, METRIC_LABEL } from '../analysis.js';
import { EXPERTS, COACH, EXPERT_DISCLAIMER, expertsFor } from '../experts.js';
import { putCheckup, deleteCheckup, clearAll } from '../db.js';
import { exportEncrypted, importEncrypted } from '../backup.js';
import { aiAvailable, aiAsk } from '../ai.js';

export function renderMore() {
  return `<header class="page-head"><h1>その他</h1></header>
  <nav class="menu">
    <a class="card menu-item" href="#/checkups"><b>健康診断</b><span class="muted small">健診結果の保存・過去との比較</span><span class="chev">›</span></a>
    <a class="card menu-item" href="#/coach"><b>AIコーチに相談</b><span class="muted small">記録をもとに、統合AIコーチが答えます</span><span class="chev">›</span></a>
  </nav>
  <h3 class="sec">設定の見直し</h3>
  <nav class="menu">
    ${['理想の自分と目標', '現在の生活', '理想のルーティン', '1週間の予定', '未来の見通し'].map((s, i) => `<button class="card menu-item" data-action="editPlan" data-step="${i + 1}"><b>STEP ${i + 1}　${s}</b><span class="chev">›</span></button>`).join('')}
  </nav>
  <h3 class="sec">データ</h3>
  <nav class="menu">
    <a class="card menu-item" href="#/backup"><b>暗号化バックアップ・復元</b><span class="chev">›</span></a>
    <a class="card menu-item" href="#/experts"><b>AI専門家チームについて</b><span class="chev">›</span></a>
    <a class="card menu-item" href="#/about"><b>このアプリについて</b><span class="chev">›</span></a>
  </nav>`;
}

export function renderAbout() {
  return `<a class="back" href="#/more">‹ その他</a><header class="page-head"><h1>このアプリについて</h1></header>
  <section class="card prose">
    <p><b>MY LIFE</b> は個人専用の生活設計アプリです。記録はすべてこの端末の中（ブラウザの保存領域）に保存され、外部のサーバーには送信されません。月額のサーバー契約は不要です。</p>
    <p>「期待できる変化」は、公的ガイドラインや研究などの一般的な知見（${evidenceBadge('A')}）と、あなた自身の記録（${evidenceBadge('B')}）を分けて表示します。記録が不足している項目は ${evidenceBadge('C')} として「まだ判断できない」と表示します。疲労・血糖・体重・筋肉量・検査値などについて、改善率や将来の数値は表示しません。</p>
    <p>本アプリは医療機器ではなく、病気の診断・治療を目的としたものではありません。体調や健康診断の結果については、医療機関の判断・指示を優先してください。</p>
    <p>ブラウザのデータ消去やアプリの削除で記録が消えることがあります。定期的に「暗号化バックアップ」を保存してください。</p>
  </section>
  <section class="card danger-zone"><h3>すべてのデータを削除</h3><p class="small">設定・記録・健康診断をこの端末から削除します。元に戻せません。</p>
    <label>確認のため「削除」と入力<input id="delConfirm"></label><button class="btn danger" data-action="wipe">削除する</button></section>`;
}

export function renderExperts() {
  return `<a class="back" href="#/more">‹ その他</a><header class="page-head"><h1>AI専門家チーム</h1><p class="muted">内容に応じて適切な専門領域の視点を使い、${COACH.name}が一つの回答にまとめます。</p></header>
  <div class="list">${EXPERTS.map((e) => `<div class="card"><b>${esc(e.name)}</b><br><span class="muted small">${esc(e.field)}</span></div>`).join('')}</div>
  <p class="note info">${esc(EXPERT_DISCLAIMER)}</p>`;
}

// ---------- 健康診断 ----------
const sortedCheckups = () => [...state.checkups].sort((a, b) => (a.date < b.date ? -1 : 1));

function habitsBefore(date) {
  const from = addDaysYmd(date, -90);
  const ss = sleepSessions(state.ix).filter((s) => s.date >= from && s.date <= date);
  const wo = state.events.filter((e) => e.type === 'workout_start' && e.date >= from && e.date <= date).length;
  const fat = metricSeries(state.ix, 'fatigue', from, date);
  if (!ss.length && !wo && !fat.length) return null;
  // 記録のある期間で割る（記録開始が90日より最近の場合）
  const first = state.events.reduce((m, e) => (e.date >= from && e.date <= date && e.date < m ? e.date : m), date);
  const span = Math.max(7, daysBetween(first, date) + 1);
  return {
    sleep: ss.length >= 5 ? fmtDur(avg(ss.map((s) => s.minutes))) : '記録不足',
    workouts: span >= 14 ? round1((wo / span) * 7) : '記録不足',
    fatigue: fat.length >= 5 ? round1(avg(fat.map((x) => x.v))) : '記録不足',
  };
}

export function renderCheckups() {
  const cs = sortedCheckups();
  const latest = cs.at(-1);
  const cols = cs.slice(-5);
  const rows = CHECKUP_ITEMS.filter((it) => cols.some((c) => c.items?.[it.key]?.value !== '' && c.items?.[it.key]?.value != null));
  return `<a class="back" href="#/more">‹ その他</a>
  <header class="page-head"><h1>健康診断</h1><p class="muted">健診結果の原本はこの端末内にだけ保存されます。</p></header>
  ${latest && CHECKUP_ALERT.includes(latest.judgement) ? `<div class="note warn"><b>${fmtDate(latest.date)}の健診で「${esc(latest.judgement)}」の判定があります。</b>医療機関の指示を優先してください。このアプリの記録や提案は、受診や治療の代わりにはなりません。</div>` : ''}
  <button class="btn primary" data-action="newCheckup">＋ 健診結果を追加</button>
  ${cs.length ? `<div class="list">${[...cs].reverse().map((c) => `<a class="card r-card" href="#/checkup/${c.id}"><span class="grow"><b>${fmtDate(c.date)}</b>${c.judgement ? `　<span class="tag ${CHECKUP_ALERT.includes(c.judgement) ? 'tag-warn' : ''}">${esc(c.judgement)}</span>` : ''}<br><span class="muted small">${c.verified ? '✓ 原本と照合済み' : '未照合'}${c.fileName ? '・原本あり' : ''}</span></span><span class="chev">›</span></a>`).join('')}</div>` : '<p class="empty">まだ健診結果はありません。</p>'}
  ${cols.length >= 2 && rows.length ? `<section class="card"><h3>過去との比較</h3>
    <div class="table-wrap"><table class="cmp"><thead><tr><th>項目</th>${cols.map((c) => `<th>${c.date.slice(0, 4)}<br><span class="muted small">${c.date.slice(5).replace('-', '/')}</span>${c.verified ? '' : '<br><span class="muted small">未照合</span>'}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((it) => `<tr><th>${esc(it.name)}<br><span class="muted small">${esc(it.unit)}</span></th>${cols.map((c, i) => {
      const v = c.items?.[it.key];
      const prev = cols[i - 1]?.items?.[it.key]?.value;
      const arrow = v?.value !== '' && v?.value != null && prev !== '' && prev != null ? (+v.value > +prev ? '↑' : +v.value < +prev ? '↓' : '→') : '';
      return `<td>${v?.value ?? '—'}${v?.flag ? ` <b class="flag">${esc(v.flag)}</b>` : ''} <span class="muted small">${arrow}</span></td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="muted small">↑↓は前回との数値の上下のみを示し、良し悪しの判断ではありません。H・Lなどの印は健診結果に記載されたものです。</p>
  </section>` : ''}
  ${cs.length ? `<section class="card"><h3>健診前の生活習慣（90日間）</h3>
    ${cs.map((c) => {
      const h = habitsBefore(c.date);
      return `<p class="small"><b>${fmtDate(c.date)}</b>　${h ? `平均睡眠 ${h.sleep}・筋トレ ${typeof h.workouts === 'number' ? `週${h.workouts}回` : h.workouts}・疲労度 ${h.fatigue}` : 'この期間の記録はありません'}</p>`;
    }).join('')}
    <p class="note info small">生活習慣と検査値を並べて表示していますが、日常の習慣が特定の検査値を改善した（悪化させた）と判断することはできません。</p>
  </section>` : ''}`;
}

export function renderCheckup(id) {
  const isNew = id === 'new';
  let c = state.ui.ck;
  if (!c || c.id !== id) {
    const found = state.checkups.find((x) => x.id === id);
    c = state.ui.ck = found ? { ...found, items: { ...(found.items || {}) } } : { id: 'new', date: ymd(), items: {}, judgement: '', verified: false, memo: '', file: null, fileName: '' };
  }
  if (state.ui.ckUrl) URL.revokeObjectURL(state.ui.ckUrl);
  state.ui.ckUrl = c.file ? URL.createObjectURL(c.file) : null;
  const isImg = c.file?.type?.startsWith('image/');
  return `<a class="back" href="#/checkups">‹ 健康診断</a>
  <header class="page-head"><h1>${isNew ? '健診結果を追加' : `${fmtDate(c.date)}の健診`}</h1></header>
  <section class="card">
    <label>受診日<input type="date" id="ckDate" value="${esc(c.date)}"></label>
    <label>健診結果の原本（写真・PDF）<input type="file" id="ckFile" accept="image/*,application/pdf" data-action-change="ckFile"></label>
    ${c.file ? `<div class="ck-file">${isImg ? `<img src="${state.ui.ckUrl}" alt="健診結果の原本">` : ''}<a class="btn ghost small" href="${state.ui.ckUrl}" target="_blank" rel="noopener">原本を開く（${esc(c.fileName)}）</a></div>` : ''}
    <p class="muted small">現在、原本からの自動読み取りには対応していません。原本を見ながら数値を入力し、最後に照合してください。正確さを優先するため、読み取れない項目は空欄のままにしてください。</p>
  </section>
  <section class="card"><h3>総合判定</h3>
    <select id="ckJudge"><option value="">未入力</option>${CHECKUP_JUDGEMENTS.map((j) => `<option ${c.judgement === j ? 'selected' : ''}>${j}</option>`).join('')}</select>
  </section>
  <section class="card"><h3>検査値</h3>
    <div class="ck-items">${CHECKUP_ITEMS.map((it) => {
      const v = c.items[it.key] || {};
      return `<div class="ck-row"><label for="ck_${it.key}">${esc(it.name)} <span class="muted small">${esc(it.unit)}</span></label>
      <input id="ck_${it.key}" type="number" inputmode="decimal" step="any" value="${esc(v.value ?? '')}">
      <select id="ckf_${it.key}" aria-label="${esc(it.name)}の印"><option value="">印なし</option>${['H', 'L', '*', '要注意'].map((f) => `<option ${v.flag === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>`;
    }).join('')}</div>
    <label>メモ（医師のコメント・指示など）<textarea id="ckMemo" rows="3">${esc(c.memo || '')}</textarea></label>
    <label class="check-label"><input type="checkbox" id="ckVerified" ${c.verified ? 'checked' : ''}> 入力した数値を原本と照合しました</label>
  </section>
  <div class="row gap">${isNew ? '' : '<button class="btn danger" data-action="delCheckup">削除</button>'}<button class="btn primary grow" data-action="saveCheckup">保存</button></div>`;
}

function readCheckupForm() {
  const c = state.ui.ck;
  c.date = document.getElementById('ckDate').value || c.date;
  c.judgement = document.getElementById('ckJudge').value;
  c.memo = document.getElementById('ckMemo').value;
  c.verified = document.getElementById('ckVerified').checked;
  for (const it of CHECKUP_ITEMS) {
    const v = document.getElementById(`ck_${it.key}`).value;
    const f = document.getElementById(`ckf_${it.key}`).value;
    if (v === '' && !f) delete c.items[it.key];
    else c.items[it.key] = { value: v === '' ? '' : +v, flag: f };
  }
  return c;
}

// ---------- AIコーチ ----------
const RED_FLAGS = /胸が痛|胸痛|息苦し|呼吸が苦し|動悸|めまい|しびれ|意識|吐血|血便|激しい痛|ろれつ/;

function ruleAnswer(q) {
  const t = today();
  const plan = state.plan;
  let cats = ROUTINE_CATS.filter((c) => c !== 'custom' && ROUTINE_KB[c].keywords.some((k) => q.includes(k)));
  if (/疲|だる|バテ/.test(q)) cats.push('sleep', 'cardio');
  if (/眠/.test(q)) cats.push('sleep', 'meal');
  cats = [...new Set(cats)].slice(0, 2);
  const checkup = /健診|健康診断|血圧|血糖|検査|コレステロール|HbA1c/i.test(q);
  const parts = [];
  if (RED_FLAGS.test(q)) parts.push('その症状は、早めに医療機関に相談してください。強い症状や急な症状の場合は、ためらわず救急受診や119番を検討してください。');
  for (const c of cats) {
    const kb = ROUTINE_KB[c];
    let p = `【${kb.label}】一般的には、${kb.expects[0]}が期待されます。${kb.why.split('。')[0]}。`;
    const r = activeRoutines(plan).find((x) => x.cat === c);
    if (r) {
      const ins = routineInsight(plan, state.ix, r, t);
      p += `\nあなたの記録では、${ins.status.text}`;
      const a = ins.actual.find((x) => x.evidence === 'B');
      if (a) p += a.text;
      p += `\n次の一歩：${ins.next}`;
    } else p += `\n工夫：${kb.tips[0]}`;
    parts.push(p);
  }
  if (/眠|疲/.test(q)) {
    const k = /眠/.test(q) ? 'sleepiness' : 'fatigue';
    const c = compareBaseline(plan, state.ix, k, t);
    parts.push(c.status === 'ok' ? `${METRIC_LABEL[k]}の記録：${c.baseLabel} ${c.base}/10 → 最近 ${c.recentAvg}/10。変化の原因は断定できません。` : `${METRIC_LABEL[k]}の記録がまだ少ないため、あなた自身の傾向は判断できません。「今日の感想」で数字を残すと比較できるようになります。`);
  }
  if (checkup) {
    const last = sortedCheckups().at(-1);
    parts.push(last ? `最新の健診（${fmtDate(last.date)}）の総合判定は「${last.judgement || '未入力'}」です。検査値の解釈や対応は、健診機関・主治医の説明と指示を優先してください。このアプリでは、生活習慣と検査値を並べて確認できますが、因果関係は判断できません。` : '健診結果はまだ登録されていません。「健康診断」から追加できます。');
  }
  if (!parts.length) parts.push('ご質問の内容に合う情報が見つかりませんでした。筋トレ・食事・睡眠・疲れ・眠気・読書・勉強・家族時間・健診など、テーマを含めて質問してみてください。');
  const domains = [...cats, ...(checkup ? ['checkup'] : [])];
  return { text: parts.join('\n\n'), experts: expertsFor(domains) };
}

function contextSummary() {
  const t = today();
  const plan = state.plan;
  const lines = [`目標：${plan.goals.map((g) => g.text).join('、')}`];
  for (const r of activeRoutines(plan)) lines.push(`ルーティン「${r.text}」：${routineInsight(plan, state.ix, r, t).status.text}`);
  for (const k of ['sleepiness', 'fatigue']) {
    const c = compareBaseline(plan, state.ix, k, t);
    lines.push(`${METRIC_LABEL[k]}：${c.status === 'ok' ? `${c.base}→${c.recentAvg}` : '記録不足'}`);
  }
  if (plan.profile?.limits) lines.push(`健康上の制限：${plan.profile.limits}`);
  return lines.join('\n');
}

export function renderCoach() {
  const a = state.ui.coachAnswer;
  return `<a class="back" href="#/more">‹ その他</a>
  <header class="page-head"><h1>AIコーチに相談</h1><p class="muted">記録をもとに、${COACH.name}が一つの回答にまとめます。</p></header>
  <form class="card" data-action-submit="ask">
    <textarea id="coachQ" rows="3" placeholder="例：最近、昼食後の眠気が強いのはなぜ？">${esc(state.ui.coachQ || '')}</textarea>
    <button class="btn primary">相談する</button>
  </form>
  ${a ? `<section class="card answer"><h3>${COACH.name}</h3><p class="pre">${esc(a.text)}</p>${a.experts?.length ? `<p class="muted small">参照した視点：${a.experts.map((e) => esc(e.field)).join('・')}</p>` : ''}<p class="muted small">${a.mode === 'ai' ? '端末内の生成AIで作成した回答です。' : '端末内のルールと知見データで作成した回答です。'}内容は一般的な情報であり、診断ではありません。</p></section>` : ''}
  <p class="muted small">${esc(EXPERT_DISCLAIMER)}</p>`;
}

// ---------- バックアップ ----------
export function renderBackup() {
  return `<a class="back" href="#/more">‹ その他</a><header class="page-head"><h1>暗号化バックアップ</h1></header>
  <section class="card"><h3>バックアップを保存</h3>
    <p class="small">設定・記録・健診（原本を含む）を、パスワードで暗号化した1つのファイルとして端末に保存します。パスワードを忘れると復元できません。</p>
    <label>パスワード（8文字以上）<input type="password" id="bkPass" autocomplete="new-password"></label>
    <label>パスワード（確認）<input type="password" id="bkPass2" autocomplete="new-password"></label>
    <button class="btn primary" data-action="doExport">バックアップを保存</button>
    ${state.settings.lastBackup ? `<p class="muted small">前回の保存：${new Date(state.settings.lastBackup).toLocaleString('ja-JP')}</p>` : ''}
  </section>
  <section class="card"><h3>バックアップから復元</h3>
    <p class="small">現在の端末内のデータは、バックアップの内容で置き換えられます。</p>
    <input type="file" id="rsFile">
    <label>パスワード<input type="password" id="rsPass" autocomplete="current-password"></label>
    <button class="btn" data-action="doImport">復元する</button>
  </section>`;
}

Object.assign(actions, {
  newCheckup() {
    state.ui.ck = null;
    go('#/checkup/new');
  },
  async ckFile(el) {
    const f = el.files?.[0];
    if (!f) return;
    readCheckupForm();
    state.ui.ck.file = f;
    state.ui.ck.fileName = f.name;
    rerender();
  },
  async saveCheckup() {
    const c = readCheckupForm();
    if (c.id === 'new') c.id = uid();
    c.updatedAt = Date.now();
    await putCheckup(c);
    const i = state.checkups.findIndex((x) => x.id === c.id);
    if (i >= 0) state.checkups[i] = c;
    else state.checkups.push(c);
    state.ui.ck = null;
    toast(c.verified ? '保存しました' : '保存しました（原本との照合が未完了です）');
    go('#/checkups');
  },
  async delCheckup() {
    if (!confirm('この健診結果を削除しますか？')) return;
    await deleteCheckup(state.ui.ck.id);
    state.checkups = state.checkups.filter((x) => x.id !== state.ui.ck.id);
    state.ui.ck = null;
    go('#/checkups');
  },
  async ask() {
    const q = document.getElementById('coachQ').value.trim();
    if (!q) return;
    state.ui.coachQ = q;
    const base = ruleAnswer(q);
    state.ui.coachAnswer = { ...base, mode: 'rule' };
    if (!RED_FLAGS.test(q) && (await aiAvailable())) {
      try {
        state.ui.coachAnswer = { text: await aiAsk(contextSummary(), q), experts: base.experts, mode: 'ai' };
      } catch {
        /* ルールベースの回答を使う */
      }
    }
    rerender();
  },
  async doExport() {
    const p = document.getElementById('bkPass').value;
    if (p.length < 8) return toast('パスワードは8文字以上にしてください');
    if (p !== document.getElementById('bkPass2').value) return toast('パスワードが一致しません');
    toast('暗号化しています…');
    const blob = await exportEncrypted(p);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mylife-backup-${ymd().replace(/-/g, '')}.mylife`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    state.settings.lastBackup = Date.now();
    await saveSettings();
    toast('バックアップを保存しました');
  },
  async doImport() {
    const f = document.getElementById('rsFile').files?.[0];
    const p = document.getElementById('rsPass').value;
    if (!f || !p) return toast('ファイルとパスワードを指定してください');
    if (!confirm('現在のデータを置き換えて復元しますか？')) return;
    try {
      await importEncrypted(await f.text(), p);
      toast('復元しました');
      location.hash = '#/today';
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      toast(e.message || '復元できませんでした');
    }
  },
  async wipe() {
    if (document.getElementById('delConfirm').value.trim() !== '削除') return toast('「削除」と入力してください');
    await clearAll();
    location.hash = '';
    location.reload();
  },
});
