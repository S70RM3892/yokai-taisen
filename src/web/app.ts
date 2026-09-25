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
  agNeeded,
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
import * as M from "./motion.js";
import * as S from "./sound.js";

const TRIBE_COLOR: Record<string, string> = {
  takeru: "#d9644a", ayashi: "#8a6ee0", tsuwamono: "#8f8a74", kage: "#4f9fb8",
  nagomi: "#6fbf73", miyabi: "#d48ac0", tatari: "#7d5a9e", shizume: "#5f88c9",
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
  takeru: "猛", ayashi: "怪", tsuwamono: "剛", kage: "影", nagomi: "和", miyabi: "雅", tatari: "祟", shizume: "鎮",
};
const ELEMENT: Record<string, string> = { fire: "火", water: "水", thunder: "雷", earth: "土", ice: "氷", wind: "風" };
const CURSE: Record<string, string> = { slow: "鈍重", weaken: "衰弱", brittle: "脆化", poison: "蝕毒", seal: "封気" };
const BLESS: Record<string, string> = { rally: "鼓舞", fortify: "堅護", haste: "疾風", gather: "集気", regen: "再生", ward: "浄気" };
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

let picked: string[] = [];

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

  const setup = h("section", "setup");
  const lead = h("p", "help");
  lead.innerHTML =
    "6体を選んで対戦する。<b>並び順がホイールの最初の並び</b>（1〜3番目が前衛）。S ランクは2体まで、A ランクは2体まで、大物はチームに1体まで。";
  setup.append(lead);

  const slots = h("div", "slots");
  const errors = h("div", "errors");
  const start = h("button", "btn primary", "対戦開始");
  const refresh = () => {
    slots.replaceChildren();
    for (let i = 0; i < 6; i++) {
      const id = picked[i];
      const b = h("button", "slot" + (id ? " filled" : ""));
      b.append(h("span", "pos", i < 3 ? `前衛 ${i + 1}` : `後衛 ${i + 1}`));
      if (id) {
        const d = UNITS.find((u) => u.id === id)!;
        b.append(h("b", "", d.name), h("span", "tag", `${d.rank}・${TRIBE[d.tribe]}`));
        b.title = "クリックで外す";
        b.onclick = () => {
          picked.splice(i, 1);
          refresh();
        };
      } else {
        b.append(h("span", "muted", "空き"));
        b.disabled = true;
      }
      slots.append(b);
    }
    const errs = picked.length === 6 ? validateTeam(picked.map((unit) => ({ unit }))) : [];
    errors.textContent = picked.length < 6 ? `あと ${6 - picked.length} 体` : errs.join(" / ");
    start.disabled = picked.length !== 6 || errs.length > 0;
  };

  const roster = h("div", "roster");
  for (const d of UNITS) {
    const card = h("button", "card");
    const head = h("div", "head");
    head.append(h("span", "name", d.name), h("span", "rank " + d.rank, d.group ? `${d.rank}・大物` : d.rank));
    head.append(h("span", "tag", `${TRIBE[d.tribe]}・${natureById(d.defaultNature).name}`));
    card.append(head);
    card.append(h("span", "trait", `特性：${TRAIT_NAMES[d.trait]}`));
    card.append(
      h(
        "span",
        "stats num",
        `HP ${d.hp}　ATK ${d.atk}　SPA ${d.spa}　DEF ${d.def}　SPD ${d.spd}　妖気 ${d.sgRank}`,
      ),
    );
    card.append(h("span", "stats", `奥義：${d.ultName}　弱点 ${d.weak ? ELEMENT[d.weak] : "なし"}`));
    card.onclick = () => {
      if (picked.length >= 6) return;
      picked.push(d.id);
      refresh();
    };
    roster.append(card);
  }

  const actions = h("div", "row");
  const rnd = h("button", "btn", "おまかせ");
  rnd.onclick = () => {
    picked = randomUnitIds(randomSeed());
    refresh();
  };
  const clear = h("button", "btn", "全部外す");
  clear.onclick = () => {
    picked = [];
    refresh();
  };
  start.onclick = () => startBattle(picked.map((unit) => ({ unit })));
  actions.append(start, rnd, clear, errors);

  const help = h("div", "help");
  help.innerHTML =
    "操作：ホイールをドラッグ、または <kbd>Q</kbd>/<kbd>E</kbd> で回す（3秒に1回）。" +
    "敵をクリックで標的。<kbd>1</kbd>〜<kbd>3</kbd> で前衛の奥義（妖気が満タンのとき）→ <kbd>Space</kbd> で解放、<kbd>Esc</kbd> でキャンセル。" +
    "<kbd>Z</kbd>（中央のゼロ）で 奥義↔大奥義・標的↔つつき を切り替え。後衛で呪付のかかったユニットをクリック（<kbd>4</kbd>〜<kbd>6</kbd>）で浄化。";

  setup.append(slots, actions, help, roster);
  app.append(
    setup,
    h(
      "footer",
      "",
      "見た目は仮（四角と文字）。効果音はその場で合成している。BGM は手元の曲ファイルをこのブラウザの中だけで流す（どこにも送らない）。NCS の曲はゲームへの組み込みにライセンスが要るので、ゲームには入れていない。戦闘のルールは BATTLE_SPEC v0.18。",
    ),
  );
  if (picked.length === 0) picked = randomUnitIds(randomSeed());
  refresh();
}

