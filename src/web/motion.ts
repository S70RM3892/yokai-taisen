// キャラごとのモーション（PLAN.md §9.2）。
// - 演出は画面だけのもの。戦闘の tick は待たない。
// - 通常攻撃・術は 0.5〜1 秒に収める。奥義だけ少し長い。
// - 演出は「戦闘のイベント」から作る（入力からではない）ので、観戦・リプレイでも同じになる。

export type MotionKind =
  | "smash" // 振りかぶって叩きつける
  | "charge" // 長い距離を突進
  | "dash" // 素早く踏み込んで戻る
  | "slash" // 小刻みに3回斬る
  | "pounce" // 跳びかかる
  | "hop" // 跳ねる
  | "float" // 浮いて滑るように
  | "stretch" // 首が伸びる
  | "spin" // くるっと回る
  | "sway" // 左右に揺れる
  | "slam" // 押しつぶす
  | "wave" // 布のようにたなびく
  | "flicker" // ゆらめく
  | "rattle" // カタカタ震える
  | "glow"; // 光って膨らむ

/** ユニットごとの動き方。見た目の個性なので、戦闘の中身（src/core）には入れない */
export const UNIT_MOTION: Record<string, MotionKind> = {
  oni: "smash",
  karakasa: "hop",
  yukionna: "float",
  nekomata: "pounce",
  kappa: "hop",
  ogama: "slam",
  bakedanuki: "spin",
  rokurokubi: "stretch",
  zashiki: "sway",
  kodama: "sway",
  tengu: "dash",
  kamaitachi: "slash",
  shuten: "smash",
  ushioni: "charge",
  otakemaru: "float",
  nurikabe: "slam",
  ittan: "wave",
  onibi: "flicker",
  kasha: "charge",
  kyokotsu: "rattle",
  waira: "slam",
  komainu: "pounce",
  yamabiko: "sway",
  hakutaku: "glow",
};

export const ELEMENT_COLOR: Record<string, string> = {
  fire: "#ff7a3d",
  water: "#4fa8ff",
  thunder: "#ffe04a",
  earth: "#c79a5a",
  ice: "#aee8ff",
  wind: "#8be3a8",
};

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** 前に出る向き。味方は上（敵のほう）、敵は下 */
function frames(kind: MotionKind, dir: number, power: number): Keyframe[] {
  const f = (x: number, y: number, extra = "") => `translate(${x}px, ${y * dir * power}px) ${extra}`;
  switch (kind) {
    case "smash":
      return [
        { transform: f(0, 0) },
        { transform: f(0, 10, "rotate(-12deg) scale(1.05)"), offset: 0.35 },
        { transform: f(0, -34, "rotate(10deg) scale(1.25)"), offset: 0.55 },
        { transform: f(0, -26, "scale(1.1, 0.9)"), offset: 0.7 },
        { transform: f(0, 0) },
      ];
    case "charge":
      return [
        { transform: f(0, 0) },
        { transform: f(0, 8, "scale(0.95)"), offset: 0.2 },
        { transform: f(0, -48, "scale(1.15)"), offset: 0.55 },
        { transform: f(0, -40, "scale(1.05, 0.9)"), offset: 0.7 },
        { transform: f(0, 0) },
      ];
    case "dash":
      return [
        { transform: f(0, 0) },
        { transform: f(6, -30, "skewX(-18deg)"), offset: 0.4 },
        { transform: f(-4, -24, "skewX(8deg)"), offset: 0.6 },
        { transform: f(0, 0) },
      ];
    case "slash":
      return [
        { transform: f(0, 0) },
        { transform: f(-10, -18, "rotate(-20deg)"), offset: 0.2 },
        { transform: f(10, -22, "rotate(20deg)"), offset: 0.4 },
        { transform: f(-8, -24, "rotate(-16deg)"), offset: 0.6 },
        { transform: f(0, -10), offset: 0.8 },
        { transform: f(0, 0) },
      ];
    case "pounce":
      return [
        { transform: f(0, 0) },
        { transform: f(0, 4, "scale(1.1, 0.85)"), offset: 0.2 },
        { transform: f(0, -30, "scale(0.9, 1.15)") , offset: 0.5 },
        { transform: f(0, -20, "scale(1.1, 0.9)"), offset: 0.7 },
        { transform: f(0, 0) },
      ];
    case "hop":
      return [
        { transform: f(0, 0) },
        { transform: f(0, -14, "rotate(-8deg)"), offset: 0.25 },
        { transform: f(0, -4), offset: 0.45 },
        { transform: f(0, -20, "rotate(8deg)"), offset: 0.7 },
        { transform: f(0, 0) },
      ];
    case "float":
      return [
        { transform: f(0, 0), opacity: 1 },
        { transform: f(-6, -10), opacity: 0.8, offset: 0.4 },
        { transform: f(6, -18, "scale(1.08)"), opacity: 1, offset: 0.7 },
        { transform: f(0, 0), opacity: 1 },
      ];
    case "stretch":
      return [
        { transform: f(0, 0) },
        { transform: f(0, -24, `scaleY(${1.8})`), offset: 0.45 },
        { transform: f(0, -18, "scaleY(1.5)"), offset: 0.6 },
        { transform: f(0, 0) },
      ];
    case "spin":
      return [
        { transform: f(0, 0, "rotate(0deg)") },
        { transform: f(0, -16, "rotate(200deg) scale(1.1)"), offset: 0.5 },
        { transform: f(0, 0, "rotate(360deg)") },
      ];
    case "sway":
      return [
        { transform: f(0, 0) },
        { transform: f(-10, -6, "rotate(-10deg)"), offset: 0.3 },
        { transform: f(10, -12, "rotate(10deg)"), offset: 0.65 },
        { transform: f(0, 0) },
      ];
    case "slam":
      return [
        { transform: f(0, 0) },
        { transform: f(0, -8, "scale(0.9, 1.2)"), offset: 0.35 },
        { transform: f(0, -22, "scale(1.35, 0.7)"), offset: 0.6 },
        { transform: f(0, 0) },
      ];
    case "wave":
      return [
        { transform: f(0, 0, "skewY(0deg)") },
        { transform: f(8, -12, "skewY(14deg)"), offset: 0.3 },
        { transform: f(-8, -22, "skewY(-14deg)"), offset: 0.65 },
        { transform: f(0, 0) },
      ];
    case "flicker":
      return [
        { transform: f(0, 0), opacity: 1 },
        { transform: f(0, -10, "scale(1.2)"), opacity: 0.4, offset: 0.25 },
        { transform: f(0, -18, "scale(0.9)"), opacity: 1, offset: 0.5 },
        { transform: f(0, -12, "scale(1.25)"), opacity: 0.5, offset: 0.75 },
        { transform: f(0, 0), opacity: 1 },
      ];
    case "rattle":
      return [
        { transform: f(0, 0) },
        { transform: f(-4, -6, "rotate(-8deg)"), offset: 0.15 },
        { transform: f(4, -10, "rotate(8deg)"), offset: 0.3 },
        { transform: f(-4, -14, "rotate(-8deg)"), offset: 0.45 },
        { transform: f(4, -18, "rotate(8deg)"), offset: 0.6 },
        { transform: f(0, 0) },
      ];
    case "glow":
      return [
        { transform: f(0, 0), filter: "brightness(1)" },
        { transform: f(0, -10, "scale(1.3)"), filter: "brightness(1.8)", offset: 0.5 },
        { transform: f(0, 0), filter: "brightness(1)" },
      ];
  }
}

