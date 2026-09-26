// 対戦画面の演出をブラウザで確かめる：陣のカットイン・とりつきのオーラと表示・奥義の封印・
// HP がダメージの数字と同時に減る・多段ヒットの分割・撃破時のエフェクトの向き。
//   node tests/battle_fx.mjs [出力フォルダ]
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
// 相手の CPU を止める
await page.evaluate(() => { const g = __yokaiDebug.ga(); g.cpu.params = { ...g.cpu.params, lag: 1e9 }; });

// 1) 陣：回したあと前衛 3 体が同じ族になるようにして、回転の出来事を流す
await page.evaluate(() => {
  const g = __yokaiDebug.ga(), p = g.state.players[0];
  const [a, b] = __yokaiDebug.twoTribes();
  for (let i = 0; i < 3; i++) p.units[p.wheel[i]].defIndex = a[i];
  for (let i = 3; i < 6; i++) p.units[p.wheel[i]].defIndex = b[i - 3];
  __yokaiDebug.events([{ t: "rotate", player: 0, dir: "cw", steps: 3 }]);
});
await page.waitForTimeout(350);
const cut = await page.evaluate(() => document.querySelector(".jincut")?.textContent ?? null);
if (!cut || !cut.includes("の陣")) fail(`陣のカットインが出ない: ${cut}`);
await page.screenshot({ path: `${out}/fx-1-jin.png` });
console.log("jin cut-in:", cut);
await page.waitForTimeout(1300);

// 2) とりつき：悪い（要おはらい・オーラ・奥義を撃てない）、よい（残りターン）
const insp = await page.evaluate(() => {
  const g = __yokaiDebug.ga(), p = g.state.players[0];
  const u = p.units[p.wheel[0]], v = p.units[p.wheel[1]];
  u.curse = { kind: "weaken", tier: 1, remaining: 1, elapsed: 0 };
  u.sg = 1000;
  v.blessing = { kind: "rally", tier: 0, turns: 3, fresh: false, elapsed: 0, wardCharges: 0 };
  __yokaiDebug.send({ t: "ultStart", allySlot: 0, grand: false });
  return { u: u.uid, v: v.uid };
});
await page.waitForTimeout(500);
const chips = await page.evaluate(() => [...document.querySelectorAll(".fxs .chip")].map(c => c.textContent));
if (!chips.some(c => c.includes("要おはらい"))) fail(`悪いとりつきの表示がない: ${chips}`);
if (!chips.some(c => c.includes("残り3ターン"))) fail(`よいとりつきのターン表示がない: ${chips}`);
const stance = await page.evaluate(() => !!__yokaiDebug.ga().state.players[0].stance);
if (stance) fail("とりつかれているのに奥義の構えに入った");
const auras = await page.evaluate(() => [...(__yokaiDebug.ga().scene.insp ?? new Map()).values()].map(a => a.kind));
if (!auras.includes("bad") || !auras.includes("good")) fail(`とりつきのオーラがない: ${auras}`);
await page.screenshot({ path: `${out}/fx-2-inspirit.png` });
console.log("inspirit chips:", chips.join(" / "), " auras:", auras.join(","));
await page.evaluate(() => { const p = __yokaiDebug.ga().state.players[0]; p.units[p.wheel[0]].curse = null; p.units[p.wheel[1]].blessing = null; });

// 3) HP：攻撃の出来事のあと、ダメージの数字が出るまで HP バーは減らない。多段は数字が分かれる
await page.evaluate(() => {
  const g = __yokaiDebug.ga(), s = g.state, me = s.players[0].units[s.players[0].wheel[0]], foe = s.players[1].units[s.players[1].wheel[0]];
  foe.hp = foe.maxHp;
  window.__foe = foe.uid;
});
await page.waitForTimeout(150);
const w0 = await page.evaluate(() => __yokaiDebug.ga().foeBars.get(window.__foe).querySelector(".hp i").style.width);
await page.evaluate(() => {
  const g = __yokaiDebug.ga(), s = g.state, me = s.players[0].units[s.players[0].wheel[0]], foe = s.players[1].units[s.players[1].wheel[0]];
  foe.hp -= 80; // エンジンは先に減らす
  __yokaiDebug.events([{ t: "action", uid: me.uid, action: "attack", dst: foe.uid }, { t: "damage", src: me.uid, dst: foe.uid, amount: 80, source: "attack", crit: false, hits: 4 }]);
});
await page.waitForTimeout(150);
const w1 = await page.evaluate(() => __yokaiDebug.ga().foeBars.get(window.__foe).querySelector(".hp i").style.width);
await page.waitForTimeout(470);
const nums = await page.evaluate(() => [...document.querySelectorAll(".dnum .dval")].length);
const w2 = await page.evaluate(() => __yokaiDebug.ga().foeBars.get(window.__foe).querySelector(".hp i").style.width);
await page.screenshot({ path: `${out}/fx-3-multihit.png` });
await page.waitForTimeout(600);
const w3 = await page.evaluate(() => __yokaiDebug.ga().foeBars.get(window.__foe).querySelector(".hp i").style.width);
console.log("hp bar:", w0, "→ (攻撃中)", w1, "→ (数字が出はじめ)", w2, "→ (全部)", w3, " 数字の数:", nums);
if (w1 !== w0) fail(`ダメージの数字より先に HP が減った ${w0} → ${w1}`);
if (!(parseFloat(w3) < parseFloat(w0))) fail(`HP が減らない ${w0} → ${w3}`);
if (nums < 2) fail(`多段なのに数字が分かれていない (${nums})`);

// 4) 撃破時のエフェクトの向き：倒した相手（dst）に向かう（あとで別の相手を選び直さない）
const dir = await page.evaluate(() => {
  const g = __yokaiDebug.ga(), s = g.state, me = s.players[0].units[s.players[0].wheel[1]], p1 = s.players[1];
  const target = p1.units[p1.wheel[2]];
  target.hp = 0; // もう倒れている（エンジンの状態）。ほかの相手は生きている
  __yokaiDebug.play({ t: "action", uid: me.uid, action: "attack", dst: target.uid });
  const f = g.scene.figs.get(me.uid), tf = g.scene.figs.get(target.uid);
  const to = f.anim?.to;
  return to ? Math.hypot(to.x - tf.home.x, to.z - tf.home.z) : -1;
});
if (!(dir >= 0 && dir < 1.5)) fail(`攻撃の向きが倒した相手に向いていない (距離 ${dir})`);
console.log("attack direction: distance to KO'd target", dir.toFixed(2));

await browser.close();
if (errors.length) { console.log(errors.join("\n")); process.exit(1); }
console.log("battle fx ok");
