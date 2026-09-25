// キャラの絵（SVG・図形だけ）。民間伝承の特徴をもとにしたオリジナルのデザイン。
// 原作（妖怪ウォッチ）のキャラの見た目はまねしない（CLAUDE.md・PLAN.md §0）。
// どれも viewBox 0 0 64 64。前を向いた姿で描き、動きは motion.ts がつける。

import { LOOKS } from "./looks.gen.js";

const INK = "#1a1420";

/** 目：丸い目。size で大きさ、look で黒目のずれ */
function eyes(x1: number, x2: number, y: number, size = 4, look = 0, white = "#fff"): string {
  return (
    `<circle cx="${x1}" cy="${y}" r="${size}" fill="${white}"/><circle cx="${x2}" cy="${y}" r="${size}" fill="${white}"/>` +
    `<circle cx="${x1 + look}" cy="${y + 0.5}" r="${size * 0.5}" fill="${INK}"/><circle cx="${x2 + look}" cy="${y + 0.5}" r="${size * 0.5}" fill="${INK}"/>`
  );
}

/** 細い目（つり目） */
function slitEyes(x1: number, x2: number, y: number, color = INK): string {
  return (
    `<path d="M${x1 - 4} ${y + 1} L${x1 + 4} ${y - 2}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M${x2 + 4} ${y + 1} L${x2 - 4} ${y - 2}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>`
  );
}

