// ============================================================================
// リプレイ（エンジン側）：乱数の種・両チーム・tick ごとの入力だけを残し、同じ対戦をもう一度作る。
//   対戦ロジックは同じ入力なら必ず同じ結果になる（対人戦もこれで同期している）ので、動画はいらない。
//   ・replayNew   対戦を始めるときに作る
//   ・replayPush  1 tick 進める直前に、その tick の入力を足す（入力のない tick は残さない）
//   ・replayState その tick まで進めた状態（再生の「その場面へ飛ぶ」に使う）
//   ・replayReview 対戦をもう一度流して、妖怪ごとの数字・HP の移り変わり・大きな出来事をまとめる
// 版がちがうと結果がずれるので、作った版（APP_VERSION）を入れておき、ちがう版では再生しない。
// ============================================================================
var APP_VERSION = __APP_VERSION__;
var REPLAY_FMT = 1;
var REPLAY_HP_EVERY = 20; // HP の移り変わりは 1 秒ごと

function replayNew(seed, teams, opts, meta) {
  return {
    f: REPLAY_FMT, ver: APP_VERSION, seed: seed >>> 0,
    teams: teams.map(t => t.map(m => ({ ...m }))),
    opts: JSON.parse(JSON.stringify(opts ?? {})),
    frames: [], end: 0, outcome: null,
    meta: { ...meta },
  };
}

function replayPush(rep, tick, inputs) {
  if (inputs.length) rep.frames.push([tick, inputs.map(x => [x.player, JSON.parse(JSON.stringify(x.input))])]);
}

function replayFinish(rep, state) {
  rep.end = state.tick;
  rep.outcome = state.outcome ? { ...state.outcome } : null;
}

// 再生できるか（版・形）。できないときは理由を返す
function replayProblem(rep) {
  if (!rep || rep.f !== REPLAY_FMT || !Array.isArray(rep.teams) || !Array.isArray(rep.frames)) return "リプレイの形がちがう";
  if (rep.ver !== APP_VERSION) return `作った版（${rep.ver}）がいまの版（${APP_VERSION}）とちがうので再生できない`;
  for (const t of rep.teams) if (Yn(t).length) return "チームの中身が読めない";
  return null;
}

function replayStart(rep) {
  return Rh(rep.seed, rep.teams[0], rep.teams[1], rep.opts);
}

// tick → その tick の入力
function replayInputs(rep) {
  const m = new Map();
  for (const [tick, list] of rep.frames) m.set(tick, list.map(([player, input]) => ({ player, input: { ...input } })));
  return m;
}

// state を 1 tick 進める（リプレイの入力で）
function replayStep(state, inputs, events) {
  Uh(state, inputs.get(state.tick) ?? [], events);
}

// その tick まで進めた状態（出来事は捨てる）
function replayState(rep, tick, inputs = replayInputs(rep)) {
  const s = replayStart(rep);
  while (s.tick < tick && !s.outcome) replayStep(s, inputs, []);
  return s;
}

function teamHpPermil(p) {
  let hp = 0, max = 0;
  for (const u of p.units) hp += Math.max(0, u.hp), max += u.maxHp;
  return max ? Math.round(hp * 1000 / max) : 0;
}

