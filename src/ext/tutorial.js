// ============================================================================
// はじめての人へ：あそびかた（チュートリアル）と練習試合。
//   ・openTutorial()：妖怪ウォッチの対戦をやったことがない人向けに、1 枚ずつ絵つきで説明する
//   ・startPractice()：いちばんやさしい CPU と、わかりやすい 6 体で戦う。対戦中、そのとき大事なことをヒントで出して
//     押すボタン（わざ・おはらい・ねらう・メンバーサークル）を光らせる。練習試合は戦績に入れない
// 数字は対戦ロジックと同じ（弱点 1.5 倍・いまひとつ 0.5 倍、5 分でサドンデス、6 分で残り HP の割合で決着）。
// ============================================================================

// 練習試合のチーム：よく知られた妖怪で、こうげき・ようじゅつ・回復・壁がそろう（S 2・A 1）
var PRACTICE_TEAM = [["ジバニャン", "arakure", "kishin_udewa"], ["ブシニャン", "arakure", "densetsu_udewa"], ["むりだ城", "doujinai", "teppeki_omamori"],
  ["キズナース", "yasashii", null], ["フユニャン", "arakure", "soul:フユニャン"], ["キュウビ", "zunouteki", "kishin_yubiwa"]];
var PRACTICE_BAG = ["ikuraonigiri", "cheeseburger", "tonkotsu", "nigai_kanpou", "coffeegyuunyuu", "chikara_ofuda"];

// 説明に使う小さな絵（SVG）
var TUT_WHEEL = `<svg viewBox="-80 -80 160 160" class="tut-svg" aria-hidden="true">
  <circle r="76" fill="#1a1d33" stroke="#0c0f19" stroke-width="3"/>
  <path d="M-76 0 A76 76 0 0 1 76 0 L28 0 A28 28 0 0 0 -28 0Z" fill="#f2c96a" opacity=".45"/>
  <path d="M-76 0 A76 76 0 0 0 76 0 L28 0 A28 28 0 0 1 -28 0Z" fill="#7a6aa8" opacity=".45"/>
  ${[[-45, -26], [0, -52], [45, -26], [45, 26], [0, 52], [-45, 26]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="15" fill="${i < 3 ? "#f2a541" : "#5a4f8a"}" stroke="#fff8" stroke-width="2"/>`).join("")}
  <circle r="26" fill="#10131f" stroke="#e9d9a8" stroke-width="3"/>
  <text y="-4" text-anchor="middle" fill="#f2c96a" font-size="13" font-weight="700">前</text>
  <text y="14" text-anchor="middle" fill="#b0a8e0" font-size="13" font-weight="700">後</text>
  <path d="M60 -58 A84 84 0 0 1 84 -8" fill="none" stroke="#5fb3d9" stroke-width="4" marker-end="url(#tuta)"/>
  <defs><marker id="tuta" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10z" fill="#5fb3d9"/></marker></defs>
