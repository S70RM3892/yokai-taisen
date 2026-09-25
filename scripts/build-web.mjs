// ブラウザ版を1つの HTML にまとめる：dist/yokai-taisen.html
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const result = await build({
  entryPoints: ["src/web/app.ts"],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: true,
  write: false,
});
const js = result.outputFiles[0].text.replace(/<\/script/g, "<\\/script");
const page = readFileSync("src/web/page.html", "utf8").replace("<!--APP-->", () => `<script>${js}</script>`);
mkdirSync("dist", { recursive: true });
writeFileSync("dist/yokai-taisen.html", page);
console.log(`dist/yokai-taisen.html ${(page.length / 1024).toFixed(1)} KB`);
