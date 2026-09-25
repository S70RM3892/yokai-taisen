// 上画面の 3D 戦闘シーン（three.js）。配置は本家と同じ：敵の前衛3体が奥、味方の前衛3体が手前（後ろ姿）。
// 見た目（舞台・キャラ・エフェクト）はすべてオリジナル。戦闘の中身には関わらず、状態とイベントから演出を作る。

import * as THREE from "three";
import type { MotionKind } from "./motion.js";

export interface Figure {
  uid: number;
  ally: boolean;
  root: THREE.Group;
  sprite: THREE.Sprite;
  shadow: THREE.Mesh;
  ring: THREE.Mesh;
  home: THREE.Vector3;
  motion: MotionKind;
  phase: number;
  anim: Anim | null;
  alive: boolean;
  flash: number;
  shake: number;
}

interface Anim {
  t: number;
  dur: number;
  kind: "lunge" | "cast" | "ult" | "ko" | "guard" | "loaf";
  to?: THREE.Vector3;
  power: number;
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  max: number;
}

interface Projectile {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
  color: number;
  big: boolean;
}

const X = [-2.6, 0, 2.6];
const Z_FOE = -2.2;
const Z_ALLY = 2.4;

export class BattleScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private figs = new Map<number, Figure>();
  private particles: Particle[] = [];
  private projectiles: Projectile[] = [];
  private camShake = 0;
  private flashPlane: THREE.Mesh;
  private flashLevel = 0;
  private clock = 0;
  private reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.camera = new THREE.PerspectiveCamera(42, 5 / 3, 0.1, 100);
    this.camera.position.set(0, 3.4, 8.2);
    this.camera.lookAt(0, 0.9, -0.6);
    this.buildStage();
    const fm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false });
    this.flashPlane = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), fm);
    this.flashPlane.position.set(0, 2, 5);
    this.flashPlane.renderOrder = 999;
    this.scene.add(this.flashPlane);
  }

  // ---- 舞台（オリジナル：夜の社の石畳。奥に山と塔の影、月） ----
  private buildStage(): void {
    this.scene.background = new THREE.Color(0x1b1733);
    this.scene.fog = new THREE.Fog(0x1b1733, 14, 30);

    // 空
    const sky = document.createElement("canvas");
    sky.width = 1024;
    sky.height = 512;
    const g = sky.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#141a3a");
    grad.addColorStop(0.55, "#3b2e63");
    grad.addColorStop(1, "#c8746a");
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 512);
    g.fillStyle = "#f6e7b8";
    g.beginPath();
    g.arc(790, 120, 46, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,.7)";
    for (let i = 0; i < 90; i++) g.fillRect((i * 173) % 1024, (i * 97) % 260, 2, 2);
    g.fillStyle = "#1d1838";
    g.beginPath();
    g.moveTo(0, 420);
    for (let x = 0; x <= 1024; x += 64) g.lineTo(x, 360 + Math.sin(x / 90) * 40 + Math.cos(x / 37) * 18);
    g.lineTo(1024, 512);
    g.lineTo(0, 512);
    g.fill();
    // 塔の影
    g.fillStyle = "#120f26";
    const tower = (cx: number, base: number, w: number, tiers: number) => {
      for (let i = 0; i < tiers; i++) {
        const y = base - i * 34;
        const ww = w - i * 10;
        g.beginPath();
        g.moveTo(cx - ww, y);
        g.lineTo(cx + ww, y);
        g.lineTo(cx + ww * 0.6, y - 16);
        g.lineTo(cx - ww * 0.6, y - 16);
        g.fill();
        g.fillRect(cx - ww * 0.4, y - 34, ww * 0.8, 20);
      }
      g.fillRect(cx - 2, base - tiers * 34 - 30, 4, 30);
    };
    tower(230, 430, 60, 5);
    tower(880, 450, 40, 3);
    const skyTex = new THREE.CanvasTexture(sky);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(44, 22), new THREE.MeshBasicMaterial({ map: skyTex, fog: false }));
    back.position.set(0, 7, -14);
    this.scene.add(back);

    // 石畳
    const floor = document.createElement("canvas");
    floor.width = 512;
    floor.height = 512;
    const f = floor.getContext("2d")!;
    f.fillStyle = "#4a4458";
    f.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const off = (y % 2) * 32;
        const shade = 60 + ((x * 7 + y * 13) % 5) * 6;
        f.fillStyle = `rgb(${shade + 6},${shade},${shade + 18})`;
        f.fillRect(x * 64 + off + 2, y * 64 + 2, 60, 60);
      }
    }
    const floorTex = new THREE.CanvasTexture(floor);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(4, 3);
    floorTex.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(28, 20), new THREE.MeshLambertMaterial({ map: floorTex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -2;
    this.scene.add(ground);

    // 左右の低い塀と灯籠
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x6b2f3a });
    const capMat = new THREE.MeshLambertMaterial({ color: 0x2a2440 });
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 14), wallMat);
      wall.position.set(side * 6.4, 0.55, -3);
      this.scene.add(wall);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 14.2), capMat);
      cap.position.set(side * 6.4, 1.18, -3);
      this.scene.add(cap);
      for (const z of [-7, -1]) {
        const lantern = new THREE.Group();
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.2, 8), capMat);
        post.position.y = 0.6;
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.45, 0.45),
          new THREE.MeshBasicMaterial({ color: 0xf2a541 }),
        );
        box.position.y = 1.4;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.3, 4), capMat);
        roof.position.y = 1.78;
        roof.rotation.y = Math.PI / 4;
        lantern.add(post, box, roof);
        lantern.position.set(side * 5.4, 0, z);
        this.scene.add(lantern);
        const light = new THREE.PointLight(0xf2a541, 6, 7, 1.6);
        light.position.set(side * 5.4, 1.5, z);
        this.scene.add(light);
      }
    }
    this.scene.add(new THREE.AmbientLight(0x8a86b8, 1.6));
    const moon = new THREE.DirectionalLight(0xffe9c0, 1.2);
    moon.position.set(4, 8, 3);
    this.scene.add(moon);
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** キャラを作る。art はキャラの絵の SVG 文字列 */
  addFigure(uid: number, ally: boolean, svg: string, tint: string, motion: MotionKind): void {
    const tex = svgTexture(svg, ally ? tint : null);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.9, 1.9, 1);
    sprite.position.y = 0.95;
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.86, 40),
      new THREE.MeshBasicMaterial({ color: 0xf2a541, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    const root = new THREE.Group();
    root.add(shadow, ring, sprite);
    root.visible = false;
    this.scene.add(root);
    this.figs.set(uid, {
      uid, ally, root, sprite, shadow, ring,
      home: new THREE.Vector3(), motion, phase: (uid * 1.37) % 6.28, anim: null, alive: true, flash: 0, shake: 0,
    });
  }

  /** 前衛の並び（位置 0〜2 のユニット）。前衛から外れたキャラは隠す */
  setLine(ally: boolean, uids: number[]): void {
    const z = ally ? Z_ALLY : Z_FOE;
    for (const fig of this.figs.values()) {
      if (fig.ally !== ally) continue;
      const i = uids.indexOf(fig.uid);
      if (i < 0) {
        fig.root.visible = false;
        continue;
      }
      const home = new THREE.Vector3(X[i], 0, z);
      if (!fig.root.visible) {
        fig.root.position.copy(home).add(new THREE.Vector3(0, 0, ally ? 2 : -2));
        fig.root.visible = true;
      }
      fig.home.copy(home);
    }
  }

  setAlive(uid: number, alive: boolean): void {
    const f = this.figs.get(uid);
    if (f) f.alive = alive;
  }

  setStance(uid: number, on: boolean, grand: boolean): void {
    const f = this.figs.get(uid);
    if (!f) return;
    const m = f.ring.material as THREE.MeshBasicMaterial;
    m.opacity = on ? 0.9 : 0;
    m.color.set(grand ? 0xf2d15c : 0xf2a541);
  }

  // ---- 演出 ----

  action(uid: number, targetUid: number | null, kind: "attack" | "skill" | "ult" | "grand", color: number): void {
    const f = this.figs.get(uid);
    if (!f) return;
    const target = targetUid !== null ? this.figs.get(targetUid) : undefined;
    const melee = kind === "attack" || ["smash", "charge", "dash", "slash", "pounce", "hop", "slam"].includes(f.motion);
    if (kind === "attack" || (melee && kind !== "skill" && target)) {
      const to = target ? target.home.clone() : f.home.clone().add(new THREE.Vector3(0, 0, f.ally ? -3 : 3));
      const dir = to.clone().sub(f.home).setY(0).normalize();
      to.sub(dir.multiplyScalar(1.1));
      f.anim = { t: 0, dur: kind === "attack" ? 1.0 : 1.4, kind: kind === "attack" ? "lunge" : "ult", to, power: kind === "grand" ? 2 : 1 };
    } else {
      f.anim = { t: 0, dur: kind === "skill" ? 0.9 : 1.4, kind: kind === "skill" ? "cast" : "ult", power: kind === "grand" ? 2 : 1 };
      if (target) this.shoot(f, target, color, kind !== "skill");
    }
    if (kind === "ult" || kind === "grand") {
      this.camShake = kind === "grand" ? 0.5 : 0.3;
      this.burst(f.root.position.clone().setY(1), color, kind === "grand" ? 60 : 36, 3.2);
      this.flashLevel = kind === "grand" ? 0.45 : 0.25;
    }
  }

  cast(uid: number, color: number): void {
    const f = this.figs.get(uid);
    if (!f) return;
    f.anim = { t: 0, dur: 0.9, kind: "cast", power: 1 };
    this.burst(f.root.position.clone().setY(0.3), color, 18, 1.4, true);
  }

  guard(uid: number): void {
    const f = this.figs.get(uid);
    if (f) f.anim = { t: 0, dur: 0.7, kind: "guard", power: 1 };
  }

  loaf(uid: number): void {
    const f = this.figs.get(uid);
    if (f) f.anim = { t: 0, dur: 1.2, kind: "loaf", power: 1 };
  }

  hit(uid: number, crit: boolean, color = 0xffffff): void {
    const f = this.figs.get(uid);
    if (!f) return;
    f.flash = 1;
    f.shake = crit ? 1 : 0.6;
    this.burst(f.root.position.clone().setY(1), color, crit ? 26 : 12, crit ? 3 : 2);
    if (crit) this.camShake = Math.max(this.camShake, 0.15);
  }

  ko(uid: number): void {
    const f = this.figs.get(uid);
    if (!f) return;
    f.alive = false;
    f.anim = { t: 0, dur: 0.9, kind: "ko", power: 1 };
  }

  /** 3D の位置を画面の座標に（吹き出し・数字の表示用） */
  project(uid: number, height = 2.1): { x: number; y: number; visible: boolean } {
    const f = this.figs.get(uid);
    if (!f || !f.root.visible) return { x: 0, y: 0, visible: false };
    const v = f.root.position.clone().setY(f.root.position.y + height).project(this.camera);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible: true };
  }

  private shoot(from: Figure, to: Figure, color: number, big: boolean): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(big ? 0.45 : 0.28, 16, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
    );
    const a = from.root.position.clone().setY(1.1);
    const b = to.root.position.clone().setY(1.0);
    mesh.position.copy(a);
    this.scene.add(mesh);
    this.projectiles.push({ mesh, from: a, to: b, t: 0, dur: big ? 0.6 : 0.45, color, big });
  }

  private burst(at: THREE.Vector3, color: number, n: number, speed: number, rise = false): void {
    if (this.reduced) n = Math.min(n, 6);
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 6, 4),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false }),
      );
      mesh.position.copy(at);
      const dir = new THREE.Vector3(Math.random() - 0.5, rise ? Math.random() * 0.8 + 0.4 : Math.random() - 0.2, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(speed * (0.5 + Math.random()));
      this.scene.add(mesh);
      const life = 0.5 + Math.random() * 0.4;
      this.particles.push({ mesh, vel: dir, life, max: life });
    }
  }

  // ---- 毎フレーム ----

  update(dt: number): void {
    this.clock += dt;
    for (const f of this.figs.values()) this.updateFigure(f, dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= 4 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life / p.max);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.mesh.position.lerpVectors(p.from, p.to, k);
      p.mesh.position.y += Math.sin(k * Math.PI) * (p.big ? 1.2 : 0.6);
      if (k >= 1) {
        this.burst(p.to, p.color, p.big ? 40 : 16, p.big ? 3.5 : 2.2);
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }
    // カメラのゆれ
    this.camShake = Math.max(0, this.camShake - dt * 1.2);
    const s = this.reduced ? 0 : this.camShake;
    this.camera.position.set(Math.sin(this.clock * 50) * s * 0.3, 3.4 + Math.cos(this.clock * 43) * s * 0.2, 8.2);
    this.camera.lookAt(0, 0.9, -0.6);
    this.flashLevel = Math.max(0, this.flashLevel - dt * 1.4);
    (this.flashPlane.material as THREE.MeshBasicMaterial).opacity = this.flashLevel;
    this.renderer.render(this.scene, this.camera);
  }

  private updateFigure(f: Figure, dt: number): void {
    if (!f.root.visible) return;
    const t = this.clock + f.phase;
    // 前衛の定位置へ（回転で入れ替わったときはすっと寄る）
    const base = f.root.position;
    const anim = f.anim;
    let offY = 0;
    let scaleX = 1;
    let scaleY = 1;
    let rot = 0;
    let opacity = f.alive ? 1 : 0.25;
    if (anim) {
      anim.t += dt;
      const k = Math.min(1, anim.t / anim.dur);
      if (anim.kind === "lunge" || (anim.kind === "ult" && anim.to)) {
        // 行って、当てて、戻る
        const out = k < 0.45 ? easeOut(k / 0.45) : k < 0.6 ? 1 : 1 - easeIn((k - 0.6) / 0.4);
        const to = anim.to!;
        base.lerpVectors(f.home, to, out);
        const arc = arcHeight(f.motion) * anim.power;
        offY = Math.sin(Math.min(1, k / 0.6) * Math.PI) * arc;
        if (f.motion === "spin") rot = k * Math.PI * 2;
        if (f.motion === "slash" && k > 0.35 && k < 0.65) rot = Math.sin(k * 60) * 0.35;
        if (f.motion === "smash" || f.motion === "slam") {
          if (k > 0.4 && k < 0.6) {
            scaleX = 1.25;
            scaleY = 0.8;
          }
        }
      } else if (anim.kind === "cast" || anim.kind === "ult") {
        base.copy(f.home);
        const pulse = Math.sin(k * Math.PI);
        offY = pulse * (anim.kind === "ult" ? 0.8 : 0.35);
        scaleX = scaleY = 1 + pulse * (anim.kind === "ult" ? 0.35 * anim.power : 0.12);
        if (f.motion === "stretch") scaleY += pulse * 0.8;
        if (f.motion === "spin") rot = k * Math.PI * 2;
        if (f.motion === "flicker") opacity = 0.6 + Math.abs(Math.sin(k * 30)) * 0.4;
      } else if (anim.kind === "guard") {
        base.copy(f.home);
        scaleX = scaleY = 1 - Math.sin(k * Math.PI) * 0.12;
      } else if (anim.kind === "loaf") {
        base.copy(f.home);
        rot = Math.sin(k * Math.PI) * 0.4;
        offY = -Math.sin(k * Math.PI) * 0.15;
      } else if (anim.kind === "ko") {
        base.copy(f.home);
        rot = k * 1.4;
        offY = -k * 0.5;
        opacity = 1 - k * 0.75;
      }
      if (k >= 1) f.anim = null;
    } else {
      base.lerp(f.home, Math.min(1, dt * 8));
      if (f.alive) {
        // 待機中もいつも動いている（キャラごとにゆれ方が違う）
        switch (f.motion) {
          case "float":
          case "wave":
          case "glow":
            offY = 0.18 + Math.sin(t * 2.1) * 0.15;
            break;
          case "flicker":
            offY = 0.1 + Math.sin(t * 5) * 0.06;
            scaleX = 1 + Math.sin(t * 7) * 0.05;
            scaleY = 1 - Math.sin(t * 7) * 0.05;
            break;
          case "hop":
            offY = Math.max(0, Math.sin(t * 4)) * 0.18;
            break;
          case "dash":
          case "slash":
          case "pounce":
            offY = Math.abs(Math.sin(t * 5.5)) * 0.08;
            break;
          case "rattle":
            rot = Math.sin(t * 14) * 0.05;
            break;
          case "sway":
          case "stretch":
          case "spin":
            rot = Math.sin(t * 2.4) * 0.08;
            break;
          default:
            scaleY = 1 + Math.sin(t * 2.2) * 0.03;
            scaleX = 1 - Math.sin(t * 2.2) * 0.02;
        }
      } else {
        rot = 1.4;
        offY = -0.5;
      }
    }
    // 被弾：ゆれて白く光る
    if (f.shake > 0) {
      base.x += Math.sin(this.clock * 70) * f.shake * 0.12;
      f.shake = Math.max(0, f.shake - dt * 3);
    }
    f.flash = Math.max(0, f.flash - dt * 4);
    const mat = f.sprite.material as THREE.SpriteMaterial;
    const c = 1 + f.flash * 2;
    mat.color.setRGB(c, c, c);
    mat.opacity = opacity;
    mat.rotation = f.ally ? -rot : rot;
    f.sprite.scale.set(1.9 * scaleX, 1.9 * scaleY, 1);
    f.sprite.position.y = 0.95 * scaleY + offY;
    const sh = f.shadow.material as THREE.MeshBasicMaterial;
    sh.opacity = f.alive ? 0.35 - Math.min(0.2, offY * 0.2) : 0.1;
    const ring = f.ring.material as THREE.MeshBasicMaterial;
    if (ring.opacity > 0) f.ring.rotation.z += dt * 2;
  }
}