// =====================================================================
// バトル
// =====================================================================

interface View {
  state: BattleState;
  cpu: Cpu;
  pending: Input[];
  zero: boolean;
  mode: "none" | "ult" | "purify";
  unitEl: Map<number, HTMLElement>;
  wheelEl: Map<number, HTMLElement>;
  logEl: HTMLElement;
  running: boolean;
  /** 回転のプレビュー（+ が時計回り）。指を離す・少し待つと、まとめて1回の回転として送る */
  preview: number;
  previewTimer: number | null;
  arrows: SVGSVGElement | null;
  lastFrame: number;
  acc: number;
  refs: Record<string, HTMLElement>;
}

let view: View | null = null;
/** ドラッグで回した直後のクリックは無視する（奥義や浄化が誤って出ないように） */
let lastDragAt = 0;

function startBattle(team: TeamSpec): void {
  const seed = randomSeed();
  const gen = createStream(seed, 5);
  const cpuTeam: TeamSpec = randomUnitIds(nextU32(gen)).map((unit) => ({ unit }));
  const state = createBattle(seed, team, cpuTeam);
  view = {
    state,
    cpu: createCpu(1, nextU32(gen)),
    pending: [],
    zero: false,
    mode: "none",
    unitEl: new Map(),
    wheelEl: new Map(),
    logEl: h("div", "log"),
    running: true,
    preview: 0,
    previewTimer: null,
    arrows: null,
    lastFrame: performance.now(),
    acc: 0,
    refs: {},
  };
  buildBattle(view);
  log(view, `相手：${cpuTeam.map((m) => UNITS.find((u) => u.id === m.unit)!.name).join("・")}`, "f");
  requestAnimationFrame(frame);
}

function unitName(v: View, uid: number): string {
  const p = v.state.players[uid < 6 ? 0 : 1];
  return (uid < 6 ? "" : "敵の") + def(p.units[uid % 6]).name;
}

function log(v: View, text: string, cls = ""): void {
  const p = h("p", cls, text);
  v.logEl.prepend(p);
  while (v.logEl.childElementCount > 120) v.logEl.lastElementChild!.remove();
}

function send(v: View, input: Input): void {
  v.pending.push(input);
}

