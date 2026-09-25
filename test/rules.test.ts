import { describe, expect, it } from "vitest";
import {
  actionPoints,
  agNeeded,
  baseDamage,
  chainLength,
  formationPermil,
  sgPerTurn,
  type BattleEvent,
  buildMember,
  createStream,
  curseSuccessPermil,
  effectiveStat,
  NATURES,
  pickBlessTarget,
  rollAction,
  validateTeam,
} from "../src/core/index.js";
import { battle, freezeAg, ftick, idle, TEAM_A, TEAM_B, tick } from "./helpers.js";

const ofType = <T extends BattleEvent["t"]>(events: BattleEvent[], t: T) =>
  events.filter((e): e is Extract<BattleEvent, { t: T }> => e.t === t);

describe("編成（§2）", () => {
  it("今のテスト用チームは正しい", () => {
    expect(validateTeam(TEAM_A)).toEqual([]);
    expect(validateTeam(TEAM_B)).toEqual([]);
  });

  it("S は2体まで・A は2体まで", () => {
    const threeS = [{ unit: "oni" }, { unit: "tengu" }, { unit: "oni" }, ...TEAM_A.slice(3)];
    expect(validateTeam(threeS).some((e) => e.includes("S ランク"))).toBe(true);
    const threeA = [{ unit: "yukionna" }, { unit: "kappa" }, { unit: "nekomata" }, ...TEAM_A.slice(3)];
    expect(validateTeam(threeA).some((e) => e.includes("A ランク"))).toBe(true);
  });

  it("B は同じユニットを何体でも入れられる", () => {
    const sixB = Array.from({ length: 6 }, () => ({ unit: "karakasa" }));
    expect(validateTeam(sixB)).toEqual([]);
  });

  it("努力ポイントは1つのステに20まで、合計40まで", () => {
    const over1 = [{ unit: "oni", effort: { hp: 0, atk: 21, spa: 0, def: 0, spd: 0 } }, ...TEAM_A.slice(1)];
    expect(validateTeam(over1).length).toBeGreaterThan(0);
    const over2 = [{ unit: "oni", effort: { hp: 20, atk: 20, spa: 1, def: 0, spd: 0 } }, ...TEAM_A.slice(1)];
    expect(validateTeam(over2).length).toBeGreaterThan(0);
  });

  it("努力ポイント：鎌鼬に ATK 20・SPD 20 → ATK 145・SPD 160。HP は1ptで+4", () => {
    const b = buildMember({ unit: "kamaitachi", effort: { hp: 0, atk: 20, spa: 0, def: 0, spd: 20 } });
    expect(b.atk).toBe(145);
    expect(b.spd).toBe(160);
    expect(buildMember({ unit: "oni", effort: { hp: 10, atk: 0, spa: 0, def: 0, spd: 0 } }).maxHp).toBe(312 + 40);
  });

  it("装備のステ補正は努力ポイントの後に足す", () => {
    const b = buildMember({ unit: "oni", effort: { hp: 0, atk: 20, spa: 0, def: 0, spd: 0 }, equipment: "power_bangle" });
    expect(b.atk).toBe(135 + 20 + 15);
    expect(buildMember({ unit: "oni", equipment: "life_jewel" }).maxHp).toBe(312 + 60);
  });

  it("正しくない編成では試合を始められない", () => {
    expect(() => battle(1, TEAM_A.slice(0, 5))).toThrow();
  });
});

