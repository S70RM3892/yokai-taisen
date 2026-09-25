# yokai-taisen

妖怪ウォッチ風のホイールバトル（人 vs CPU）。1 枚の HTML で動く。

- `src/app.js` … ゲーム本体（three.js r169 同梱）
- `src/style.css` … 見た目
- `src/shell.html` … HTML の外枠
- `node build.mjs` → `dist/yokai-taisen.html`（Artifact として公開するファイル）
- `node test/smoke.mjs <出力名> <秒>` / `node test/fx.mjs <出力名> <秒> <難易度0-3>` … ヘッドレスで対戦を回して確認