const ART: Record<string, string> = {
  // 鬼：赤い丸顔に2本の角、牙、金棒
  oni: `
    <rect x="47" y="14" width="7" height="40" rx="3" fill="#6b6b78" transform="rotate(18 50 34)"/>
    <circle cx="50" cy="15" r="2" fill="#9a9aa8"/><circle cx="55" cy="22" r="2" fill="#9a9aa8"/>
    <path d="M18 18 L14 4 L24 14Z M40 14 L50 4 L46 18Z" fill="#f4e6c8"/>
    <circle cx="31" cy="32" r="20" fill="#d9483b"/>
    <path d="M14 26 Q31 16 48 26" stroke="${INK}" stroke-width="5" fill="none"/>
    ${slitEyes(24, 38, 30)}
    <path d="M22 42 Q31 48 40 42" stroke="${INK}" stroke-width="2.5" fill="none"/>
    <path d="M24 42 L26 47 L28 43Z M34 43 L36 47 L38 42Z" fill="#fff"/>`,

  // 唐傘お化け：紫の傘に一つ目、一本足、長い舌
  karakasa: `
    <path d="M6 34 Q32 -4 58 34 Q45 29 32 34 Q19 29 6 34Z" fill="#7a5bc4"/>
    <path d="M32 6 L32 34 M18 12 L22 33 M46 12 L42 33" stroke="#4d3a86" stroke-width="1.5"/>
    <circle cx="32" cy="22" r="7" fill="#fff"/><circle cx="33" cy="23" r="3.5" fill="${INK}"/>
    <path d="M28 30 Q32 40 36 30" fill="#e55a78"/>
    <rect x="30" y="34" width="4" height="20" fill="#c9a36b"/>
    <path d="M26 56 L38 56 L35 60 L29 60Z" fill="#8a5a3a"/>`,

  // 雪女：白い顔、長い黒髪、白い着物、雪の結晶
  yukionna: `
    <path d="M14 20 Q32 2 50 20 L54 58 L42 50 L32 58 L22 50 L10 58Z" fill="#20243a"/>
    <path d="M20 40 L32 34 L44 40 L48 60 L16 60Z" fill="#e8f4ff"/>
    <path d="M32 34 L28 60 M32 34 L36 60" stroke="#aac8e8" stroke-width="1.5"/>
    <ellipse cx="32" cy="24" rx="11" ry="13" fill="#f4f7ff"/>
    <path d="M24 24 Q27 22 29 24 M35 24 Q37 22 40 24" stroke="${INK}" stroke-width="1.8" fill="none"/>
    <path d="M30 31 Q32 32 34 31" stroke="#8fb8e0" stroke-width="1.5" fill="none"/>
    <g stroke="#bfe6ff" stroke-width="1.5"><path d="M52 8 L52 18 M47 13 L57 13 M48.5 9.5 L55.5 16.5 M55.5 9.5 L48.5 16.5"/></g>`,

  // 猫又：黒猫の顔、先が二つに分かれた尾
  nekomata: `
    <path d="M44 50 Q58 46 56 30 Q55 22 60 16 M44 50 Q60 54 62 40 Q63 32 58 28" stroke="#3a3446" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M12 26 L14 8 L26 18Z M52 26 L50 8 L38 18Z" fill="#3a3446"/>
    <path d="M15 22 L16 12 L22 18Z M49 22 L48 12 L42 18Z" fill="#e58aa8"/>
    <ellipse cx="32" cy="34" rx="21" ry="18" fill="#3a3446"/>
    <ellipse cx="24" cy="31" rx="4" ry="5" fill="#f2d15c"/><ellipse cx="40" cy="31" rx="4" ry="5" fill="#f2d15c"/>
    <rect x="23" y="27" width="2" height="8" rx="1" fill="${INK}"/><rect x="39" y="27" width="2" height="8" rx="1" fill="${INK}"/>
    <path d="M30 39 L34 39 L32 41Z" fill="#e58aa8"/>
    <path d="M32 41 Q29 45 26 43 M32 41 Q35 45 38 43 M10 36 L20 38 M10 42 L20 40 M54 36 L44 38 M54 42 L44 40" stroke="#b9b3c6" stroke-width="1.2" fill="none"/>`,

  // 河童：緑の体、頭の皿、くちばし、甲羅
  kappa: `
    <ellipse cx="32" cy="46" rx="18" ry="14" fill="#6b8f3a"/>
    <path d="M20 44 Q32 36 44 44 Q44 56 32 58 Q20 56 20 44Z" fill="#a8c46a"/>
    <circle cx="32" cy="26" r="17" fill="#5aa55a"/>
    <path d="M14 20 L18 12 L22 18 L26 10 L30 17 L34 10 L38 17 L42 10 L46 18 L50 12 L50 22Z" fill="#2f5f3a"/>
    <ellipse cx="32" cy="12" rx="10" ry="4" fill="#dff2ff" stroke="#9ec8e0"/>
    ${eyes(25, 39, 25, 4, 0.5)}
    <path d="M26 32 L38 32 L32 38Z" fill="#f2c14a"/>`,

  // 大蝦蟇：横に広いがま、いぼ、大きな口
  ogama: `
    <ellipse cx="32" cy="40" rx="28" ry="20" fill="#7a6a3a"/>
    <circle cx="16" cy="24" r="8" fill="#7a6a3a"/><circle cx="48" cy="24" r="8" fill="#7a6a3a"/>
    ${eyes(16, 48, 23, 5, 0, "#f2d15c")}
    <path d="M8 42 Q32 54 56 42" stroke="${INK}" stroke-width="2.5" fill="none"/>
    <g fill="#5a4e2a"><circle cx="22" cy="34" r="2.5"/><circle cx="36" cy="32" r="2"/><circle cx="44" cy="36" r="2.5"/><circle cx="28" cy="50" r="2"/><circle cx="46" cy="50" r="2"/></g>
    <ellipse cx="32" cy="54" rx="14" ry="5" fill="#c8b87a"/>`,

  // 化け狸：丸いおなか、頭に葉っぱ、目のまわりの黒
  bakedanuki: `
    <ellipse cx="32" cy="44" rx="20" ry="17" fill="#8a6a44"/>
    <ellipse cx="32" cy="47" rx="12" ry="11" fill="#e8d2a8"/>
    <circle cx="32" cy="22" r="15" fill="#8a6a44"/>
    <circle cx="19" cy="10" r="5" fill="#8a6a44"/><circle cx="45" cy="10" r="5" fill="#8a6a44"/>
    <path d="M18 22 Q32 14 46 22 Q42 30 32 27 Q22 30 18 22Z" fill="#3a2a1a"/>
    ${eyes(25, 39, 22, 3.2)}
    <ellipse cx="32" cy="30" rx="3" ry="2" fill="${INK}"/>
    <path d="M28 4 Q36 -2 40 8 Q34 10 28 4Z" fill="#6fbf73"/><path d="M29 5 L39 7" stroke="#3f8f43" stroke-width="1"/>`,

  // ろくろ首：長くくねる首の先に顔
  rokurokubi: `
    <path d="M24 60 L40 60 L38 48 L26 48Z" fill="#c75b8a"/>
    <path d="M32 48 C 10 40, 54 30, 30 22 S 20 10, 36 8" stroke="#f1d9c4" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="40" cy="10" r="9" fill="#f1d9c4"/>
    <path d="M31 8 Q40 -2 49 8 L49 4 Q40 -6 31 4Z" fill="#20243a"/>
    <path d="M35 10 Q37 9 38 10 M42 10 Q44 9 45 10" stroke="${INK}" stroke-width="1.5" fill="none"/>
    <path d="M38 14 Q40 16 42 14" stroke="#c75b8a" stroke-width="1.5" fill="none"/>`,

  // 座敷童子：おかっぱの子ども、赤い着物、手まり
  zashiki: `
    <path d="M16 36 L48 36 L52 60 L12 60Z" fill="#c8443a"/>
    <path d="M32 36 L26 60 M32 36 L38 60" stroke="#f2d15c" stroke-width="2"/>
    <circle cx="32" cy="24" r="13" fill="#f7e3cc"/>
    <path d="M18 26 L18 16 Q32 4 46 16 L46 26 L42 26 L42 18 L22 18 L22 26Z" fill="#1c1a24"/>
    ${eyes(27, 37, 25, 2.6)}
    <circle cx="24" cy="29" r="2" fill="#f2a0a0" opacity=".7"/><circle cx="40" cy="29" r="2" fill="#f2a0a0" opacity=".7"/>
    <circle cx="52" cy="50" r="6" fill="#f2f2f2"/><path d="M46 50 Q52 44 58 50 M46 50 Q52 56 58 50" stroke="#5f88c9" stroke-width="1.5" fill="none"/>`,

  // 木霊：小さく白い体、穴のような目と口
  kodama: `
    <path d="M32 6 Q52 8 50 30 Q50 52 44 58 L20 58 Q14 52 14 30 Q12 8 32 6Z" fill="#eef2e6"/>
    <ellipse cx="25" cy="24" rx="3.5" ry="5" fill="${INK}"/><ellipse cx="39" cy="24" rx="3.5" ry="5" fill="${INK}"/>
    <ellipse cx="32" cy="36" rx="3" ry="4" fill="${INK}"/>
    <path d="M14 38 L6 34 M50 38 L58 34" stroke="#eef2e6" stroke-width="3" stroke-linecap="round"/>
    <path d="M32 6 Q30 0 36 -2" stroke="#6fbf73" stroke-width="2" fill="none"/>`,

  // 天狗：赤い顔に長い鼻、頭に小さな帽子、羽のうちわ
  tengu: `
    <path d="M46 36 Q62 30 60 50 Q56 56 50 50Z" fill="#3f8f5a"/>
    <path d="M48 40 L58 38 M49 45 L58 46" stroke="#2c6a42" stroke-width="1.2"/>
    <circle cx="28" cy="30" r="17" fill="#c8443a"/>
    <path d="M26 30 L58 22 L28 36Z" fill="#b23a32"/>
    <path d="M22 14 L34 14 L32 6 L24 6Z" fill="#1c1a24"/>
    <path d="M14 22 Q20 18 26 22" stroke="#f4f4f4" stroke-width="3" fill="none"/>
    ${slitEyes(20, 34, 26, INK)}
    <path d="M14 36 Q16 48 28 48 Q20 46 18 36Z" fill="#f4f4f4"/>`,

  // 鎌鼬：いたちの体、両手が鎌
  kamaitachi: `
    <path d="M16 50 Q8 40 18 30 Q24 20 34 22 Q48 24 46 40 Q44 54 30 56 Q20 56 16 50Z" fill="#c8a06a"/>
    <path d="M46 44 Q60 40 60 24" stroke="#c8a06a" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="30" cy="22" r="11" fill="#c8a06a"/>
    <circle cx="23" cy="13" r="3" fill="#c8a06a"/><circle cx="37" cy="13" r="3" fill="#c8a06a"/>
    ${slitEyes(26, 34, 21)}
    <ellipse cx="30" cy="27" rx="4" ry="2.5" fill="#f4e6c8"/>
    <path d="M12 34 Q2 30 4 18 Q8 26 14 28Z M44 30 Q56 22 52 10 Q50 20 42 24Z" fill="#dfe6f0" stroke="#8a95a8" stroke-width="1"/>`,

  // 酒呑童子：大きな赤い鬼、炎のような髪、大杯
  shuten: `
    <path d="M10 22 Q14 2 24 10 Q28 0 34 8 Q40 -2 44 10 Q54 4 54 22Z" fill="#f2743a"/>
    <path d="M16 14 L12 2 L22 10Z M48 14 L52 2 L42 10Z" fill="#f4e6c8"/>
    <rect x="10" y="16" width="44" height="36" rx="16" fill="#b8322a"/>
    ${slitEyes(24, 40, 30, "#f2d15c")}
    <path d="M20 42 L44 42 L40 48 L24 48Z" fill="${INK}"/>
    <path d="M24 42 L26 46 L28 42 M36 42 L38 46 L40 42" fill="#fff"/>
    <ellipse cx="54" cy="54" rx="9" ry="3.5" fill="#d9483b"/><path d="M45 54 Q54 64 63 54" fill="#a8322a"/>`,

  // 牛鬼：牛の頭、太い角、下に蜘蛛のような脚
  ushioni: `
    <g stroke="#2a2433" stroke-width="3.5" fill="none" stroke-linecap="round">
      <path d="M20 44 L8 50 L4 60 M22 48 L14 58 M42 44 L56 50 L60 60 M40 48 L50 58"/></g>
    <ellipse cx="32" cy="42" rx="18" ry="10" fill="#3a3446"/>
    <path d="M14 18 Q0 16 4 2 Q10 12 18 12Z M50 18 Q64 16 60 2 Q54 12 46 12Z" fill="#e8dcc0"/>
    <rect x="14" y="10" width="36" height="30" rx="12" fill="#4a4258"/>
    <ellipse cx="32" cy="34" rx="11" ry="7" fill="#7a6a80"/>
    <circle cx="28" cy="34" r="1.8" fill="${INK}"/><circle cx="36" cy="34" r="1.8" fill="${INK}"/>
    ${slitEyes(23, 41, 21, "#e0655a")}`,

  // 大嶽丸：深い青の顔、冠、稲妻
  otakemaru: `
    <path d="M52 2 L44 20 L52 20 L42 40" stroke="#f2d15c" stroke-width="3" fill="none" stroke-linejoin="round"/>
    <path d="M14 18 L18 4 L24 14 L32 2 L40 14 L46 4 L50 18Z" fill="#d9b24a"/>
    <rect x="12" y="16" width="40" height="38" rx="16" fill="#2f4a8a"/>
    <path d="M18 26 L28 30 M46 26 L36 30" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    ${eyes(24, 40, 34, 3.5, 0, "#f2d15c")}
    <path d="M24 46 Q32 42 40 46" stroke="${INK}" stroke-width="2.5" fill="none"/>`,

  // ぬりかべ：灰色の大きな壁、小さな目、短い足
  nurikabe: `
    <rect x="8" y="4" width="48" height="50" rx="4" fill="#8f8a74"/>
    <path d="M8 18 L56 18 M8 32 L56 32 M8 46 L56 46 M24 4 L24 18 M40 18 L40 32 M20 32 L20 46 M44 32 L44 46" stroke="#6f6a58" stroke-width="1.5"/>
    <circle cx="24" cy="24" r="2.5" fill="${INK}"/><circle cx="40" cy="24" r="2.5" fill="${INK}"/>
    <path d="M28 30 L36 30" stroke="${INK}" stroke-width="2"/>
    <rect x="14" y="54" width="10" height="7" rx="2" fill="#6f6a58"/><rect x="40" y="54" width="10" height="7" rx="2" fill="#6f6a58"/>`,

  // 一反木綿：白く細長い布が風にたなびく
  ittan: `
    <path d="M6 14 Q20 4 34 12 Q48 20 60 10 L60 22 Q48 32 34 24 Q20 16 6 26Z" fill="#f4f4f0"/>
    <path d="M34 24 Q30 40 40 50 Q48 58 44 64 L36 64 Q38 56 30 48 Q22 38 26 22Z" fill="#e8e8e0"/>
    <ellipse cx="14" cy="18" rx="2" ry="3" fill="${INK}"/><ellipse cx="22" cy="15" rx="2" ry="3" fill="${INK}"/>
    <path d="M6 30 Q12 32 16 30 M50 34 Q56 36 60 34" stroke="#8be3a8" stroke-width="1.5" fill="none"/>`,

  // 鬼火：青白い炎に目
  onibi: `
    <path d="M32 2 Q44 18 46 30 Q50 44 42 54 Q32 62 22 54 Q14 44 18 30 Q20 22 26 16 Q26 26 30 28 Q28 16 32 2Z" fill="#5fb3f0"/>
    <path d="M32 24 Q40 34 40 42 Q40 52 32 54 Q24 52 24 42 Q24 34 32 24Z" fill="#d8f0ff"/>
    ${eyes(28, 36, 42, 2.6)}`,

  // 火車：燃える車輪に猫の顔
  kasha: `
    <circle cx="32" cy="36" r="24" fill="none" stroke="#f2743a" stroke-width="4" stroke-dasharray="6 3"/>
    <path d="M8 36 Q4 22 12 16 Q12 26 18 26 M56 36 Q60 22 52 16 Q52 26 46 26" fill="#f2a541"/>
    <circle cx="32" cy="36" r="16" fill="#2a2433"/>
    <path d="M20 26 L22 14 L28 22Z M44 26 L42 14 L36 22Z" fill="#2a2433"/>
    <ellipse cx="26" cy="35" rx="3" ry="4" fill="#f2743a"/><ellipse cx="38" cy="35" rx="3" ry="4" fill="#f2743a"/>
    <path d="M29 43 Q32 46 35 43" stroke="#f2a541" stroke-width="1.5" fill="none"/>`,

  // 狂骨：白いどくろ、ざんばら髪、井戸のつるべ縄
  kyokotsu: `
    <path d="M52 0 L52 20" stroke="#8a6a44" stroke-width="2"/>
    <path d="M14 24 Q10 44 16 58 M50 24 Q54 44 48 58 M20 20 Q16 40 22 56 M44 20 Q48 40 42 56" stroke="#3a3446" stroke-width="3" fill="none"/>
    <path d="M14 26 Q14 6 32 6 Q50 6 50 26 Q50 36 44 40 L44 48 L20 48 L20 40 Q14 36 14 26Z" fill="#ece6d6"/>
    <ellipse cx="25" cy="26" rx="5" ry="6" fill="${INK}"/><ellipse cx="39" cy="26" rx="5" ry="6" fill="${INK}"/>
    <circle cx="25" cy="27" r="1.5" fill="#7fd4ff"/><circle cx="39" cy="27" r="1.5" fill="#7fd4ff"/>
    <path d="M30 34 L32 38 L34 34Z" fill="${INK}"/>
    <path d="M24 44 L24 48 M28 44 L28 48 M32 44 L32 48 M36 44 L36 48 M40 44 L40 48" stroke="#b9b3a3" stroke-width="1.5"/>`,

  // わいら：ずんぐりした獣、大きな前足の爪、土の色
  waira: `
    <ellipse cx="32" cy="40" rx="24" ry="18" fill="#7a6a54"/>
    <path d="M10 48 Q2 56 8 60 L18 58 Q16 52 20 50Z" fill="#6a5a44"/>
    <path d="M4 60 L6 54 M9 61 L10 55 M14 60 L14 55" stroke="#f4e6c8" stroke-width="2" stroke-linecap="round"/>
    <circle cx="36" cy="26" r="14" fill="#7a6a54"/>
    ${eyes(31, 42, 24, 3.2, -1, "#f2d15c")}
    <path d="M30 34 Q36 38 42 34" stroke="${INK}" stroke-width="2" fill="none"/>
    <path d="M24 14 L26 6 L30 12 M46 12 L48 4 L50 12" stroke="#5a4a36" stroke-width="3" stroke-linecap="round"/>`,

  // 狛犬：巻き毛のたてがみ、口を開けた獅子のような犬
  komainu: `
    <g fill="#5f88c9"><circle cx="14" cy="22" r="7"/><circle cx="12" cy="34" r="7"/><circle cx="16" cy="46" r="7"/>
      <circle cx="50" cy="22" r="7"/><circle cx="52" cy="34" r="7"/><circle cx="48" cy="46" r="7"/><circle cx="32" cy="12" r="8"/></g>
    <circle cx="32" cy="34" r="17" fill="#d8c9a0"/>
    ${eyes(25, 39, 30, 4, 0, "#f2d15c")}
    <path d="M24 40 Q32 50 40 40 Z" fill="#c8443a"/>
    <path d="M26 40 L28 43 L30 40 M34 40 L36 43 L38 40" fill="#fff"/>
    <ellipse cx="32" cy="36" rx="3" ry="2" fill="${INK}"/>`,

  // 山彦：大きな耳の小さな獣、声の波
  yamabiko: `
    <path d="M6 22 Q2 30 6 38 M2 18 Q-4 30 2 42" stroke="#8be3a8" stroke-width="2" fill="none"/>
    <path d="M58 22 Q62 30 58 38 M62 18 Q68 30 62 42" stroke="#8be3a8" stroke-width="2" fill="none"/>
    <ellipse cx="14" cy="22" rx="8" ry="11" fill="#9a8a6a"/><ellipse cx="50" cy="22" rx="8" ry="11" fill="#9a8a6a"/>
    <ellipse cx="14" cy="22" rx="4" ry="7" fill="#e8c8a8"/><ellipse cx="50" cy="22" rx="4" ry="7" fill="#e8c8a8"/>
    <ellipse cx="32" cy="42" rx="14" ry="16" fill="#9a8a6a"/>
    <circle cx="32" cy="28" r="13" fill="#9a8a6a"/>
    ${eyes(27, 37, 27, 3)}
    <ellipse cx="32" cy="36" rx="3.5" ry="4.5" fill="${INK}"/>`,

  // 白澤：白い獣、額と体にたくさんの目、長いあごひげ
  hakutaku: `
    <path d="M8 34 Q10 18 32 18 Q54 18 56 34 Q56 50 44 54 L20 54 Q8 50 8 34Z" fill="#f2efe6"/>
    <path d="M20 14 L16 2 L26 12Z M44 14 L48 2 L38 12Z" fill="#d9b24a"/>
    ${eyes(24, 40, 30, 3.5)}
    <ellipse cx="32" cy="22" rx="2.5" ry="4" fill="#fff" stroke="${INK}"/><circle cx="32" cy="22.5" r="1.4" fill="${INK}"/>
    <ellipse cx="14" cy="44" rx="2" ry="3" fill="#fff" stroke="${INK}"/><ellipse cx="50" cy="44" rx="2" ry="3" fill="#fff" stroke="${INK}"/>
    <path d="M26 42 Q32 62 38 42" fill="#dcd6c6"/>`,
};

