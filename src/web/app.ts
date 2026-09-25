// ブラウザ版の試作（P2）：人 vs CPU。四角と文字だけの見た目（UI_SPEC.md）。
// 戦闘の中身は src/core（決定論）。ここは描画と入力だけ。

import {
  type BattleEvent,
  type BattleState,
  createBattle,
  cpuThink,
  createCpu,
  type Cpu,
  formationPermil,
  hpRatio,
  type Input,
  isAlive,
  natureById,
  pickEnemyTarget,
  type PlayerInput,
  stepInPlace,
  type TeamSpec,
  TRAIT_NAMES,
  type UnitState,
  UNITS,
  validateTeam,
} from "../core/index.js";
import * as C from "../core/constants.js";
import { createStream, nextU32 } from "../core/rng.js";
import { randomTeam } from "../sim/teamgen.js";
import { artSvg } from "./art.js";
import * as M from "./motion.js";
import { BattleScene } from "./scene.js";
import * as S from "./sound.js";

const TRIBE_COLOR: Record<string, string> = {
  takeru: "#d9644a", ayashi: "#8a6ee0", tsuwamono: "#8f8a74", kage: "#4f9fb8",
  nagomi: "#6fbf73", miyabi: "#d48ac0", tatari: "#7d5a9e", shizume: "#5f88c9", maga: "#b0303a",
};

// 最初に画面を触ったときに音を使えるようにする（ブラウザの決まり）
for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, () => S.unlockAudio(), { capture: true });

/** 音の操作（効果音の ON/OFF と、手元の曲ファイルを BGM にする） */
function audioBar(): HTMLElement {
  const bar = h("div", "audio row");
  const mute = h("button", "btn small", S.isMuted() ? "音：OFF" : "音：ON");
  mute.onclick = () => {
    S.setMuted(!S.isMuted());
    mute.textContent = S.isMuted() ? "音：OFF" : "音：ON";
  };
  const label = h("label", "btn small", "BGM を選ぶ");
  label.htmlFor = "bgm-file";
  const file = h("input") as HTMLInputElement;
  file.type = "file";
  file.id = "bgm-file";
  file.accept = "audio/*";
  file.hidden = true;
  const name = h("span", "muted small", bgmName || "BGM なし");
  file.onchange = () => {
    const f = file.files?.[0];
    if (!f) return;
    S.unlockAudio();
    bgmName = S.playBgmFile(f);
    name.textContent = `♪ ${bgmName}`;
  };
  const vol = h("input") as HTMLInputElement;
  vol.type = "range";
  vol.id = "bgm-volume";
  vol.min = "0";
  vol.max = "100";
  vol.value = "35";
  vol.title = "BGM の音量";
  vol.oninput = () => S.setBgmVolume(Number(vol.value) / 100);
  bar.append(mute, label, file, vol, name);
  return bar;
}
let bgmName = "";

const TRIBE: Record<string, string> = {
  takeru: "猛", ayashi: "怪", tsuwamono: "剛", kage: "影", nagomi: "和", miyabi: "雅", tatari: "祟", shizume: "鎮", maga: "禍",
};
const ELEMENT: Record<string, string> = { fire: "火", water: "水", thunder: "雷", earth: "土", ice: "氷", wind: "風" };
const CURSE: Record<string, string> = { slow: "鈍重", weaken: "衰弱", brittle: "脆化", poison: "蝕毒", seal: "封気", stun: "行動停止", confuse: "混乱" };
const BLESS: Record<string, string> = { rally: "鼓舞", fortify: "堅護", haste: "疾風", gather: "集気", regen: "再生", ward: "浄気", allUp: "万全", taunt: "挑発" };
const ACTION: Record<string, string> = { attack: "攻撃", skill: "術", guard: "守り", curse: "呪付", bless: "加護", loaf: "なまけ" };
const TIER: string[] = ["", "（超）", "（究極）"];

const app = document.getElementById("app")!;
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
};
const secs = (ticks: number) => (ticks / C.TICKS_PER_SEC).toFixed(1);
const def = (u: UnitState) => UNITS[u.defIndex];

// =====================================================================
// 編成画面
// =====================================================================

/** 編成の6つの枠（位置 0〜5。0〜2 が前衛）。空きは null */
let picked: (string | null)[] = [null, null, null, null, null, null];
const pickedIds = () => picked.filter((x): x is string => x !== null);

function randomSeed(): number {
  // 試合のシードは画面側で決める（戦闘コアの中では Math.random を使わない）
  return (Math.random() * 0x100000000) >>> 0;
}

function randomUnitIds(seed: number): string[] {
  return randomTeam(createStream(seed, 77)).map((m) => m.unit);
}