describe("行動ポイントと AG（§4.1）", () => {
  it("原作の行動ポイントの式", () => {
    expect(actionPoints(100)).toBe(270);
    expect(actionPoints(171)).toBe(198);
    expect(actionPoints(201)).toBe(180);
    expect(actionPoints(210)).toBe(180); // 段々になる
    expect(actionPoints(501)).toBe(90);
    expect(actionPoints(900)).toBe(90);
    expect(actionPoints(101)).toBe(actionPoints(99)); // 3 ずつ
    expect(actionPoints(102)).toBe(actionPoints(99) - 3);
  });

  it("開始時：前衛の AG は必要な量の 40〜60%、後衛は 0。SG は全員 0", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = battle(seed);
      const p = s.players[0];
      for (const u of p.units.slice(0, 3)) {
        const need = agNeeded(p, u);
        expect(u.ag).toBeGreaterThanOrEqual(Math.floor(need * 0.4));
        expect(u.ag).toBeLessThanOrEqual(Math.floor(need * 0.6));
      }
      expect(p.units.slice(3).map((u) => u.ag)).toEqual([0, 0, 0]);
      expect(s.players.every((q) => q.units.every((u) => u.sg === 0))).toBe(true);
    }
  });

  it("AG は前衛だけ 1 tick に 9 増える", () => {
    const s = battle();
    const before = s.players[0].units.map((u) => u.ag);
    tick(s);
    const after = s.players[0].units.map((u) => u.ag);
    expect(after.map((a, i) => a - before[i])).toEqual([9, 9, 9, 0, 0, 0]);
  });

  it("必要な量に届いたら行動し、余りを持ち越す", () => {
    const s = battle();
    freezeAg(s);
    const p = s.players[0];
    const need = agNeeded(p, p.units[0]); // 鬼：SPD 60 → 行動ポイント 309
    expect(need).toBe(3090);
    p.units[0].ag = need - 5;
    const ev = tick(s);
    expect(ofType(ev, "action").map((e) => e.uid)).toEqual([0]);
    expect(p.units[0].ag).toBe(4);
  });
});

describe("妖気（§6.1）", () => {
  it("だれかが1回行動すると、両チームの前衛全員の SG が1ターン分増える。後衛は増えない", () => {
    const s = battle();
    freezeAg(s);
    const p = s.players[0];
    p.units[0].ag = agNeeded(p, p.units[0]);
    tick(s);
    // 鬼 ランク2 → 33、雪女 ランク3 → 40、河童 ランク3 → 40
    expect(p.units.map((u) => u.sg)).toEqual([33, 40, 40, 0, 0, 0]);
    // 相手：天狗 ランク4 → 50、鎌鼬 ランク5 → 59、猫又 ランク4 → 50
    expect(s.players[1].units.slice(0, 3).map((u) => u.sg)).toEqual([50, 59, 50]);
  });

  it("行動がなければ SG は増えない", () => {
    const s = battle();
    idle(s, 100);
    expect(s.players[0].units.every((u) => u.sg === 0)).toBe(true);
  });

  it("封気の間は SG が増えない", () => {
    const s = battle();
    freezeAg(s);
    const p = s.players[0];
    p.units[1].curse = { kind: "seal", tier: 0, remaining: 300, elapsed: 0 };
    p.units[0].ag = agNeeded(p, p.units[0]);
    tick(s);
    expect(p.units[1].sg).toBe(0);
    expect(sgPerTurn(p, p.units[1])).toBe(0);
  });

  it("妖気の鈴と集気で1ターンの SG が +50%", () => {
    const team = [{ unit: "oni", equipment: "spirit_bell" as const }, ...TEAM_A.slice(1)];
    const s = battle(1, team, TEAM_B);
    const [oni, yuki] = s.players[0].units;
    expect(sgPerTurn(s.players[0], oni)).toBe(49); // 33 × 1.5
    yuki.blessing = { kind: "gather", tier: 0, remaining: 300, elapsed: 0, wardCharges: 0 };
    expect(sgPerTurn(s.players[0], yuki)).toBe(60); // 40 × 1.5
  });

  it("呪付のかかった敵を攻撃すると、攻撃した側に1ターン分の SG が足される", () => {
    const run = (cursed: boolean) => {
      const team = [{ unit: "oni", nature: "fierce" as const, equipment: "diligence_band" as const }, ...TEAM_A.slice(1)];
      const s = battle(3, team, TEAM_B);
      freezeAg(s);
      if (cursed) for (const u of s.players[1].units) u.curse = { kind: "slow", tier: 0, remaining: 300, elapsed: 0 };
      const p = s.players[0];
      p.units[0].ag = agNeeded(p, p.units[0]);
      const ev = tick(s);
      expect(ofType(ev, "damage").length).toBe(1);
      return p.units[0].sg;
    };
    expect(run(false)).toBe(33);
    expect(run(true)).toBe(66);
  });
});