function buildBattle(v: View): void {
  app.replaceChildren();
  const title = h("h1", "", "妖怪大戦");
  title.append(h("small", "", "試作版"));
  app.append(title, audioBar());

  const battle = h("section", "battle");
  const screens = h("div", "screens");

  // ---- 上画面 ----
  const top = h("div", "top");
  const hud = h("div", "hud");
  const foeRes = h("div", "reserve");
  const clock = h("div", "clock num");
  const allyRes = h("div", "reserve");
  hud.append(foeRes, clock, allyRes);
  const foeLine = h("div", "line foe-line");
  const allyLine = h("div", "line");
  const formation = h("div", "formation");
  top.append(hud, foeLine, allyLine, formation);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "arrows");
  svg.innerHTML =
    '<defs>' +
    '<marker id="ah-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#5fb3d9"/></marker>' +
    '<marker id="ah-f" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#e0655a"/></marker>' +
    '<marker id="ah-u" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#f2a541"/></marker>' +
    "</defs>";
  top.append(svg);
  v.arrows = svg;
  v.refs = { clock, foeRes, allyRes, foeLine, allyLine, formation, top };

  for (const pid of [1, 0] as const) {
    for (const u of v.state.players[pid].units) {
      const el = h("button", "unit " + (pid === 0 ? "ally" : "foe"));
      el.dataset.uid = String(u.uid);
      el.innerHTML =
        '<div class="nm"><span class="fig"></span><span class="n"></span><span class="st"></span></div>' +
        '<div class="bar hp"><i></i></div><div class="bar ag"><i></i></div><div class="bar sg"><i></i></div>' +
        '<div class="fx"></div><div class="eta num"></div>';
      el.onclick = () => onUnitClick(v, u);
      const fig = el.querySelector(".fig") as HTMLElement;
      fig.textContent = def(u).name.slice(0, 1);
      fig.style.background = TRIBE_COLOR[def(u).tribe];
      v.unitEl.set(u.uid, el);
    }
  }

  // ---- 下画面 ----
  const bottom = h("div", "bottom");
  const controls = h("div", "controls");
  const bUlt = h("button", "corner");
  const bTarget = h("button", "corner");
  const bPurify = h("button", "corner", "浄化");
  const bEmpty = h("button", "corner", "―");
  bEmpty.disabled = true;
  bEmpty.style.opacity = ".3";
  const wheel = h("div", "wheel");
  wheel.append(h("div", "cool"), h("div", "ring"), h("div", "half"));
  const z = h("button", "zbtn", "ゼロ");
  z.onclick = () => toggleZero(v);
  const rl = h("button", "rot l", "⟲");
  rl.title = "反時計回り（Q）";
  rl.onclick = () => queueRotate(v, -1);
  const rr = h("button", "rot r", "⟳");
  rr.title = "時計回り（E）";
  rr.onclick = () => queueRotate(v, 1);
  for (const u of v.state.players[0].units) {
    const s = h("button", "wslot");
    s.onclick = () => onWheelClick(v, u);
    v.wheelEl.set(u.index, s);
    wheel.append(s);
  }
  wheel.append(z, rl, rr);
  bindWheelDrag(v, wheel);
  bUlt.onclick = () => {
    v.mode = v.mode === "ult" ? "none" : "ult";
  };
  bTarget.onclick = () => {
    v.mode = "none";
  };
  bPurify.onclick = () => {
    v.mode = v.mode === "purify" ? "none" : "purify";
  };
  controls.append(bUlt, wheel, bTarget, bPurify, bEmpty);
  // 位置：左上・右上・左下・右下
  bUlt.style.gridArea = "1 / 1";
  bTarget.style.gridArea = "1 / 3";
  bPurify.style.gridArea = "2 / 1";
  bEmpty.style.gridArea = "2 / 3";
  const hint = h("div", "hint");
  const overlay = h("div", "overlay");
  overlay.hidden = true;
  bottom.append(controls, hint, overlay);
  v.refs = { ...v.refs, bottom, controls, bUlt, bTarget, hint, overlay, wheel };

  screens.append(top, bottom);
  battle.append(screens, v.logEl);
  app.append(battle);
}

function toggleZero(v: View): void {
  v.zero = !v.zero;
  v.mode = "none";
}

function onUnitClick(v: View, u: UnitState): void {
  const me = v.state.players[0];
  if (u.owner === 1) {
    if (v.zero) send(v, { t: "pokeStart", enemyUnit: u.index });
    else send(v, { t: "target", enemyUnit: u.index });
    return;
  }
  const pos = me.wheel.indexOf(u.index);
  if (pos < 3) tryUlt(v, pos);
}

