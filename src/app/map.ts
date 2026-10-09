import * as SG from "../core/index.js";
import { $, $$, LIB, S, VIEWS, colorOf, esc, h, itemHref, loadScript, mastery, mathless, tt } from "./base.js";
import { pad2 } from "./pages.js";
// ---------- concept map (Cytoscape)
export let cyInst = null;
export function mapLectures(r) { // ?lec=a,b ; old ?topic= links ; default: the lecture you were last in
  const G = S.G, l = r.q.get("lec") ?? r.q.get("topic");
  if (l !== null && l !== undefined) return l.split(",").filter(x => G.topicById[x]);
  const t = (S.P.last && (G.nodes[S.P.last.id] || G.apps[S.P.last.id])?.topic) || G.topics[0]?.id; return t ? [t] : [];
}
VIEWS.map = {
  html(r) {
    const G = S.G, mode = r.q.get("node") ? "node" : "lec";
    const typesUsed = G.cfg.types.filter(t => Object.values(G.nodes).some(n => n.type === t.id));
    const sel = new Set(mapLectures(r));
    const groups = G.cfg.courses.length ? G.cfg.courses.map(c => ({ c, ts: G.topics.filter(t => t.course === c.id) })).filter(g => g.ts.length) : [{ c: null, ts: G.topics }];
    return h`<div class="mapwrap"><div class="mapside">
      <h1 style="font-size:1.5rem">Concept map</h1>
      <div class="seg" role="group" aria-label="Map scope"><button data-mode="lec" aria-pressed="${mode === "lec"}">Lectures</button><button data-mode="node" aria-pressed="${mode === "node"}" ${r.q.get("node") || S.P.last ? "" : "disabled"}>Around an item</button></div>
      ${mode === "lec" ? `<div class="maplegend lecs"><div class="row" style="justify-content:space-between"><b class="small">Lectures</b><span class="row"><button class="linkbtn" data-lall="1">All</button><button class="linkbtn" data-lall="0">None</button></span></div>
        ${groups.map(g => `${g.c ? `<span class="small faint" style="margin-top:6px">${esc(g.c.title)}</span>` : ""}${g.ts.map(t => `<label><input type="checkbox" data-lec="${esc(t.id)}" ${sel.has(t.id) ? "checked" : ""}><span class="mono faint">${pad2(t.order)}</span>${esc(t.title)}</label>`).join("")}`).join("")}
        <label style="margin-top:8px"><input type="checkbox" id="mExt" ${r.q.get("ext") === "1" ? "checked" : ""}> Prerequisites from other lectures</label></div>` : ""}
      ${mode === "node" ? `<div class="small">Around <a href="${itemHref(r.q.get("node"))}">${tt(r.q.get("node"))}</a></div><div class="seg" role="group" aria-label="Radius">${[1, 2, 3].map(k => `<button data-r="${k}" aria-pressed="${String(k) === (r.q.get("r") || "1")}">${k} step${k > 1 ? "s" : ""}</button>`).join("")}</div>` : ""}
      <div class="maplegend"><b class="small">Edges</b>
        <label><input type="checkbox" data-ek="uses" checked> <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="currentColor" stroke-width="2"/></svg> Prerequisites</label>
        <label><input type="checkbox" data-ek="rel" checked> <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="currentColor" stroke-width="2" stroke-dasharray="5 3"/></svg> Relations</label>
        <label><input type="checkbox" data-ek="app" ${Object.keys(G.apps).length ? "checked" : "disabled"}> <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="currentColor" stroke-width="2" stroke-dasharray="1 4" stroke-linecap="round"/></svg> Applications</label></div>
      <div class="maplegend"><b class="small">Colour by</b><div class="seg"><button data-col="type" aria-pressed="true">Type</button><button data-col="mastery" aria-pressed="false">Mastery</button></div></div>
      <div class="maplegend"><b class="small">Types</b>${typesUsed.map(t => `<label><input type="checkbox" data-ty="${esc(t.id)}" checked><span class="dot" style="background:${t.color}"></span>${esc(t.label)}</label>`).join("")}</div>
      <p class="small faint">Arrows point from a prerequisite to what builds on it. Faded items are prerequisites from other lectures. Click a node to open it.</p>
    </div><div style="position:relative;min-width:0"><div id="cy" role="img" aria-label="Concept map of the course"><div class="mapmsg">Loading the map…</div></div></div></div>`;
  },
  async mount(r) {
    const G = S.G, P = new URLSearchParams(r.q);
    const go = () => { location.hash = "#/map" + (P.toString() ? "?" + P : ""); };
    $$("[data-mode]").forEach(b => b.onclick = () => { P.delete("node"); P.delete("r");
      if (b.dataset.mode === "node") { P.set("node", r.q.get("node") || S.P.last.id); P.set("r", "1"); } go(); });
    $$("[data-r]").forEach(b => b.onclick = () => { P.set("r", b.dataset.r); go(); });
    try { await loadScript(LIB.cytoscape); } catch (e: any) { $("#cy").innerHTML = `<div class="mapmsg">The map library could not load. Check your connection and reload the page.</div>`; return; }
    if (S.route.name !== "map") return;
    const css = getComputedStyle(document.documentElement), cv = k => css.getPropertyValue(k).trim();
    const state = { ek: { uses: true, rel: true, app: !!Object.keys(G.apps).length }, ty: new Set(G.cfg.types.map(t => t.id)), col: "type",
      lec: new Set(mapLectures(r)), ext: r.q.get("ext") === "1" };
    const center = r.q.get("node"), radius = +(r.q.get("r") || 1);
    const remember = () => { const Q = new URLSearchParams(); Q.set("lec", [...state.lec].join(",")); if (state.ext) Q.set("ext", "1"); history.replaceState(null, "", "#/map?" + Q); };
    const draw = () => {
      let nodeIds = Object.keys(G.nodes).filter(i => state.ty.has(G.nodes[i].type));
      const E = G.edges.filter(e => state.ek[e.kind]);
      const topicOf = i => (G.nodes[i] || G.apps[i])?.topic;
      let appIds = [], ext = new Set();
      if (!center) {
        nodeIds = nodeIds.filter(i => state.lec.has(G.nodes[i].topic));
        appIds = state.ek.app ? Object.keys(G.apps).filter(a => state.lec.has(G.apps[a].topic)) : [];
        if (state.ext) { const inSel = new Set([...nodeIds, ...appIds]);
          // only what the chosen lectures build on: prerequisites from other lectures (not everything that later uses them)
          for (const e of E) if (e.kind === "uses" && inSel.has(e.source) && !inSel.has(e.target) && G.nodes[e.target] && state.ty.has(G.nodes[e.target].type)) ext.add(e.target);
          for (const o of ext as Set<string>) (G.nodes[o] ? nodeIds : appIds).push(o); }
      }
      let dist = null;
      if (center && G.nodes[center]) {
        dist = { [center]: 0 }; let frontier = [center];
        const nb = {}; E.forEach(e => { (nb[e.source] ||= []).push(e.target); (nb[e.target] ||= []).push(e.source); });
        for (let k = 1; k <= radius; k++) { const nf = []; for (const v of frontier) for (const w of nb[v] || []) if (dist[w] === undefined) { dist[w] = k; nf.push(w); } frontier = nf; }
        nodeIds = Object.keys(dist).filter(i => G.nodes[i] && (state.ty.has(G.nodes[i].type) || i === center)); appIds = Object.keys(dist).filter(i => G.apps[i]);
      }
      const keep = new Set([...nodeIds, ...appIds]);
      const mcol = m => { const a = [0x5a, 0x66, 0x63], b = [0xa5, 0xe0, 0x7c]; return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * m)).join(",")})`; };
      const compound = !center && state.lec.size > 1;
      const els = [
        ...(compound ? G.topics.filter(t => state.lec.has(t.id) && [...keep].some(i => topicOf(i) === t.id)).map(t => ({ data: { id: "topic:" + t.id, label: pad2(t.order) + " " + t.title, topic: t.id }, classes: "topic" + (state.lec.has(t.id) ? "" : " ext") })) : []),
        ...nodeIds.map(i => ({ data: { id: i, label: mathless(G.nodes[i].title), color: state.col === "type" ? colorOf(i) : mcol(mastery(i)), parent: compound && !ext.has(i) ? "topic:" + G.nodes[i].topic : undefined, d: dist?.[i] ?? 0 }, classes: (i === center ? "center" : "") + (ext.has(i) ? " ext" : "") })),
        ...appIds.map(i => ({ data: { id: i, label: G.apps[i].title, color: SG.APP_COLOR, parent: compound ? "topic:" + G.apps[i].topic : undefined, d: dist?.[i] ?? 0 }, classes: "app" + (ext.has(i) ? " ext" : "") })),
        ...E.filter(e => keep.has(e.source) && keep.has(e.target) && !(ext.has(e.source) && ext.has(e.target))).map((e, k) => ({ data: { id: "e" + k, source: e.kind === "uses" ? e.target : e.source, target: e.kind === "uses" ? e.source : e.target }, classes: e.kind })),
      ];
      if (cyInst) cyInst.destroy();
      $("#cy").innerHTML = "";
      if (!nodeIds.length && !appIds.length) { $("#cy").innerHTML = `<div class="mapmsg">${!center && !state.lec.size ? "Choose one or more lectures on the left." : "No items match these filters."}</div>`; return; }
      cyInst = cytoscape({
        container: $("#cy"), elements: els, wheelSensitivity: 0.25, minZoom: 0.15, maxZoom: 3,
        style: [
          { selector: "node", style: { "background-color": "data(color)", label: "data(label)", color: cv("--text"), "font-family": "Familjen Grotesk, sans-serif", "font-size": 11, "text-wrap": "wrap", "text-max-width": 120, "min-zoomed-font-size": 7, "text-valign": "bottom", "text-margin-y": 4, width: 16, height: 16, "border-width": 0 } },
          { selector: "node.center", style: { width: 26, height: 26, "border-width": 3, "border-color": cv("--focus"), "font-weight": 700 } },
          { selector: "node.app", style: { shape: "round-diamond", width: 18, height: 18 } },
          { selector: "node.topic", style: { "background-color": cv("--panel"), "background-opacity": 0.55, "border-width": 1, "border-color": cv("--line"), label: "data(label)", "text-valign": "top", "text-halign": "center", "font-size": 13, "font-weight": 700, color: cv("--muted"), shape: "round-rectangle", padding: 18 } },
          { selector: "edge", style: { width: 1.4, "line-color": cv("--faint"), "curve-style": "bezier", opacity: 0.75 } },
          { selector: "edge.uses", style: { "target-arrow-shape": "triangle", "target-arrow-color": cv("--faint"), "arrow-scale": 0.8 } },
          { selector: "edge.rel", style: { "line-style": "dashed", "line-dash-pattern": [6, 4], "line-color": cv("--accent"), opacity: 0.6 } },
          { selector: "edge.app", style: { "line-style": "dotted", "line-color": SG.APP_COLOR, opacity: 0.7 } },
          { selector: "node:selected", style: { "border-width": 3, "border-color": cv("--focus") } },
          { selector: "node.ext", style: { opacity: 0.45, width: 11, height: 11, "font-size": 9 } },
          { selector: "node.topic.ext", style: { opacity: 0.5, "border-style": "dashed" } },
          { selector: ".faded", style: { opacity: 0.15 } },
        ],
        layout: center ? { name: "concentric", concentric: n => 10 - (n.data("d") || 0), levelWidth: () => 1, minNodeSpacing: 34, animate: false }
          : { name: "cose", animate: false, nodeRepulsion: () => 60000, nodeOverlap: 40, idealEdgeLength: () => 60, edgeElasticity: () => 80, nestingFactor: 1.2, gravity: 0.15, componentSpacing: 60, numIter: 2500, padding: 24, randomize: true },
      });
      cyInst.on("tap", "node", e => { const n = e.target; if (n.hasClass("topic")) location.hash = "#/t/" + encodeURIComponent(n.data("topic")); else location.hash = itemHref(n.id()); });
      cyInst.on("mouseover", "node", e => { if (e.target.hasClass("topic")) return; const nb = e.target.closedNeighborhood(); cyInst.elements().not(nb).not(".topic").addClass("faded"); });
      cyInst.on("mouseout", "node", () => cyInst.elements().removeClass("faded"));
    };
    $$("[data-lec]").forEach(c => c.onchange = () => { c.checked ? state.lec.add(c.dataset.lec) : state.lec.delete(c.dataset.lec); remember(); draw(); });
    $$("[data-lall]").forEach(b => b.onclick = () => { $$("[data-lec]").forEach(c => { c.checked = b.dataset.lall === "1"; c.checked ? state.lec.add(c.dataset.lec) : state.lec.delete(c.dataset.lec); }); remember(); draw(); });
    const mx = $("#mExt"); if (mx) mx.onchange = () => { state.ext = mx.checked; remember(); draw(); };
    $$("[data-ek]").forEach(c => c.onchange = () => { state.ek[c.dataset.ek] = c.checked; draw(); });
    $$("[data-ty]").forEach(c => c.onchange = () => { c.checked ? state.ty.add(c.dataset.ty) : state.ty.delete(c.dataset.ty); draw(); });
    $$("[data-col]").forEach(b => b.onclick = () => { state.col = b.dataset.col; $$("[data-col]").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); });
    draw();
  },
};

