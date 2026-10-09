/** `studygraph ingest`: per-page text from PDF (pdftotext), PPTX/DOCX (unzip), Markdown/TXT/TeX; flags garbled maths. */
import { readdirSync, statSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { readJson, writeJson } from "./workspace.js";

const GARBLE = [/^\s*[\w′'^*]{1,2}\s*$/, /[\uFFFD\u25A1]/, /\s[=<>≤≥]\s*$/, /̸/, /∼=/, /\b[a-zA-Z]\s[a-zA-Z]\s[a-zA-Z]\s[a-zA-Z]\b/];
const mathScore = (t: string) => { const ls = t.split("\n"); const bad = ls.reduce((s, l) => s + GARBLE.filter(r => r.test(l)).length, 0); return bad / Math.max(1, ls.length); };
const has = (cmd: string) => spawnSync("sh", ["-c", `command -v ${cmd}`]).status === 0;
const xmlText = (x: string) => x.split(/<\/a:p>|<\/w:p>/).map(p => p.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")).filter(s => s.trim()).join("\n");

function pages(path: string): string[] {
  const ext = extname(path).toLowerCase();
  if (ext === ".pdf") {
    if (!has("pdftotext")) throw new Error("pdftotext is missing (install poppler-utils)");
    const t = execFileSync("pdftotext", ["-layout", path, "-"], { maxBuffer: 1 << 28 }).toString();
    const p = t.split("\f"); if (p.length && !p[p.length - 1].trim()) p.pop(); return p;
  }
  if (ext === ".pptx" || ext === ".docx") {
    if (!has("unzip")) throw new Error("unzip is missing");
    const list = execFileSync("unzip", ["-Z1", path]).toString().split("\n");
    if (ext === ".docx") { const t = xmlText(execFileSync("unzip", ["-p", path, "word/document.xml"], { maxBuffer: 1 << 28 }).toString()); const out = []; for (let i = 0; i < t.length; i += 6000) out.push(t.slice(i, i + 6000)); return out.length ? out : [""]; }
    const slides = list.filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/\d+/g)!.pop()! - +b.match(/\d+/g)!.pop()!);
    return slides.map(s => { const k = s.match(/\d+/g)!.pop(); let t = xmlText(execFileSync("unzip", ["-p", path, s]).toString());
      const note = `ppt/notesSlides/notesSlide${k}.xml`; if (list.includes(note)) t += "\n\n[notes]\n" + xmlText(execFileSync("unzip", ["-p", path, note]).toString()); return t; });
  }
  if ([".md", ".txt", ".tex"].includes(ext)) { const t = readFileSync(path, "utf8"); if (t.includes("\f")) return t.split("\f"); const p = t.split(/\n-{3,}\n/); return p.length > 1 ? p : [t]; }
  return [];
}

export function ingest(root: string, files: string[] = [], opts: { images?: boolean } = {}) {
  const src = join(root, "sources"), out = join(src, "text");
  mkdirSync(out, { recursive: true });
  if (!files.length) files = readdirSync(src).map(f => join(src, f)).filter(f => statSync(f).isFile());
  const idxPath = join(out, "index.json"); const index: Record<string, any> = existsSync(idxPath) ? readJson(idxPath) : {};
  const report: Array<{ file: string; pages: number; flagged: number[] }> = [];
  for (const f of files) {
    const ps = pages(f); if (!ps.length) continue;
    const stem = basename(f, extname(f)), d = join(out, stem); mkdirSync(d, { recursive: true });
    const flagged: number[] = [];
    ps.forEach((p, i) => { writeFileSync(join(d, `p${String(i + 1).padStart(3, "0")}.txt`), p); if (mathScore(p) >= 0.15) flagged.push(i + 1); });
    index[basename(f)] = { dir: `sources/text/${stem}`, pages: ps.length, mathFlagged: flagged, chars: ps.reduce((s, p) => s + p.length, 0) };
    if (opts.images && extname(f).toLowerCase() === ".pdf" && flagged.length && has("pdftoppm")) {
      mkdirSync(join(d, "img"), { recursive: true });
      for (const i of flagged.slice(0, 60)) spawnSync("pdftoppm", ["-png", "-r", "110", "-f", String(i), "-l", String(i), f, join(d, "img", `p${String(i).padStart(3, "0")}`)]);
    }
    report.push({ file: basename(f), pages: ps.length, flagged });
  }
  writeJson(idxPath, index);
  return report;
}
