import * as SG from "../core/index.js";
import { $, $$, ORIGIN, S, VIEWS, chip, colorOf, copyText, esc, fmtDays, h, hideAllPreviews, itemHref, mastery, mbar, plain, renderMath, reviewBadge, rich, saveProgress, toast, tt, typeChip, typeOf } from "./base.js";
import { figureHTML, mountFigures } from "./figures.js";
import { startSession } from "./study.js";
import { openTutor, tutorBundle } from "./tutor.js";
import { pickCourseFiles, useDemo } from "./main.js";
/* Studygraph viewer — part 2: rail layout, router, reading views, search */
export function dueCount(now = Date.now()) { return Object.values(S.P.cards).filter(c => c.due <= now).length; }
export const pad2 = n => String(n ?? "").padStart(2, "0");

export function shell() {
  const G = S.G, cfg = G.cfg, due = dueCount();
  document.title = cfg.app.brand;
  const counts = {}; Object.values(G.nodes).forEach(n => counts[n.topic] = (counts[n.topic] || 0) + 1);
  const groups = cfg.courses.length ? cfg.courses.map(c => ({ c, ts: G.topics.filter(t => t.course === c.id) })) : [{ c: { id: "", title: "Topics" }, ts: G.topics }];
  const loose = cfg.courses.length ? G.topics.filter(t => !cfg.courses.some(c => c.id === t.course)) : [];
  if (loose.length) groups.push({ c: { id: "", title: "Other topics" }, ts: loose });
  $("#rail").innerHTML = `<a class="brand" href="#/">${esc(cfg.app.brand)}<small>${esc(cfg.app.kicker)}</small></a>
    <h3>Tools</h3><nav class="tools">
      <a class="tool" href="#/map" data-nav="map"><span class="ic">◎</span>Concept map</a>
      ${Object.keys(G.apps).length ? `<a class="tool" href="#/apps" data-nav="apps"><span class="ic">⌁</span>Applications</a>` : ""}
      <a class="tool" href="#/quiz" data-nav="quiz"><span class="ic">?</span>Quiz${due ? `<span class="badge">${due}</span>` : ""}</a>
      <a class="tool" href="#/review" data-nav="review"><span class="ic">✓</span>Review</a>
      <a class="tool" href="#/stats" data-nav="stats"><span class="ic">▮</span>Stats</a></nav>
    ${groups.filter(g => g.ts.length).map(g => `<h3>${esc(g.c.title)}</h3><nav>${g.ts.map(t => `<a class="tl" href="#/t/${encodeURIComponent(t.id)}" data-topic="${esc(t.id)}"><span class="no">${pad2(t.order)}</span><span>${esc(t.title)}</span><span class="ct">${counts[t.id] || 0}</span></a>`).join("")}</nav>`).join("")}`;
}
export function markNav(r) {
  const G = S.G;
  const topic = r.name === "t" ? r.arg : r.name === "n" ? G.nodes[r.arg]?.topic : r.name === "app" ? G.apps[r.arg]?.topic : null;
  $$(".rail .tl").forEach(a => a.classList.toggle("on", a.dataset.topic === topic));
  $$(".rail .tool").forEach(a => a.classList.toggle("on", a.dataset.nav === r.name));
}

export function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, ""); const [path, qs] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || "home", arg: parts[1], q: new URLSearchParams(qs || "") };
}
export const WIDE = new Set(["home", "review", "stats", "search", "quiz"]);
export function route() {
  hideAllPreviews(); closeOverlays(); closeResults();
  document.body.classList.remove("rail-open");
  const r = parseRoute(); S.route = r;
  const view = VIEWS[r.name] || VIEWS.home;
  markNav(r);
  const main = $("#main"), html = view.html ? view.html(r) : "";
  main.innerHTML = r.name === "map" ? html : `<div class="page${WIDE.has(r.name) ? " wide" : ""}">${html}</div>`;
  view.mount?.(r, main);
  mountFigures(main);
  if (!r.q.get("keep")) window.scrollTo(0, 0);
}

