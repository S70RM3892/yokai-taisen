// シード付きの疑似乱数（BATTLE_SPEC §4.5）。
// xoshiro128** を 32bit 整数だけで計算する。状態は number[4]（各要素は符号なし 32bit）。

export type RngState = [number, number, number, number];

/** SplitMix32：1つの 32bit の値から次の値を作る。状態を返す形にして純粋関数にする */
export function splitmix32(seed: number): { value: number; next: number } {
  const next = (seed + 0x9e3779b9) >>> 0;
  let z = next;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  z = (z ^ (z >>> 16)) >>> 0;
  return { value: z, next };
}

/** 試合のシードと流れの番号から、その流れの初期状態を作る */
export function createStream(matchSeed: number, stream: number): RngState {
  // 試合のシードと流れの番号を混ぜてから SplitMix32 で4語を作る
  let s = splitmix32((matchSeed >>> 0) ^ Math.imul(stream + 1, 0x632be5ab)).value;
  const out: number[] = [];
  for (let i = 0; i < 4; i++) {
    const r = splitmix32(s);
    s = r.next;
    out.push(r.value);
  }
  // 全部 0 だと xoshiro が止まるので避ける
  if ((out[0] | out[1] | out[2] | out[3]) === 0) out[0] = 1;
  return out as RngState;
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** 次の 32bit 符号なし整数。状態をその場で書き換える */
export function nextU32(s: RngState): number {
  const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
  const t = (s[1] << 9) >>> 0;
  s[2] = (s[2] ^ s[0]) >>> 0;
  s[3] = (s[3] ^ s[1]) >>> 0;
  s[1] = (s[1] ^ s[2]) >>> 0;
  s[0] = (s[0] ^ s[3]) >>> 0;
  s[2] = (s[2] ^ t) >>> 0;
  s[3] = rotl(s[3], 11);
  return result;
}

/** 0 以上 n 未満の整数。棄却法で偏りをなくす（rand % n は使わない） */
export function randInt(s: RngState, n: number): number {
  if (!Number.isInteger(n) || n <= 0 || n > 0x100000000) {
    throw new RangeError(`randInt: bad n ${n}`);
  }
  // 2^32 を n で割った余りの分だけ、上の方を捨てる
  const limit = 0x100000000 - (0x100000000 % n);
  for (;;) {
    const x = nextU32(s);
    if (x < limit) return x % n;
  }
}

/** min 以上 max 以下の整数 */
export function randRange(s: RngState, min: number, max: number): number {
  return min + randInt(s, max - min + 1);
}

/** Fisher–Yates でシャッフル（配列をその場で並べ替える） */
export function shuffle<T>(s: RngState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(s, i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
