// 端末内の知見データ（A：科学的知見に基づく一般的な期待効果）
//
// 編集ルール（MY LIFE 仕様 §3）
// - 本人に必ず起こる結果として書かない（「〜が期待できます」「〜の可能性があります」）
// - 疲労・血糖・体重・筋肉量・検査値について、改善率や将来の数値を書かない
// - 根拠がある場合は refs に出典を書く。根拠が弱い場合は strength と uncertainty で明示する

export const EVIDENCE = {
  A: { label: 'A', name: '一般的な知見', desc: '科学的知見に基づく一般的な期待効果です。本人に必ず起こる結果ではありません。' },
  B: { label: 'B', name: 'あなたの記録', desc: 'あなた自身の過去の記録から確認できる傾向です。' },
  C: { label: 'C', name: 'まだ判断できない', desc: '記録が不足しているため、まだ判断できない項目です。' },
};

export const STRENGTH_LABEL = {
  strong: '根拠：比較的多い',
  moderate: '根拠：一定程度あり',
  limited: '根拠：限られている',
  behavioral: '行動の積み重ねの記録',
};

const REF = {
  pa2023: { t: '厚生労働省「健康づくりのための身体活動・運動ガイド2023」', n: '成人には週2〜3日の筋力トレーニング、日常の身体活動の確保、座りすぎの回避などを推奨' },
  sleep2023: { t: '厚生労働省「健康づくりのための睡眠ガイド2023」', n: '成人はおおむね6時間以上を目安に必要な睡眠時間を確保すること、生活リズムを整えることなどを推奨' },
  aasm2015: { t: 'Watson NF, et al. Recommended Amount of Sleep for a Healthy Adult. Sleep. 2015', n: '米国睡眠医学会等の合意声明。成人は定期的に7時間以上の睡眠を推奨' },
  acsm2009: { t: 'American College of Sports Medicine. Progression Models in Resistance Training for Healthy Adults. Med Sci Sports Exerc. 2009', n: '負荷を段階的に高める筋力トレーニングの考え方' },
  dri2025: { t: '厚生労働省「日本人の食事摂取基準（2025年版）」', n: 'エネルギー・栄養素の摂取量の基準' },
  sbg: { t: '厚生労働省・農林水産省「食事バランスガイド」', n: '主食・主菜・副菜などの組み合わせの目安' },
  lally2010: { t: 'Lally P, et al. How are habits formed: Modelling habit formation in the real world. Eur J Soc Psychol. 2010', n: '行動が自動化するまでの期間は人により18〜254日と幅があった（中央値66日）' },
  cepeda2006: { t: 'Cepeda NJ, et al. Distributed practice in verbal recall tasks. Psychol Bull. 2006', n: '間隔をあけて繰り返す学習（分散学習）は記憶の保持に有利という研究の総説' },
  frattaroli2006: { t: 'Frattaroli J. Experimental disclosure and its moderators: A meta-analysis. Psychol Bull. 2006', n: '気持ちを書き出す介入の効果は小さめで、条件により差がある' },
  laukkanen2015: { t: 'Laukkanen T, et al. Association between sauna bathing and fatal cardiovascular and all-cause mortality events. JAMA Intern Med. 2015', n: 'フィンランドの観察研究。サウナ利用頻度とリスクの低さとの「関連」を報告（因果関係は未確認）' },
  gollwitzer2006: { t: 'Gollwitzer PM, Sheeran P. Implementation intentions and goal achievement: A meta-analysis. Adv Exp Soc Psychol. 2006', n: '「いつ・どこで・何をするか」を事前に決めると実行されやすいという研究の総説' },
};

