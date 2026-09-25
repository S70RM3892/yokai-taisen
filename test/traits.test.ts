import { describe, expect, it } from "vitest";
import {
  apAfterAction,
  type BattleEvent,
  type BattleState,
  effectiveStat,
  type MemberSpec,
  pickEnemyTarget,
  type PlayerId,
  sgPerTurn,
  type TraitId,
  UNITS,
  unitIndexById,
  validateTeam,
} from "../src/core/index.js";
import { battle, freezeAg, ftick, readyUnit, TEAM_A, TEAM_B, tick } from "./helpers.js";

const ofType = <T extends BattleEvent["t"]>(events: BattleEvent[], t: T) =>
  events.filter((e): e is Extract<BattleEvent, { t: T }> => e.t === t);

/** 行動させたいユニットだけ AG を満タンにして 1 tick 進める */
function actOnce(s: BattleState, pid: PlayerId, index: number): BattleEvent[] {
  freezeAg(s);
  const p = s.players[pid];
  readyUnit(s, pid, index);
  return tick(s);
}

/** ランク制限にかからない B ランクだけの控え */
const FILL: MemberSpec[] = [{ unit: "karakasa" }, { unit: "zashiki" }, { unit: "ogama" }, { unit: "bakedanuki" }, { unit: "komainu" }];

/** 性格が「猛攻」でなまけないメンバー */
const striker = (unit: string): MemberSpec => ({ unit, nature: "fierce", equipment: "diligence_band" });

/** 特性を一時的に差し替える（比べるため） */
function withTrait<T>(unit: string, trait: TraitId, fn: () => T): T {
  const def = UNITS[unitIndexById(unit)] as { trait: TraitId };
  const before = def.trait;
  def.trait = trait;
  try {
    return fn();
  } finally {
    def.trait = before;
  }
}

/** 最初の通常攻撃のダメージ（出るまで回す） */
function firstAttack(s: BattleState, pid: PlayerId, index: number, source = "attack"): number {
  for (let i = 0; i < 200; i++) {
    const d = ofType(actOnce(s, pid, index), "damage").find(
      (e) => e.src === s.players[pid].units[index].uid && e.source === source,
    );
    if (d) return d.amount;
  }
  throw new Error("no attack");
}

describe("グループ制限（§2.2）", () => {
  it("大物はチームに1体まで", () => {
    const two = [{ unit: "shuten" }, { unit: "ushioni" }, ...TEAM_A.slice(2)];
    expect(validateTeam(two).some((e) => e.includes("大物"))).toBe(true);
    const one = [{ unit: "shuten" }, ...TEAM_A.slice(1)];
    expect(validateTeam(one)).toEqual([]);
  });
});