export type Act = "attack" | "skill" | "ult" | "grand";

/** 行動のモーション。攻撃・術は 0.5〜0.8 秒、奥義は 1 秒前後 */
export function playAction(fig: HTMLElement, kind: MotionKind, ally: boolean, act: Act, color?: string): void {
  if (reduced()) return;
  const dir = ally ? 1 : -1;
  const power = act === "grand" ? 1.9 : act === "ult" ? 1.5 : act === "skill" ? 0.8 : 1;
  const duration = act === "grand" ? 1100 : act === "ult" ? 950 : act === "skill" ? 650 : 560;
  fig.animate(frames(kind, dir, power), { duration, easing: "cubic-bezier(.3,.7,.3,1)" });
  if (color) {
    fig.animate(
      [
        { boxShadow: `0 0 0 0 ${color}` },
        { boxShadow: `0 0 ${act === "skill" ? 18 : 30}px 6px ${color}`, offset: 0.5 },
        { boxShadow: `0 0 0 0 ${color}` },
      ],
      { duration },
    );
  }
}

export function playHit(fig: HTMLElement, crit: boolean): void {
  if (reduced()) return;
  const a = crit ? 8 : 4;
  fig.animate(
    [
      { transform: "translateX(0)", filter: "brightness(1)" },
      { transform: `translateX(${a}px)`, filter: "brightness(2.2)", offset: 0.2 },
      { transform: `translateX(${-a}px)`, offset: 0.45 },
      { transform: `translateX(${a / 2}px)`, offset: 0.7 },
      { transform: "translateX(0)", filter: "brightness(1)" },
    ],
    { duration: crit ? 380 : 260 },
  );
}

export function playGuard(fig: HTMLElement): void {
  if (reduced()) return;
  fig.animate(
    [
      { transform: "scale(1)", boxShadow: "0 0 0 0 #5fb3d9" },
      { transform: "scale(0.9)", boxShadow: "0 0 0 6px #5fb3d9", offset: 0.4 },
      { transform: "scale(1)", boxShadow: "0 0 0 0 #5fb3d9" },
    ],
    { duration: 500 },
  );
}

