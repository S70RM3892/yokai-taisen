// ============================================================================
// ひっさつわざの台本（全員ぶん）。3D の振り付け（ult_motion.js）とカットイン（L2）の両方がここを見る。
//   ・振り付け 16 種：ひっさつわざの名前の言葉（雷・竜巻・肉球・斬…）と種類（単体・全体・回復）で選ぶ
//   ・ため（出だし）8 種・きめ（しめ）8 種・属性の当たり方・連撃の回数・跳ぶ高さ・回転・左右
//   ・カットイン：入り方 8 種・帯の形 7 種・文字の出し方 6 種・背景の模様（属性）・色・傾き・大きな一文字
// 「振り付け＋ため＋きめ＋揺らぎ」と「入り方＋帯＋文字＋模様」は、どちらも妖怪ごとにちがう組み合わせにする
// （同じになりそうなら、その妖怪の番号の順に ずらして空いている組み合わせを使う）。
// 対戦の計算には使わない（見た目だけ）。Node のテストで全員ちがうことを確かめる。
// ============================================================================

var ULT_STYLES = ["meteor", "rush", "drill", "beam", "rain", "quake", "tornado", "phantom", "bloom", "stretch",
  "barrage", "pillar", "thunder", "orbit", "summon", "clone"];
var ULT_STYLE_JA = { meteor: "跳び叩きつけ", rush: "連撃", drill: "回転突き", beam: "光線", rain: "天降らし", quake: "地鳴らし", tornado: "竜巻",
  phantom: "瞬影斬", bloom: "祝福の光", stretch: "しなり打ち", barrage: "連射", pillar: "火柱", thunder: "落雷", orbit: "旋回撃",
  summon: "巨大化", clone: "分身" };
// 全体わざでも使える振り付け（相手の前衛みんなに当てる形があるもの）
var ULT_ALL_OK = new Set(["beam", "rain", "quake", "tornado", "phantom", "barrage", "pillar", "thunder", "summon", "clone", "rush", "orbit"]);
var ULT_SUPPORT = ["heal", "blessAll", "selfBless", "purifyAll", "revive", "dispel"];

// ひっさつわざの名前の言葉 → 振り付け（上から順に見る）
var ULT_WORDS = [
  [/雷|いかずち|イカズチ|サンダー|稲妻|いなずま|電|ボルト|ライトニング|ビリビリ|びりびり|ゴロゴロ/, "thunder"],
  [/竜巻|たつまき|トルネード|嵐|旋風|ハリケーン|つむじ|サイクロン|ハリケン/, "tornado"],
  [/分身|ぶんしん|残像|クローン|ぞろぞろ|ゾロゾロ|増殖|群れ|百鬼/, "clone"],
  [/隕石|いん石|メテオ|流星|星|スター|降り|ふりそそ|天から|雨/, "rain"],
  [/ビーム|光線|レーザー|砲|キャノン|波動|バスター|はどう|光/, "beam"],
  [/炎|火|ファイア|フレイム|噴火|爆|マグマ|地獄|業火|れんごく|煉獄|燃|もえ|メラ/, "pillar"],
  [/地震|じしん|大地|岩|ロック|どすこい|ドスコイ|四股|しこ|ゆらし|地割れ|山|土俵/, "quake"],
  [/弾|ショット|ミサイル|バズーカ|ガトリング|シュート|投げ|爆弾|ボム|乱射|吹雪|ふぶき|つぶて|シャワー|発射|マシンガン/, "barrage"],
  [/肉球|百裂|ひゃくれつ|連打|ラッシュ|乱打|千|パンチ|拳|ボコ|ボッコ|ビンタ|はたき|たたき|突き|つっぱり/, "rush"],
  [/斬|ぎり|切り|きり|刀|剣|太刀|一閃|居合|影|忍|闇|ヤミ|やみ|シャドー|ダーク|幽|まぼろし/, "phantom"],
  [/ダンス|踊|おどり|舞|輪|リング|サークル|まわり|めぐり|フィーバー|ワルツ/, "orbit"],
  [/回転|スピン|ドリル|まわ|ぐるぐる|ころころ|コロコロ|ローリング|ころがり|大車輪/, "drill"],
  [/巨大|ビッグ|ジャイアント|大仏|でか|デカ|のしかか|ボディ|プレス|ドーン|押し|つぶし|ぺしゃんこ|化け/, "summon"],
  [/飛び|ジャンプ|ダイブ|落とし|踏み|ふみ|キック|かかと|蹴|とび|ダイナミック/, "meteor"],
  [/のび|伸|しなり|ムチ|むち|ぐにゃ|ベロ|舌|首|ながい|なが〜/, "stretch"],
];

