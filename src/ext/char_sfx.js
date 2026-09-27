// ============================================================================
// 妖怪ごとの効果音（くせは persona.js の personaOf(def).sfx）。Web Audio でその場で鳴らす（音のファイルは要らない）。
//   声 … その妖怪の音色・高さ・ふし・ゆれで、こうげき（かけ声）・ようじゅつ（となえる）・ガード（ふんばる）・サボり（あくび）・
//         被弾（いたっ）・気絶（ひめい）・ひっさつわざ（決めのふし）・とりつき・吹き出し（しゃべる）
//   こうげき … わざの動きごとの風切り音（斬るはシャキン、のしかかりはドスン…）と、当たった音の重さ
// qe(高さ, 長さ, 音色, 強さ, 遅れ, 終わりの高さ)・Tt(長さ, 強さ, フィルター, 高さ, 遅れ, Q, 終わりの高さ) は game.js の音の道具。
// ============================================================================

function charNote(p, n) { return p.pitch * Math.pow(2, n / 12); }
// 声の 1 音（ゆれ：flat・up・down・vibrato）
function charTone(p, f, dur, gain, delay) {
  const end = p.glide === "up" ? f * 1.22 : p.glide === "down" ? f * 0.78 : void 0;
  qe(f, dur, p.wave, gain, delay, end);
  if (p.glide === "vibrato") qe(f * 1.018, dur, p.wave, gain * 0.5, delay + 0.012, f * 0.985);
  qe(f * 2, dur * 0.7, "sine", gain * 0.3, delay); // 声の明るさ
}
// 声のざらつき（0 なし・1 息・2 うなり・3 舌打ち）
function charGrit(p, dur, delay) {
  if (p.grit === 1) Tt(dur, 0.12, "highpass", 3800, delay, 0.7);
  else if (p.grit === 2) Tt(dur, 0.16, "lowpass", 420, delay, 1.2);
  else if (p.grit === 3) Tt(0.03, 0.2, "bandpass", 2600, delay, 5);
}

function charVoice(def, kind, delay = 0) {
  if (!$e || !Ha || !def) return;
  const p = personaOf(def).sfx, m = p.motif, loud = p.wave === "square" || p.wave === "sawtooth" ? 0.055 : 0.1;
  const N = n => charNote(p, n);
  switch (kind) {
    case "attack": // かけ声（2 音）
      charTone(p, N(m[0]), 0.07, loud, delay), charTone(p, N(m[1]), 0.1, loud, delay + 0.07), charGrit(p, 0.1, delay);
      break;
    case "skill": // となえる（ふしを 1 回）
      m.forEach((n, i) => charTone(p, N(n), 0.09, loud * 0.9, delay + i * 0.08)), charGrit(p, 0.2, delay);
      break;
    case "guard": // ふんばる
      charTone(p, N(m[0] - 5), 0.12, loud, delay), Tt(0.06, 0.18, "lowpass", 600, delay, 1);
      break;
    case "loaf": // あくび（ゆっくり下がる）
      qe(N(m[1]), 0.55, p.wave, loud * 0.8, delay, N(m[0] - 7)), charGrit(p, 0.4, delay + 0.1);
      break;
    case "hurt": // いたっ
      qe(N(Math.max(...m) + 5), 0.14, p.wave, loud, delay, N(m[0])), charGrit(p, 0.08, delay);
      break;
    case "ko": // ひめい（ふしを逆に、下へ）
      [...m].reverse().forEach((n, i) => charTone(p, N(n - 2 * i), 0.14, loud, delay + i * 0.13));
      qe(N(m[0] - 3), 0.6, p.wave, loud * 0.8, delay + 0.4, N(m[0] - 19));
      break;
    case "ult": // 決めのふし（ふし＋1 オクターブ上）
      [...m, m[0] + 12].forEach((n, i) => charTone(p, N(n), i === 3 ? 0.3 : 0.08, loud * 1.2, delay + i * 0.075)), charGrit(p, 0.3, delay);
      break;
    case "bless": // やさしく上がる
      m.forEach((n, i) => charTone(p, N(n + 12), 0.12, loud * 0.6, delay + i * 0.06));
      break;
    case "curse": // ふしを半音さげて、下がる
      [...m].reverse().forEach((n, i) => charTone(p, N(n - 1), 0.12, loud * 0.8, delay + i * 0.07)), charGrit(p, 0.25, delay);
      break;
    case "enter": // 前に出たときの ひと声
      qe(N(m[0]), 0.12, p.wave, loud * 0.7, delay, N(m[1])), qe(N(m[1]) * 2, 0.08, "sine", loud * 0.25, delay + 0.05);
      break;
  }
}

