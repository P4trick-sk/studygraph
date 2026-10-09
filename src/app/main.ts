import * as SG from "../core/index.js";
import { setUILanguage } from "./i18n.js";
import { $, S, esc, hideAllPreviews, idb, itemHref, loadProgress, toast } from "./base.js";
import { closeOverlays, openPalette, route, shell, wireSearch } from "./pages.js";
import { pickFiles } from "./study.js";
import { enableSync, pushSync } from "./tutor.js";
// ---------- course loading
export function setCourse(course, isDemo) {
  S.course = course; S.isDemo = isDemo; S.G = SG.buildGraph(course);
  S.G.demotions = course.demotions || [];
  S.key = `sg:${S.G.cfg.app.courseId}:v1`; S.P = loadProgress(); S.sync = null;
  setUILanguage(S.G.cfg.language.ui);
  shell();
}
export async function pickCourseFiles() {
  const files: File[] = await pickFiles(".json,application/json", true); if (!files.length) return;
  try {
    const parsed = await Promise.all(files.map(async f => JSON.parse(await f.text())));
    const course = SG.assembleCourse(parsed); SG.buildGraph(course);
    await idb.set("course", course); setCourse(course, false); location.hash = "#/"; route();
    toast(`Opened ${course.topics.length} topics.${course.warnings.length ? ` ${course.warnings.length} note${course.warnings.length > 1 ? "s" : ""}: ${course.warnings[0]}` : ""}`, 5000);
  } catch (e: any) { console.error(e); toast(e instanceof SyntaxError ? "One of those files is not valid JSON." : "Could not open the course: " + e.message, 6000); }
}
export async function useDemo() { await idb.del("course"); setCourse(S.bootCourse, true); location.hash = "#/"; route(); }

// ---------- keyboard
export let gPending = 0;
document.addEventListener("keydown", e => {
  const typing = (e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable]");
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
  if (e.key === "Escape") { closeOverlays(); hideAllPreviews(); return; }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "/") { e.preventDefault(); openPalette(); return; }
  if (e.key === "?") { showKeys(); return; }
  if (e.key === "g") { gPending = Date.now(); return; }
  if (e.key === "m" && Date.now() - gPending < 1200) { location.hash = "#/map"; gPending = 0; return; }
  if ((e.key === "j" || e.key === "k") && S.route?.name === "n") {
    const n = S.G.nodes[S.route.arg]; if (!n) return; const ids = S.G.topicById[n.topic].nodeIds, i = ids.indexOf(n.id);
    const to = ids[i + (e.key === "j" ? 1 : -1)]; if (to) location.hash = itemHref(to);
  }
});
export function showKeys() {
  closeOverlays(); const sc = document.createElement("div"); sc.className = "scrim";
  sc.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><h2>Keyboard shortcuts</h2><div class="keys">
    <span><kbd>Ctrl K</kbd> or <kbd>/</kbd></span><span>Search</span><span><kbd>j</kbd> <kbd>k</kbd></span><span>Next and previous item in the topic</span>
    <span><kbd>g</kbd> then <kbd>m</kbd></span><span>Concept map</span><span><kbd>?</kbd></span><span>This list</span><span><kbd>Esc</kbd></span><span>Close</span></div>
    <div class="row" style="margin-top:18px"><button class="btn" id="kclose">Close</button></div></div>`;
  document.body.appendChild(sc); $("#kclose").onclick = closeOverlays; sc.onclick = e => { if (e.target === sc) closeOverlays(); }; $("#kclose").focus();
}

// ---------- boot
export async function boot() {
  const B = S.boot, viewer = B.mode !== "standalone";
  S.allowOpen = B.allowOpen ?? viewer; S.pushSync = pushSync;
  let base: any = B.course;
  if (!base && B.courseUrl) {
    try { const r = await fetch(B.courseUrl); if (!r.ok) throw new Error(r.status + " " + r.statusText); base = await r.json(); }
    catch (e: any) { $("#main").innerHTML = `<div class="page"><h1>The course could not be loaded</h1><p class="lead">${esc(B.courseUrl)}: ${esc(e.message)}. Open the page through a web server (studygraph serve), not as a local file.</p></div>`; return; }
  }
  if (!base) { $("#main").innerHTML = `<div class="page"><h1>No course in this page</h1></div>`; return; }
  const assembled: any = SG.assembleCourse([base]);
  assembled.embedded = !viewer || !!base.embedded;
  S.bootCourse = assembled;
  let stored = null; if (S.allowOpen) { try { stored = await idb.get("course"); } catch (e: any) { } }
  try { setCourse(stored || S.bootCourse, !stored); } catch (e: any) { setCourse(S.bootCourse, true); }
  wireSearch();
  window.addEventListener("hashchange", route);
  route();
  const use = n => (window.claude && typeof window.claude.use === "function") ? window.claude.use(n).catch(() => null) : Promise.resolve(null);
  S.capsReady = Promise.all(["sample", "downloads", "db", "user"].map(n => use(n).then(v => (S.caps[n] = v)))).then(() => {
    if (S.route?.name === "stats") route();
    try { if (localStorage.getItem(`sg:sync:${S.G.cfg.app.courseId}`)) enableSync(false); } catch (e: any) { }
  });
}
boot();
