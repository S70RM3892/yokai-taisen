// ============================================================================
// 本家のスキル「ひとまかせ」「なめらかオイル」の効果（ひとまか仙人・あせっか鬼・なめらかオイル魂）
// ============================================================================

// ひとまかせ：行動したあと、となりの前衛の味方の「次の番までの待ち」を減らす
function relayTurn(p, u, ev) {
  for (const r of jn(p, u)) {
    if (!Se(r) || !Vt(p, r.index)) continue;
    r.ap = Math.floor(r.ap * (1e3 - u.fx.relay) / 1e3);
    ev.push({ t: "relay", uid: u.uid, to: r.uid });
  }
}

// なめらかオイル：チームで生きている中でいちばん強い分だけ、回転の待ち時間を短くする
function rotateCd(p, base) {
  let oil = 0;
  for (const u of p.units) if (Se(u) && u.fx.oil) oil = Math.max(oil, u.fx.oil);
  return Math.max(1, Math.floor(base * (1e3 - Math.min(600, oil)) / 1e3));
}