// 吹き出し（しゃべる）：その妖怪のふしで音節ぶん鳴らす（相手側は少し低く）
function charTalk(def, syll, foe) {
  if (!$e || !Ha || !def) return;
  const p = personaOf(def).sfx, m = p.motif, n = Math.max(2, Math.min(6, syll));
  const loud = p.wave === "square" || p.wave === "sawtooth" ? 0.05 : 0.08;
  for (let i = 0; i < n; i++) {
    const f = charNote(p, m[i % 3] + (i % 2 ? 2 : 0)) * (foe ? 0.94 : 1);
    qe(f, 0.07, p.wave, loud, i * 0.075, f * (p.glide === "down" ? 0.9 : 1.08)), qe(f * 2, 0.06, "triangle", loud * 0.5, i * 0.075);
  }
}

// こうげき：かけ声と、わざの動きの風切り音（power 0〜1 で大きさ）
function charAttackSfx(def, power = 0.6) {
  if (!$e || !Ha || !def) return;
  const p = personaOf(def).sfx, [ft, f0, f1, dur, g, metal] = p.swish;
  charVoice(def, "attack");
  Tt(dur, g * (0.7 + power * 0.5), ft, f0, 0.12, 1.2, f1);
  if (metal) qe(metal, 0.18, "triangle", 0.12, 0.14, metal * 1.1), qe(metal * 1.5, 0.12, "sine", 0.06, 0.16);
}

// 当たった音：わざの動きと体の重さで変える
function charImpactSfx(def, crit) {
  if (!$e || !Ha || !def) return;
  const s = personaOf(def), p = s.sfx, a = s.motion.attack, w = p.thud;
  const heavy = ["bodyslam", "overhead", "tackle", "headbutt"].includes(a), sharp = ["blade", "thrust", "claw", "shoot"].includes(a);
  qe((heavy ? 90 : 150) * w, heavy ? 0.26 : 0.14, "sine", heavy ? 0.6 : 0.45, 0, (heavy ? 40 : 60) * w);
  Tt(sharp ? 0.06 : 0.09, sharp ? 0.35 : 0.45, sharp ? "highpass" : "bandpass", sharp ? 3000 : 1400 / w, 0, 1.4, sharp ? 1500 : 500);
  if (a === "bite") Tt(0.03, 0.4, "bandpass", 2200, 0.05, 6);
  if (a === "slap") Tt(0.05, 0.45, "highpass", 2600, 0, 0.8);
  if (crit) qe(p.pitch * 4, 0.12, "triangle", 0.08, 0.02, p.pitch * 6);
}

// ダメージの出来事：こうげきなら当てた妖怪の当たった音、受けた妖怪は「いたっ」（多段で鳴りすぎないよう 0.3 秒に 1 回）
var HURT_LAST = new Map();
function damageSfx(g, t) {
  if (t.src != null && t.src !== t.dst && t.source === "attack") charImpactSfx(Ze(Ot(g, t.src)), t.crit);
  if (!(t.amount > 0) || !["attack", "skill", "ult"].includes(t.source)) return;
  const now = wd();
  if (now - (HURT_LAST.get(t.dst) ?? -1) < 0.3) return;
  HURT_LAST.set(t.dst, now);
  charVoice(Ze(Ot(g, t.dst)), "hurt", 0.04);
}