describe("性格（§4.2）", () => {
  it("たくさん引くと表の確率に近づく", () => {
    for (const nature of NATURES) {
      const u = { nature: nature.id, rng: createStream(123, 0) };
      const n = 50000;
      const counts: Record<string, number> = { attack: 0, skill: 0, guard: 0, curse: 0, bless: 0 };
      for (let i = 0; i < n; i++) counts[rollAction(u)]++;
      const got = ["attack", "skill", "guard", "curse", "bless"].map((k) => (counts[k] * 100) / n);
      nature.weights.forEach((w, i) => expect(Math.abs(got[i] - w)).toBeLessThan(1));
    }
  });

  it("シードが違えば結果が変わる", () => {
    const draw = (seed: number) => {
      const u = { nature: "balanced" as const, rng: createStream(seed, 0) };
      return Array.from({ length: 40 }, () => rollAction(u));
    };
    expect(draw(1)).toEqual(draw(1));
    expect(draw(1)).not.toEqual(draw(2));
  });
});

describe("なまけ（§4.6）", () => {
  const countLoaf = (equipment: "diligence_band" | null) => {
    const team = [{ unit: "oni", equipment }, ...TEAM_A.slice(1)];
    const s = battle(7, team, TEAM_B);
    for (const u of s.players[1].units) u.maxHp = u.hp = 10_000_000;
    let loaf = 0;
    let acts = 0;
    for (let i = 0; i < 4000; i++) {
      freezeAg(s);
      s.players[0].units[0].ag = agNeeded(s.players[0], s.players[0].units[0]);
      for (const e of tick(s)) {
        if (e.t === "action" && e.uid === 0) {
          acts++;
          if (e.action === "loaf") loaf++;
        }
      }
    }
    return { loaf, acts };
  };

  it("精勤の鉢巻があればなまけない", () => {
    expect(countLoaf("diligence_band").loaf).toBe(0);
  });

  it("鉢巻がなければ約 2.5% なまける", () => {
    const { loaf, acts } = countLoaf(null);
    expect(acts).toBeGreaterThan(3000);
    expect(loaf / acts).toBeGreaterThan(0.01);
    expect(loaf / acts).toBeLessThan(0.045);
  });
});

describe("ダメージ（§5）", () => {
  it("原作の式：（ステ ＋ 威力）÷ 2 − まもり ÷ 4", () => {
    expect(baseDamage(100, 30, 100)).toBe(40);
    expect(baseDamage(100, 90, 100)).toBe(70);
  });

  it("クリティカルは守りを無視して 1.5 倍、64 回に1回くらい", () => {
    const team = [{ unit: "oni", nature: "fierce" as const, equipment: "diligence_band" as const }, ...TEAM_A.slice(1)];
    const s = battle(11, team, TEAM_B);
    for (const u of s.players[1].units) u.maxHp = u.hp = 10_000_000;
    const crit: number[] = [];
    let total = 0;
    for (let i = 0; i < 4000; i++) {
      freezeAg(s);
      s.players[0].units[0].ag = agNeeded(s.players[0], s.players[0].units[0]);
      for (const e of tick(s)) {
        // 天狗（uid 6、DEF 70）への通常攻撃だけ数える
        if (e.t === "damage" && e.src === 0 && e.source === "attack" && e.dst === 6) {
          total++;
          if (e.crit) crit.push(e.amount);
        }
      }
    }
    // 鬼 ATK 135・威力 135 → floor(270 / 2) = 135 → × 1.5 = 202（守りを引かない）。揺れ ±2%
    expect(crit.length).toBeGreaterThan(0);
    for (const d of crit) {
      expect(d).toBeGreaterThanOrEqual(Math.floor((202 * 980) / 1000));
      expect(d).toBeLessThanOrEqual(Math.floor((202 * 1020) / 1000));
    }
    const rate = crit.length / total;
    expect(rate).toBeGreaterThan(0.005);
    expect(rate).toBeLessThan(0.03);
  });

  it("陣：ホイールで隣り合った同じ種族がつながる。前衛にいる分だけ受ける", () => {
    // 位置 0 鬼（猛）・1 唐傘（猛）・2 雪女（怪）
    const team = [{ unit: "oni" }, { unit: "karakasa" }, { unit: "yukionna" }, ...TEAM_A.slice(3)];
    const s = battle(1, team, TEAM_B);
    const p = s.players[0];
    expect(chainLength(p, p.units[0])).toBe(2);
    expect(effectiveStat(p, p.units[0], "atk")).toBe(Math.floor((135 * 1150) / 1000));
    expect(effectiveStat(p, p.units[1], "atk")).toBe(Math.floor((115 * 1150) / 1000));
    // 種族が違う雪女には効かない
    expect(effectiveStat(p, p.units[2], "atk")).toBe(60);
  });

  it("陣：位置 5 と位置 0 も隣。3体つながれば、前衛に1体でも 25%", () => {
    // 位置 0 唐傘（猛）、位置 4・5 鬼…ではなく B の唐傘を後衛に2体（猛3体のつながり）
    const team = [
      { unit: "karakasa" },
      { unit: "yukionna" },
      { unit: "kappa" },
      { unit: "zashiki" },
      { unit: "karakasa" },
      { unit: "karakasa" },
    ];
    const s = battle(1, team, TEAM_B);
    const p = s.players[0];
    expect(chainLength(p, p.units[0])).toBe(3);
    expect(formationPermil(p, p.units[0])).toBe(250);
    expect(formationPermil(p, p.units[5])).toBe(0); // 後衛は受けない
  });

  it("陣：戦闘不能のユニットはつながりを切る", () => {
    const team = [{ unit: "oni" }, { unit: "karakasa" }, { unit: "yukionna" }, ...TEAM_A.slice(3)];
    const s = battle(1, team, TEAM_B);
    const p = s.players[0];
    p.units[1].hp = 0;
    expect(chainLength(p, p.units[0])).toBe(1);
    expect(formationPermil(p, p.units[0])).toBe(0);
  });

  it("呪付と加護は足し算、下限は 100‰", () => {
    const s = battle();
    const p = s.players[0];
    const oni = p.units[0];
    oni.curse = { kind: "weaken", tier: 0, remaining: 300, elapsed: 0 };
    expect(effectiveStat(p, oni, "atk")).toBe(Math.floor((135 * 700) / 1000));
    oni.blessing = { kind: "rally", tier: 2, remaining: 300, elapsed: 0, wardCharges: 0 };
    expect(effectiveStat(p, oni, "atk")).toBe(Math.floor((135 * 1200) / 1000));
  });
});

