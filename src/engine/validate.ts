/**
 * `studygraph validate`: schema parse (Zod) + graph rules. Errors block the build; warnings do not.
 * --fix applies only safe repairs: deduplicate lists, add statement links missing from uses/relations as see-also.
 */
import { createRequire } from "node:module";
import { ID } from "../schema/index.js";
import { LINK, textsOf, evalExpr, numberIn } from "../core/text.js";
import { loadWorkspace, cycles, type Workspace } from "./workspace.js";

export interface Issue { id: string; msg: string }
export interface ValidationResult { errors: Issue[]; warnings: Issue[]; ws: Workspace; fixed: number; counts: Record<string, number> }

const TEX_OUT = /\\(frac|sum|int|alpha|beta|gamma|delta|lambda|mu|sigma|omega|in|subseteq|cup|cap|leq|geq|neq|to|mathbb|mathcal|cdot|times|forall|exists|infty)\b/;
const LIT_N = /\\n(?![a-zA-Z])/;

function loadKatex(): any {
  try { return createRequire(import.meta.url)("katex"); } catch { return null; }
}

export function validate(root: string, opts: { topic?: string; fix?: boolean; katex?: boolean } = {}): ValidationResult {
  const ws = loadWorkspace(root);
  const errors: Issue[] = [], warnings: Issue[] = [];
  const err = (id: string, msg: string) => errors.push({ id, msg }), warn = (id: string, msg: string) => warnings.push({ id, msg });
  for (const p of ws.parseErrors) err(p.file, `schema: ${p.msg}`);
  const known = new Set([...Object.keys(ws.nodes), ...Object.keys(ws.figures), ...Object.keys(ws.apps), ...Object.keys(ws.quiz)]);
  const resolves = (x: string) => known.has(x) || x in ws.reserved;
  const topicIds = new Set(ws.topics.map(t => t.meta.id));
  const courseIds = new Set(ws.config.courses.map(c => c.id));
  let fixed = 0;

  const seen: Record<string, string> = {};
  for (const d of ws.topics) for (const kind of ["nodes", "figures", "applications", "quiz"] as const)
    for (const x of d[kind] as Array<{ id: string }>) { if (seen[x.id]) err(x.id, `duplicate id (also in topic ${seen[x.id]})`); seen[x.id] = d.meta.id; }

  for (const d of ws.topics) {
    const tid = d.meta.id, m = d.meta;
    if (courseIds.size && !courseIds.has(m.course)) err(tid, `meta.course ${m.course} is not in config.courses`);
    for (const p of m.prerequisites) if (!topicIds.has(p) && !ws.registry.topics.some(t => t.id === p)) err(tid, `prerequisite topic ${p} unknown`);
    for (const a of m.alsoCovers) if (!resolves(a)) err(tid, `alsoCovers ${a} unresolved`);

    for (const n of d.nodes as any[]) {
      const i = n.id, ty = ws.types[n.type];
      if (!ty) { err(i, `type ${n.type} not in config.nodeTypes`); continue; }
      if (!ID.test(i)) err(i, "id must be <prefix>.<lowercase-ascii-slug>");
      else if (i.split(".")[0] !== ty.prefix) err(i, `prefix should be ${ty.prefix} for type ${n.type}`);
      if (n.origin === "slides" && !(n.source || []).length) err(i, "origin slides needs source [{file, page|slide}]");
      if (ty.needsProof && !n.proof) err(i, `type ${n.type} needs proof (status none + idea is allowed)`);
      if (ty.needsTerms && !(n.terms || []).length) err(i, `type ${n.type} needs terms`);
      const refs = new Set<string>([...(n.uses || []), ...(n.relations || []).map((r: any) => r.target)]);
      for (const u of n.uses || []) {
        if (!resolves(u)) err(i, `uses ${u} unresolved`);
        else if (ws.nodes[u] && ws.isRefType(ws.nodes[u].type) && !ws.isRefType(n.type)) err(i, `uses ${u}: a ${ws.nodes[u].type} cannot be a prerequisite of a ${n.type} (move it to relations)`);
      }
      for (const r of n.relations || []) {
        if (!ws.relations.has(r.type)) err(i, `relation type ${r.type} unknown`);
        if (!resolves(r.target)) err(i, `relation target ${r.target} unresolved`);
      }
      for (const f of n.figures || []) if (!(f in ws.figures)) err(i, `figure ${f} unresolved`);
      for (const s of n.proof?.steps || []) for (const u of s.uses || []) if (!resolves(u)) err(i, `proof step uses ${u} unresolved`);
      for (const [where, t] of textsOf(n)) {
        for (const mm of t.matchAll(LINK)) {
          const tgt = mm[2];
          if (!resolves(tgt)) { err(i, `${where}: link to ${tgt} unresolved`); continue; }
          if (tgt.startsWith("fig.") || tgt.startsWith("app.") || refs.has(tgt) || tgt === i) continue;
          if (opts.fix && where === "statement") { n.relations = [...(n.relations || []), { type: "see-also", target: tgt }]; refs.add(tgt); fixed++; }
          else if (where === "statement") err(i, `statement: inline link ${tgt} is in neither uses nor relations (--fix adds it as see-also)`);
          else warn(i, `${where}: inline link ${tgt} is in neither uses nor relations`);
        }
        const body = t.replace(/(?<!\\)\\\$/g, "");
        if ((body.match(/\$/g) || []).length % 2) err(i, `${where}: unbalanced $`);
        if (LIT_N.test(t)) err(i, `${where}: literal \\n (use a real line break)`);
        const outside = body.replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$|`[^`]*`/g, "");
        const mt = outside.match(TEX_OUT); if (mt) err(i, `${where}: LaTeX command outside $…$ (${mt[0]})`);
      }
      if (!n.explanation) warn(i, "no explanation");
      if (opts.fix) {
        const u = [...new Set<string>(n.uses || [])]; if (u.length !== (n.uses || []).length) { n.uses = u; fixed++; }
        const k = new Set<string>(); const rel = (n.relations || []).filter((r: any) => { const key = r.type + "|" + r.target; if (k.has(key)) return false; k.add(key); return true; });
        if (rel.length !== (n.relations || []).length) { n.relations = rel; fixed++; }
      }
    }

    for (const f of d.figures as any[]) {
      const i = f.id;
      if (!ws.config.figureKinds.includes(f.kind)) warn(i, `figure kind ${f.kind} not in config.figureKinds`);
      for (const x of f.illustrates || []) if (!resolves(x)) err(i, `illustrates ${x} unresolved`);
      if (!(f.illustrates || []).length) warn(i, "figure without illustrates");
      if (f.kind === "graph") {
        const vs = new Set<string>((f.vertices || []).map((v: any) => v.id)), es = new Set<string>((f.edges || []).map((e: any) => e.id));
        for (const e of f.edges || []) if (!vs.has(e.source) || !vs.has(e.target)) err(i, `edge ${e.id} refers to a missing vertex`);
        for (const a of f.animations || []) for (const s of a.steps || []) {
          for (const h of [...(s.highlight || []), ...(s.highlightVertices || []), ...(s.highlightEdges || []), ...(s.dimEdges || [])]) if (!vs.has(h) && !es.has(h)) err(i, `animation refers to missing element ${h}`);
          for (const e of Object.keys(s.edgeLabels || {})) if (!es.has(e)) err(i, `edgeLabels refers to missing edge ${e}`);
        }
      }
      if (f.kind === "table") for (const r of f.rows || []) if (r.length !== (f.columns || []).length) err(i, `table row has ${r.length} cells, header has ${(f.columns || []).length}`);
      if (f.kind === "plot" && !((f.plot?.fns || []).length || (f.plot?.points || []).length || (f.plot?.series || []).length)) err(i, "plot has nothing to draw (fns, points or series)");
    }
    for (const a of d.applications as any[]) {
      for (const x of a.connects || []) if (!resolves(x)) err(a.id, `connects ${x} unresolved`);
      if (!(a.connects || []).length) warn(a.id, "application connects nothing");
    }
    for (const q of d.quiz as any[]) {
      if (q.kind === "mcq" && !(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < (q.options || []).length)) err(q.id, "mcq answer must be an option index");
      if (q.kind === "truefalse" && typeof q.answer !== "boolean") err(q.id, "truefalse answer must be true/false");
      for (const x of q.about || []) if (!resolves(x)) err(q.id, `about ${x} unresolved`);
      if (!(q.about || []).length) warn(q.id, "quiz item without about");
      for (const t of [q.prompt, String(q.answer), q.explanation || "", ...(q.options || [])]) if ((String(t).replace(/(?<!\\)\\\$/g, "").match(/\$/g) || []).length % 2) err(q.id, "unbalanced $");
      if (q.check?.verifier === "expr") {
        try { const v = evalExpr(q.check.expr), want = q.kind === "mcq" ? numberIn(q.options[q.answer]) : numberIn(q.answer);
          if (Math.abs(v - want) > 1e-9) err(q.id, `check ${q.check.expr} = ${v} disagrees with answer ${want}`); }
        catch (e) { err(q.id, `check failed: ${(e as Error).message}`); }
      }
    }
    const nn = d.nodes.length, rels = d.nodes.flatMap((n: any) => n.relations || []);
    if (nn && d.quiz.length < nn / 2) warn(tid, `only ${d.quiz.length} quiz items for ${nn} nodes (aim for 5 per 10)`);
    if (rels.length >= 10 && rels.filter((r: any) => r.type === "see-also").length / rels.length > 0.8) warn(tid, "more than 80% of relations are see-also; prefer specific types");
  }
  for (const n of Object.values(ws.nodes)) for (const c of n.checks || []) if (c.verifier === "expr") {
    try { const v = evalExpr(c.expr); if (Math.abs(v - Number(c.expect)) > 1e-9) err(n.id, `check ${c.expr} = ${v}, expected ${c.expect}`); }
    catch (e) { err(n.id, `check failed: ${(e as Error).message}`); }
  }
  for (const [r, v] of Object.entries(ws.reserved)) if (!known.has(r) && topicIds.has(v.topic)) warn(r, `reserved for topic ${v.topic} but not defined there yet`);
  for (const comp of cycles(ws)) { const ids = [...comp].sort(); err(ids[0], `dependency cycle among ${ids.slice(0, 8).join(", ")}${ids.length > 8 ? " …" : ""} (run studygraph cycles --apply)`); }

  if (opts.katex !== false) {
    const k = loadKatex();
    if (!k) warn("-", "katex is not installed – maths not parsed");
    else {
      const check = (id: string, where: string, t: string) => {
        for (const m of t.replace(/(?<!\\)\\\$/g, "").matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g)) {
          try { k.renderToString(m[1] ?? m[2], { throwOnError: true, strict: "ignore", output: "mathml", displayMode: m[1] !== undefined }); }
          catch (e) { err(id, `${where}: KaTeX cannot parse $${(m[1] ?? m[2]).slice(0, 60)}$ – ${String((e as Error).message).slice(0, 140)}`); }
        }
      };
      for (const n of Object.values(ws.nodes)) for (const [w, t] of textsOf(n)) check(n.id, w, t);
      for (const q of Object.values(ws.quiz)) for (const t of [q.prompt, String(q.answer), ...(q.options || [])]) check(q.id, "quiz", String(t));
    }
  }
  if (opts.fix && fixed) for (const p of ws.files.keys()) ws.save(p);
  let E = errors, Wn = warnings;
  if (opts.topic) {
    const d = ws.topics.find(t => t.meta.id === opts.topic);
    const ids = new Set<string>([opts.topic, ...(d ? [...d.nodes, ...d.figures, ...d.applications, ...d.quiz].map((x: any) => x.id) : [])]);
    E = errors.filter(e => ids.has(e.id) || e.msg.includes("cycle")); Wn = warnings.filter(w => ids.has(w.id));
  }
  return { errors: E, warnings: Wn, ws, fixed, counts: { topics: ws.topics.length, nodes: Object.keys(ws.nodes).length, figures: Object.keys(ws.figures).length, applications: Object.keys(ws.apps).length, quiz: Object.keys(ws.quiz).length } };
}