/** そのユニットの絵（SVG の文字列）。ない場合は名前の1文字目 */
export function artSvg(id: string, fallback: string, tribeColor = "#888"): string {
  const body = ART[id] ?? genArtBody(id, tribeColor);
  if (!body) return `<span>${fallback}</span>`;
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" overflow="visible">${body}</svg>`;
}

// ---- 自動生成の妖怪の絵（系統ごとに同じ体、成長の段階で大きさ・目・飾りが変わる） ----

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h % 360} ${s}% ${l}%)`;
}

/** 型ごとの体の形 */
const BODY: Record<string, (c: string, d: string) => string> = {
  // 角のある戦士：どっしりした胴と頭
  striker: (c, d) => `<path d="M14 58 Q10 36 20 28 L44 28 Q54 36 50 58Z" fill="${d}"/><circle cx="32" cy="26" r="16" fill="${c}"/>`,
  drainer: (c, d) => `<path d="M10 56 Q8 30 32 24 Q56 30 54 56 Q32 62 10 56Z" fill="${c}"/><path d="M18 56 L22 48 L26 56 L30 48 L34 56 L38 48 L42 56 L46 48 L50 56Z" fill="${d}"/>`,
  // 炎・玉のような体
  caster: (c, d) => `<path d="M32 4 Q46 20 48 34 Q50 52 32 58 Q14 52 16 34 Q18 20 32 4Z" fill="${c}"/><path d="M32 26 Q40 34 40 42 Q40 52 32 54 Q24 52 24 42 Q24 34 32 26Z" fill="${d}" opacity=".55"/>`,
  // 岩・壁
  wall: (c, d) => `<path d="M8 58 L10 16 Q32 4 54 16 L56 58Z" fill="${c}"/><path d="M10 30 L54 30 M10 44 L56 44 M24 16 L22 30 M40 30 L42 44" stroke="${d}" stroke-width="2"/>`,
  endureWall: (c, d) => `<ellipse cx="32" cy="38" rx="26" ry="22" fill="${c}"/><ellipse cx="32" cy="46" rx="16" ry="11" fill="${d}" opacity=".6"/>`,
  guardian: (c, d) => `<path d="M8 22 Q32 10 56 22 L52 50 Q32 62 12 50Z" fill="${c}"/><path d="M32 22 L32 54 M14 34 L50 34" stroke="${d}" stroke-width="3"/>`,
  taunter: (c, d) => `<circle cx="32" cy="36" r="24" fill="${c}"/><path d="M12 30 L4 22 M52 30 L60 22" stroke="${d}" stroke-width="4" stroke-linecap="round"/>`,
  // 小さく丸い支援役
  buffer: (c, d) => `<circle cx="32" cy="38" r="18" fill="${c}"/><circle cx="32" cy="20" r="12" fill="${c}"/><path d="M20 44 Q32 52 44 44" stroke="${d}" stroke-width="3" fill="none"/>`,
  healer: (c, d) => `<path d="M32 8 Q52 10 50 34 Q50 54 32 58 Q14 54 14 34 Q12 10 32 8Z" fill="${c}"/><path d="M28 44 L36 44 M32 40 L32 48" stroke="${d}" stroke-width="3"/>`,
  // 道具のお化け・幽霊
  disruptorStat: (c, d) => `<rect x="12" y="12" width="40" height="40" rx="10" fill="${c}"/><path d="M12 24 L52 24" stroke="${d}" stroke-width="3"/><path d="M22 52 L20 60 M42 52 L44 60" stroke="${d}" stroke-width="3"/>`,
  disruptorStatus: (c, d) => `<path d="M12 60 L12 28 Q12 8 32 8 Q52 8 52 28 L52 60 L46 54 L39 60 L32 54 L25 60 L18 54Z" fill="${c}"/><path d="M18 20 Q32 12 46 20" stroke="${d}" stroke-width="2" fill="none"/>`,
  // 鳥・布
  dodger: (c, d) => `<path d="M32 16 Q48 18 50 34 Q48 50 32 52 Q16 50 14 34 Q16 18 32 16Z" fill="${c}"/><path d="M14 34 Q2 26 4 16 Q12 26 18 28Z M50 34 Q62 26 60 16 Q52 26 46 28Z" fill="${d}"/>`,
  scapegoat: (c, d) => `<ellipse cx="32" cy="40" rx="20" ry="18" fill="${c}"/><ellipse cx="18" cy="16" rx="5" ry="10" fill="${c}"/><ellipse cx="46" cy="16" rx="5" ry="10" fill="${c}"/><ellipse cx="32" cy="46" rx="9" ry="6" fill="${d}"/>`,
};

const EYES = [
  (y: number, r: number) => `<circle cx="25" cy="${y}" r="${r}" fill="#fff"/><circle cx="39" cy="${y}" r="${r}" fill="#fff"/><circle cx="25.5" cy="${y + 0.5}" r="${r * 0.5}" fill="${INK}"/><circle cx="39.5" cy="${y + 0.5}" r="${r * 0.5}" fill="${INK}"/>`,
  (y: number) => `<path d="M20 ${y + 1} L29 ${y - 2} M44 ${y + 1} L35 ${y - 2}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
  (y: number, r: number) => `<ellipse cx="32" cy="${y}" rx="${r + 2}" ry="${r + 3}" fill="#fff"/><circle cx="32" cy="${y + 1}" r="${r}" fill="${INK}"/>`,
  (y: number, r: number) => `<circle cx="25" cy="${y}" r="${r * 0.8}" fill="#f2d15c"/><circle cx="39" cy="${y}" r="${r * 0.8}" fill="#f2d15c"/><rect x="${24.3}" y="${y - r * 0.7}" width="1.4" height="${r * 1.4}" fill="${INK}"/><rect x="${38.3}" y="${y - r * 0.7}" width="1.4" height="${r * 1.4}" fill="${INK}"/>`,
];

