// ============================================================================
// 対人戦のマッチング（Firebase Realtime Database）
//
// PeerJS の無料サーバーでは「決まった名前 1 つ」を取り合うので、同時にさがす人が多いと取り合いになって
// つながりにくかった。Firebase では「待っている人の行列」を置き、1 人ずつ確実に組む。
// 対戦の中身はこれまでどおり WebRTC で直接やり取りし、つながったら Firebase とのやり取りはやめる。
//
// 置き場所（ルールは firebase/database.rules.json。ほかの場所は読み書きできない）
//   m/v<版>/q/<行列>/<id> = { t: 並んだ時刻, h: まだいる合図の時刻, c: 組んだ相手の id }
//     行列は rand（ランダムマッチ）か room-<あいことば>。
//     c は一度書いたら書きかえられない（ルールで禁止）ので、同じ人を 2 人が取り合っても 1 人しか取れない。
//   m/v<版>/s/<id>/<push> = { f: 送り主の id, d: 中身（JSON の文字列） }  … 招待と返事の受け箱
//
// 組み方（1 回分）
//   1. 自分を行列に並べる（サーバーの時刻 t がわかる）
//   2. 自分より先に並んでいて、まだ組んでいない・生きている人がいれば：自分の行を先に自分で押さえ（ほかの人に取られないように）、
//      先頭から順に「c = 自分」を書いてみる。取れたらその人に招待を送る（入る側）
//   3. いなければ待つ（部屋を作る側）。取った人から招待が届いたら返事をする。
//      待っている間も 5 秒ごとに行列を見て、先に並んでいる人がいれば 2 へ（同時に並んだときの行きちがい対策）
//
// 公開の設定値（ブラウザに書いてよい値。守りはルールがする）。空ならこれまでの PeerJS を使う。
// テストでは localStorage の yokai-taisen:fbDb にエミュレーターの URL（http://127.0.0.1:9000?ns=xxx）を入れる。
// ============================================================================

var FB_DB = "https://minin-48ece-default-rtdb.asia-southeast1.firebasedatabase.app";
var FB_ALIVE = 30000; // これより長く合図がない人は、いなくなったとみなす
var FB_BEAT = 10000;

function fbBase() {
  const u = String(loadStored("fbDb", "") || FB_DB).trim();
  return /^https?:\/\//.test(u) ? u.replace(/\/+(\?|$)/, "$1") : "";
}

function fbUrl(path, params = "") {
  const [base, q = ""] = fbBase().split("?");
  const qs = [q, params].filter(Boolean).join("&");
  return `${base}/m/v${NET_VER}/${path}.json${qs ? "?" + qs : ""}`;
}

// 通信が一瞬切れた・サーバーが混んでいる（5xx）ときは、少し待って 3 回までやり直す。
// 同じものを二度送っても困らない（受け箱は届いた順に 1 回だけ読み、招待や返事の二通目は捨てる）
async function fbReq(method, path, body, params) {
  for (let i = 0; ; i++) {
    let r = null;
    try { r = await fetch(fbUrl(path, params), { method, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" }); } catch {}
    if (r && (r.status === 401 || r.status === 403)) return { denied: !0 };
    if (r?.ok) return { ok: !0, data: await r.json() };
    if (i >= 2 || (r && r.status < 500 && r.status !== 429)) throw new Error("マッチングのサーバーにつながらない");
    await new Promise(res => setTimeout(res, 300 * 3 ** i));
  }
}

var FB_SV = { ".sv": "timestamp" };
var fbId = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

// 自分の受け箱を見張る（REST のストリーム）。届いたものを 1 回ずつ fn({ from, type, payload }) へ
function fbInbox(me, fn) {
  const seen = new Set();
  const es = new EventSource(fbUrl(`s/${me}`));
  const take = (key, v) => {
    if (seen.has(key) || !v || typeof v.f !== "string" || typeof v.d !== "string") return;
    seen.add(key);
    let m;
    try { m = JSON.parse(v.d); } catch { return; }
    fn({ from: v.f, type: m.type, payload: m.payload });
  };
  const on = ev => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (!m) return;
    if (m.path === "/") { if (m.data) for (const [k, v] of Object.entries(m.data)) take(k, v); }
    else { const k = m.path.split("/")[1]; if (m.path.split("/").length === 2) take(k, m.data); }
  };
  es.addEventListener("put", on);
  es.addEventListener("patch", on);
  // 閉じるときは届いたものを 1 件ずつ消す（受け箱ごと消すのはルールで禁止）
  return { close() { es.close(); for (const k of seen) fbReq("DELETE", `s/${me}/${k}`).catch(() => {}); } };
}

// 送ったもの（相手の受け箱の場所）。つながったら・やめたら消す
function fbSend(me, dst, type, payload, sent) {
  return fbReq("POST", `s/${dst}`, { f: me, d: JSON.stringify({ type, payload }) }).then(r => { r.ok && r.data?.name && sent?.push(`s/${dst}/${r.data.name}`); return r; });
}

// 招待（offer）を作る側の WebRTC
async function fbOfferPc(st) {
  const pc = new RTCPeerConnection({ iceServers: NET_STUN });
  st.pcs.push(pc);
  const ch = pc.createDataChannel("yokai-taisen", { ordered: !0 });
  await pc.setLocalDescription(await pc.createOffer());
  await iceGathered(pc);
  return { pc, ch, sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } };
}

function fbOpened(pc, ch, role, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(Object.assign(new Error("つながらなかった（回線の相性かもしれない）"), { retry: !0 })), ms);
    const open = () => { clearTimeout(t); const l = rtcLink(pc, ch); l.role = role; res(l); };
    if (ch.readyState === "open") open(); else ch.onopen = open;
  });
}

