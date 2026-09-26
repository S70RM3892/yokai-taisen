// パーティの保存：開きなおしても続きから・マイセット・前の版の保存の読みこみ・書き出し／読みこみ
//   node tests/party_save.mjs
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
const fail = m => { console.log("FAIL:", m); errors.push(m); };
page.on("pageerror", e => errors.push(String(e)));
page.on("dialog", d => d.accept());
const url = pathToFileURL(resolve("dist/index.html")).href + "#debug";
const dbg = f => page.evaluate(f);

// 1) 流行りの型を入れる → 開きなおしても同じ編成・持ち物
await page.goto(url);
await page.click('.nav-tab[data-tab="deck"]');
await page.waitForTimeout(800);
await page.click(".pre-item:nth-child(1)");
await page.waitForTimeout(200);
const before = await dbg(() => ({ bt: __yokaiDebug.bt(), lo: __yokaiDebug.loadout(), bag: __yokaiDebug.bag() }));
const cur = await dbg(() => __yokaiDebug.party().current);
if (!cur.members.every(m => m && typeof m.unit.no === "number" && m.unit.name)) fail("current party is not saved by No/name");
await page.reload();
await page.waitForTimeout(800);
const after = await dbg(() => ({ bt: __yokaiDebug.bt(), lo: __yokaiDebug.loadout(), bag: __yokaiDebug.bag() }));
if (JSON.stringify(before) !== JSON.stringify(after)) fail(`reload changed the team: ${JSON.stringify(before.bt)} -> ${JSON.stringify(after.bt)}`);
else console.log("reload keeps:", after.bt.join("・"));

// 2) マイセット 1 に保存 → 別の編成にしてから読む
await page.click(".ps-row:nth-child(2) .save");
await page.click(".pre-item:nth-child(3)");
await page.waitForTimeout(200);
await page.click(".ps-row:nth-child(2) .ps-load");
await page.waitForTimeout(200);
const back = await dbg(() => __yokaiDebug.bt());
if (JSON.stringify(back) !== JSON.stringify(before.bt)) fail(`slot load: ${back}`); else console.log("slot 1 ok");

// 3) 書き出し → 読みこみ（別のブラウザを想定：保存を全部消してから）
const code = await dbg(() => __yokaiDebug.partyCode());
if (!code.startsWith("YT1:")) fail("bad code");
await dbg(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(800);
const lost0 = await page.evaluate(c => __yokaiDebug.partyImport(c), code);
const imp = await dbg(() => __yokaiDebug.bt());
if (lost0.length || JSON.stringify(imp) !== JSON.stringify(before.bt)) fail(`import: ${imp} lost ${lost0}`); else console.log("export/import ok:", code.length, "chars");

// 4) 前の版の保存（このゲーム独自の妖怪の id）を読む。本家にいる妖怪は名前でつながり、いない妖怪だけ外れる
await dbg(() => {
  localStorage.clear();
  localStorage.setItem("yokai-taisen:set:0", JSON.stringify(["g075", "g262", "g102", "g004", "g001", "g102"]));
  localStorage.setItem("yokai-taisen:setlo:0", JSON.stringify({ lo: [{ nature: "kyouryokuteki" }, { nature: "arakure", equipment: "kishin_udewa" }, { equipment: "soul:g066" }, {}, {}, {}], bag: ["ikuraonigiri", "nazo_item"] }));
});
await page.reload();
await page.click('.nav-tab[data-tab="deck"]');
await page.waitForTimeout(800);
const slot = await dbg(() => __yokaiDebug.party().slots[0]);
if (!slot) fail("legacy set was not migrated");
await page.click(".ps-row:nth-child(2) .ps-load");
await page.waitForTimeout(200);
const legacy = await dbg(() => ({ bt: __yokaiDebug.bt(), lo: __yokaiDebug.loadout(), bag: __yokaiDebug.bag(), note: document.querySelector(".ps-note").textContent }));
console.log("legacy:", legacy.bt.join("・"), "/", legacy.note);
if (legacy.bt.join() !== "ブリー隊長,ブシニャン,マスクドニャーン,オオクワノ神,,マスクドニャーン") fail(`legacy team: ${legacy.bt}`);
if (legacy.lo[1].equipment !== "kishin_udewa" || legacy.lo[1].nature !== "arakure") fail("legacy loadout lost");
if (!/^soul:y\d{3}$/.test(legacy.lo[2].equipment ?? "")) fail(`legacy soul not remapped: ${legacy.lo[2].equipment}`);
if (!legacy.note.includes("g001") || !legacy.note.includes("nazo_item")) fail("lost members are not reported");
if (legacy.bag.join() !== "ikuraonigiri") fail(`legacy bag: ${legacy.bag}`);

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "party save ok");
await browser.close();
if (errors.length) process.exit(1);