function showSetup(): void {
  app.replaceChildren();
  const title = h("h1", "", "妖怪大戦");
  title.append(h("small", "", "試作版（人 vs CPU）"));
  app.append(title, audioBar());

  let sel = picked.findIndex((x) => x === null);
  if (sel < 0) sel = 0;
  let moveFrom: number | null = null;
  let moving = false;
  let showList = true;

  const root = h("section", "builder");
  const head = h("div", "b-head");
  head.append(h("span", "b-tag", "編成"), h("span", "b-sub", "対戦に出す6体とホイールの並び"));
  const left = h("div", "b-left");
  const center = h("div", "b-center");
  const right = h("div", "b-right");
  const bar = h("div", "b-bar");
  root.append(head, left, center, right, bar);

  // ---- 左：公式ルールの枠とマイセット ----
  const rules = h("div", "b-rules");
  const sets = h("div", "b-sets");
  left.append(rules, sets);

  // ---- 真ん中：ホイール（6つのメダル枠、中央に前／後） ----
  const wheel = svgEl("svg", { class: "b-wheel", viewBox: "-160 -160 320 320" });
  wheel.innerHTML =
    '<defs><radialGradient id="bw" cx="50%" cy="45%"><stop offset="0" stop-color="#3a3f66"/><stop offset="1" stop-color="#1a1d33"/></radialGradient>' +
    '<linearGradient id="bf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2c96a"/><stop offset="1" stop-color="#c98f3a"/></linearGradient>' +
    '<linearGradient id="bb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a6aa8"/><stop offset="1" stop-color="#4a3f78"/></linearGradient></defs>' +
    '<circle r="156" fill="url(#bw)" stroke="#0c0f19" stroke-width="4"/>' +
    '<path d="M-156 0 A156 156 0 0 1 156 0 L60 0 A60 60 0 0 0 -60 0Z" fill="url(#bf)" opacity=".35"/>' +
    '<path d="M-156 0 A156 156 0 0 0 156 0 L60 0 A60 60 0 0 1 -60 0Z" fill="url(#bb)" opacity=".35"/>';
  const medals = svgEl("g");
  wheel.append(medals);
  const hub = svgEl("g", { class: "b-hub" });
  hub.innerHTML =
    '<circle r="52" fill="#10131f" stroke="#e9d9a8" stroke-width="4"/>' +
    '<path d="M-52 0 A52 52 0 0 1 52 0Z" fill="#b8742a"/><path d="M-52 0 A52 52 0 0 0 52 0Z" fill="#3f6f9e"/>' +
    '<line x1="-52" x2="52" y1="0" y2="0" stroke="#e9d9a8" stroke-width="3"/>' +
    '<text y="-14" text-anchor="middle" class="b-hub-t">前</text><text y="34" text-anchor="middle" class="b-hub-t">後</text>';
  wheel.append(hub);
  const rotL = h("button", "b-shoulder l", "⟲ 回す");
  const rotR = h("button", "b-shoulder r", "回す ⟳");
  const rotate = (d: number) => {
    const n = picked.slice();
    picked = n.map((_, pos) => n[(pos - d + 6) % 6]);
    sel = (sel + d + 6) % 6;
    refresh();
  };
  rotL.onclick = () => rotate(-1);
  rotR.onclick = () => rotate(1);
  const wrapWheel = h("div", "b-wheelwrap");
  wrapWheel.append(wheel, rotL, rotR);
  const status = h("div", "b-status");
  center.append(wrapWheel, status);

  // ---- 右：選ぶリスト／くわしく ----
  const list = h("div", "b-list");
  const detail = h("div", "b-detail");
  right.append(list, detail);

  // ---- 下：ボタン ----
  const bBack = h("button", "b-btn", "もどす");
  bBack.title = "選んでいる枠を空にする（Backspace）";
  const bMove = h("button", "b-btn", "いどう");
  bMove.title = "2つの枠を入れ替える（M）";
  const bSwitch = h("button", "b-btn", "きりかえ");
  bSwitch.title = "リストとくわしい情報を切り替える（Tab）";
  const bAuto = h("button", "b-btn", "おまかせ");
  const bGo = h("button", "b-btn go", "けってい");
  bGo.title = "この6体で対戦する（Enter）";
  bar.append(bBack, bMove, bSwitch, bAuto, bGo);

  const unitDef = (id: string | null) => (id ? UNITS.find((u) => u.id === id)! : null);

  function place(id: string): void {
    picked[sel] = id;
    const next = picked.findIndex((x) => x === null);
    if (next >= 0) sel = next;
    refresh();
  }

  function refresh(): void {
    // メダル
    medals.replaceChildren();
    for (let pos = 0; pos < 6; pos++) {
      const [x, y] = polar(-150 + pos * 60, 104);
      const g = svgEl("g", { class: "b-medal" + (pos === sel ? " sel" : "") + (moveFrom === pos ? " moving" : "") + (pos < 3 ? " front" : "") });
      const d = unitDef(picked[pos]);
      g.append(svgEl("circle", { cx: x, cy: y, r: 42, class: "b-ring" }));
      g.append(svgEl("circle", { cx: x, cy: y, r: 36, class: "b-face", fill: d ? TRIBE_COLOR[d.tribe] : "#262a42" }));
      if (d) {
        const art = svgEl("g");
        art.innerHTML = artSvg(d.id, d.name.slice(0, 1)).replace('width="100%" height="100%"', `x="${x - 32}" y="${y - 32}" width="64" height="64"`);
        g.append(art);
        const rk = svgEl("text", { x: x + 28, y: y - 26, class: "b-rank r" + d.rank, "text-anchor": "middle" });
        rk.textContent = d.rank;
        g.append(rk);
      } else {
        const t = svgEl("text", { x, y: y + 6, "text-anchor": "middle", class: "b-empty" });
        t.textContent = "＋";
        g.append(t);
      }
      g.addEventListener("click", () => {
        if (moving) {
          if (moveFrom === null) moveFrom = pos;
          else {
            [picked[moveFrom], picked[pos]] = [picked[pos], picked[moveFrom]];
            moveFrom = null;
            moving = false;
          }
        } else sel = pos;
        refresh();
      });
      medals.append(g);
    }

    // 公式ルールの枠（S・S・A・A）
    const ids = pickedIds();
    const count = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0 };
    let ogres = 0;
    for (const id of ids) {
      const d = unitDef(id)!;
      count[d.rank]++;
      if (d.group) ogres++;
    }
    const box = (rank: "S" | "A", i: number) =>
      `<span class="b-rk r${rank} ${count[rank] > i ? "used" : ""} ${count[rank] > 2 && i === 1 ? "over" : ""}">${rank}</span>`;
    rules.innerHTML =
      '<div class="b-rules-t">公式ルール</div>' +
      `<div class="b-rules-row">ランク ${box("S", 0)}${box("S", 1)}${box("A", 0)}${box("A", 1)}</div>` +
      '<div class="b-rules-note">まで OK（B は何体でも）</div>' +
      `<div class="b-rules-row">大物 <span class="b-rk ogre ${ogres >= 1 ? "used" : ""} ${ogres > 1 ? "over" : ""}">1</span> まで</div>`;

    // マイセット
    sets.replaceChildren(h("div", "b-rules-t", "マイセット"));
    for (let k = 0; k < 3; k++) {
      const saved = loadSet(k);
      const row = h("div", "b-set");
      const load = h("button", "b-mini", saved ? saved.map((id) => (unitDef(id)?.name ?? "?").slice(0, 2)).join("・") : `セット ${k + 1}（空き）`);
      load.disabled = !saved;
      load.onclick = () => {
        if (!saved) return;
        picked = saved.slice();
        refresh();
      };
      const save = h("button", "b-mini save", "保存");
      save.disabled = ids.length !== 6;
      save.onclick = () => {
        saveSet(k, picked as string[]);
        refresh();
      };
      row.append(load, save);
      sets.append(row);
    }

    // 状態
    const errs = ids.length === 6 ? validateTeam(ids.map((unit) => ({ unit }))) : [];
    status.textContent = moving
      ? moveFrom === null
        ? "いどう：1つめの枠を選ぶ"
        : "いどう：入れ替える枠を選ぶ"
      : ids.length < 6
        ? `あと ${6 - ids.length} 体（${sel < 3 ? "前衛" : "後衛"}の枠を選択中）`
        : errs.length
          ? errs.join(" / ")
          : "この6体で対戦できる";
    status.classList.toggle("bad", errs.length > 0);
    bGo.disabled = ids.length !== 6 || errs.length > 0;
    bMove.classList.toggle("on", moving);

    // リスト（ランクと大物の制限で入れられないものは暗く）
    list.hidden = !showList;
    detail.hidden = showList;
    if (showList) {
      list.replaceChildren();
      const cur = unitDef(picked[sel]);
      for (const d of UNITS) {
        const trial = picked.slice();
        trial[sel] = d.id;
        const bad = validateTeam(trial.filter((x): x is string => x !== null).map((unit) => ({ unit })).concat(
          Array.from({ length: 6 - trial.filter((x) => x).length }, () => ({ unit: "karakasa" })),
        )).length > 0;
        const b = h("button", "b-item" + (bad ? " ng" : "") + (cur?.id === d.id ? " cur" : ""));
        const pic = h("span", "b-pic");
        pic.innerHTML = artSvg(d.id, d.name.slice(0, 1));
        pic.style.background = TRIBE_COLOR[d.tribe];
        b.append(pic, h("span", "b-nm", d.name), h("span", "b-r r" + d.rank, d.group ? "大" : d.rank));
        b.title = `${d.name}（${d.rank}・${TRIBE[d.tribe]}）特性：${TRAIT_NAMES[d.trait]}`;
        b.onclick = () => place(d.id);
        list.append(b);
      }
    } else {
      const d = unitDef(picked[sel]);
      detail.innerHTML = d
        ? `<div class="b-dhead"><span class="b-dpic" style="background:${TRIBE_COLOR[d.tribe]}">${artSvg(d.id, "")}</span>` +
          `<div><b>${d.name}</b> <span class="rank ${d.rank}">${d.group ? d.rank + "・大物" : d.rank}</span><br>` +
          `<span class="tag">${TRIBE[d.tribe]}・${natureById(d.defaultNature).name}</span></div></div>` +
          `<div class="trait">特性：${TRAIT_NAMES[d.trait]}</div>` +
          `<div class="stats num">HP ${d.hp}　ATK ${d.atk}　SPA ${d.spa}<br>DEF ${d.def}　SPD ${d.spd}　妖気 ${d.sgRank}</div>` +
          `<div class="stats">術：${ELEMENT[d.skillElement]} ${d.skillPower}　通常攻撃 ${d.attackPower}</div>` +
          `<div class="stats">奥義：${d.ultName}</div>` +
          `<div class="stats">弱点 ${d.weak ? ELEMENT[d.weak] : "なし"}・耐性 ${d.resist ? ELEMENT[d.resist] : "なし"}</div>`
        : '<div class="muted">この枠は空き。「きりかえ」でリストに戻って選ぶ。</div>';
    }
  }

  bBack.onclick = () => {
    picked[sel] = null;
    refresh();
  };
  bMove.onclick = () => {
    moving = !moving;
    moveFrom = null;
    refresh();
  };
  bSwitch.onclick = () => {
    showList = !showList;
    refresh();
  };
  bAuto.onclick = () => {
    picked = randomUnitIds(randomSeed());
    refresh();
  };
  bGo.onclick = () => {
    if (!bGo.disabled) {
      document.removeEventListener("keydown", keys);
      startBattle(pickedIds().map((unit) => ({ unit })));
    }
  };
  const keys = (e: KeyboardEvent) => {
    if (view) return;
    if (e.key === "Enter") bGo.click();
    else if (e.key === "Tab") {
      e.preventDefault();
      bSwitch.click();
    } else if (e.key.toLowerCase() === "m") bMove.click();
    else if (e.key === "Backspace") bBack.click();
    else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "q") rotate(-1);
    else if (e.key === "ArrowRight" || e.key.toLowerCase() === "e") rotate(1);
  };
  document.addEventListener("keydown", keys);

  app.append(
    root,
    h(
      "footer",
      "",
      "配置は本家の編成画面と同じにして、色・絵・言葉はオリジナル。枠を選んで右のリストから入れる。ホイールを回すと最初の並び（前衛・後衛）が変わる。効果音はその場で合成。BGM は手元の曲ファイルをこのブラウザの中だけで流す。",
    ),
  );
  if (pickedIds().length === 0) picked = randomUnitIds(randomSeed());
  refresh();
}

