# 妖怪大戦（仮）

妖怪ウォッチ2の対人戦システムを現代向けに作り直す、ブラウザ向けの対戦ゲーム。

- [企画書](docs/PLAN.md)
- [戦闘仕様](docs/BATTLE_SPEC.md)
- [ユニット数値](docs/UNITS.md)
- [UI 仕様](docs/UI_SPEC.md)

## 開発

Node.js 22 以上。

```sh
npm install
npm test                 # 単体テスト
npm run typecheck        # 型チェック
npm run sim -- --matches 10000 --seed 1   # CPU どうしで試合を回して集計（--json で JSON）
npm run build:web        # ブラウザ版（人 vs CPU）を dist/yokai-taisen.html に書き出す
```

ブラウザ版は1つの HTML ファイルなので、`dist/yokai-taisen.html` をブラウザで開けば遊べる。

## 構成

| 場所 | 中身 |
|---|---|
| `src/core/` | 戦闘コア（決定論・整数だけ・描画や通信に依存しない） |
| `src/core/constants.ts` | 戦闘の数値はすべてここ |
| `src/core/data.ts` | ユニット・性格・装備のデータ |
| `src/core/step.ts` | 1 tick の処理（BATTLE_SPEC §3 の順番） |
| `src/core/cpu.ts` | シミュレーター用の CPU（BATTLE_SPEC §12.8） |
| `src/core/match.ts` | 試合を最後まで回す・リプレイの再生 |
| `src/sim/` | CLI シミュレーター |
| `src/web/` | ブラウザ版の試作（P2）。画面と入力だけで、戦闘は `src/core` を使う |
| `test/` | 単体テスト（vitest） |
