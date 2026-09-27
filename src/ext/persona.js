// ============================================================================
// 妖怪 1 体ずつの「くせ」：効果音（声・こうげきの音・当たった音）と、ふだんのモーションのくせ。
//   ・声：音色 4 種 × 高さ（半音ずつ）× ふし 12 種 × 声のゆれ 4 種。こうげき・ようじゅつ・ガード・サボり・被弾・気絶・
//     ひっさつわざ・とりつき・しゃべる（吹き出し）で、その妖怪の声が鳴る（char_sfx.js）
//   ・こうげきの音：わざの動き（パンチ・斬る・かみつく…17 種）ごとの風切り音と、当たった音の重さ（体の大きさ・種族）
//   ・モーション：こうげきの ため 8 種 × しめ 8 種 × 待機のゆれ 8 種 × 待機の速さ 4 段 × ガードの構え 4 種
// どれも妖怪ごとにちがう組み合わせにする（同じになりそうなら、図鑑 No の順に ずらして空いている組み合わせを使う）。
// 3D モデルのちがいは models3d.js の modelLooks()。対戦の計算には使わない（見た目と音だけ）。
// ============================================================================

// わざの名前 → こうげきの動き（本家のこうげき 47 種）
var ATK_MOTION = [
  [/ロケットパンチ/, "rocket"], [/しゅりけん|スプレー|しゃげき|大砲|弓矢/, "shoot"],
  [/つばめがえし|閃光ぎり|きりつける/, "blade"], [/するどいつめ/, "claw"],
  [/くらいつく|かみちぎる|かみつく/, "bite"], [/舌でなめる/, "lick"], [/しっぽうち/, "tail"],
  [/あびせげり|地獄げり|けり/, "kick"], [/ずつき|ヘッドバット/, "headbutt"], [/タックル/, "tackle"],
  [/のしかかる|おしつぶす/, "bodyslam"], [/ドクロ割り|脳天かちわり|骨くだき|こなごなつぶし|地球わり/, "overhead"],
  [/フルスイング/, "swing"], [/めったうち|うちまくり|みだれづき|つっぱり|ワンツーパンチ/, "combo"],
  [/きゅうしょづき|疾風づき|風穴あけ/, "thrust"], [/はたく|はりたおす|たたく|ぶったたく/, "slap"],
  [/パンチ|正拳突き|あてみ|ぶんなぐる|こづく/, "punch"],
];
var ATK_MOTION_JA = { rocket: "ロケットパンチ", shoot: "飛び道具", blade: "斬る", claw: "ひっかく", bite: "かみつく", lick: "なめる", tail: "しっぽ",
  kick: "けり", headbutt: "ずつき", tackle: "体当たり", bodyslam: "のしかかり", overhead: "ふりおろし", swing: "ふりまわし", combo: "連打",
  thrust: "突き", slap: "はたく", punch: "パンチ" };
function attackMotionOf(def) {
  const n = def?.attackName ?? "";
  for (const [re, m] of ATK_MOTION) if (re.test(n)) return m;
  return "punch";
}
// サボりかた（本家の「なまけている」：寝る・あくび・よそ見・おどる）
var LOAF_STYLES = ["sleep", "yawn", "away", "dance"];
function loafStyleOf(def) { return LOAF_STYLES[hash32("loaf:" + (def?.name ?? "")) % LOAF_STYLES.length]; }