function loadSet(k: number): string[] | null {
  try {
    const raw = localStorage.getItem(`yokai-taisen:set:${k}`);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(v) && v.length === 6 && v.every((x) => typeof x === "string" && UNITS.some((u) => u.id === x)) ? (v as string[]) : null;
  } catch {
    return null;
  }
}

function saveSet(k: number, ids: string[]): void {
  try {
    localStorage.setItem(`yokai-taisen:set:${k}`, JSON.stringify(ids));
  } catch {
    // 保存できない環境では何もしない
  }
}

// =====================================================================
// バトル画面：上は 3D の戦闘、下はホイール（配置は本家と同じ。見た目はオリジナル）
// =====================================================================

interface View {
  state: BattleState;
  cpu: Cpu;
  pending: Input[];
  zero: boolean;
  mode: "none" | "ult" | "purify";
  running: boolean;
  preview: number;
  previewTimer: number | null;
  lastFrame: number;
  acc: number;
  scene: BattleScene;
  refs: Record<string, HTMLElement>;
  svg: Record<string, SVGElement>;
  plates: HTMLElement[];
  foeBars: Map<number, HTMLElement>;
  logEl: HTMLElement;
  called: string;
  wheelKey: string;
}

let view: View | null = null;
/** ドラッグで回した直後のクリックは無視する（奥義や浄化が誤って出ないように） */
let lastDragAt = 0;

const NS = "http://www.w3.org/2000/svg";
const svgEl = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] => {
  const el = document.createElementNS(NS, tag);
  for (const [k, val] of Object.entries(attrs)) el.setAttribute(k, String(val));
  return el;
};
const hex = (c: string) => parseInt(c.replace("#", ""), 16);

function startBattle(team: TeamSpec): void {
  const seed = randomSeed();
  const gen = createStream(seed, 5);
  const cpuTeam: TeamSpec = randomUnitIds(nextU32(gen)).map((unit) => ({ unit }));
  const state = createBattle(seed, team, cpuTeam);
  app.replaceChildren();
  const canvas = h("canvas", "stage");
  const scene = new BattleScene(canvas);
  view = {
    state,
    cpu: createCpu(1, nextU32(gen)),
    pending: [],
    zero: false,
    mode: "none",
    running: true,
    preview: 0,
    previewTimer: null,
    lastFrame: performance.now(),
    acc: 0,
    scene,
    refs: {},
    svg: {},
    plates: [],
    foeBars: new Map(),
    logEl: h("div", "log"),
    called: "",
    wheelKey: "",
  };
  buildBattle(view, canvas);
  log(view, `相手：${cpuTeam.map((m) => UNITS.find((u) => u.id === m.unit)!.name).join("・")}`, "f");
  requestAnimationFrame(frame);
}

function unitOf(v: View, uid: number): UnitState {
  return v.state.players[uid < 6 ? 0 : 1].units[uid % 6];
}

function unitName(v: View, uid: number): string {
  return (uid < 6 ? "" : "敵の") + def(unitOf(v, uid)).name;
}

function log(v: View, text: string, cls = ""): void {
  v.logEl.prepend(h("p", cls, text));
  while (v.logEl.childElementCount > 120) v.logEl.lastElementChild!.remove();
}

function send(v: View, input: Input): void {
  v.pending.push(input);
}

function pct(n: number, d: number): string {
  return `${Math.max(0, Math.min(100, (n * 100) / d))}%`;
}

function frontUids(v: View, pid: 0 | 1): number[] {
  const p = v.state.players[pid];
  return [0, 1, 2].map((pos) => p.units[p.wheel[pos]].uid);
}

// ---- 画面を組み立てる ----

