// ext/ に書いた名前が、元のバンドル（圧縮された短い名前）とぶつかっていないか調べる
import { readFileSync, readdirSync } from "node:fs";
const game = readFileSync("src/game.js", "utf8");
const decl = src => new Set([...src.matchAll(/^(?:function\s+([A-Za-z_$][\w$]*)|(?:var|let|const|class)\s+([A-Za-z_$][\w$]*))/gm)].map(m => m[1] ?? m[2]));
// バンドル側：カンマ区切りの var 宣言も拾う
const gameNames = new Set([...game.matchAll(/(?:^|[,;{]\s*|\bvar\s+|\blet\s+|\bfunction\s+)([A-Za-z_$][\w$]{0,3})\s*(?==|\()/gm)].map(m => m[1]));
for (const n of decl(game)) gameNames.add(n);
let bad = 0;
const seen = new Map();
for (const f of readdirSync("src/ext")) {
  for (const n of decl(readFileSync(`src/ext/${f}`, "utf8"))) {
    if (gameNames.has(n)) { console.log(`collision: ${n} (${f})`); bad++; }
    if (seen.has(n)) { console.log(`duplicate: ${n} (${f}, ${seen.get(n)})`); bad++; }
    seen.set(n, f);
  }
}
if (bad) process.exit(1);
console.log(`names ok (${seen.size} ext names)`);