// 属性の当たり方（色と弾け方）
var ULT_FX = ["fire", "water", "thunder", "earth", "ice", "wind", "dark", "light", "petal", "star"];
var ULT_WINDUPS = ["crouch", "roar", "spinup", "glint", "aura", "rise", "tremble", "flash"];
var ULT_WINDUP_JA = { crouch: "しゃがんで ため", roar: "ほえる", spinup: "回って ため", glint: "目が光る", aura: "オーラがのぼる", rise: "浮き上がる", tremble: "ふるえて ため", flash: "閃光" };
var ULT_FINISHES = ["pose", "flip", "twirl", "bow", "stomp", "glow", "hop", "vanish"];
var ULT_FINISH_JA = { pose: "きめポーズ", flip: "宙返り", twirl: "くるりと回る", bow: "一礼", stomp: "踏みしめる", glow: "光る", hop: "跳ねる", vanish: "消えて戻る" };
// カットイン
var CUT_ENTRIES = ["slide", "drop", "rise", "zoom", "spin", "flash", "zigzag", "shutter"];
var CUT_BANDS = ["diag", "rdiag", "flat", "twin", "iris", "shard", "wave"];
var CUT_TEXTS = ["spread", "slam", "type", "drop", "glitch", "slide"];
var CUT_PATTERNS = { fire: "flame", water: "ripple", thunder: "zigzag", earth: "crack", ice: "crystal", wind: "swirl", dark: "smoke", light: "rays", petal: "dots", star: "stars" };
var ULT_PALETTE = {
  fire: ["#c8321e", "#f2a541"], water: ["#1f5fa8", "#5fd0e9"], thunder: ["#b88a00", "#fff07a"], earth: ["#7a4a22", "#d9a45f"],
  ice: ["#3d8fc0", "#e3f8ff"], wind: ["#1f8a5b", "#b7f0a0"], dark: ["#3a1a60", "#b07ce0"], light: ["#c89b2a", "#fff6c8"],
  petal: ["#c0487a", "#ffc2dc"], star: ["#3a3aa8", "#ffe27a"],
};
var ULT_ELEM_KANJI = { fire: "炎", water: "水", thunder: "雷", earth: "土", ice: "氷", wind: "風", dark: "闇", light: "光", petal: "花", star: "星" };
// 族ごとの当たり方（属性のないわざ）
var ULT_TRIBE_FX = { takeru: "fire", ayashi: "dark", tsuwamono: "earth", kage: "petal", nagomi: "light", miyabi: "wind", tatari: "dark", shizume: "water", maga: "dark" };

function ultFxOf(def) {
  const u = def.ult ?? {}, n = def.ultName ?? "";
  if (u.element) return u.element;
  if (/雷|サンダー|稲妻|電/.test(n)) return "thunder";
  if (/炎|火|ファイア|フレイム|燃|メラ|爆|紅蓮|ぐれん|れんごく|煉獄|マグマ/.test(n)) return "fire";
  if (/水|アクア|滝|波|うず|渦|雨|しずく/.test(n)) return "water";
  if (/氷|吹雪|ふぶき|アイス|こおり|冷|雪/.test(n)) return "ice";
  if (/風|嵐|竜巻|トルネード|つむじ/.test(n)) return "wind";
  if (/岩|土|大地|地震|山|ロック/.test(n)) return "earth";
  if (/闇|ヤミ|影|シャドー|ダーク|呪|のろ|地獄|黄泉/.test(n)) return "dark";
  if (/光|聖|天|神|ゴールド|ひかり|キラ/.test(n)) return "light";
  if (/花|ハート|ラブ|桜|さくら|恋|キュン|モテ/.test(n)) return "petal";
  if (/星|スター|流星|メテオ|宇宙|ムーン|月/.test(n)) return "star";
  if (ULT_SUPPORT.includes(u.kind)) return "light";
  return ULT_TRIBE_FX[def.tribe] ?? ULT_FX[hash32("ultfx:" + def.id) % ULT_FX.length];
}

// 振り付け：名前の言葉 → 種類 → 動きの癖
function ultBaseStyle(def) {
  const u = def.ult ?? {}, n = def.ultName ?? "", m = zi[def.id]?.motion ?? "dash", h = hash32("ult:" + def.id);
  if (ULT_SUPPORT.includes(u.kind)) return "bloom";
  const all = u.kind === "all" || u.kind === "curseAll";
  for (const [re, st] of ULT_WORDS) if (re.test(n) && (!all || ULT_ALL_OK.has(st))) return st;
  if (u.kind === "curseAll") return ["phantom", "tornado", "clone"][h % 3];
  if (m === "stretch") return all ? "barrage" : "stretch";
  if (all) {
    if (u.element === "earth" || m === "slam" || m === "smash") return h % 3 ? "quake" : "summon";
    if (u.element === "wind" || m === "spin") return "tornado";
    if (u.element === "thunder") return "thunder";
    if (u.element === "fire") return "pillar";
    if (m === "glow" || m === "float") return ["beam", "rain", "barrage"][h % 3];
    return ["rain", "barrage", "pillar", "clone"][h % 4];
  }
  if (m === "slam" || m === "smash") return ["meteor", "summon", "quake", "meteor"][h % 4];
  if (m === "hop") return h % 3 ? "meteor" : "orbit";
  if (m === "sway" || m === "rattle") return ["stretch", "summon", "stretch", "phantom"][h % 4];
  if (m === "spin" || m === "charge") return ["drill", "rush", "orbit"][h % 3];
  if (m === "glow" || m === "float" || m === "wave") return ["beam", "beam", "phantom", "barrage"][h % 4];
  if (m === "flicker" || m === "rattle") return ["phantom", "clone", "beam"][h % 3];
  return ["rush", "rush", "drill", "clone", "orbit"][h % 5];
}

