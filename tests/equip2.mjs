// 装備枠 2 つの妖怪（本家）：編成画面に「そうび 2」が出て選べること、パーティの書き出し／読みこみで 2 つめも残ること、
// 対戦の名札に 2 つとも出ること。1 つしか持てない妖怪には「そうび 2」が出ないこと。
//   node tests/equip2.mjs [出力フォルダ]
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
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });
const fail = msg => { console.log("FAIL:", msg); errors.push(msg); };
const url = pathToFileURL(resolve("dist/index.html")).href + "#debug";

// のっぺら坊（2 つ）を 1 番目、ジバニャン（1 つ）を 2 番目にしたパーティを読みこむ
const members = [
  [50, "のっぺら坊", null, null, { id: "densetsu_omamori" }, { soul: { name: "えんらえんら" } }],
  [null, "ジバニャン", null, null, null],
  [null, "ムリカベ", null, null, null], [null, "トオセンボン", null, null, null], [null, "ふじのやま", null, null, null], [null, "すもうどん", null, null, null],
];
const code = "YT1:" + Buffer.from(JSON.stringify({ f: 1, n: "equip2", m: members, b: [] })).toString("base64");
await page.goto(url);
await page.waitForTimeout(900);
const lost = await page.evaluate(c => __yokaiDebug.partyImport(c), code);
if (lost.length) fail(`import lost ${lost}`);
await page.reload();
await page.waitForTimeout(1200);
const lo = await page.evaluate(() => __yokaiDebug.loadout());
if (lo[0].equipment !== "densetsu_omamori" || !lo[0].equipment2?.startsWith("soul:")) fail(`loadout after import: ${JSON.stringify(lo[0])}`);

// 編成画面：1 番目（のっぺら坊）には「そうび 1」「そうび 2」
const rows = await page.$$eval(".dt-row .dt-k", ks => ks.map(k => k.textContent));
if (!rows.includes("そうび 1") || !rows.includes("そうび 2")) fail(`detail rows: ${rows}`);
await page.screenshot({ path: `${out}/equip2-detail.png` });
// 2 つめを選びなおす
await page.click('.dt-row:has(.dt-k:text-is("そうび 2")) .dt-pick');
await page.waitForTimeout(300);
const title = await page.textContent(".picker");
if (!title.includes("2 つめ")) fail("picker title does not say 2 つめ");
await page.click(".picker .pick-item >> nth=0");
await page.waitForTimeout(300);
const lo2 = await page.evaluate(() => __yokaiDebug.loadout());
if (!lo2[0].equipment2 || lo2[0].equipment2 === lo[0].equipment2) fail(`equipment2 not changed: ${lo2[0].equipment2}`);
if (lo2[0].equipment !== "densetsu_omamori") fail("slot 1 changed when picking slot 2");

// 書き出し → 読みこみで 2 つめも残る
const code2 = await page.evaluate(() => __yokaiDebug.partyCode());
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(900);
await page.evaluate(c => __yokaiDebug.partyImport(c), code2);
const lo3 = await page.evaluate(() => __yokaiDebug.loadout());
if (lo3[0].equipment2 !== lo2[0].equipment2) fail(`export/import lost equipment2: ${lo3[0].equipment2}`);
await page.reload();
await page.waitForTimeout(1200);

// 出陣前の確認に「そうび 2」、対戦の名札に 2 つとも
await page.click(".b-btn.go");
await page.waitForTimeout(300);
const cf = await page.textContent(".confirm");
if (!cf.includes("そうび 2")) fail("confirm screen does not show そうび 2");
await page.screenshot({ path: `${out}/equip2-confirm.png` });
await page.click(".confirm .btn.primary");
await page.waitForTimeout(2800);
const u0 = await page.evaluate(() => { const p = __yokaiDebug.ga().state.players[0]; const u = p.units[0]; return { e1: u.equipment, e2: u.equipment2 }; });
if (u0.e1 !== "densetsu_omamori" || u0.e2 !== lo2[0].equipment2) fail(`battle unit: ${JSON.stringify(u0)}`);
const team = await page.evaluate(() => __yokaiDebug.team());
if (!team.includes("＋")) fail(`team label: ${team}`);
console.log(`equip2: ${team}`);

await browser.close();
if (errors.length) { console.log(errors.join("\n")); process.exit(1); }
console.log("equip2 ok");