// ルーティン（行動）ごとの知見
export const ROUTINE_KB = {
  strength: {
    label: '筋トレ',
    glyph: '筋',
    strength: 'strong',
    keywords: ['筋トレ', '筋力', 'ウェイト', 'スクワット', 'ベンチ', '腕立て', 'ジム', '筋肉', 'トレーニング', 'デッドリフト'],
    expects: ['筋力の向上', '筋肉量が増える可能性（食事・睡眠・年齢などの影響を受けます）', '日常動作など身体機能の維持・改善'],
    why: '筋肉に普段より大きな負荷をかけると、身体はその刺激に適応しようとします。始めて数週間の筋力の伸びは主に神経系の適応（筋肉を効率よく使えるようになること）によるもので、筋肉量の変化はそれより時間がかかるとされています。十分なたんぱく質と休養があると、適応が進みやすくなります。',
    metrics: ['使用重量', '実施回数', '筋肉痛や疲労感', '体重・体脂肪率など'],
    checkpoints: {
      w1: '予定どおり実施できたか。フォームと翌日の疲労感',
      m1: '実施回数と、各種目の重量・回数の推移',
      m3: '重量・回数の伸び、体重や体の使いやすさの変化',
    },
    cautions: [
      '関節の痛みや鋭い痛みがあるときは中止し、続く場合は医療機関に相談してください',
      '高血圧・心疾患などで治療中の場合は、運動内容を主治医に確認してください',
      '同じ部位を連日強く鍛えるより、回復の日を挟むのが一般的です',
    ],
    tips: ['最初は軽めの重量で、フォームを優先しましょう', '「開始」をタップするだけでもOK。詳しい記録は任意です', '曜日を固定すると習慣にしやすくなります'],
    refs: [REF.pa2023, REF.acsm2009],
    uncertainty: '筋肉量の増え方は年齢・性別・食事・睡眠・体質などで大きく異なるため、具体的な増加量は予測しません。',
  },
  cardio: {
    label: '有酸素運動・歩く',
    glyph: '歩',
    strength: 'strong',
    keywords: ['ウォーキング', '散歩', 'ジョギング', 'ランニング', '走る', '有酸素', '歩く', '歩数', '自転車', '水泳'],
    expects: ['持久力（息切れしにくさ）の向上', '日常の活動量の増加', '気分転換の時間になる可能性'],
    why: '心拍数がやや上がる運動を続けると、心肺機能や筋肉が酸素を使う能力が少しずつ適応していくとされています。日常で歩く量を増やすことも身体活動の確保につながります。',
    metrics: ['実施日数', '実施時間・歩数', '息切れの感じ方', '日中の疲労度'],
    checkpoints: { w1: '無理のない時間で予定どおり実施できたか', m1: '実施日数と時間の推移、同じ距離での楽さ', m3: '体力の感じ方、疲れにくさの変化' },
    cautions: ['体調が悪い日は休みましょう', '暑い時期は水分補給と時間帯に注意してください', '胸の痛みや強い息苦しさがあれば中止し、医療機関に相談してください'],
    tips: ['通勤や昼休みに少し歩くだけでも積み重なります', '時間より「毎回行う場面」を決めると続けやすくなります'],
    refs: [REF.pa2023],
    uncertainty: '体力や体重の変化の大きさは個人差が大きく、数値では予測しません。',
  },
  wake: {
    label: '起床時刻をそろえる',
    glyph: '朝',
    strength: 'moderate',
    keywords: ['起き', '起床', '早起き'],
    expects: ['生活リズムが安定しやすくなる', '朝の時間を予定に使える', '夜に自然な眠気が来やすくなる可能性'],
    why: '体内時計は朝の光や起床時刻の影響を受けます。毎日近い時刻に起きて光を浴びると体内時計が整い、夜に眠くなるタイミングもそろいやすくなるとされています。',
    metrics: ['実際の起床時刻', '目標時刻との差', '目覚めの感覚', '日中の眠気'],
    checkpoints: { w1: '目標時刻に起きられた日数と、起きた時の感覚', m1: '起床時刻のばらつきが小さくなっているか', m3: '朝の時間の使い方、日中の眠気の変化' },
    cautions: ['早起きのために睡眠時間が削られると逆効果になることがあります。起床を早めるときは就寝も同じだけ早めましょう'],
    tips: ['起きたらカーテンを開けて光を浴びましょう', '休日も平日との起床時刻の差をできるだけ小さく', '「起きた」をタップするだけで記録できます'],
    refs: [REF.sleep2023],
    uncertainty: '早起きに慣れるまでの期間には個人差があります。',
  },
  sleep: {
    label: '睡眠時間の確保',
    glyph: '眠',
    strength: 'strong',
    keywords: ['寝る', '寝', '就寝', '睡眠', '眠る', '早寝'],
    expects: ['睡眠不足による日中の眠気の軽減', '日中の集中力や体調が改善する可能性', '疲労感が変化する可能性（個人差があります）'],
    why: '睡眠が不足すると脳と身体の回復が追いつかず、日中の眠気や集中力の低下につながることが知られています。必要な睡眠時間を確保すると、こうした不足による影響が軽くなることが期待されます。',
    metrics: ['実際の睡眠時間', '目覚めの感覚', '午後の眠気', '日中の疲労度'],
    checkpoints: { w1: '「寝る」「起きた」の記録から実際の睡眠時間を確認', m1: '睡眠時間の平均と、午後の眠気・疲労度の推移', m3: '生活リズムが定着しているか、体調の変化' },
    cautions: [
      '十分に寝ても強い眠気が続く、いびきや呼吸が止まることを指摘された場合は、睡眠時無呼吸症候群などの可能性もあるため医療機関に相談してください',
      '寝床で長く過ごしすぎることも勧められていません',
    ],
    tips: ['就寝30分前から画面を見る時間を減らすと準備しやすくなります', '「寝る」をタップするだけで睡眠時間を計算します'],
    refs: [REF.sleep2023, REF.aasm2015],
    uncertainty: '必要な睡眠時間には個人差があり、眠気や疲労がどの程度変わるかは予測しません。',
  },
  meal: {
    label: '食事の改善',
    glyph: '食',
    strength: 'moderate',
    keywords: ['食事', '昼食', 'ランチ', '朝食', '夕食', '野菜', 'たんぱく', 'タンパク', '糖質', '間食', 'ご飯', 'ライス', '麺', '食べ'],
    expects: ['栄養バランスの改善', '食事量の調整', '午後の眠気が変化する可能性'],
    why: '食後の眠気には、体内時計による午後の自然な眠気の波に加え、食事の量や内容（主食中心で量が多い食事など）が関係すると考えられています。主食を適量にしてたんぱく質や野菜を組み合わせると、栄養バランスが整い、食後の体調が変わる可能性があります。ただし食後の眠気と食事内容の関係は個人差が大きく、研究結果も一様ではありません。',
    metrics: ['食事量', '食後の眠気', '眠くなるまでの時間', '午後の集中力'],
    checkpoints: { w1: '改善メニューを選べた日数、食後の眠気の感じ方', m1: '午後の眠気・集中力の記録の推移', m3: '食事の傾向が定着しているか、体重などの変化' },
    cautions: ['糖尿病などで治療中の方は、食事内容を主治医・管理栄養士に確認してください', '極端な制限は避けましょう'],
    tips: ['麺＋ライスのセットなら、どちらかを小盛りにして主菜・野菜を足す方法があります', '食後の眠気を「今日の感想」に一言残すと比較できます'],
    refs: [REF.dri2025, REF.sbg],
    uncertainty: '血糖値・体重・検査値の具体的な変化は予測しません。',
  },
  reading: {
    label: '読書',
    glyph: '読',
    strength: 'behavioral',
    keywords: ['読書', '本を読', '読む', '本'],
    expects: ['読書時間の積み重ね', '学習習慣の定着', '本人が設定した学習目標への進捗'],
    why: '習慣は「同じ場面で同じ行動を繰り返す」ことで、意識しなくても行いやすくなっていくとされています。時間と場所を決めて続けることで、読書が生活の一部になりやすくなります。',
    metrics: ['読書日数', '読書時間', '読了した本', '学んだ内容'],
    checkpoints: { w1: '決めた時間に読めた日数', m1: '読書の合計時間、読了した本', m3: '学んだ内容を仕事や生活に使えたか' },
    cautions: ['寝る直前に長時間読むと就寝が遅れることがあります'],
    tips: ['1ページだけでもOK。開くことを習慣にしましょう', '読んだ本の一言メモを「今日の感想」に残すと振り返りに使えます'],
    refs: [REF.lally2010],
    uncertainty: '読書による能力の変化は内容によって異なり、一般的な数値では予測しません。',
  },
  study: {
    label: '勉強・学習',
    glyph: '学',
    strength: 'moderate',
    keywords: ['勉強', '学習', '資格', '英語', '学ぶ', '講座', '試験'],
    expects: ['学習時間の積み重ね', '学習習慣の定着', '記憶の定着が進む可能性（復習の仕方によります）'],
    why: 'まとめて長時間行うより、間隔をあけて繰り返す学習（分散学習）のほうが記憶に残りやすいことが多くの研究で示されています。毎日短時間でも続けることは、この点で理にかなっています。',
    metrics: ['学習日数', '学習時間', '進んだ範囲', '理解度の自己評価'],
    checkpoints: { w1: '予定どおり取り組めた日数', m1: '学習時間の合計、進んだ範囲', m3: '目標（試験・スキル）に対する進捗' },
    cautions: ['睡眠を削って勉強時間を確保すると、集中力や記憶の面で逆効果になることがあります'],
    tips: ['前回の内容を最初の5分で復習すると分散学習になります'],
    refs: [REF.cepeda2006, REF.lally2010],
    uncertainty: '成績や試験結果の見込みは予測しません。',
  },
  journal: {
    label: '今日の感想・振り返り',
    glyph: '記',
    strength: 'limited',
    keywords: ['感想', '日記', '振り返', 'ジャーナル', '書き出'],
    expects: ['1日の振り返りの習慣化', '体調・気分・行動の傾向に気づきやすくなる', '記録が増えるほど、このアプリでの変化の分析が具体的になる'],
    why: '言葉にして書き出すことで、出来事や気持ちを整理しやすくなると考えられています。気持ちを書き出すことの心理的な効果についての研究もありますが、効果の大きさは研究によって差があります。',
    metrics: ['記録した日数', '疲労度・眠気・気分の記録'],
    checkpoints: { w1: '一言でも書けた日数', m1: '記録から見える傾向（眠気・疲労の推移）', m3: '振り返りが行動の見直しに役立っているか' },
    cautions: ['つらい気持ちが続くときは、一人で抱えず身近な人や専門機関に相談してください'],
    tips: ['一言だけでも十分です', '疲労度・眠気の数字だけ残す日があってもOK'],
    refs: [REF.frattaroli2006],
    uncertainty: '心理的な効果の有無や大きさは個人差が大きく、判断には本人の記録を使います。',
  },
  sauna: {
    label: 'サウナ・入浴',
    glyph: '湯',
    strength: 'limited',
    keywords: ['サウナ', '温冷', '入浴', '風呂', '湯船'],
    expects: ['入浴後のリラックス感', '気分転換の時間になる'],
    why: '温まると血管が広がり、その後のリラックス感につながると感じる人が多くいます。フィンランドの観察研究では、サウナ利用頻度と心血管疾患リスクの低さとの関連が報告されていますが、これは「関連」であり、サウナが原因であるとは確認されていません。',
    metrics: ['実施回数', '入浴後の気分', 'その日の睡眠の感覚'],
    checkpoints: { w1: '実施後の体調・気分', m1: '実施した日と睡眠・疲労の記録の比較', m3: '習慣として無理なく続いているか' },
    cautions: [
      '飲酒後の利用は避けてください',
      '脱水に注意し、前後に水分をとりましょう',
      '心疾患・高血圧・妊娠中・体調不良時は利用前に医師に相談してください',
      '水風呂などの急な温度変化は体への負担が大きくなることがあります',
    ],
    tips: ['筋トレの日と組み合わせると予定を立てやすくなります'],
    refs: [REF.laukkanen2015],
    uncertainty: '健康効果の因果関係は確認されていないため、効果の大きさは予測しません。',
  },
  family: {
    label: '家族との時間',
    glyph: '家',
    strength: 'behavioral',
    keywords: ['家族', '子ども', '子供', '妻', '夫', '親', 'パートナー', '娘', '息子'],
    expects: ['家族と過ごす時間の確保', '予定に入れることで、忙しい時期でも時間を守りやすくなる'],
    why: '「いつ・何をするか」を具体的に決めておくと実行されやすいことが、行動科学の研究で示されています（実行意図）。家族の時間も予定として確保しておくことで、他の用事に押し出されにくくなります。',
    metrics: ['実施日数', '一緒に過ごした時間', '感想'],
    checkpoints: { w1: '予定した時間を確保できたか', m1: '確保できた日数と、その日の感想', m3: '家族との時間が生活の一部になっているか' },
    cautions: [],
    tips: ['食事の時間と組み合わせると確保しやすくなります'],
    refs: [REF.gollwitzer2006],
    uncertainty: '関係性の変化は数値では予測しません。本人の感想を記録して振り返ります。',
  },
  work_focus: {
    label: '仕事の効率',
    glyph: '仕',
    strength: 'moderate',
    keywords: ['仕事', '業務', '集中', 'タスク', '効率', '生産性'],
    expects: ['集中して取り組む時間の確保', '優先順位が明確になる'],
    why: '取り組む時間と内容を事前に決めておくと実行されやすくなります（実行意図）。また、睡眠不足は集中力を下げることが知られており、睡眠の確保も仕事の効率に関係します。',
    metrics: ['実施日数', '予定どおり進んだか（感想）', '午後の集中力'],
    checkpoints: { w1: '決めた時間に取り組めた日数', m1: '進捗の感じ方、午後の集中力の記録', m3: '仕事の進め方として定着しているか' },
    cautions: [],
    tips: ['朝いちばんに「今日の最重要タスク」を1つ決める方法があります'],
    refs: [REF.gollwitzer2006, REF.sleep2023],
    uncertainty: '仕事の成果の変化は数値では予測しません。',
  },
  custom: {
    label: 'その他の習慣',
    glyph: '他',
    strength: 'behavioral',
    keywords: [],
    expects: ['本人が設定した行動の積み重ね', '習慣としての定着'],
    why: '同じ場面で同じ行動を繰り返すと、少しずつ意識しなくても行いやすくなっていくとされています。習慣になるまでの期間は人によって大きく異なります。',
    metrics: ['実施日数', '感想'],
    checkpoints: { w1: '予定どおり実施できたか', m1: '実施日数の推移', m3: '習慣として定着しているか' },
    cautions: [],
    tips: ['時間と場所を決めておくと続けやすくなります'],
    refs: [REF.lally2010],
    uncertainty: 'この行動に特有の一般的な効果は登録されていません。実際の記録をもとに変化を確認します。',
  },
};