function buildBattle(v: View, canvas: HTMLCanvasElement): void {
  const title = h("h1", "", "妖怪大戦");
  title.append(h("small", "", "試作版"));
  app.append(title, audioBar());
  const game = h("section", "game");

  // 上画面
  const top = h("div", "top3d");
  const hud = h("div", "hud3d");
  const clock = h("div", "clock num");
  const order = h("div", "order");
  const arrows = svgEl("svg", { class: "arrows" });
  const plates = h("div", "plates");
  const fx = h("div", "fx3d");
  hud.append(arrows, clock, order, fx, plates);
  top.append(canvas, hud);
  v.refs = { top, hud, clock, order, plates, fx };
  v.svg = { arrows };
  for (const pid of [0, 1] as const) {
    for (const u of v.state.players[pid].units) {
      v.scene.addFigure(u.uid, pid === 0, artSvg(def(u).id, def(u).name.slice(0, 1)), TRIBE_COLOR[def(u).tribe], M.UNIT_MOTION[def(u).id] ?? "dash");
      if (pid === 1) {
        const bar = h("div", "foebar");
        bar.innerHTML = '<span class="n"></span><div class="bar hp"><i></i></div><div class="fxs"></div>';
        v.foeBars.set(u.uid, bar);
        hud.append(bar);
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    const plate = h("div", "plate");
    plate.innerHTML =
      '<span class="soul"><svg viewBox="0 0 20 24"><path class="soul-bg" d="M10 1 C14 7 19 11 19 16 A9 8 0 0 1 1 16 C1 11 6 7 10 1Z"/><clipPath id="sc' + i + '"><rect class="soul-clip" x="0" y="24" width="20" height="24"/></clipPath><path class="soul-fill" clip-path="url(#sc' + i + ')" d="M10 1 C14 7 19 11 19 16 A9 8 0 0 1 1 16 C1 11 6 7 10 1Z"/></svg></span>' +
      '<span class="pn"></span><div class="bar hp"><i></i></div><div class="fxs"></div>';
    v.plates.push(plate);
    plates.append(plate);
  }
  canvas.addEventListener("click", (e) => onStageClick(v, e));

  // 下画面
  const bottom = h("div", "bottom3d");
  const corners = [
    { cls: "c-tl", key: "bUlt" },
    { cls: "c-tr", key: "bTarget" },
    { cls: "c-bl", key: "bPurify" },
    { cls: "c-br", key: "bEmpty" },
  ].map(({ cls, key }) => {
    const b = h("button", "corner " + cls);
    b.append(h("span", "clabel"));
    v.refs[key] = b;
    bottom.append(b);
    return b;
  });
  corners[0].onclick = () => {
    v.mode = v.mode === "ult" ? "none" : "ult";
  };
  corners[1].onclick = () => {
    v.mode = "none";
  };
  corners[2].onclick = () => {
    v.mode = v.mode === "purify" ? "none" : "purify";
  };
  corners[3].disabled = true;
  const wheelBox = h("div", "wheelbox");
  const wheel = svgEl("svg", { class: "wheel3d", viewBox: "-160 -160 320 320" });
  const defs = svgEl("defs");
  defs.innerHTML =
    '<radialGradient id="dial" cx="40%" cy="35%"><stop offset="0" stop-color="#3b4468"/><stop offset="1" stop-color="#151a2c"/></radialGradient>' +
    '<linearGradient id="wfront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9d9a8"/><stop offset="1" stop-color="#c7a96a"/></linearGradient>' +
    '<linearGradient id="wback" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f5e"/><stop offset="1" stop-color="#262a42"/></linearGradient>';
  wheel.append(defs);
  wheel.append(svgEl("circle", { r: 156, fill: "#0d1020", stroke: "#39405e", "stroke-width": 3 }));
  const cool = svgEl("circle", { r: 152, fill: "none", stroke: "#f2a541", "stroke-width": 5, transform: "rotate(-90)", "stroke-dasharray": "0 1000" });
  wheel.append(cool);
  const rotor = svgEl("g", { class: "rotor" });
  wheel.append(rotor);
  for (let pos = 0; pos < 6; pos++) {
    const g = svgEl("g", { class: "wedge", "data-pos": pos });
    g.append(svgEl("path", { d: wedgePath(pos, 66, 146), class: "wbase" }));
    g.append(svgEl("g", { class: "wart" }));
    const [sx, sy] = polar(-150 + pos * 60 + 22, 132);
    g.append(svgEl("circle", { cx: sx, cy: sy, r: 10, class: "wsoul-bg" }));
    g.append(svgEl("circle", { cx: sx, cy: sy, r: 10, class: "wsoul", transform: `rotate(-90 ${sx} ${sy})` }));
    g.addEventListener("click", () => onWedgeClick(v, pos));
    rotor.append(g);
  }
  const dial = svgEl("g", { class: "dial" });
  dial.append(svgEl("circle", { r: 58, fill: "url(#dial)", stroke: "#5b6690", "stroke-width": 3 }));
  const zero = svgEl("text", { y: 7, "text-anchor": "middle", class: "zero-t" });
  zero.textContent = "ゼロ";
  const zhit = svgEl("circle", { r: 26, class: "zhit" });
  zhit.addEventListener("click", () => toggleZero(v));
  const lBtn = svgEl("g", { class: "dialbtn" });
  lBtn.append(svgEl("circle", { cx: -38, cy: 0, r: 15 }));
  const lt = svgEl("text", { x: -38, y: 6, "text-anchor": "middle" });
  lt.textContent = "⟲";
  lBtn.append(lt);
  lBtn.addEventListener("click", () => queueRotate(v, -1));
  const rBtn = svgEl("g", { class: "dialbtn" });
  rBtn.append(svgEl("circle", { cx: 38, cy: 0, r: 15 }));
  const rt = svgEl("text", { x: 38, y: 6, "text-anchor": "middle" });
  rt.textContent = "⟳";
  rBtn.append(rt);
  rBtn.addEventListener("click", () => queueRotate(v, 1));
  dial.append(zhit, zero, lBtn, rBtn);
  wheel.append(dial);
  wheelBox.append(wheel);
  bindWheelDrag(v, wheel);
  const hint = h("div", "hint3d");
  const overlay = h("div", "overlay");
  overlay.hidden = true;
  bottom.append(wheelBox, hint, overlay);
  v.refs = { ...v.refs, bottom, hint, overlay, wheelBox };
  v.svg = { ...v.svg, wheel, rotor, cool, zero };

  game.append(top, bottom);
  const details = h("details", "logbox");
  details.append(h("summary", "", "対戦ログ"), v.logEl);
  details.open = true;
  const layout = h("div", "layout3d");
  layout.append(game, details);
  app.append(layout);

  const resize = () => {
    const w = top.clientWidth;
    const hgt = top.clientHeight;
    v.scene.resize(w, hgt);
    layoutCorners(v);
  };
  new ResizeObserver(resize).observe(top);
  new ResizeObserver(() => layoutCorners(v)).observe(bottom);
  resize();
}

function polar(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
}

/** 位置 pos の扇形（位置 1 が真上。0→1→2→3→4→5 と時計回り） */
function wedgePath(pos: number, r0: number, r1: number): string {
  const a0 = -150 + pos * 60 - 29;
  const a1 = -150 + pos * 60 + 29;
  const [x0, y0] = polar(a0, r1);
  const [x1, y1] = polar(a1, r1);
  const [x2, y2] = polar(a1, r0);
  const [x3, y3] = polar(a0, r0);
  return `M${x0} ${y0} A${r1} ${r1} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
}

/** 四隅のボタンを、ホイールの円に沿ってくり抜く */
function layoutCorners(v: View): void {
  const bottom = v.refs.bottom;
  const wb = v.refs.wheelBox.getBoundingClientRect();
  const bb = bottom.getBoundingClientRect();
  const cx = wb.left + wb.width / 2;
  const cy = wb.top + wb.height / 2;
  const r = (wb.width / 2) * (158 / 160) + 6;
  for (const key of ["bUlt", "bTarget", "bPurify", "bEmpty"]) {
    const el = v.refs[key];
    const eb = el.getBoundingClientRect();
    const x = cx - eb.left;
    const y = cy - eb.top;
    const mask = `radial-gradient(circle at ${x}px ${y}px, transparent ${r}px, #000 ${r + 1}px)`;
    el.style.maskImage = mask;
    el.style.webkitMaskImage = mask;
  }
  void bb;
}

// ---- 入力 ----

function toggleZero(v: View): void {
  v.zero = !v.zero;
  v.mode = "none";
}

function tryUlt(v: View, pos: number): void {
  send(v, { t: "ultStart", allySlot: pos, grand: v.zero });
  v.mode = "none";
  if (v.zero) v.zero = false;
}

function onWedgeClick(v: View, pos: number): void {
  if (performance.now() - lastDragAt < 300) return;
  if (pos >= 3) {
    send(v, { t: "purify", allySlot: pos });
    v.mode = "none";
  } else {
    tryUlt(v, pos);
  }
}

/** 上画面のクリック：敵なら標的（ゼロ中はつつき）、味方なら奥義 */
function onStageClick(v: View, e: MouseEvent): void {
  const r = (e.target as HTMLElement).getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  let best: { uid: number; d: number } | null = null;
  for (const pid of [0, 1] as const) {
    for (const uid of frontUids(v, pid)) {
      const p = v.scene.project(uid, 1.0);
      if (!p.visible) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < 70 && (!best || d < best.d)) best = { uid, d };
    }
  }
  if (!best) return;
  const u = unitOf(v, best.uid);
  if (u.owner === 1) {
    send(v, v.zero ? { t: "pokeStart", enemyUnit: u.index } : { t: "target", enemyUnit: u.index });
  } else {
    tryUlt(v, v.state.players[0].wheel.indexOf(u.index));
  }
}

/** 回転の操作をためる。3秒の待ち時間ごとに、1回で好きなだけ回せる（BATTLE_SPEC §8.1） */
function queueRotate(v: View, delta: number): void {
  if (v.state.players[0].rotateCooldown > 0 || v.state.players[0].poke) return;
  v.preview = Math.max(-5, Math.min(5, v.preview + delta));
  if (v.previewTimer !== null) clearTimeout(v.previewTimer);
  v.previewTimer = window.setTimeout(() => commitRotate(v), 450);
}

function commitRotate(v: View): void {
  if (v.previewTimer !== null) clearTimeout(v.previewTimer);
  v.previewTimer = null;
  const net = ((v.preview % 6) + 6) % 6;
  v.preview = 0;
  if (net === 0) return;
  send(v, net <= 3 ? { t: "rotate", dir: "cw", steps: net } : { t: "rotate", dir: "ccw", steps: 6 - net });
}

function bindWheelDrag(v: View, wheel: SVGElement): void {
  let dragging = false;
  let prev = 0;
  let total = 0;
  const angle = (e: PointerEvent) => {
    const r = wheel.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };
  wheel.addEventListener("pointerdown", (e) => {
    const r = wheel.getBoundingClientRect();
    const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    if (d < (r.width / 2) * (60 / 160)) return; // 真ん中のダイヤルは押すだけ
    if (v.state.players[0].rotateCooldown > 0) return;
    dragging = true;
    v.svg.rotor.setAttribute("data-drag", "1");
    prev = angle(e);
    total = 0;
    wheel.setPointerCapture(e.pointerId);
  });
  wheel.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const a = angle(e);
    let d = a - prev;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    total += d;
    prev = a;
    v.preview = Math.max(-5, Math.min(5, Math.round(total / (Math.PI / 3))));
    v.svg.rotor.setAttribute("transform", `rotate(${(total * 180) / Math.PI})`);
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    v.svg.rotor.removeAttribute("data-drag");
    if (Math.abs(total) > 0.2) lastDragAt = performance.now();
    commitRotate(v);
  };
  wheel.addEventListener("pointerup", end);
  wheel.addEventListener("pointercancel", end);
}

