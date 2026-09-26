// 妖怪大戦のビルド。
//   node tools/build.mjs               → dist/index.html（1ファイルで動くページ）
//   node tools/build.mjs --no-minify   → 圧縮しない（デバッグ用）
//   node tools/build.mjs --engine-only → dist/engine.cjs（Node で対戦ロジックだけ動かすテスト用）
//
// src/game.js の中の /*@@include ext/xxx.js@@*/ を、そのファイルの中身で置き換える。
// すべて同じ即時関数のスコープに入るので、ext 側から既存の関数・データをそのまま使える。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));

function expand(file, seen = new Set()) {
  if (seen.has(file)) throw new Error(`include loop: ${file}`);
  seen.add(file);
  const src = readFileSync(join(root, "src", file), "utf8");
  return src.replace(/\/\*@@include ([^@]+)@@\*\//g, (_, p) => `// ---- ${p.trim()} ----\n${expand(p.trim(), new Set(seen))}\n// ---- end ${p.trim()} ----`);
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
let js = expand("game.js").replace(/__APP_VERSION__/g, JSON.stringify(pkg.version));
mkdirSync(join(root, "dist"), { recursive: true });

if (args.has("--engine-only")) {
  // 対戦ロジックとデータだけを切り出す（three.js と画面の部分は含めない）
  const cut = js.indexOf("/*@@ENGINE_END@@*/");
  if (cut < 0) throw new Error("ENGINE_END marker not found");
  const body = js.slice(0, cut).replace(/^"use strict";\s*\(\(\) => \{/, "");
  const out = `"use strict";\nmodule.exports = (() => {\n${body}\nreturn __engineExports();\n})();\n`;
  writeFileSync(join(root, "dist", "engine.cjs"), out);
  console.log(`dist/engine.cjs ${(out.length / 1024).toFixed(0)} KB`);
} else {
  if (!args.has("--no-minify")) {
    js = transformSync(js, { minify: true, target: "es2020", charset: "utf8", legalComments: "none" }).code;
  }
  const html = readFileSync(join(root, "src", "template.html"), "utf8");
  const safe = js.replace(/<\/script/gi, "<\\/script");
  const out = html.replace("/*@@APP@@*/", () => safe);
  writeFileSync(join(root, "dist", "index.html"), out);
  console.log(`dist/index.html ${(out.length / 1024).toFixed(0)} KB`);
}
