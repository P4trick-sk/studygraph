import * as SG from "../core/index.js";
import { UI_LANG } from "./i18n.js";
import { $, $$, ORIGIN, S, UI, VIEWS, blankProgress, chip, colorOf, copyText, esc, fmtDays, h, itemHref, mastery, mathless, reviewBadge, rich, saveProgress, shuffle, titleOf, toast, tt } from "./base.js";
import { mountFigures } from "./figures.js";
import { closeOverlays, dueCount, markNav, readyNext, route, shell, topicStats } from "./pages.js";
import { disableSync, enableSync } from "./tutor.js";
import { boot, pickCourseFiles, useDemo } from "./main.js";
/* Studygraph viewer — part 3: quizzes, review mode, stats, concept map, tutor, boot */
export const SESSION_SIZE = 20;

export const anyHref = id => S.G.quiz[id] ? `#/t/${encodeURIComponent(S.G.quiz[id].topic)}` : S.G.figures[id] ? `#/t/${encodeURIComponent(S.G.figures[id].topic)}` : itemHref(id);
// ---------- quiz sessions
export function nodeCard(id, isNew = false) { return { type: "node", id, isNew }; }
export function quizCard(id) { return { type: "quiz", id }; }
export function buildQueue(kind: string, opt: any = {}) {
  const G = S.G, P = S.P, now = Date.now(); let q = [];
  const quizOf = ids => [...new Set(ids.flatMap(i => G.quizFor[i] || []))];
  if (kind === "due") {
    q = Object.entries(P.cards).filter(([, c]) => c.due <= now).sort((a, b) => a[1].due - b[1].due)
      .map(([k]) => k.startsWith("n:") ? nodeCard(k.slice(2)) : quizCard(k.slice(2))).filter(c => (c.type === "node" ? G.nodes : G.quiz)[c.id]);
    if (q.length < 8) for (const id of readyNext(30)) { if (P.cards["n:" + id]) continue; q.push(nodeCard(id, true)); if (q.length >= 8) break; }
  } else if (kind === "topic") {
    const t = G.topicById[opt.topic];
    const qs = shuffle(t.quizIds).map(quizCard);
    const ns = [...t.nodeIds].sort((a, b) => mastery(a) - mastery(b)).slice(0, Math.max(4, SESSION_SIZE - qs.length)).map(i => nodeCard(i, !P.cards["n:" + i]));
    q = shuffle([...qs, ...ns]);
  } else if (kind === "weak") {
    let ids = Object.keys(G.nodes).filter(i => P.cards["n:" + i] || P.answers[i]);
    if (ids.length < 5) ids = Object.keys(G.nodes);
    ids = ids.sort((a, b) => mastery(a) - mastery(b)).slice(0, 10);
    q = shuffle([...ids.map(i => nodeCard(i, !P.cards["n:" + i])), ...ids.map(i => (G.quizFor[i] || [])[0]).filter(Boolean).map(quizCard)]);
  } else if (kind === "path") {
    const ids = [...G.learningPath(opt.node), opt.node].filter(i => mastery(i) < 0.7);
    q = [...ids.map(i => nodeCard(i, !P.cards["n:" + i])), ...quizOf(ids).map(quizCard)];
  } else if (kind === "node") {
    q = [...(G.quizFor[opt.node] || []).map(quizCard), nodeCard(opt.node, !P.cards["n:" + opt.node])];
  }
  const seen = new Set(); q = q.filter(c => { const k = c.type + c.id; if (seen.has(k)) return false; seen.add(k); return true; });
  return q.slice(0, SESSION_SIZE);
}
export function startSession(kind: string, opt: any = {}) {
  const queue = buildQueue(kind, opt);
  if (!queue.length) return toast(kind === "due" ? "Nothing is due. Open an item and mark it, or start a topic quiz." : "No questions for this selection yet.");
  const title = kind === "topic" ? `Quiz: ${S.G.topicById[opt.topic].title}` : kind === "path" ? `Path to ${mathless(titleOf(opt.node))}` : kind === "node" ? `Practise: ${mathless(titleOf(opt.node))}` : UI.sessionTitle[kind];
  S.session = { kind, opt, title, queue, i: 0, right: 0, wrong: 0, again: new Set(), done: 0 };
  location.hash = "#/quiz?run=" + Date.now();
}
export function gradeCard(c, g) {
  const key = (c.type === "node" ? "n:" : "q:") + c.id;
  S.P.cards[key] = SG.FSRS.review(S.P.cards[key], g);
  if (c.type === "quiz") for (const a of S.G.quiz[c.id].about || []) { const t = S.P.answers[a] || (S.P.answers[a] = { r: 0, w: 0 }); g >= 3 ? t.r++ : t.w++; }
  const s = S.session; g >= 3 ? s.right++ : s.wrong++;
  if (g === 1 && !s.again.has(key)) { s.again.add(key); s.queue.push(c); }
  saveProgress();
}
VIEWS.quiz = {
  html(r) {
    const G = S.G;
    if (r.q.get("run") && S.session) return `<div class="qwrap" id="qrun"></div>`;
    if (r.arg && G.topicById[r.arg]) { setTimeout(() => startSession("topic", { topic: r.arg })); return `<p class="loadnote">Starting the topic quiz…</p>`; }
    const due = dueCount(), lp = S.P.lastPath && G.nodes[S.P.lastPath] ? S.P.lastPath : null;
    return h`<div class="read" style="max-width:900px"><h1>Quiz</h1>
      <p class="lead">Answers schedule each card with spaced repetition, so reviews come back just before you would forget them. Every item is also a flashcard: its title on the front, its statement on the back.</p>
      <div class="sessions">
        <button class="sess" data-s="due"><span class="n">${due}</span><b>Due today</b><span class="small muted">${due ? "Cards scheduled for now, plus a few new ones you are ready for." : "Nothing due. This starts with new cards you are ready for."}</span></button>
        <button class="sess" data-s="weak"><span class="n">10</span><b>Weak spots</b><span class="small muted">The items with the lowest mastery, with a question each.</span></button>
        <button class="sess" data-s="path" ${lp ? "" : "disabled"}><span class="n">${lp ? G.learningPath(lp).length + 1 : "–"}</span><b>Path quiz</b><span class="small muted">${lp ? `Unmastered items on the way to ${tt(lp)}.` : "Open a learning path from any item first."}</span></button>
      </div>
      <h2>Topic quizzes</h2><ul class="ilist">${G.topics.map(t => `<li><a href="#/quiz/${encodeURIComponent(t.id)}"><span class="t">${esc(t.title)}</span><span class="small faint">${t.quizIds.length} questions, ${t.nodeIds.length} cards</span></a></li>`).join("")}</ul></div>`;
  },
  mount(r) {
    $$("[data-s]").forEach(b => b.onclick = () => startSession(b.dataset.s, { node: S.P.lastPath }));
    if (r.q.get("run") && S.session) drawCard();
  },
};
export function drawCard() {
  const s = S.session, G = S.G, root = $("#qrun"); if (!root) return;
  if (s.i >= s.queue.length) return drawSummary();
  const c = s.queue[s.i], total = s.queue.length;
  const head = `<div class="row" style="justify-content:space-between"><b>${esc(s.title)}</b><span class="small faint">${s.i + 1} of ${total}</span></div><div class="qprog"><i style="width:${s.i / total * 100}%"></i></div>`;
  let body = "", aboutIds = [];
  if (c.type === "node") {
    const n = G.nodes[c.id]; aboutIds = [c.id];
    body = `<div class="row">${chip(c.id)}${c.isNew ? '<span class="origin">new</span>' : ""}<span class="small faint">${esc(G.topicById[n.topic].title)}</span></div>
      <div class="front" style="margin-top:14px"><div style="font-weight:600">${rich(n.title, { inline: true })}</div>${(n.terms || []).length ? `<div class="small muted" style="margin-top:4px">${n.terms.map(t => esc(t.term) + (t.alt ? ` (${esc(t.alt)})` : "")).join(", ")}</div>` : ""}
      <p class="small muted" style="margin-top:12px;font-family:var(--sans)">Recall the statement, then reveal it.</p></div>
      <div id="qback"></div><div class="row" style="margin-top:18px" id="qact"><button class="btn primary" id="reveal">Show the statement</button></div>`;
  } else {
    const q = G.quiz[c.id]; aboutIds = q.about || [];
    const k = q.kind;
    body = `<div class="row"><span class="origin">${{ mcq: "Multiple choice", truefalse: "True or false", flashcard: "Flashcard", open: "Open question" }[k] || k}</span><span class="small faint">${esc(G.topicById[q.topic].title)}</span></div>
      <div class="front prose" style="margin-top:14px">${rich(q.prompt)}</div>
      ${k === "mcq" ? `<div class="opts">${(q.options || []).map((o, i) => `<button class="opt" data-o="${i}">${rich(String(o), { inline: true })}</button>`).join("")}</div>` : ""}
      ${k === "truefalse" ? `<div class="opts" style="grid-template-columns:1fr 1fr"><button class="opt" data-o="true">True</button><button class="opt" data-o="false">False</button></div>` : ""}
      <div id="qback"></div><div class="row" style="margin-top:18px" id="qact">${k === "flashcard" || k === "open" ? `<button class="btn primary" id="reveal">${k === "open" ? "Show a model answer" : "Show the answer"}</button>` : ""}</div>`;
  }
  root.innerHTML = head + `<div class="qcard">${body}</div>
    <div class="row small" style="margin-top:14px;justify-content:space-between"><span class="faint">About: ${aboutIds.filter(a => G.nodes[a]).map(a => `<a class="xl" data-pv="${esc(a)}" href="${itemHref(a)}" style="--tc:${colorOf(a)}">${tt(a)}</a>`).join(", ")}</span><button class="btn ghost small" id="qskip">Skip</button></div>`;
  $("#qskip").onclick = () => { s.i++; drawCard(); };
  const selfGrade = () => {
    const key = (c.type === "node" ? "n:" : "q:") + c.id, card = S.P.cards[key], now = Date.now();
    $("#qact").innerHTML = `<div class="grades" style="width:100%">${[[1, "Again"], [2, "Hard"], [3, "Good"], [4, "Easy"]].map(([g, l]) => `<button class="btn" data-g="${g}">${l}<small>${fmtDays(SG.FSRS.preview(card, g as any, now))}</small></button>`).join("")}</div>`;
    $$("[data-g]").forEach(b => b.onclick = () => { gradeCard(c, +b.dataset.g); s.i++; drawCard(); });
    $("[data-g='3']").focus();
  };
  const rv = $("#reveal");
  if (rv) rv.onclick = () => {
    const back = c.type === "node" ? G.nodes[c.id].statement : G.quiz[c.id].answer;
    const ex = c.type === "quiz" ? G.quiz[c.id].explanation : "";
    $("#qback").innerHTML = `<div class="back prose">${rich(String(back))}${ex ? `<p class="small muted" style="margin-top:10px">${rich(ex, { inline: true })}</p>` : ""}</div>`;
    selfGrade();
  };
  $$(".opt").forEach(b => b.onclick = () => {
    const q = G.quiz[c.id]; const pick = b.dataset.o; const ans = q.kind === "truefalse" ? String(!!q.answer) : String(q.answer);
    const ok = pick === ans;
    $$(".opt").forEach(o => { o.disabled = true; if (o.dataset.o === ans) o.classList.add("right"); });
    if (!ok) b.classList.add("wrong");
    $("#qback").innerHTML = `<p class="fb ${ok ? "ok" : "no"}">${ok ? "Correct." : "Not quite."}</p>${q.explanation ? `<div class="prose small">${rich(q.explanation)}</div>` : ""}`;
    gradeCard(c, ok ? 3 : 1);
    $("#qact").innerHTML = `<button class="btn primary" id="qnext">${s.i + 1 >= s.queue.length ? "Finish" : "Next question"}</button>`;
    $("#qnext").onclick = () => { s.i++; drawCard(); }; $("#qnext").focus();
  });
  mountFigures(root);
}
export function drawSummary() {
  const s = S.session, root = $("#qrun"), nextDue = Math.min(...Object.values(S.P.cards).map(c => c.due).filter(d => d > Date.now()));
  shell(); markNav(S.route);
  const sk = UI_LANG.on, nd = isFinite(nextDue) ? fmtDays(nextDue - Date.now()) : "";
  const lead = sk ? `Zapamätané: ${s.right}, na zopakovanie: ${s.wrong}.${s.again.size ? ` Druhýkrát sa vrátilo: ${s.again.size}.` : ""}${nd ? ` Ďalšie opakovanie o ${nd}.` : ""}`
    : `${s.right} remembered, ${s.wrong} to revisit${s.again.size ? `; ${s.again.size} came back a second time` : ""}.${nd ? ` Your next review is due in ${nd}.` : ""}`;
  root.innerHTML = `<h1>Session done</h1><p class="lead">${lead}</p>
    <div class="row" style="margin-top:22px"><a class="iconbtn hot" href="#/quiz">Choose another session</a><a class="iconbtn" href="#/">Back to the topics</a><a class="iconbtn" href="#/stats">See your stats</a></div>`;
  S.session = null;
}