const MOUTH = [
  (y: number) => `<path d="M27 ${y} Q32 ${y + 4} 37 ${y}" stroke="${INK}" stroke-width="2" fill="none"/>`,
  (y: number) => `<path d="M26 ${y} L38 ${y} L35 ${y + 4} L29 ${y + 4}Z" fill="${INK}"/><path d="M28 ${y} L29 ${y + 3} L30 ${y}M34 ${y} L35 ${y + 3} L36 ${y}" fill="#fff"/>`,
  (y: number) => `<ellipse cx="32" cy="${y + 1}" rx="3" ry="2.5" fill="${INK}"/>`,
];

const ACCESSORY = [
  (c: string) => `<path d="M20 14 L16 2 L26 10Z M44 14 L48 2 L38 10Z" fill="${c}"/>`, // 角
  (c: string) => `<path d="M18 16 L20 4 L28 12Z M46 16 L44 4 L36 12Z" fill="${c}"/>`, // 耳
  (c: string) => `<path d="M22 10 L26 2 L32 8 L38 2 L42 10Z" fill="#d9b24a"/><circle cx="32" cy="6" r="2" fill="${c}"/>`, // 冠
  (c: string) => `<path d="M32 2 Q40 -2 42 8 Q36 10 32 2Z" fill="#6fbf73"/><path d="M32 2 Q24 -2 22 8 Q28 10 32 2Z" fill="#8fd48f"/>`, // 葉
  (c: string) => `<ellipse cx="32" cy="3" rx="12" ry="3" fill="none" stroke="#f2d15c" stroke-width="2"/>`, // 輪
  (c: string) => `<path d="M26 10 Q32 -4 38 10" fill="${c}"/>`, // 炎の先
];

