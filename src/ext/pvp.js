// ============================================================================
// 対人戦（オンライン）
//
// しくみ：部屋を作った側（ホスト）だけが対戦を進める。入った側（ゲスト）は自分の入力をホストへ送り、
// ホストは 1 tick（50ms）ごとに「その tick に入れた両者の入力」を送り返す。対戦ロジックは同じ入力なら
// 必ず同じ結果になる（整数計算と固定の乱数）ので、ゲストも同じ入力を順に流して同じ対戦を再現する。
// 念のため 5 秒ごとに状態をまるごと送って合わせ直す。
// ゲストの画面にはプレイヤー 0 / 1 を入れ替えた状態を見せるので、どちらも「自分が手前・下画面」になる。
//
// 通信：WebRTC のデータチャネル（サーバーなし。招待コード → 返事コードを LINE などで手渡しする）、
//       または同じブラウザの別タブ・別ウィンドウ（BroadcastChannel。部屋番号で入る）。
// 対人戦では回復などのアイテムはなし（エンジンの state.noItems。バッグも空）。そうびはそのまま効く。
// ============================================================================

var NET_VER = 3; // 妖怪が本家の 398 体だけになった版（id が変わった）
var NET_TICK_SNAP = 100; // 何 tick ごとに状態をまるごと送るか
var NET_STUN = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun.cloudflare.com:3478" }];
var NET_INPUTS = new Set(["rotate", "target", "purify", "ultStart", "ultRelease", "ultCharge", "ultCancel", "purifyTap", "pokeStart", "pokeTap", "pokeStop"]);
var PVP = null; // いまの接続（ロビー〜対戦〜再戦まで同じもの）

// ---- 通信路：どちらの方式でも send / onmsg / onclose だけを使う ----
class NetLink {
  constructor(kind, sendRaw, closeRaw) {
    this.kind = kind, this.sendRaw = sendRaw, this.closeRaw = closeRaw;
    this.onmsg = null, this.onclose = null, this.closed = !1, this.q = [];
    this.seen = performance.now();
    // 1 秒ごとに合図を送り、8 秒なにも届かなければ切れたとみなす
    this.beat = setInterval(() => {
      this.send({ k: "ping", t: performance.now() });
      if (performance.now() - this.seen > 8000) this.lost();
    }, 1000);
  }
  send(o) {
    if (this.closed) return;
    try { this.sendRaw(JSON.stringify(o)); } catch { this.lost(); }
  }
  recv(text) {
    this.seen = performance.now();
    let m;
    try { m = JSON.parse(text); } catch { return; }
    if (!m || typeof m.k !== "string") return;
    if (m.k === "ping") return this.send({ k: "pong", t: m.t });
    if (m.k === "pong") { this.rtt = Math.round(performance.now() - m.t); return; }
    this.onmsg ? this.onmsg(m) : this.q.push(m);
  }
  listen(fn) {
    this.onmsg = fn;
    const q = this.q;
    this.q = [];
    q.forEach(fn);
  }
  lost() {
    if (this.closed) return;
    this.closed = !0;
    clearInterval(this.beat);
    try { this.closeRaw(); } catch {}
    this.onclose?.();
  }
  close() {
    this.send({ k: "bye" });
    this.lost();
  }
}

