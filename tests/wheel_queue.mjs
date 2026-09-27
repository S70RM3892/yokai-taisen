// 対戦画面の新しい操作（アイテム・パワーチャージ 4 種・おはらい 5 種）をブラウザで実際に動かす。
//   node tests/battle_ui.mjs [出力フォルダ]
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

// メンバーサークルの回転は妖怪の行動と同じ判定：だれかの行動のモーション中に回しても、そのあいだは並びが変わらない。
// 回した角度で待ち（光る）、モーションが終わったら回る
const st = () => page.evaluate(() => { const g = __yokaiDebug.ga(), s = g.state, p = s.players[0];
  return { tick: s.tick, busy: s.busyUntil, lock: s.rotLockUntil, wheel: p.wheel.join(), pending: p.pendingRotate, cd: p.rotateCooldown, poke: !!p.poke, stance: !!p.stance,
    rotor: g.svg.rotor.style.transform, queued: g.svg.wheel.classList.contains("queued"), hint: document.body.innerText.includes("モーションが終わったら回る") }; });
const wb = await (await page.$(".wheel3d")).boundingBox();
const cx = wb.x + wb.width / 2, cy = wb.y + wb.height / 2, R = wb.width * 0.4;
const drag = async () => {
  await page.mouse.move(cx + R, cy); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { const a = i * (Math.PI / 3) / 12 * 1.05; await page.mouse.move(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
  await page.mouse.up();
};
// こうげき中（技の名前が出てからダメージの数字が出るまで）は回せない：はじかれて、予約もされない
let sl;
for (let i = 0; i < 400; i++) { sl = await st(); if (sl.lock - sl.tick >= 7 && sl.cd === 0 && !sl.pending && !sl.poke && !sl.stance) break; await page.waitForTimeout(10); }
if (!(sl.lock - sl.tick >= 7)) fail("no attack to test the rotate lock");
await drag();
await page.waitForTimeout(120);
const sl2 = await st();
console.log("during attack:", JSON.stringify(sl2));
if (sl2.pending || sl2.wheel !== sl.wheel) fail("rotated (or queued) during an attack");
// 行動のモーション中（ダメージが出たあと）になるまで待つ（回転の待ち時間も明ける）
let s0;
for (let i = 0; i < 300; i++) { s0 = await st(); if (s0.tick >= s0.lock && s0.busy - s0.tick > 20 && s0.cd === 0 && !s0.pending && !s0.poke && !s0.stance) break; await page.waitForTimeout(20); }
await drag();
let s1;
for (let i = 0; i < 40; i++) { s1 = await st(); if (s1.pending || s1.wheel !== s0.wheel) break; await page.waitForTimeout(15); }
console.log("during motion:", JSON.stringify(s1));
if (s1.wheel !== s0.wheel && !s1.pending) fail("rotation was applied during the motion");
if (!s1.pending) fail("rotation was not queued");
if (!s1.queued || !s1.hint) fail("queued state not shown");
if (!/rotate\(60deg\)/.test(s1.rotor)) fail("rotor did not hold the queued angle: " + s1.rotor);
await page.screenshot({ path: `${out}/6-wheel-queued.png` });
let s2;
for (let i = 0; i < 150; i++) { s2 = await st(); if (!s2.pending) break; await page.waitForTimeout(30); }
console.log("after motion:", JSON.stringify(s2));
if (s2.pending || s2.wheel === s0.wheel) fail("queued rotation was not applied after the motion");
if (s2.tick < s1.busy) fail("rotation applied before the motion ended");
await page.waitForTimeout(400);
if (errors.length) { console.log("ERRORS:\n" + errors.join("\n")); process.exit(1); }
console.log("wheel queue ok");
await browser.close();