document.addEventListener("keydown", (e) => {
  const v = view;
  if (!v || !v.running) return;
  const k = e.key.toLowerCase();
  const me = v.state.players[0];
  if (k === "q") queueRotate(v, -1);
  else if (k === "e") queueRotate(v, 1);
  else if (k === "z") toggleZero(v);
  else if (k === " ") {
    e.preventDefault();
    send(v, { t: "ultRelease" });
  } else if (k === "escape") {
    if (me.poke) send(v, { t: "pokeStop" });
    else send(v, { t: "ultCancel" });
    v.mode = "none";
  } else if (k >= "1" && k <= "3") tryUlt(v, Number(k) - 1);
  else if (k >= "4" && k <= "6") send(v, { t: "purify", allySlot: Number(k) - 1 });
  else if (k === "tab") {
    e.preventDefault();
    const foe = v.state.players[1];
    const front = [0, 1, 2].map((p) => foe.units[foe.wheel[p]]).filter(isAlive);
    if (front.length === 0) return;
    const cur = front.findIndex((u) => u.index === me.target);
    const next = front[(cur + 1) % front.length];
    send(v, v.zero ? { t: "pokeStart", enemyUnit: next.index } : { t: "target", enemyUnit: next.index });
  }
});

// ---- 進行 ----

function frame(now: number): void {
  const v = view;
  if (!v || !v.running) return;
  const dtMs = Math.min(now - v.lastFrame, 250);
  v.acc += dtMs;
  v.lastFrame = now;
  let steps = 0;
  while (v.acc >= 50 && steps < 5 && !v.state.outcome) {
    stepOnce(v);
    v.acc -= 50;
    steps++;
  }
  render(v, dtMs / 1000);
  if (v.state.outcome) {
    v.running = false;
    setTimeout(() => showResult(v), 900);
    return;
  }
  requestAnimationFrame(frame);
}

function stepOnce(v: View): void {
  const inputs: PlayerInput[] = v.pending.map((input) => ({ player: 0, input }));
  v.pending = [];
  for (const input of cpuThink(v.cpu, v.state)) inputs.push({ player: 1, input });
  const events: BattleEvent[] = [];
  stepInPlace(v.state, inputs, events);
  // 攻撃が当たる瞬間に合わせて、ダメージの表示を少し遅らせる
  let delay = 0;
  for (const e of events) {
    if (e.t === "action" && (e.action === "attack" || e.action === "skill")) delay = 480;
    if (e.t === "ult") delay = 650;
    const d = delay;
    if (d > 0 && (e.t === "damage" || e.t === "heal" || e.t === "ko" || e.t === "curse" || e.t === "doll" || e.t === "endure")) {
      setTimeout(() => onEvent(v, e), d);
    } else {
      onEvent(v, e);
    }
  }
}

// ---- 演出（モーション・効果音・ログ） ----

function floatText(v: View, uid: number, text: string, cls: string): void {
  const p = v.scene.project(uid, 2.0);
  if (!p.visible) return;
  const f = h("span", "float " + cls, text);
  f.style.left = `${p.x}px`;
  f.style.top = `${p.y}px`;
  v.refs.fx.append(f);
  setTimeout(() => f.remove(), 950);
}

function elementColor(el: string | null | undefined): number {
  return hex(el ? M.ELEMENT_COLOR[el] : "#f2a541");
}