describe("特性（§8.5）", () => {
  it("破甲：通常攻撃がガードを無視する", () => {
    const team = [striker("shuten"), ...TEAM_A.slice(1)];
    const run = (guard: boolean) => {
      const s = battle(5, team, TEAM_B);
      // 術はガードされるので、狙う相手が変わらないように HP を増やす
      for (const u of s.players[1].units) u.hp = u.maxHp = 100000;
      if (guard) for (const u of s.players[1].units) u.guarding = true;
      return firstAttack(s, 0, 0);
    };
    expect(run(true)).toBe(run(false));
  });

  it("要石：真ん中にいる間だけ DEF +30%", () => {
    const team = [{ unit: "yukionna" }, { unit: "ushioni" }, { unit: "zashiki" }, ...FILL.slice(0, 3)];
    const s = battle(1, team, TEAM_B);
    const p = s.players[0];
    expect(effectiveStat(p, p.units[1], "def")).toBe(Math.floor((189 * 1300) / 1000));
    ftick(s, [0, { t: "rotate", dir: "cw" }]); // 位置 1 → 2
    expect(effectiveStat(p, p.units[1], "def")).toBe(189);
  });

  it("〇の心得：その属性のダメージ ×1.25", () => {
    const run = () => {
      const team = [{ unit: "onibi" }, ...TEAM_A.slice(1)];
      const s = battle(2, team, TEAM_B);
      s.players[0].units[0].sg = 1000;
      ftick(s, [0, { t: "ultStart", allySlot: 0, grand: false }]);
      for (let i = 1; i < 7; i++) ftick(s);
      return ofType(ftick(s, [0, { t: "ultRelease" }]), "damage").reduce((a, e) => a + e.amount, 0);
    };
    const withAdept = run();
    const without = withTrait("onibi", "hidden", run);
    expect(withAdept / without).toBeGreaterThan(1.2);
    expect(withAdept / without).toBeLessThan(1.3);
  });

  it("踏ん張り：HP が 0 になるダメージを1回だけ HP 1 で耐える", () => {
    const team = [{ unit: "nurikabe" }, ...TEAM_A.slice(1)];
    const s = battle(1, team, TEAM_B);
    const u = s.players[0].units[0];
    u.hp = 3;
    u.curse = { kind: "poison", tier: 0, remaining: 300, elapsed: 19 };
    const ev = ftick(s);
    expect(ofType(ev, "endure").length).toBe(1);
    expect(u.hp).toBe(1);
    for (let i = 0; i < 20; i++) ftick(s);
    expect(u.hp).toBe(0);
  });

  it("追い風：後衛にいる間、前衛の SPD +10%", () => {
    const team = [{ unit: "oni" }, { unit: "yukionna" }, { unit: "kappa" }, { unit: "ittan" }, ...TEAM_A.slice(4)];
    const s = battle(1, team, TEAM_B);
    const p = s.players[0];
    expect(effectiveStat(p, p.units[1], "spd")).toBe(110);
  });

  it("屍喰いと勝ち鬨：敵を倒すと回復・ATK が上がる", () => {
    const team = [striker("kasha"), striker("kamaitachi"), ...FILL.slice(1, 5)];
    const s = battle(1, team, TEAM_B);
    const [kasha, kama] = s.players[0].units;
    kasha.hp = 100;
    for (const u of s.players[1].units) u.hp = 1;
    actOnce(s, 0, 0);
    expect(kasha.hp).toBe(100 + Math.floor((300 * 200) / 1000));
    actOnce(s, 0, 1);
    expect(kama.conquests).toBe(1);
    expect(effectiveStat(s.players[0], kama, "atk")).toBe(Math.floor((125 * 1150) / 1000));
  });

  it("怨念：倒されたら、倒した相手に最大 HP の 25% のダメージ", () => {
    const foe = [{ unit: "kyokotsu" }, ...TEAM_B.slice(1)];
    const s = battle(1, [striker("oni"), ...FILL], foe);
    s.players[1].units[0].hp = 1;
    const oni = s.players[0].units[0];
    const ev = actOnce(s, 0, 0);
    expect(ofType(ev, "damage").some((e) => e.source === "trait" && e.dst === oni.uid)).toBe(true);
    expect(oni.hp).toBe(312 - Math.floor((312 * 250) / 1000));
  });

  it("呪詛の才：味方がいれば（後衛でも）呪付が1段強くなる", () => {
    const team = [{ unit: "kyokotsu" }, ...TEAM_A.slice(1, 4), { unit: "waira" }, TEAM_A[5]];
    const s = battle(1, team, TEAM_B);
    s.players[0].units[0].sg = 1000;
    ftick(s, [0, { t: "ultStart", allySlot: 0, grand: false }]);
    const ev = ftick(s, [0, { t: "ultRelease" }]);
    const hits = ofType(ev, "curse").filter((e) => e.result === "hit");
    expect(hits.length).toBeGreaterThan(0);
    for (const e of hits) expect(e.tier).toBe(2); // 奥義の「超」→「究極」
  });

  it("不屈：呪付がかからない", () => {
    const foe = [{ unit: "komainu" }, ...TEAM_B.slice(1)];
    const s = battle(1, [{ unit: "bakedanuki" }, ...TEAM_A.slice(1)], foe);
    s.players[0].units[0].sg = 1000;
    ftick(s, [0, { t: "ultStart", allySlot: 0, grand: false }]);
    const ev = ftick(s, [0, { t: "ultRelease" }]);
    expect(ofType(ev, "curse").find((e) => e.dst === 6)!.result).toBe("immune");
    expect(s.players[1].units[0].curse).toBeNull();
  });

  it("毒の肌：通常攻撃で受けたダメージの 1/4 を返す", () => {
    const foe = [{ unit: "ogama" }, ...TEAM_B.slice(1)];
    const s = battle(1, [striker("oni"), ...TEAM_A.slice(1)], foe);
    ftick(s, [0, { t: "target", enemyUnit: 0 }]);
    const ev = actOnce(s, 0, 0);
    const dealt = ofType(ev, "damage").find((e) => e.src === 0 && e.source === "attack")!.amount;
    const back = ofType(ev, "damage").find((e) => e.dst === 0 && e.source === "trait")!.amount;
    expect(back).toBe(Math.floor(dealt / 4));
  });

  it("鏡返し：術で受けたダメージの 1/2 を返す", () => {
    const foe = [{ unit: "yamabiko" }, ...TEAM_B.slice(1)];
    const me = [{ unit: "yukionna", nature: "arcane" as const, equipment: "diligence_band" as const }, ...FILL];
    const s = battle(1, me, foe);
    s.players[0].units[0].hp = s.players[0].units[0].maxHp = 100000;
    for (const u of s.players[1].units) u.hp = u.maxHp = 100000;
    ftick(s, [0, { t: "target", enemyUnit: 0 }]);
    for (let i = 0; i < 200; i++) {
      const ev = actOnce(s, 0, 0);
      const d = ofType(ev, "damage").find((e) => e.src === 0 && e.source === "skill");
      if (!d) continue;
      const back = ofType(ev, "damage").find((e) => e.dst === 0 && e.source === "trait")!;
      expect(back.amount).toBe(Math.floor(d.amount / 2));
      return;
    }
    throw new Error("no skill");
  });

  it("逆上：HP 25% 以下で ATK +50%", () => {
    const s = battle();
    const p = s.players[0];
    const oni = p.units[0];
    expect(effectiveStat(p, oni, "atk")).toBe(135);
    oni.hp = Math.floor(oni.maxHp / 4);
    expect(effectiveStat(p, oni, "atk")).toBe(Math.floor((135 * 1500) / 1000));
  });

  it("鉄壁：ガード中のダメージが 1/4", () => {
    const foe = [{ unit: "karakasa" }, ...TEAM_B.slice(1)];
    const run = (guard: boolean) => {
      const s = battle(4, [striker("oni"), ...TEAM_A.slice(1)], foe);
      ftick(s, [0, { t: "target", enemyUnit: 0 }]);
      s.players[1].units[0].guarding = guard;
      return firstAttack(s, 0, 0);
    };
    const open = run(false);
    const guarded = run(true);
    expect(Math.abs(guarded * 4 - open)).toBeLessThanOrEqual(4);
  });

  it("吸精：与えたダメージの 25% 回復", () => {
    const me = [striker("nekomata"), ...FILL];
    const s = battle(1, me, TEAM_B);
    const neko = s.players[0].units[0];
    neko.hp = 50;
    const ev = actOnce(s, 0, 0);
    const dealt = ofType(ev, "damage").find((e) => e.src === 0)!.amount;
    expect(neko.hp).toBe(50 + Math.floor(dealt / 4));
  });

  it("水喰い：水属性のダメージで回復する", () => {
    const me = [{ unit: "karakasa" }, ...TEAM_A.slice(1)]; // 奥義：全体・水
    const foe = [{ unit: "kappa" }, ...FILL];
    const s = battle(1, me, foe);
    const kappa = s.players[1].units[0];
    kappa.hp = 100;
    s.players[0].units[0].sg = 1000;
    ftick(s, [0, { t: "ultStart", allySlot: 0, grand: false }]);
    const ev = ftick(s, [0, { t: "ultRelease" }]);
    expect(ofType(ev, "damage").some((e) => e.dst === kappa.uid)).toBe(false);
    expect(kappa.hp).toBeGreaterThan(100);
  });

  it("隠れ身：自動のねらいに選ばれない。標的にされたら狙われる", () => {
    const foe = [{ unit: "bakedanuki" }, ...TEAM_B.slice(1)];
    const s = battle(1, TEAM_A, foe);
    const [me, enemy] = s.players;
    enemy.units[0].hp = 1; // 一番 HP の割合が低い
    expect(pickEnemyTarget(me, enemy)!.index).not.toBe(0);
    me.target = 0;
    expect(pickEnemyTarget(me, enemy)!.index).toBe(0);
  });

  it("先駆け：開始時に前衛ならすぐ行動できる。後衛からは初めて前に出たとき", () => {
    const front = battle(1, [{ unit: "rokurokubi" }, ...TEAM_A.slice(1)], TEAM_B);
    const p = front.players[0];
    expect(p.units[0].ap).toBe(0);
    // TEAM_B は位置 5 がろくろ首
    const s = battle(1, TEAM_A, TEAM_B);
    const ev = ftick(s, [1, { t: "rotate", dir: "cw" }]); // 5 → 0
    expect(ofType(ev, "firstStrike").length).toBe(1);
  });

  it("福の気：ホイールで隣の味方の SG 増加 +50%", () => {
    const team = [{ unit: "oni" }, { unit: "zashiki" }, ...TEAM_A.slice(2, 4), { unit: "kodama" }, { unit: "kodama" }];
    const s = battle(1, team, TEAM_B);
    expect(sgPerTurn(s.players[0], s.players[0].units[0])).toBe(49); // 33 × 1.5
  });

  it("祈り：隣の味方が行動するたびに最大 HP の 2% 回復", () => {
    // TEAM_A は位置 5 が木霊（祈り）で、鬼（位置 0）の隣
    const team = [striker("oni"), ...TEAM_A.slice(1)];
    const s = battle(1, team, TEAM_B);
    const oni = s.players[0].units[0];
    oni.hp = 100;
    actOnce(s, 0, 0);
    expect(oni.hp).toBe(100 + Math.floor((312 * 20) / 1000));
  });

  it("後見：後衛にいる間、前衛の味方が行動するたびに 1% 回復", () => {
    const team = [striker("yukionna"), { unit: "oni" }, { unit: "komainu" }, { unit: "hakutaku" }, { unit: "zashiki" }, { unit: "karakasa" }];
    const s = battle(1, team, TEAM_B);
    const yuki = s.players[0].units[0];
    yuki.hp = 100;
    actOnce(s, 0, 0);
    expect(yuki.hp).toBe(100 + Math.floor((216 * 10) / 1000));
  });

  it("一閃：クリティカルが約 34%", () => {
    const me = [striker("tengu"), ...TEAM_A.slice(1)];
    const s = battle(1, me, TEAM_B);
    for (const u of s.players[1].units) u.hp = u.maxHp = 10_000_000;
    let crit = 0;
    let total = 0;
    for (let i = 0; i < 1500; i++) {
      for (const e of actOnce(s, 0, 0)) {
        if (e.t === "damage" && e.src === 0 && e.source === "attack") {
          total++;
          if (e.crit) crit++;
        }
      }
    }
    expect(crit / total).toBeGreaterThan(0.28);
    expect(crit / total).toBeLessThan(0.41);
  });
});