// ---- WebRTC（招待コードと返事コードを手で渡す） ----
async function packDesc(desc) {
  const bytes = new TextEncoder().encode(JSON.stringify({ t: desc.type, s: desc.sdp }));
  const z = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
  let bin = "";
  for (const b of z) bin += String.fromCharCode(b);
  return "YT" + NET_VER + "." + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function unpackDesc(code) {
  const m = String(code).trim().replace(/\s+/g, "").match(/^(?:.*[#&]join=)?YT(\d+)\.([A-Za-z0-9_-]+)$/);
  if (!m) throw new Error("コードの形がちがう");
  if (Number(m[1]) !== NET_VER) throw new Error("相手とゲームの版がちがう");
  const bin = atob(m[2].replace(/-/g, "+").replace(/_/g, "/"));
  const z = Uint8Array.from(bin, ch => ch.charCodeAt(0));
  const text = await new Response(new Blob([z]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  const o = JSON.parse(text);
  return { type: o.t, sdp: o.s };
}

function iceGathered(pc) {
  return new Promise(res => {
    if (pc.iceGatheringState === "complete") return res();
    const f = () => { if (pc.iceGatheringState === "complete") res(); };
    pc.addEventListener("icegatheringstatechange", f);
    setTimeout(res, 5000); // STUN に届かなくても、見つかった分で進める
  });
}

function rtcLink(pc, ch) {
  const link = new NetLink("rtc", t => ch.send(t), () => { ch.close(); pc.close(); });
  ch.onmessage = ev => link.recv(ev.data);
  ch.onclose = () => link.lost();
  pc.addEventListener("connectionstatechange", () => { if (pc.connectionState === "failed" || pc.connectionState === "closed") link.lost(); });
  return link;
}

async function rtcHost() {
  const pc = new RTCPeerConnection({ iceServers: NET_STUN });
  const ch = pc.createDataChannel("yokai-taisen", { ordered: !0 });
  await pc.setLocalDescription(await pc.createOffer());
  await iceGathered(pc);
  const code = await packDesc(pc.localDescription);
  const opened = new Promise((res, rej) => { ch.onopen = () => res(rtcLink(pc, ch)); setTimeout(() => rej(new Error("つながらなかった")), 60000 * 10); });
  return {
    code, opened,
    async accept(answer) {
      const d = await unpackDesc(answer);
      if (d.type !== "answer") throw new Error("これは招待コード。相手から届いた「返事コード」を貼る");
      await pc.setRemoteDescription(d);
    },
    cancel() { pc.close(); },
  };
}

async function rtcGuest(offer) {
  const d = await unpackDesc(offer);
  if (d.type !== "offer") throw new Error("これは返事コード。相手から届いた「招待コード」を貼る");
  const pc = new RTCPeerConnection({ iceServers: NET_STUN });
  const opened = new Promise((res, rej) => {
    pc.ondatachannel = ev => {
      const ch = ev.channel;
      let link = null; // 開いた合図が二度来ても通信路は 1 つだけ作る
      const open = () => { link ??= rtcLink(pc, ch); res(link); };
      ch.onopen = open;
      if (ch.readyState === "open") open();
    };
    setTimeout(() => rej(new Error("つながらなかった")), 60000 * 10);
  });
  await pc.setRemoteDescription(d);
  await pc.setLocalDescription(await pc.createAnswer());
  await iceGathered(pc);
  return { code: await packDesc(pc.localDescription), opened, cancel() { pc.close(); } };
}

// ---- マッチング（コードの手渡しなし） ----
// 公開のシグナリングサーバー（PeerJS の無料サーバー）で、WebRTC の招待と返事だけを中継してもらう。
// 対戦の中身はこれまでどおり WebRTC で直接やり取りし、つながったらサーバーとの接続は閉じる。
// サーバーでは「名前（ID）」ごとに 1 人しか待てないので、決まった名前を先に取れた人が部屋を作る側、
// 取れなかった人（＝もう誰かが待っている）がそこへ入る側になる。
//   ランダムマッチ：みんな同じ名前 yt<版>-rand を取り合う（版がちがう人とは当たらない）
//   あいことば    ：yt<版>-room-<あいことば> を取り合う
var MATCH_HOST = "0.peerjs.com";
// テストでは手元の PeerJS サーバーを使う（localStorage の yokai-taisen:matchHost に "localhost:9000" など）
function matchUrl() {
  const h = loadStored("matchHost", "") || MATCH_HOST;
  return (/^(localhost|127\.)/.test(h) ? "ws://" : "wss://") + h;
}
var MATCH_TIMEOUT = 20000; // 返事を待つ長さ

function matchId(kind, word = "") {
  return `yt${NET_VER}-${kind}${word ? "-" + word : ""}`;
}

// シグナリングサーバーに id でつなぐ。取られていたら err.taken
function sigOpen(id) {
  return new Promise((res, rej) => {
    const token = Math.random().toString(36).slice(2);
    let ws;
    try { ws = new WebSocket(`${matchUrl()}/peerjs?key=peerjs&id=${encodeURIComponent(id)}&token=${token}&version=1.5.4`); }
    catch (err) { return rej(err); }
    let done = !1, hb = 0;
    const handlers = new Set();
    const sock = {
      id,
      send(type, dst, payload) { if (ws.readyState === 1) ws.send(JSON.stringify({ type, dst, payload })); },
      on(f) { handlers.add(f); return () => handlers.delete(f); },
      close() { clearInterval(hb); ws.onclose = ws.onerror = null; try { ws.close(); } catch {} },
    };
    const fail = err => { if (!done) { done = !0; clearTimeout(to); sock.close(); rej(err); } };
    const to = setTimeout(() => fail(new Error("マッチングのサーバーにつながらない")), 10000);
    ws.onmessage = ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === "OPEN") { done = !0; clearTimeout(to); hb = setInterval(() => ws.readyState === 1 && ws.send('{"type":"HEARTBEAT"}'), 5000); res(sock); }
      else if (m.type === "ID-TAKEN") fail(Object.assign(new Error("taken"), { taken: !0 }));
      else if (m.type === "ERROR" || m.type === "INVALID-KEY") fail(new Error("マッチングのサーバーにつながらない"));
      else handlers.forEach(f => f(m));
    };
    ws.onerror = ws.onclose = () => fail(new Error("マッチングのサーバーにつながらない"));
  });
}

// 部屋を作る側：id で待ち、最初に来た 1 人とつなぐ（あとから来た人には「いっぱい」と返す）
function sigWait(sock, st) {
  let busy = null;
  const opened = new Promise(res => {
    sock.on(async m => {
      if (m.type !== "OFFER" || !m.src || st.cancelled) return;
      if (busy) return sock.send("ANSWER", m.src, { busy: !0 });
      const pc = new RTCPeerConnection({ iceServers: NET_STUN });
      busy = pc;
      st.pcs.push(pc);
      // 相手が途中でいなくなったら、また待つ
      const giveUp = setTimeout(() => { if (busy === pc) { busy = null; pc.close(); } }, MATCH_TIMEOUT + 10000);
      pc.ondatachannel = ev => {
        const ch = ev.channel;
        const open = () => { clearTimeout(giveUp); sock.close(); const link = rtcLink(pc, ch); link.role = "host"; res(link); };
        if (ch.readyState === "open") open(); else ch.onopen = open;
      };
      try {
        await pc.setRemoteDescription(m.payload.sdp);
        await pc.setLocalDescription(await pc.createAnswer());
        await iceGathered(pc);
        sock.send("ANSWER", m.src, { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
      } catch { clearTimeout(giveUp); busy = null; pc.close(); }
    });
  });
  return opened;
}

// 入る側：待っている相手（dst）に招待を送り、返事でつなぐ。いない・いっぱいなら err.retry
async function sigJoin(dst, st) {
  const sock = await sigOpen(`yt${NET_VER}-g-${Math.random().toString(36).slice(2, 10)}`);
  st.socks.push(sock);
  const pc = new RTCPeerConnection({ iceServers: NET_STUN });
  st.pcs.push(pc);
  const ch = pc.createDataChannel("yokai-taisen", { ordered: !0 });
  try {
    await pc.setLocalDescription(await pc.createOffer());
    await iceGathered(pc);
    if (st.cancelled) throw new Error("やめた");
    const ans = await new Promise((res, rej) => {
      const t = setTimeout(() => rej(Object.assign(new Error("返事がない"), { retry: !0 })), MATCH_TIMEOUT);
      sock.on(m => {
        if (m.src !== dst) return;
        if (m.type === "ANSWER") { clearTimeout(t); m.payload?.busy ? rej(Object.assign(new Error("いっぱい"), { retry: !0, busy: !0 })) : res(m.payload.sdp); }
        if (m.type === "EXPIRE" || m.type === "LEAVE") { clearTimeout(t); rej(Object.assign(new Error("いなかった"), { retry: !0 })); }
      });
      sock.send("OFFER", dst, { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
    });
    await pc.setRemoteDescription(ans);
    const link = await new Promise((res, rej) => {
      const t = setTimeout(() => rej(Object.assign(new Error("つながらなかった（回線の相性かもしれない）"), { retry: !0 })), MATCH_TIMEOUT);
      const open = () => { clearTimeout(t); const l = rtcLink(pc, ch); l.role = "guest"; res(l); };
      if (ch.readyState === "open") open(); else ch.onopen = open;
    });
    sock.close();
    return link;
  } catch (err) {
    sock.close(), pc.close();
    throw err;
  }
}

// id を取り合って、待つか入るかを決める。つながるまでくり返す。
//   say(文, 種類) で様子を知らせる。返り値の cancel() でやめる
function autoMatch(id, say, opts = {}) {
  const st = { cancelled: !1, socks: [], pcs: [] };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const t0 = performance.now();
  const opened = (async () => {
    for (let round = 0; !st.cancelled; round++) {
      let sock = null;
      try { sock = await sigOpen(id); }
      catch (err) { if (!err.taken) throw err; }
      if (st.cancelled) { sock?.close(); break; }
      if (sock) {
        st.socks.push(sock);
        say(opts.waitText ?? "相手を待っています…", "wait");
        return await sigWait(sock, st);
      }
      say(opts.joinText ?? "相手が見つかった。つないでいます…", "wait");
      try { return await sigJoin(id, st); }
      catch (err) {
        if (!err.retry || st.cancelled) throw err;
        if (err.busy && opts.busyStop) throw new Error(opts.busyStop);
        say(`${opts.retryText ?? "相手をさがしています…"}（${Math.round((performance.now() - t0) / 1000)} 秒）`, "wait");
        await sleep(800 + Math.random() * 1600);
      }
    }
    throw new Error("やめた");
  })();
  return {
    opened,
    cancel() { st.cancelled = !0; st.socks.forEach(s => s.close()); st.pcs.forEach(pc => { try { pc.close(); } catch {} }); },
  };
}

// ---- 同じブラウザの別タブ（BroadcastChannel） ----
function tabLink(room, role) {
  const bc = new BroadcastChannel("yokai-taisen:room:" + room);
  const me = Math.random().toString(36).slice(2);
  let peer = null, link = null, knock = 0;
  const opened = new Promise(res => {
    const make = () => {
      link = new NetLink("tab", t => bc.postMessage({ f: me, to: peer, d: t }), () => { clearInterval(knock); bc.close(); });
      addEventListener("pagehide", () => link.close());
      res(link);
    };
    bc.onmessage = ev => {
      const m = ev.data;
      if (!m || m.f === me) return;
      if (link) { if (m.f === peer && m.to === me) link.recv(m.d); return; }
      if (role === "host" && m.knock && !peer) { peer = m.f; bc.postMessage({ f: me, to: peer, welcome: !0 }); make(); }
      if (role === "guest" && m.welcome && m.to === me) { peer = m.f; clearInterval(knock); make(); }
    };
    if (role === "guest") {
      const k = () => bc.postMessage({ f: me, knock: !0 });
      k(), knock = setInterval(k, 700);
    }
  });
  return { opened, cancel() { clearInterval(knock); if (!link) bc.close(); } };
}

// ---- 対戦の同期 ----
function flipUid(u) { return typeof u === "number" ? (u + ii) % (ii * 2) : u; }
function flipPid(p) { return p === 0 || p === 1 ? 1 - p : p; }
function flipOutcome(o) { return o && { ...o, winner: flipPid(o.winner), by: flipPid(o.by) }; }

// ゲストに見せる状態：プレイヤーを入れ替え、uid・持ち主も入れ替える
function mirrorState(s) {
  const m = structuredClone(s);
  m.players.reverse();
  for (const p of m.players) for (const u of p.units) u.uid = flipUid(u.uid), u.owner = 1 - u.owner;
  m.lastActor = flipUid(m.lastActor);
  m.outcome = flipOutcome(m.outcome);
  return m;
}

function mirrorEvent(ev) {
  const o = { ...ev };
  for (const k of ["uid", "src", "dst", "from", "to"]) if (k in o) o[k] = flipUid(o[k]);
  if ("player" in o) o.player = flipPid(o.player);
  if (ev.t === "pokeStart" || ev.t === "pokeEnd") o.target = flipUid(o.target);
  if (ev.t === "end") o.outcome = flipOutcome(o.outcome);
  return o;
}

// 相手から届いた入力を、決まった形だけ通す（形がおかしいものはエンジンに渡さない）
function cleanInput(i) {
  if (!i || typeof i !== "object" || !NET_INPUTS.has(i.t)) return null;
  const o = { t: i.t };
  for (const k of ["dir", "steps", "enemyUnit", "allySlot", "grand", "amount", "cell", "at"]) if (k in i && (typeof i[k] === "number" || typeof i[k] === "string" || typeof i[k] === "boolean")) o[k] = i[k];
  return o;
}

// ホスト：その tick に入れるゲストの入力
function netHostInputs(e, t) {
  for (const i of e.net.inbox.splice(0)) t.push({ player: 1, input: i });
}

// ホスト：その tick に使った入力を送る（ゲストはこれで同じ tick を進める）
function netHostSend(e, t) {
  const n = e.state.tick;
  e.net.link.send(t.length ? { k: "t", n, i: t.map(x => [x.player, x.input]) } : { k: "t", n });
  if (n % NET_TICK_SNAP === 0 || e.state.outcome) e.net.link.send({ k: "snap", n, s: e.state });
}

// ゲスト：自分の入力はホストへ（「あわせろ！」は押した瞬間に見えていた tick を付ける）
function netGuestSend(e, input) {
  const i = { ...input };
  if (i.t === "ultRelease") i.at = e.canon.tick;
  e.net.link.send({ k: "in", i });
}

// ゲスト：届いた tick を順に進める（遅れていたら追いつくまで多めに進める）
function netGuestPump(e) {
  const q = e.net.stream;
  let n = 0;
  const budget = Math.max(3, Math.ceil(q.length / 3));
  while (q.length && n < budget && !e.canon.outcome) {
    const m = q.shift();
    if (m.k === "snap") {
      if (m.n === e.canon.tick) {
        if (JSON.stringify(m.s) !== JSON.stringify(e.canon)) e.net.resyncs++;
        e.canon = m.s;
        e.state = mirrorState(e.canon);
      }
      continue;
    }
    if (m.n !== e.canon.tick + 1) { e.net.gaps++; continue; }
    const ev = [];
    Uh(e.canon, (m.i ?? []).map(([player, input]) => ({ player, input })), ev);
    e.state = mirrorState(e.canon);
    playEvents(e, ev.map(mirrorEvent));
    n++;
  }
}

// 対戦中に接続が切れた
function netLost(e) {
  e.running = !1, zl();
  Jr(e, "接続が切れた", "sudden", "", 1600);
  Rt(e, "相手との接続が切れた", "f");
  setTimeout(() => {
    const a = q("div", "result"), box = q("div", "box");
    box.append(q("div", "big draw", "中断"), q("div", "muted", "相手との接続が切れたので、この対戦は記録しない"));
    const row = q("div", "row");
    row.style.justifyContent = "center";
    const back = q("button", "btn primary", "編成に戻る");
    back.onclick = () => { a.remove(), Ga = null, PVP = null, Sd(); };
    row.append(back), box.append(row), a.append(box), document.body.append(a);
  }, 1200);
}

// 対戦を始める（ホストもゲストも同じ種と同じ 2 チームから作る）
function startPvpBattle(net, seed, teams) {
  document.querySelector(".result")?.remove();
  document.querySelector(".pvp-lobby")?.remove();
  const canon = Rh(seed, teams[0], teams[1], { noItems: !0 });
  const guest = net.role === "guest";
  net.inbox = [], net.stream = [], net.resyncs = 0, net.gaps = 0, net.wantAgain = !1, net.peerAgain = !1;
  Kr.replaceChildren();
  const canvas = q("canvas", "stage"), scene = new e2(canvas);
  Ga = {
    state: guest ? mirrorState(canon) : canon,
    canon: guest ? canon : null,
    net,
    cpu: null,
    diff: Ri,
    stats: I2(),
    partners: [[], []],
    introUntil: performance.now() + 2300,
    introStep: -1,
    pending: [],
    zero: !1,
    mode: "none",
    running: !0,
    preview: 0,
    previewTimer: null,
    lastFrame: performance.now(),
    acc: 0,
    scene,
    refs: {},
    svg: {},
    plates: [],
    foeBars: new Map,
    logEl: q("div", "log"),
    called: "",
    wheelKey: "",
  };
  O2(Ga, canvas);
  const foe = Ga.state.players[1].units.map(u => ct[u.defIndex].name).join("・");
  Rt(Ga, `相手：${net.peerName}（${foe}）`, "f");
  Rt(Ga, "対人戦：アイテムはなし。そうびは効く", "a");
  for (const pid of [1, 0]) {
    const eqs = Ga.state.players[pid].units.map(u => { const eq = equipById(u.equipment ?? null); return eq ? `${ct[u.defIndex].name}＝${eq.name}` : null; }).filter(Boolean);
    Rt(Ga, `${pid ? "相手" : "こちら"}のそうび：${eqs.length ? eqs.join("・") : "なし"}`, pid ? "f" : "a");
  }
  xd(), requestAnimationFrame(Ud);
}

// 接続できたあと：名前とチームを送りあい、ホストが種を決めて始める
function pvpSession(link, role, name, team, status) {
  const net = { link, role, name, team, peerName: "相手", peerTeam: null };
  PVP = net;
  link.onclose = () => {
    net.closed = !0;
    if (Ga?.net === net) return; // 対戦中・結果画面は Ud / 結果のボタンが扱う
    status?.("相手との接続が切れた", "bad");
  };
  link.listen(m => {
    switch (m.k) {
      case "hello": {
        if (m.v !== NET_VER) { status?.("相手とゲームの版がちがう", "bad"); link.close(); return; }
        const bad = Array.isArray(m.team) ? Yn(m.team) : ["チームがない"];
        if (bad.length) { status?.(`相手の編成が正しくない：${bad.join(" / ")}`, "bad"); link.close(); return; }
        net.peerName = String(m.name ?? "相手").slice(0, 12) || "相手";
        net.peerTeam = m.team;
        status?.(`${net.peerName} とつながった。対戦を始める…`, "ok");
        matchFoundCue(net.peerName);
        if (role === "host" && Ga?.net !== net) pvpHostStart(net);
        break;
      }
      case "start":
        if (role === "guest" && !(Ga?.net === net && Ga.running) && Array.isArray(m.teams) && m.teams.length === 2) {
          try { startPvpBattle(net, m.seed >>> 0, m.teams); } catch (err) { status?.(`始められなかった：${err.message}`, "bad"); link.close(); }
        }
        break;
      case "in":
        if (role === "host" && Ga?.net === net) { const i = cleanInput(m.i); i && net.inbox.push(i); }
        break;
      case "t":
      case "snap":
        if (role === "guest" && Ga?.net === net) net.stream.push(m);
        break;
      case "again":
        net.peerAgain = !0;
        net.onAgain?.();
        if (role === "host" && net.wantAgain) pvpHostStart(net);
        break;
      case "bye":
        link.lost();
        break;
    }
  });
  link.send({ k: "hello", v: NET_VER, name, team });
}

// 相手が見つかったら、ほかのタブにいても気づけるように音とタブの名前で知らせる
function matchFoundCue(peer) {
  try {
    const A = window.AudioContext ?? window.webkitAudioContext, ac = new A(), t = ac.currentTime;
    [660, 880, 1320].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "triangle", o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.3);
      o.connect(g).connect(ac.destination), o.start(t + i * 0.12), o.stop(t + i * 0.12 + 0.32);
    });
    setTimeout(() => ac.close(), 1200);
  } catch {}
  if (document.hidden) {
    const old = document.title;
    let n = 0;
    const blink = setInterval(() => { document.title = n++ % 2 ? old : `【対戦】${peer} とつながった`; }, 800);
    const stop = () => { if (!document.hidden) { clearInterval(blink); document.title = old; document.removeEventListener("visibilitychange", stop); } };
    document.addEventListener("visibilitychange", stop);
  }
}

function pvpHostStart(net) {
  const seed = Xl();
  const teams = [net.team, net.peerTeam];
  net.link.send({ k: "start", seed, teams });
  startPvpBattle(net, seed, teams);
}

// 結果画面のボタンを対人戦用にする
function pvpResultButtons(e, wrap, again, back) {
  const net = e.net;
  again.textContent = "同じ相手ともう一度";
  const sync = () => {
    if (net.closed) { again.disabled = !0, again.textContent = "相手が抜けた"; return; }
    if (net.wantAgain) again.disabled = !0, again.textContent = net.peerAgain ? "始めます…" : "相手を待っています…";
    else if (net.peerAgain) again.textContent = "相手が再戦を希望！ もう一度";
  };
  net.onAgain = sync;
  const prevClose = net.link.onclose;
  net.link.onclose = () => { prevClose?.(); sync(); };
  again.onclick = () => {
    net.wantAgain = !0, net.link.send({ k: "again" }), sync();
    if (net.role === "host" && net.peerAgain) pvpHostStart(net);
  };
  back.onclick = () => { wrap.remove(), net.link.close(), Ga = null, PVP = null, Sd(); };
  sync();
  const rs = q("div", "muted small");
  rs.textContent = `通信：${net.link.kind === "rtc" ? "WebRTC" : "同じブラウザ"}${net.link.rtt ? `・往復 ${net.link.rtt}ms` : ""}${net.resyncs ? `・同期のずれを ${net.resyncs} 回なおした` : ""}`;
  again.parentElement ? again.parentElement.after(rs) : setTimeout(() => again.parentElement?.after(rs), 0);
}

// ---- ロビー（編成画面から開く） ----
function pvpEntryButton() {
  const b = q("button", "btn pvp-entry", "対人戦（人 vs 人）");
  b.title = "友だちと対戦する。そうびは効く・アイテムはなし";
  b.onclick = () => openPvpLobby();
  return b;
}

function openPvpLobby(joinCode = "", room = "") {
  document.querySelector(".pvp-lobby")?.remove();
  const team = teamMembers();
  const bad = Yn(team);
  const wrap = q("div", "result pvp-lobby"), box = q("div", "box");
  wrap.append(box);
  box.append(q("div", "big", "対人戦"));
  const note = q("div", "pvp-note");
  note.innerHTML = "いまの編成（6 体・性格・<b class=\"ok\">そうび</b>）で戦う。そうびは対人戦でも効く。<b>回復などのアイテムはなし</b>。";
  box.append(note);
  const faces = q("div", "pvp-team");
  for (const m of team) {
    const d = ct.find(x => x.id === m.unit), eq = equipById(m.equipment ?? null), cell = q("div", "pvp-mem"), f = q("span", "cf-pic");
    f.style.background = Pi[d.tribe], f.innerHTML = da(d.id, d.name.slice(0, 1));
    cell.title = eq ? `${d.name}：${eq.name}（${equipDesc(eq)}）` : `${d.name}：そうびなし`;
    cell.append(f, q("b", "", d.name), q("small", eq ? "eq" : "eq none", eq ? eq.name : "そうびなし"));
    faces.append(cell);
  }
  box.append(faces);
  const nameRow = q("label", "pvp-name");
  const nameIn = q("input");
  nameIn.maxLength = 12, nameIn.value = loadStored("pvpName", "") || "プレイヤー";
  nameIn.oninput = () => saveStored("pvpName", nameIn.value.trim());
  nameRow.append(q("span", "", "なまえ"), nameIn);
  box.append(nameRow);
  const status = q("div", "pvp-status");
  const say = (t, cls = "") => { status.textContent = t, status.className = "pvp-status " + cls; };
  let pending = null;
  const close = q("button", "btn", "とじる");
  close.onclick = () => { pending?.cancel?.(); if (PVP && !Ga) PVP.link.close(), PVP = null; wrap.remove(); };
  if (bad.length) {
    say(`編成が正しくない：${bad.join(" / ")}`, "bad");
    const row = q("div", "row");
    row.append(close), box.append(status, row), document.body.append(wrap);
    return;
  }
  const tabs = q("div", "pvp-tabs"), body = q("div", "pvp-body");
  const modes = [["random", "ランダムマッチ"], ["room", "あいことば"], ["code", "コードで（サーバーなし）"], ["tab", "この端末で 2 画面"]];
  const connected = link => { pending = null; say("接続できた。相手を待っています…", "ok"); pvpSession(link, link.role, nameIn.value.trim() || "プレイヤー", team, say); };
  // さがしている間のボタン（押すとやめる）
  const matchButton = (label, start) => {
    const go = q("button", "btn primary pvp-go", label);
    go.onclick = () => {
      if (pending) { pending.cancel(); pending = null; go.textContent = label; go.classList.remove("busy"); say("やめた"); return; }
      const m = start();
      if (!m) return;
      pending = m;
      go.textContent = "やめる", go.classList.add("busy");
      m.opened.then(connected, err => { if (pending === m) { pending = null; go.textContent = label; go.classList.remove("busy"); if (err.message !== "やめた") say(err.message, "bad"); } });
    };
    return go;
  };
  const show = mode => {
    pending?.cancel?.(), pending = null, say("");
    saveStored("pvpMode", mode);
    tabs.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.m === mode));
    body.replaceChildren();
    if (mode === "random") {
      body.append(q("div", "help", "押すだけで、いまさがしている人と対戦する。だれもいなければ、来るまで待つ（ほかのタブで遊んでいてよい。つながると音が鳴る）。"),
        matchButton("相手をさがす", () => startMatch("rand", "", say, { waitText: "さがしている人を待っています…（このまま待つ）" })));
    } else if (mode === "room") {
      const word = q("input", "pvp-room num");
      word.inputMode = "numeric", word.maxLength = 6, word.autocomplete = "off";
      word.value = room || loadStored("pvpRoom", "") || String(1000 + Math.floor(Math.random() * 9000));
      const reroll = q("button", "btn small", "べつの番号");
      reroll.onclick = () => { word.value = String(1000 + Math.floor(Math.random() * 9000)); };
      const share = q("button", "btn small", "さそうリンクをコピー");
      share.onclick = async () => {
        const url = location.href.split("#")[0] + "#room=" + word.value.trim();
        try { await navigator.clipboard.writeText(url); share.textContent = "コピーした"; } catch { say(url); }
      };
      const row = q("div", "row pvp-roomrow");
      row.append(word, reroll);
      if (/^https?:/.test(location.href)) row.append(share);
      const go = matchButton("この番号でつなぐ", () => {
        const w = word.value.trim();
        if (!/^\d{4,6}$/.test(w)) { say("あいことばは 4〜6 けたの数字", "bad"); return null; }
        saveStored("pvpRoom", w);
        return startMatch("room", w, say, { waitText: `「${w}」で相手を待っています…（相手にも同じ番号を入れてもらう）`, busyStop: `「${w}」はもう対戦中。べつの番号にする` });
      });
      body.append(q("div", "help", "友だちと同じ番号（4〜6 けた）を入れて、ふたりとも「つなぐ」を押す。先に押した方が部屋を作り、あとの人が入る。リンクを送れば、開くだけで同じ番号になる。"), row, go);
      if (room) setTimeout(() => go.click(), 0);
    } else if (mode === "code") {
      const sub = q("div", "pvp-tabs");
      const inner = q("div", "pvp-body");
      const pick = r => {
        pending?.cancel?.(), pending = null, say("");
        sub.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.r === r));
        inner.replaceChildren(...(r === "host" ? hostByCode() : guestByCode()));
      };
      for (const [r, label] of [["host", "部屋を作る"], ["guest", "部屋に入る"]]) {
        const b = q("button", "b-chip", label);
        b.dataset.r = r, b.onclick = () => pick(r);
        sub.append(b);
      }
      body.append(q("div", "help", "マッチングのサーバーにつながらないときの予備。招待コードと返事コードを LINE などで手渡しする（サーバーをまったく使わない）。"), sub, inner);
      pick(joinCode ? "guest" : "host");
    } else {
      const roomIn = q("input", "pvp-room num");
      roomIn.inputMode = "numeric", roomIn.maxLength = 4, roomIn.value = String(1000 + Math.floor(Math.random() * 9000));
      const mk = q("button", "btn primary", "この番号で部屋を作る"), jn = q("button", "btn", "この番号の部屋に入る");
      body.append(q("div", "help", "同じブラウザで別のタブ（またはウィンドウ）をもう 1 つ開き、片方で部屋を作り、もう片方で同じ番号の部屋に入る。1 台で 2 人が並んで遊ぶとき・動作の確認に。"), roomIn);
      const row = q("div", "row");
      row.append(mk, jn), body.append(row);
      const start = role => {
        const r = roomIn.value.trim();
        if (!/^\d{4}$/.test(r)) return say("部屋番号は 4 けたの数字", "bad");
        mk.disabled = jn.disabled = !0;
        const t = tabLink(r, role);
        pending = t;
        say(role === "host" ? `部屋 ${r} を作った。もう片方のタブで「この番号の部屋に入る」を押す` : `部屋 ${r} をさがしています…`);
        t.opened.then(link => { link.role = role; connected(link); });
      };
      mk.onclick = () => start("host"), jn.onclick = () => start("guest");
    }
  };
  const hostByCode = () => {
    const go = q("button", "btn primary", "招待コードを作る");
    go.onclick = async () => {
      go.disabled = !0, say("コードを作っています（数秒）…");
      try {
        const h = await rtcHost();
        pending = h;
        const code = codeBox(h.code, "招待コード（相手に送る）", !0);
        const ans = q("textarea", "pvp-code");
        ans.placeholder = "相手から届いた返事コードをここに貼る";
        const ok = q("button", "btn primary", "つなぐ");
        ok.onclick = async () => {
          try { await h.accept(ans.value); say("つないでいます…"); } catch (err) { say(err.message, "bad"); }
        };
        go.replaceWith(code, ans, ok);
        say("招待コードを相手に送って、返事を待つ");
        h.opened.then(link => { link.role = "host"; connected(link); }, err => say(err.message, "bad"));
      } catch (err) { go.disabled = !1, say(`作れなかった：${err.message}`, "bad"); }
    };
    return [q("div", "help", "① 招待コードを作って相手に送る → ② 相手から届いた返事コードを貼る。"), go];
  };
  const guestByCode = () => {
    const inv = q("textarea", "pvp-code");
    inv.placeholder = "相手から届いた招待コード（または招待リンク）をここに貼る";
    inv.value = joinCode;
    const go = q("button", "btn primary", "返事コードを作る");
    go.onclick = async () => {
      go.disabled = !0, say("返事コードを作っています（数秒）…");
      try {
        const g = await rtcGuest(inv.value);
        pending = g;
        inv.readOnly = !0;
        go.replaceWith(codeBox(g.code, "返事コード（相手に送る）", !1));
        say("返事コードを相手に送って、つながるのを待つ");
        g.opened.then(link => { link.role = "guest"; connected(link); }, err => say(err.message, "bad"));
      } catch (err) { go.disabled = !1, say(err.message, "bad"); }
    };
    if (joinCode) setTimeout(() => go.click(), 0);
    return [q("div", "help", "① 招待コードを貼る → ② できた返事コードを相手に送る。相手が貼るとつながる。"), inv, go];
  };
  for (const [m, label] of modes) {
    const b = q("button", "b-chip", label);
    b.dataset.m = m, b.onclick = () => show(m);
    tabs.append(b);
  }
  const row = q("div", "row");
  row.style.justifyContent = "center";
  row.append(close);
  box.append(tabs, body, status, row);
  document.body.append(wrap);
  const last = loadStored("pvpMode", "random");
  show(joinCode ? "code" : room ? "room" : modes.some(m => m[0] === last) ? last : "random");
}

// コードの表示とコピー（招待コードはリンクにもできる）
function codeBox(code, label, withLink) {
  const box = q("div", "pvp-codebox");
  const ta = q("textarea", "pvp-code");
  ta.readOnly = !0, ta.value = code, ta.onclick = () => ta.select();
  const row = q("div", "row");
  const cp = q("button", "btn small", "コピー");
  cp.onclick = async () => {
    try { await navigator.clipboard.writeText(code); cp.textContent = "コピーした"; } catch { ta.select(); document.execCommand?.("copy"); cp.textContent = "選択した"; }
  };
  row.append(q("span", "tag", label), cp);
  if (withLink && /^https?:/.test(location.href)) {
    const lk = q("button", "btn small", "招待リンクをコピー");
    lk.onclick = async () => {
      const url = location.href.split("#")[0] + "#join=" + code;
      try { await navigator.clipboard.writeText(url); lk.textContent = "コピーした"; } catch { ta.value = url; ta.select(); }
    };
    row.append(lk);
  }
  box.append(row, ta);
  return box;
}

// 招待リンク（…#join=コード）で開いたら、そのまま「部屋に入る」を開く
function pvpFromHash() {
  const m = location.hash.match(/^#join=(.+)$/), r = location.hash.match(/^#room=(\d{4,6})$/);
  if (m || r) history.replaceState(null, "", location.href.split("#")[0]);
  if (m) openPvpLobby(decodeURIComponent(m[1]));
  else if (r) openPvpLobby("", r[1]);
}
