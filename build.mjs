// src/ をまとめて 1 枚の HTML（dist/yokai-taisen.html）にする。doctype などの外枠は Artifact 側で付く
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const js = await build({
  entryPoints: ["src/app.js"],
  bundle: false,
  minify: true,
  write: false,
  target: "es2020",
  charset: "utf8",
  legalComments: "none",
});
const code = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync("src/style.css", "utf8");
const html = readFileSync("src/shell.html", "utf8")
  .replace("/*CSS*/", () => css)
  .replace("/*JS*/", () => code);
mkdirSync("dist", { recursive: true });
writeFileSync("dist/yokai-taisen.html", html);
console.log(`dist/yokai-taisen.html ${(html.length / 1024).toFixed(1)} KB`);
