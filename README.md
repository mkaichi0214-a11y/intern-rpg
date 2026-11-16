# インターン生の1日

工務店のSNS運用インターンになって、9時から18時までの1日を乗り切る3D RPGです。
ブラウザで遊べて、スマホでは「ホーム画面に追加」でアプリのように起動できます（PWA）。

## できること

- アバター作成（髪型・髪色・肌・服・タイプ）と、称号で解放される装備（全16種）
- 3Dのオフィスとモデルハウスを歩いて「！」に話しかけ、出来事に答える
- 出来事は全73種類からランダムに出題。日によって「雨の日」「社長が来る日」などのルールが変わる
- アイテム、バズ演出、17:30のボス戦、称号22種
- ユニットランキング（Supabase）
- 同時プレイ：同じ時間に開いている人のアバターと状況が見え、バズやボス撃破のお知らせが届く（Supabase Realtime）

## 構成

| 部分 | 使っているもの |
|---|---|
| 画面・ゲーム | HTML / CSS / JavaScript（ビルド不要）、three.js（3D） |
| ランキング | Supabase（Postgres + 行レベルセキュリティ） |
| ログイン | Supabaseの匿名ログイン（端末ごとに自動で発行） |
| 同時プレイ | Supabase Realtime（Presence / Broadcast） |
| 公開 | Vercel（静的サイト） |

```
index.html            画面
css/style.css         見た目
js/config.js          SupabaseのURLと公開キー
js/platform.js        Supabaseとのつなぎ込み（ランキング・ログイン・同時プレイ）
js/events.js          出来事（基本）とランクの基準
js/events_more.js     出来事（追加分）
js/extras.js          日の種類・アイテム・ボス・称号・装備
js/world3d.js         3D表示
js/game.js            ゲーム本体
supabase/schema.sql   ランキング用のテーブルと権限
sw.js / manifest.webmanifest / icons/   PWA
```

## セットアップ

1. Supabaseでプロジェクトを作り、`supabase/schema.sql` を SQL Editor で実行する
2. Authentication → Sign In / Providers で「Allow anonymous sign-ins」をオンにする
3. `js/config.js` に Project URL と anon（publishable）キーを書く
4. このリポジトリをVercelにインポートする（Framework Preset は Other、ビルド設定は不要）

ローカルで試すときは `npx serve .` などで静的サーバーを立てて開いてください。

## 出来事を増やすには

`js/events_more.js` の配列に、同じ形で足していけます。

```js
E("タグ", "タイトル", "desk", "状況の説明", [
  C("選択肢", { f: フォロワー, t: 信頼, h: 体力 }, "結果の文"),
  L("運しだいの選択肢", 0.5, { f: 120 }, "当たりの文", { f: 10 }, "ハズレの文"),
  C("選択肢", { t: -5 }, "結果の文")
])
```

`spot` は、午前・午後・夕方は `desk` `senpai` `client` `board`（午後のみ `door` でモデルハウス撮影）、お昼は `senpai` `coffee` `sofa` から選びます。
