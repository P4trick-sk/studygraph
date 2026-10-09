# Studygraph data contract (schema v1)

Summary of `src/schema/index.ts` in the studygraph core (the Zod schema is the source of truth; `studygraph validate`
enforces it plus the graph rules).

## Workspace files

| File | Holds |
| --- | --- |
| `content/config.json` | `app {name, courseId, tagline, heroTitle, heroText, copyright}`, `language {primary, alt, ui}`, `courses [{id, title}]`, `nodeTypes [{type, prefix, label, color, rank, reference?, needsProof?, needsTerms?}]`, `proofLabel`, `figureKinds`, `relationTypes`, `linkIgnore`, `applicationColor` |
| `content/registry.json` | `topics [{id, title, course, order, sourceFiles, status: planned/draft/reviewing/checked}]`, `reserved [{id, topic, title}]` |
| `content/topics/<id>.json` | `{schemaVersion: 1, meta, nodes, figures, applications, quiz}` |
| `.sg/demotions.json` | cycle-breaker log written by `studygraph cycles --apply` |
| `dist/knowledge.json` | build output (flat; below) |

App texts in the viewer: menu brand = `app.name`, line under it = `app.tagline`, home title = `app.heroTitle`, lead = `app.heroText`.
Reference types (`reference: true`, rank 4: examples, problems, remarks…) are never prerequisites of other types.

## Topic meta

`id` (ascii slug), `title`, `course` (a `config.courses[].id`), `order`, `sourceFiles`, `summary` (2–4 sentences),
`overview` (narrative), `keyQuestions[]`, `prerequisites[]` (topic ids), `alsoCovers[]` (ids owned by other topics), `status`.

## Node

| Field | Rule |
| --- | --- |
| `id` | `<prefix>.<ascii-slug>`; prefix from the node type; unique in the course |
| `type`, `topic`, `title` | type from config |
| `terms[]` | `{term, alt?, symbol?}`; required when the type has `needsTerms` |
| `aliases[]`, `tags[]` | search |
| `origin` | `slides` (needs `source`), `supplement`, `generated` |
| `source[]` | `{file, page or slide, label?}` |
| `statement` | rich text, faithful to the source |
| `explanation` | `{intuition, detailed, pitfalls[], examples[]}` (strings also accepted) — AI-written, marked as such in the app |
| `proof` | `{origin, status: full/sketch/none, idea?, strategy?, steps[{text, why, uses[]}]}`; required when the type has `needsProof` |
| `uses[]` | strict prerequisites (DAG together with proof-step uses) |
| `relations[]` | `{type, target, note?}`; types: generalizes, specializes, equivalent, implies, converse-of, contrasts-with, algorithm-for, counterexample-to, analogue, see-also (+ preset extras) |
| `figures[]` | figure ids |
| `attribution` | named results ("Cantor") |
| `difficulty`, `importance` | 1–3, kept in data, not displayed |
| `review` | `{status: draft/checked/flagged, notes[], checkedBy?, checkedAt?}` |
| `checks[]` | `{verifier: "expr", expr, expect}` |

## Rich text

Markdown, `$…$` and `$$…$$` (KaTeX, rendered as MathML), and `[visible text](node-id)` links (also `fig.*`, `app.*`).
A link target in a statement must be in the node's `uses` or `relations` (elsewhere a missing one is a warning). Real line breaks, never a literal `\n`;
no LaTeX outside maths; balanced `$`; `\$` for a literal dollar. Markdown tables are allowed in statements and explanations.

## Figure

`{id, kind, title, caption, origin, illustrates[], sources[], …kind body}`

| kind | body |
| --- | --- |
| `graph` | `directed`, `vertices [{id, x, y, label}]`, `edges [{id, source, target, label?, directed?}]`, `animations [{title?, steps [{caption, highlight [ids], edgeLabels {edge: text}}]}]` |
| `table` | `columns [..]`, `rows [[..]]` (cells may hold maths) |
| `plot` | `plot {x [min, max], y [min, max], fns [{expr, label}], points [{x, y, label}], series [{label, points [[x, y]]}]}` |
| `mermaid` | `code` |
| `code` | `language`, `code` |

## Application and quiz

Application: `{id, title, summary, scenario, modelling, solution, connects[] (node ids, any topic), figures[], tags[], origin}`.

Quiz item: `{id, kind: mcq/truefalse/flashcard/open, prompt, options? (mcq), answer (option index / boolean / text),
explanation, about[] (node ids), difficulty, check? {verifier: "expr", expr}}` — the validator recomputes `expr` and
fails when it disagrees with the stated answer.

## Build output `dist/knowledge.json`

`{generatedAt, schemaVersion: 1, config, topics [meta + registry fields], nodes [with topic], figures [with topic],
applications [with topic], quiz [with topic], reserved, pending (= reserved, for older viewers), demotions, stats}`.
The viewer computes reverse edges, learning paths, the search index and mastery itself when the file opens.