</svg>`;
var tutBtns = (...on) => `<div class="tut-btns">${["わざ", "ねらう", "おはらい", "アイテム"].map(b => `<span class="tut-btn${on.includes(b) ? " on" : ""}">${b}</span>`).join("")}</div>`;
var tutGauge = (pct, label) => `<div class="tut-gauge"><span>${label}</span><i><b style="width:${pct}%"></b></i></div>`;

var TUTORIAL_PAGES = [
  { t: "ようこそ、妖怪大戦へ", art: `<div class="tut-big">👑</div>`,
    b: `妖怪 6 体どうしの <b>リアルタイム対戦</b>。<br>妖怪は <b>自分で考えて戦う</b>。キミは <b>監督</b>。<br>「だれを前に出すか」と「ここぞのひっさつわざ」を指示して勝ちに導く。<br><small>このあそびかたは 10 ページ。最後に練習試合ができる。</small>` },
  { t: "勝ち負け", art: `<div class="tut-row"><span class="tut-chip a">こちら 6 体</span><span class="tut-vs">VS</span><span class="tut-chip f">相手 6 体</span></div>`,
    b: `相手の <b>6 体ぜんぶを気絶</b>させたら勝ち。こちらが 6 体ぜんぶ気絶したら負け。<br>戦うのは前に出ている <b>3 体（前衛）</b>だけ。<br><small>5 分たつと <b>サドンデス</b>（ダメージがぜんぶ 999）。6 分で決着がつかなければ、残り HP の割合が多いほうの勝ち。</small>` },
  { t: "メンバーサークル", art: TUT_WHEEL,
    b: `下の画面の輪が <b>メンバーサークル</b>。上半分の 3 体が <b>前衛</b>（戦う）、下半分の 3 体が <b>後衛</b>（休む）。<br>輪を <b>指でなぞって回す</b> と入れかわる。<b>後衛は攻撃されない</b>ので、弱った妖怪は後ろに下げて守る。<br><small>回したあとは少し待ち時間がある。だれかの行動のとちゅうに回すと、その行動が終わってから入れかわる。</small>` },
  { t: "妖怪は自分で動く", art: `<div class="tut-row wrap"><span class="tut-chip">こうげき</span><span class="tut-chip">ようじゅつ</span><span class="tut-chip">ガード</span><span class="tut-chip">とりつく</span><span class="tut-chip dim">サボる</span></div>`,
    b: `前衛の妖怪は、<b>性格</b>で決まった割合で こうげき・ようじゅつ（術）・ガード・とりつく を選ぶ。<br>ときどき <b>サボる</b>（編成で「超まじめ」にするとサボりにくい）。<br><small>ようじゅつには 火・水・雷・土・氷・風 の属性がある。相手の <b>弱点</b>なら 1.5 倍、<b>得意</b>な属性なら半分のダメージ。</small>` },
  { t: "ひっさつわざ", art: `${tutGauge(100, "妖気")}${tutBtns("わざ")}`,
    b: `名札の下の <b>妖気ゲージ</b> がいっぱいになったら、<b>「わざ」</b> → 光っている妖怪を選ぶ。<br>出てくる <b>タッチアクション</b>（なぞる・連打・回す・つつく）を最後までやると <b>ひっさつわざ</b> が出る。<br><small>悪いとりつき中の妖怪は使えない。パワーチャージ中に回して後ろに下げると取りやめになる。</small>` },
  { t: "ねらう", art: `${tutBtns("ねらう")}<div class="tut-row"><span class="tut-chip f pin">📍 敵</span></div>`,
    b: `敵をタップすると <b>ねらう</b>（ピン）。前衛のみんなが、なるべくその敵をこうげきする。<br><b>弱っている敵</b> や <b>弱点を突ける敵</b> をねらうと早く気絶させられる。` },
  { t: "とりつきと おはらい", art: `<div class="tut-row"><span class="tut-chip curse">紫の煙＝悪い</span><span class="tut-chip bless">金の光＝よい</span></div>${tutBtns("おはらい")}`,
    b: `敵に <b>とりつかれる</b> と、動けない・能力が下がるなどの悪いことが起きる（紫の煙）。<b>前にいるままでは解けない</b>。<br>サークルを回して <b>後ろに下げ</b>、<b>「おはらい」</b> → その妖怪を選ぶ → タッチアクションで はらう。<br><small>味方からの よいとりつき（金の光）は、しばらく能力が上がる。</small>` },
  { t: "陣形と零式", art: `<div class="tut-row"><span class="tut-chip">イサマシ</span><span class="tut-chip">イサマシ</span><span class="tut-chip dim">＋ちから</span></div>`,
    b: `前衛に <b>同じ種族が 2 体以上</b> ならぶと <b>陣形効果</b>（能力アップなど）。<br>サークルのまん中の <b>零式</b> を押すと、<b>Gわざ</b>（となりの 2 体と力を合わせる強いひっさつわざ）と <b>つつく</b>（サボり中・とりつかれ中の光る敵をつついて妖気をうばう）が使える。<br><small>CPU 戦では右下の <b>アイテム</b> で回復などもできる（対人戦はアイテムなし）。</small>` },
  { t: "チームの組み方", art: `<div class="tut-row wrap"><span class="tut-chip">S は 2 体まで</span><span class="tut-chip">A は 2 体まで</span><span class="tut-chip">赤鬼・青鬼・黒鬼は 1 体</span></div>`,
    b: `編成画面で 6 体を選んで並べる。<b>最初の 3 体が前衛</b>。ランクの強い妖怪は数に限りがある。<br>妖怪ごとに <b>性格</b> と <b>そうび</b>（うでわ・おまもり・<b>魂</b> など）を選べる。<br><small>迷ったら左の <b>「流行りの型」</b>（本家で流行った編成）か <b>「メタ候補」</b> を押すと 6 体まとめて入る。</small>` },
  { t: "勝つための 3 つのコツ", art: `<div class="tut-big">💡</div>`,
    b: `① <b>弱った妖怪は後ろへ</b>。気絶した妖怪は戻らない。休ませて、元気な妖怪で戦う。<br>② <b>ひっさつわざは相手が弱ったときに</b>。とどめに使うと一気に数を減らせる。<br>③ <b>とりつかれたら すぐ回して おはらい</b>。ほうっておくとひっさつわざも使えない。<br><small>つぎは練習試合。いちばんやさしい相手と、その場でヒントを出しながら戦う。</small>` },
];

var TUT_SEEN_KEY = "tutorialSeen";
function tutorialSeen() { return !!loadStored(TUT_SEEN_KEY, !1); }

// あそびかた（ページめくり）。onDone は閉じたとき
function openTutorial(start = 0) {
  document.querySelector(".tut-wrap")?.remove();
  const wrap = q("div", "result tut-wrap"), box = q("div", "box tut-box");
  wrap.append(box);
  let i = Math.max(0, Math.min(start, TUTORIAL_PAGES.length - 1));
  const close = () => { wrap.remove(); document.removeEventListener("keydown", key); saveStored(TUT_SEEN_KEY, !0); };
  const key = ev => { if (ev.key === "ArrowRight") go(1); else if (ev.key === "ArrowLeft") go(-1); else if (ev.key === "Escape") close(); };
  const go = d => { i = Math.max(0, Math.min(TUTORIAL_PAGES.length - 1, i + d)); render(); };
  const render = () => {
    const p = TUTORIAL_PAGES[i], last = i === TUTORIAL_PAGES.length - 1;
    box.replaceChildren();
    const head = q("div", "tut-head");
    head.append(q("span", "tut-step num", `${i + 1} / ${TUTORIAL_PAGES.length}`));
    const skip = q("button", "b-mini tut-skip", "とじる");
    skip.onclick = close;
    head.append(skip);
    const art = q("div", "tut-art");
    art.innerHTML = p.art;
    const body = q("div", "tut-body");
    body.innerHTML = p.b;
    const dots = q("div", "tut-dots");
    TUTORIAL_PAGES.forEach((_, k) => { const d = q("button", "tut-dot" + (k === i ? " on" : "")); d.setAttribute("aria-label", `${k + 1} ページ目`); d.onclick = () => { i = k; render(); }; dots.append(d); });
    const row = q("div", "row tut-nav");
    const back = q("button", "btn", "もどる");
    back.disabled = i === 0;
    back.onclick = () => go(-1);
    const next = q("button", "btn primary", last ? "練習試合をはじめる" : "つぎへ");
    next.onclick = () => { if (last) { close(); startPractice(); } else go(1); };
    row.append(back, next);
    box.append(head, q("div", "big tut-title", p.t), art, body, dots, row);
    next.focus();
  };
  document.addEventListener("keydown", key);
  render();
  document.body.append(wrap);
}

// 練習試合：いちばんやさしい CPU（戦績には入れない）
function startPractice() {
  const members = PRACTICE_TEAM.map(([name, nature, eq]) => {
    const d = ct.find(x => x.name === name);
    const m = { unit: d.id, nature, diligence: "choumajime" };
    const id = eq?.startsWith("soul:") ? SOUL_PREFIX + ct.find(x => x.name === eq.slice(5)).id : eq;
    if (id && equipAllowed(d, id)) m.equipment = id;
    return m;
  });
  document.querySelector(".result")?.remove();
  Fd(members, PRACTICE_BAG.filter(id => battleItem(id)), { diff: 0, practice: !0 });
}

// ---- 練習試合のヒント ----
// そのとき大事なことを 1 つずつ出して、押すところを光らせる。同じヒントは 1 回だけ
function tutorHint(e, key, text, glow = null) {
  const tu = e.tutor ??= { shown: new Set(), queue: [], cur: null, until: 0 };
  if (tu.shown.has(key)) return;
  tu.shown.add(key);
  tu.queue.push({ key, text, glow });
}
function tutorGlowEl(e, glow) {
  return glow === "ult" ? e.refs.bUlt : glow === "purify" ? e.refs.bPurify : glow === "target" ? e.refs.bTarget : glow === "wheel" ? e.refs.wheelBox : glow === "item" ? e.refs.bEmpty : null;
}
function tutorShow(e) {
  const tu = e.tutor;
  if (!tu || tu.cur || !tu.queue.length || !e.refs.top) return;
  const h = tu.queue.shift();
  const el = q("div", "tut-hint");
  el.innerHTML = `<b>ヒント</b><span>${h.text}</span>`;
  const ok = q("button", "b-mini", "わかった");
  const done = () => { el.remove(); tutorGlowEl(e, h.glow)?.classList.remove("tut-glow"); tu.cur = null; };
  ok.onclick = done;
  el.append(ok);
  e.refs.top.append(el); // 上の画面に出す（下の四隅のボタンを隠さない）
  tutorGlowEl(e, h.glow)?.classList.add("tut-glow");
  tu.cur = { done, until: performance.now() + 9000 };
}
// 毎フレーム（Ud から）：状態を見てヒントを積む
function tutorTick(e) {
  if (!e.practice || e.state.outcome) return;
  const st = e.state, me = st.players[0], front = [0, 1, 2].map(i => me.units[me.wheel[i]]), back = [3, 4, 5].map(i => me.units[me.wheel[i]]);
  if (performance.now() > e.introUntil + 400) tutorHint(e, "start", "妖怪は自分で戦う。キミの仕事は <b>サークルを回す</b>・<b>わざ</b>・<b>ねらう</b>・<b>おはらい</b>。まずは少し見ていよう");
  const cursedFront = front.find(u => Se(u) && u.curse);
  if (cursedFront) tutorHint(e, "curseFront", `${Ze(cursedFront).name}が とりつかれた（紫の煙）。前にいるままでは解けない。<b>サークルを回して後ろへ</b>下げよう`, "wheel");
  const cursedBack = back.find(u => Se(u) && u.curse);
  if (cursedBack && !me.purify) tutorHint(e, "purify", `後ろの${Ze(cursedBack).name}を <b>「おはらい」</b> → その妖怪を選ぶ → タッチアクションで はらおう`, "purify");
  const ready = front.find(u => Se(u) && u.sg >= Nt && !u.curse);
  if (ready && !me.stance) tutorHint(e, "ult", `${Ze(ready).name}の妖気がたまった！ <b>「わざ」</b> → 光っている妖怪を選ぶ → タッチアクションを最後まで`, "ult");
  const weak = front.find(u => Se(u) && u.hp * 10 < u.maxHp * 3);
  if (weak) tutorHint(e, "lowHp", `${Ze(weak).name}の HP が少ない。<b>サークルを回して後ろへ</b>下げると攻撃されない`, "wheel");
  if (st.tick >= 20 * 25) tutorHint(e, "target", "敵をタップすると <b>ねらう</b>。弱っている敵や、弱点を突ける敵をねらうと早く気絶させられる", "target");
  if (st.tick >= 20 * 60 && !st.noItems) tutorHint(e, "item", "右下の <b>アイテム</b> で HP を回復できる（アイテムを選んでから使う妖怪を選ぶ）", "item");
  if (st.tick >= 20 * 90) tutorHint(e, "zero", "サークルのまん中の <b>零式</b> で Gわざ（3 体の妖気が満タンのとき）と <b>つつく</b>（光っている敵の妖気をうばう）が使える");
  const tu = e.tutor;
  if (tu?.cur && performance.now() > tu.cur.until) tu.cur.done();
  tutorShow(e);
}
// 出来事（Od から）
function tutorEvent(e, ev) {
  if (!e.practice) return;
  if (ev.t === "stance" && ev.player === 0) tutorHint(e, "stance", "パワーチャージ中。<b>画面の指示どおりにタッチ</b>して最後までやると、ひっさつわざが出る");
  else if (ev.t === "ult" && ev.uid < 6) tutorHint(e, "ultDone", "ひっさつわざが出た！ 相手が弱ったときの <b>とどめ</b> に使うと一気に数を減らせる");
  else if (ev.t === "ko" && ev.uid >= 6) tutorHint(e, "koFoe", "敵を気絶させた！ 相手の <b>6 体ぜんぶ</b>を気絶させたら勝ち");
  else if (ev.t === "ko" && ev.uid < 6) tutorHint(e, "koMe", "味方が気絶した。気絶した妖怪はもどらない。<b>弱った妖怪は早めに後ろへ</b>");
  else if (ev.t === "suddenDeath") tutorHint(e, "sudden", "<b>サドンデス</b>！ ダメージがぜんぶ 999。ひっさつわざを先に当てたほうが有利");
}

// 編成画面の「はじめての人へ」
function tutorialBox() {
  const box = q("div", "b-rules b-tutorial" + (tutorialSeen() ? "" : " new"));
  box.append(q("div", "b-rules-t", "はじめての人へ"));
  const row = q("div", "tut-entry");
  const how = q("button", "btn primary", "あそびかた");
  how.onclick = () => openTutorial(0);
  const prac = q("button", "btn", "練習試合");
  prac.onclick = () => { saveStored(TUT_SEEN_KEY, !0); startPractice(); };
  row.append(how, prac);
  box.append(row, q("div", "b-rules-note", "妖怪ウォッチの対戦がはじめてなら、まず「あそびかた」（10 ページ）。練習試合は いちばんやさしい相手と、ヒントつきで戦う（戦績に入らない）。"));
  return box;
}
