// ============================================================================
// 追加の妖怪（本家の対戦で流行った編成の「型」を組むのに、役割が足りなかった分）。
// 名前・見た目は民話の妖怪から作ったオリジナル（本家との対応は docs/PRESETS.md の分析にだけ書く）。
//   久米仙人：行動すると、となりの前衛の味方の番を早める（新しい特性「順送り」）
//   油坊    ：チームにいると、ホイールを回したあとの待ち時間が短くなる（新しい特性「油差し」）
// ============================================================================

var PLUS_UNITS = [
  [{
    id: "p001", name: "久米仙人", rank: "C", tribe: "ayashi", hp: 226, atk: 62, spa: 118, def: 86, spd: 128, sgRank: 4,
    weak: "earth", resist: "wind", attackPower: 45, skillElement: "wind", skillPower: 110, curse: "slow", blessing: "gather",
    ult: { kind: "blessAll", blessing: "haste" }, ultName: "仙人の采配", loafPermil: st, defaultNature: "arcane", trait: "relay",
  }, { family: "久米仙人", form: 1, role: "buffer", motion: "float", line: "順を譲ろう", pitch: 210, seed: 1702611 }],
  [{
    id: "p002", name: "油坊", rank: "D", tribe: "ayashi", hp: 210, atk: 72, spa: 108, def: 80, spd: 104, sgRank: 4,
    weak: "water", resist: "fire", attackPower: 45, skillElement: "fire", skillPower: 90, curse: "weaken", blessing: "haste",
    ult: { kind: "blessAll", blessing: "haste" }, ultName: "灯明の油", loafPermil: st, defaultNature: "arcane", trait: "oil",
  }, { family: "油坊", form: 0, role: "buffer", motion: "flicker", line: "油を差すぞ", pitch: 430, seed: 9304417 }],
];
for (const [def, z] of PLUS_UNITS) if (!ct.some(d => d.id === def.id)) ct.push(def), zi[def.id] = z;

// 順送り：行動したあと、となりの前衛の味方の「次の番までの待ち」を減らす
function relayTurn(p, u, ev) {
  for (const r of jn(p, u)) {
    if (!Se(r) || !Vt(p, r.index)) continue;
    r.ap = Math.floor(r.ap * (1e3 - u.fx.relay) / 1e3);
    ev.push({ t: "relay", uid: u.uid, to: r.uid });
  }
}

// 油差し：チームで生きている中でいちばん強い油差しの分だけ、回転の待ち時間を短くする
function rotateCd(p, base) {
  let oil = 0;
  for (const u of p.units) if (Se(u) && u.fx.oil) oil = Math.max(oil, u.fx.oil);
  return Math.max(1, Math.floor(base * (1e3 - Math.min(600, oil)) / 1e3));
}