export function playLoaf(fig: HTMLElement): void {
  if (reduced()) return;
  fig.animate(
    [
      { transform: "rotate(0) translateY(0)" },
      { transform: "rotate(18deg) translateY(4px)", offset: 0.4 },
      { transform: "rotate(14deg) translateY(4px)", offset: 0.8 },
      { transform: "rotate(0) translateY(0)" },
    ],
    { duration: 900 },
  );
}

export function playCast(fig: HTMLElement, color: string): void {
  if (reduced()) return;
  fig.animate(
    [
      { transform: "translateY(0)", boxShadow: `0 0 0 0 ${color}` },
      { transform: "translateY(-6px)", boxShadow: `0 0 16px 4px ${color}`, offset: 0.5 },
      { transform: "translateY(0)", boxShadow: `0 0 0 0 ${color}` },
    ],
    { duration: 600 },
  );
}

export function playKo(fig: HTMLElement): void {
  if (reduced()) return;
  fig.animate(
    [
      { transform: "rotate(0) translateY(0)", opacity: 1 },
      { transform: "rotate(-30deg) translateY(6px)", opacity: 0.6, offset: 0.5 },
      { transform: "rotate(-90deg) translateY(10px)", opacity: 0.3 },
    ],
    { duration: 700, fill: "none" },
  );
}

/** 奥義のときに上画面を一瞬光らせる */
export function flash(el: HTMLElement, color: string, strong: boolean): void {
  if (reduced()) return;
  el.animate(
    [{ boxShadow: `inset 0 0 0 0 ${color}` }, { boxShadow: `inset 0 0 ${strong ? 120 : 60}px 10px ${color}` }, { boxShadow: `inset 0 0 0 0 ${color}` }],
    { duration: strong ? 900 : 600 },
  );
}

/** 待機中のゆれ方（CSS のアニメーション名）。いつも動いていて、画面が止まらないようにする */
export const IDLE_STYLE: Record<MotionKind, string> = {
  smash: "idle-heavy",
  charge: "idle-heavy",
  slam: "idle-heavy",
  dash: "idle-bounce",
  slash: "idle-bounce",
  pounce: "idle-bounce",
  hop: "idle-hop",
  float: "idle-float",
  wave: "idle-float",
  flicker: "idle-flicker",
  glow: "idle-float",
  stretch: "idle-sway",
  sway: "idle-sway",
  spin: "idle-sway",
  rattle: "idle-rattle",
};

/** 行動の直前のセリフ（オリジナル）。本家の「参る」のように、だれが動くかを知らせる */
export const CALL_LINE: Record<string, string> = {
  oni: "ぶっ潰す！",
  karakasa: "からかさ参上！",
  yukionna: "凍てつけ…",
  nekomata: "爪の餌食よ",
  kappa: "皿が乾く前に！",
  ogama: "ゲコォ！",
  bakedanuki: "化かしてやる！",
  rokurokubi: "のびーるよ",
  zashiki: "あそぼ？",
  kodama: "……コダマ",
  tengu: "喝ッ！",
  kamaitachi: "斬る！",
  shuten: "酒の肴だ！",
  ushioni: "踏み潰す",
  otakemaru: "神通力を見よ",
  nurikabe: "通さぬ",
  ittan: "ひらり〜",
  onibi: "燃えろ…",
  kasha: "亡者はどこだ",
  kyokotsu: "恨めしや…",
  waira: "掘り返す！",
  komainu: "阿ッ！",
  yamabiko: "ヤッホー！",
  hakutaku: "見えておるぞ",
};

/** 声の高さ（Hz）。大きい・重いキャラほど低い */
export const VOICE_PITCH: Record<string, number> = {
  oni: 140, karakasa: 330, yukionna: 520, nekomata: 480, kappa: 360, ogama: 110,
  bakedanuki: 260, rokurokubi: 440, zashiki: 620, kodama: 700, tengu: 220, kamaitachi: 400,
  shuten: 120, ushioni: 95, otakemaru: 160, nurikabe: 90, ittan: 560, onibi: 600,
  kasha: 240, kyokotsu: 300, waira: 150, komainu: 280, yamabiko: 520, hakutaku: 200,
};

// ---- 自動生成の妖怪は looks.gen.ts から ----
import { LOOKS } from "./looks.gen.js";

export function motionOf(id: string): MotionKind {
  return UNIT_MOTION[id] ?? LOOKS[id]?.motion ?? "dash";
}
export function lineOf(id: string): string {
  return CALL_LINE[id] ?? LOOKS[id]?.line ?? "参る！";
}
export function pitchOf(id: string): number {
  return VOICE_PITCH[id] ?? LOOKS[id]?.pitch ?? 300;
}
