import { describe, expect, it } from "vitest";
import { createStream, nextU32, randInt, randRange, shuffle } from "../src/core/rng.js";

describe("疑似乱数（§4.5）", () => {
  it("同じシード・同じ流れなら同じ列になる", () => {
    const a = createStream(42, 3);
    const b = createStream(42, 3);
    for (let i = 0; i < 100; i++) expect(nextU32(a)).toBe(nextU32(b));
  });

  it("シードか流れの番号が違えば列が変わる", () => {
    const base = createStream(42, 3);
    const otherSeed = createStream(43, 3);
    const otherStream = createStream(42, 4);
    const x = Array.from({ length: 8 }, () => nextU32(base));
    expect(Array.from({ length: 8 }, () => nextU32(otherSeed))).not.toEqual(x);
    expect(Array.from({ length: 8 }, () => nextU32(otherStream))).not.toEqual(x);
  });

  it("値は 32bit の符号なし整数", () => {
    const s = createStream(7, 0);
    for (let i = 0; i < 1000; i++) {
      const v = nextU32(s);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(2 ** 32);
    }
  });

  it("randInt は範囲に収まり、だいたい一様", () => {
    const s = createStream(1, 0);
    const counts = new Array(7).fill(0);
    const n = 70000;
    for (let i = 0; i < n; i++) counts[randInt(s, 7)]++;
    for (const c of counts) expect(Math.abs(c - n / 7)).toBeLessThan(n / 7 / 20);
  });

  it("randRange は両端を含む", () => {
    const s = createStream(5, 0);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(randRange(s, 980, 1020));
    expect(Math.min(...seen)).toBe(980);
    expect(Math.max(...seen)).toBe(1020);
    expect(seen.size).toBe(41);
  });

  it("shuffle は並べ替えるだけで要素は変わらない", () => {
    const s = createStream(9, 0);
    const arr = shuffle(s, [1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...arr].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("おかしな n は例外", () => {
    const s = createStream(1, 0);
    expect(() => randInt(s, 0)).toThrow();
    expect(() => randInt(s, 1.5)).toThrow();
  });
});