export const ROUTINE_CATS = Object.keys(ROUTINE_KB);

// 目標の種類ごとの設定
export const GOAL_KB = {
  muscle: { label: '筋肉・筋力', keywords: ['筋肉', '筋力', '筋トレ', '鍛え', 'マッチョ', 'ボディメイク'], suggest: ['strength', 'meal', 'sleep'], metric: 'workouts' },
  fatigue: { label: '疲れにくさ', keywords: ['疲れ', '疲労', '体力', 'だる', 'バテ'], suggest: ['sleep', 'cardio', 'meal'], metric: 'fatigue' },
  sleepiness: { label: '午後の眠気', keywords: ['眠気', '午後', '昼食後', '食後'], suggest: ['meal', 'sleep'], metric: 'sleepiness' },
  sleep: { label: '睡眠・生活リズム', keywords: ['早寝', '早起き', '睡眠', '起き', '寝'], suggest: ['wake', 'sleep'], metric: 'sleepHours' },
  reading: { label: '読書', keywords: ['読書', '本'], suggest: ['reading'], metric: 'routine' },
  family: { label: '家族', keywords: ['家族', '子ども', '子供', '妻', '夫', 'パートナー'], suggest: ['family'], metric: 'routine' },
  work: { label: '仕事', keywords: ['仕事', '効率', '生産性', '業務'], suggest: ['work_focus', 'sleep'], metric: 'routine' },
  study: { label: '学習', keywords: ['勉強', '学習', '学ぶ', '資格', '英語', '新しいこと'], suggest: ['study'], metric: 'routine' },
  weight: { label: '体重・体型', keywords: ['体重', '痩せ', '減量', 'ダイエット', '体脂肪', 'お腹'], suggest: ['meal', 'cardio', 'strength'], metric: 'weight' },
  health: { label: '健康', keywords: ['健康', '健診', '血圧', '血糖', 'コレステロール'], suggest: ['cardio', 'meal', 'sleep'], metric: 'routine' },
  custom: { label: 'その他', keywords: [], suggest: [], metric: 'routine' },
};
export const GOAL_CATS = Object.keys(GOAL_KB);