function onEvent(v: View, e: BattleEvent): void {
  const side = (uid: number) => (uid < 6 ? "a" : "f");
  const sc = v.scene;
  switch (e.t) {
    case "action": {
      const u = unitOf(v, e.uid);
      const t = pickEnemyTarget(v.state.players[u.owner], v.state.players[1 - u.owner]);
      if (e.action === "attack") {
        sc.action(e.uid, t ? t.uid : null, "attack", 0xffffff);
        S.sfxAttack(Math.min(1, def(u).attackPower / 150));
      } else if (e.action === "skill") {
        sc.action(e.uid, t ? t.uid : null, "skill", elementColor(def(u).skillElement));
        S.sfxSkill(def(u).skillElement);
      } else if (e.action === "guard") {
        sc.guard(e.uid);
        S.sfxGuard();
        floatText(v, e.uid, "守り", "info");
      } else if (e.action === "loaf") {
        sc.loaf(e.uid);
        S.sfxLoaf();
        floatText(v, e.uid, "なまけ", "info");
        log(v, `${unitName(v, e.uid)} はなまけている`, side(e.uid));
      }
      break;
    }
    case "damage":
      sc.hit(e.dst, e.crit, e.source === "attack" ? 0xffffff : 0xffd27a);
      floatText(v, e.dst, String(e.amount), e.crit ? "crit" : "dmg");
      if (e.crit) {
        S.sfxCrit();
        log(v, `${unitName(v, e.src ?? e.dst)} のクリティカル！ ${e.amount}`, side(e.src ?? e.dst));
      } else if (unitOf(v, e.dst).guarding && (e.source === "attack" || e.source === "skill")) S.sfxGuardedHit();
      if (e.source === "trait") log(v, `${unitName(v, e.dst)} に特性のダメージ ${e.amount}`, side(e.dst));
      break;
    case "heal":
      floatText(v, e.dst, "+" + e.amount, "heal");
      if (e.amount >= 20) S.sfxHeal();
      break;
    case "curse":
      if (e.result === "hit") {
        sc.cast(e.src, 0xb07ce0);
        floatText(v, e.dst, CURSE[e.kind] + TIER[e.tier], "info");
        S.sfxCurse();
        log(v, `${unitName(v, e.src)} → ${unitName(v, e.dst)} に ${CURSE[e.kind]}${TIER[e.tier]}`, side(e.src));
      } else {
        floatText(v, e.dst, e.result === "miss" ? "呪付 失敗" : "呪付 無効", "info");
      }
      break;
    case "bless":
      sc.cast(e.src, 0x4cc2a4);
      floatText(v, e.dst, BLESS[e.kind] + TIER[e.tier], "info");
      S.sfxBless();
      break;
    case "ko":
      sc.ko(e.uid);
      S.sfxKo();
      log(v, `${unitName(v, e.uid)} が倒れた`, side(e.uid));
      break;
    case "ult": {
      const u = unitOf(v, e.uid);
      const ult = def(u).ult;
      const t = pickEnemyTarget(v.state.players[u.owner], v.state.players[1 - u.owner]);
      const heal = ult.kind === "heal" || ult.kind === "blessAll";
      sc.action(e.uid, heal ? null : t ? t.uid : null, e.grand ? "grand" : "ult", elementColor("element" in ult ? ult.element : null));
      S.sfxUlt(e.grand);
      const q = e.quality === "perfect" ? "Perfect" : e.quality === "good" ? "Good" : "Miss";
      log(v, `${unitName(v, e.uid)} の${e.grand ? "大奥義" : "奥義"}「${def(u).ultName}」 ${q}`, side(e.uid));
      break;
    }
    case "stance": {
      S.sfxStance(e.player === 1);
      say(v, e.uid, `${e.grand ? "大奥義" : "奥義"}「${def(unitOf(v, e.uid)).ultName}」`, true);
      if (e.player === 1) log(v, `${unitName(v, e.uid)} が${e.grand ? "大奥義" : "奥義"}を構えた！`, "f");
      break;
    }
    case "stanceCancel":
      if (e.player === 0 && e.reason !== "input") log(v, "構えがキャンセルされた", "a");
      break;
    case "rotate":
    case "forcedRotate":
      S.sfxRotate();
      if (e.t === "forcedRotate") log(v, `${e.player === 0 ? "こちら" : "相手"}の前衛が全滅して、ホイールが回った`, e.player === 0 ? "a" : "f");
      break;
    case "doll":
      log(v, `${unitName(v, e.uid)} は身代わり人形で耐えた`, side(e.uid));
      break;
    case "endure":
      floatText(v, e.uid, "踏ん張り", "info");
      log(v, `${unitName(v, e.uid)} は踏ん張った`, side(e.uid));
      break;
    case "firstStrike":
      floatText(v, e.uid, "先駆け", "info");
      break;
    case "suddenDeath":
      S.sfxAlarm();
      log(v, "サドンデス！ ダメージが全部 999 になる", "f");
      break;
    case "pokeEnd":
      if (e.player === 0) log(v, e.result === "success" ? "つつき成功：妖気を吸った" : "つつき終了", "a");
      break;
    case "curseCleared":
      if (e.by === "purify") log(v, `${unitName(v, e.uid)} の呪付を浄化した`, side(e.uid));
      break;
    default:
      break;
  }
}

/** 吹き出しと声 */
function say(v: View, uid: number, text: string, big = false): void {
  const p = v.scene.project(uid, 2.35);
  if (!p.visible) return;
  const b = h("div", "bubble3d" + (big ? " big" : ""), text);
  b.style.left = `${p.x}px`;
  b.style.top = `${p.y}px`;
  v.refs.fx.append(b);
  setTimeout(() => b.remove(), big ? 1600 : 1150);
  const u = unitOf(v, uid);
  S.voice(M.VOICE_PITCH[def(u).id] ?? 300, Math.ceil(text.length / 2), u.owner === 1);
}

/** 次に行動するユニット（行動ポイントが一番少ない前衛。BATTLE_SPEC §4.1） */
function upcoming(v: View): UnitState[] {
  const list: { u: UnitState; spd: number; pid: number; pos: number }[] = [];
  for (const pid of [0, 1] as const) {
    const p = v.state.players[pid];
    for (let pos = 0; pos < 3; pos++) {
      const u = p.units[p.wheel[pos]];
      const frozen = p.stance && (p.stance.unit === u.index || p.stance.partners.includes(u.index));
      if (!isAlive(u) || frozen) continue;
      list.push({ u, spd: u.spd, pid, pos });
    }
  }
  list.sort((a, b) => a.u.ap - b.u.ap || b.spd - a.spd || a.pid - b.pid || a.pos - b.pos);
  return list.map((x) => x.u);
}

/** 本家の「参る」のように、行動の直前にセリフで知らせる */
function callouts(v: View): void {
  const s = v.state;
  const next = upcoming(v)[0];
  if (!next) return;
  const left = s.busyUntil - s.tick;
  const key = `${s.busyUntil}:${next.uid}`;
  if (left <= 12 && v.called !== key) {
    v.called = key;
    say(v, next.uid, M.CALL_LINE[def(next).id] ?? "参る！");
  }
}

// ---- 描画 ----

