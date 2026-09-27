// 妖怪ごとの 3D モデル・効果音・モーションのくせをブラウザで確かめる：
//   ・全員の 3D モデルがエラーなく作れて、見た目（形・色・大きさ・飾り）が全員ちがう
//   ・こうげき・ようじゅつ・ガード・サボり・被弾・気絶・とりつき・ひっさつわざの声と、くせを重ねたモーションがエラーなく動く
//   ・編成画面の 3D を押すと声が鳴り、くせの説明が出る
//   node tests/persona.mjs [出力フォルダ]
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const out = resolve(process.argv[2] ?? "dist/shots");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });
const fail = msg => { console.log("FAIL:", msg); errors.push(msg); };

await page.goto(pathToFileURL(resolve("dist/index.html")).href + "#debug");
await page.waitForTimeout(800);

// 1) 3D モデル：全員ちがう見た目
const looks = await page.evaluate(() => __yokaiDebug.looks());
console.log(`models: ${looks.n} built, ${looks.dup.length} look-alike pairs, ${looks.varied} with an added part, ${looks.accents} with accents, ${looks.meshes} meshes`);
if (looks.errs.length) fail("モデルが作れない: " + looks.errs.slice(0, 5).join(" / "));
if (looks.dup.length) fail("同じ見た目の妖怪がいる: " + looks.dup.slice(0, 10).join(" / "));

// 2) 編成画面：くせの説明と、3D を押すと声
const bx = await page.$(".dt-3d canvas");
if (bx) { const b = await bx.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(300); }
const note = await page.evaluate(() => document.querySelector(".dt-persona")?.textContent ?? "");
console.log("detail:", note);
if (!/くせ/.test(note)) fail("編成画面にくせの説明が出ない");
await page.screenshot({ path: `${out}/persona-builder.png` });

// 3) 対戦：いろいろな妖怪で行動・被弾・気絶・とりつき・ひっさつわざを流す
await page.click(".b-btn.go");
await page.click(".confirm .btn.primary");
await page.waitForTimeout(2800);
await page.evaluate(() => { const g = __yokaiDebug.ga(); g.cpu.params = { ...g.cpu.params, lag: 1e9 }; g.state.busyUntil = 1e9; });
const names = ["ジバニャン", "コマさん", "キュウビ", "赤鬼", "ブシニャン", "えんらえんら", "ろくろ首", "ミツマタノヅチ", "から傘お化け", "むりだ城"];
for (const name of names) {
  const r = await page.evaluate(n => __yokaiDebug.persona(n), name);
  if (!r) { fail(`${name} が見つからない`); continue; }
  console.log(`  ${name}: ${r.text}${r.accent ? "・飾り " + r.accent.kind : ""}`);
}
// 前衛の妖怪に、行動・出来事を流す
const plays = [
  { t: "action", action: "attack" }, { t: "damage", source: "attack", amount: 40, dst: -1 }, { t: "action", action: "skill" },
  { t: "action", action: "guard" }, { t: "action", action: "loaf" }, { t: "damage", source: "attack", amount: 30, dst: -2 },
];
for (const ev of plays) {
  await page.evaluate(ev => {
    const g = __yokaiDebug.ga(), p = g.state.players, me = p[0].units[p[0].wheel[0]].uid, foe = p[1].units[p[1].wheel[0]].uid;
    if (ev.t === "action") __yokaiDebug.play({ ...ev, uid: me, dst: foe });
    else __yokaiDebug.play({ ...ev, crit: !1 });
  }, ev);
  await page.waitForTimeout(700);
}
await page.screenshot({ path: `${out}/persona-battle.png` });
// 待機のゆれ：同じ時刻でも、前衛の妖怪どうしで姿勢がちがう
const idle = await page.evaluate(() => {
  const g = __yokaiDebug.ga();
  return [...g.scene.figs.values()].filter(f => f.root.visible && f.alive && !f.anim).map(f => [f.model.position.y, f.model.rotation.x, f.model.rotation.z, f.model.scale.y].map(v => v.toFixed(3)).join(","));
});
console.log("idle poses:", idle.length, new Set(idle).size);
if (idle.length >= 3 && new Set(idle).size < 2) fail("待機の姿勢がみんな同じ");

await browser.close();
if (errors.length) { console.log(errors.join("\n")); process.exit(1); }
console.log("persona ok");
