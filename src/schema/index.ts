/**
 * Studygraph schema v1 — the single source of truth for course data.
 * Every other part (engine, CLI, app) uses these types; the validator parses with these schemas first.
 */
import { z } from "zod";

export const SCHEMA_VERSION = 1;
export const ID = /^[a-z][a-z0-9]*\.[a-z0-9][a-z0-9-]*$/;

const richText = z.string();
const textOrList = z.union([z.string(), z.array(z.string())]);

export const SourceRef = z.object({
  file: z.string(),
  page: z.union([z.number(), z.string()]).optional(),
  slide: z.union([z.number(), z.string()]).optional(),
  label: z.string().optional(),
}).passthrough();

export const Term = z.object({ term: z.string(), alt: z.string().optional(), symbol: z.string().optional() }).passthrough();
export const Relation = z.object({ type: z.string(), target: z.string(), note: z.string().optional() }).passthrough();
export const Review = z.object({
  status: z.enum(["draft", "checked", "flagged"]).default("draft"),
  notes: z.array(z.union([z.string(), z.object({ text: z.string() }).passthrough()])).default([]),
  checkedBy: z.string().optional(),
  checkedAt: z.string().optional(),
}).passthrough();
export const ProofStep = z.object({ text: richText, why: richText.default(""), uses: z.array(z.string()).default([]) }).passthrough();
export const Proof = z.object({
  origin: z.enum(["slides", "supplement", "generated"]).default("slides"),
  status: z.enum(["full", "sketch", "none"]).default("full"),
  idea: richText.optional(),
  strategy: richText.optional(),
  steps: z.array(ProofStep).default([]),
}).passthrough();
export const Explanation = z.object({
  intuition: textOrList.default(""), detailed: textOrList.default(""),
  pitfalls: textOrList.default([]), examples: textOrList.default([]),
}).passthrough();
export const Check = z.object({ verifier: z.string(), expr: z.string().optional(), expect: z.unknown().optional() }).passthrough();

export const Node = z.object({
  id: z.string(),
  type: z.string(),
  topic: z.string().optional(),
  title: z.string(),
  terms: z.array(Term).default([]),
  aliases: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  origin: z.enum(["slides", "supplement", "generated"]),
  source: z.array(SourceRef).optional(),
  statement: richText,
  explanation: Explanation.optional(),
  proof: Proof.optional(),
  uses: z.array(z.string()).default([]),
  relations: z.array(Relation).default([]),
  figures: z.array(z.string()).default([]),
  attribution: z.string().optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
  importance: z.number().int().min(1).max(3).optional(),
  review: Review.default({ status: "draft", notes: [] }),
  checks: z.array(Check).optional(),
}).passthrough();

const Vertex = z.object({ id: z.string(), x: z.number(), y: z.number(), label: z.string().optional() }).passthrough();
const Edge = z.object({ id: z.string(), source: z.string(), target: z.string(), label: z.string().optional(), directed: z.boolean().optional() }).passthrough();
const AnimStep = z.object({
  caption: richText,
  highlight: z.array(z.string()).optional(),
  highlightVertices: z.array(z.string()).optional(),
  highlightEdges: z.array(z.string()).optional(),
  dimEdges: z.array(z.string()).optional(),
  edgeLabels: z.record(z.string()).optional(),
}).passthrough();
const Range = z.union([z.tuple([z.number(), z.number()]), z.object({ min: z.number(), max: z.number(), label: z.string().optional() }).passthrough()]);

const FigureBase = {
  id: z.string(), title: z.string(), caption: richText.default(""),
  origin: z.enum(["slides", "supplement", "generated"]).default("generated"),
  illustrates: z.array(z.string()).default([]), sources: z.array(SourceRef).default([]),
  topic: z.string().optional(),
};
export const Figure = z.discriminatedUnion("kind", [
  z.object({ ...FigureBase, kind: z.literal("graph"), directed: z.boolean().default(false), vertices: z.array(Vertex), edges: z.array(Edge).default([]),
    animations: z.array(z.object({ title: z.string().optional(), steps: z.array(AnimStep) }).passthrough()).default([]) }).passthrough(),
  z.object({ ...FigureBase, kind: z.literal("table"), columns: z.array(z.string()), rows: z.array(z.array(z.union([z.string(), z.number()]))) }).passthrough(),
  z.object({ ...FigureBase, kind: z.literal("plot"), plot: z.object({
    x: Range, y: Range,
    fns: z.array(z.object({ expr: z.string(), label: z.string().optional() }).passthrough()).default([]),
    points: z.array(z.union([z.object({ x: z.number(), y: z.number(), label: z.string().optional() }).passthrough(), z.tuple([z.number(), z.number()])])).default([]),
    series: z.array(z.object({ label: z.string().optional(), color: z.string().optional(), points: z.array(z.tuple([z.number(), z.number()])) }).passthrough()).default([]),
  }).passthrough() }).passthrough(),
  z.object({ ...FigureBase, kind: z.literal("mermaid"), code: z.string() }).passthrough(),
  z.object({ ...FigureBase, kind: z.literal("code"), language: z.string().default("plaintext"), code: z.string() }).passthrough(),
]);

export const Application = z.object({
  id: z.string(), title: z.string(), summary: richText.default(""), scenario: richText.default(""),
  modelling: richText.default(""), solution: richText.default(""), connects: z.array(z.string()).default([]),
  figures: z.array(z.string()).default([]), tags: z.array(z.string()).default([]),
  origin: z.enum(["slides", "supplement", "generated"]).default("generated"), topic: z.string().optional(),
}).passthrough();