export const GOAL_PRESETS = [
  '筋肉を増やす',
  '疲れにくい身体をつくる',
  '午後の眠気を減らす',
  '早寝早起き',
  '読書する',
  '家族との時間を増やす',
  '仕事の効率を上げる',
  '新しいことを勉強する',
];

// 目標の種類から提案するルーティン例（本人が採用・編集する）
export const ROUTINE_SUGGEST = {
  strength: { text: '週2回筋トレする', cat: 'strength', freq: 2, duration: 45 },
  cardio: { text: '週3回20分歩く', cat: 'cardio', freq: 3, duration: 20 },
  wake: { text: '毎朝同じ時刻に起きる', cat: 'wake', freq: 7, duration: 0 },
  sleep: { text: '就寝時刻を決めて睡眠時間を確保する', cat: 'sleep', freq: 7, duration: 0 },
  meal: { text: '昼食は主食を適量にして、たんぱく質と野菜をとる', cat: 'meal', freq: 5, duration: 0 },
  reading: { text: '毎日20分読書する', cat: 'reading', freq: 7, duration: 20 },
  study: { text: '毎日30分勉強する', cat: 'study', freq: 7, duration: 30 },
  journal: { text: '毎晩今日の感想を書く', cat: 'journal', freq: 7, duration: 5 },
  sauna: { text: '週1回サウナに行く', cat: 'sauna', freq: 1, duration: 90 },
  family: { text: '週末に家族と過ごす時間をつくる', cat: 'family', freq: 2, duration: 120 },
  work_focus: { text: '朝いちばんに最重要タスクを決める', cat: 'work_focus', freq: 5, duration: 10 },
};

