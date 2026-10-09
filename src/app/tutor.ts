import { $, S, blankProgress, copyText, esc, mathless, rich, saveProgress, titleOf, toast, tt, typeOf } from "./base.js";
import { relatedGroups, route, shell } from "./pages.js";
// ---------- AI tutor bundle and panel
export function tutorBundle(id) {
  const G = S.G, n = G.nodes[id], T = typeOf(id), t = G.topicById[n.topic];
  const L = [`# ${n.title} (${T.label}, id ${id})`, `Course: ${G.cfg.app.title}. Topic: ${t.title}.`, "", "## Statement", n.statement];
  if (n.proof) { L.push("", `## ${G.cfg.proofLabel} (${n.proof.status || "full"})`); if (n.proof.strategy) L.push("Strategy: " + n.proof.strategy); if (n.proof.idea) L.push("Idea: " + n.proof.idea);
    (n.proof.steps || []).forEach((s, i) => L.push(`${i + 1}. ${s.text}${s.why ? ` (Why: ${s.why})` : ""}${(s.uses || []).length ? ` [uses ${s.uses.join(", ")}]` : ""}`)); }
  if (n.explanation?.intuition) L.push("", "## Intuition", n.explanation.intuition);
  if (n.explanation?.pitfalls) L.push("", "## Pitfalls", n.explanation.pitfalls);
  const path = G.learningPath(id);
  if (path.length) { L.push("", "## Prerequisites, in learning order"); path.forEach(p => L.push(`- **${G.nodes[p].title}** (${p}): ${G.nodes[p].statement}`)); }
  const rel = relatedGroups(id); if (rel.length) { L.push("", "## Related"); rel.forEach(([label, g]) => g.items.forEach(x => G.nodes[x.id] && L.push(`- ${label}: **${G.nodes[x.id].title}** (${x.id}): ${G.nodes[x.id].statement}`))); }
  const used = (G.usedBy[id] || []).slice(0, 8); if (used.length) { L.push("", "## Used in"); used.forEach(u => L.push(`- ${G.nodes[u].title} (${u})`)); }
  return L.join("\n");
}
export const TUTOR = { id: null, turns: [], ctl: null };
export async function openTutor(id: string, preset?: string) {
  await S.capsReady;
  if (!S.caps.sample) { const ok = await copyText(tutorBundle(id)); toast(ok ? "The tutor is not available here, so the item's tutor bundle was copied. Paste it into Claude with your question." : "The tutor is not available here. Use Copy for AI instead.", 4200); return; }
  if (TUTOR.id !== id) { TUTOR.id = id; TUTOR.turns = []; }
  let el = $("#tutor");
  if (!el) { el = document.createElement("div"); el.id = "tutor"; el.className = "tutor"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Tutor"); document.body.appendChild(el); }
  el.innerHTML = `<header><div style="flex:1;min-width:0"><b>Tutor</b><div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tt(id)}</div></div><button class="btn ghost small" id="tStop" hidden>Stop</button><button class="btn ghost small" id="tClose">Close</button></header>
    <div class="msgs" id="tMsgs" aria-live="polite">${TUTOR.turns.length ? "" : `<p class="small muted">Ask anything about this item. The tutor only sees this item, its prerequisites and related items, and answers from them.</p>`}</div>
    <form id="tForm"><textarea class="field" id="tIn" placeholder="Ask a question about ${esc(mathless(titleOf(id)))}" rows="2"></textarea><button class="btn primary" type="submit">Ask</button></form>`;
  const msgs = $("#tMsgs");
  TUTOR.turns.forEach(t => msgs.insertAdjacentHTML("beforeend", `<div class="m ${t.role === "user" ? "u" : "a"} ${t.role === "user" ? "" : "prose"}">${t.role === "user" ? rich(t.content, { inline: true }) : rich(t.content)}</div>`));
  $("#tClose").onclick = () => { TUTOR.ctl?.abort(); el.remove(); };
  $("#tStop").onclick = () => TUTOR.ctl?.abort();
  $("#tIn").onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#tForm").requestSubmit(); } };
  $("#tForm").onsubmit = e => { e.preventDefault(); const q = $("#tIn").value.trim(); if (q) { $("#tIn").value = ""; ask(q); } };
  const ask = async q => {
    const cfg = S.G.cfg;
    const rules = `You are a patient tutor for the course "${cfg.app.title}". Answer in ${cfg.language.ui === "sk" ? "Slovak" : cfg.language.ui === "cs" ? "Czech" : "English"}. Use only the course material below. If the material does not contain what is asked, say so plainly instead of inventing results. When you mention an item from the material, link it as [title](item-id) using its id. Write mathematics as $...$. Keep answers under about 200 words unless asked for more.\n\n--- COURSE MATERIAL ---\n${tutorBundle(id)}`;
    TUTOR.turns.push({ role: "user", content: q });
    msgs.querySelector("p.small")?.remove();
    msgs.insertAdjacentHTML("beforeend", `<div class="m u">${rich(q, { inline: true })}</div>`);
    const out = document.createElement("div"); out.className = "m a prose"; out.textContent = "Thinking…"; msgs.appendChild(out); msgs.scrollTop = msgs.scrollHeight;
    TUTOR.ctl = new AbortController(); $("#tStop").hidden = false;
    try {
      const { text } = await S.caps.sample([{ role: "user", content: rules }, ...TUTOR.turns], { cache: false, signal: TUTOR.ctl.signal, onText: ({ text }) => { out.innerHTML = rich(text); msgs.scrollTop = msgs.scrollHeight; } });
      out.innerHTML = rich(text); TUTOR.turns.push({ role: "assistant", content: text });
    } catch (err: any) {
      const keep = err?.text; out.innerHTML = keep ? rich(keep) : "";
      if (keep) TUTOR.turns.push({ role: "assistant", content: keep });
      const msg = { cancelled: "Stopped.", not_granted: "The tutor needs your permission to use Claude. Use Copy for AI instead, or reload and allow it.", rate_limited: "Too many questions at once. Wait a moment, then ask again." }[err?.code] || "The tutor could not answer. Try again in a moment.";
      if (err?.code !== "cancelled" || !keep) out.insertAdjacentHTML("beforeend", `<p class="small muted">${msg}</p>`);
    } finally { $("#tStop").hidden = true; }
  };
  if (preset) ask(preset); else $("#tIn").focus();
}

// ---------- sync via the artifact database
export async function enableSync(interactive) {
  await S.capsReady;
  const db = S.caps.db, user = S.caps.user; if (!db || !user) { if (interactive) toast("Sync is not available in this view."); return; }
  try {
    const uid = await user.id(); if (!uid) throw new Error("no id");
    const doc = db.doc(`data/users/${uid}/progress-${String(S.G.cfg.app.courseId).replace(/[^\w-]/g, "_")}`);
    const snap = await doc.get();
    if (snap.exists) { const d = snap.data(); if ((d.updatedAt || 0) > (S.P.updatedAt || 0)) { S.P = { ...blankProgress(), ...JSON.parse(d.json) }; saveProgress(false); shell(); route(); } }
    S.sync = { on: true, doc, at: null };
    try { localStorage.setItem(`sg:sync:${S.G.cfg.app.courseId}`, "1"); } catch (e: any) { }
    await pushSync(); if (interactive) toast("Progress now syncs to your account.");
  } catch (e: any) { S.sync = null; if (interactive) toast("Sync could not start. Your progress stays in this browser."); }
}
export function disableSync() { S.sync = null; try { localStorage.removeItem(`sg:sync:${S.G.cfg.app.courseId}`); } catch (e: any) { } toast("Sync is off. Progress stays in this browser."); }
export async function pushSync() { if (!S.sync?.on) return; try { await S.sync.doc.set({ json: JSON.stringify(S.P), updatedAt: S.P.updatedAt || Date.now() }); S.sync.at = Date.now(); const s = $("#syncState"); if (s) s.textContent = "Synced at " + new Date().toLocaleTimeString() + "."; } catch (e: any) { } }