// ---- モーションのくせ ----
var PS_WINDUPS = ["lean", "spin", "wobble", "crouch", "rise", "zigzag", "stretch", "shiver"];
var PS_WINDUP_JA = { lean: "前のめり", spin: "くるっと回る", wobble: "ゆらゆら", crouch: "かがむ", rise: "浮き上がる", zigzag: "ジグザグ", stretch: "のびあがる", shiver: "ふるえる" };
var PS_FINISHES = ["hop", "twirl", "bow", "backflip", "sway", "pose", "skip", "shake"];
var PS_FINISH_JA = { hop: "ぴょんと跳ぶ", twirl: "くるりと回る", bow: "おじぎ", backflip: "宙返り", sway: "ゆれる", pose: "ばんざい", skip: "スキップ", shake: "身ぶるい" };
var PS_IDLES = ["bob", "sway", "bounce", "hover", "breathe", "rock", "twitch", "circle"];
var PS_IDLE_JA = { bob: "上下にゆれる", sway: "左右にゆれる", bounce: "はずむ", hover: "ふわふわ浮く", breathe: "深呼吸", rock: "前後にゆれる", twitch: "ぴくっと動く", circle: "ぐるりとゆれる" };
var PS_GUARDS = ["crouch", "brace", "turn", "puff"];
var PS_SPEEDS = [0.8, 1, 1.25, 1.55];
// 待機のゆれの第一候補：浮いている姿の妖怪（霊・火の玉・鳥・天女など）は ふわふわ、ほかは本家の動きの癖（honke_roster.js の motion）から
var PS_FLOATY = /霊|ゆうれい|ウィスパー|えんら|火|ほむら|魂|ひとだま|鳥|ドリ|カラス|コウモリ|蝶|天使|キュン|ふわ|フワ|雲|くも$|風|カゼ|ゴースト|おばけ|影|カゲ|ネガ|ブーン|ドンヨリ|鏡|天女|羽/;
var PS_IDLE_OF_MOTION = { float: "sway", wave: "circle", glow: "breathe", flicker: "twitch", hop: "bounce", dash: "bob", slash: "rock", pounce: "bob",
  charge: "breathe", smash: "breathe", slam: "rock", rattle: "twitch", sway: "sway", stretch: "sway", spin: "circle" };
function idleFirst(def, z) {
  if (PS_FLOATY.test(def.name) || ((z.motion === "float" || z.motion === "glow") && ["ayashi", "miyabi", "tatari"].includes(def.tribe))) return "hover";
  return PS_IDLE_OF_MOTION[z.motion] ?? "bob";
}

// ---- 声 ----
var SFX_WAVES = ["sine", "triangle", "square", "sawtooth"];
var SFX_WAVE_JA = { sine: "まるい声", triangle: "やわらかい声", square: "ピコピコ声", sawtooth: "ざらざら声" };
// ふし（半音）。1 つめが声の高さ
var SFX_MOTIFS = [[0, 4, 7], [0, 7, 12], [0, 3, 7], [0, -5, -12], [0, 5, 9], [0, 2, 4], [0, 12, 7], [0, -3, 4], [0, 7, 5], [0, 4, -1], [0, 9, 14], [0, -2, 5]];
var SFX_GLIDES = ["flat", "up", "down", "vibrato"];
// こうげきの動きごとの風切り音：[フィルター, 高さの始め, 終わり, 長さ, 強さ, 金属音（0 はなし）]
var SFX_SWISH = {
  punch: ["bandpass", 1600, 500, 0.12, 0.45, 0], combo: ["bandpass", 2200, 900, 0.07, 0.35, 0], slap: ["highpass", 2400, 1200, 0.08, 0.5, 0],
  claw: ["highpass", 4200, 1800, 0.14, 0.4, 0], bite: ["bandpass", 900, 300, 0.07, 0.55, 0], lick: ["lowpass", 700, 1600, 0.2, 0.35, 0],
  tail: ["bandpass", 1200, 300, 0.22, 0.45, 0], kick: ["bandpass", 1800, 400, 0.16, 0.5, 0], headbutt: ["lowpass", 500, 150, 0.14, 0.55, 0],
  tackle: ["lowpass", 900, 200, 0.3, 0.5, 0], bodyslam: ["lowpass", 400, 90, 0.35, 0.6, 0], overhead: ["bandpass", 1400, 250, 0.26, 0.5, 0],
  swing: ["bandpass", 700, 2400, 0.3, 0.45, 0], thrust: ["highpass", 3000, 1500, 0.1, 0.45, 2400], blade: ["highpass", 5200, 2600, 0.18, 0.4, 3200],
  rocket: ["lowpass", 300, 2400, 0.4, 0.45, 0], shoot: ["bandpass", 2600, 800, 0.1, 0.4, 1800],
};
// 当たった音の重さ（体つき・種族）。低いほど重い
var SFX_TRIBE_THUD = { takeru: 1, ayashi: 1.2, tsuwamono: 0.75, kage: 1.25, nagomi: 1.1, miyabi: 1.3, tatari: 0.9, shizume: 1, maga: 0.8 };

