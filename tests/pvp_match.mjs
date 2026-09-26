// 対人戦のマッチング（あいことば・ランダムマッチ）を 2 つのページで確かめる。
// 本番は公開のシグナリングサーバー（0.peerjs.com）を使う。テストでは同じ PeerJS のサーバー（npm の peer）を手元で立てる。
// MATCH_HOST=0.peerjs.com を付けると本番のサーバーで確かめる。
//   node tests/pvp_match.mjs [出力フォルダ]
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const out = resolve(process.argv[2] ?? "dist/shots");
mkdirSync(out, { recursive: true });
const port = 9000 + Math.floor(Math.random() * 500);
const matchHost = process.env.MATCH_HOST ?? `127.0.0.1:${port}`;
let server = null;
// どこかで止まっても終わるように
setTimeout(() => { console.log("TIMEOUT"); server?.kill(); process.exit(1); }, 240000).unref();
if (!process.env.MATCH_HOST) {
  server = spawn(process.execPath, [resolve("node_modules/peer/dist/bin/peerjs.js"), "--port", String(port), "--host", "127.0.0.1", "--path", "/"], { stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((res, rej) => { server.stdout.on("data", d => String(d).includes("Started") && res()); server.on("exit", rej); setTimeout(res, 4000); });
}
const proxy = process.env.MATCH_HOST && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch({ proxy, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const url = pathToFileURL(resolve("dist/index.html")).href + "#debug";
const errors = [];
const page = async name => {
  const p = await (await browser.newContext({ viewport: { width: 900, height: 900 }, ignoreHTTPSErrors: true })).newPage();
  p.on("pageerror", e => errors.push(`${name}: ${e}`));
  await p.addInitScript(h => localStorage.setItem("yokai-taisen:matchHost", JSON.stringify(h)), matchHost);
  // プロキシごしだとフォントの読み込みが遅いので、画面ができたら進める
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".pvp-entry", { timeout: 60000 });
  await p.click(".pvp-entry");
  await p.fill(".pvp-name input", name);
  return p;
};
const status = p => p.textContent(".pvp-status");
async function playBoth(host, guest, label) {
  try {
    await host.waitForSelector("canvas.stage", { timeout: 60000 });
    await guest.waitForSelector("canvas.stage", { timeout: 20000 });
  } catch (err) {
    console.log(label, "status:", await status(host).catch(() => "-"), "/", await status(guest).catch(() => "-"));
    throw err;
  }
  await host.evaluate(() => __yokaiDebug.autoplay());
  await guest.evaluate(() => __yokaiDebug.autoplay());
  await host.waitForTimeout(6000);
  const a = await host.evaluate(() => ({ tick: __yokaiDebug.ga().state.tick, kind: __yokaiDebug.ga().net.link.kind, role: __yokaiDebug.ga().net.role }));
  const b = await guest.evaluate(() => ({ tick: (__yokaiDebug.ga().canon ?? __yokaiDebug.ga().state).tick, role: __yokaiDebug.ga().net.role, resyncs: __yokaiDebug.ga().net.resyncs }));
  console.log(label, JSON.stringify(a), JSON.stringify(b));
  if (a.kind !== "rtc") errors.push(`${label}: not rtc`);
  if (a.role === b.role) errors.push(`${label}: both ${a.role}`);
  if (Math.min(a.tick, b.tick) < 50) errors.push(`${label}: not running`);
}

// 1) あいことば：ふたりとも同じ番号で「つなぐ」→ 先に押した方が部屋を作る
{
  const word = String(100000 + Math.floor(Math.random() * 900000));
  const p1 = await page("あお"), p2 = await page("あか");
  for (const p of [p1, p2]) { await p.click('.pvp-tabs [data-m="room"]'); await p.fill(".pvp-roomrow input", word); }
  await p1.click("text=この番号でつなぐ");
  await p1.waitForFunction(() => document.querySelector(".pvp-status")?.textContent.includes("待っています"), null, { timeout: 20000 });
  await p1.screenshot({ path: `${out}/match-1-room-wait.png`, timeout: 5000 }).catch(() => {});
  await p2.click("text=この番号でつなぐ");
  await playBoth(p1, p2, "room");
  await p1.context().close(), await p2.context().close();
}

// 2) やめる：待っている人がやめたら、その番号はあく
{
  const word = String(100000 + Math.floor(Math.random() * 900000));
  const p1 = await page("しろ");
  await p1.click('.pvp-tabs [data-m="room"]'); await p1.fill(".pvp-roomrow input", word);
  await p1.click("text=この番号でつなぐ");
  await p1.waitForFunction(() => document.querySelector(".pvp-status")?.textContent.includes("待っています"), null, { timeout: 20000 });
  await p1.click("text=やめる");
  await p1.waitForTimeout(1500);
  const p2 = await page("くろ");
  await p2.click('.pvp-tabs [data-m="room"]'); await p2.fill(".pvp-roomrow input", word);
  await p2.click("text=この番号でつなぐ");
  await p2.waitForFunction(() => document.querySelector(".pvp-status")?.textContent.includes("待っています"), null, { timeout: 20000 })
    .catch(async () => errors.push(`cancel: room not freed (${await status(p2)})`));
  await p1.context().close(), await p2.context().close();
}

// 3) ランダムマッチ：押すだけ
{
  const p1 = await page("みどり"), p2 = await page("きいろ");
  for (const p of [p1, p2]) await p.click('.pvp-tabs [data-m="random"]');
  await p1.click("text=相手をさがす");
  await p1.waitForTimeout(2500);
  await p2.click("text=相手をさがす");
  await playBoth(p1, p2, "random");
  await p2.screenshot({ path: `${out}/match-2-random.png`, timeout: 5000 }).catch(() => {});
}

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "match ok");
await browser.close();
server?.kill();
if (errors.length) process.exit(1);