// pool："rand" か "room-<あいことば>"。返り値は autoMatch と同じ { opened, cancel }
function fbMatch(pool, say, opts = {}) {
  const me = fbId(), st = { cancelled: !1, pcs: [], timers: [] };
  const sent = [];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const t0 = performance.now();
  let inbox = null, listener = null, mine = !1;
  const q = id => `q/${pool}/${id}`;
  const cleanup = () => {
    st.timers.forEach(clearInterval), st.timers = [];
    inbox?.close(), inbox = null;
    if (mine) fbReq("DELETE", q(me)).catch(() => {}), mine = !1;
    for (const p of sent.splice(0)) fbReq("DELETE", p).catch(() => {});
  };
  const check = () => { if (st.cancelled) throw new Error("やめた"); };

  // 届いたもの：待っている側は招待（OFFER）、入る側は返事（ANSWER）
  const waitAnswer = (from, ms) => new Promise((res, rej) => {
    const t = setTimeout(() => { listener = null; rej(Object.assign(new Error("返事がない"), { retry: !0 })); }, ms);
    listener = m => { if (m.from === from && m.type === "ANSWER") { clearTimeout(t); listener = null; res(m.payload); } };
  });

  // 先に並んでいて、まだ組んでいない・生きている人（古い順）
  const others = async (now, myT) => {
    const r = await fbReq("GET", `q/${pool}`, undefined, 'orderBy="t"&limitToLast=50');
    const list = Object.entries(r.data ?? {}).filter(([id, v]) => id !== me && v && typeof v.t === "number" && !v.c && Math.max(v.t, v.h ?? 0) > now - FB_ALIVE);
    return list.filter(([id, v]) => v.t < myT || (v.t === myT && id < me)).sort((a, b) => a[1].t - b[1].t || (a[0] < b[0] ? -1 : 1)).map(x => x[0]);
  };

  // 入る側：相手の行を取れたら招待を送り、返事でつなぐ
  const join = async dst => {
    say(opts.joinText ?? "相手が見つかった。つないでいます…", "wait");
    const { pc, ch, sdp } = await fbOfferPc(st);
    check();
    const ans = waitAnswer(dst, 15000);
    await fbSend(me, dst, "OFFER", { sdp }, sent);
    try {
      await pc.setRemoteDescription(await ans);
      return await fbOpened(pc, ch, "guest", 20000);
    } catch (err) { pc.close(); throw err; }
  };

  // 待つ側：押さえた人（自分の行の c）からの招待にだけ返事をする
  // 待つ準備の切りかえ中に届いた招待は取っておき、待ちに入ったら読み直す
  let hostResolve = null, hostBusy = !1, stash = null;
  const onOffer = async m => {
    if (m.type !== "OFFER" || hostBusy) return;
    if (!hostResolve) { stash = m; return; }
    stash = null;
    const r = await fbReq("GET", q(me)).catch(() => null);
    if (!r?.data || r.data.c !== m.from) return;
    hostBusy = !0;
    const pc = new RTCPeerConnection({ iceServers: NET_STUN });
    st.pcs.push(pc);
    const opened = new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("つながらなかった")), 25000);
      pc.ondatachannel = ev => {
        const ch = ev.channel;
        const open = () => { clearTimeout(t); const l = rtcLink(pc, ch); l.role = "host"; res(l); };
        if (ch.readyState === "open") open(); else ch.onopen = open;
      };
    });
    try {
      await pc.setRemoteDescription(m.payload.sdp);
      await pc.setLocalDescription(await pc.createAnswer());
      await iceGathered(pc);
      await fbSend(me, m.from, "ANSWER", { type: pc.localDescription.type, sdp: pc.localDescription.sdp }, sent);
      hostResolve(await opened);
    } catch {
      // 入ってきた人がいなくなった：行を並び直して、また待つ
      pc.close(), hostBusy = !1;
      hostResolve?.(null);
    }
  };

  const opened = (async () => {
    if (!fbBase()) throw new Error("マッチングのサーバーが設定されていない");
    inbox = fbInbox(me, m => listener ? listener(m) : onOffer(m));
    for (;;) {
      check();
      // 1. 並ぶ
      const put = await fbReq("PUT", q(me), { t: FB_SV });
      if (!put.ok) throw new Error("マッチングのサーバーにつながらない");
      mine = !0;
      const myT = put.data.t, skew = myT - Date.now();
      let targets = await others(myT, myT);
      check();
      // 3. だれもいなければ待つ。5 秒ごとに行列を見直す
      if (!targets.length) {
        say(opts.waitText ?? "相手を待っています…", "wait");
        const link = await new Promise((res, rej) => {
          hostResolve = res;
          st.rej = rej;
          stash && onOffer(stash);
          st.timers.push(setInterval(() => fbReq("PATCH", q(me), { h: FB_SV }).catch(() => {}), FB_BEAT));
          st.timers.push(setInterval(async () => {
            if (hostBusy || st.cancelled) return;
            try {
              const r = await fbReq("GET", q(me));
              if (!r.data) { res("again"); return; } // だれかに消された：並び直す
              if (r.data.c) return; // 押さえられた：招待を待つ
              if ((await others(Date.now() + skew, myT)).length) res("again");
            } catch {}
          }, 5000));
        });
        st.timers.forEach(clearInterval), st.timers = [], hostResolve = null;
        if (link && link !== "again") return link;
        if (link === null) { await fbReq("DELETE", q(me)); mine = !1; continue; }
        // 先に並んでいる人がいた：自分の行を押さえて、その人を取りに行く
        targets = await others(Date.now() + skew, myT);
        if (!targets.length) { await fbReq("DELETE", q(me)); mine = !1; continue; }
      }
      // 2. 自分の行を先に押さえる（取られていたら、取った人の招待を待つ）
      const lock = await fbReq("PUT", `${q(me)}/c`, me);
      if (lock.denied) {
        say(opts.waitText ?? "相手を待っています…", "wait");
        const link = await new Promise(res => { hostResolve = res; st.timers.push(setTimeout(() => res(null), 20000)); stash && onOffer(stash); });
        hostResolve = null;
        if (link) return link;
        await fbReq("DELETE", q(me)); mine = !1;
        continue;
      }
      for (const dst of targets) {
        check();
        const c = await fbReq("PUT", `${q(dst)}/c`, me);
        if (!c.ok) continue; // ほかの人が先に取った・いなくなった
        await fbReq("DELETE", q(me)); mine = !1;
        try { return await join(dst); }
        catch (err) {
          if (!err.retry || st.cancelled) throw err;
          fbReq("DELETE", q(dst)).catch(() => {}); // 返事がない人は行列から外す
          break;
        }
      }
      if (mine) { await fbReq("DELETE", q(me)); mine = !1; }
      say(`${opts.retryText ?? "相手をさがしています…"}（${Math.round((performance.now() - t0) / 1000)} 秒）`, "wait");
      await sleep(300 + Math.random() * 700);
    }
  })();
  opened.then(cleanup, cleanup);
  return {
    opened,
    cancel() {
      st.cancelled = !0;
      hostResolve?.(null);
      st.rej?.(new Error("やめた"));
      st.pcs.forEach(pc => { try { pc.close(); } catch {} });
      cleanup();
    },
  };
}

// ロビーから：Firebase が設定されていればそちら、なければこれまでの PeerJS。
// Firebase につながらないとき（落ちている・無料枠を使いきった など）も PeerJS でさがし直す
function startMatch(kind, word, say, opts) {
  if (!fbBase()) return autoMatch(matchId(kind, word), say, opts);
  let cur = fbMatch(word ? `${kind}-${word}` : kind, say, opts), stopped = !1;
  const opened = cur.opened.catch(err => {
    if (stopped || err.message !== "マッチングのサーバーにつながらない") throw err;
    say("予備のサーバーでさがします…", "wait");
    cur = autoMatch(matchId(kind, word), say, opts);
    return cur.opened;
  });
  return { opened, cancel() { stopped = !0; cur.cancel(); } };
}