function onWheelClick(v: View, u: UnitState): void {
  if (performance.now() - lastDragAt < 300) return;
  const pos = v.state.players[0].wheel.indexOf(u.index);
  if (pos >= 3) {
    send(v, { t: "purify", allySlot: pos });
    v.mode = "none";
  } else {
    tryUlt(v, pos);
  }
}

function tryUlt(v: View, pos: number): void {
  send(v, { t: "ultStart", allySlot: pos, grand: v.zero });
  v.mode = "none";
  if (v.zero) v.zero = false;
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

function bindWheelDrag(v: View, wheel: HTMLElement): void {
  let startAngle: number | null = null;
  const angle = (e: PointerEvent) => {
    const r = wheel.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };
  let total = 0;
  let prev = 0;
  wheel.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest(".zbtn, .rot")) return;
    if (v.state.players[0].rotateCooldown > 0) return;
    startAngle = angle(e);
    prev = startAngle;
    total = 0;
    wheel.setPointerCapture(e.pointerId);
  });
  wheel.addEventListener("pointermove", (e) => {
    if (startAngle === null) return;
    const a = angle(e);
    let d = a - prev;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    total += d;
    prev = a;
    v.preview = Math.max(-5, Math.min(5, Math.round(total / (Math.PI / 3))));
  });
  const end = () => {
    if (startAngle === null) return;
    startAngle = null;
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

// ---- ゲームの進行（1 tick = 50ms） ----

function frame(now: number): void {
  const v = view;
  if (!v || !v.running) return;
  v.acc += Math.min(now - v.lastFrame, 250);
  v.lastFrame = now;
  let steps = 0;
  while (v.acc >= 50 && steps < 5 && !v.state.outcome) {
    stepOnce(v);
    v.acc -= 50;
    steps++;
  }
  render(v);
  if (v.state.outcome) {
    v.running = false;
    showResult(v);
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
  for (const e of events) onEvent(v, e);
}

function float(v: View, uid: number, text: string, cls: string): void {
  const el = v.unitEl.get(uid);
  if (!el) return;
  const f = h("span", "float " + cls, text);
  el.append(f);
  setTimeout(() => f.remove(), 950);

}

function figOf(v: View, uid: number): HTMLElement | null {
  return (v.unitEl.get(uid)?.querySelector(".fig") as HTMLElement) ?? null;
}

/** モーションと効果音（画面だけのもの。戦闘は待たない） */
function present(v: View, e: BattleEvent): void {
  switch (e.t) {
    case "action": {
      const u = unitOf(v, e.uid);
      const fig = figOf(v, e.uid);
      if (!fig) return;
      const kind = M.UNIT_MOTION[def(u).id] ?? "dash";
      if (e.action === "attack") {
        M.playAction(fig, kind, u.owner === 0, "attack");
        S.sfxAttack(Math.min(1, def(u).attackPower / 150));
      } else if (e.action === "skill") {
        const color = M.ELEMENT_COLOR[def(u).skillElement];
        M.playAction(fig, kind, u.owner === 0, "skill", color);
        S.sfxSkill(def(u).skillElement);
      } else if (e.action === "guard") {
        M.playGuard(fig);
        S.sfxGuard();
      } else if (e.action === "loaf") {
        M.playLoaf(fig);
        S.sfxLoaf();
      }
      break;
    }
    case "curse": {
      const fig = figOf(v, e.src);
      if (fig) M.playCast(fig, "#b07ce0");
      if (e.result === "hit") S.sfxCurse();
      break;
    }
    case "bless": {
      const fig = figOf(v, e.src);
      if (fig) M.playCast(fig, "#4cc2a4");
      S.sfxBless();
      break;
    }
    case "ult": {
      const u = unitOf(v, e.uid);
      const fig = figOf(v, e.uid);
      const ult = def(u).ult;
      const color = "element" in ult && ult.element ? M.ELEMENT_COLOR[ult.element] : "#f2a541";
      if (fig) M.playAction(fig, M.UNIT_MOTION[def(u).id] ?? "dash", u.owner === 0, e.grand ? "grand" : "ult", color);
      M.flash(v.refs.top, color, e.grand);
      S.sfxUlt(e.grand);
      break;
    }
    case "damage": {
      const fig = figOf(v, e.dst);
      if (fig) M.playHit(fig, e.crit);
      if (e.crit) S.sfxCrit();
      else if (unitOf(v, e.dst).guarding && (e.source === "attack" || e.source === "skill")) S.sfxGuardedHit();
      break;
    }
    case "heal":
      if (e.amount >= 20) S.sfxHeal();
      break;
    case "ko": {
      const fig = figOf(v, e.uid);
      if (fig) M.playKo(fig);
      S.sfxKo();
      break;
    }
    case "rotate":
    case "forcedRotate":
      S.sfxRotate();
      break;
    case "stance":
      S.sfxStance(e.player === 1);
      break;
    case "suddenDeath":
      S.sfxAlarm();
      break;
    default:
      break;
  }
}

function onEvent(v: View, e: BattleEvent): void {
  present(v, e);
  const side = (uid: number) => (uid < 6 ? "a" : "f");
  switch (e.t) {
    case "damage":
      float(v, e.dst, String(e.amount), e.crit ? "crit" : "dmg");
      if (e.crit) log(v, `${unitName(v, e.src ?? e.dst)} のクリティカル！ ${e.amount}`, side(e.src ?? e.dst));
      if (e.source === "trait") log(v, `${unitName(v, e.dst)} に特性のダメージ ${e.amount}`, side(e.dst));
      break;
    case "heal":
      if (e.amount > 0) float(v, e.dst, "+" + e.amount, "heal");
      break;
    case "action":
      if (e.action === "loaf") {
        float(v, e.uid, "なまけ", "info");
        log(v, `${unitName(v, e.uid)} はなまけている`, side(e.uid));
      } else if (e.action === "guard") float(v, e.uid, "守り", "info");
      break;
    case "curse":
      if (e.result === "hit") {
        float(v, e.dst, CURSE[e.kind] + TIER[e.tier], "info");
        log(v, `${unitName(v, e.src)} → ${unitName(v, e.dst)} に ${CURSE[e.kind]}${TIER[e.tier]}`, side(e.src));
      } else {
        float(v, e.dst, e.result === "miss" ? "呪付 失敗" : "呪付 無効", "info");
      }
      break;
    case "bless":
      float(v, e.dst, BLESS[e.kind] + TIER[e.tier], "info");
      break;
    case "ko":
      log(v, `${unitName(v, e.uid)} が倒れた`, side(e.uid));
      break;
    case "ult": {
      const q = e.quality === "perfect" ? "Perfect" : e.quality === "good" ? "Good" : "Miss";
      log(v, `${unitName(v, e.uid)} の${e.grand ? "大奥義" : "奥義"}「${def(unitOf(v, e.uid)).ultName}」 ${q}`, side(e.uid));
      break;
    }
    case "stance":
      if (e.player === 1) log(v, `${unitName(v, e.uid)} が${e.grand ? "大奥義" : "奥義"}を構えた！`, "f");
      break;
    case "stanceCancel":
      if (e.player === 0 && e.reason !== "input") log(v, "構えがキャンセルされた", "a");
      break;
    case "doll":
      log(v, `${unitName(v, e.uid)} は身代わり人形で耐えた`, side(e.uid));
      break;
    case "endure":
      float(v, e.uid, "踏ん張り", "info");
      log(v, `${unitName(v, e.uid)} は踏ん張った`, side(e.uid));
      break;
    case "firstStrike":
      float(v, e.uid, "先駆け", "info");
      break;
    case "forcedRotate":
      log(v, `${e.player === 0 ? "こちら" : "相手"}の前衛が全滅して、ホイールが回った`, e.player === 0 ? "a" : "f");
      break;
    case "suddenDeath":
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

function unitOf(v: View, uid: number): UnitState {
  return v.state.players[uid < 6 ? 0 : 1].units[uid % 6];
}

// ---- 描画 ----

function pct(n: number, d: number): string {
  return `${Math.max(0, Math.min(100, (n * 100) / d))}%`;
}

/** 攻撃するならだれを狙うか（§4.4） */
function aimName(v: View, u: UnitState): string {
  const t = pickEnemyTarget(v.state.players[u.owner], v.state.players[1 - u.owner]);
  return t ? def(t).name : "―";
}

function renderUnit(v: View, u: UnitState, el: HTMLElement): void {
  const p = v.state.players[u.owner];
  const me = v.state.players[0];
  const d = def(u);
  (el.querySelector(".n") as HTMLElement).textContent = d.name;
  const st = el.querySelector(".st") as HTMLElement;
  st.textContent = `HP ${u.hp}/${u.maxHp}`;
  (el.querySelector(".hp i") as HTMLElement).style.width = pct(u.hp, u.maxHp);
  el.querySelector(".hp")!.classList.toggle("low", hpRatio(u) <= 250);
  const need = Math.max(1, agNeeded(p, u));
  (el.querySelector(".ag i") as HTMLElement).style.width = pct(u.ag, need);
  (el.querySelector(".sg i") as HTMLElement).style.width = pct(u.sg, C.SG_FULL);
  el.querySelector(".sg")!.classList.toggle("full", u.sg >= C.SG_FULL);
  const eta = el.querySelector(".eta") as HTMLElement;
  const front = p.wheel.indexOf(u.index) < 3;
  eta.textContent = !isAlive(u)
    ? ""
    : p.stance && (p.stance.unit === u.index || p.stance.partners.includes(u.index))
      ? "構え中"
      : u.pendingAction
        ? "敵待ち"
        : front
          ? `次の行動まで ${secs(Math.max(0, Math.ceil((need - u.ag) / C.AG_PER_TICK)))} 秒 → ${aimName(v, u)}`
          : "";
  const fx = el.querySelector(".fx") as HTMLElement;
  const chips: string[] = [];
  if (u.curse) chips.push(`<span class="chip c">${CURSE[u.curse.kind]}${TIER[u.curse.tier]} ${secs(u.curse.remaining)}</span>`);
  if (u.blessing) chips.push(`<span class="chip b">${BLESS[u.blessing.kind]} ${secs(u.blessing.remaining)}</span>`);
  if (u.guarding) chips.push('<span class="chip g">守り</span>');
  if (u.loafing) chips.push('<span class="chip l">なまけ中</span>');
  const html = chips.join("");
  if (fx.innerHTML !== html) fx.innerHTML = html;
  el.classList.toggle("dead", !isAlive(u));
  const st2 = p.stance;
  el.classList.toggle("stance", !!st2 && (st2.unit === u.index || st2.partners.includes(u.index)));
  el.classList.toggle("grand", !!st2 && st2.grand);
  el.classList.toggle("targeted", u.owner === 1 && me.target === u.index);
  el.classList.toggle("pokeable", u.owner === 1 && v.zero && isAlive(u) && (u.curse !== null || u.loafing));
  el.classList.toggle("pick", u.owner === 0 && v.mode === "ult" && u.sg >= C.SG_FULL && isAlive(u));
}

function render(v: View): void {
  const s = v.state;
  const r = v.refs;
  // 時計
  const left = s.tick < C.SUDDEN_DEATH_TICKS ? C.SUDDEN_DEATH_TICKS - s.tick : C.TIME_LIMIT_TICKS - s.tick;
  const sec = Math.max(0, Math.ceil(left / C.TICKS_PER_SEC));
  r.clock.textContent = `${s.tick >= C.SUDDEN_DEATH_TICKS ? "サドンデス " : ""}${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  r.clock.classList.toggle("sudden", s.tick >= C.SUDDEN_DEATH_TICKS);
  // 前衛
  for (const pid of [0, 1] as const) {
    const p = s.players[pid];
    const line = pid === 0 ? r.allyLine : r.foeLine;
    const want = [0, 1, 2].map((pos) => v.unitEl.get(p.units[p.wheel[pos]].uid)!);
    if (want.some((el, i) => line.children[i] !== el)) line.replaceChildren(...want);
    for (const el of want) renderUnit(v, unitOf(v, Number(el.dataset.uid)), el);
    // 後衛の SG
    const res = pid === 0 ? r.allyRes : r.foeRes;
    const back = [3, 4, 5].map((pos) => p.units[p.wheel[pos]]);
    res.innerHTML = back
      .map((u) => `<span class="${isAlive(u) ? "" : "dead"}" title="${def(u).name}"><i style="width:${pct(u.sg, C.SG_FULL)}"></i></span>`)
      .join("");
  }
  drawArrows(v);
  // 陣
  const me = s.players[0];
  const forms = new Set<string>();
  for (let pos = 0; pos < 3; pos++) {
    const u = me.units[me.wheel[pos]];
    const f = formationPermil(me, u);
    if (f > 0) forms.add(`${TRIBE[def(u).tribe]}の陣 +${f / 10}%`);
  }
  r.formation.textContent = forms.size ? `こちらの陣：${[...forms].join("・")}` : "";

  // ホイール
  const rad = r.wheel.clientWidth / 2;
  const R = rad - 32;
  for (const u of me.units) {
    const el = v.wheelEl.get(u.index)!;
    const pos = me.wheel.indexOf(u.index);
    const shown = (((pos + v.preview) % 6) + 6) % 6;
    const ang = ((-150 + shown * 60) * Math.PI) / 180;
    el.style.left = `${rad + R * Math.cos(ang)}px`;
    el.style.top = `${rad + R * Math.sin(ang)}px`;
    const label = `<b>${def(u).name.slice(0, 3)}</b><br><span class="num">${Math.round((u.sg * 100) / C.SG_FULL)}%</span>`;
    if (el.innerHTML !== label) el.innerHTML = label;
    el.classList.toggle("front", shown < 3);
    el.classList.toggle("dead", !isAlive(u));
    el.classList.toggle("cursed", !!u.curse);
    el.classList.toggle("purifying", me.purify?.unit === u.index);
    el.classList.toggle("pick", (v.mode === "purify" && pos >= 3 && !!u.curse) || (v.mode === "ult" && pos < 3 && u.sg >= C.SG_FULL));
    el.title = `${def(u).name}　HP ${u.hp}/${u.maxHp}${u.curse ? "　" + CURSE[u.curse.kind] : ""}`;
  }
  const cool = r.wheel.querySelector(".cool") as HTMLElement;
  const cd = me.rotateCooldown / C.ROTATE_COOLDOWN;
  cool.style.background = cd > 0 ? `conic-gradient(var(--lantern) ${cd * 360}deg, transparent 0)` : "transparent";
  cool.style.mask = "radial-gradient(circle, transparent 66%, #000 67%)";

  r.wheel.classList.toggle("previewing", v.preview !== 0);
  r.controls.classList.toggle("zero", v.zero);
  r.bottom.classList.toggle("zero", v.zero);
  r.bUlt.textContent = v.zero ? "大奥義" : "奥義";
  r.bTarget.textContent = v.zero ? "つつき" : "標的";
  r.bUlt.classList.toggle("on", v.mode === "ult");
  r.hint.textContent = hintText(v);
  renderOverlay(v);
}

/** だれがだれを狙っているか（§4.4 のねらい）。もうすぐ動くユニットほど濃く・太く */
function drawArrows(v: View): void {
  const svg = v.arrows;
  if (!svg) return;
  const box = v.refs.top.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
  const center = (uid: number) => {
    const r = v.unitEl.get(uid)!.getBoundingClientRect();
    return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2, h: r.height };
  };
  const lines: string[] = [];
  for (const pid of [0, 1] as const) {
    const p = v.state.players[pid];
    const e = v.state.players[1 - pid];
    const t = pickEnemyTarget(p, e);
    if (!t) continue;
    const to = center(t.uid);
    [0, 1, 2].forEach((pos, i) => {
      const u = p.units[p.wheel[pos]];
      if (!isAlive(u)) return;
      const stance = p.stance?.unit === u.index;
      const progress = Math.min(1, u.ag / Math.max(1, agNeeded(p, u)));
      const from = center(u.uid);
      const dx = (i - 1) * 10;
      const y1 = from.y + (pid === 0 ? -from.h / 2 : from.h / 2);
      const y2 = to.y + (pid === 0 ? to.h / 2 : -to.h / 2);
      const color = stance ? "#f2a541" : pid === 0 ? "#5fb3d9" : "#e0655a";
      const marker = stance ? "ah-u" : pid === 0 ? "ah-a" : "ah-f";
      const op = stance ? 1 : 0.15 + 0.85 * progress * progress;
      const w = stance ? 5 : 1.5 + 2.5 * progress;
      lines.push(
        `<line x1="${from.x + dx}" y1="${y1}" x2="${to.x + dx}" y2="${y2}" stroke="${color}" stroke-width="${w}" stroke-opacity="${op}" marker-end="url(#${marker})"${stance ? ' stroke-dasharray="8 5"' : ""}/>`,
      );
    });
  }
  const g = lines.join("");
  let layer = svg.querySelector("g");
  if (!layer) {
    layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.append(layer);
  }
  if (layer.innerHTML !== g) layer.innerHTML = g;
}

function hintText(v: View): string {
  const me = v.state.players[0];
  if (v.mode === "ult") return v.zero ? "大奥義を撃つ前衛を選ぶ（自分と両隣の妖気が満タン）" : "奥義を撃つ前衛を選ぶ（妖気が満タン）";
  if (v.mode === "purify") return "浄化する後衛（呪付のかかったユニット）を選ぶ";
  if (v.zero) return "ゼロ：光っている敵をクリックでつつき。奥義ボタンは大奥義になる";
  if (v.preview !== 0) return `${Math.abs(v.preview)} つ分${v.preview > 0 ? "時計回り" : "反時計回り"}に回す（離すと決定）`;
  if (me.rotateCooldown > 0) return `回転まで ${secs(me.rotateCooldown)} 秒`;
  return "敵をクリックで標的。前衛の妖気が満タンならクリックで奥義";
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
      ring.title = "クリックで解放（Space）";
      ring.onclick = () => send(v, { t: "ultRelease" });
      for (let i = 0; i < C.SKILL_CURSOR_PERIOD; i++) {
        const seg = h("span", "seg" + (C.PERFECT_CELLS.includes(i) ? " perfect" : C.GOOD_CELLS.includes(i) ? " good" : ""));
        const a = ((-90 + (i * 360) / C.SKILL_CURSOR_PERIOD) * Math.PI) / 180;
        seg.style.transform = `translate(${60 * Math.cos(a)}px, ${60 * Math.sin(a)}px)`;
        ring.append(seg);
      }
      ring.append(h("span", "face", "解放"));
      const row = h("div", "row");
      const rel = h("button", "btn primary", "解放（Space）");
      rel.onclick = () => send(v, { t: "ultRelease" });
      const can = h("button", "btn", "キャンセル（Esc）");
      can.onclick = () => send(v, { t: "ultCancel" });
      row.append(rel, can);
      const note = h("div", "help", "橙が Perfect、緑が Good。溜めるほど強いが、2秒を超えると自動で Miss。");
      ov.append(title, chargeEl, ring, row, note);
    }
    const chargeEl = ov.querySelector(".charge") as HTMLElement;
    chargeEl.innerHTML =
      `溜め ${[1, 2, 3].map((t) => `<span class="${t <= tier ? "on" : ""}"></span>`).join("")} ×${mult}` +
      `　残り ${secs(Math.max(0, C.CHARGE_MAX_TICKS - charge))} 秒`;
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
      for (let i = 0; i < C.POKE_CELLS; i++) {
        const c = h("button", "cell");
        c.onpointerdown = (e) => {
          e.preventDefault();
          const k = v.state.players[0].poke;
          S.sfxPoke(!!k && k.weakCell === i);
          send(v, { t: "pokeTap", cell: i });
        };
        grid.append(c);
      }
      const stop = h("button", "btn", "やめる（Esc）");
      stop.onclick = () => send(v, { t: "pokeStop" });
      ov.append(title, gauge, info, grid, stop);
    }
    (ov.querySelector(".gauge i") as HTMLElement).style.width = pct(k.gauge, C.POKE_GAUGE_GOAL);
    (ov.querySelector(".help") as HTMLElement).textContent =
      `残り ${secs(C.POKE_TICKS - k.elapsed)} 秒　ゲージ ${k.gauge}/${C.POKE_GAUGE_GOAL}（★を連打）`;
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
    startBattle(picked.map((unit) => ({ unit })));
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