/** 雪女（位置1）で奥義を撃って、ダメージのイベントを返す */
function fireYuki(opts: { grand?: boolean; releaseAfter: number; guard?: boolean; seed?: number }) {
  const s = battle(opts.seed ?? 3);
  const me = s.players[0];
  me.units[1].sg = 1000;
  if (opts.grand) {
    me.units[0].sg = 1000;
    me.units[2].sg = 1000;
  }
  if (opts.guard) for (const u of s.players[1].units) u.guarding = true;
  const events: BattleEvent[] = [];
  events.push(...ftick(s, [0, { t: "ultStart", allySlot: 1, grand: opts.grand ?? false }]));
  for (let i = 1; i < opts.releaseAfter; i++) events.push(...ftick(s));
  events.push(...ftick(s, [0, { t: "ultRelease" }]));
  return { s, events };
}

describe("奥義（§6）", () => {
  it("構えて 7 tick で解放 → Perfect、溜め倍率 1000‰", () => {
    const { events, s } = fireYuki({ releaseAfter: 7 });
    const ult = ofType(events, "ult")[0];
    expect(ult).toMatchObject({ quality: "perfect", charge: 7, auto: false, grand: false });
    expect(ofType(events, "damage").length).toBe(1);
    expect(s.players[0].units[1].sg).toBeLessThan(100);
  });

  it("5・6・9・10 は Good、それ以外は Miss", () => {
    expect(ofType(fireYuki({ releaseAfter: 5 }).events, "ult")[0].quality).toBe("good");
    expect(ofType(fireYuki({ releaseAfter: 10 }).events, "ult")[0].quality).toBe("good");
    expect(ofType(fireYuki({ releaseAfter: 11 }).events, "ult")[0].quality).toBe("miss");
    expect(ofType(fireYuki({ releaseAfter: 23 }).events, "ult")[0].quality).toBe("perfect");
  });

  it("溜めるほど強い：同じ Perfect なら 23 tick（1200‰）は 7 tick（1000‰）より強い", () => {
    const d7 = ofType(fireYuki({ releaseAfter: 7 }).events, "damage")[0].amount;
    const d23 = ofType(fireYuki({ releaseAfter: 23 }).events, "damage")[0].amount;
    expect(d23).toBeGreaterThan(d7);
  });

  it("40 tick を超えたら自動で解放して Miss", () => {
    const s = battle();
    s.players[0].units[1].sg = 1000;
    ftick(s, [0, { t: "ultStart", allySlot: 1, grand: false }]);
    const ev = idle(s, 41);
    expect(ofType(ev, "ult")[0]).toMatchObject({ auto: true, quality: "miss", charge: 41 });
  });

  it("構えている間は AG が凍結する", () => {
    const s = battle();
    s.players[0].units[1].sg = 1000;
    tick(s, [0, { t: "ultStart", allySlot: 1, grand: false }]);
    const ag = s.players[0].units[1].ag;
    tick(s);
    tick(s);
    expect(s.players[0].units[1].ag).toBe(ag);
  });

  it("キャンセルすると SG は 1000 のまま、3 秒構えられない", () => {
    const s = battle();
    s.players[0].units[1].sg = 1000;
    ftick(s, [0, { t: "ultStart", allySlot: 1, grand: false }]);
    const ev = ftick(s, [0, { t: "ultCancel" }]);
    expect(ofType(ev, "stanceCancel").length).toBe(1);
    expect(s.players[0].units[1].sg).toBe(1000);
    expect(ofType(ftick(s, [0, { t: "ultStart", allySlot: 1, grand: false }]), "dropped").length).toBe(1);
    idle(s, 57);
    expect(ofType(ftick(s, [0, { t: "ultStart", allySlot: 1, grand: false }]), "dropped").length).toBe(1);
    expect(ofType(ftick(s, [0, { t: "ultStart", allySlot: 1, grand: false }]), "stance").length).toBe(1);
  });

  it("SG が足りなければ構えられない", () => {
    const s = battle();
    expect(ofType(ftick(s, [0, { t: "ultStart", allySlot: 0, grand: false }]), "dropped").length).toBe(1);
  });

  it("ガードは半分、奥義はガードされる", () => {
    const normal = ofType(fireYuki({ releaseAfter: 7 }).events, "damage")[0].amount;
    const guarded = ofType(fireYuki({ releaseAfter: 7, guard: true }).events, "damage")[0].amount;
    expect(Math.abs(guarded * 2 - normal)).toBeLessThanOrEqual(2);
  });
});

