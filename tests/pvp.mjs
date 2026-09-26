// 対人戦を 2 つのページで通しで動かす（同じブラウザの別タブ方式）。
// 両方の側を CPU に操作させ、ゲストの再現がホストとずれないか・結果が左右逆にそろうかを確かめる。
//   node tests/pvp.mjs [出力フォルダ]
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const out = resolve(process.argv[2] ?? "dist/shots");
mkdirSync(out, { recursive: true });

// BroadcastChannel は file:// では使えないので、その場で小さなサーバーを立てる
const html = readFileSync(resolve("dist/index.html"));
const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html); });
await new Promise(r => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/#debug`;

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
const errors = [];
const fail = msg => { console.log("FAIL:", msg); errors.push(msg); };
const open = async name => {
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(`${name}: ${e}`));
  p.on("console", m => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(`${name}: ${m.text()}`); });
  await p.goto(url);
  await p.waitForTimeout(600);
  await p.click(".pvp-entry");
  await p.click('.pvp-tabs [data-m="tab"]');
  await p.fill(".pvp-room", "4321");
  await p.fill(".pvp-name input", name);
  return p;
};
const host = await open("ホスト");
const guest = await open("ゲスト");
await host.screenshot({ path: `${out}/pvp-1-lobby.png` });
await host.click("text=この番号で部屋を作る");
await guest.click("text=この番号の部屋に入る");
await host.waitForSelector("canvas.stage", { timeout: 10000 });
await guest.waitForSelector("canvas.stage", { timeout: 10000 });
console.log("both in battle");

// アイテムはなし（持ち物＝装備は名札に出る）
const itemLabel = await guest.textContent(".bottom3d .c-br .clabel");
if (!itemLabel.includes("アイテムなし")) fail(`item corner should be disabled: ${itemLabel}`);
const bags = await host.evaluate(() => { const s = __yokaiDebug.ga().state; return [s.noItems, s.players[0].bag.length, s.players[1].bag.length]; });
if (!bags[0] || bags[1] || bags[2]) fail(`pvp should have no items: ${bags}`);
await guest.keyboard.press("i");
if (await guest.$(".it-grid")) fail("item menu opened in pvp");

// ゲストの入力がホストに届く
await guest.waitForTimeout(2600);
const gTarget = await guest.evaluate(() => { const g = __yokaiDebug.ga(), foe = g.state.players[1]; const u = foe.units[foe.wheel[2]]; __yokaiDebug.send({ t: "target", enemyUnit: u.index }); return u.index; });
await host.waitForTimeout(600);
const hTarget = await host.evaluate(() => __yokaiDebug.ga().state.players[1].target);
if (hTarget !== gTarget) fail(`guest target did not reach host: ${gTarget} vs ${hTarget}`); else console.log("guest input reached host");
// 名前が見えている
const head = await guest.textContent("h1 small");
if (!head.includes("ホスト")) fail(`guest header: ${head}`);

await host.evaluate(() => __yokaiDebug.autoplay());
await guest.evaluate(() => __yokaiDebug.autoplay());
await host.waitForTimeout(6000);
await host.screenshot({ path: `${out}/pvp-2-host.png` });
await guest.screenshot({ path: `${out}/pvp-2-guest.png` });

// 決着まで待つ（最大 10 分。対戦は長くても 7200 tick で終わるが、遅い環境では 1 秒に 20 tick 進まない）。途中で同じ tick の状態を比べる
const t0 = Date.now();
let checked = 0;
while (Date.now() - t0 < 600000) {
  const g = await guest.evaluate(() => { const x = __yokaiDebug.ga(); return x && { tick: x.canon.tick, resyncs: x.net.resyncs, gaps: x.net.gaps, done: !!x.canon.outcome, lag: x.net.stream.length }; });
  const h = await host.evaluate(() => { const x = __yokaiDebug.ga(); return x && { tick: x.state.tick, done: !!x.state.outcome }; });
  if (!g || !h) { fail("battle vanished"); break; }
  if (g.resyncs || g.gaps) { fail(`desync: ${JSON.stringify(g)}`); break; }
  if (++checked % 10 === 0) console.log(`host tick ${h.tick} / guest tick ${g.tick} (behind ${h.tick - g.tick}, queued ${g.lag})`);
  if (h.done && g.done) break;
  await host.waitForTimeout(2000);
}
await host.waitForTimeout(2500);
const hr = await host.evaluate(() => ({ o: __yokaiDebug.ga().state.outcome, tick: __yokaiDebug.ga().state.tick, big: document.querySelector(".result .big")?.textContent }));
const gr = await guest.evaluate(() => ({ o: __yokaiDebug.ga().state.outcome, c: __yokaiDebug.ga().canon.outcome, tick: __yokaiDebug.ga().canon.tick, big: document.querySelector(".result .big")?.textContent, final: JSON.stringify(__yokaiDebug.ga().canon) }));
const hFinal = await host.evaluate(() => JSON.stringify(__yokaiDebug.ga().state));
console.log("host:", JSON.stringify(hr.o), hr.big, "guest:", JSON.stringify(gr.o), gr.big, "ticks", hr.tick, gr.tick);
if (!hr.o) fail("no outcome");
if (hFinal !== gr.final) fail("final states differ");
if (JSON.stringify(hr.o) !== JSON.stringify(gr.c)) fail("canonical outcomes differ");
if (hr.o && hr.o.winner !== null && gr.o.winner !== 1 - hr.o.winner) fail("guest outcome is not mirrored");
await host.screenshot({ path: `${out}/pvp-3-result-host.png` });
await guest.screenshot({ path: `${out}/pvp-3-result-guest.png` });

// 再戦：両方が押すと新しい対戦が始まる
await guest.click(".result .btn.primary");
await host.waitForTimeout(300);
await host.click(".result .btn.primary");
await host.waitForTimeout(1500);
const again = await Promise.all([host, guest].map(p => p.evaluate(() => { const g = __yokaiDebug.ga(); return !!g && g.running && !document.querySelector(".result"); })));
if (!again[0] || !again[1]) fail(`rematch did not start: ${again}`); else console.log("rematch started");

// 片方が閉じると、もう片方は「中断」
await guest.close();
await host.waitForTimeout(10000);
const lost = await host.evaluate(() => document.querySelector(".result .big")?.textContent);
if (lost !== "中断") fail(`host should see 中断, got ${lost}`); else console.log("disconnect handled");

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "pvp ok");
await browser.close();
server.close();
if (errors.length) process.exit(1);
