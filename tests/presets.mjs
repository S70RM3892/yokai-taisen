// 流行りの型（プリセット）：全部がルールを満たし、持ち物が付き、押すと編成に入って対戦できるか。
//   node tests/presets.mjs [出力フォルダ]
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
await page.goto(pathToFileURL(resolve("dist/index.html")).href + "#debug");
await page.waitForTimeout(800);
const list = await page.evaluate(() => __yokaiDebug.presets());
for (const p of list) {
  console.log(p.name, p.errs.length ? "NG " + p.errs.join(" / ") : "ok", p.dropped.length ? "持ち物が付かない: " + p.dropped.join(",") : "");
  if (p.errs.length || p.dropped.length) errors.push(p.name);
}
const n = await page.$$eval(".pre-item", els => els.length);
if (n !== list.length) errors.push(`buttons ${n} != presets ${list.length}`);
// 3 つ目（全体妖術）を押して、編成と持ち物が入るか
await page.click(".pre-item:nth-child(3)");
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/presets.png`, fullPage: true });
const team = await page.evaluate(() => [...document.querySelectorAll(".b-medal")].length + " medals, " + (__yokaiDebug.team?.() ?? ""));
console.log("applied:", team);
await page.click(".b-btn.go");
await page.click(".confirm .btn.primary");
await page.waitForTimeout(2500);
if (!(await page.$("canvas.stage"))) errors.push("battle did not start");
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "presets ok");
await browser.close();
if (errors.length) process.exit(1);