// ---------- files out (downloads capability, else a copyable dialog)
export async function offerFile(filename, text, what) {
  const dl = S.caps.downloads;
  if (dl) { try { await dl.save({ filename, data: text }); return; } catch (e: any) { if (e?.code === "cancelled" || e?.code === "declined") return; } }
  closeOverlays();
  const sc = document.createElement("div"); sc.className = "scrim";
  sc.innerHTML = `<div class="dialog" role="dialog" aria-modal="true"><h2>${esc(what)}</h2><p class="small muted">Copy this JSON and save it as <span class="mono">${esc(filename)}</span>.</p><textarea class="field" style="min-height:260px" readonly>${esc(text)}</textarea><div class="row" style="margin-top:12px"><button class="btn primary" id="dcopy">Copy</button><button class="btn ghost" id="dclose">Close</button></div></div>`;
  document.body.appendChild(sc);
  $("#dcopy").onclick = async () => toast(await copyText(text) ? "Copied." : "Select the text and copy it manually.");
  $("#dclose").onclick = closeOverlays; sc.onclick = e => { if (e.target === sc) closeOverlays(); };
}
export function pickFiles(accept: string, multiple: boolean): Promise<File[]> { return new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.multiple = multiple; i.onchange = () => res([...i.files]); i.click(); }); }