describe("大奥義（§6.5）", () => {
  it("両隣の SG が 1000 でなければ構えられない", () => {
    const s = battle();
    s.players[0].units[1].sg = 1000;
    s.players[0].units[0].sg = 1000;
    expect(ofType(ftick(s, [0, { t: "ultStart", allySlot: 1, grand: true }]), "dropped").length).toBe(1);
  });

  it("威力は 2 倍、ガードを無視、3体の SG が 0 になる", () => {
    const normal = ofType(fireYuki({ releaseAfter: 7 }).events, "damage")[0].amount;
    const { events, s } = fireYuki({ releaseAfter: 7, grand: true, guard: true });
    const grand = ofType(events, "damage")[0].amount;
    expect(Math.abs(grand - normal * 2)).toBeLessThanOrEqual(2);
    // 解放した tick の手順 3 で少しだけ増える
    for (const i of [0, 1, 2]) expect(s.players[0].units[i].sg).toBeLessThan(20);
  });

  it("端（位置 0）で構えると、後衛の位置 5 の妖気も使う", () => {
    const s = battle();
    const me = s.players[0];
    me.units[0].sg = 1000;
    me.units[1].sg = 1000;
    me.units[5].sg = 1000; // 位置 5 = 木霊（後衛）
    expect(ofType(ftick(s, [0, { t: "ultStart", allySlot: 0, grand: true }]), "stance").length).toBe(1);
    ftick(s, [0, { t: "ultRelease" }]);
    expect(me.units[5].sg).toBe(0); // 後衛なので増えない
  });

  it("構えている間に回すとキャンセル", () => {
    const s = battle();
    const me = s.players[0];
    for (const i of [0, 1, 2]) me.units[i].sg = 1000;
    ftick(s, [0, { t: "ultStart", allySlot: 1, grand: true }]);
    const ev = ftick(s, [0, { t: "rotate", dir: "cw" }]);
    expect(ofType(ev, "stanceCancel")[0]).toMatchObject({ reason: "rotate", grand: true });
    expect(me.units[0].sg).toBe(1000);
  });
});