// ---------- shared bits
export function topicStats(t) {
  const ids = t.nodeIds; if (!ids.length) return { m: 0, checked: 0, total: 0 };
  const m = ids.reduce((s, id) => s + mastery(id), 0) / ids.length;
  const checked = ids.filter(id => S.G.nodes[id].review?.status === "checked").length;
  return { m, checked, total: ids.length };
}
export function typeBar(ids) {
  const c = {}; ids.forEach(i => { const ty = S.G.nodes[i].type; c[ty] = (c[ty] || 0) + 1; });
  return `<div class="bar" aria-hidden="true">${S.G.cfg.types.filter(t => c[t.id]).map(t => `<span style="flex:${c[t.id]};background:${t.color}"></span>`).join("")}</div>`;
}
export function readyNext(limit = 6) {
  const G = S.G, out = [];
  const ids = Object.keys(G.nodes).sort((a, b) => (G.topicById[G.nodes[a].topic].order - G.topicById[G.nodes[b].topic].order) || G.rank(a) - G.rank(b) || G.nodes[a].seq - G.nodes[b].seq);
  for (const id of ids) { if (G.typeOf(id)?.reference) continue; if (mastery(id) >= 0.7) continue; if (SG.readiness(G, S.P, id).ready) out.push(id); if (out.length >= limit) break; }
  return out;
}
// a reference row: hovering it shows the item's statement, wherever it lives
export function ref(id, note = "") {
  const G = S.G;
  if (G.nodes[id] || G.apps[id]) return `<a class="ref" href="${itemHref(id)}" data-pv="${esc(id)}">${chip(id)}<span class="t">${tt(id)}</span>${note ? `<span class="note">${note}</span>` : ""}</a>`;
  if (G.reserved[id]) return `<div class="ref pending" title="Planned for a topic that is not written yet"><span class="chip plain">Planned</span><span class="t">${rich(G.reserved[id].title || id, { inline: true })}</span></div>`;
  return "";
}
export const plink = id => ref(id);
export const listify = v => Array.isArray(v) ? `<ul class="prose">${v.map(x => `<li>${rich(x, { inline: true })}</li>`).join("")}</ul>` : `<div class="prose">${rich(v)}</div>`;
export const has = v => Array.isArray(v) ? v.length : !!v;

// ---------- home
VIEWS.home = {
  html() {
    const G = S.G, cfg = G.cfg, due = dueCount(), next = readyNext(4), last = S.P.last && (G.nodes[S.P.last.id] || G.apps[S.P.last.id]) ? S.P.last : null;
    const nodes = Object.values(G.nodes);
    const defs = nodes.filter(n => G.cfg.typeById[n.type]?.needsTerms).length, res = nodes.filter(n => G.cfg.typeById[n.type]?.needsProof).length;
    const groups = cfg.courses.length ? cfg.courses.map(c => ({ c, ts: G.topics.filter(t => t.course === c.id) })) : [{ c: { id: "", title: "Topics" }, ts: G.topics }];
    const used = G.cfg.types.filter(t => nodes.some(n => n.type === t.id));
    return h`${cfg.app.kicker ? `<div class="eyebrow">${esc(cfg.app.kicker)}</div>` : ""}
      <h1>${esc(cfg.app.title)}</h1>${cfg.app.tagline ? `<p class="lead">${esc(cfg.app.tagline)}</p>` : ""}
      <div class="stats"><div><b>${nodes.length}</b>items</div>${defs ? `<div><b>${defs}</b>definitions</div>` : ""}${res ? `<div><b>${res}</b>results with proofs</div>` : ""}${Object.keys(G.apps).length ? `<div><b>${Object.keys(G.apps).length}</b>applications</div>` : ""}<div><b>${Object.keys(G.quiz).length}</b>quiz questions</div><div><b>${due}</b>cards due</div></div>
      <div class="row" style="margin:8px 0 4px">
        ${last ? `<a class="iconbtn" href="${itemHref(last.id)}" data-pv="${esc(last.id)}">Continue: ${tt(last.id)}</a>` : ""}
        <a class="iconbtn ${due ? "hot" : ""}" href="#/quiz">${due ? `Review ${due} due card${due > 1 ? "s" : ""}` : "Start a quiz"}</a>
        <a class="iconbtn" href="#/map">Open the concept map</a></div>
      ${next.length ? `<div class="card nextcard"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Ready to learn next</h3><span class="muted small">You know every prerequisite of these.</span></div><div class="nextgrid">${next.map(id => ref(id)).join("")}</div></div>` : ""}
      ${groups.filter(g => g.ts.length).map(g => `<h2>${esc(g.c.title)}</h2><div class="topics-grid">${g.ts.map(t => { const st = topicStats(t); return `<a class="card tcard" href="#/t/${encodeURIComponent(t.id)}">
        <span class="n">${pad2(t.order)} · ${t.nodeIds.length} items</span><span class="tt">${esc(t.title)}</span><span class="s">${esc(plain(t.summary || ""))}</span>${typeBar(t.nodeIds)}
        <span class="tm"><span class="mbar"><i style="width:${Math.round(st.m * 100)}%"></i></span>${Math.round(st.m * 100)}% mastered · ${st.checked}/${st.total} checked</span></a>`; }).join("")}</div>`).join("")}
      <div class="legend">${used.map(t => typeChip(t)).join("")}${Object.keys(G.apps).length ? `<span class="chip cd" style="color:${SG.APP_COLOR}">Application</span>` : ""}</div>
      ${cfg.app.copyright ? `<p class="muted small">${esc(cfg.app.copyright)}</p>` : ""}${S.allowOpen ? `<p class="muted small">${S.isDemo ? (S.bootCourse.embedded ? "" : "This is the sample course.") : "Course opened from your files."} <button class="linkbtn" id="openCourse">Open a course file</button>${S.isDemo ? "" : ` · <button class="linkbtn" id="useDemo">${S.bootCourse.embedded ? "Back to the course of this page" : "Use the sample course"}</button>`}</p>` : ""}
      <p class="faint small">Studygraph ${esc(S.boot.engine || "")}</p>`;
  },
  mount() { const o = $("#openCourse"); if (o) o.onclick = pickCourseFiles; const d = $("#useDemo"); if (d) d.onclick = useDemo; },
};

