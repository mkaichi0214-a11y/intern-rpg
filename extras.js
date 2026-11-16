// ===== ランダムな日 =====
const DAYS = [
  { id: "normal", name: "ふつうの日", desc: "いつも通りの1日。実力で勝負！" },
  { id: "rain", name: "雨の日", desc: "雨で外は暗め。「運しだい」が当たりにくく、体力も少し減りやすい。", luck: -0.15, hMul: 1.2 },
  { id: "president", name: "社長が来る日", desc: "社長がオフィスを見回り中。信頼の上がり下がりが1.5倍。", tMul: 1.5 },
  { id: "kengaku", name: "完成見学会の日", desc: "注目が集まる日。フォロワーの増え方が1.2倍、でも体力の減りも1.2倍。", fMul: 1.2, hMul: 1.2 },
  { id: "buzz", name: "バズ日和", desc: "なぜか今日は流れがいい。「運しだい」がかなり当たりやすい。", luck: 0.2 }
];

// ===== アイテム =====
const ITEMS = {
  coffee: { name: "コーヒー", desc: "体力 +15" },
  energy: { name: "エナドリ", desc: "体力 +28" },
  memo: { name: "先輩のメモ", desc: "次の運しだい必中" },
  sweets: { name: "お菓子", desc: "信頼 +8" }
};

// ===== ボス =====
const BOSSES = [
  {
    id: "deadline", name: "締切モンスター", hp: 120, atk: [9, 15],
    intro: "17:30。時計の針がぐるぐる回り出した…！ 「明日の朝イチ納品、忘れてないよなぁ？」",
    attacks: ["「あと30分だぞ〜」 時間のプレッシャー！", "チクタク攻撃！ 集中力がけずられる！", "「修正もう1回」の通知が鳴った！"],
    win: "締切モンスターは「…間に合ったな」とつぶやいて消えていった。"
  },
  {
    id: "enjo", name: "炎上コメントの嵐", hp: 110, atk: [8, 17],
    intro: "17:30。通知が止まらない…！ 誤解を招いたコメント欄が燃え上がっている！",
    attacks: ["「ちゃんと説明して！」 コメントが連投された！", "スクショが拡散された！ 心がジリジリする！", "通知が100件たまった！"],
    win: "丁寧な説明が伝わって、コメント欄に「なるほど！」が並んだ。鎮火成功！"
  },
  {
    id: "muchaburi", name: "無茶ぶり修正依頼", hp: 130, atk: [9, 14],
    intro: "17:30。電話が鳴った。「すみません、今日の投稿、全部の写真を差し替えたくて…」",
    attacks: ["「やっぱり最初の案で！」 ちゃぶ台返し！", "「社長がこっちがいいって」 鶴の一声！", "赤ペンが画面いっぱいに走った！"],
    win: "「さすがです、助かりました！」 担当さんの声が明るくなった。"
  }
];

// ===== 称号 =====
const TITLES = [
  { id: "first_day", name: "初出社", hint: "1日を最後まで終える" },
  { id: "legend", name: "伝説のインターン", hint: "ランクSをとる" },
  { id: "rank_a", name: "頼れる運用担当", hint: "ランクA以上をとる" },
  { id: "lucky", name: "豪運", hint: "「運しだい」を3回以上当てて、外れなし" },
  { id: "unlucky", name: "運に見放されて", hint: "「運しだい」を3回以上外す" },
  { id: "survivor", name: "ギリギリ生還", hint: "体力10以下で18時を迎える" },
  { id: "iron", name: "鉄人", hint: "体力80以上で18時を迎える" },
  { id: "trust_max", name: "全幅の信頼", hint: "信頼100で18時を迎える" },
  { id: "f500", name: "フォロワー爆増", hint: "1日でフォロワーを500人以上増やす" },
  { id: "buzz3", name: "バズの申し子", hint: "1日に3回バズる" },
  { id: "boss", name: "定時の勇者", hint: "17:30のボスを倒す" },
  { id: "oneshot", name: "一撃必殺", hint: "40以上のダメージでボスにとどめを刺す" },
  { id: "boss_lose", name: "明日またたたかう", hint: "ボスに負ける" },
  { id: "early", name: "電池切れ", hint: "体力0で早退する" },
  { id: "replaced", name: "担当交代", hint: "信頼0になる" },
  { id: "collector", name: "アイテムコレクター", hint: "1日にアイテムを4つ拾う" },
  { id: "photographer", name: "名カメラマン", hint: "モデルハウスで撮影スポットを3つ見つける" },
  { id: "rain", name: "雨にも負けず", hint: "雨の日を最後まで終える" },
  { id: "president", name: "社長のお墨付き", hint: "社長が来る日に信頼80以上で終える" },
  { id: "steady", name: "地道な努力", hint: "「運しだい」を1回も選ばずに1日を終える" },
  { id: "alltypes", name: "全タイプ制覇", hint: "3つのタイプすべてで1日を終える" },
  { id: "veteran", name: "皆勤賞", hint: "5日あそぶ" }
];

// ===== 装備（着せ替え） =====
const ACC_SLOTS = [["head", "頭"], ["face", "顔"], ["neck", "首元"], ["back", "背中"]];
const ACCESSORIES = [
  { id: "knit", slot: "head", name: "ニット帽" },
  { id: "glasses", slot: "face", name: "伊達メガネ" },
  { id: "helmet", slot: "head", name: "安全ヘルメット", title: "iron" },
  { id: "beret", slot: "head", name: "ベレー帽", title: "rank_a" },
  { id: "crown", slot: "head", name: "王冠", title: "legend" },
  { id: "hachimaki", slot: "head", name: "勇者のハチマキ", title: "boss" },
  { id: "headphones", slot: "head", name: "ヘッドホン", title: "veteran" },
  { id: "rainhat", slot: "head", name: "レインハット", title: "rain" },
  { id: "heartpin", slot: "head", name: "ハートのヘアピン", title: "buzz3" },
  { id: "sunglasses", slot: "face", name: "サングラス", title: "lucky" },
  { id: "roundglasses", slot: "face", name: "丸メガネ", title: "trust_max" },
  { id: "badge", slot: "neck", name: "社員証", title: "first_day" },
  { id: "camera", slot: "neck", name: "一眼カメラ", title: "photographer" },
  { id: "necktie", slot: "neck", name: "ネクタイ", title: "president" },
  { id: "backpack", slot: "back", name: "リュック", title: "collector" },
  { id: "cape", slot: "back", name: "勇者のマント", title: "oneshot" }
];