// 振り返り：対戦をもう一度流して集める（画面の演出とは関係なく、エンジンの出来事から）
function replayReview(rep) {
  const inputs = replayInputs(rep);
  const s = replayStart(rep);
  const units = [];
  for (const p of s.players) for (const u of p.units) units[u.uid] = {
    uid: u.uid, owner: u.owner, unit: ct[u.defIndex].id, name: ct[u.defIndex].name, maxHp: u.maxHp,
    dealt: 0, taken: 0, healed: 0, kos: 0, koAt: null, crit: 0, ult: 0,
    attack: 0, skill: 0, guard: 0, inspirit: 0, loaf: 0, curseTry: 0, curseHit: 0, onField: 0,
  };
  const team = [{ dealt: 0, healed: 0, kos: 0, ult: 0, crit: 0, rotate: 0, purify: 0, item: 0 }, { dealt: 0, healed: 0, kos: 0, ult: 0, crit: 0, rotate: 0, purify: 0, item: 0 }];
  const hp = [[0, teamHpPermil(s.players[0]), teamHpPermil(s.players[1])]];
  const moments = [];
  let lastHit = null; // 最後にダメージを与えた妖怪（気絶させた妖怪を数える）
  const guard = 10 * 60 * 20; // 念のため（最長でも 6 分で決着する）
  while (!s.outcome && s.tick < guard) {
    const ev = [], tick = s.tick;
    replayStep(s, inputs, ev);
    for (const p of s.players) for (let k = 0; k < 3; k++) { const u = p.units[p.wheel[k]]; if (u.hp > 0) units[u.uid].onField++; }
    for (const e of ev) {
      switch (e.t) {
        case "damage": {
          const d = units[e.dst];
          if (!d) break;
          d.taken += e.amount;
          if (e.src !== null && e.src !== void 0 && units[e.src]) {
            const a = units[e.src];
            a.dealt += e.amount, team[a.owner].dealt += e.amount;
            if (e.crit) a.crit++, team[a.owner].crit++;
            lastHit = { src: e.src, dst: e.dst };
          }
          if ((e.crit || e.amount >= 160) && units[e.src]) moments.push({ tick, kind: e.crit ? "crit" : "big", src: e.src, dst: e.dst, amount: e.amount });
          break;
        }
        case "heal":
          if (units[e.dst]) {
            const who = e.src !== null && e.src !== void 0 && units[e.src] ? units[e.src] : units[e.dst];
            who.healed += e.amount, team[who.owner].healed += e.amount;
          }
          break;
        case "ko": {
          const d = units[e.uid];
          d.koAt = tick;
          const by = lastHit && lastHit.dst === e.uid ? units[lastHit.src] : null;
          if (by && by.owner !== d.owner) by.kos++, team[by.owner].kos++;
          moments.push({ tick, kind: "ko", dst: e.uid, src: by ? by.uid : null });
          break;
        }
        case "revive": units[e.uid].koAt = null; moments.push({ tick, kind: "revive", dst: e.uid }); break;
        case "ult": {
          const a = units[e.uid];
          if (a) a.ult++, team[a.owner].ult++;
          moments.push({ tick, kind: "ult", src: e.uid, grand: !!e.grand });
          break;
        }
        case "action": {
          const a = units[e.uid];
          if (!a) break;
          if (e.action === "attack") a.attack++;
          else if (e.action === "skill") a.skill++;
          else if (e.action === "guard") a.guard++;
          else if (e.action === "loaf" || e.action === "rest" || e.action === "stunned") a.loaf++;
          else if (e.action === "curse" || e.action === "bless") a.inspirit++;
          break;
        }
        case "curse":
          if (units[e.src]) units[e.src].curseTry++, e.result === "hit" && units[e.src].curseHit++;
          break;
        case "rotate": if (e.player === 0 || e.player === 1) team[e.player].rotate++; break;
        case "purifyStart": if (e.player === 0 || e.player === 1) team[e.player].purify++; break;
        case "item": if (e.player === 0 || e.player === 1) team[e.player].item++; break;
        case "suddenDeath": moments.push({ tick, kind: "sudden" }); break;
      }
    }
    if (s.tick % REPLAY_HP_EVERY === 0 || s.outcome) hp.push([s.tick, teamHpPermil(s.players[0]), teamHpPermil(s.players[1])]);
  }
  // 大きな出来事は、奥義・撃破・会心を優先して多すぎないように
  const rank = { ko: 0, ult: 1, revive: 2, sudden: 2, crit: 3, big: 4 };
  const picked = moments.slice().sort((a, b) => rank[a.kind] - rank[b.kind] || a.tick - b.tick).slice(0, 40).sort((a, b) => a.tick - b.tick);
  return { end: s.tick, outcome: s.outcome, units, team, hp, moments: picked, final: s };
}

// 書き出し：YR1: + JSON を base64url に（ブラウザでは deflate で縮める）
function b64urlFromBytes(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function bytesFromB64url(s) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}
async function pipeBytes(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
async function replayExport(rep) {
  const json = new TextEncoder().encode(JSON.stringify(rep));
  if (typeof CompressionStream === "function") return "YR1:z" + b64urlFromBytes(await pipeBytes(json, new CompressionStream("deflate-raw")));
  return "YR1:j" + b64urlFromBytes(json);
}
async function replayImport(text) {
  const t = String(text ?? "").trim().replace(/\s+/g, "");
  if (!t.startsWith("YR1:")) throw new Error("YR1: で始まる文字列ではない");
  const kind = t[4];
  if (kind !== "z" && kind !== "j") throw new Error("形がちがう");
  if (kind === "z" && typeof DecompressionStream !== "function") throw new Error("このブラウザでは読めない");
  try {
    const body = bytesFromB64url(t.slice(5));
    const bytes = kind === "z" ? await pipeBytes(body, new DecompressionStream("deflate-raw")) : body;
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("文字列がこわれている（途中までしかコピーされていないかもしれない）");
  }
}
