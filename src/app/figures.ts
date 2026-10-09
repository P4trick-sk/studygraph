import * as SG from "../core/index.js";
import { $, $$, LIB, ORIGIN, S, esc, loadScript, mathless, plain, rich } from "./base.js";
import { has } from "./pages.js";
// ---------- figure plugins
export const FIG = {
  graph: {
    render(f) {
      const vs = f.vertices || [], es = f.edges || [];
      if (!vs.length) return `<div class="fbody muted small">No drawing data.</div>`;
      const xs = vs.map(v => v.x), ys = vs.map(v => v.y);
      const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1), k = span / 340;
      const P = 40 * k, minX = Math.min(...xs) - P, minY = Math.min(...ys) - P, W = Math.max(...xs) - minX + P, H = Math.max(...ys) - minY + P;
      const pos = Object.fromEntries(vs.map(v => [v.id, v]));
      let md = Infinity; for (let a = 0; a < vs.length; a++) for (let b = a + 1; b < vs.length; b++) md = Math.min(md, Math.hypot(vs[a].x - vs[b].x, vs[a].y - vs[b].y));
      const R = Math.min(17 * k, isFinite(md) ? md * 0.44 : 17 * k), fs = R / 17, mid = "ah-" + f.id.replace(/[^\w]/g, ""), pairs = {};
      const edges = es.map(e => {
        const a = pos[e.source], b = pos[e.target]; if (!a || !b) return "";
        const dir = e.directed ?? f.directed, key = [e.source, e.target].sort().join("|"), nth = (pairs[key] = (pairs[key] || 0) + 1) - 1;
        let lab = `<text class="elab" data-elab="${esc(e.id)}" text-anchor="middle" style="font-size:${12 * k}px"`;
        if (a === b) { const cx = a.x, cy = a.y - R; return `<g class="el" data-el="${esc(e.id)}"><path class="edge" fill="none" d="M${cx - R * .6} ${cy} C${cx - R * 1.6} ${cy - R * 2.4} ${cx + R * 1.6} ${cy - R * 2.4} ${cx + R * .6} ${cy}" ${dir ? `marker-end="url(#${mid})"` : ""}/>${lab} x="${cx}" y="${cy - R * 1.9}">${esc(e.label || "")}</text></g>`; }
        const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
        const x1 = a.x + ux * R, y1 = a.y + uy * R, x2 = b.x - ux * (R + (dir ? 3 * k : 0)), y2 = b.y - uy * (R + (dir ? 3 * k : 0));
        const bend = nth ? (nth % 2 ? 1 : -1) * Math.ceil(nth / 2) * 22 * k : 0, mx = (x1 + x2) / 2 - uy * bend, my = (y1 + y2) / 2 + ux * bend;
        return `<g class="el" data-el="${esc(e.id)}"><path class="edge" fill="none" d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" ${dir ? `marker-end="url(#${mid})"` : ""}/>
          ${lab} x="${mx - uy * 12 * k}" y="${my + ux * 12 * k}">${esc(e.label || "")}</text></g>`;
      }).join("");
      const verts = vs.map(v => `<g class="el" data-el="${esc(v.id)}"><circle cx="${v.x}" cy="${v.y}" r="${R}"/>
        <foreignObject x="${v.x - 40 * fs}" y="${v.y - 14 * fs}" width="${80 * fs}" height="${28 * fs}"><div xmlns="http://www.w3.org/1999/xhtml" class="vl" style="font-size:${12 * fs}px">${rich(v.label ?? v.id, { inline: true })}</div></foreignObject></g>`).join("");
      const anims = f.animations || [];
      return `<div class="fbody"><svg class="gsvg" viewBox="${minX} ${minY} ${W} ${H}" role="img" aria-label="${esc(plain(f.caption || f.title))}" style="--k:${k}">
        <defs><marker id="${mid}" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="${11 * k}" markerHeight="${11 * k}" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor" style="color:var(--faint)"/></marker></defs>${edges}${verts}</svg></div>
        ${anims.length ? `<div class="gcap prose" aria-live="polite"></div><div class="gctl">
          ${anims.length > 1 ? `<select class="field small" data-g="anim" aria-label="Animation">${anims.map((a, i) => `<option value="${i}">${esc(mathless(a.title || "Animation " + (i + 1)))}</option>`).join("")}</select>` : anims[0].title ? `<b class="small">${rich(anims[0].title, { inline: true })}</b>` : ""}
          <button class="iconbtn" data-g="prev" aria-label="Previous step">Back</button>
          <button class="iconbtn" data-g="play">Play</button>
          <button class="iconbtn" data-g="next" aria-label="Next step">Next</button>
          <input type="range" min="0" value="0" aria-label="Animation step">
          <span class="small faint" data-g="count"></span></div>` : ""}`;
    },
    mount(el, f) {
      const anims = f.animations || []; if (!anims.length) return;
      const svg = $("svg", el), cap = $(".gcap", el), range = $("input[type=range]", el), count = $("[data-g=count]", el), play = $("[data-g=play]", el);
      let ai = 0, i = 0, timer = null; const steps = () => anims[ai].steps || [];
      const set = n => {
        const S_ = steps(); i = Math.max(0, Math.min(S_.length, n)); range.max = S_.length; range.value = i; count.textContent = `${i} / ${S_.length}`;
        const st = S_[i - 1];
        const hl = st ? [...(st.highlight || []), ...(st.highlightVertices || []), ...(st.highlightEdges || [])] : [];
        const dim = new Set(st?.dimEdges || []);
        svg.classList.toggle("anim", hl.length > 0);
        $$("[data-el]", svg).forEach(g => { const on = hl.includes(g.dataset.el); g.classList.toggle("hl", on); g.classList.toggle("dimmed", dim.has(g.dataset.el)); $("path,circle", g)?.classList.toggle("hl", on); });
        $$("[data-elab]", svg).forEach(t => { const e = (f.edges || []).find(x => x.id === t.dataset.elab); t.textContent = st?.edgeLabels?.[t.dataset.elab] ?? e?.label ?? ""; });
        cap.innerHTML = st ? rich(st.caption) : `<span class="muted">${S_.length} steps. Press Play or step through.</span>`;
      };
      const stop = () => { clearInterval(timer); timer = null; play.textContent = "Play"; };
      play.onclick = () => { if (timer) return stop(); if (i >= steps().length) set(0); play.textContent = "Pause"; timer = setInterval(() => { if (i >= steps().length) return stop(); set(i + 1); }, 1900); };
      $("[data-g=prev]", el).onclick = () => { stop(); set(i - 1); };
      $("[data-g=next]", el).onclick = () => { stop(); set(i + 1); };
      range.oninput = () => { stop(); set(+range.value); };
      const sel = $("[data-g=anim]", el); if (sel) sel.onchange = () => { stop(); ai = +sel.value; set(0); };
      set(0);
    },
  },
  table: {
    render(f) {
      return `<div class="fbody"><table class="tb"><thead><tr>${(f.columns || []).map(c => `<th scope="col">${rich(c, { inline: true })}</th>`).join("")}</tr></thead>
        <tbody>${(f.rows || []).map(r => `<tr>${r.map(c => `<td>${rich(String(c), { inline: true })}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    },
  },
  plot: {
    render(f) {
      const p0 = f.plot || {}, p = { ...p0 };
      if (Array.isArray(p0.x)) p.x = { min: p0.x[0], max: p0.x[1] };
      if (Array.isArray(p0.y)) p.y = { min: p0.y[0], max: p0.y[1] };
      const series = [...(p0.series || [])];
      for (const fn of p0.fns || []) { let g; try { g = new Function("x", "with(Math){return " + String(fn.expr).replace(/\^/g, "**").replace(/\bln\(/g, "log(") + "}"); } catch (e: any) { continue; }
        const a = p.x?.min ?? -5, b = p.x?.max ?? 5, ylo = p.y?.min ?? -1e9, yhi = p.y?.max ?? 1e9, pts = [];
        for (let k = 0; k <= 240; k++) { const x = a + (b - a) * k / 240; let y; try { y = g(x); } catch (e: any) { y = NaN; } pts.push(isFinite(y) && y >= ylo - (yhi - ylo) && y <= yhi + (yhi - ylo) ? [x, Math.max(ylo, Math.min(yhi, y))] : null); }
        series.push({ label: fn.label || fn.expr, points: pts, line: true }); }
      if ((p0.points || []).length && !Array.isArray(p0.points[0])) series.push({ label: "", points: p0.points.map(q => [q.x, q.y]), labels: p0.points.map(q => q.label), dots: true });
      const all = series.flatMap(s => (s.points || []).filter(Boolean));
      const x0 = p.x?.min ?? Math.min(...all.map(q => q[0])), x1 = p.x?.max ?? Math.max(...all.map(q => q[0]));
      const y0 = p.y?.min ?? Math.min(0, ...all.map(q => q[1])), y1 = p.y?.max ?? Math.max(...all.map(q => q[1]));
      const W = 520, H = 280, L = 48, B = 36, T = 14, Rr = 16;
      const sx = x => L + (x - x0) / (x1 - x0 || 1) * (W - L - Rr), sy = y => H - B - (y - y0) / (y1 - y0 || 1) * (H - B - T);
      const ticks = (a, b, n = 5) => Array.from({ length: n + 1 }, (_, k) => a + (b - a) * k / n);
      const fmt = v => Math.abs(v) >= 100 || Number.isInteger(v) ? Math.round(v) : v.toFixed(1);
      const cols = SG.CHALK;
      return `<div class="fbody"><svg class="plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(plain(f.caption || f.title))}">
        <line class="ax" x1="${L}" y1="${H - B}" x2="${W - Rr}" y2="${H - B}"/><line class="ax" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/>
        ${ticks(x0, x1, Number.isInteger(x1 - x0) && x1 - x0 <= 10 ? x1 - x0 : 5).map(v => `<text x="${sx(v)}" y="${H - B + 16}" text-anchor="middle">${fmt(v)}</text>`).join("")}
        ${ticks(y0, y1, 4).map(v => `<text x="${L - 8}" y="${sy(v) + 4}" text-anchor="end">${fmt(v)}</text><line class="ax" x1="${L}" x2="${W - Rr}" y1="${sy(v)}" y2="${sy(v)}" opacity=".35"/>`).join("")}
        ${p.x?.label ? `<text x="${W - Rr}" y="${H - 4}" text-anchor="end">${esc(p.x.label)}</text>` : ""}
        ${series.map((s, k) => `${s.dots ? "" : (s.line ? (() => { let d = "", pen = false; for (const q of s.points) { if (!q) { pen = false; continue; } d += (pen ? "L" : "M") + sx(q[0]).toFixed(1) + " " + sy(q[1]).toFixed(1); pen = true; } return `<path fill="none" stroke="${s.color || cols[k % cols.length]}" stroke-width="2.2" d="${d}"/>`; })() : `<polyline fill="none" stroke="${s.color || cols[k % cols.length]}" stroke-width="2.4" points="${(s.points || []).map(q => sx(q[0]) + "," + sy(q[1])).join(" ")}"/>`)}
          ${s.line ? "" : (s.points || []).map((q, j) => `<circle cx="${sx(q[0])}" cy="${sy(q[1])}" r="3" fill="${s.dots ? "var(--text)" : s.color || cols[k % cols.length]}"/>${s.labels?.[j] ? `<text x="${sx(q[0]) + 6}" y="${sy(q[1]) - 6}">${esc(s.labels[j])}</text>` : ""}`).join("")}
          ${s.label ? `<rect x="${L + 12}" y="${T + 6 + k * 18}" width="12" height="3" fill="${s.color || cols[k % cols.length]}"/><text x="${L + 30}" y="${T + 11 + k * 18}">${esc(s.label)}</text>` : ""}`).join("")}
      </svg></div>`;
    },
  },
  mermaid: {
    render(f) { return `<div class="fbody"><div class="mm" data-code="${esc(f.code || "")}"><span class="muted small">Loading diagram…</span></div></div>`; },
    async mount(el, f) {
      try { await loadScript(LIB.mermaid); const dark = matchMedia("(prefers-color-scheme: dark)").matches;
        mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "neutral", securityLevel: "strict" });
        const { svg } = await mermaid.render("m" + Math.random().toString(36).slice(2), f.code || ""); $(".mm", el).innerHTML = svg;
      } catch (e: any) { $(".mm", el).innerHTML = `<pre class="code">${esc(f.code || "")}</pre>`; }
    },
  },
  code: {
    render(f) { return `<div class="fbody"><pre class="code"><code class="language-${esc(f.language || "plaintext")}">${esc(f.code || "")}</code></pre></div>`; },
    async mount(el) { try { await loadScript(LIB.hljs); window.hljs?.highlightElement($("code", el)); } catch (e: any) { } },
  },
};
export function figureHTML(id) {
  const f = S.G.figures[id]; if (!f) return "";
  const plug = FIG[f.kind] || { render: () => `<div class="fbody muted small">This figure kind (${esc(f.kind)}) has no renderer in this viewer.</div>` };
  return `<figure class="fig" id="fig-${esc(f.id)}" data-fig="${esc(f.id)}"><div class="fhead"><b>${rich(f.title, { inline: true })}</b>${f.origin ? `<span class="small faint">${esc(ORIGIN[f.origin] || f.origin)}</span>` : ""}</div>
    ${plug.render(f)}${f.caption ? `<figcaption>${rich(f.caption, { inline: true })}</figcaption>` : ""}</figure>`;
}
export function mountFigures(root) { $$("[data-fig]", root).forEach(el => { const f = S.G.figures[el.dataset.fig]; FIG[f?.kind]?.mount?.(el, f); }); }
