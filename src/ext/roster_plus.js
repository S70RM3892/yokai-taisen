// ============================================================================
// 本家のスキル「ひとまかせ」「なめらかオイル」の効果（ひとまか仙人・あせっか鬼・なめらかオイル魂）
// ============================================================================

// ひとまかせ（本家）：自分の番に、自分のかわりに となりの前衛の味方を行動させる（右どなり優先）。
// 前衛は 0 = 左・1 = まん中・2 = 右。となりが前衛にいない・気絶しているときは自分で行動する。
// とりつかれて動けない（stun）ときや、ねらう相手を待っている（pendingAction）ときは任せない
function relayPick(p, u) {
  if (!tt(u, "relay") || u.pendingAction !== null || u.curse?.kind === "stun") return null;
  const pos = si(p, u.index);
  if (pos > 2) return null;
  for (const q of [pos + 1, pos - 1]) {
    if (q < 0 || q > 2) continue;
    const r = p.units[p.wheel[q]];
    if (Se(r)) return r;
  }
  return null;
}

// なめらかオイル：チームで生きている中でいちばん強い分だけ、回転の待ち時間を短くする
function rotateCd(p, base) {
  let oil = 0;
  for (const u of p.units) if (Se(u) && u.fx.oil) oil = Math.max(oil, u.fx.oil);
  return Math.max(1, Math.floor(base * (1e3 - Math.min(600, oil)) / 1e3));
}
