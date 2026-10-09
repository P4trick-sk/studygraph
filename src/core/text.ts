/** Text helpers shared by search, validation and the app. */
export const LINK = /\[([^\]]+)\]\(([a-z][a-z0-9]*\.[A-Za-z0-9][\w-]*)\)/g;
export const normalize = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const stripMarkup = (s: unknown) => String(s ?? "")
  .replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, " ")
  .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`#>]/g, "");
export const tokenize = (s: unknown) => normalize(stripMarkup(s)).split(/[^a-z0-9\u0400-\u04ff]+/).filter(t => t.length > 1);
/** "$\mathcal{P}(\mathbb{N})$ is uncountable" → "P(N) is uncountable" */
export const mathless = (t: unknown) => String(t ?? "").replace(/\$([^$]*)\$/g, (_, m: string) => m.replace(/\\math[a-z]+\{([^}]*)\}/g, "$1").replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, ""));

/** All rich-text fields of a node with their paths. */
export function textsOf(n: any): Array<[string, string]> {
  const out: Array<[string, string]> = [["statement", n.statement || ""]];
  for (const [k, v] of Object.entries(n.explanation || {})) (Array.isArray(v) ? v : [v]).forEach(t => out.push([`explanation.${k}`, String(t ?? "")]));
  const p = n.proof || {};
  for (const k of ["idea", "strategy"]) if (p[k]) out.push([`proof.${k}`, p[k]]);
  (p.steps || []).forEach((s: any, i: number) => { out.push([`proof.steps[${i}].text`, s.text || ""]); if (s.why) out.push([`proof.steps[${i}].why`, s.why]); });
  return out.filter(([, t]) => t);
}

/** Restricted arithmetic for `expr` checks: digits, + - * / % ( ) and **. */
export function evalExpr(e: string): number {
  if (!/^[\d\s+\-*/().%]+$/.test(e)) throw new Error("expr may only use digits and + - * / % ( ) **");
  return Function(`"use strict";return (${e})`)() as number;
}
export const numberIn = (s: unknown) => Number(String(s).replace(/\$/g, "").replace(",", ".").trim());