function easeOut(x: number): number {
  return 1 - (1 - x) * (1 - x);
}
function easeIn(x: number): number {
  return x * x;
}

function arcHeight(kind: MotionKind): number {
  switch (kind) {
    case "smash":
    case "pounce":
      return 1.4;
    case "hop":
      return 0.9;
    case "charge":
    case "dash":
    case "slash":
      return 0.2;
    case "float":
    case "wave":
    case "glow":
      return 0.6;
    default:
      return 0.5;
  }
}

/**
 * SVG の絵をテクスチャにする。tint を渡すと「後ろ姿」にする（本家と同じく、手前の味方は後ろ姿で見える）。
 * 後ろ姿は、絵の形をそのまま使って、体の色で塗りつぶし、ふちを少し明るくする。
 */
function svgTexture(svg: string, backTint: string | null): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  const markup = svg.replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" `).replace('width="100%" height="100%"', `width="${size}" height="${size}"`);
  img.onload = () => {
    const g = canvas.getContext("2d")!;
    g.clearRect(0, 0, size, size);
    g.drawImage(img, 16, 16, size - 32, size - 32);
    if (backTint) {
      // 絵の形の中だけを体の色で塗る → 後ろ姿のシルエット
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = backTint;
      g.globalAlpha = 0.82;
      g.fillRect(0, 0, size, size);
      g.globalAlpha = 1;
      const grad = g.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0, "rgba(255,255,255,.22)");
      grad.addColorStop(1, "rgba(0,0,0,.35)");
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      g.globalCompositeOperation = "source-over";
    }
    tex.needsUpdate = true;
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
  return tex;
}
