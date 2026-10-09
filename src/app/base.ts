import type { AppState, BootConfig } from "./boot-types.js";
import * as SG from "../core/index.js";
import { UI_LANG } from "./i18n.js";
/* Studygraph viewer — part 1: utilities, storage, rich text, previews, figures */
export const $ = (s: string, r: ParentNode = document): any => r.querySelector(s);
export const $$ = (s: string, r: ParentNode = document): any[] => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const h = (strings, ...vals) => strings.reduce((a, s, i) => a + s + (i < vals.length ? (Array.isArray(vals[i]) ? vals[i].join("") : vals[i] ?? "") : ""), "");
export const ICON = {
  topics: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  map: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="10" cy="18" r="2.5"/><path d="M8.2 7l7.4.7M7 8.3l2.2 7.4M16.4 10l-4.6 6"/></svg>',
  quiz: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M9.5 10a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5M12 16.5v.1"/></svg>',
  review: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  stats: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 19V11M12 19V5M19 19v-6"/></svg>',
  search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>',
};

// ---------- app state
export const S: AppState = { course: null, G: null, P: null, key: "", caps: {}, sync: null, isDemo: true, route: null, session: null,
  boot: (window.SG_BOOT || { mode: "viewer" }) as BootConfig };
export const UI = {
  sessionTitle: { due: "Due today", topic: "Topic quiz", weak: "Weak spots", path: "Path quiz" },
};

// ---------- storage (localStorage for progress, IndexedDB for an opened course)
export const blankProgress = () => ({ v: 1, cards: {}, answers: {}, review: {}, reviewer: "", last: null, lastPath: null, updatedAt: 0 });
export function loadProgress() {
  try { const raw = localStorage.getItem(S.key); if (raw) return { ...blankProgress(), ...JSON.parse(raw) }; } catch (e: any) { }
  return blankProgress();
}
export let saveTimer = null;
export function saveProgress(touch = true) {
  if (touch) S.P.updatedAt = Date.now();
  try { localStorage.setItem(S.key, JSON.stringify(S.P)); } catch (e: any) { }
  if (S.sync?.on) { clearTimeout(saveTimer); saveTimer = setTimeout(() => S.pushSync?.(), 4000); }
}
export const idb = {
  open(): Promise<IDBDatabase> { return new Promise((res, rej) => { try { const r = indexedDB.open("studygraph", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e: any) { rej(e); } }); },
  async get(k) { try { const db = await this.open(); return await new Promise(res => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); } catch (e: any) { return undefined; } },
  async set(k, v) { try { const db = await this.open(); return await new Promise(res => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }); } catch (e: any) { return false; } },
  async del(k) { try { const db = await this.open(); db.transaction("kv", "readwrite").objectStore("kv").delete(k); } catch (e: any) { } },
};

// ---------- scripts
export const loaded = {};
export function loadScript(urls) {
  const key = urls[0];
  if (loaded[key]) return loaded[key];
  return (loaded[key] = new Promise<void>((res, rej) => {
    const tryAt = i => {
      if (i >= urls.length) return rej(new Error("Could not load " + key));
      const s = document.createElement("script"); s.src = urls[i]; s.async = true;
      s.onload = () => res(); s.onerror = () => { s.remove(); tryAt(i + 1); };
      document.head.appendChild(s);
    };
    tryAt(0);
  }));
}
export const LIB = {
  cytoscape: ["https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.30.2/cytoscape.min.js", "https://cdn.jsdelivr.net/npm/cytoscape@3.30.2/dist/cytoscape.min.js"],
  mermaid: ["https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js", "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"],
  hljs: ["https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js", "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/core.min.js"],
};

// ---------- small helpers
export const typeOf = id => S.G.nodes[id] ? S.G.cfg.typeById[S.G.nodes[id].type] || { label: S.G.nodes[id].type, color: "#a8b2ad" } : S.G.apps[id] ? { label: "Application", color: SG.APP_COLOR } : null;
export const colorOf = id => typeOf(id)?.color || "#a8b2ad";
export const itemHref = id => S.G.apps[id] ? `#/app/${encodeURIComponent(id)}` : `#/n/${encodeURIComponent(id)}`;
export const titleOf = id => S.G.nodes[id]?.title || S.G.apps[id]?.title || S.G.figures[id]?.title || S.G.reserved[id]?.title || id;
export const tt = id => rich(titleOf(id), { inline: true, nolinks: true });
export const chip = id => { const t = typeOf(id); return t ? `<span class="chip cd tc" style="--tc:${t.color}">${esc(t.label)}</span>` : ""; };
export const typeChip = t => `<span class="chip cd tc" style="--tc:${t.color}">${esc(t.label)}</span>`;
export const reviewBadge = n => { const st = n.review?.status || "draft"; const c = (n.review?.notes || []).length;
  return `<span class="badge-review ${st}" title="Review status">${st === "checked" ? "Checked" : st === "flagged" ? "Flagged" : "Draft"}${c ? ` · ${c} note${c > 1 ? "s" : ""}` : ""}</span>`; };