describe("回転（§8.1・§12.1）", () => {
  it("cw は位置 p → p+1、ccw は p → p−1", () => {
    const s = battle();
    ftick(s, [0, { t: "rotate", dir: "cw" }]);
    expect(s.players[0].wheel).toEqual([5, 0, 1, 2, 3, 4]);
    const s2 = battle();
    ftick(s2, [0, { t: "rotate", dir: "ccw" }]);
    expect(s2.players[0].wheel).toEqual([1, 2, 3, 4, 5, 0]);
  });

  it("1回で何つ分でも回せる（待ち時間は同じ 60 tick）", () => {
    const s = battle();
    ftick(s, [0, { t: "rotate", dir: "cw", steps: 3 }]);
    expect(s.players[0].wheel).toEqual([3, 4, 5, 0, 1, 2]);
    expect(s.players[0].rotateCooldown).toBe(59);
    const s2 = battle();
    ftick(s2, [0, { t: "rotate", dir: "ccw", steps: 2 }]);
    expect(s2.players[0].wheel).toEqual([2, 3, 4, 5, 0, 1]);
    // 0 や 6 以上は捨てる
    expect(ofType(ftick(battle(), [0, { t: "rotate", dir: "cw", steps: 6 }]), "dropped").length).toBe(1);
  });

  it("1回回すと 60 tick 回せない", () => {
    const s = battle();
    ftick(s, [0, { t: "rotate", dir: "cw" }]);
    idle(s, 58);
    expect(ofType(ftick(s, [0, { t: "rotate", dir: "cw" }]), "dropped").length).toBe(1);
    expect(ofType(ftick(s, [0, { t: "rotate", dir: "cw" }]), "rotate").length).toBe(1);
  });

  it("普通の構えは、構えたユニットが後衛に行ったらキャンセル", () => {
    const s = battle();
    s.players[0].units[2].sg = 1000; // 位置 2
    ftick(s, [0, { t: "ultStart", allySlot: 2, grand: false }]);
    const ev = ftick(s, [0, { t: "rotate", dir: "cw" }]); // 2 → 3
    expect(ofType(ev, "stanceCancel").length).toBe(1);
  });
});

