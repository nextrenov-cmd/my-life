// オンデバイス生成AI（任意）。対応ブラウザ・端末でのみ使用し、なければルールベースで動作する。
// 外部サーバーへの送信は行わない。

const SYSTEM = `あなたは生活習慣アプリ「MY LIFE」の統合AIコーチです。日本語で、やさしく簡潔に答えます。
守ること：
- 疲労・血糖・体重・筋肉量・検査値について、改善率や将来の数値を作らない。断定しない。
- 一般的な知見と、本人の記録から分かることを区別する。記録が足りなければそう伝える。
- 病気の診断や治療の指示はしない。症状や健診の判定については医療機関の受診や指示を優先するよう伝える。
- 本人を責めない。提案は1〜2個まで。`;

export async function aiAvailable() {
  try {
    if (typeof self.LanguageModel !== 'undefined') {
      const a = await self.LanguageModel.availability();
      return a === 'available';
    }
  } catch {
    /* 未対応 */
  }
  return false;
}

export async function aiAsk(context, question) {
  const session = await self.LanguageModel.create({ initialPrompts: [{ role: 'system', content: SYSTEM }] });
  try {
    return await session.prompt(`【本人の記録の要約】\n${context}\n\n【質問】\n${question}`);
  } finally {
    session.destroy?.();
  }
}