// ---------- topic
VIEWS.t = {
  html(r) {
    const G = S.G, t = G.topicById[r.arg]; if (!t) return notFound();
    const course = G.cfg.courses.find(c => c.id === t.course), qn = t.quizIds.length;
    return h`<div class="eyebrow"><span>${esc(course?.title || "Topic")} · Lecture ${esc(t.order)}</span>${(t.sourceFiles || []).length ? `<span>${esc(t.sourceFiles.join(", "))}</span>` : ""}</div>
      <h1>${esc(t.title)}</h1>${t.summary ? `<div class="lead prose">${rich(t.summary)}</div>` : ""}
      <div class="row topic-actions">${qn ? `<a class="iconbtn" href="#/quiz/${encodeURIComponent(t.id)}">Quiz (${qn} questions)</a>` : ""}<a class="iconbtn" href="#/map?lec=${encodeURIComponent(t.id)}&ext=1">Map of this topic</a></div>
      ${(t.prerequisites || []).length ? `<h3>Builds on the topics</h3><div class="row">${t.prerequisites.filter(p => G.topicById[p]).map(p => `<a class="iconbtn" href="#/t/${encodeURIComponent(p)}">${esc(G.topicById[p].title)}</a>`).join("")}</div>` : ""}
      ${t.overview ? `<h2>Overview</h2><div class="prose">${rich(t.overview)}</div>` : ""}
      ${(t.keyQuestions || []).length ? `<h3>Key questions</h3><ul class="prose">${t.keyQuestions.map(q => `<li>${rich(q, { inline: true })}</li>`).join("")}</ul>` : ""}
      <h2>Contents</h2><div class="nodelist">${t.nodeIds.map(id => { const n = G.nodes[id]; const intu = n.explanation?.intuition; return `<a class="nrow" href="${itemHref(id)}" data-pv="${esc(id)}"><span>${chip(id)}</span><span><span class="t">${tt(id)}</span>${n.attribution ? ` <span class="muted">(${esc(n.attribution)})</span>` : ""}${intu ? `<div class="i">${rich(Array.isArray(intu) ? intu[0] : intu, { inline: true, nolinks: true })}</div>` : ""}</span></a>`; }).join("")}</div>
      ${(t.alsoCovers || []).length ? `<h3>Also restated in this lecture</h3><div class="reflist">${t.alsoCovers.map(x => ref(x)).join("")}</div>` : ""}
      ${t.figureIds.length ? `<h2>Figures</h2>${t.figureIds.map(figureHTML).join("")}` : ""}
      ${t.appIds.length ? `<h2>In practice</h2><div class="reflist">${t.appIds.map(a => ref(a)).join("")}</div>` : ""}`;
  },
};