describe("呪付・加護・浄化（§7）", () => {
  it("呪付の時間は前衛で減り、後衛では凍結", () => {
    const s = battle();
    const me = s.players[0];
    me.units[0].curse = { kind: "slow", tier: 0, remaining: 300, elapsed: 0 };
    me.units[3].curse = { kind: "slow", tier: 0, remaining: 300, elapsed: 0 };
    idle(s, 10);
    expect(me.units[0].curse!.remaining).toBe(290);
    expect(me.units[3].curse!.remaining).toBe(300);
  });

  it("蝕毒は 20 tick ごとに最大HPの 2%", () => {
    const s = battle();
    const oni = s.players[0].units[0];
    oni.curse = { kind: "poison", tier: 0, remaining: 300, elapsed: 0 };
    idle(s, 19);
    expect(oni.hp).toBe(312);
    idle(s, 1);
    expect(oni.hp).toBe(312 - 6);
  });

  it("浄化は 40 tick で呪付を消す", () => {
    const s = battle();
    const u = s.players[0].units[3];
    u.curse = { kind: "slow", tier: 0, remaining: 300, elapsed: 0 };
    ftick(s, [0, { t: "purify", allySlot: 3 }]);
    idle(s, 38);
    expect(u.curse).not.toBeNull();
    const ev = idle(s, 1);
    expect(u.curse).toBeNull();
    expect(ofType(ev, "curseCleared")[0]).toMatchObject({ by: "purify" });
  });

  it("浄化中に前に出たら中断", () => {
    const s = battle();
    const u = s.players[0].units[3];
    u.curse = { kind: "slow", tier: 0, remaining: 300, elapsed: 0 };
    ftick(s, [0, { t: "purify", allySlot: 3 }]);
    ftick(s, [0, { t: "rotate", dir: "ccw" }]); // 位置 3 → 2
    expect(s.players[0].purify).toBeNull();
  });

  it("呪付のないユニットは浄化できない", () => {
    const s = battle();
    expect(ofType(ftick(s, [0, { t: "purify", allySlot: 3 }]), "dropped").length).toBe(1);
  });

  it("加護の相手：堅護は DEF が一番高い味方、集気は SG 1000 の味方を選ばない", () => {
    const s = battle();
    const p = s.players[0];
    expect(pickBlessTarget(p, "fortify")!.index).toBe(2); // 河童 DEF 130
    p.units[0].sg = 1000;
    p.units[1].sg = 1000;
    p.units[2].sg = 1000;
    expect(pickBlessTarget(p, "gather")).toBeNull();
  });

  it("まだ加護のない味方を優先する（種類は関係ない）", () => {
    const s = battle();
    const p = s.players[0];
    p.units[2].blessing = { kind: "rally", tier: 0, remaining: 100, elapsed: 0, wardCharges: 0 };
    expect(pickBlessTarget(p, "fortify")!.index).toBe(0); // 次に DEF が高い鬼（95）
    p.units[0].blessing = { kind: "rally", tier: 0, remaining: 100, elapsed: 0, wardCharges: 0 };
    p.units[1].blessing = { kind: "rally", tier: 0, remaining: 100, elapsed: 0, wardCharges: 0 };
    // 全員にかかっていたら全員から選ぶ
    expect(pickBlessTarget(p, "fortify")!.index).toBe(2);
  });

  it("ステータスを上げる加護は、加護込みの値で比べる", () => {
    const s = battle();
    const p = s.players[0];
    // 鬼 DEF 95 に脆化…ではなく、雪女（DEF 75）に堅護（+30%）→ 97 で鬼（95）を超える。全員加護ありにする
    p.units[1].blessing = { kind: "fortify", tier: 0, remaining: 100, elapsed: 0, wardCharges: 0 };
    p.units[0].blessing = { kind: "rally", tier: 0, remaining: 100, elapsed: 0, wardCharges: 0 };
    p.units[2].curse = { kind: "brittle", tier: 2, remaining: 100, elapsed: 0 }; // 河童 130 → 65
    p.units[2].blessing = { kind: "rally", tier: 0, remaining: 100, elapsed: 0, wardCharges: 0 };
    expect(pickBlessTarget(p, "fortify")!.index).toBe(1);
  });

  it("再生の相手はランダム（まだ加護のない味方から）", () => {
    const s = battle();
    const p = s.players[0];
    const seen = new Set<number>();
    for (let i = 0; i < 50; i++) seen.add(pickBlessTarget(p, "regen", p.units[0])!.index);
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });

  it("雅の陣でステータス低下系の呪付の成功率が上がる", () => {
    const miyabi2 = [{ unit: "bakedanuki" }, { unit: "rokurokubi" }, { unit: "oni" }, ...TEAM_A.slice(3)];
    const s = battle(1, miyabi2, TEAM_B);
    const [me, foe] = s.players;
    expect(curseSuccessPermil(me, me.units[0], foe, foe.units[0], "slow")).toBe(900);
    expect(curseSuccessPermil(me, me.units[0], foe, foe.units[0], "poison")).toBe(750);
    // 陣を受けていないユニット（鬼）には効かない
    expect(curseSuccessPermil(me, me.units[2], foe, foe.units[0], "slow")).toBe(750);
  });
});

