// ひっさつわざの演出をブラウザで確かめる：16 種の振り付けがどれもエラーなく動くこと、
// カットインが妖怪ごとにちがう形（入り方・帯・文字・模様）で出ること。
//   node tests/ult_cutin.mjs [出力フォルダ]
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const out = resolve(process.argv[2] ?? "dist/shots");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });
const fail = msg => { console.log("FAIL:", msg); errors.push(msg); };

await page.goto(pathToFileURL(resolve("dist/index.html")).href + "#debug");
await page.waitForTimeout(800);
await page.click(".b-btn.go");
await page.click(".confirm .btn.primary");
await page.waitForTimeout(2800);
await page.evaluate(() => { const g = __yokaiDebug.ga(); g.cpu.params = { ...g.cpu.params, lag: 1e9 }; g.state.busyUntil = 1e9; });

// 1) 16 種の振り付け
const stats = await page.evaluate(() => __yokaiDebug.ultStats());
console.log("styles:", JSON.stringify(stats));
if (Object.keys(stats).length < 14) fail(`振り付けの種類が少ない: ${Object.keys(stats).length}`);
for (const style of Object.keys(stats)) {
  const who = await page.evaluate(s => __yokaiDebug.ultTry(s), style);
  if (!who) { fail(`${style} を使う妖怪がいない`); continue; }
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/ult-${style}.png` });
  await page.waitForTimeout(2600);
  console.log(`  ${style}: ${who}`);
}

// 2) カットイン：何体か出して、形がちがうことを確かめる
const names = ["ジバニャン", "コマさん", "キュウビ", "えんらえんら", "フユニャン", "オロチ"];
const seen = new Map();
for (const name of names) {
  const r = await page.evaluate(n => {
    const g = __yokaiDebug.ga(), p = g.state.players[0], u = p.units[p.wheel[1]];
    const di = __yokaiDebug.defIndexOf(n);
    if (di < 0) return null;
    u.defIndex = di;
    __yokaiDebug.events([{ t: "ult", uid: u.uid, grand: !1 }]);
    return u.uid;
  }, name);
  if (r === null) { fail(`${name} が見つからない`); continue; }
  await page.waitForTimeout(1000);
  const ci = await page.evaluate(() => { const c = document.querySelector(".cutin"); return c ? { cls: c.className, key: c.dataset.ult, glyph: c.querySelector(".glyph")?.textContent, move: c.querySelector(".move")?.textContent } : null; });
  if (!ci) { fail(`${name} のカットインが出ない`); continue; }
  await page.screenshot({ path: `${out}/cutin-${name}.png` });
  console.log(`  ${name}: ${ci.key} 「${ci.move}」 ${ci.glyph}`);
  if (seen.has(ci.key)) fail(`${name} と ${seen.get(ci.key)} のカットインが同じ形 ${ci.key}`);
  seen.set(ci.key, name);
  await page.waitForTimeout(3900);
}

await browser.close();
if (errors.length) { console.log(errors.join("\n")); process.exit(1); }
console.log("ult cut-in ok");
