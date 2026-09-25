// 編成→対戦を自動で回して、エラーが出ないかとスクショを確認する
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const out = process.argv[2] ?? "/tmp/shot";
const secs = Number(process.argv[3] ?? 20);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await page.goto(pathToFileURL(resolve("dist/yokai-taisen.html")).href);
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}-builder.png` });
await page.keyboard.press("Enter");
for (let t = 0; t < secs; t += 2) {
  await page.waitForTimeout(2000);
  // 適当に操作：奥義・回転・解放
  await page.keyboard.press(["1", "2", "3", "e", "q", " ", "z", "Tab"][t % 8]);
  if (t === 6) await page.screenshot({ path: `${out}-battle.png` });
  if (await page.$(".result")) break;
}
await page.screenshot({ path: `${out}-end.png` });
console.log(errors.length ? errors.join("\n") : "no errors");
await browser.close();
