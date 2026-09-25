# 妖怪大戦

ブラウザで遊ぶ、妖怪 6 体どうしのリアルタイム対戦（人 vs CPU）。1 ファイルの HTML で動く。
本家（妖怪ウォッチ2）の対戦画面の配置をまねて、色・絵・言葉はオリジナル。本家との差と埋めたところは [docs/GAP.md](docs/GAP.md)。

- 396 体すべてに **固有の特性** と **3D モデル**
- 本家の **装備 74 種**・**魂**・**たべもの／牛乳・ジュース／おふだ／漢方／みがわり人形**
- 本家の **パワーチャージ 4 種**・**おはらい 5 種**・右下の **アイテム**
- 編成画面で 3D モデル・能力値（装備こみ）・特性・好物を確かめ、性格／装備／育成／持ち物を選ぶ。出陣前にまとめて確認

## 作り方

```sh
npm install
npm run build        # dist/index.html（これ 1 つで遊べる）
npm test             # 対戦ロジックを CPU どうしで数百戦させる＋全員の特性・装備を確かめる
node tests/smoke.mjs       # ブラウザで編成→対戦まで進めてスクリーンショット（dist/shots）
node tests/battle_ui.mjs   # アイテム・パワーチャージ 4 種・おはらい 5 種を実際に操作
```

`dist/index.html#gallery=1`〜`#gallery=10` で全員の 3D モデルを 40 体ずつ並べて見られる。

## ファイル

- `src/template.html` … 画面の枠と CSS
- `src/game.js` … もとの公開版を読みやすく整形したもの（three.js を含む）。`/*@@include …@@*/` の場所に `src/ext/` を差し込む
- `src/ext/honke_items.js` … 本家の装備・アイテム（出典つき）
- `src/ext/traits.js` … 固有特性（一族ごとの効果 × 役割ごとの主効果）と魂、好物、元祖軍／本家軍
- `src/ext/loadout.js` … 性格・装備・育成から対戦の能力値をまとめる
- `src/ext/engine_fx.js` … 特性・装備・アイテムの効果を対戦ロジックへ
- `src/ext/engine_minigames.js` … パワーチャージ 4 種・おはらい 5 種の判定と CPU
- `src/ext/models3d.js` … 3D モデル（一族ごとの体つき）と編成画面の回転プレビュー
- `src/ext/builder_ui.js` … 編成画面の確認・選択・出陣前の確認
- `src/ext/battle_ui.js` … 対戦画面のアイテムとタッチアクション
- `tools/build.mjs` … 1 ファイルにまとめる（esbuild で圧縮）
- `tools/check_names.mjs` … 追加した名前が、圧縮済みの短い名前とぶつからないか調べる
