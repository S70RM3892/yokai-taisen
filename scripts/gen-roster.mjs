// 原作と同じ数（396体）・同じ分布のオリジナル妖怪を作る。
//   node scripts/gen-roster.mjs
// 出力：src/core/roster.gen.ts（戦闘のデータ）と src/web/looks.gen.ts（見た目・セリフ）
//
// 原作から使うのは「数と分布」だけ（種族×ランクの数、ランクごとのステータスの平均、種族ごとの偏り）。
// 名前・絵・1体ずつのステータスは原作と対応させない（CLAUDE.md の IP の決まり）。
// 出典：攻略大百科の妖怪一覧（396体）を集計した値（docs/UNITS.md「全体の数と分布」）。

import { writeFileSync } from "node:fs";

// ---- 原作の集計（docs/UNITS.md に同じ表を載せる） ----
const RANKS = ["S", "A", "B", "C", "D", "E"];
/** 種族×ランクの数（原作の種族を本作の種族に置きかえた） */
const COUNTS = {
  takeru: [9, 9, 12, 7, 7, 5], // 原作のイサマシ
  miyabi: [8, 10, 10, 6, 6, 6], // ウスラカゲ
  tsuwamono: [11, 9, 10, 5, 7, 6], // ゴーケツ
  shizume: [7, 8, 11, 7, 7, 3], // ニョロロン
  ayashi: [8, 8, 6, 9, 9, 6], // フシギ
  tatari: [6, 9, 9, 6, 7, 8], // ブキミー
  kage: [9, 16, 15, 7, 8, 4], // プリチー
  nagomi: [7, 9, 9, 5, 8, 7], // ポカポカ
  maga: [5, 2, 2, 3, 3, 0], // 怪魔
};
/** ランクごとの平均（HP, ATK, SPA, DEF, SPD）。原作のレベル60 */
const RANK_MEAN = {
  S: [288, 120, 124, 111, 124],
  A: [252, 110, 111, 102, 113],
  B: [243, 101, 102, 96, 105],
  C: [231, 94, 93, 84, 100],
  D: [215, 83, 86, 81, 91],
  E: [195, 77, 76, 70, 94],
};
/** 種族ごとの平均（全体の平均との比を偏りに使う） */
const TRIBE_MEAN = {
  takeru: [251, 127, 77, 87, 97],
  miyabi: [231, 104, 101, 91, 107],
  tsuwamono: [262, 104, 80, 121, 90],
  shizume: [238, 96, 103, 93, 105],
  ayashi: [232, 76, 121, 84, 106],
  tatari: [228, 89, 107, 88, 108],
  kage: [236, 100, 104, 90, 117],
  nagomi: [228, 94, 107, 88, 106],
  maga: [309, 123, 131, 93, 133],
};
const ALL_MEAN = [240, 100, 101, 93, 106];

