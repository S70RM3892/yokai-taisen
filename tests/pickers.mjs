// 編成画面の選ぶ画面（性格・持ち物・アイテム）：しぼりこみ・並べかえ・選んだものが編成に入るかを確かめる。
//   node tests/pickers.mjs [出力フォルダ]
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
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });
const fail = msg => { console.log("FAIL:", msg); errors.push(msg); };
// タブは「ラベル 件数」、並べかえは「ラベル」だけ
const chip = async (label) => page.locator(".picker .pk-chip", { hasText: new RegExp("^" + label.replace(/[()]/g, "\\$&") + "( \\d+)?$") }).first().click();
const names = () => page.$$eval(".picker .pk-body .pick-item .pk-main > b, .picker .pk-body .pick-item .pk-name > b", bs => bs.map(b => b.childNodes[0].textContent.trim()));

await page.goto(pathToFileURL(resolve("dist/index.html")).href);
await page.waitForTimeout(1200);
if (!(await page.$(".dt-pick"))) fail("no picker buttons in the detail panel");

// 性格
await page.click('.dt-row:has(.dt-k:text-is("性格")) .dt-pick');
await chip("すべて");
if ((await names()).length !== 12) fail(`natures: ${(await names()).length}`);
await chip("まもりボーナス");
const byDef = await names();
if (byDef[0] !== "動じない") fail(`sort by まもり: ${byDef.join(",")}`);
await chip("とりつく(敵)が多い");
if ((await names())[0] !== "非道") fail("sort by curse");
await page.screenshot({ path: `${out}/5-nature-picker.png` });
await page.click('.picker .pk-chip:has-text("超まじめ")');
await page.click('.picker .pick-item:has(b:text-is("荒くれ"))');
const natLabel = await page.textContent('.dt-row:has(.dt-k:text-is("性格")) .dt-pick');
if (!natLabel.includes("超まじめで荒くれ")) fail(`nature label: ${natLabel}`);

// 持ち物（装備）
await page.click('.dt-row:has(.dt-k:text-is("持ち物")) .dt-pick');
await chip("装備すべて");
await chip("ちからが上がる");
const eqTop = (await names())[0];
if (!/呪言の刀|ブリーバンド|うでわ|バンド|ベル|釘/.test(eqTop)) fail(`equip sort top: ${eqTop}`);
await chip("ゆびわ");
if ((await names()).length !== 10) fail("ring tab");
await page.screenshot({ path: `${out}/6-equip-picker.png` });
await page.click(".picker .pick-item >> nth=0");
const eqLabel = await page.textContent('.dt-row:has(.dt-k:text-is("持ち物")) .dt-pick');
if (!eqLabel.includes("ゆびわ")) fail(`equip label: ${eqLabel}`);
console.log("nature:", natLabel.replace("▾", ""), " equip:", eqLabel.replace("▾", ""), " str top:", eqTop);

// アイテム
const bagBefore = await page.$$eval(".bag-item", x => x.length);
for (let i = 0; i < bagBefore; i++) await page.click(".bag-item .bag-x");
await page.click('button:has-text("アイテムを入れる")');
await chip("たべもの（HP）");
await chip("効き目が大きい");
const top = await names();
// 回復量の多い 2 つ（チームに好物の妖怪がいれば 1.25 倍で比べるので、どちらが先かは編成しだい）
if ([...top.slice(0, 2)].sort().join() !== "ごくじょうマグロ,特上しもふり") fail(`item sort: ${top.slice(0, 3)}`);
await page.screenshot({ path: `${out}/7-item-picker.png` });
await page.click(".picker .pick-item >> nth=0");
await page.click(".picker .pick-item >> nth=1");
if (!(await page.$(".picker"))) fail("item picker should stay open until the bag is full");
await page.keyboard.press("Escape");
const bag = await page.$$eval(".bag-item .bag-nm", x => x.map(e => e.textContent));
if (bag.join() !== top.slice(0, 2).join()) fail(`bag: ${bag}`);
console.log("bag:", bag.join("・"));

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "pickers ok");
await browser.close();
if (errors.length) process.exit(1);
