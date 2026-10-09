// Bundles the browser app (src/app/main.ts) into lib/app/app.js and copies the stylesheet and page template.
import { build } from "esbuild";
import { mkdirSync, copyFileSync, readFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
mkdirSync("lib/app", { recursive: true });
await build({ entryPoints: ["src/app/main.ts"], bundle: true, format: "iife", target: "es2020", minify: true,
  outfile: "lib/app/app.js", legalComments: "none", define: { __SG_VERSION__: JSON.stringify(pkg.version) } });
copyFileSync("src/app/style.css", "lib/app/style.css");
console.log("app bundle: lib/app/app.js");