/** 自動生成の妖怪の SVG の中身（viewBox 0 0 64 64） */
export function genArtBody(id: string, tribeColor: string): string | null {
  const look = LOOKS[id];
  if (!look) return null;
  const fh = hashStr(look.family);
  const hue = (fh % 360 + (hashStr(tribeColor) % 40)) % 360;
  const c = hsl(hue, 45 + (fh % 20), 52 - look.form * 4);
  const d = hsl(hue + 20, 40, 30);
  const body = (BODY[look.role] ?? BODY.buffer)(c, d);
  const eyeStyle = EYES[(fh >>> 3) % EYES.length];
  const eyeY = look.role === "caster" ? 38 : look.role === "wall" ? 26 : look.role === "buffer" ? 20 : 26;
  const eyeR = [4.8, 3.8, 3.2][look.form];
  const mouth = MOUTH[(fh >>> 5) % MOUTH.length](eyeY + 9);
  // 成長の段階：子どもは飾りなし、ふつうは1つ、長は2つ
  const acc: string[] = [];
  if (look.form >= 1) acc.push(ACCESSORY[(fh >>> 7) % ACCESSORY.length](d));
  if (look.form >= 2) acc.push(ACCESSORY[2](d));
  const scale = [0.78, 0.92, 1.05][look.form];
  const off = 32 - 32 * scale;
  return `<g transform="translate(${off} ${off + (1 - scale) * 14}) scale(${scale})">${acc.join("")}${body}${eyeStyle(eyeY, eyeR)}${mouth}</g>`;
}
