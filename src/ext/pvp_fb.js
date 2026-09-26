// ============================================================================
// 対人戦のマッチング（Firebase Realtime Database）
//
// PeerJS の無料サーバーでは「決まった名前 1 つ」を取り合うので、同時にさがす人が多いと取り合いになって
// つながりにくかった。Firebase では「待っている人の行列」を置き、1 人ずつ確実に組む。
// 対戦の中身はこれまでどおり WebRTC で直接やり取りし、つながったら Firebase とのやり取りはやめる。
//
// 置き場所（ルールは firebase/database.rules.json。ほかの場所は読み書きできない）
//   m/v<版>/q/<行列>/<id> = { t: 並んだ時刻, h: まだいる合図の時刻, c: 組んだ相手の id }
//     行列は p<作法の版>-rand（ランダムマッチ）か p<作法の版>-room-<あいことば>。
//     c は一度書いたら書きかえられない（ルールで禁止）ので、同じ人を 2 人が取り合っても 1 人しか取れない。
//   m/v<版>/s/<id>/<push> = { f: 送り主の id, d: 中身（JSON の文字列） }  … 招待・返事・ICE の候補の受け箱
//
// 組み方（1 回分）
//   1. 自分を行列に並べる（サーバーの時刻 t がわかる）
//   2. 自分より先に並んでいて、まだ組んでいない・生きている人がいれば：自分の行を先に自分で押さえ（ほかの人に取られないように）、
//      先頭から順に「c = 自分」を書いてみる。取れたらその人に招待を送る（入る側）
//   3. いなければ待つ（部屋を作る側）。取った人から招待が届いたら返事をする。
//      待っている間も 5 秒ごとに行列を見て、先に並んでいる人がいれば 2 へ（同時に並んだときの行きちがい対策）
//   招待・返事はすぐ送り、ICE の候補はあとから 1 つずつ送る（トリクル ICE）。つながらなかった相手は 1 分選ばない
//
// 公開の設定値（ブラウザに書いてよい値。守りはルールがする）。空ならこれまでの PeerJS を使う。
// テストでは localStorage の yokai-taisen:fbDb にエミュレーターの URL（http://127.0.0.1:9000?ns=xxx）を入れる。
// ============================================================================

var FB_DB = "https://minin-48ece-default-rtdb.asia-southeast1.firebasedatabase.app";
// これより長く合図がない人は、いなくなったとみなす。裏のタブではタイマーが 1 分に 1 回まで間引かれるので、それより長く
var FB_ALIVE = 75000;
var FB_BEAT = 10000;
var FB_ANSWER = 10000; // 招待への返事を待つ長さ（トリクル ICE なので、ふつうは 1〜2 秒で来る）
var FB_BAD = 60000; // つながらなかった相手を選ばない長さ
var FB_PROTO = 2; // 行列の作法の版（2：トリクル ICE）。ちがう版の人とは組まない

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

// トリクル ICE：候補（つながる道すじ）が全部そろうのを待たず、見つかった順に送る。
// そろうのを待つと STUN に届かない回線で 1 回 5 秒ずつかかり、組むたびに 10 秒以上むだにしていた。
// 送るのは 1 通ずつ順番に（招待・返事が先に届くように）。やめた・つながったあと（st.done）は送らない
function fbSender(me, dst, sent, st) {
  let chain = Promise.resolve();
  return (type, payload) => (chain = chain.then(async () => {
    if (st.done) return;
    await fbSend(me, dst, type, payload, sent);
    if (st.done) for (const p of sent.splice(0)) fbReq("DELETE", p).catch(() => {}); // 送っている間に片づけが終わっていた
  }).catch(() => {}));
}

// 相手の候補は、相手の招待・返事を入れるまで取っておく
function fbRemote(pc) {
  const wait = [];
  let ready = !1;
  const add = c => pc.addIceCandidate(c).catch(() => {});
  return {
    add(c) { if (!c || typeof c.candidate !== "string") return; ready ? add(c) : wait.length < 60 && wait.push(c); },
    async set(desc) { await pc.setRemoteDescription(desc); ready = !0; wait.splice(0).forEach(add); },
  };
}