// ---------- item page
export function readinessLine(id) {
  const rd = SG.readiness(S.G, S.P, id); if (!rd.total) return "";
  if (rd.ready) return `<p class="ready"><span class="dot" style="background:var(--ok)"></span><span>You know all ${rd.total} prerequisite${rd.total > 1 ? "s" : ""}.</span></p>`;
  return `<p class="ready"><span class="dot" style="background:var(--accent)"></span><span>You know ${rd.known} of ${rd.total} prerequisites. Review ${rd.missing.slice(0, 3).map(m => `<a class="xl" data-pv="${esc(m)}" href="${itemHref(m)}" style="--tc:${colorOf(m)}">${tt(m)}</a>`).join(", ")}${rd.missing.length > 3 ? ` and ${rd.missing.length - 3} more` : ""} first.</span></p>`;
}
export function relatedGroups(id) {
  const G = S.G, n = G.nodes[id], groups = new Map();
  const add = (label, strength, target, note) => { if (!G.nodes[target] && !G.reserved[target]) return; if (!groups.has(label)) groups.set(label, { strength, items: [] }); const g = groups.get(label); if (!g.items.some(x => x.id === target)) g.items.push({ id: target, note }); };
  for (const r of n.relations || []) { const R = G.cfg.relations[r.type] || { label: r.type, strength: 1 }; add(R.label, r.type === "see-also" ? 0 : R.strength, r.target, r.note); }
  for (const r of G.relatedFrom[id] || []) { const R = G.cfg.relations[r.type] || { inverseLabel: r.type, strength: 1 }; add(R.inverseLabel, r.type === "see-also" ? 0 : R.strength, r.source, r.note); }
  return [...groups.entries()].sort((a, b) => b[1].strength - a[1].strength);
}
VIEWS.n = {
  html(r) {
    const G = S.G, id = r.arg, n = G.nodes[id];
    if (!n) return G.reserved[id] ? `<div class="eyebrow">Planned</div><h1>${rich(G.reserved[id].title || id, { inline: true })}</h1><p class="lead">This item belongs to a topic that has not been written yet.</p>` : notFound();
    const T = typeOf(id), t = G.topicById[n.topic], ex = n.explanation || {};
    const pr = n.proof, steps = pr?.steps || [];
    const usedBy = G.usedBy[id] || [], rel = relatedGroups(id), apps = G.appsFor[id] || [], qz = G.quizFor[id] || [], figs = G.figuresFor[id] || [];
    const notes = n.review?.notes || [], path = G.learningPath(id);
    const src = (n.source || []).map(s => `${esc(s.file)}${s.page != null ? `, page ${esc(s.page)}` : s.slide != null ? `, slide ${esc(s.slide)}` : ""}`).join("; ");
    const idx = t.nodeIds.indexOf(id), prev = t.nodeIds[idx - 1], next = t.nodeIds[idx + 1];
    const m = Math.round(mastery(id) * 100);
    return h`<div class="eyebrow"><a href="#/t/${encodeURIComponent(t.id)}">${esc(t.title)}</a><span>${esc(id)}</span></div>
      <div class="row" style="margin-top:12px">${chip(id)}<span class="origin">${esc(ORIGIN[n.origin] || n.origin || "")}</span>${reviewBadge(n)}</div>
      <h1>${tt(id)}</h1>${n.attribution ? `<div class="muted attrib">${esc(n.attribution)}</div>` : ""}
      ${(n.terms || []).length ? `<div class="terms">${n.terms.map(x => `<b>${rich(x.term, { inline: true })}</b>${x.alt ? ` [${rich(x.alt, { inline: true })}]` : ""}${x.symbol ? " " + renderMath(x.symbol, false) : ""}`).join(" · ")}</div>` : ""}
      <div class="statement prose" style="--tc:${T.color}">${rich(n.statement)}</div>
      ${readinessLine(id)}
      ${has(ex.intuition) ? `<div class="intuition prose">${Array.isArray(ex.intuition) ? ex.intuition.map(x => rich(x)).join("") : rich(ex.intuition)}</div>` : ""}
      ${has(ex.detailed) ? `<h2>In detail</h2>${listify(ex.detailed)}` : ""}
      ${has(ex.pitfalls) ? `<h2>Pitfalls</h2><div class="pitfalls">${listify(ex.pitfalls)}</div>` : ""}
      ${has(ex.examples) ? `<h2>Examples</h2>${listify(ex.examples)}` : ""}
      ${n.explanation ? `<p class="aimark">Explanations are written by AI from the course material; the statement is the source of truth.</p>` : ""}
      ${pr ? `<h2>${esc(G.cfg.proofLabel)} <span class="origin">${pr.status === "sketch" ? "sketch" : pr.status === "none" ? "not given" : "full"} · ${esc(ORIGIN[pr.origin] || pr.origin || "")}</span></h2>
        ${pr.strategy ? `<p class="prose"><i>Strategy:</i> ${rich(pr.strategy, { inline: true })}</p>` : ""}
        ${steps.length ? `<div class="row"><button class="iconbtn" id="stepNext">Show step 1</button><button class="linkbtn" id="stepAll">Show all steps</button><button class="linkbtn" id="stepTry" aria-pressed="false" title="Each next step stays blurred until you reveal it">Try the next step yourself</button></div><ol class="steps" id="steps"></ol>` : ""}
        ${pr.idea ? `<div class="card prose"><b class="cardh">Idea</b>${rich(pr.idea)}</div>` : ""}` : ""}
      ${figs.length ? `<h2>Figures</h2>${figs.map(figureHTML).join("")}` : ""}
      <div class="cols">
        ${(n.uses || []).some(u => G.nodes[u] || G.apps[u] || G.reserved[u]) ? `<div><h3>Builds on</h3><div class="reflist">${n.uses.map(u => ref(u)).join("")}</div></div>` : ""}
        ${usedBy.length ? `<div><h3>Used in</h3><div class="reflist">${usedBy.map(u => ref(u, S.G.nodes[u].topic !== n.topic ? esc(G.topicById[S.G.nodes[u].topic].title) : "")).join("")}</div></div>` : ""}
        ${rel.length ? `<div><h3>Related</h3><div class="reflist">${rel.flatMap(([label, g]) => g.items.map(x => ref(x.id, esc(label.toLowerCase()) + (x.note ? " – " + esc(x.note) : "")))).join("")}</div></div>` : ""}
      </div>
      ${apps.length ? `<h2>Where it is used in practice</h2><div class="reflist">${apps.map(a => ref(a)).join("")}</div>` : ""}
      <h2>Study it</h2>
      <div class="row"><button class="iconbtn" id="aKnow">I understand this</button><button class="iconbtn" id="aUnsure">Not sure yet</button>${qz.length ? `<button class="iconbtn" id="qThis">Practise ${qz.length} question${qz.length > 1 ? "s" : ""}</button>` : ""}
        <span class="muted small">Mastery <span class="mbar"><i id="mfill" style="width:${m}%"></i></span> <span id="mtext">${m}%</span></span></div>
      <h2>Learn with AI</h2><p class="muted small">The tutor sees this item, its prerequisites and related items, and answers from them. Copy for AI gives you the same material to paste into any chat.</p>
      <div class="row"><button class="iconbtn" id="aTutor">Ask the tutor</button><button class="iconbtn" id="aCopy">Copy for AI</button><a class="iconbtn" href="#/map?node=${encodeURIComponent(id)}&r=1">Open in map</a></div>
      ${path.length ? `<h2>Learning path</h2><p class="muted small">${path.length} item${path.length > 1 ? "s" : ""} to understand first, in order. <a href="#/path/${encodeURIComponent(id)}">Study this path</a></p><ol class="reflist pathlist">${path.map(p => `<li>${ref(p)}</li>`).join("")}</ol>` : ""}
      ${src ? `<p class="muted small" style="margin-top:28px">Source: ${src}</p>` : ""}
      ${notes.length ? `<details class="notes muted small"><summary>Reliability notes (${notes.length})</summary><ul>${notes.map(x => `<li>${rich(typeof x === "string" ? x : x.text || JSON.stringify(x), { inline: true })}</li>`).join("")}</ul></details>` : ""}
      <div class="pager">${prev ? `<a href="${itemHref(prev)}" data-pv="${esc(prev)}">← ${tt(prev)}</a>` : "<span></span>"}${next ? `<a href="${itemHref(next)}" data-pv="${esc(next)}">${tt(next)} →</a>` : ""}</div>`;
  },
  mount(r, root) {
    const G = S.G, id = r.arg, n = G.nodes[id]; if (!n) return;
    S.P.last = { id, at: Date.now() }; saveProgress(false);
    const ex = n.explanation || {};
    const steps = n.proof?.steps || [];
    if (steps.length) {
      let shown = 0, tryMode = false; const ol = $("#steps");
      const stepHTML = (s, i, hidden) => `<li class="step ${hidden ? "hidden-step" : "appear"}" data-i="${i}"><div class="prose">${rich(s.text)}</div>
        ${hidden ? `<div class="sx"><button class="iconbtn" data-reveal="${i}">Reveal this step</button><span class="small faint">Work it out first, then reveal.</span></div>` : `<div class="sx">
          ${s.why ? `<button class="linkbtn" data-why="${i}" aria-expanded="false">Why?</button>` : ""}
          ${(s.uses || []).map(u => G.nodes[u] ? `<a class="chip tc" href="${itemHref(u)}" data-pv="${esc(u)}" style="--tc:${colorOf(u)};text-decoration:none">${tt(u)}</a>` : "").join("")}
          <button class="linkbtn" data-explain="${i}">Explain differently</button></div>`}</li>`;
      const draw = () => {
        ol.innerHTML = steps.slice(0, shown).map((s, i) => stepHTML(s, i, false)).join("") + (tryMode && shown < steps.length ? stepHTML(steps[shown], shown, true) : "");
        $("#stepNext").textContent = shown >= steps.length ? "All steps shown" : `Show step ${shown + 1}`; $("#stepNext").disabled = shown >= steps.length;
        $("#stepAll").disabled = shown >= steps.length;
      };
      $("#stepNext").onclick = () => { shown = Math.min(steps.length, shown + 1); draw(); };
      $("#stepAll").onclick = () => { shown = steps.length; draw(); };
      $("#stepTry").onclick = e => { tryMode = !tryMode; e.currentTarget.setAttribute("aria-pressed", tryMode); draw(); };
      ol.addEventListener("click", e => {
        const w = (e.target as HTMLElement).closest("[data-why]"), rv = (e.target as HTMLElement).closest("[data-reveal]"), xp = (e.target as HTMLElement).closest("[data-explain]");
        if (w) { const li = w.closest(".step"), open = $(".why", li); if (open) { open.remove(); w.setAttribute("aria-expanded", "false"); } else { li.insertAdjacentHTML("beforeend", `<div class="why prose"><b>Why does this hold?</b>${rich(steps[+w.dataset.why].why)}</div>`); w.setAttribute("aria-expanded", "true"); } }
        if (rv) { shown = +rv.dataset.reveal + 1; draw(); }
        if (xp) { const s = steps[+xp.dataset.explain]; openTutor(id, `Explain step ${+xp.dataset.explain + 1} of the proof differently, in simpler terms. The step is: "${s.text}"${s.why ? ` Its justification: "${s.why}"` : ""}`); }
      });
      draw();
    }
    $("#aCopy").onclick = async () => toast(await copyText(tutorBundle(id)) ? "Copied. Paste it into any AI chat with your question." : "Copy failed. Select the text manually from the statement.");
    $("#aTutor").onclick = () => openTutor(id);
    const grade = g => { const k = "n:" + id; S.P.cards[k] = SG.FSRS.review(S.P.cards[k], g); saveProgress(); shell(); markNav(S.route);
      $("#mtext").textContent = Math.round(mastery(id) * 100) + "%"; $("#mfill").style.width = Math.round(mastery(id) * 100) + "%";
      toast(g >= 3 ? `Marked as understood. It comes back for review in ${fmtDays(S.P.cards[k].due - Date.now())}.` : "Noted. It will come back in today's review."); };
    $("#aKnow").onclick = () => grade(3); $("#aUnsure").onclick = () => grade(1);
    const q = $("#qThis"); if (q) q.onclick = () => startSession("node", { node: id });
  },
};
export function notFound() { return `<h1>Not found</h1><p class="lead">This link points to an item that is not in the course. <a href="#/">Back to the course</a>.</p>`; }