export const ORIGIN = { slides: "From the slides", supplement: "Supplement", generated: "Generated" };
export const pips = (n, max = 3, label = "") => `<span class="pips" title="${esc(label)} ${n} of ${max}" aria-label="${esc(label)} ${n} of ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;
export const mastery = id => SG.mastery(S.G, S.P, id);
export const mbar = id => { const m = mastery(id); return `<span class="mbar" title="Mastery ${Math.round(m * 100)}%"><i style="width:${Math.round(m * 100)}%"></i></span>`; };
export function toast(msg, ms = 2600) { const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e: any) {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (e2: any) { } ta.remove(); return ok;
  }
}
export const fmtDays = ms => { const sk = UI_LANG.on, d = ms / SG.FSRS.DAY;
  if (d < 1 / 24) return Math.max(1, Math.round(ms / 6e4)) + " min"; if (d < 1) return Math.round(d * 24) + " h";
  if (d < 31) { const n = Math.round(d); return n + (sk ? (n === 1 ? " deň" : n < 5 ? " dni" : " dní") : " d"); }
  if (d < 365) { const n = Math.round(d / 30); return n + (sk ? (n === 1 ? " mesiac" : n < 5 ? " mesiace" : " mesiacov") : " mo"); }
  return (d / 365).toFixed(1) + (sk ? " r." : " y"); };
export const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- rich text: markdown + KaTeX (MathML) + [text](node-id) links
// MathML Core (Chromium) ignores mathvariant and stretchy overlines; map them to Unicode letters and a CSS rule.
export const MV = {
  script: [0x1D49C, 0x1D4B6, { B: "ℬ", E: "ℰ", F: "ℱ", H: "ℋ", I: "ℐ", L: "ℒ", M: "ℳ", R: "ℛ", e: "ℯ", g: "ℊ", o: "ℴ" }],
  "double-struck": [0x1D538, 0x1D552, { C: "ℂ", H: "ℍ", N: "ℕ", P: "ℙ", Q: "ℚ", R: "ℝ", Z: "ℤ" }],
  fraktur: [0x1D504, 0x1D51E, { C: "ℭ", H: "ℌ", I: "ℑ", R: "ℜ", Z: "ℨ" }],
};
export function fixMathML(m) {
  m = m.replace(/<mi mathvariant="(script|double-struck|fraktur)">([A-Za-z]+)<\/mi>/g, (_, v, letters) => {
    const [up, lo, ex] = MV[v]; return "<mi>" + [...letters].map(c => ex[c] || String.fromCodePoint((c <= "Z" ? up : lo) + c.charCodeAt(0) - (c <= "Z" ? 65 : 97))).join("") + "</mi>"; });
  let prev; do { prev = m; m = m.replace(/<mover accent="true">((?:(?!<mover)[\s\S])*?)<mo stretchy="true">[‾¯]<\/mo><\/mover>/g, '<mrow class="ovl">$1</mrow>'); } while (m !== prev);
  return m;
}
export function renderMath(tex, display) {
  if (window.katex) { try { return fixMathML(katex.renderToString(tex, { output: "mathml", throwOnError: false, displayMode: display })); } catch (e: any) { } }
  return `<code>${esc(tex)}</code>`;
}
export const ID_RE = /^(?:[a-z][a-z0-9]*)\.[A-Za-z0-9][\w-]*$/;
export function rich(text, { inline = false, nolinks = false } = {}) {
  if (!text) return "";
  const math = [], links = [];
  let s = String(text).replace(/\\\$/g, "\u0001")
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => `MQZ${math.push([t, true]) - 1}QZM`)
    .replace(/\$([^$\n]+?)\$/g, (_, t) => `MQZ${math.push([t, false]) - 1}QZM`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, id) => ID_RE.test(id) ? `LQZ${links.push([label, id]) - 1}QZL` : m)
    .replace(/</g, "&lt;");
  let html;
  if (window.marked) { try { html = inline ? marked.parseInline(s) : marked.parse(s); } catch (e: any) { html = null; } }
  if (html == null) html = inline ? esc(s) : s.split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join("");
  html = html.replace(/LQZ(\d+)QZL/g, (_, i) => {
    const [label, id] = links[i]; const inner = esc(label);
    if (nolinks) return inner;
    if (S.G.nodes[id] || S.G.apps[id]) return `<a class="xl" href="${itemHref(id)}" data-pv="${esc(id)}" style="--tc:${colorOf(id)}">${inner}</a>`;
    if (S.G.figures[id]) return `<a class="xl" href="#fig-${esc(id)}" style="--tc:var(--muted)">${inner}</a>`;
    if (S.G.reserved[id]) return `<span class="xl planned" tabindex="0" title="Planned: ${esc(S.G.reserved[id].title || id)}, in an unwritten topic">${inner}</span>`;
    return `<span class="xl planned" title="Unknown link ${esc(id)}">${inner}</span>`;
  });
  html = html.replace(/MQZ(\d+)QZM/g, (_, i) => renderMath(math[i][0], math[i][1]));
  return html.replace(/\u0001/g, "$");
}
export const mathless = t => String(t || "").replace(/\$([^$]*)\$/g, (_, m) => m.replace(/\\math[a-z]+\{([^}]*)\}/g, "$1").replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, ""));
export const plain = t => SG.stripMarkup(t).replace(/\s+/g, " ").trim();

// ---------- hover previews (one nested level; long-press on touch)
export const PV = { cards: [] as HTMLElement[], timer: null as any, hideTimer: null as any, touchTimer: null as any, suppressClick: false, tapped: null as Element | null };
export function previewHTML(id) {
  const n = S.G.nodes[id] || S.G.apps[id]; if (!n) return "";
  const txt = n.statement || n.summary || "";
  let cut = txt;
  if (plain(txt).length > 900) { const blocks = String(txt).split(/\n{2,}/); let acc = []; for (const b of blocks) { acc.push(b); if (plain(acc.join(" ")).length > 700) break; } cut = acc.join("\n\n") + (acc.length < blocks.length ? "\n\n…" : ""); }
  const here = S.route && (S.G.nodes[S.route.arg]?.topic || S.route.arg);
  const t = S.G.topicById[n.topic];
  return `<div class="row">${chip(id)}${t && t.id !== here ? `<span class="small faint">from ${esc(t.title)}</span>` : ""}</div><div class="ph">${tt(id)}</div><div class="prose">${rich(cut)}</div>`;
}
export function showPreview(a, touch = false) {
  const id = a.dataset.pv; const level = a.closest(".preview") ? +a.closest(".preview").dataset.level + 1 : 0;
  if (level > 1) return;
  while (PV.cards.length > level) PV.cards.pop().remove();
  const c = document.createElement("div"); c.className = "preview"; c.dataset.level = String(level); c.style.setProperty("--tc", colorOf(id));
  c.innerHTML = previewHTML(id) + (touch ? `<a class="pvopen" href="${a.getAttribute("href") || itemHref(id)}">Open</a>` : ""); c.setAttribute("role", touch ? "dialog" : "tooltip");
  document.body.appendChild(c); PV.cards.push(c);
  const r = a.getBoundingClientRect(), cw = c.offsetWidth, ch = c.offsetHeight;
  let x = Math.min(Math.max(10, r.left), innerWidth - cw - 10), y = r.bottom + 8;
  if (y + ch > innerHeight - 10) y = Math.max(10, r.top - ch - 8);
  c.style.left = x + "px"; c.style.top = y + "px";
  c.addEventListener("mouseenter", () => clearTimeout(PV.hideTimer));
  c.addEventListener("mouseleave", () => scheduleHide(0));
}
export function scheduleHide(level = 0) { clearTimeout(PV.hideTimer); PV.hideTimer = setTimeout(() => { while (PV.cards.length > level) PV.cards.pop().remove(); }, 220); }
export function hideAllPreviews() { clearTimeout(PV.timer); PV.tapped = null; while (PV.cards.length) PV.cards.pop().remove(); }
// Mouse: hover shows the preview. Touch and pen (tablets, phones): the first tap on a reference shows the
// preview, a second tap on the same reference (or the preview's Open link) goes there.
export let lastPT = "mouse";
document.addEventListener("pointerdown", e => { lastPT = e.pointerType || "mouse"; }, true);
document.addEventListener("mouseover", e => {
  const a = (e.target as HTMLElement).closest("[data-pv]"); if (!a || lastPT !== "mouse" || matchMedia("(hover: none)").matches) return;
  clearTimeout(PV.timer); clearTimeout(PV.hideTimer); PV.timer = setTimeout(() => showPreview(a), 260);
  a.addEventListener("mouseleave", () => { clearTimeout(PV.timer); const lv = a.closest(".preview") ? +a.closest(".preview").dataset.level + 1 : 0; scheduleHide(lv); }, { once: true });
});
document.addEventListener("click", e => {
  if (lastPT === "mouse") return;
  const a = (e.target as HTMLElement).closest("[data-pv]");
  if (a && a.closest("#results, .sres")) { hideAllPreviews(); return; } // search results: open the item directly
  if (!a) { if (!(e.target as HTMLElement).closest(".preview")) hideAllPreviews(); return; }
  if (PV.tapped === a && PV.cards.length) { hideAllPreviews(); return; } // second tap: follow the link
  e.preventDefault(); e.stopPropagation();
  showPreview(a, true); PV.tapped = a;
}, true);
window.addEventListener("scroll", () => { if (lastPT !== "mouse") hideAllPreviews(); }, { passive: true });
document.addEventListener("focusin", e => { const a = (e.target as HTMLElement).closest?.("[data-pv]"); if (a && (e.target as HTMLElement).matches(":focus-visible")) { clearTimeout(PV.timer); PV.timer = setTimeout(() => showPreview(a), 300); } });
document.addEventListener("focusout", e => { if ((e.target as HTMLElement).closest?.("[data-pv]")) scheduleHide(0); });


export const VIEWS: Record<string, any> = {};