// データチャネルが開いたらつながった。ICE が失敗したと分かった時点ですぐあきらめる（20 秒待たない）
function fbOpened(pc, getCh, role, ms) {
  return new Promise((res, rej) => {
    const fail = msg => { clearTimeout(t); rej(Object.assign(new Error(msg), { retry: !0 })); };
    const t = setTimeout(() => fail("つながらなかった（回線の相性かもしれない）"), ms);
    pc.addEventListener("iceconnectionstatechange", () => pc.iceConnectionState === "failed" && fail("つながらなかった（回線の相性かもしれない）"));
    const wire = ch => {
      const open = () => { clearTimeout(t); const l = rtcLink(pc, ch); l.role = role; res(l); };
      if (ch.readyState === "open") open(); else ch.onopen = open;
    };
    const ch = getCh();
    if (ch) wire(ch); else pc.ondatachannel = ev => wire(ev.channel);
  });
}

// pool："rand" か "room-<あいことば>"。返り値は autoMatch と同じ { opened, cancel }
function fbMatch(pool, say, opts = {}) {
  const me = fbId(), st = { cancelled: !1, pcs: [], timers: [] };
  const sent = [];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const t0 = performance.now();
  let inbox = null, listener = null, mine = !1;
  // 前の版（候補をまとめて送る）の人とは行列を分ける。ルールは $pool なので書きかえ不要
  const qp = `q/p${FB_PROTO}-${pool}`, q = id => `${qp}/${id}`;
  // つながらなかった相手はしばらく選ばない（2 人だけのとき、同じ相手と何度も失敗し続けないように）
  const bad = new Map();
  const isBad = id => (bad.get(id) ?? 0) > Date.now();
  const markBad = id => bad.set(id, Date.now() + FB_BAD);
  // 相手ごとの候補の受け口（相手の招待・返事より先に届いた候補も取っておく）
  const ice = new Map();
  const iceIn = (from, c) => { const r = ice.get(from); if (r && !Array.isArray(r)) r.add(c); else if (!r) ice.size < 20 && ice.set(from, [c]); else if (r.length < 60) r.push(c); };
  const iceFor = (from, pc) => { const r = fbRemote(pc), early = ice.get(from); ice.set(from, r); Array.isArray(early) && early.forEach(c => r.add(c)); return r; };
  const beat = () => mine && fbReq("PATCH", q(me), { h: FB_SV }).catch(() => {});
  // タブを閉じたら行列から外す（残ると、ほかの人がいない相手を取りに行ってむだに待つ）
  const onHide = () => { if (mine) try { fetch(fbUrl(q(me)), { method: "DELETE", keepalive: !0 }); } catch {} };
  // 裏のタブではタイマーが 1 分に 1 回まで間引かれることがある。表に戻ったらすぐ合図する
  const onShow = () => document.hidden || beat();
  addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", onShow);
  const cleanup = () => {
    st.done = !0;
    removeEventListener("pagehide", onHide);
    document.removeEventListener("visibilitychange", onShow);
    st.timers.forEach(clearInterval), st.timers = [];
    inbox?.close(), inbox = null;
    if (mine) fbReq("DELETE", q(me)).catch(() => {}), mine = !1;
    for (const p of sent.splice(0)) fbReq("DELETE", p).catch(() => {});
  };
  const check = () => { if (st.cancelled) throw new Error("やめた"); };
  const unqueue = async () => { mine = !1; await fbReq("DELETE", q(me)).catch(() => {}); };

  // 届いたもの：待っている側は招待（OFFER）、入る側は返事（ANSWER）
  const waitAnswer = (from, ms) => new Promise((res, rej) => {
    const t = setTimeout(() => { listener = null; rej(Object.assign(new Error("返事がない"), { retry: !0 })); }, ms);
    listener = m => { if (m.from === from && m.type === "ANSWER") { clearTimeout(t); listener = null; res(m.payload); } };
  });

  // 先に並んでいて、まだ組んでいない・生きている人（古い順）
  const others = async (now, myT) => {
    const r = await fbReq("GET", qp, undefined, 'orderBy="t"&limitToLast=50');
    const list = Object.entries(r.data ?? {}).filter(([id, v]) => id !== me && !isBad(id) && v && typeof v.t === "number" && !v.c && Math.max(v.t, v.h ?? 0) > now - FB_ALIVE);
    return list.filter(([id, v]) => v.t < myT || (v.t === myT && id < me)).sort((a, b) => a[1].t - b[1].t || (a[0] < b[0] ? -1 : 1)).map(x => x[0]);
  };

  // 入る側：相手の行を取れたら招待を送り、返事でつなぐ
  const join = async dst => {
    say(opts.joinText ?? "相手が見つかった。つないでいます…", "wait");
    const pc = new RTCPeerConnection({ iceServers: NET_STUN });
    st.pcs.push(pc);
    const ch = pc.createDataChannel("yokai-taisen", { ordered: !0 });
    const send = fbSender(me, dst, sent, st), remote = iceFor(dst, pc);
    try {
      const offer = await pc.createOffer();
      const ans = waitAnswer(dst, FB_ANSWER);
      send("OFFER", { sdp: { type: offer.type, sdp: offer.sdp } });
      pc.onicecandidate = ev => ev.candidate && send("ICE", ev.candidate.toJSON());
      await pc.setLocalDescription(offer);
      check();
      await remote.set(await ans);
      return await fbOpened(pc, () => ch, "guest", 20000);
    } catch (err) { pc.close(); throw err; }
  };

  // 待つ側：押さえた人（自分の行の c）からの招待にだけ返事をする
  // 待つ準備の切りかえ中に届いた招待は取っておき、待ちに入ったら読み直す
  let hostResolve = null, hostBusy = !1, stash = null;
  const onOffer = async m => {
    if (m.type !== "OFFER" || hostBusy || isBad(m.from)) return;
    if (!hostResolve) { stash = m; return; }
    stash = null;
    const r = await fbReq("GET", q(me)).catch(() => null);
    if (!r?.data || r.data.c !== m.from || hostBusy) return;
    if (!hostResolve) { stash = m; return; } // 確かめている間に待つ準備の切りかえが始まった：待ちに入ったら読み直す
    hostBusy = !0;
    const pc = new RTCPeerConnection({ iceServers: NET_STUN });
    st.pcs.push(pc);
    const send = fbSender(me, m.from, sent, st), remote = iceFor(m.from, pc);
    pc.onicecandidate = ev => ev.candidate && send("ICE", ev.candidate.toJSON());
    const opened = fbOpened(pc, () => null, "host", 25000);
    try {
      await remote.set(m.payload.sdp);
      const answer = await pc.createAnswer();
      send("ANSWER", { type: answer.type, sdp: answer.sdp });
      await pc.setLocalDescription(answer);
      hostResolve?.(await opened);
    } catch {
      // 入ってきた人とつながらなかった：行を並び直して、また待つ
      markBad(m.from);
      pc.close(), hostBusy = !1;
      hostResolve?.(null);
    }
  };

  const opened = (async () => {
    if (!fbBase()) throw new Error("マッチングのサーバーが設定されていない");
    inbox = fbInbox(me, m => m.type === "ICE" ? iceIn(m.from, m.payload) : listener ? listener(m) : onOffer(m));
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
          let claimed = 0;
          hostResolve = res;
          st.rej = rej;
          stash && onOffer(stash);
          st.timers.push(setInterval(beat, FB_BEAT));
          st.timers.push(setInterval(async () => {
            if (hostBusy || st.cancelled) return;
            try {
              const r = await fbReq("GET", q(me));
              if (hostBusy) return;
              if (!r.data) { res("again"); return; } // だれかに消された：並び直す
              // 押さえられた：招待を待つ。押さえた人が招待を送らずにいなくなったら並び直す（ずっと待ち続けない）
              if (r.data.c) { claimed ||= Date.now(); if (Date.now() - claimed > FB_ANSWER) res(null); return; }
              claimed = 0;
              if ((await others(Date.now() + skew, myT)).length) res("again");
            } catch {}
          }, 5000));
        });
        st.timers.forEach(clearInterval), st.timers = [], hostResolve = null;
        if (link && link !== "again") return link;
        if (link === null) { await unqueue(); continue; }
        // 先に並んでいる人がいた：自分の行を押さえて、その人を取りに行く
        targets = await others(Date.now() + skew, myT);
        if (!targets.length) { await unqueue(); continue; }
      }
      // 2. 自分の行を先に押さえる（取られていたら、取った人の招待を待つ）
      const lock = await fbReq("PUT", `${q(me)}/c`, me);
      if (lock.denied) {
        say(opts.waitText ?? "相手を待っています…", "wait");
        const link = await new Promise(res => { hostResolve = res; st.timers.push(setTimeout(() => res(null), FB_ANSWER + 5000)); stash && onOffer(stash); });
        st.timers.forEach(clearTimeout), st.timers = [], hostResolve = null;
        if (link) return link;
        await unqueue();
        continue;
      }
      for (const dst of targets) {
        check();
        const c = await fbReq("PUT", `${q(dst)}/c`, me);
        if (!c.ok) continue; // ほかの人が先に取った・いなくなった
        await unqueue();
        try { return await join(dst); }
        catch (err) {
          if (!err.retry || st.cancelled) throw err;
          markBad(dst);
          fbReq("DELETE", q(dst)).catch(() => {}); // 返事がない・つながらない人は行列から外す（相手は並び直す）
          break;
        }
      }
      if (mine) await unqueue();
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