export const QuizItem = z.object({
  id: z.string(),
  kind: z.enum(["mcq", "truefalse", "flashcard", "open"]),
  prompt: richText,
  options: z.array(z.string()).optional(),
  answer: z.union([z.number(), z.boolean(), z.string()]),
  explanation: richText.default(""),
  about: z.array(z.string()).default([]),
  difficulty: z.number().int().min(1).max(3).default(1),
  check: Check.optional(),
  topic: z.string().optional(),
}).passthrough();

export const TopicMeta = z.object({
  id: z.string(), title: z.string(), course: z.string().default("A"), order: z.number().default(99),
  sourceFiles: z.array(z.string()).default([]), summary: richText.default(""), overview: richText.default(""),
  keyQuestions: z.array(z.string()).default([]), prerequisites: z.array(z.string()).default([]),
  alsoCovers: z.array(z.string()).default([]),
  status: z.enum(["planned", "draft", "reviewing", "checked"]).default("draft"),
}).passthrough();

export const TopicFile = z.object({
  schemaVersion: z.number().default(SCHEMA_VERSION),
  meta: TopicMeta,
  nodes: z.array(Node).default([]),
  figures: z.array(Figure).default([]),
  applications: z.array(Application).default([]),
  quiz: z.array(QuizItem).default([]),
}).passthrough();

export const NodeType = z.object({
  type: z.string(), prefix: z.string(), label: z.string(), color: z.string().optional(),
  rank: z.number().optional(), reference: z.boolean().optional(),
  needsProof: z.boolean().optional(), needsTerms: z.boolean().optional(),
}).passthrough();

export const Config = z.object({
  schemaVersion: z.number().default(SCHEMA_VERSION),
  engine: z.string().optional(),
  preset: z.string().default("math"),
  app: z.object({
    name: z.string(), courseId: z.string().optional(), tagline: z.string().optional(), heroTitle: z.string().optional(),
    heroText: z.string().optional(), copyright: z.string().optional(), title: z.string().optional(),
  }).passthrough(),
  language: z.object({ primary: z.string().default("en"), alt: z.string().optional(), ui: z.string().default("en") }).passthrough().default({ primary: "en", ui: "en" }),
  courses: z.array(z.object({ id: z.string(), title: z.string() }).passthrough()).default([]),
  nodeTypes: z.array(NodeType).default([]),
  applicationColor: z.string().optional(),
  proofLabel: z.string().optional(),
  figureKinds: z.array(z.string()).default(["graph", "table", "plot"]),
  relationTypes: z.array(z.string()).optional(),
  linkIgnore: z.array(z.string()).default([]),
}).passthrough();

export const Reserved = z.object({ id: z.string(), topic: z.string().optional(), title: z.string().optional() }).passthrough();
export const Registry = z.object({
  schemaVersion: z.number().default(SCHEMA_VERSION),
  topics: z.array(z.object({ id: z.string(), title: z.string(), course: z.string().optional(), order: z.number().optional(),
    sourceFiles: z.array(z.string()).optional(), status: z.string().optional() }).passthrough()).default([]),
  reserved: z.array(Reserved).default([]),
}).passthrough();

export const Demotion = z.object({ source: z.string(), target: z.string(), reason: z.string().optional() }).passthrough();

/** Flat course file produced by `studygraph build` (and by Temno/Diskrétka builds). */
export const CourseFile = z.object({
  generatedAt: z.string().optional(),
  schemaVersion: z.number().default(SCHEMA_VERSION),
  engine: z.string().optional(),
  config: Config.optional(),
  topics: z.array(TopicMeta),
  nodes: z.array(Node),
  figures: z.array(z.any()).default([]),
  applications: z.array(Application).default([]),
  quiz: z.array(QuizItem).default([]),
  reserved: z.array(Reserved).default([]),
  demotions: z.array(Demotion).default([]),
  stats: z.record(z.unknown()).optional(),
}).passthrough();

export const ReviewPatch = z.object({
  schemaVersion: z.number().default(SCHEMA_VERSION),
  reviewer: z.string(), date: z.string(),
  items: z.array(z.object({ id: z.string(), verdict: z.enum(["checked", "flagged", "edit"]), comment: z.string().optional(),
    path: z.string().optional(), value: z.unknown().optional() }).passthrough()),
}).passthrough();

export type SourceRef = z.infer<typeof SourceRef>;
export type Term = z.infer<typeof Term>;
export type Relation = z.infer<typeof Relation>;
export type Proof = z.infer<typeof Proof>;
export type ProofStep = z.infer<typeof ProofStep>;
export type Node = z.infer<typeof Node>;
export type Figure = z.infer<typeof Figure>;
export type Application = z.infer<typeof Application>;
export type QuizItem = z.infer<typeof QuizItem>;
export type TopicMeta = z.infer<typeof TopicMeta>;
export type TopicFile = z.infer<typeof TopicFile>;
export type NodeType = z.infer<typeof NodeType>;
export type Config = z.infer<typeof Config>;
export type Registry = z.infer<typeof Registry>;
export type Reserved = z.infer<typeof Reserved>;
export type Demotion = z.infer<typeof Demotion>;
export type CourseFile = z.infer<typeof CourseFile>;
export type ReviewPatch = z.infer<typeof ReviewPatch>;

/** The course as the app and the engine work with it: config + registry + topic files. */
export interface CourseBundle {
  schemaVersion?: number;
  embedded?: boolean;
  config: Partial<Config> & Record<string, unknown>;
  registry: { topics: Array<Record<string, any>>; reserved: Reserved[] };
  topics: TopicFile[];
  demotions?: Demotion[];
  warnings?: string[];
}
