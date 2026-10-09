/** Field presets, colours, relation vocabularies and config resolution (shared by engine and app). */
import type { Config } from "../schema/index.js";

export const CHALK = ["#7cc4e8", "#f0d070", "#e8a86c", "#e3c48e", "#c3d98a", "#95d8bb", "#a5e07c", "#f2a3c3", "#c8a8f0", "#a8b2ad"];
export const APP_COLOR = "#b49cf0";

export interface RelationDef { label: string; inverseLabel: string; strength: number }
/** [type, prefix, rank (null = reference type), label en, label sk, needsProof, needsTerms] */
export type PresetType = [string, string, number | null, string, string, boolean?, boolean?];
export interface Preset { proofLabel: { en: string; sk: string }; figureKinds: string[]; types: PresetType[]; extraRelations?: Record<string, [string, string, number, string, string]> }

export const PRESETS: Record<string, Preset> = {
  math: {
    proofLabel: { en: "Proof", sk: "Dôkaz" }, figureKinds: ["graph", "table", "plot"],
    types: [
      ["definition", "def", 0, "Definition", "Definícia", false, true], ["lemma", "lem", 1, "Lemma", "Lema", true],
      ["proposition", "prop", 1, "Proposition", "Tvrdenie", true], ["fact", "fact", 1, "Fact", "Fakt"],
      ["theorem", "thm", 2, "Theorem", "Veta", true], ["algorithm", "alg", 2, "Algorithm", "Algoritmus"],
      ["corollary", "cor", 3, "Corollary", "Dôsledok", true], ["example", "ex", null, "Example", "Príklad"],
      ["problem", "prob", null, "Problem", "Cvičenie"], ["remark", "rem", null, "Remark", "Poznámka"]],
  },
  "cs-theory": {
    proofLabel: { en: "Correctness & complexity", sk: "Správnosť a zložitosť" }, figureKinds: ["graph", "table", "plot", "code"],
    types: [
      ["concept", "def", 0, "Concept", "Pojem", false, true], ["definition", "dfn", 0, "Definition", "Definícia", false, true],
      ["data-structure", "ds", 1, "Data structure", "Dátová štruktúra", false, true], ["theorem", "thm", 2, "Theorem", "Veta", true],
      ["algorithm", "alg", 2, "Algorithm", "Algoritmus", true], ["complexity", "cx", 2, "Complexity result", "Výsledok o zložitosti", true],
      ["reduction", "red", 3, "Reduction", "Redukcia", true], ["example", "ex", null, "Example", "Príklad"],
      ["problem", "prob", null, "Problem", "Úloha"], ["pitfall", "rem", null, "Pitfall", "Úskalie"]],
    extraRelations: { "reduces-to": ["Reduces to", "Reduced from", 3, "Redukuje sa na", "Redukuje sa z"], implements: ["Implements", "Implemented by", 2, "Implementuje", "Implementované v"], bounds: ["Bounds", "Bounded by", 2, "Ohraničuje", "Ohraničené"] },
  },
  programming: {
    proofLabel: { en: "Why it works", sk: "Prečo to funguje" }, figureKinds: ["code", "mermaid", "table"],
    types: [
      ["concept", "def", 0, "Concept", "Pojem", false, true], ["feature", "feat", 1, "Language feature", "Vlastnosť jazyka"],
      ["api", "api", 1, "API", "API"], ["pattern", "pat", 2, "Pattern", "Vzor"], ["protocol", "proto", 2, "Protocol", "Protokol"],
      ["example", "ex", null, "Code example", "Príklad kódu"], ["pitfall", "rem", null, "Pitfall", "Úskalie"], ["exercise", "prob", null, "Exercise", "Cvičenie"]],
    extraRelations: { implements: ["Implements", "Implemented by", 2, "Implementuje", "Implementované v"], replaces: ["Replaces", "Replaced by", 2, "Nahrádza", "Nahradené"], "depends-on-version": ["Depends on version", "Version needed by", 1, "Závisí od verzie", "Verziu potrebuje"] },
  },
};

const REL: Record<string, [string, string, number, string, string]> = {
  generalizes: ["Generalizes", "Generalized by", 2, "Zovšeobecňuje", "Je zovšeobecnené v"],
  specializes: ["Special case of", "Has special case", 2, "Je špeciálnym prípadom", "Má špeciálny prípad"],
  equivalent: ["Equivalent to", "Equivalent to", 3, "Je ekvivalentné s", "Je ekvivalentné s"],
  implies: ["Implies", "Implied by", 3, "Implikuje", "Vyplýva z"],
  "converse-of": ["Converse of", "Converse of", 2, "Je obrátením", "Je obrátením"],
  "contrasts-with": ["Contrasts with", "Contrasts with", 1, "Porovnaj s", "Porovnaj s"],
  "algorithm-for": ["Algorithm for", "Computed by", 2, "Algoritmus pre", "Počíta sa algoritmom"],
  "counterexample-to": ["Counterexample to", "Has counterexample", 2, "Protipríklad k", "Má protipríklad"],
  analogue: ["Analogue of", "Analogue of", 2, "Analógia", "Analógia"],
  "see-also": ["See also", "Mentioned by", 1, "Pozri aj", "Spomína sa v"],
};
export const BASE_RELATION_TYPES = Object.keys(REL);
export const relationTypesFor = (preset: string): string[] => [...BASE_RELATION_TYPES, ...Object.keys(PRESETS[preset]?.extraRelations || {})];