describe("つつき（§8.4）", () => {
  function setup() {
    const s = battle();
    const tengu = s.players[1].units[0];
    tengu.curse = { kind: "slow", tier: 0, remaining: 300, elapsed: 0 };
    tengu.sg = 1000;
    return { s, tengu };
  }

  it("呪付もなまけもない敵はつつけない", () => {
    const s = battle();
    expect(ofType(ftick(s, [0, { t: "pokeStart", enemyUnit: 0 }]), "dropped").length).toBe(1);
  });

  it("弱点を 10 回つつくと成功：妖気を吸う", () => {
    const { s, tengu } = setup();
    ftick(s, [0, { t: "pokeStart", enemyUnit: 0 }]);
    let success = false;
    for (let i = 0; i < 40 && !success; i++) {
      const cell = s.players[0].poke!.weakCell;
      const ev = ftick(s, [0, { t: "pokeTap", cell }]);
      success = ofType(ev, "pokeEnd").some((e) => e.result === "success");
      ftick(s);
    }
    expect(success).toBe(true);
    expect(tengu.hp).toBe(228 - 10 * 2); // 1回 最大HPの 1%
    expect(tengu.sg).toBeLessThan(1000 - 400 + 50);
    expect(s.players[0].pokeCooldown).toBeGreaterThan(0);
  });

  it("タップは 2 tick に1回まで", () => {
    const { s } = setup();
    ftick(s, [0, { t: "pokeStart", enemyUnit: 0 }]);
    ftick(s, [0, { t: "pokeTap", cell: 0 }]);
    expect(ofType(ftick(s, [0, { t: "pokeTap", cell: 0 }]), "dropped").length).toBe(1);
  });

  it("つついている間は回せない", () => {
    const { s } = setup();
    ftick(s, [0, { t: "pokeStart", enemyUnit: 0 }]);
    expect(ofType(ftick(s, [0, { t: "rotate", dir: "cw" }]), "dropped").length).toBe(1);
  });

  it("3 秒で届かなければ失敗", () => {
    const { s } = setup();
    ftick(s, [0, { t: "pokeStart", enemyUnit: 0 }]);
    const ev = idle(s, 60);
    expect(ofType(ev, "pokeEnd")[0]).toMatchObject({ result: "fail" });
  });

  it("相手が回して下げたら止まる", () => {
    const { s } = setup();
    ftick(s, [0, { t: "pokeStart", enemyUnit: 0 }]);
    const ev = ftick(s, [1, { t: "rotate", dir: "ccw" }]); // 位置 0 → 5
    expect(ofType(ev, "pokeEnd")[0]).toMatchObject({ result: "stopped" });
  });
});

describe("勝敗（§10）", () => {
  it("6体全員が戦闘不能なら負け", () => {
    const s = battle();
    for (const u of s.players[1].units) u.hp = 0;
    const ev = ftick(s);
    expect(s.outcome).toEqual({ winner: 0, reason: "ko" });
    expect(ofType(ev, "end").length).toBe(1);
  });

  it("5 分でサドンデス：通常攻撃のダメージが 999 になる", () => {
    const s = battle();
    s.tick = 5999;
    freezeAg(s);
    expect(ofType(tick(s), "suddenDeath").length).toBe(1);
    freezeAg(s);
    const p = s.players[0];
    p.units[0].ag = agNeeded(p, p.units[0]);
    p.units[0].nature = "fierce";
    const dmg = ofType(tick(s), "damage");
    expect(dmg.length).toBe(1);
    expect(dmg[0].amount).toBe(999);
  });

  it("前衛が全滅したら、ホイールが半周して後衛が前に出る", () => {
    const s = battle();
    for (const i of [0, 1, 2]) s.players[1].units[i].hp = 0;
    const ev = ftick(s);
    expect(ofType(ev, "forcedRotate").length).toBe(1);
    expect(s.players[1].wheel).toEqual([3, 4, 5, 0, 1, 2]);
    expect(s.outcome).toBeNull();
  });

  it("時間切れは残り HP の割合の合計で決める", () => {
    const s = battle();
    s.tick = 7199;
    s.players[0].units[0].hp = 1;
    ftick(s);
    expect(s.outcome).toEqual({ winner: 1, reason: "time" });
  });

  it("身代わり人形は HP 1 で1回だけ耐える", () => {
    const team = [{ unit: "oni" }, { unit: "yukionna" }, { unit: "kappa" }, ...TEAM_A.slice(3)];
    const foe = [{ unit: "tengu", equipment: "stand_in_doll" as const }, ...TEAM_B.slice(1)];
    const s = battle(3, team, foe);
    s.players[1].units[0].hp = 5;
    ftick(s, [0, { t: "target", enemyUnit: 0 }]); // 天狗を狙う
    s.players[0].units[1].sg = 1000;
    ftick(s, [0, { t: "ultStart", allySlot: 1, grand: false }]);
    const ev = ftick(s, [0, { t: "ultRelease" }]);
    expect(ofType(ev, "doll").length).toBe(1);
    expect(s.players[1].units[0].hp).toBe(1);
  });
});