function render(v: View, dt: number): void {
  const s = v.state;
  const r = v.refs;
  const me = s.players[0];
  const foe = s.players[1];
  const sc = v.scene;
  sc.setLine(true, frontUids(v, 0));
  sc.setLine(false, frontUids(v, 1));
  for (const p of s.players) {
    for (const u of p.units) {
      sc.setAlive(u.uid, isAlive(u));
      const st = p.stance;
      sc.setStance(u.uid, !!st && (st.unit === u.index || st.partners.includes(u.index)), !!st && st.grand);
    }
  }
  sc.update(dt);
  callouts(v);

  // 時計
  const left = s.tick < C.SUDDEN_DEATH_TICKS ? C.SUDDEN_DEATH_TICKS - s.tick : C.TIME_LIMIT_TICKS - s.tick;
  const sec = Math.max(0, Math.ceil(left / C.TICKS_PER_SEC));
  r.clock.textContent = `${s.tick >= C.SUDDEN_DEATH_TICKS ? "サドンデス " : ""}${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  r.clock.classList.toggle("sudden", s.tick >= C.SUDDEN_DEATH_TICKS);

  // 次に動く順
  const up = upcoming(v);
  const orderHtml =
    '<span class="olabel">次</span>' +
    up
      .map((u) => `<span class="oitem ${u.owner === 0 ? "a" : "f"}"><span class="oart">${artSvg(def(u).id, def(u).name.slice(0, 1))}</span></span>`)
      .join("");
  if (r.order.innerHTML !== orderHtml) r.order.innerHTML = orderHtml;

  // 味方の名前の札（本家と同じく、上画面の下に3つ並べる）
  frontUids(v, 0).forEach((uid, i) => {
    const u = unitOf(v, uid);
    const plate = v.plates[i];
    (plate.querySelector(".pn") as HTMLElement).textContent = def(u).name;
    (plate.querySelector(".hp i") as HTMLElement).style.width = pct(u.hp, u.maxHp);
    plate.querySelector(".hp")!.classList.toggle("low", hpRatio(u) <= 250);
    const clip = plate.querySelector(".soul-clip") as SVGRectElement;
    clip.setAttribute("y", String(24 - (24 * u.sg) / C.SG_FULL));
    plate.classList.toggle("full", u.sg >= C.SG_FULL && isAlive(u));
    plate.classList.toggle("dead", !isAlive(u));
    plate.classList.toggle("pick", v.mode === "ult" && u.sg >= C.SG_FULL && isAlive(u));
    const chips = statusChips(u);
    const fx = plate.querySelector(".fxs") as HTMLElement;
    if (fx.innerHTML !== chips) fx.innerHTML = chips;
  });
  // 敵の HP（頭の上）
  const foeFront = frontUids(v, 1);
  for (const [uid, bar] of v.foeBars) {
    const u = unitOf(v, uid);
    const p = sc.project(uid, 2.45);
    const show = foeFront.includes(uid) && p.visible;
    bar.hidden = !show;
    if (!show) continue;
    bar.style.left = `${p.x}px`;
    bar.style.top = `${p.y}px`;
    (bar.querySelector(".n") as HTMLElement).textContent = def(u).name;
    (bar.querySelector(".hp i") as HTMLElement).style.width = pct(u.hp, u.maxHp);
    const chips = statusChips(u);
    const fx = bar.querySelector(".fxs") as HTMLElement;
    if (fx.innerHTML !== chips) fx.innerHTML = chips;
    bar.classList.toggle("targeted", me.target === u.index);
    bar.classList.toggle("pokeable", v.zero && isAlive(u) && (u.curse !== null || u.loafing));
    bar.classList.toggle("dead", !isAlive(u));
  }
  drawArrows(v, up[0]);
  renderWheel(v);
  r.hint.textContent = hintText(v);
  renderOverlay(v);
  void foe;
}

function statusChips(u: UnitState): string {
  const chips: string[] = [];
  if (u.curse) chips.push(`<span class="chip c">${CURSE[u.curse.kind]}${TIER[u.curse.tier]} ${secs(u.curse.remaining)}</span>`);
  if (u.blessing) chips.push(`<span class="chip b">${BLESS[u.blessing.kind]} ${secs(u.blessing.remaining)}</span>`);
  if (u.guarding) chips.push('<span class="chip g">守り</span>');
  if (u.loafing) chips.push('<span class="chip l">なまけ中</span>');
  return chips.join("");
}

/** だれがだれを狙っているか。次に動くユニットの矢印だけ濃くする */
function drawArrows(v: View, next: UnitState | undefined): void {
  const lines: string[] = [];
  for (const pid of [0, 1] as const) {
    const p = v.state.players[pid];
    const t = pickEnemyTarget(p, v.state.players[1 - pid]);
    if (!t) continue;
    const to = v.scene.project(t.uid, 0.2);
    for (const uid of frontUids(v, pid)) {
      const u = unitOf(v, uid);
      if (!isAlive(u)) continue;
      const from = v.scene.project(uid, 0.2);
      if (!from.visible || !to.visible) continue;
      const stance = p.stance?.unit === u.index;
      const isNext = next?.uid === uid;
      const color = stance ? "#f2a541" : pid === 0 ? "#5fb3d9" : "#e0655a";
      const op = stance || isNext ? 0.95 : 0.18;
      const w = stance ? 5 : isNext ? 4 : 2;
      const mx = (from.x + to.x) / 2;
      const my = Math.min(from.y, to.y) - 40;
      lines.push(
        `<path d="M${from.x} ${from.y} Q${mx} ${my} ${to.x} ${to.y}" fill="none" stroke="${color}" stroke-width="${w}" stroke-opacity="${op}" stroke-linecap="round"${stance ? ' stroke-dasharray="10 6"' : ""}/>` +
          `<circle cx="${to.x}" cy="${to.y}" r="${isNext || stance ? 7 : 4}" fill="${color}" fill-opacity="${op}"/>`,
      );
    }
  }
  const html = lines.join("");
  const svg = v.svg.arrows;
  if (svg.innerHTML !== html) svg.innerHTML = html;
}

function renderWheel(v: View): void {
  const me = v.state.players[0];
  const key = me.wheel.join(",");
  const rotor = v.svg.rotor;
  if (v.wheelKey !== key) {
    v.wheelKey = key;
    rotor.querySelectorAll<SVGGElement>(".wedge").forEach((g) => {
      const pos = Number(g.dataset.pos);
      const u = me.units[me.wheel[pos]];
      const [x, y] = polar(-150 + pos * 60, 104);
      const art = artSvg(def(u).id, def(u).name.slice(0, 1)).replace('width="100%" height="100%"', `x="${x - 32}" y="${y - 32}" width="64" height="64"`);
      g.querySelector(".wart")!.innerHTML = art;
    });
    rotor.removeAttribute("transform");
  }
  if (v.preview !== 0 && !rotor.hasAttribute("data-drag")) {
    rotor.setAttribute("transform", `rotate(${v.preview * 60})`);
  } else if (v.preview === 0 && !rotor.hasAttribute("data-drag")) {
    rotor.removeAttribute("transform");
  }
  rotor.querySelectorAll<SVGGElement>(".wedge").forEach((g) => {
    const pos = Number(g.dataset.pos);
    const u = me.units[me.wheel[pos]];
    g.classList.toggle("front", pos < 3);
    g.classList.toggle("dead", !isAlive(u));
    g.classList.toggle("cursed", !!u.curse);
    g.classList.toggle("purifying", me.purify?.unit === u.index);
    g.classList.toggle(
      "pick",
      (v.mode === "purify" && pos >= 3 && !!u.curse) || (v.mode === "ult" && pos < 3 && u.sg >= C.SG_FULL && isAlive(u)),
    );
    const soul = g.querySelector(".wsoul") as SVGCircleElement;
    const c = 2 * Math.PI * 10;
    soul.setAttribute("stroke-dasharray", `${(c * u.sg) / C.SG_FULL} ${c}`);
    soul.classList.toggle("full", u.sg >= C.SG_FULL);
  });
  const cd = me.rotateCooldown / C.ROTATE_COOLDOWN;
  const circ = 2 * Math.PI * 152;
  v.svg.cool.setAttribute("stroke-dasharray", `${circ * cd} ${circ}`);
  v.svg.wheel.classList.toggle("zero", v.zero);
  v.refs.bottom.classList.toggle("zero", v.zero);
  (v.refs.bUlt.querySelector(".clabel") as HTMLElement).textContent = v.zero ? "大奥義" : "奥義";
  (v.refs.bTarget.querySelector(".clabel") as HTMLElement).textContent = v.zero ? "つつき" : "標的";
  (v.refs.bPurify.querySelector(".clabel") as HTMLElement).textContent = "浄化";
  (v.refs.bEmpty.querySelector(".clabel") as HTMLElement).textContent = "";
  v.refs.bUlt.classList.toggle("on", v.mode === "ult");
  v.refs.bPurify.classList.toggle("on", v.mode === "purify");
}

function hintText(v: View): string {
  const me = v.state.players[0];
  if (v.mode === "ult") return v.zero ? "大奥義を撃つ前衛を選ぶ（自分と両隣の妖気が満タン）" : "奥義を撃つ前衛を選ぶ（妖気が満タン）";
  if (v.mode === "purify") return "浄化する後衛（呪付のかかったユニット）を選ぶ";
  if (v.preview !== 0) return `${Math.abs(v.preview)} つ分${v.preview > 0 ? "時計回り" : "反時計回り"}に回す`;
  if (v.zero) return "ゼロ：光っている敵をタップでつつき";
  if (me.rotateCooldown > 0) return `回転まで ${secs(me.rotateCooldown)} 秒`;
  return "ホイールをなぞって回す・敵をタップで標的";
}

function renderOverlay(v: View): void {
  const me = v.state.players[0];
  const ov = v.refs.overlay;
  if (me.stance) {
    ov.hidden = false;
    const st = me.stance;
    const charge = v.state.tick - st.startTick;
    const cursor = charge % C.SKILL_CURSOR_PERIOD;
    const tier = charge <= 9 ? 1 : charge <= 19 ? 2 : 3;
    const mult = ["1.0", "1.1", "1.2"][tier - 1];
    const key = `stance:${st.unit}:${st.grand}`;
    if (ov.dataset.key !== key) {
      ov.dataset.key = key;
      ov.replaceChildren();
      const title = h("div", "title", `${def(me.units[st.unit]).name} の${st.grand ? "大奥義" : "奥義"}「${def(me.units[st.unit]).ultName}」`);
      const chargeEl = h("div", "charge");
      const ring = h("button", "skill");
      ring.title = "タップで解放（Space）";
      ring.onclick = () => send(v, { t: "ultRelease" });
      for (let i = 0; i < C.SKILL_CURSOR_PERIOD; i++) {
        const seg = h("span", "seg" + (C.PERFECT_CELLS.includes(i) ? " perfect" : C.GOOD_CELLS.includes(i) ? " good" : ""));
        const a = ((-90 + (i * 360) / C.SKILL_CURSOR_PERIOD) * Math.PI) / 180;
        seg.style.transform = `translate(${70 * Math.cos(a)}px, ${70 * Math.sin(a)}px)`;
        ring.append(seg);
      }
      const face = h("span", "face");
      face.innerHTML = artSvg(def(me.units[st.unit]).id, "");
      ring.append(face);
      const row = h("div", "row");
      const rel = h("button", "btn primary", "解放");
      rel.onclick = () => send(v, { t: "ultRelease" });
      const can = h("button", "btn", "キャンセル");
      can.onclick = () => send(v, { t: "ultCancel" });
      row.append(rel, can);
      ov.append(title, chargeEl, ring, row);
    }
    (ov.querySelector(".charge") as HTMLElement).innerHTML =
      `溜め ${[1, 2, 3].map((t) => `<span class="${t <= tier ? "on" : ""}"></span>`).join("")} ×${mult}　残り ${secs(Math.max(0, C.CHARGE_MAX_TICKS - charge))} 秒`;
    ov.querySelectorAll(".seg").forEach((seg, i) => seg.classList.toggle("cur", i === cursor));
    return;
  }
  if (me.poke) {
    ov.hidden = false;
    const k = me.poke;
    const target = v.state.players[1].units[k.target];
    const key = `poke:${k.target}`;
    if (ov.dataset.key !== key) {
      ov.dataset.key = key;
      ov.replaceChildren();
      const title = h("div", "title", `${def(target).name} をつつく`);
      const gauge = h("div", "gauge");
      gauge.append(h("i"));
      const info = h("div", "help num");
      const grid = h("div", "grid4");
      const face = h("div", "pokeface");
      face.innerHTML = artSvg(def(target).id, "");
      grid.append(face);
      for (let i = 0; i < C.POKE_CELLS; i++) {
        const c = h("button", "cell");
        c.onpointerdown = (e) => {
          e.preventDefault();
          const kk = v.state.players[0].poke;
          S.sfxPoke(!!kk && kk.weakCell === i);
          send(v, { t: "pokeTap", cell: i });
        };
        grid.append(c);
      }
      const stop = h("button", "btn", "やめる");
      stop.onclick = () => send(v, { t: "pokeStop" });
      ov.append(title, gauge, info, grid, stop);
    }
    (ov.querySelector(".gauge i") as HTMLElement).style.width = pct(k.gauge, C.POKE_GAUGE_GOAL);
    (ov.querySelector(".help") as HTMLElement).textContent = `残り ${secs(C.POKE_TICKS - k.elapsed)} 秒　★を連打`;
    ov.querySelectorAll(".cell").forEach((c, i) => {
      c.classList.toggle("weak", i === k.weakCell);
      c.textContent = i === k.weakCell ? "★" : "";
    });
    return;
  }
  if (!ov.hidden) {
    ov.hidden = true;
    ov.dataset.key = "";
  }
}

function showResult(v: View): void {
  const o = v.state.outcome!;
  const wrap = h("div", "result");
  const box = h("div", "box");
  const text = o.winner === 0 ? "勝ち" : o.winner === 1 ? "負け" : "引き分け";
  S.sfxWin(o.winner === 0);
  box.append(h("div", "big", text));
  box.append(
    h(
      "div",
      "muted",
      `${o.reason === "ko" ? "全滅" : "時間切れ（残り HP の割合）"}・${Math.floor(v.state.tick / C.TICKS_PER_SEC)} 秒`,
    ),
  );
  const row = h("div", "row");
  const again = h("button", "btn primary", "同じチームでもう一度");
  again.onclick = () => {
    wrap.remove();
    startBattle(pickedIds().map((unit) => ({ unit })));
  };
  const back = h("button", "btn", "編成に戻る");
  back.onclick = () => {
    wrap.remove();
    view = null;
    showSetup();
  };
  row.append(again, back);
  row.style.justifyContent = "center";
  box.append(row);
  wrap.append(box);
  document.body.append(wrap);
}

showSetup();