// ---------- application page
VIEWS.app = {
  html(r) {
    const G = S.G, a = G.apps[r.arg]; if (!a) return notFound(); const t = G.topicById[a.topic];
    return h`<div class="eyebrow"><a href="#/t/${encodeURIComponent(t.id)}">${esc(t.title)}</a><span>${esc(a.id)}</span></div>
      <div class="row" style="margin-top:12px"><span class="chip cd" style="color:${SG.APP_COLOR}">Application</span></div><h1>${esc(a.title)}</h1>${a.summary ? `<p class="lead">${rich(a.summary, { inline: true })}</p>` : ""}
      ${[["scenario", "Scenario"], ["modelling", "Modelling"], ["solution", "Solution"]].filter(([k]) => a[k]).map(([k, l]) => `<section class="app-sec"><h2>${l}</h2><div class="prose">${rich(a[k])}</div></section>`).join("")}
      ${(a.figures || []).map(figureHTML).join("")}
      <h2>Connects</h2><div class="reflist">${(a.connects || []).map(c => ref(c)).join("")}</div>`;
  },
  mount(r) { if (S.G.apps[r.arg]) { S.P.last = { id: r.arg, at: Date.now() }; saveProgress(false); } },
};

// ---------- learning path
VIEWS.path = {
  html(r) {
    const G = S.G, id = r.arg; if (!G.nodes[id]) return notFound();
    const path = G.learningPath(id);
    S.P.lastPath = id; saveProgress(false);
    const un = path.filter(p => mastery(p) < 0.7).length;
    return h`<div class="eyebrow"><a href="${itemHref(id)}">${tt(id)}</a><span>Learning path</span></div>
      <h1>Learning path to ${tt(id)}</h1>
      <p class="lead">${path.length ? `Everything ${tt(id)} builds on, in an order where each item only needs the ones above it. ${un ? `${un} of ${path.length} are not mastered yet.` : "You have mastered all of them."}` : "This item has no prerequisites."}</p>
      <div class="row" style="margin:22px 0"><button class="btn primary" id="studyPath" ${path.length ? "" : "disabled"}>Study this path</button><a class="btn" href="#/map?node=${encodeURIComponent(id)}&r=2">See it on the map</a></div>
      <ol class="ilist" style="padding:0">${[...path, id].map((p, i) => { const m = mastery(p); return `<li><a href="${itemHref(p)}"><span class="mono faint" style="width:2.2em">${i + 1}</span>${chip(p)}<span class="t">${tt(p)}${p === id ? ' <span class="small faint">goal</span>' : ""}</span>${mbar(p)}<span class="small ${m >= .7 ? "" : "faint"}" style="width:6em;text-align:right">${m >= .7 ? "Mastered" : m > 0 ? "Learning" : "Not started"}</span></a></li>`; }).join("")}</ol>`;
  },
  mount(r) { const b = $("#studyPath"); if (b) b.onclick = () => startSession("path", { node: r.arg }); },
};

