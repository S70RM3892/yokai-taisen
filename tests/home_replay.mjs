// ホーム（対戦・デッキ・リプレイ）・妖怪リストと選ぶ画面の並べかえ・リプレイ（保存・再生・その場面へ・書き出し／読みこみ）・振り返り。
//   node tests/home_replay.mjs [出力フォルダ]
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
const page = await browser.newPage({ viewport: { width: 1100, height: 950 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });
const fail = msg => { console.log("FAIL:", msg); errors.push(msg); };
const dbg = f => page.evaluate(f);
const url = pathToFileURL(resolve("dist/index.html")).href + "#debug";

// 1) ホーム：対戦のタブが最初に出る
await page.goto(url);
await page.waitForTimeout(800);
const home = await dbg(() => ({ tab: document.querySelector(".nav-tab.on")?.dataset.tab, faces: document.querySelectorAll(".hm-mem").length, cpu: !!document.querySelector(".home-cpu"), pvp: !!document.querySelector(".pvp-entry") }));
if (home.tab !== "battle" || home.faces !== 6 || !home.cpu || !home.pvp) fail(`home: ${JSON.stringify(home)}`);
await page.screenshot({ path: `${out}/home-1-battle.png`, fullPage: true });

// 2) デッキ：妖怪リストを「ちから」で並べる → 高い順、もう一度押すと低い順。開きなおしても覚えている
await page.click('.nav-tab[data-tab="deck"]');
await page.click('.b-sortrow .b-chip[data-v="atk"]');
const atk = () => dbg(() => [...document.querySelectorAll(".b-list .b-item .b-sv")].map(x => Number(x.textContent)));
let v = await atk();
if (!v.length || v.some((x, i) => i && x > v[i - 1])) fail(`atk not descending: ${v.slice(0, 5)}`);
await page.click('.b-sortrow .b-chip[data-v="atk"]');
v = await atk();
if (v.some((x, i) => i && x < v[i - 1])) fail(`atk not ascending after toggle: ${v.slice(0, 5)}`);
await page.reload();
await page.waitForTimeout(600);
const kept = await dbg(() => ({ tab: document.querySelector(".nav-tab.on")?.dataset.tab, on: document.querySelector(".b-sortrow .b-chip.on")?.dataset.v, dir: document.querySelector(".b-dir")?.textContent }));
if (kept.tab !== "deck" || kept.on !== "atk" || !kept.dir.includes("低い")) fail(`sort not remembered: ${JSON.stringify(kept)}`);
await page.fill("#unit-search", "じばにゃん");
const found = await dbg(() => [...document.querySelectorAll(".b-list .b-nm")].map(x => x.textContent));
if (!found.includes("ジバニャン")) fail(`kana search: ${found}`);
await page.fill("#unit-search", "");
await page.click('.b-sortrow .b-chip[data-v="no"]');
await page.screenshot({ path: `${out}/home-2-deck.png`, fullPage: true });

// 3) 選ぶ画面：「逆の順」で並びが逆になる
await page.click(".bag-item .bag-x"); // 6 つ入っていると開けないので 1 つ外す
await page.click(".b-bag .b-mini.save");
await page.click('.picker .pk-row .pk-chip:text-is("名前")');
const names = () => dbg(() => [...document.querySelectorAll(".picker .pick-item b")].map(x => x.firstChild.textContent.trim()));
const n1 = await names();
await page.click(".picker .pk-dir");
const n2 = await names();
if (n1.length < 5 || n1[0] !== n2[n2.length - 1] || n1[n1.length - 1] !== n2[0]) fail(`picker reverse: ${n1[0]}..${n1.at(-1)} / ${n2[0]}..${n2.at(-1)}`);
await page.click(".picker .pk-dir");
await page.click(".picker .pk-x");

// 4) ホームから CPU と対戦 → 一気に最後まで → 結果画面にリプレイの行・自動で保存
await page.click('.nav-tab[data-tab="battle"]');
await page.click(".home-cpu");
await page.click(".confirm .btn.primary");
await page.waitForTimeout(2600);
await dbg(() => __yokaiDebug.autoFinish());
if (!(await dbg(() => __yokaiDebug.verifyRep()))) fail("replay does not reproduce the battle");
await page.waitForSelector(".result .rs-review", { timeout: 20000 });
await page.waitForTimeout(500);
const saved = await dbg(() => __yokaiDebug.replays());
if (saved.length !== 1) fail(`replay not saved: ${saved.length}`);
await page.screenshot({ path: `${out}/home-3-result.png` });

// 5) 振り返り：妖怪 12 体の表・HP の線 2 本・大きな出来事
await page.click(".result .rs-review");
const rv = await dbg(() => ({ rows: document.querySelectorAll(".rv-table tbody tr:not(.rv-sep)").length, lines: document.querySelectorAll(".rv-line").length, moments: document.querySelectorAll(".rv-m").length, mvp: document.querySelectorAll(".rv-mvp").length }));
if (rv.rows !== 12 || rv.lines !== 2 || !rv.moments) fail(`review: ${JSON.stringify(rv)}`);
await page.screenshot({ path: `${out}/home-4-review.png`, fullPage: true });

// 6) 出来事を押すと、その場面からリプレイが始まる
const target = await dbg(() => { const b = document.querySelectorAll(".rv-m")[Math.floor(document.querySelectorAll(".rv-m").length / 2)]; const [m, s] = b.querySelector(".num").textContent.split(":").map(Number); b.click(); return (m * 60 + s) * 20; });
await page.waitForTimeout(400);
const play = await dbg(() => ({ replay: !!__yokaiDebug.ga()?.replay, tick: __yokaiDebug.tick(), bar: !!document.querySelector(".rp-bar"), result: !!document.querySelector(".result:not(.rp-end)") }));
if (!play.replay || !play.bar || play.result || Math.abs(play.tick - (target - 60)) > 40) fail(`jump: ${JSON.stringify(play)} target ${target}`);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/home-5-replay.png` });
// 止める → 進まない、×4 → 速く進む、位置を動かす
await page.click(".rp-pause");
const t0 = await dbg(() => __yokaiDebug.tick());
await page.waitForTimeout(500);
if ((await dbg(() => __yokaiDebug.tick())) !== t0) fail("pause does not stop");
await page.click('.rp-speed button[data-v="4"]');
await page.click(".rp-pause");
await page.waitForTimeout(1000);
const t1 = await dbg(() => __yokaiDebug.tick());
if (t1 - t0 < 40) fail(`x4 too slow: ${t0} -> ${t1}`);
await dbg(() => { const r = document.querySelector(".rp-range"); r.value = "200"; r.dispatchEvent(new Event("change")); });
await page.waitForTimeout(100);
const t2 = await dbg(() => __yokaiDebug.tick());
if (t2 < 200 || t2 > 300) fail(`seek: ${t2}`);
// 最後まで進めると「リプレイおわり」（戦績は増えない）
const rec0 = await dbg(() => localStorage.getItem("yokai-taisen:rec:1"));
await dbg(() => { const r = document.querySelector(".rp-range"); r.value = r.max; r.dispatchEvent(new Event("change")); });
await page.waitForSelector(".rp-end", { timeout: 10000 });
if ((await dbg(() => localStorage.getItem("yokai-taisen:rec:1"))) !== rec0) fail("replay changed the record");
await page.click(".rp-end .btn:text-is('ホームへ')");

// 7) リプレイのタブ：残す・書き出し → 読みこみ
const list = await dbg(() => ({ tab: document.querySelector(".nav-tab.on")?.dataset.tab, rows: document.querySelectorAll(".rp-list .rp-row").length }));
if (list.tab !== "replay" || list.rows !== 1) fail(`replay tab: ${JSON.stringify(list)}`);
await page.click(".rp-list .rp-keep");
if (!(await dbg(() => __yokaiDebug.replays()[0].kept))) fail("keep failed");
await page.click(".rp-list .rp-export");
await page.waitForSelector(".rp-code .rp-ta");
const code = await dbg(() => document.querySelector(".rp-code .rp-ta").value);
if (!code.startsWith("YR1:")) fail(`export: ${code.slice(0, 10)}`);
console.log(`export: ${code.length} chars`);
await page.click(".rp-code .btn:text-is('とじる')");
await page.fill(".rp-import .rp-ta", code);
await page.click(".rp-import .btn");
await page.waitForTimeout(300);
const after = await dbg(() => __yokaiDebug.replays().map(x => x.imported));
if (after.length !== 2 || !after[0]) fail(`import: ${JSON.stringify(after)}`);
await page.fill(".rp-import .rp-ta", "YR1:zzz");
await page.click(".rp-import .btn");
await page.waitForTimeout(200);
if (!(await dbg(() => document.querySelector(".hm-card .ps-note.bad")?.textContent))) fail("bad code is not reported");
await page.screenshot({ path: `${out}/home-6-replays.png`, fullPage: true });
// 読みこんだものを消す
await page.click(".rp-list .rp-row:first-child .rp-del");
await page.click(".rp-list .rp-row:first-child .rp-del");
await page.waitForTimeout(100);
if ((await dbg(() => __yokaiDebug.replays().length)) !== 1) fail("delete failed");
// ホームの「さいきんの対戦」
await page.click('.nav-tab[data-tab="battle"]');
if (!(await dbg(() => document.querySelectorAll(".hm-recent .rp-row").length))) fail("recent battles not on home");
await page.screenshot({ path: `${out}/home-7-home-recent.png`, fullPage: true });

// 8) スマホの幅でも横にはみ出さない
await page.setViewportSize({ width: 390, height: 800 });
for (const tab of ["battle", "deck", "replay"]) {
  await page.click(`.nav-tab[data-tab="${tab}"]`);
  await page.waitForTimeout(200);
  const over = await dbg(() => document.documentElement.scrollWidth - innerWidth);
  if (over > 1) fail(`${tab}: page scrolls sideways (${over}px)`);
}
await page.click('.nav-tab[data-tab="replay"]');
await page.click(".rp-list .rp-review");
await page.screenshot({ path: `${out}/home-8-review-phone.png`, fullPage: true });

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "home & replay ok");
await browser.close();
if (errors.length) process.exit(1);
