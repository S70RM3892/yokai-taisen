// 対人戦のマッチング（Firebase Realtime Database）を、本物と同じ動きのエミュレーターで確かめる。
//   ・firebase/database.rules.json のルール（横取りできない・ほかの場所は読み書きできない）
//   ・あいことば：2 人がつながる／やめたら行列から消える
//   ・ランダムマッチ：6 人が同時に押しても、3 組にきちんと分かれる
//   ・いなくなった人（返事をしない行・押さえたまま消えた人）がいても、残りの人はつながる
// エミュレーターは Java で動く。jar は FB_EMU_JAR か、なければ一時フォルダへ取ってくる。
//   node tests/pvp_fb.mjs
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
setTimeout(() => { console.log("TIMEOUT"); emu?.kill(); process.exit(1); }, 300000).unref();

const JAR_URL = "https://storage.googleapis.com/firebase-preview-drop/emulator/firebase-database-emulator-v4.11.2.jar";
const jar = process.env.FB_EMU_JAR ?? join(tmpdir(), "firebase-database-emulator-v4.11.2.jar");
if (!existsSync(jar)) {
  const r = await fetch(JAR_URL);
  if (!r.ok) throw new Error(`emulator download failed: ${r.status}`);
  writeFileSync(jar, Buffer.from(await r.arrayBuffer()));
}
const port = 9200 + Math.floor(Math.random() * 500);
const emu = spawn("java", ["-jar", jar, "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
await new Promise((res, rej) => {
  const on = d => String(d).includes("Listening") && res();
  emu.stdout.on("data", on), emu.stderr.on("data", on), emu.on("exit", rej);
  setTimeout(res, 15000);
});
// 「Listening」が出ても、まだ受け付けていないことがあるので、答えが返るまで待つ
for (let i = 0; i < 60; i++) {
  try { await fetch(`http://127.0.0.1:${port}/.json?ns=probe`); break; } catch { await new Promise(r => setTimeout(r, 500)); }
}
const NS = "yt-test";
const E = `http://127.0.0.1:${port}`;
const errors = [];
const fail = m => { console.log("FAIL:", m); errors.push(m); };

// ルールを入れる
{
  const r = await fetch(`${E}/.settings/rules.json?ns=${NS}`, { method: "PUT", headers: { Authorization: "Bearer owner" }, body: readFileSync("firebase/database.rules.json") });
  if (!r.ok) throw new Error("rules: " + await r.text());
}
// ルールの確認
{
  const V = "m/v0";
  const req = (m, p, b) => fetch(`${E}/${p}.json?ns=${NS}`, { method: m, body: b === undefined ? undefined : JSON.stringify(b) }).then(r => r.status);
  const expect = async (label, status, want) => { const s = await status; if ((s === 200) !== want) fail(`rule ${label}: ${s}`); };
  await expect("queue put", req("PUT", `${V}/q/rand/a`, { t: { ".sv": "timestamp" } }), !0);
  await expect("claim", req("PUT", `${V}/q/rand/a/c`, "b"), !0);
  await expect("steal claim", req("PUT", `${V}/q/rand/a/c`, "x"), !1);
  await expect("claim gone", req("PUT", `${V}/q/rand/zz/c`, "x"), !1);
  await expect("heartbeat", req("PATCH", `${V}/q/rand/a`, { h: { ".sv": "timestamp" } }), !0);
  await expect("bad entry", req("PUT", `${V}/q/rand/b`, { t: "x" }), !1);
  await expect("msg", req("POST", `${V}/s/a`, { f: "b", d: "{}" }), !0);
  await expect("bad msg", req("POST", `${V}/s/a`, { f: "b" }), !1);
  await expect("huge msg", req("POST", `${V}/s/a`, { f: "b", d: "x".repeat(20001) }), !1);
  await expect("other place", req("PUT", `x/y`, 1), !1);
  await expect("read root", req("GET", `m`), !1);
  await expect("delete", req("DELETE", `${V}/q/rand/a`), !0);
  console.log("rules ok");
}

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const url = pathToFileURL(resolve("dist/index.html")).href + "#debug";
const page = async name => {
  const p = await (await browser.newContext({ viewport: { width: 700, height: 800 } })).newPage();
  p.on("pageerror", e => errors.push(`${name}: ${e}`));
  await p.addInitScript(u => localStorage.setItem("yokai-taisen:fbDb", JSON.stringify(u)), `${E}?ns=${NS}`);
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".pvp-entry", { timeout: 60000 });
  await p.click(".pvp-entry");
  await p.fill(".pvp-name input", name);
  return p;
};
const status = p => p.textContent(".pvp-status").catch(() => "-");
const netOf = p => p.evaluate(() => { const g = __yokaiDebug.ga(); return g?.net ? { role: g.net.role, kind: g.net.link.kind, peer: g.net.peerName ?? null } : null; }).catch(() => null);
const queue = async pool => (await (await fetch(`${E}/m/v3/q/${pool}.json?ns=${NS}`)).json()) ?? {};

// 1) あいことば
{
  const word = String(100000 + Math.floor(Math.random() * 900000));
  const p1 = await page("あお"), p2 = await page("あか");
  for (const p of [p1, p2]) { await p.click('.pvp-tabs [data-m="room"]'); await p.fill(".pvp-roomrow input", word); }
  await p1.click("text=この番号でつなぐ");
  await p1.waitForFunction(() => document.querySelector(".pvp-status")?.textContent.includes("待っています"), null, { timeout: 20000 });
  await p2.click("text=この番号でつなぐ");
  try {
    await p1.waitForSelector("canvas.stage", { timeout: 60000 });
    await p2.waitForSelector("canvas.stage", { timeout: 20000 });
    const [a, b] = [await netOf(p1), await netOf(p2)];
    console.log("room:", JSON.stringify(a), JSON.stringify(b));
    if (a?.kind !== "rtc" || !b || a.role === b.role) fail("room: bad link");
  } catch { fail(`room: not connected (${await status(p1)} / ${await status(p2)})`); }
  await p1.waitForTimeout(500);
  if (Object.keys(await queue(`p2-room-${word}`)).length) fail("room: queue not cleaned");
  await p1.context().close(), await p2.context().close();
}

// 2) やめる：行列から消える
{
  const word = String(100000 + Math.floor(Math.random() * 900000));
  const p1 = await page("しろ");
  await p1.click('.pvp-tabs [data-m="room"]'); await p1.fill(".pvp-roomrow input", word);
  await p1.click("text=この番号でつなぐ");
  await p1.waitForFunction(() => document.querySelector(".pvp-status")?.textContent.includes("待っています"), null, { timeout: 20000 });
  if (Object.keys(await queue(`p2-room-${word}`)).length !== 1) fail("cancel: not queued");
  await p1.click("text=やめる");
  await p1.waitForTimeout(1500);
  if (Object.keys(await queue(`p2-room-${word}`)).length) fail("cancel: still queued");
  await p1.context().close();
  console.log("cancel ok");
}

// 3) ランダムマッチ：6 人が同時に押す
{
  const names = ["いち", "に", "さん", "よん", "ご", "ろく"];
  const ps = [];
  for (const n of names) { const p = await page(n); await p.click('.pvp-tabs [data-m="random"]'); ps.push(p); }
  for (const p of ps) await p.evaluate(() => { const t0 = performance.now(); window.__st = []; new MutationObserver(() => window.__st.push(((performance.now() - t0) / 1000).toFixed(1) + " " + document.querySelector(".pvp-status")?.textContent)).observe(document.querySelector(".pvp-status"), { childList: true, characterData: true, subtree: true }); });
  await Promise.all(ps.map(p => p.click("text=相手をさがす")));
  const t0 = Date.now();
  const got = await Promise.all(ps.map(p => p.waitForSelector("canvas.stage", { timeout: 90000 }).then(() => ((Date.now() - t0) / 1000).toFixed(1), () => !1)));
  console.log("connected at (s):", got.join(" "));
  if (process.env.FB_TRACE) for (const p of ps) console.log((await p.evaluate(() => window.__st).catch(() => [])).join(" | "));
  const nets = await Promise.all(ps.map(netOf));
  console.log(`random x6: ${got.filter(Boolean).length}/6 connected in ${((Date.now() - t0) / 1000).toFixed(1)}s`, nets.map(n => n?.role ?? "-").join(","));
  if (got.some(x => !x)) fail(`random x6: not all connected (${(await Promise.all(ps.map(status))).join(" / ")})`);
  const hosts = nets.filter(n => n?.role === "host").length, guests = nets.filter(n => n?.role === "guest").length;
  if (hosts !== 3 || guests !== 3) fail(`random x6: ${hosts} hosts / ${guests} guests`);
  await ps[0].waitForTimeout(800);
  if (Object.keys(await queue("p2-rand")).length) fail("random: queue not cleaned");
  // 受け箱も空になっている（ルールで受け箱ごとは消せないので、1 件ずつ消す）
  const boxes = await (await fetch(`${E}/m/v3/s.json?ns=${NS}`, { headers: { Authorization: "Bearer owner" } })).json();
  if (boxes && Object.keys(boxes).length) fail(`random: mailboxes not cleaned (${JSON.stringify(boxes).slice(0, 120)})`);
  for (const p of ps) await p.context().close();
}

// 3b) いなくなった人：返事をしない行が並んでいても、押さえた人が招待を送らずに消えても、残りの 2 人はつながる
{
  const word = String(100000 + Math.floor(Math.random() * 900000));
  const pool = `p2-room-${word}`;
  const put = (id, v) => fetch(`${E}/m/v3/q/${pool}/${id}.json?ns=${NS}`, { method: "PUT", body: JSON.stringify(v) });
  // 返事をしない行（タブが固まった人）
  await put("0ghost", { t: { ".sv": "timestamp" } });
  const p1 = await page("くろ"), p2 = await page("きい");
  for (const p of [p1, p2]) { await p.click('.pvp-tabs [data-m="room"]'); await p.fill(".pvp-roomrow input", word); }
  await p1.click("text=この番号でつなぐ");
  await p1.waitForFunction(() => document.querySelector(".pvp-status")?.textContent.includes("待っています"), null, { timeout: 40000 });
  // p1 の行を、招待を送らずに消える人が押さえる
  const q1 = Object.entries(await queue(pool)).find(([id, v]) => id !== "0ghost" && !v.c);
  if (q1) await fetch(`${E}/m/v3/q/${pool}/${q1[0]}/c.json?ns=${NS}`, { method: "PUT", body: JSON.stringify("1vanished") });
  else fail("ghost: p1 not queued");
  await p2.click("text=この番号でつなぐ");
  const t0 = Date.now();
  try {
    await Promise.all([p1.waitForSelector("canvas.stage", { timeout: 60000 }), p2.waitForSelector("canvas.stage", { timeout: 60000 })]);
    console.log(`ghost ok (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch { fail(`ghost: not connected (${await status(p1)} / ${await status(p2)})`); }
  await p1.context().close(), await p2.context().close();
}

// 4) Firebase につながらない：PeerJS（予備）でさがし直す
{
  const p = await (await browser.newContext({ viewport: { width: 700, height: 800 } })).newPage();
  p.on("pageerror", e => errors.push(`fallback: ${e}`));
  await p.addInitScript(() => { localStorage.setItem("yokai-taisen:fbDb", JSON.stringify("http://127.0.0.1:1")); localStorage.setItem("yokai-taisen:matchHost", JSON.stringify("127.0.0.1:1")); });
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".pvp-entry", { timeout: 60000 });
  await p.click(".pvp-entry");
  await p.click('.pvp-tabs [data-m="random"]');
  await p.evaluate(() => { window.__st = []; new MutationObserver(() => window.__st.push(document.querySelector(".pvp-status")?.textContent)).observe(document.querySelector(".pvp-status"), { childList: true, characterData: true, subtree: true }); });
  await p.click("text=相手をさがす");
  await p.waitForTimeout(4000);
  const seen = await p.evaluate(() => window.__st.join(" | "));
  if (!seen.includes("予備のサーバー")) fail(`fallback: ${seen}`); else console.log("fallback ok");
  await p.context().close();
}

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "firebase match ok");
await browser.close();
emu.kill();
process.exit(errors.length ? 1 : 0);