// ---------- search (palette + full page)
export function resultRow(x, q, i) {
  const G = S.G, n = G.nodes[x.id] || G.apps[x.id]; const t = G.topicById[n.topic];
  const txt = plain(n.statement || n.summary || ""); const toks = SG.tokenize(q);
  let snip = txt.slice(0, 180); const nt = SG.normalize(txt);
  for (const tok of toks) { const k = nt.indexOf(tok); if (k > 60) { snip = "…" + txt.slice(k - 50, k + 130); break; } }
  let shtml = esc(snip); for (const tok of toks) { if (tok.length < 2) continue; const re = new RegExp(`(${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"); const ns = SG.normalize(snip); let out = "", last = 0, m; const re2 = new RegExp(re.source, "g"); while ((m = re2.exec(ns))) { out += esc(snip.slice(last, m.index)) + "<mark>" + esc(snip.slice(m.index, m.index + m[0].length)) + "</mark>"; last = m.index + m[0].length; } shtml = out + esc(snip.slice(last)); break; }
  return `<li><a href="${itemHref(x.id)}" data-i="${i}" data-pv="${esc(x.id)}"><span class="l1">${chip(x.id)}<span class="t">${tt(n.id)}</span><span class="small faint">${esc(t?.title || "")}</span></span><span class="snip">${shtml}</span></a></li>`;
}
// inline search in the top bar (Ctrl+K or / focuses it)
export let SR = { sel: 0, res: [] };
export function closeResults() { const r = $("#results"); if (r) r.hidden = true; }
export function closeOverlays() { $$(".scrim").forEach(x => x.remove()); }
export function openPalette() { const q = $("#q"); q.focus(); q.select(); if (q.value) drawResults(); }
export function drawResults() {
  const q = $("#q").value, box = $("#results");
  if (!q.trim()) { box.hidden = true; return; }
  SR.res = SG.search(S.G, q).slice(0, 10); SR.sel = 0;
  box.innerHTML = SR.res.length ? `<ul class="sres">${SR.res.map((x, i) => resultRow(x, q, i)).join("")}</ul><a class="allres" href="#/search?q=${encodeURIComponent(q)}">All results and filters</a>` : `<p class="muted small" style="padding:12px 14px;margin:0">No matches. Try a shorter word; accents are optional.</p>`;
  box.hidden = false; markSel();
}
export const markSel = () => $$("#results .sres a").forEach((a, i) => a.setAttribute("aria-selected", i === SR.sel));
export function wireSearch() {
  const q = $("#q");
  q.oninput = drawResults; q.onfocus = () => q.value && drawResults();
  q.onkeydown = e => {
    if (e.key === "ArrowDown") { SR.sel = Math.min(SR.res.length - 1, SR.sel + 1); markSel(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { SR.sel = Math.max(0, SR.sel - 1); markSel(); e.preventDefault(); }
    else if (e.key === "Enter") { if (e.shiftKey || !SR.res.length) location.hash = "#/search?q=" + encodeURIComponent(q.value); else location.hash = itemHref(SR.res[SR.sel].id); q.blur(); closeResults(); }
    else if (e.key === "Escape") { closeResults(); q.blur(); }
  };
  document.addEventListener("click", e => { if (!(e.target as HTMLElement).closest(".search")) closeResults(); });
  $("#menuBtn").onclick = () => document.body.classList.toggle("rail-open");
  $("#scrim").onclick = () => document.body.classList.remove("rail-open");
  $("#backBtn").onclick = () => history.length > 1 ? history.back() : (location.hash = "#/");
}
// ---------- applications list
VIEWS.apps = {
  html() {
    const G = S.G;
    return h`<div class="eyebrow">Tools</div><h1>Applications</h1><p class="lead">Where the course material is used outside the lecture.</p>
      ${G.topics.filter(t => t.appIds.length).map(t => `<h2>${esc(t.title)}</h2><div class="reflist">${t.appIds.map(a => ref(a, `<span class="desc">${rich(G.apps[a].summary || "", { inline: true, nolinks: true })}</span>`)).join("")}</div>`).join("") || `<p class="muted">This course has no applications yet.</p>`}`;
  },
};
VIEWS.search = {
  html(r) {
    const G = S.G, q = r.q.get("q") || "";
    const opt = (name, items, cur) => `<label class="lab">${name}<select class="field" data-f="${name.toLowerCase()}"><option value="">All</option>${items.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
    return h`<div><h1>Search</h1>
      <div class="filters"><label class="lab" style="flex:1;min-width:220px">Words<input class="field" id="sq" type="search" value="${esc(q)}" placeholder="for example bijekcia, cantor, power set"></label>
      ${opt("Type", [...G.cfg.types.filter(t => Object.values(G.nodes).some(n => n.type === t.id)).map(t => [t.id, t.label]), ["application", "Application"]], r.q.get("type"))}
      ${opt("Topic", G.topics.map(t => [t.id, t.title]), r.q.get("topic"))}
      ${G.cfg.courses.length > 1 ? opt("Course", G.cfg.courses.map(c => [c.id, c.title]), r.q.get("course")) : ""}
      ${opt("Status", [["draft", "Draft"], ["checked", "Checked"], ["flagged", "Flagged"]], r.q.get("status"))}</div>
      <p class="small muted" id="scount"></p><ul class="sres" id="sres"></ul></div>`;
  },
  mount(r) {
    const run = () => {
      const f = Object.fromEntries($$("[data-f]").map(s => [s.dataset.f, s.value]).filter(([, v]) => v));
      const q = $("#sq").value; const res = SG.search(S.G, q, f);
      $("#scount").textContent = q.trim() ? `${res.length} result${res.length === 1 ? "" : "s"}` : "";
      $("#sres").innerHTML = res.map((x, i) => resultRow(x, q, i)).join("") || (q.trim() ? `<li class="empty">No matches for these words and filters.</li>` : "");
      history.replaceState(null, "", "#/search?" + new URLSearchParams({ q, ...f }).toString());
    };
    $("#sq").oninput = run; $$("[data-f]").forEach(s => s.onchange = run); run(); $("#sq").focus();
  },
};
