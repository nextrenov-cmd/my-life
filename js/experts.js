// AI専門家チーム（8名）の設定
//
// ※ 現在は「仮の領域枠」です。既存の8名の設定（名前・専門・視点・口調など）を
//   受け取り次第、このファイルだけを差し替えます。
//   domains は ROUTINE_KB / GOAL_KB のカテゴリIDと 'checkup' を使用します。
//
// 本人には原則として「統合AIコーチ」が一つの回答を返し、
// どの専門領域の視点を使ったかを小さく表示します。
// 専門家AIは実在する有資格者の監修を受けたものではありません。

export const EXPERTS = [
  { id: 'training', name: '筋トレ担当', field: '筋力トレーニング', domains: ['strength', 'muscle'] },
  { id: 'nutrition', name: '栄養担当', field: '食事・栄養', domains: ['meal', 'weight', 'sleepiness'] },
  { id: 'sleep', name: '睡眠担当', field: '睡眠・生活リズム', domains: ['sleep', 'wake', 'sleepiness'] },
  { id: 'recovery', name: '疲労回復担当', field: '疲労・休養・入浴', domains: ['fatigue', 'sauna', 'cardio'] },
  { id: 'checkup', name: '健康診断担当', field: '健康診断の記録整理', domains: ['checkup', 'health'] },
  { id: 'habit', name: '習慣化担当', field: '習慣づくり・振り返り', domains: ['journal', 'custom', 'reading'] },
  { id: 'work', name: '仕事効率担当', field: '仕事・時間の使い方', domains: ['work_focus', 'work'] },
  { id: 'learning', name: '学習・家族時間担当', field: '学び・家族との時間', domains: ['study', 'family'] },
];

export const COACH = { name: '統合AIコーチ' };

export const EXPERT_DISCLAIMER =
  '専門家AIは、各分野の一般的な知見をもとにした視点の設定であり、実在する医師・管理栄養士・トレーナーなどの有資格者の監修を受けたものではありません。';

export function expertsFor(domains) {
  const set = new Set(domains);
  return EXPERTS.filter((e) => e.domains.some((d) => set.has(d)));
}