var ULT_SCRIPTS = null;
function ultScripts() {
  if (ULT_SCRIPTS) return ULT_SCRIPTS;
  ULT_SCRIPTS = new Map();
  const usedMove = new Set(), usedCut = new Set();
  const defs = [...ct].sort((a, b) => (a.no ?? 0) - (b.no ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // 揺らぎ：連撃 3〜5 回 × 高さ 5 段 × 回転 1〜2 × 左右
  const VARS = 3 * 5 * 2 * 2;
  for (const def of defs) {
    const style = ultBaseStyle(def), fx = ultFxOf(def), h = hash32("ults:" + def.id), h2 = hash32("ultc:" + def.id);
    // 振り付けの組み合わせ（ため × きめ × 揺らぎ）を、空いているところまでずらす
    const W = ULT_WINDUPS.length, F = ULT_FINISHES.length, N = W * F * VARS;
    let idx = h % N, move = null;
    for (let t = 0; t < N; t++, idx = (idx + 97) % N) {
      const wi = idx % W, fi = Math.floor(idx / W) % F, vi = Math.floor(idx / (W * F));
      const key = [style, fx, wi, fi, vi].join("|");
      if (!usedMove.has(key)) { usedMove.add(key); move = { wi, fi, vi }; break; }
    }
    const vi = move.vi, v = { hits: 3 + vi % 3, height: 2.6 + Math.floor(vi / 3) % 5 * 0.35, spins: 1 + Math.floor(vi / 15) % 2, side: Math.floor(vi / 30) % 2 ? 1 : -1 };
    // カットインの組み合わせ（入り方 × 帯 × 文字）。模様は当たり方で決まる
    const E = CUT_ENTRIES.length, B = CUT_BANDS.length, X = CUT_TEXTS.length, M = E * B * X;
    let cidx = h2 % M, cut = null;
    for (let t = 0; t < M; t++, cidx = (cidx + 53) % M) {
      const ei = cidx % E, bi = Math.floor(cidx / E) % B, ti = Math.floor(cidx / (E * B));
      const key = [fx, ei, bi, ti].join("|");
      if (!usedCut.has(key)) { usedCut.add(key); cut = { ei, bi, ti }; break; }
    }
    const name = def.ultName ?? "";
    const glyph = (name.match(/[一-鿿]/) ?? [])[0] ?? ULT_ELEM_KANJI[fx];
    ULT_SCRIPTS.set(def.id, {
      style, fx, v, windup: ULT_WINDUPS[move.wi], finish: ULT_FINISHES[move.fi],
      cut: {
        entry: CUT_ENTRIES[cut.ei], band: CUT_BANDS[cut.bi], text: CUT_TEXTS[cut.ti], pattern: CUT_PATTERNS[fx],
        colors: ULT_PALETTE[fx], hue: (h2 >> 8) % 41 - 20, tilt: (h2 >> 14) % 17 - 8, zoom: 0.9 + (h2 >> 20) % 5 * 0.06,
        lineAngle: [0, 20, -20, 45, -45, 90][(h2 >> 24) % 6], glyph,
      },
    });
  }
  return ULT_SCRIPTS;
}
function ultScript(def) {
  return ultScripts().get(def.id) ?? { style: "rush", fx: "light", v: { hits: 3, height: 2.6, spins: 1, side: 1 }, windup: "crouch", finish: "pose",
    cut: { entry: "slide", band: "diag", text: "spread", pattern: "rays", colors: ULT_PALETTE.light, hue: 0, tilt: 0, zoom: 1, lineAngle: 0, glyph: "光" } };
}
function ultStyleOf(def) { return ultScript(def).style; }
function ultVariant(def) { return ultScript(def).v; }
// 振り付けで何発当てるか（エンジンに段数がない妖怪のとき）
function ultMotionHits(def) {
  const s = ultScript(def), all = ["all", "curseAll"].includes(def.ult?.kind);
  if (s.style === "rush" || s.style === "orbit") return s.v.hits;
  if (s.style === "barrage") return all ? 1 : s.v.hits + 1;
  if (s.style === "stretch") return 2;
  if ((s.style === "phantom" || s.style === "clone") && !all) return 3;
  return 1;
}
