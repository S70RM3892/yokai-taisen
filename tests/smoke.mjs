// ブラウザで dist/index.html を開いて、編成→対戦まで進むかを確かめ、スクリーンショットを残す。
//   node tests/smoke.mjs [出力フォルダ]
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
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });
await page.goto(pathToFileURL(resolve("dist/index.html")).href);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/1-builder.png`, fullPage: true });

const steps = process.env.SMOKE_STEPS ? JSON.parse(process.env.SMOKE_STEPS) : [];
for (const s of steps) {
  if (s.click) await page.click(s.click);
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.shot) await page.screenshot({ path: `${out}/${s.shot}.png`, fullPage: !!s.full });
  if (s.eval) console.log(await page.evaluate(s.eval));
}

await page.click(".b-btn.go");
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/1c-confirm.png` });
await page.click(".confirm .btn.primary");
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}/2-battle.png` });
await page.waitForTimeout(8000);
await page.screenshot({ path: `${out}/3-battle-later.png` });
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors");
await browser.close();
if (errors.length) process.exit(1);
