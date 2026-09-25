import { describe, expect, it } from "vitest";
import { type Controller, cpuThink, createCpu, playReplay, runMatch, step } from "../src/core/index.js";
import { battle, TEAM_A, TEAM_B } from "./helpers.js";

function cpuMatch(seed: number) {
  const cpus = [createCpu(0, seed), createCpu(1, seed)];
  const controllers: [Controller, Controller] = [(s) => cpuThink(cpus[0], s), (s) => cpuThink(cpus[1], s)];
  return runMatch(seed, [TEAM_A, TEAM_B], controllers);
}

describe("決定論（§0・§15）", () => {
  it("同じシード・同じ編成・同じ入力なら、結果が1バイトも変わらない", () => {
    const a = cpuMatch(2024);
    const b = cpuMatch(2024);
    expect(a.state.outcome).not.toBeNull();
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(JSON.stringify(a.replay)).toBe(JSON.stringify(b.replay));
  });

  it("シードと入力列だけでリプレイが再生できる", () => {
    const a = cpuMatch(77);
    const replayed = playReplay(JSON.parse(JSON.stringify(a.replay)));
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(a.state));
  });

  it("シードが違えば試合が変わる", () => {
    expect(JSON.stringify(cpuMatch(1).state)).not.toBe(JSON.stringify(cpuMatch(2).state));
  });

  it("step は元の状態を書き換えない", () => {
    const s = battle();
    const before = JSON.stringify(s);
    const r = step(s, [{ player: 0, input: { t: "rotate", dir: "cw" } }]);
    expect(JSON.stringify(s)).toBe(before);
    expect(r.state.tick).toBe(1);
    expect(r.state.players[0].wheel).toEqual([5, 0, 1, 2, 3, 4]);
  });

  it("状態に浮動小数点が入らない", () => {
    const { state } = cpuMatch(5);
    const check = (v: unknown): void => {
      if (typeof v === "number") expect(Number.isInteger(v)).toBe(true);
      else if (Array.isArray(v)) v.forEach(check);
      else if (v && typeof v === "object") Object.values(v).forEach(check);
    };
    check(state);
  });
});
