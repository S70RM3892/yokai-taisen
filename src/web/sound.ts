// 効果音は Web Audio でその場で合成する（音声ファイルを使わないので権利の問題がない。PLAN.md §9.3）。
// BGM はプレイヤーが手元のファイルを選んで流す（NCS の曲をゲームに組み込むにはライセンスが要る）。

type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxGain: GainNode | null = null;
let bgmEl: HTMLAudioElement | null = null;
let muted = false;

/** ブラウザは、画面を一度触るまで音を鳴らせない。最初のクリックで呼ぶ */
export function unlockAudio(): void {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  master.connect(ctx.destination);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.5;
  sfxGain.connect(master);
}

export function setMuted(m: boolean): void {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.02);
  if (bgmEl) bgmEl.muted = m;
}

export function isMuted(): boolean {
  return muted;
}

// ---- BGM（手元のファイル） ----

export function playBgmFile(file: File): string {
  stopBgm();
  const url = URL.createObjectURL(file);
  bgmEl = new Audio(url);
  bgmEl.loop = true;
  bgmEl.volume = 0.35;
  bgmEl.muted = muted;
  void bgmEl.play().catch(() => undefined);
  return file.name;
}

export function stopBgm(): void {
  if (!bgmEl) return;
  bgmEl.pause();
  URL.revokeObjectURL(bgmEl.src);
  bgmEl = null;
}

export function setBgmVolume(v: number): void {
  if (bgmEl) bgmEl.volume = v;
}

// ---- 合成の部品 ----

function now(): number {
  return ctx ? ctx.currentTime : 0;
}

function tone(freq: number, dur: number, wave: Wave, vol: number, when = 0, slideTo?: number): void {
  if (!ctx || !sfxGain) return;
  const t = now() + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = wave;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxGain);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, when = 0, q = 1, sweepTo?: number): void {
  if (!ctx || !sfxGain) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = now() + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxGain);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

// ---- 効果音 ----

/** 通常攻撃。重さ（0〜1）で音の太さを変える */
export function sfxAttack(weight: number): void {
  noise(0.09, 0.5, "bandpass", 2400 - weight * 1200, 0, 1.2, 600);
  tone(160 - weight * 70, 0.16 + weight * 0.08, "sine", 0.6, 0.01, 50);
}

export function sfxCrit(): void {
  noise(0.16, 0.6, "highpass", 1800, 0, 0.8);
  tone(220, 0.25, "square", 0.25, 0, 60);
  tone(1320, 0.18, "triangle", 0.2, 0.03, 1760);
}

/** 術。属性ごとに音色を変える */
export function sfxSkill(element: string): void {
  switch (element) {
    case "fire":
      noise(0.35, 0.45, "lowpass", 600, 0, 0.7, 3200);
      tone(110, 0.3, "sawtooth", 0.12, 0, 220);
      break;
    case "water":
      for (let i = 0; i < 4; i++) tone(500 + i * 170, 0.08, "sine", 0.25, i * 0.05, 900 + i * 200);
      noise(0.3, 0.2, "bandpass", 900, 0.05, 2);
      break;
    case "thunder":
      noise(0.05, 0.6, "highpass", 3000, 0);
      tone(1400, 0.2, "sawtooth", 0.2, 0.02, 90);
      noise(0.25, 0.35, "lowpass", 400, 0.06);
      break;
    case "earth":
      tone(70, 0.35, "sine", 0.7, 0, 40);
      noise(0.3, 0.35, "lowpass", 300, 0);
      break;
    case "ice":
      for (const [i, f] of [1568, 2093, 2637].entries()) tone(f, 0.25, "triangle", 0.18, i * 0.04);
      noise(0.15, 0.15, "highpass", 5000, 0);
      break;
    default: // wind
      noise(0.45, 0.35, "bandpass", 500, 0, 3, 3000);
      break;
  }
}

export function sfxGuard(): void {
  tone(880, 0.12, "square", 0.12);
  tone(1320, 0.18, "triangle", 0.15, 0.02);
}

export function sfxGuardedHit(): void {
  tone(700, 0.08, "square", 0.15);
  noise(0.06, 0.25, "bandpass", 3000, 0, 4);
}

export function sfxHeal(): void {
  tone(660, 0.18, "sine", 0.18);
  tone(990, 0.22, "sine", 0.16, 0.08);
}

export function sfxCurse(): void {
  tone(200, 0.4, "sawtooth", 0.12, 0, 140);
  tone(212, 0.4, "sawtooth", 0.12, 0, 150);
}

export function sfxBless(): void {
  tone(784, 0.2, "triangle", 0.18);
  tone(1047, 0.25, "triangle", 0.16, 0.07);
  tone(1319, 0.3, "triangle", 0.14, 0.14);
}

export function sfxLoaf(): void {
  tone(400, 0.35, "sine", 0.15, 0, 180);
}

export function sfxRotate(): void {
  noise(0.05, 0.3, "bandpass", 1500, 0, 3);
  tone(300, 0.06, "square", 0.08, 0.02);
}

export function sfxStance(enemy: boolean): void {
  // 相手の構えは、聞き逃さないように高く鳴らす（読み合いの情報。PLAN.md §9.3）
  const base = enemy ? 660 : 440;
  tone(base, 0.12, "square", 0.14);
  tone(base * 1.5, 0.18, "square", 0.14, 0.12);
}

export function sfxUlt(grand: boolean): void {
  noise(0.6, 0.5, "lowpass", 200, 0, 0.7, 5000);
  tone(grand ? 55 : 82, 0.7, "sawtooth", 0.25, 0, grand ? 440 : 330);
  tone(grand ? 110 : 165, 0.5, "square", 0.12, 0.25, 40);
}

export function sfxKo(): void {
  tone(330, 0.5, "triangle", 0.25, 0, 60);
  noise(0.4, 0.3, "lowpass", 800, 0.05, 1, 100);
}

export function sfxPoke(hit: boolean): void {
  if (hit) tone(1200, 0.07, "square", 0.15, 0, 1800);
  else tone(600, 0.04, "sine", 0.1);
}

export function sfxAlarm(): void {
  for (let i = 0; i < 3; i++) tone(880, 0.15, "square", 0.15, i * 0.25);
}

export function sfxWin(win: boolean): void {
  const notes = win ? [523, 659, 784, 1047] : [392, 330, 262];
  notes.forEach((f, i) => tone(f, 0.3, "triangle", 0.2, i * 0.14));
}