// ---- 決定論の小さな乱数（生成を何度やっても同じ結果にする） ----
let seed = 0x5eed1234;
function rnd() {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
function weighted(obj) {
  const entries = Object.entries(obj);
  let total = entries.reduce((a, [, w]) => a + w, 0);
  let x = rnd() * total;
  for (const [k, w] of entries) {
    x -= w;
    if (x < 0) return k;
  }
  return entries[0][0];
}

// ---- 名前のもと（民間伝承の妖怪。原作のキャラ名は使わない） ----
const BASES = {
  takeru: ["茨木童子", "星熊童子", "金熊童子", "虎熊童子", "熊童子", "牛頭", "馬頭", "羅刹", "夜叉", "悪路王", "温羅", "宿儺", "手長", "足長", "大百足", "山男", "山爺", "鬼熊", "猪笹王", "力坊", "岩鬼", "鉄鬼", "荒獅子", "猩々", "狒々", "雷鬼"],
  ayashi: ["狐火", "釣瓶火", "不知火", "竜灯", "天火", "叢原火", "古籠火", "青行灯", "陰摩羅鬼", "雷獣", "鵺", "管狐", "白蔵主", "妖狐", "葛の葉", "覚", "件", "野狐", "天狐", "空狐", "気狐", "蓑火", "宗源火", "姥ヶ火", "火取魔"],
  tsuwamono: ["塗仏", "大入道", "見上げ入道", "牛打ち坊", "石妖", "夜泣き石", "殺生石", "岩魚坊主", "大座頭", "山地乳", "野槌", "蟹坊主", "栄螺鬼", "鉄鼠", "大亀", "鎧武者", "埴輪武者", "石塔", "岩坊主", "甲羅鬼", "瓦鬼", "門番鬼", "蔵守", "土偶"],
  kage: ["烏天狗", "木の葉天狗", "以津真天", "飛縁魔", "風狸", "すねこすり", "送り犬", "送り狼", "狢", "飯綱", "片輪車", "朧車", "輪入道", "鎌風", "疾風丸", "韋駄天狐", "野鉄砲", "野衾", "隼人", "夜雀", "通り悪魔", "隙間風", "一本だたら", "旋風", "雷鳥", "鼬", "雲雀坊", "早駆け"],
  nagomi: ["福の神", "竈神", "蔵ぼっこ", "雨降り小僧", "豆腐小僧", "狸囃子", "豆狸", "小豆洗い", "枕返し", "家鳴り", "天女", "羽衣", "花の精", "桃の精", "吉兆鳥", "霊芝", "若水", "湯の精", "茶釜狸", "鈴の精", "杓子", "白兎", "縁結び", "春告げ"],
  miyabi: ["化け猫", "五徳猫", "化け草履", "琴古主", "琵琶牧々", "三味長老", "瀬戸大将", "鳴釜", "払子守", "木魚達磨", "面霊気", "文車妖妃", "白粉婆", "お歯黒べったり", "高女", "二口女", "飛頭蛮", "化け提灯", "鏡の精", "硯の魂", "暮露暮露団", "沓頬", "狐の嫁入り", "化け傘"],
  tatari: ["土蜘蛛", "絡新婦", "姑獲鳥", "怨霊", "生霊", "死霊", "骨女", "餓鬼", "目目連", "蛇帯", "縊鬼", "逆柱", "橋姫", "清姫", "七人ミサキ", "がしゃどくろ", "泥田坊", "夜行", "首切れ馬", "黒坊主", "毛倡妓", "野寺坊", "魍魎", "疫病神"],
  shizume: ["獏", "八咫烏", "守宮", "石敢當", "道祖神", "霊亀", "白蛇", "大鯰", "蛟", "人魚", "共潜き", "磯女", "濡れ女", "海和尚", "神鹿", "狛狐", "鎮守", "岩戸", "井守", "沼の主", "瀬織", "水神", "注連守"],
  maga: ["大禍津", "禍神", "黄泉醜女", "常闇", "大魔縁", "天魔", "夜刀神", "黄泉軍", "無明", "祟り神", "滅鬼", "虚空"],
};
const ELDER = ["大", "古", "真", "頭領・", "王"];
const YOUNG = ["子", "小", "豆"];

// ---- 型（対戦で流行った型を S・A に優先して入れる） ----
/** 種族ごとの型の重み（ふつう） */
const ROLE_POOL = {
  takeru: { striker: 6, endureWall: 1, guardian: 1, drainer: 2 },
  ayashi: { caster: 6, disruptorStatus: 1, buffer: 1 },
  tsuwamono: { wall: 5, endureWall: 2, guardian: 2, taunter: 1 },
  kage: { striker: 5, buffer: 2, dodger: 2, scapegoat: 1 },
  nagomi: { healer: 5, buffer: 3 },
  miyabi: { disruptorStat: 5, buffer: 1, dodger: 1 },
  tatari: { disruptorStatus: 5, drainer: 2, caster: 1 },
  shizume: { dodger: 2, taunter: 2, wall: 2, healer: 1, scapegoat: 1 },
  maga: { striker: 2, caster: 2, wall: 1, disruptorStatus: 1 },
};
/** S・A では、流行った型の重みを足す（出典：たくトンボ・マグロの記事の環境の編成） */
const META_BONUS = {
  wall: 3, endureWall: 3, dodger: 2, guardian: 2, buffer: 3, healer: 2, disruptorStatus: 2, striker: 2, scapegoat: 1,
};

const ELEMENTS = ["fire", "water", "thunder", "earth", "ice", "wind"];
const ROLE_SHAPE = {
  // HP, ATK, SPA, DEF, SPD の倍率
  striker: [0.92, 1.25, 0.8, 0.85, 1.12],
  caster: [0.95, 0.72, 1.3, 0.9, 1.05],
  wall: [1.15, 0.95, 0.75, 1.35, 0.8],
  endureWall: [1.22, 0.9, 0.85, 1.15, 0.85],
  guardian: [1.15, 1.0, 0.8, 1.2, 0.85],
  taunter: [1.18, 0.9, 0.85, 1.2, 0.85],
  buffer: [1.05, 0.85, 1.05, 0.95, 1.12],
  healer: [1.0, 0.72, 1.18, 1.05, 1.0],
  disruptorStat: [1.0, 0.95, 1.05, 0.95, 1.05],
  disruptorStatus: [1.0, 0.85, 1.12, 0.95, 1.05],
  dodger: [0.98, 0.95, 1.0, 0.95, 1.15],
  scapegoat: [1.0, 1.05, 0.95, 1.0, 1.0],
  drainer: [1.02, 1.15, 0.95, 0.95, 1.0],
};
const ROLE_NATURE = {
  striker: ["fierce", "wild"],
  caster: ["arcane"],
  wall: ["stalwart"],
  endureWall: ["stalwart", "careful"],
  guardian: ["stalwart", "balanced"],
  taunter: ["stalwart", "devoted"],
  buffer: ["devoted"],
  healer: ["devoted"],
  disruptorStat: ["hinder"],
  disruptorStatus: ["hinder"],
  dodger: ["careful", "balanced"],
  scapegoat: ["balanced", "wild"],
  drainer: ["wild", "fierce"],
};
const ROLE_TRAITS = {
  striker: ["critEye", "guardBreak", "conqueror", "firstStrike", "rage"],
  caster: ["ADEPT"],
  wall: ["keystone", "ironGuard", "thorns", "unbreakable"],
  endureWall: ["endure", "doubleEndure"],
  guardian: ["guardian"],
  taunter: ["ironGuard", "unbreakable", "thorns"],
  buffer: ["spiritSmoke", "tailwind", "firstStrike"],
  healer: ["prayer", "benchHeal", "prayer"],
  disruptorStat: ["curseMaster", "hidden", "mirror"],
  disruptorStatus: ["curseMaster", "grudge", "hidden"],
  dodger: ["ultEvade", "hidden"],
  scapegoat: ["scapegoat"],
  drainer: ["drain", "devour"],
};
const ROLE_CURSE = {
  striker: ["brittle", "weaken"],
  caster: ["weaken", "seal"],
  wall: ["slow", "brittle"],
  endureWall: ["slow"],
  guardian: ["brittle"],
  taunter: ["slow"],
  buffer: ["slow", "seal"],
  healer: ["weaken", "slow"],
  disruptorStat: ["slow", "weaken", "brittle"],
  disruptorStatus: ["stun", "confuse", "poison", "seal"],
  dodger: ["slow", "confuse"],
  scapegoat: ["brittle", "weaken"],
  drainer: ["poison"],
};
const ROLE_BLESS = {
  striker: ["rally", "haste"],
  caster: ["gather", "rally"],
  wall: ["fortify", "taunt"],
  endureWall: ["fortify", "regen"],
  guardian: ["fortify"],
  taunter: ["taunt"],
  buffer: ["allUp", "rally", "haste", "allUp"],
  healer: ["regen", "ward"],
  disruptorStat: ["gather", "ward"],
  disruptorStatus: ["ward", "gather"],
  dodger: ["ward", "haste"],
  scapegoat: ["allUp", "rally"],
  drainer: ["rally"],
};
const ROLE_MOTION = {
  striker: ["dash", "slash", "pounce", "smash", "charge"],
  caster: ["float", "flicker", "glow"],
  wall: ["slam", "smash"],
  endureWall: ["slam"],
  guardian: ["charge", "slam"],
  taunter: ["hop", "slam"],
  buffer: ["sway", "hop", "wave"],
  healer: ["sway", "glow", "float"],
  disruptorStat: ["spin", "stretch", "sway"],
  disruptorStatus: ["rattle", "flicker", "float"],
  dodger: ["wave", "dash", "float"],
  scapegoat: ["hop", "spin"],
  drainer: ["pounce", "rattle"],
};
const ROLE_LINES = {
  striker: ["覚悟しろ！", "いざ！", "叩き斬る！", "一撃で決める", "遅い！"],
  caster: ["燃え尽きよ", "呪文、発動", "見えぬ力よ", "術を受けよ", "消えなさい"],
  wall: ["ここは通さん", "動かぬぞ", "受けて立つ", "かかってこい"],
  endureWall: ["まだまだ！", "倒れはせん", "しぶといぞ"],
  guardian: ["下がっていろ", "わしが受ける", "守り抜く"],
  taunter: ["こっちだ！", "おれを見ろ", "来い来い！"],
  buffer: ["がんばって！", "力を分けよう", "みんな、いくよ"],
  healer: ["癒やしを", "痛いの飛んでけ", "まだ戦える"],
  disruptorStat: ["化かしてあげる", "ほら、鈍くなれ", "ふふふ…"],
  disruptorStatus: ["動けまい", "惑え…", "祟ってやる"],
  dodger: ["当たらないよ", "ひらりっと", "見切った"],
  scapegoat: ["任せた！", "よろしく〜", "身代わり頼む"],
  drainer: ["いただくぞ", "吸い尽くす", "腹が減った"],
};

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

// ---- 既存の手作りの 24 体（種族・ランク）。このマスはその分だけ減らす ----
const EXISTING = {
  takeru: { S: 2, B: 1 },
  ayashi: { S: 1, A: 2, B: 1 },
  tsuwamono: { S: 1, A: 1, B: 2 },
  kage: { S: 1, A: 1, B: 1 },
  nagomi: { B: 2 },
  miyabi: { B: 2 },
  tatari: { A: 1, B: 2 },
  shizume: { A: 1, B: 2 },
  maga: {},
};
const EXISTING_NAMES = new Set(["鬼", "唐傘お化け", "雪女", "猫又", "河童", "大蝦蟇", "化け狸", "ろくろ首", "座敷童子", "木霊", "天狗", "鎌鼬", "酒呑童子", "牛鬼", "大嶽丸", "ぬりかべ", "一反木綿", "鬼火", "火車", "狂骨", "わいら", "狛犬", "山彦", "白澤"]);

const used = new Set(EXISTING_NAMES);
const units = [];
const looks = {};

let serial = 0;
for (const [tribe, counts] of Object.entries(COUNTS)) {
  const bases = BASES[tribe].slice();
  // 系統（同じもとの名前）ごとに、子ども・ふつう・長 の3段を作る
  const tierUse = { high: 0, mid: 0, low: 0 };
  const nameFor = (rank) => {
    const tier = rank === "S" || rank === "A" ? "high" : rank === "B" || rank === "C" ? "mid" : "low";
    for (let tries = 0; tries < 400; tries++) {
      const i = tierUse[tier]++ % bases.length;
      const base = bases[i];
      const round = Math.floor((tierUse[tier] - 1) / bases.length);
      let name;
      if (tier === "mid") name = round === 0 ? base : `${["白", "黒", "朱", "蒼"][round - 1] ?? "新"}${base}`;
      else if (tier === "high") {
        let p = ELDER[(i + round) % ELDER.length];
        // 「大大入道」「悪路王王」のような重なりを避ける
        if (p === "大" && base.startsWith("大")) p = "古";
        if (p === "王" && /王$/.test(base)) p = "真";
        if (p === "頭領・" && /(将|王)$/.test(base)) p = "古";
        name = p === "王" ? `${base}王` : p === "頭領・" ? `${base}大将` : `${p}${base}`;
      } else name = `${YOUNG[(i + round) % YOUNG.length]}${base}`;
      if (!used.has(name)) {
        used.add(name);
        return { name, family: base, form: tier === "high" ? 2 : tier === "mid" ? 1 : 0 };
      }
    }
    throw new Error("no name for " + tribe + rank);
  };

  RANKS.forEach((rank, ri) => {
    const n = counts[ri] - (EXISTING[tribe][rank] ?? 0);
    for (let k = 0; k < n; k++) {
      const { name, family, form } = nameFor(rank);
      const pool = { ...ROLE_POOL[tribe] };
      if (rank === "S" || rank === "A") for (const [r, w] of Object.entries(META_BONUS)) if (r in pool || tribe === "maga") pool[r] = (pool[r] ?? 0) + w;
      const role = weighted(pool);
      // ステータス：ランクの平均 × 種族の偏り × 型の形 × 少しのばらつき
      const shape = ROLE_SHAPE[role];
      const raw = RANK_MEAN[rank].map((m, i) => m * (TRIBE_MEAN[tribe][i] / ALL_MEAN[i]) * shape[i] * (0.94 + rnd() * 0.12));
      // 型は配分を変えるだけで、合計はランク相応に戻す（HP は別）
      const base = RANK_MEAN[rank].slice(1).reduce((a, b) => a + b, 0) * (tribe === "maga" ? 1.12 : 1);
      const sum = raw.slice(1).reduce((a, b) => a + b, 0);
      const st = raw.map((x, i) => (i === 0 ? x : (x * base) / sum));
      const [hp, atk, spa, def, spd] = [
        clamp(Math.round(st[0]), 150, 470),
        clamp(Math.round(st[1]), 30, 205),
        clamp(Math.round(st[2]), 30, 200),
        clamp(Math.round(st[3]), 40, 200),
        clamp(Math.round(st[4]), 45, 195),
      ];
      const skillElement = pick(ELEMENTS);
      const others = ELEMENTS.filter((e) => e !== skillElement);
      const weak = pick(others);
      const resist = rnd() < 0.8 ? pick(others.filter((e) => e !== weak)) : null;
      const sgRank = clamp({ S: 2, A: 3, B: 4, C: 5, D: 5, E: 6 }[rank] + (role === "healer" || role === "buffer" ? 1 : 0) - (role === "striker" && rank === "S" ? 1 : 0), 1, 6);
      const attackPower = role === "striker" || role === "drainer" ? pick([110, 120, 135, 150]) : role === "wall" || role === "guardian" ? pick([67, 90, 112]) : pick([45, 67, 90]);
      const skillPower = rank === "S" || rank === "A" ? 120 : rank === "B" || rank === "C" ? 110 : 90;
      let trait = pick(ROLE_TRAITS[role]);
      if (trait === "ADEPT") trait = `${skillElement}Adept`;
      if (trait === "doubleEndure" && !(rank === "S" || rank === "A")) trait = "endure";
      const curse = pick(ROLE_CURSE[role]);
      const blessing = pick(ROLE_BLESS[role]);
      const stat = atk >= spa ? "atk" : "spa";
      const bigPower = rank === "S" ? 180 : undefined;
      let ult;
      if (role === "healer" || (role === "endureWall" && rnd() < 0.4)) ult = { kind: "heal" };
      else if (role === "buffer") ult = { kind: "blessAll", blessing };
      else if (role === "disruptorStat" || role === "disruptorStatus") ult = rnd() < 0.6 ? { kind: "curseAll", curse } : { kind: "all", stat, element: skillElement };
      else if (role === "wall" || role === "guardian" || role === "taunter") ult = rnd() < 0.5 ? { kind: "blessAll", blessing: "fortify" } : { kind: "break", stat: "atk", element: null };
      else if (role === "caster") ult = rnd() < 0.55 ? { kind: "all", stat: "spa", element: skillElement } : { kind: "single", stat: "spa", element: skillElement, ...(bigPower ? { power: bigPower } : {}) };
      else ult = rnd() < 0.7 ? { kind: "single", stat, element: rnd() < 0.5 ? skillElement : null, ...(bigPower ? { power: bigPower } : {}) } : { kind: "all", stat, element: skillElement };
      const id = `g${String(++serial).padStart(3, "0")}`;
      const ultWords = {
        single: ["一閃", "大撃", "穿ち", "断ち", "奥の手"],
        all: ["嵐", "総崩し", "大渦", "百鬼の舞", "群れ打ち"],
        break: ["砕き", "割り", "崩し"],
        heal: ["癒やしの雨", "息吹", "恵み"],
        curseAll: ["呪い撒き", "禍の霧", "惑わし"],
        blessAll: ["後押し", "祝い", "鼓舞の陣"],
      };
      const ultName = `${family.slice(0, 2)}${pick(ultWords[ult.kind])}`;
      units.push({
        id, name, rank, tribe, hp, atk, spa, def, spd, sgRank, weak, resist, attackPower, skillElement, skillPower,
        curse, blessing, ult, ultName, loafPermil: 25, defaultNature: pick(ROLE_NATURE[role]), trait, role,
      });
      looks[id] = {
        family,
        form,
        role,
        motion: pick(ROLE_MOTION[role]),
        line: pick(ROLE_LINES[role]),
        pitch: Math.round(clamp(520 - form * 120 - (hp - 200) * 0.6 + rnd() * 80, 90, 700)),
        seed: Math.floor(rnd() * 1e9),
      };
    }
  });
}

// ---- 書き出し ----
const header = `// 自動生成（scripts/gen-roster.mjs）。手で直さない。\n// 原作と同じ数・同じ分布のオリジナル妖怪（${units.length} 体）。名前・絵・1体ずつのステータスは原作と対応しない。\n`;
const coreRows = units.map(({ role, ...u }) => `  ${JSON.stringify(u)},`).join("\n");
writeFileSync(
  "src/core/roster.gen.ts",
  `${header}\nimport type { UnitDef } from "./data.js";\n\nexport const GENERATED_UNITS: UnitDef[] = [\n${coreRows}\n] as UnitDef[];\n`,
);
writeFileSync(
  "src/web/looks.gen.ts",
  `${header}\nimport type { MotionKind } from "./motion.js";\n\nexport interface Look {\n  family: string;\n  form: number;\n  role: string;\n  motion: MotionKind;\n  line: string;\n  pitch: number;\n  seed: number;\n}\n\nexport const LOOKS: Record<string, Look> = ${JSON.stringify(looks, null, 0)} as Record<string, Look>;\n`,
);
const byRole = {};
for (const u of units) byRole[u.role] = (byRole[u.role] ?? 0) + 1;
console.log(`generated ${units.length} units (+24 = ${units.length + 24})`, byRole);