export interface ResolvedType { id: string; prefix: string; label: string; color: string; rank: number | null; reference: boolean; needsProof: boolean; needsTerms: boolean }
export interface ResolvedApp { name: string; title: string; tagline: string; brand: string; kicker: string; courseId: string; copyright?: string; [k: string]: unknown }
export interface ResolvedConfig {
  raw: Partial<Config>; preset: string;
  app: ResolvedApp;
  language: { primary: string; alt?: string; ui: string };
  courses: Array<{ id: string; title: string }>;
  proofLabel: string; figureKinds: string[]; linkIgnore: string[];
  types: ResolvedType[]; typeById: Record<string, ResolvedType>; typeByPrefix: Record<string, ResolvedType>;
  relations: Record<string, RelationDef>;
}

export const courseIdOf = (name: string) => String(name || "course").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Node types for a preset in config form (what `studygraph init` writes). */
export function presetNodeTypes(preset: string, ui: string) {
  const p = PRESETS[preset] || PRESETS.math;
  return p.types.map(([type, prefix, rank, en, sk, needsProof, needsTerms], i) => ({
    type, prefix, label: ui === "sk" ? sk : en, color: CHALK[i % CHALK.length],
    rank: rank === null ? 4 : rank, ...(rank === null ? { reference: true } : {}),
    ...(needsProof ? { needsProof: true } : {}), ...(needsTerms ? { needsTerms: true } : {}),
  }));
}

export function resolveConfig(cfg: Partial<Config> & Record<string, any> = {} as any): ResolvedConfig {
  const presetName = PRESETS[cfg.preset as string] ? (cfg.preset as string) : "math";
  const preset = PRESETS[presetName];
  const ui = (cfg.language?.ui as string) || "en";
  const sk = ui === "sk";
  let types: ResolvedType[] = preset.types.map(([id, prefix, rank, en, skl, needsProof, needsTerms], i) => ({
    id, prefix, rank, label: sk ? skl : en, needsProof: !!needsProof, needsTerms: !!needsTerms, reference: rank === null, color: CHALK[i % CHALK.length] }));
  if (Array.isArray(cfg.nodeTypes) && cfg.nodeTypes.length) {
    const byId: Record<string, ResolvedType> = Object.fromEntries(types.map(t => [t.id, t]));
    types = cfg.nodeTypes.map((t0: any, i: number) => {
      const id = t0.id || t0.type; const base: Partial<ResolvedType> = byId[id] || {};
      const rank = t0.reference ? null : t0.rank !== undefined ? t0.rank : base.rank ?? null;
      return { ...base, ...t0, id, rank, reference: rank === null || t0.reference === true,
        color: t0.color || base.color || CHALK[i % CHALK.length], label: t0.label || base.label || id, prefix: t0.prefix || base.prefix || id,
        needsProof: !!(t0.needsProof ?? base.needsProof), needsTerms: !!(t0.needsTerms ?? base.needsTerms) } as ResolvedType;
    });
  }
  const relations: Record<string, RelationDef> = {};
  const addRel = (k: string, [en, inv, strength, skl, skinv]: [string, string, number, string, string]) => { relations[k] = sk ? { label: skl, inverseLabel: skinv, strength } : { label: en, inverseLabel: inv, strength }; };
  for (const [k, v] of Object.entries(REL)) addRel(k, v);
  for (const [k, v] of Object.entries(preset.extraRelations || {})) addRel(k, v);
  if (cfg.relationTypes && !Array.isArray(cfg.relationTypes)) Object.assign(relations, cfg.relationTypes);
  else for (const k of (cfg.relationTypes as string[] | undefined) || []) if (!relations[k]) relations[k] = { label: k, inverseLabel: k, strength: 1 };
  const a: Record<string, any> = { ...(cfg.app || {}) };
  const app: ResolvedApp = { ...a,
    title: a.heroTitle || a.title || a.name || "Course",
    tagline: a.heroText || (a.heroTitle ? "" : a.tagline) || "",
    brand: a.heroTitle ? a.name : a.title || a.name || "Course",
    kicker: a.heroTitle ? a.tagline || "" : a.name || "Studygraph",
    name: a.name || "Studygraph",
    courseId: a.courseId || courseIdOf(a.name),
  };
  return {
    raw: cfg, preset: presetName, app,
    language: { primary: "en", ui: "en", ...(cfg.language || {}) } as ResolvedConfig["language"],
    courses: (cfg.courses as any) || [],
    proofLabel: (cfg.proofLabel as string) || preset.proofLabel[sk ? "sk" : "en"],
    figureKinds: (cfg.figureKinds as string[]) || preset.figureKinds,
    linkIgnore: (cfg.linkIgnore as string[]) || [],
    types, typeById: Object.fromEntries(types.map(t => [t.id, t])), typeByPrefix: Object.fromEntries(types.map(t => [t.prefix, t])),
    relations,
  };
}
