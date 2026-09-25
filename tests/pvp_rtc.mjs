// 対人戦の WebRTC 接続（招待コード → 返事コード）を 2 つのページで確かめる。
//   node tests/pvp_rtc.mjs [出力フォルダ]
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const out = resolve(process.argv[2] ?? "dist/shots");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", ...(process.env.RTC_NO_MDNS ? ["--disable-features=WebRtcHideLocalIpsWithMdns"] : [])] });
const url = pathToFileURL(resolve("dist/index.html")).href + "#debug";
const errors = [];
const page = async name => {
  const p = await (await browser.newContext({ viewport: { width: 900, height: 900 } })).newPage();
  p.on("pageerror", e => errors.push(`${name}: ${e}`));
  await p.goto(url);
  await p.waitForTimeout(500);
  await p.click(".pvp-entry");
  await p.fill(".pvp-name input", name);
  return p;
};
const host = await page("あお"), guest = await page("あか");
await host.click('.pvp-tabs [data-m="host"]');
await host.click("text=招待コードを作る");
await host.waitForSelector(".pvp-codebox textarea", { timeout: 20000 });
const invite = await host.inputValue(".pvp-codebox textarea");
console.log(`invite code: ${invite.length} chars`);
await guest.click('.pvp-tabs [data-m="guest"]');
await guest.fill(".pvp-body textarea", invite);
await guest.click("text=返事コードを作る");
await guest.waitForSelector(".pvp-codebox textarea", { timeout: 20000 });
const answer = await guest.inputValue(".pvp-codebox textarea");
console.log(`answer code: ${answer.length} chars`);
await host.screenshot({ path: `${out}/rtc-1-host.png` });
// 取り違え（招待コードを返事の欄に貼る）はことわる
await host.fill('.pvp-body textarea[placeholder*="返事"]', invite);
await host.click("text=つなぐ");
await host.waitForTimeout(300);
const wrong = await host.textContent(".pvp-status");
if (!wrong.includes("返事コード")) errors.push(`wrong code not rejected: ${wrong}`);
await host.fill('.pvp-body textarea[placeholder*="返事"]', answer);
await host.click("text=つなぐ");
try { await host.waitForSelector("canvas.stage", { timeout: 20000 }); }
catch (err) {
  console.log("host:", await host.textContent(".pvp-status"), "guest:", await guest.textContent(".pvp-status"));
  throw err;
}
await guest.waitForSelector("canvas.stage", { timeout: 20000 });
await host.evaluate(() => __yokaiDebug.autoplay());
await guest.evaluate(() => __yokaiDebug.autoplay());
await host.waitForTimeout(12000);
const h = await host.evaluate(() => ({ tick: __yokaiDebug.ga().state.tick, kind: __yokaiDebug.ga().net.link.kind }));
const g = await guest.evaluate(() => ({ tick: __yokaiDebug.ga().canon.tick, resyncs: __yokaiDebug.ga().net.resyncs, gaps: __yokaiDebug.ga().net.gaps, head: document.querySelector("h1 small").textContent }));
console.log("host", JSON.stringify(h), "guest", JSON.stringify(g));
if (h.kind !== "rtc") errors.push("not rtc");
if (g.tick < 100 || h.tick - g.tick > 20) errors.push("guest is not following");
if (g.resyncs || g.gaps) errors.push("desync");
if (!g.head.includes("あお")) errors.push("names not exchanged");
await guest.screenshot({ path: `${out}/rtc-2-guest.png` });
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "rtc ok");
await browser.close();
if (errors.length) process.exit(1);
