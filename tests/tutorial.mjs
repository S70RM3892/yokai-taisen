// はじめての人へ：あそびかた（10 ページ）を最後までめくれること、練習試合がいちばんやさしい相手で始まること、
// 対戦中のヒントがそのとき大事なボタンを光らせること、練習試合は戦績に入らないこと。
//   node tests/tutorial.mjs [出力フォルダ]
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
const page = await browser.newPage({ viewport: { width: 420, height: 860 } }); // スマホの幅
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });
const fail = msg => { console.log("FAIL:", msg); errors.push(msg); };

await page.goto(pathToFileURL(resolve("dist/index.html")).href + "#debug");
await page.waitForTimeout(900);
if (!(await page.$(".b-tutorial.new"))) fail("はじめての人へ が目立っていない（初めて開いたとき）");
await page.click('.b-tutorial button:has-text("あそびかた")');
await page.waitForTimeout(200);
const titles = [];
for (let i = 0; i < 12; i++) {
  const t = await page.textContent(".tut-title");
  titles.push(t);
  if (i === 2) await page.screenshot({ path: `${out}/tutorial-wheel.png` });
  const w = await page.evaluate(() => { const b = document.querySelector(".tut-box"); return b.scrollWidth - b.clientWidth; });
  if (w > 1) fail(`page ${i + 1} overflows horizontally`);
  const next = await page.textContent(".tut-nav .btn.primary");
  if (next.includes("練習試合")) break;
  await page.click(".tut-nav .btn.primary");
}
console.log("pages:", titles.join(" / "));
if (titles.length !== 10) fail(`tutorial pages: ${titles.length}`);
await page.screenshot({ path: `${out}/tutorial-last.png` });
await page.click(".tut-nav .btn.primary");
await page.waitForTimeout(3500);
const g = await page.evaluate(() => { const g = __yokaiDebug.ga(); return { practice: g.practice, diff: g.diff, team: g.state.players[0].units.map(u => u.defIndex) }; });
if (!g.practice || g.diff !== 0) fail(`practice battle: ${JSON.stringify(g)}`);
// 最初のヒント
await page.waitForFunction(() => document.querySelector(".tut-hint")?.textContent.includes("自分で戦う"), null, { timeout: 8000 }).catch(() => fail("no start hint"));
const dismiss = async () => { for (let k = 0; k < 5 && await page.$(".tut-hint"); k++) { await page.click(".tut-hint .b-mini"); await page.waitForTimeout(150); } };
// ほかのヒント（敵を気絶させた など）が先に出ていたら閉じて、目当てのヒントを待つ
const waitHint = async word => {
  for (let k = 0; k < 30; k++) {
    const t = await page.evaluate(() => document.querySelector(".tut-hint")?.textContent ?? "");
    if (t.includes(word)) return;
    if (t) await page.click(".tut-hint .b-mini").catch(() => {});
    await page.waitForTimeout(150);
  }
};
await dismiss();
// 妖気が満タン → わざ が光る
await page.evaluate(() => { const g = __yokaiDebug.ga(); g.cpu.params = { ...g.cpu.params, lag: 1e9 }; const p = g.state.players[0]; p.units[p.wheel[1]].sg = 1000; });
await waitHint("妖気がたまった");
const ultHint = await page.evaluate(() => ({ text: document.querySelector(".tut-hint")?.textContent ?? "", glow: document.querySelector(".tut-glow")?.textContent ?? "" }));
if (!ultHint.text.includes("わざ") || !ultHint.glow.includes("わざ")) fail(`ult hint: ${JSON.stringify(ultHint)}`);
await page.screenshot({ path: `${out}/tutorial-hint-ult.png` });
await dismiss();
// とりつかれた → サークルが光る
await page.evaluate(() => { const g = __yokaiDebug.ga(), p = g.state.players[0]; p.units[p.wheel[0]].curse = { kind: "stun", tier: 0, elapsed: 0, remaining: 1e9 }; });
await waitHint("とりつかれた");
const curseHint = await page.evaluate(() => ({ text: document.querySelector(".tut-hint")?.textContent ?? "", glow: !!document.querySelector(".tut-glow.wheel3d, .tut-glow svg, svg.tut-glow, .tut-glow") }));
if (!curseHint.text.includes("後ろ") || !curseHint.glow) fail(`curse hint: ${JSON.stringify(curseHint)}`);
// 決着させる → 練習試合は戦績に入らない
const recBefore = await page.evaluate(() => localStorage.getItem("yokai-taisen:rec:0"));
await page.evaluate(() => { const g = __yokaiDebug.ga(); for (const u of g.state.players[1].units) u.hp = 0; });
await page.waitForSelector(".result", { timeout: 15000 }).catch(() => fail("no result"));
await page.waitForTimeout(500);
const res = await page.textContent(".result");
if (!res.includes("練習試合")) fail(`result: ${res}`);
const recAfter = await page.evaluate(() => localStorage.getItem("yokai-taisen:rec:0"));
if (recBefore !== recAfter) fail(`practice changed the record: ${recBefore} -> ${recAfter}`);
await page.screenshot({ path: `${out}/tutorial-result.png` });

await browser.close();
if (errors.length) { console.log(errors.join("\n")); process.exit(1); }
console.log("tutorial ok");