function detect(text, kb, order, fallback) {
  const t = String(text || '');
  for (const id of order) if (kb[id].keywords.some((k) => t.includes(k))) return id;
  return fallback;
}

// キーワードが重なるものは順序で優先度を決める
const ROUTINE_ORDER = ['sauna', 'strength', 'cardio', 'reading', 'study', 'journal', 'family', 'meal', 'sleep', 'wake', 'work_focus'];
const GOAL_ORDER = ['sleepiness', 'muscle', 'fatigue', 'weight', 'reading', 'study', 'family', 'work', 'health', 'sleep'];

export function detectRoutineCat(text) {
  const t = String(text || '');
  // 「早寝早起き」は就寝（sleep が wake より先に判定される）、「起きる」だけなら起床
  return detect(t, ROUTINE_KB, ROUTINE_ORDER, 'custom');
}
export const detectGoalCat = (text) => detect(text, GOAL_KB, GOAL_ORDER, 'custom');

// 本人の言葉からルーティンの時刻・頻度・曜日・所要時間を読み取る
export function parseRoutineText(text) {
  const t = String(text || '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/：/g, ':');
  const out = { cat: detectRoutineCat(t) };
  let m;
  if ((m = t.match(/(\d{1,2}):(\d{2})/))) out.time = `${String(+m[1]).padStart(2, '0')}:${m[2]}`;
  else if ((m = t.match(/(\d{1,2})時(半|(\d{1,2})分)?/))) out.time = `${String(+m[1]).padStart(2, '0')}:${m[2] === '半' ? '30' : String(+(m[3] || 0)).padStart(2, '0')}`;

  if ((m = t.match(/週\s*(\d)\s*(回|日)/))) out.freq = +m[1];
  else if (/毎日|毎朝|毎晩|毎夜|毎日/.test(t)) out.freq = 7;

  if (/平日/.test(t)) out.days = [1, 2, 3, 4, 5];
  else if (/休日|週末|土日/.test(t)) out.days = [0, 6];
  else if (out.freq === 7) out.days = [0, 1, 2, 3, 4, 5, 6];
  else {
    const DOW = ['日', '月', '火', '水', '木', '金', '土'];
    const days = new Set();
    const chars = [...t];
    chars.forEach((c, i) => {
      const di = DOW.indexOf(c);
      if (di < 0) return;
      const next = chars[i + 1] || '';
      const prev = chars[i - 1] || '';
      if ('曜・、/'.includes(next) || '・、/'.includes(prev)) days.add(di);
    });
    if (days.size) out.days = [...days];
  }
  if (out.days && !out.freq) out.freq = out.days.length;

  if ((m = t.match(/(\d+(?:\.\d+)?)\s*時間/)) && !/\d時間後/.test(t)) out.duration = Math.round(parseFloat(m[1]) * 60);
  // 「5時30分」の30分は所要時間ではない
  else if ((m = t.match(/(?<![\d時:])(\d{1,3})\s*分(?!後)/))) out.duration = +m[1];
  return out;
}

// 健康診断の主な項目（値は本人が原本を見て入力・確認する）
export const CHECKUP_ITEMS = [
  { key: 'height', name: '身長', unit: 'cm' },
  { key: 'weight', name: '体重', unit: 'kg' },
  { key: 'bmi', name: 'BMI', unit: '' },
  { key: 'waist', name: '腹囲', unit: 'cm' },
  { key: 'sbp', name: '血圧（上）', unit: 'mmHg' },
  { key: 'dbp', name: '血圧（下）', unit: 'mmHg' },
  { key: 'fbg', name: '空腹時血糖', unit: 'mg/dL' },
  { key: 'hba1c', name: 'HbA1c', unit: '%' },
  { key: 'tg', name: '中性脂肪', unit: 'mg/dL' },
  { key: 'hdl', name: 'HDLコレステロール', unit: 'mg/dL' },
  { key: 'ldl', name: 'LDLコレステロール', unit: 'mg/dL' },
  { key: 'ast', name: 'AST(GOT)', unit: 'U/L' },
  { key: 'alt', name: 'ALT(GPT)', unit: 'U/L' },
  { key: 'ggt', name: 'γ-GTP', unit: 'U/L' },
  { key: 'ua', name: '尿酸', unit: 'mg/dL' },
  { key: 'cre', name: 'クレアチニン', unit: 'mg/dL' },
  { key: 'egfr', name: 'eGFR', unit: '' },
  { key: 'hb', name: 'ヘモグロビン', unit: 'g/dL' },
];

export const CHECKUP_JUDGEMENTS = ['異常なし', '軽度異常', '要経過観察', '要再検査', '要精密検査', '要治療', '治療中'];
export const CHECKUP_ALERT = ['要再検査', '要精密検査', '要治療'];
