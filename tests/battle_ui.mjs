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

// 1) アイテム：メニュー → 前衛に使う
// 確認のあいだは相手の CPU を止める（遅い環境だと、使う前に倒されて「使えない」になるため）
const cpuParams = await page.evaluate(() => { const g = __yokaiDebug.ga(), old = g.cpu.params; g.cpu.params = { ...old, lag: 1e9 }; return old; });
const hpBefore = await page.evaluate(() => { const g = __yokaiDebug.ga(), p = g.state.players[0], u = p.units[p.wheel[0]]; u.hp = Math.floor(u.maxHp / 3); return u.hp; });
{ const bb = await (await page.$(".bottom3d .c-br")).boundingBox(); await page.mouse.click(bb.x + bb.width - 25, bb.y + bb.height - 20); }
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/4-item-menu.png` });
const firstHeal = await page.evaluate(() => { const p = __yokaiDebug.ga().state.players[0]; return p.bag.findIndex(id => /おにぎり|バーガー|ラーメン/.test(id) || true); });
await page.click(".it-grid .it-btn:not([disabled])");
await page.waitForTimeout(150);
await page.screenshot({ path: `${out}/4b-item-target.png` });
{ const w = await (await page.$('.wedge[data-pos="0"] .wbase')).boundingBox(); await page.mouse.click(w.x + w.width / 2, w.y + w.height / 2); }
await page.waitForTimeout(400);
const used = await page.evaluate(() => [...document.querySelectorAll(".log p")].map(p => p.textContent).find(t => t.startsWith("こちらは") && t.includes("に使った")) ?? null);
const hpAfter = await page.evaluate(() => { const p = __yokaiDebug.ga().state.players[0]; return p.units[p.wheel[0]].hp; });
console.log(`HP ${hpBefore} -> ${hpAfter}`);
if (!used) fail("item was not used"); else console.log("item:", used);
// 相手の CPU はこのテストの最後まで止めたまま（途中で決着がつくと、パワーチャージやおはらいを確かめられない）

// 2) パワーチャージ 4 種
for (const game of ["mawase", "nazore", "ute", "awasero"]) {
  await page.evaluate(game => {
    const g = __yokaiDebug.ga(), p = g.state.players[0];
    if (p.stance) __yokaiDebug.send({ t: "ultCancel" });
    const u = p.units[p.wheel[1]];
    u.hp = Math.max(u.hp, 1), u.sg = 1000, u.ultLockout = 0, u.curse = null; // とりつかれていると奥義を撃てない
  }, game);
  await page.waitForTimeout(120);
  await page.evaluate(() => __yokaiDebug.send({ t: "ultStart", allySlot: 1, grand: false }));
  await page.waitForTimeout(120);
  await page.evaluate(game => { const s = __yokaiDebug.ga().state.players[0].stance; if (s) { s.game = game; s.startTick = __yokaiDebug.ga().state.tick; } }, game);
  await page.waitForTimeout(250);
  const st = await page.$(".mg-stage");
  if (!st) { fail(`no charge stage for ${game}`); continue; }
  const box = await st.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  if (game === "mawase") {
    await page.mouse.move(cx + 80, cy); await page.mouse.down();
    for (let i = 0; i < 90; i++) { const a = i * 0.35; await page.mouse.move(cx + Math.cos(a) * 80, cy + Math.sin(a) * 80); }
    await page.mouse.up();
  } else if (game === "nazore") {
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.06); await page.mouse.down();
    const star = Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 36 : 88, t = -Math.PI / 2 + i * Math.PI / 5; return [100 + r * Math.cos(t), 100 + r * Math.sin(t)]; });
    for (let lap = 0; lap < 3; lap++) for (let i = 0; i <= 10; i++) { const [x, y] = star[i % 10]; await page.mouse.move(box.x + x * box.width / 200, box.y + y * box.height / 200, { steps: 3 }); }
    await page.mouse.up();
  } else if (game === "ute") {
    for (let i = 0; i < 40; i++) { const b = await page.$(".mg-ball:not(.hit)"); if (b) { try { await b.click({ timeout: 300 }); } catch {} } await page.waitForTimeout(60); }
  } else {
    for (let i = 0; i < 40; i++) { await page.mouse.click(cx, cy); await page.waitForTimeout(90); }
  }
  await page.screenshot({ path: `${out}/5-charge-${game}.png` });
  await page.waitForTimeout(600);
  const log = await page.evaluate(() => [...document.querySelectorAll(".log p")].slice(0, 6).map(p => p.textContent).join(" | "));
  const fired = await page.evaluate(() => { const g = __yokaiDebug.ga(); return !g.state.players[0].stance; });
  const q = log.match(/(文車妖妃|[^|]+) の奥義「[^」]+」 (\w+)/);
  console.log(`charge ${game}: ${fired ? "fired" : "not fired"} — ${q ? q[0] : log.slice(0, 80)}`);
  if (!fired) fail(`charge ${game} did not fire`);
  await page.waitForTimeout(1800);
}

// 3) おはらい 5 種
for (const game of ["tsubuse", "renda", "kosure", "mawase", "kire"]) {
  const ok = await page.evaluate(game => {
    const g = __yokaiDebug.ga(), p = g.state.players[0];
    const u = p.units[p.wheel[4]];
    if (u.hp <= 0) u.hp = u.maxHp;
    u.curse = { kind: "slow", tier: 0, remaining: 9999, elapsed: 0 };
    p.purify = null;
    __yokaiDebug.send({ t: "purify", allySlot: 4 });
    return true;
  }, game);
  await page.waitForTimeout(120);
  await page.evaluate(game => { const p = __yokaiDebug.ga().state.players[0]; if (p.purify) p.purify.game = game; }, game);
  await page.waitForTimeout(200);
  const st = await page.$(".mg-stage.purify");
  if (!st) { fail(`no purify stage for ${game}`); continue; }
  const box = await st.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const before = await page.evaluate(() => __yokaiDebug.ga().state.players[0].purify?.progress ?? -1);
  if (game === "tsubuse" || game === "renda") {
    for (let i = 0; i < 20; i++) { const b = await page.$(game === "tsubuse" ? ".mg-bubble:not(.pop)" : ".mg-spot"); if (b) { try { await b.click({ timeout: 300 }); } catch {} } await page.waitForTimeout(80); }
  } else if (game === "kosure") {
    await page.mouse.move(cx - 60, cy); await page.mouse.down();
    for (let i = 0; i < 30; i++) await page.mouse.move(cx + (i % 2 ? 60 : -60), cy + (i % 3) * 10, { steps: 4 });
    await page.mouse.up();
  } else if (game === "mawase") {
    await page.mouse.move(cx + 70, cy); await page.mouse.down();
    for (let i = 0; i < 60; i++) { const a = i * 0.35; await page.mouse.move(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70); }
    await page.mouse.up();
  } else {
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(120);
      const c = await page.evaluate(() => { const c = __yokaiDebug.ga().pg?.crack; return c ? { a: c.a, b: c.b } : null; });
      if (!c) continue;
      const mx = (c.a[0] + c.b[0]) / 2, my = (c.a[1] + c.b[1]) / 2;
      await page.mouse.move(box.x + (mx - 8) * box.width / 100, box.y + (my - 25) * box.height / 100);
      await page.mouse.down();
      await page.mouse.move(box.x + (mx + 8) * box.width / 100, box.y + (my + 25) * box.height / 100, { steps: 5 });
      await page.mouse.up();
    }
  }
  await page.screenshot({ path: `${out}/6-purify-${game}.png` });
  const after = await page.evaluate(() => { const p = __yokaiDebug.ga().state.players[0]; return p.purify ? p.purify.progress : 1000; });
  console.log(`purify ${game}: ${before} -> ${after}`);
  if (!(after - before > 150)) fail(`purify ${game} barely progressed`);
  await page.evaluate(() => { const p = __yokaiDebug.ga().state.players[0]; p.purify = null; p.units[p.wheel[4]].curse = null; });
  await page.waitForTimeout(150);
}

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "battle UI ok");
await browser.close();
if (errors.length) process.exit(1);