// ---------- review mode
VIEWS.review = {
  html(r) {
    const G = S.G, st = r.q.get("status") || "", tp = r.q.get("topic") || "";
    const verdicts = Object.keys(S.P.review).length;
    const fails = G.checkResults.filter(c => !c.ok);
    let ids = Object.keys(G.nodes);
    if (tp) ids = ids.filter(i => G.nodes[i].topic === tp);
    if (st === "notes") ids = ids.filter(i => (G.nodes[i].review?.notes || []).length);
    else if (st === "verdict") ids = ids.filter(i => S.P.review[i]);
    else if (st === "pending") ids = ids.filter(i => G.nodes[i].review?.status !== "checked" && !S.P.review[i]);
    else if (st) ids = ids.filter(i => (G.nodes[i].review?.status || "draft") === st);
    const byTopic = G.topics.map(t => ({ t, ids: ids.filter(i => G.nodes[i].topic === t.id) })).filter(x => x.ids.length);
    const warnFor = id => G.warnings.filter(w => w.id === id);
    return h`<div style="max-width:1000px"><h1>Review</h1>
      <p class="lead">Check each item against its source. Your verdicts stay in this browser until you export them as a review patch for <span class="mono">studygraph review apply</span>.</p>
      <div class="filters">
        <label class="lab">Your name<input class="field" id="rvName" value="${esc(S.P.reviewer || "")}" placeholder="Reviewer"></label>
        <label class="lab">Show<select class="field" id="rvStatus">${[["", "Everything"], ["pending", "Not yet checked"], ["draft", "Draft"], ["flagged", "Flagged"], ["checked", "Checked"], ["notes", "Has reliability notes"], ["verdict", "Has your verdict"]].map(([v, l]) => `<option value="${v}" ${v === st ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="lab">Topic<select class="field" id="rvTopic"><option value="">All topics</option>${G.topics.map(t => `<option value="${esc(t.id)}" ${t.id === tp ? "selected" : ""}>${esc(t.title)}</option>`).join("")}</select></label>
        <span style="flex:1"></span>
        <button class="btn primary" id="rvExport" ${verdicts ? "" : "disabled"}>Export review patch (${verdicts})</button>
        <button class="btn ghost" id="rvClear" ${verdicts ? "" : "disabled"}>Clear verdicts</button>
      </div>
      ${fails.length ? `<div class="panel" style="margin-bottom:18px"><h3>Computed checks that disagree</h3><ul class="checklist">${fails.map(f => `<li><a href="${anyHref(f.id)}">${esc(f.id)}</a>: ${esc(f.detail)}</li>`).join("")}</ul></div>` :
        G.checkResults.length ? `<p class="small muted">All ${G.checkResults.length} computed checks agree with the stated answers.</p>` : ""}
      ${byTopic.length ? byTopic.map(({ t, ids }) => `<h2>${esc(t.title)} <span class="small faint">${ids.length}</span></h2>${ids.map(id => {
        const n = G.nodes[id], v = S.P.review[id], ws = warnFor(id);
        const src = (n.source || []).map(s => `${esc(s.file)}${s.page != null ? `, page ${esc(s.page)}` : ""}${s.label ? ` (${esc(s.label)})` : ""}`).join("<br>");
        return `<details class="rv-item" data-id="${esc(id)}"><summary>${chip(id)}<span style="flex:1;font-family:var(--serif)">${tt(n.id)}</span>${v ? `<span class="verdict ${v.verdict}">${v.verdict === "edit" ? "Edited" : v.verdict === "checked" ? "Checked by you" : "Flagged by you"}</span>` : ""}${reviewBadge(n)}</summary>
          <div class="rv-body"><div><div class="prose" data-stmt>${rich(v?.verdict === "edit" ? v.value : n.statement)}</div>
            ${n.proof?.steps?.length ? `<p class="small muted" style="margin-top:10px">Proof has ${n.proof.steps.length} steps. <a href="${itemHref(id)}">Open the item</a> to read them.</p>` : ""}
            <label class="lab" style="margin-top:12px">Comment<textarea class="field" data-comment placeholder="What is wrong or missing?">${esc(v?.comment || "")}</textarea></label>
            <div class="row" style="margin-top:10px"><button class="btn small" data-v="checked" aria-pressed="${v?.verdict === "checked"}">Checked</button><button class="btn small" data-v="flagged" aria-pressed="${v?.verdict === "flagged"}">Flag</button><button class="btn small ghost" data-v="edit">Edit statement</button>${v ? `<button class="btn small ghost" data-v="undo">Remove verdict</button>` : ""}</div>
            <div data-editor hidden><textarea class="field" style="min-height:120px">${esc(v?.value || n.statement)}</textarea><div class="row" style="margin-top:8px"><button class="btn small primary" data-save>Save edit</button><button class="btn small ghost" data-cancel>Cancel</button></div></div></div>
          <div class="rv-src"><b class="small">Source</b><p class="small">${src || "No source page recorded"}<br><span class="faint">${esc(ORIGIN[n.origin] || n.origin || "")}</span></p>
            ${(n.review?.notes || []).length ? `<b class="small">Reliability notes</b><ul class="small" style="padding-left:1.1em">${n.review.notes.map(x => `<li>${rich(typeof x === "string" ? x : x.text || "", { inline: true })}</li>`).join("")}</ul>` : ""}
            ${ws.length ? `<b class="small">Validator warnings</b><ul class="small" style="padding-left:1.1em">${ws.map(w => `<li>${esc(w.msg)}</li>`).join("")}</ul>` : ""}
            ${(G.demotions || []).filter(d => d.source === id || d.target === id).map(d => `<p class="small">Demoted by the cycle breaker: ${esc(d.source)} → ${esc(d.target)}</p>`).join("")}
            ${n.review?.checkedBy ? `<p class="small faint">Checked by ${esc(n.review.checkedBy)}${n.review.checkedAt ? ` on ${esc(n.review.checkedAt)}` : ""}</p>` : ""}</div></div></details>`; }).join("")}`).join("") : `<div class="empty">No items match these filters.</div>`}</div>`;
  },
  mount(r) {
    const nav = () => { const q = new URLSearchParams(); if ($("#rvStatus").value) q.set("status", $("#rvStatus").value); if ($("#rvTopic").value) q.set("topic", $("#rvTopic").value); location.hash = "#/review" + (q.toString() ? "?" + q : ""); };
    $("#rvStatus").onchange = nav; $("#rvTopic").onchange = nav;
    $("#rvName").onchange = e => { S.P.reviewer = e.target.value.trim(); saveProgress(); };
    $("#rvClear").onclick = () => { if (confirm("Remove all your review verdicts from this browser?")) { S.P.review = {}; saveProgress(); route(); } };
    $("#rvExport").onclick = () => {
      const name = S.P.reviewer || "reviewer", date = new Date().toISOString().slice(0, 10);
      const items = Object.entries(S.P.review).map(([id, v]) => ({ id, verdict: v.verdict, ...(v.comment ? { comment: v.comment } : {}), ...(v.verdict === "edit" ? { path: "statement", value: v.value } : {}) }));
      offerFile(`${date}-${name.toLowerCase().replace(/[^\w]+/g, "-")}.json`, JSON.stringify({ schemaVersion: 1, reviewer: name, date, items }, null, 2), "Review patch");
    };
    $$(".rv-item").forEach(d => {
      const id = d.dataset.id;
      const setV = v => { if (v) S.P.review[id] = v; else delete S.P.review[id]; saveProgress(); const open = $$(".rv-item[open]").map(x => x.dataset.id); route(); open.forEach(o => { const el = $(`.rv-item[data-id="${CSS.escape(o)}"]`); if (el) el.open = true; }); };
      d.addEventListener("click", e => {
        const b = (e.target as HTMLElement).closest("[data-v]"); const comment = $("[data-comment]", d).value.trim();
        if (b) { const v = b.dataset.v;
          if (v === "undo") return setV(null);
          if (v === "edit") { $("[data-editor]", d).hidden = false; return; }
          return setV({ verdict: v, comment }); }
        if ((e.target as HTMLElement).closest("[data-save]")) { const val = $("[data-editor] textarea", d).value; if (val.trim() && val !== S.G.nodes[id].statement) setV({ verdict: "edit", value: val, comment }); else $("[data-editor]", d).hidden = true; }
        if ((e.target as HTMLElement).closest("[data-cancel]")) $("[data-editor]", d).hidden = true;
      });
      $("[data-comment]", d).addEventListener("change", e => { if (S.P.review[id]) { S.P.review[id].comment = e.target.value.trim(); saveProgress(); } });
    });
  },
};

// ---------- stats
VIEWS.stats = {
  html() {
    const G = S.G, ids = Object.keys(G.nodes), now = Date.now();
    const byType = G.cfg.types.map(t => ({ t, n: ids.filter(i => G.nodes[i].type === t.id).length })).filter(x => x.n);
    const maxT = Math.max(...byType.map(x => x.n));
    const rv = { checked: 0, draft: 0, flagged: 0 }; ids.forEach(i => rv[G.nodes[i].review?.status || "draft"] = (rv[G.nodes[i].review?.status || "draft"] || 0) + 1);
    const bins = [0, 0, 0, 0, 0]; ids.forEach(i => bins[Math.min(4, Math.floor(mastery(i) * 5))]++);
    const days = Array.from({ length: 14 }, (_, d) => { const start = new Date(); start.setHours(0, 0, 0, 0); const a = start.getTime() + d * SG.FSRS.DAY, b = a + SG.FSRS.DAY; return Object.values(S.P.cards).filter(c => d === 0 ? c.due < b : c.due >= a && c.due < b).length; });
    const maxD = Math.max(1, ...days), maxB = Math.max(1, ...bins), cards = Object.keys(S.P.cards).length;
    const pct = k => ids.length ? rv[k] / ids.length * 100 : 0;
    const syncAvail = !!(S.caps.db && S.caps.user);
    return h`<div style="max-width:1080px"><h1>Stats</h1><p class="lead">${ids.length} items, ${cards} cards started, ${dueCount()} due now.</p>
      <div class="statgrid" style="margin-top:26px">
        <section><h2>Items by type</h2>${byType.map(({ t, n }) => `<div class="hbar"><span>${esc(t.label)}</span><span class="b" style="--tc:${t.color};width:${n / maxT * 100}%"></span><span class="small muted">${n}</span></div>`).join("")}</section>
        <section><h2>Review progress</h2><div class="stack-bar" role="img" aria-label="${rv.checked} checked, ${rv.draft} draft, ${rv.flagged} flagged"><i style="width:${pct("checked")}%;background:var(--ok)"></i><i style="width:${pct("flagged")}%;background:var(--danger)"></i></div>
          <p class="small muted" style="margin-top:8px">${rv.checked} checked, ${rv.draft || 0} draft, ${rv.flagged || 0} flagged. ${Object.keys(S.P.review).length} verdicts of yours waiting to be exported.</p>
          <h2>Mastery</h2><div class="vbars" style="height:90px">${bins.map(b => `<div style="height:${b / maxB * 100}%;background:var(--ok)" title="${b} items"></div>`).join("")}</div><div class="vlabels">${["0–20%", "20–40%", "40–60%", "60–80%", "80–100%"].map(l => `<span>${l}</span>`).join("")}</div></section>
        <section><h2>Cards due, next 14 days</h2><div class="vbars">${days.map((d, i) => `<div style="height:${d / maxD * 100}%" title="${d} cards"></div>`).join("")}</div><div class="vlabels">${days.map((d, i) => `<span>${i === 0 ? "Today" : i % 2 ? "" : "+" + i}</span>`).join("")}</div>
          <p class="small muted" style="margin-top:8px">${days[0]} due today, ${days.slice(1, 8).reduce((a, b) => a + b, 0)} in the following week.</p></section>
        <section><h2>By topic</h2><table class="plain"><thead><tr><th>Topic</th><th>Items</th><th>Checked</th><th>Mastery</th></tr></thead><tbody>${G.topics.map(t => { const st = topicStats(t); return `<tr><td><a href="#/t/${encodeURIComponent(t.id)}">${esc(t.title)}</a></td><td>${st.total}</td><td>${st.checked}</td><td>${Math.round(st.m * 100)}%</td></tr>`; }).join("")}</tbody></table></section>
      </div>
      <h2 style="margin-top:44px">Your progress data</h2>
      <p class="small muted read">Progress is kept in this browser for this course. Export it to move it to another device or keep a backup.</p>
      <div class="row"><button class="btn" id="pExport">Export progress</button><button class="btn" id="pImport">Import progress</button><button class="btn ghost" id="pReset">Reset progress</button>
        ${syncAvail ? `<label class="row small" style="margin-left:10px;gap:6px"><input type="checkbox" id="pSync" ${S.sync?.on ? "checked" : ""}> Sync progress to your Claude account</label>` : ""}</div>
      ${S.sync?.on ? `<p class="small faint" id="syncState">Synced ${S.sync.at ? "at " + new Date(S.sync.at).toLocaleTimeString() : "on change"}.</p>` : ""}
      ${S.allowOpen ? `<h2 style="margin-top:44px">Course</h2><p class="small muted read">${S.isDemo ? (S.bootCourse.embedded ? `This page contains the course ${esc(G.cfg.app.brand)}.` : "You are using the sample course.") : `Opened from your files: ${esc(G.cfg.app.title)}.`} Open a course bundle, a knowledge.json file, or the registry, config and topic files of a course repo together.</p>
      <div class="row"><button class="btn" id="cOpen">Open a course file</button>${S.isDemo ? "" : `<button class="btn ghost" id="cDemo">${S.bootCourse.embedded ? "Back to the course of this page" : "Use the sample course"}</button>`}</div>` : ""}
      ${G.warnings.length ? `<details class="notes" style="margin-top:20px"><summary>Validator warnings (${G.warnings.length})</summary><ul>${G.warnings.slice(0, 200).map(w => `<li><a href="${anyHref(w.id)}">${esc(w.id)}</a>: ${esc(w.msg)}</li>`).join("")}</ul></details>` : ""}</div>`;
  },
  mount() {
    $("#pExport").onclick = () => offerFile(`studygraph-progress-${S.G.cfg.app.courseId}.json`, JSON.stringify({ course: S.G.cfg.app.courseId, progress: S.P }, null, 2), "Progress");
    $("#pImport").onclick = async () => { const [f]: File[] = await pickFiles(".json,application/json", false); if (!f) return;
      try { const j = JSON.parse(await f.text()); const p = j.progress || j; if (!p.cards) throw 0; S.P = { ...blankProgress(), ...p }; saveProgress(); shell(); route(); toast("Progress imported."); } catch (e: any) { toast("That file is not a Studygraph progress export."); } };
    $("#pReset").onclick = () => { if (confirm("Delete all cards, answers and review verdicts for this course in this browser?")) { S.P = blankProgress(); saveProgress(); shell(); route(); } };
    const sy = $("#pSync"); if (sy) sy.onchange = () => sy.checked ? enableSync(true) : disableSync();
    const o = $("#cOpen"); if (o) o.onclick = pickCourseFiles; const d = $("#cDemo"); if (d) d.onclick = useDemo;
  },
};

