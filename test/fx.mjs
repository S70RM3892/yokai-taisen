// 演出の見た目チェック：カットイン・バナー・リザルトが出た瞬間を撮る
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const out = process.argv[2] ?? "/tmp/fx";
const maxSec = Number(process.argv[3] ?? 240);
const diff = process.argv[4] ?? "3";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await page.goto(pathToFileURL(resolve("dist/yokai-taisen.html")).href);
await page.click(`.b-diff button[data-v="${diff}"]`);
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}-intro.png` });
const seen = new Set();
const t0 = Date.now();
let k = 0;
while ((Date.now() - t0) / 1000 < maxSec) {
  await page.waitForTimeout(40);
  k++;
  // 満タンの前衛がいたら奥義を構え、Perfect の目盛りで離す
  const act = await page.evaluate(() => {
    if (document.querySelector(".overlay:not([hidden]) .seg.perfect.cur")) return " ";
    if (document.querySelector(".overlay:not([hidden])")) return null;
    const i = [...document.querySelectorAll(".plate")].findIndex((p) => p.classList.contains("full"));
    return i >= 0 ? String(i + 1) : null;
  });
  if (act) await page.keyboard.press(act);
  for (const [sel, name] of [[".cutin.ally", "cutin-ally"], [".cutin.foe", "cutin-foe"], [".cutin.grand", "cutin-grand"], [".banner.perfect,.banner.good,.banner.miss", "quality"], [".banner.sudden", "sudden-or-lose"], [".banner.win", "banner-win"], [".float.eff", "eff"], [".top3d.danger", "danger"]]) {
    if (!seen.has(name) && (await page.$(sel))) {
      seen.add(name);
      await page.waitForTimeout(name.startsWith("cutin") ? 300 : 50);
      await page.screenshot({ path: `${out}-${name}.png` });
      console.log(((Date.now() - t0) / 1000).toFixed(1), name);
    }
  }
  if (await page.$(".result .box")) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}-result.png` });
    console.log("result", ((Date.now() - t0) / 1000).toFixed(1));
    break;
  }
}
console.log(errors.length ? errors.join("\n") : "no errors");
await browser.close();