var PERSONA = null;
function personaAll() {
  if (PERSONA) return PERSONA;
  PERSONA = new Map();
  const usedMove = new Set(), usedVoice = new Set();
  const defs = [...ct].sort((a, b) => (a.no ?? 0) - (b.no ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const W = PS_WINDUPS.length, F = PS_FINISHES.length, S = PS_SPEEDS.length, G = PS_GUARDS.length, I = PS_IDLES.length;
  for (const def of defs) {
    const z = zi[def.id] ?? {}, h = hash32("ps:" + def.id), hv = hash32("pv:" + def.id);
    const atk = attackMotionOf(def);
    // モーション：待機のゆれは本家の動きの癖から選び、ため × しめ × 速さ × ガードを空いているところまでずらす（足りなければゆれも）
    const idle0 = PS_IDLES.indexOf(idleFirst(def, z));
    const N = W * F * S * G;
    let mv = null;
    for (let ii = 0; ii < I && !mv; ii++) {
      const idle = (idle0 + ii) % I;
      let idx = h % N;
      for (let t = 0; t < N; t++, idx = (idx + 131) % N) {
        const wi = idx % W, fi = Math.floor(idx / W) % F, si = Math.floor(idx / (W * F)) % S, gi = Math.floor(idx / (W * F * S));
        const key = [atk, wi, fi, idle, si].join("|");
        if (!usedMove.has(key)) { usedMove.add(key); mv = { wi, fi, si, gi, idle }; break; }
      }
    }
    // 声：高さは本家の妖怪ごとの声の高さ（zi.pitch）を半音にそろえて、音色 × ふし × ゆれ を空いているところまでずらす
    const semi = Math.round(12 * Math.log2((z.pitch ?? 300) / 110));
    const V = SFX_WAVES.length * SFX_MOTIFS.length * SFX_GLIDES.length;
    let vo = null;
    for (let dp = 0; dp < 48 && !vo; dp++) {
      const s = semi + (dp % 2 ? -1 : 1) * Math.ceil(dp / 2);
      let idx = hv % V;
      for (let t = 0; t < V; t++, idx = (idx + 37) % V) {
        const w = idx % SFX_WAVES.length, m = Math.floor(idx / SFX_WAVES.length) % SFX_MOTIFS.length, g = Math.floor(idx / (SFX_WAVES.length * SFX_MOTIFS.length));
        const key = [s, w, m, g].join("|");
        if (!usedVoice.has(key)) { usedVoice.add(key); vo = { s, w, m, g }; break; }
      }
    }
    const size = z.form ?? 1;
    PERSONA.set(def.id, {
      motion: {
        attack: atk, windup: PS_WINDUPS[mv.wi], finish: PS_FINISHES[mv.fi], idle: PS_IDLES[mv.idle], speed: PS_SPEEDS[mv.si], guard: PS_GUARDS[mv.gi],
        amp: 0.8 + (h >> 20) % 5 * 0.1, side: (h >> 27) & 1 ? 1 : -1,
      },
      sfx: {
        pitch: 110 * Math.pow(2, vo.s / 12), semi: vo.s, wave: SFX_WAVES[vo.w], motif: SFX_MOTIFS[vo.m], glide: SFX_GLIDES[vo.g],
        swish: SFX_SWISH[atk] ?? SFX_SWISH.punch, thud: (SFX_TRIBE_THUD[def.tribe] ?? 1) * [1.25, 1, 0.8][size], grit: (hv >> 24) % 4,
      },
    });
  }
  return PERSONA;
}
var PERSONA_FALLBACK = {
  motion: { attack: "punch", windup: "lean", finish: "hop", idle: "bob", speed: 1, guard: "crouch", amp: 1, side: 1 },
  sfx: { pitch: 262, semi: 15, wave: "triangle", motif: SFX_MOTIFS[0], glide: "flat", swish: SFX_SWISH.punch, thud: 1, grit: 0 },
};
function personaOf(def) { return (def && personaAll().get(def.id)) ?? PERSONA_FALLBACK; }
// 編成画面に出す一言
function personaText(def) {
  const p = personaOf(def), m = p.motion, s = p.sfx;
  return `${SFX_WAVE_JA[s.wave]}・待機は${PS_IDLE_JA[m.idle]}・こうげきは${PS_WINDUP_JA[m.windup]}→${ATK_MOTION_JA[m.attack]}→${PS_FINISH_JA[m.finish]}`;
}
