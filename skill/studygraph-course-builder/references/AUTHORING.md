# Authoring guide – turning course sources into topic JSON

Contract: `references/SCHEMA.md` (this skill). Field settings (node types, prefixes, figure kinds, language): `content/config.json`.
Topics and reserved cross-topic IDs: `content/registry.json`. Your task: `docs/tasks/<topic>.md`. Outline: `docs/outlines/<topic>.md`.
Output: exactly one file `content/topics/<topic>.json`. Generate it with a Python script in `.sg/scratch/<topic>/gen.py` using `scripts/sglib.py` (Topic, T, E, step); never hand-type JSON.

## 1. Read the sources faithfully
- Read the source file(s) named in the task (the extracted pages in `sources/text/<file>/pNNN.txt`; pages listed under `mathFlagged` in `sources/text/index.json` lost their formulas).
  Slides/pages are separated by blank lines or form feeds; use the page number of the `pNNN.txt` file for `source[].page` (or `slide` for slide decks).
- PDF text garbles math: sub/superscripts fall onto separate lines, binomials and big operators lose their structure,
  `̸=` means `\neq`, `∼=` means `\cong`, `□` ends a proof. Rebuild clean LaTeX. When unsure, write the best reconstruction AND a concrete
  `review.notes` entry. Never silently invent content. If a statement on the slides is wrong (missing hypothesis, typo, false as written),
  correct it in `statement` and record the original + reason in `review.notes`.
- In the generator use raw strings: `r"$\deg_G(x)$"`. Never put a literal backslash-n into text; use real line breaks.
- Language: everything in `config.language.primary`; `terms[].alt` holds the term in `config.language.alt` (e.g. the [English] term on the slides).

## 2. Nodes
One node per concept a learner might want to link to. Types/prefixes come from `config.nodeTypes` (e.g. `def.`, `thm.`, `alg.`, `ex.`).
IDs: `<prefix>.<ascii-slug>`, lowercase, hyphenated, globally unique, descriptive (`thm.whitney-2-connectivity`, not `thm.theorem3`).
Every reserved ID that `registry.json` assigns to your topic MUST exist with exactly that ID.

Fields:
- `origin`: `slides` (in the sources, needs `source`), `supplement` (needed for understanding but missing from the sources – write a correct
  standard version), `generated` (AI-written example/remark).
- `statement`: faithful to the source. Link every concept the FIRST time it appears: `[visible text](node-id)`; the visible text may be any
  inflected form – the target ID is what counts. This is how "every theorem links the definitions it uses" works.
- `explanation` (generated, the heart of the app – be genuinely helpful):
  `intuition` (1–3 sentences, the "aha"), `detailed` (for every non-trivial node: how to read it, why it is shaped this way, how hypotheses
  are used; several paragraphs for central results), `pitfalls` (typical mistakes, why each hypothesis is needed, counterexamples),
  `examples` (small worked examples).
- `proof` (required for types with `needsProof`; label in the UI = `config.proofLabel`, e.g. "Proof", "Derivation", "Correctness"):
  sources contain it → `origin: "slides"`, `status: "full" | "sketch"`, split into `steps`; each step: `text` (faithful), `why` (generated
  explanation why it holds), `uses` (nodes it relies on). Not in sources → `origin: "generated"`, `status: "none"`, no steps, an `idea` (2–5 sentences).
- **Prerequisites vs. references.** `uses` lists only what must be understood BEFORE this node. A link to a later or related result
  (a definition mentioning theorems that use it, a theorem mentioning its corollaries or examples) is a reference: put it in `relations`
  (e.g. `see-also`), not in `uses`. Types marked `reference` in config (examples, remarks, problems) are never prerequisites.
  Every inline link in a statement must be in `uses` or `relations` (`sglib` and `studygraph validate --fix` add missing ones to `relations` as see-also — move real prerequisites to `uses`).
  Cross-topic prerequisites use reserved IDs. If a needed concept of another topic is not reserved, do NOT invent an ID for that topic –
  write it as plain text and report it under "unresolved links".
- `relations`: `generalizes`, `specializes`, `equivalent`, `implies`, `converse-of`, `contrasts-with`, `algorithm-for`, `counterexample-to`,
  `analogue`, `see-also` (+ optional `note`). Add the ones that make connections between topics visible.
- `difficulty` 1–3, `importance` 1–3 (3 = central result; kept in data, not shown in the app), `tags`, `review.status: "draft"` + notes for every uncertainty.

## 3. Figures (data, not images)
Enabled kinds: `config.figureKinds`.
- `graph` (`figure_graph`): vertices `{id,label?,x,y}` (any scale, y downwards; keep vertices at least ~1/8 of the width apart), edges `{id,source,target,label?,directed?}`; multi-edges = separate edges, loops = source equals target.
- `code` (`figure_code`): `language` + `code`.
- `mermaid` (`figure_mermaid`): `code` (flowchart, state diagram, sequence, class diagram…).
- `plot` (`figure_plot`): `x:[a,b], y:[c,d], fns:[{expr:"x^2", label}], points:[{x,y,label}]`, or `series:[{label, points:[[x,y],…]}]`; expressions use x, ^, sin, cos, tan, exp, log, sqrt, abs, PI.
- `table`: `columns` + `rows` (cells may contain math).
`animations[] = {title?, steps: [{caption, highlight: [vertex and edge ids], edgeLabels?: {edgeId: text}}]}` (the viewer also accepts `highlightVertices`, `highlightEdges`, `dimEdges`) – use them to walk through
algorithms and proofs step by step. Verify every figure with a small script (edges exist, colourings proper, counts right, drawings
crossing-free when claimed). Mark reconstructions of pictures you could not see with `origin: "generated"` and a review note.

## 4. Applications (real world)
3–6 per topic: `scenario` (the real problem) → `modelling` (what becomes which object) → `solution` (which results/algorithms solve it and why)
→ `connects` (ALL involved node IDs, also across topics). Facts about industry/history must be correct and not overstated.

## 5. Quiz
8–15 per topic, mixed `mcq` (answer = option index) / `truefalse` (boolean) / `flashcard` / `open`, each with `explanation` and `about`.
Include "state it", "find the counterexample", "which hypothesis is necessary", "compute …". Check every answer.

## 6. Topic meta
`summary` (2–4 sentences), `overview` (narrative introduction: motivation, storyline, connections to other topics), `keyQuestions`,
`prerequisites` (topic IDs), `alsoCovers` (IDs owned by other topics that these sources restate), `status: "draft"`, `course` = a
`config.courses[].id`.

## 6a. Results restated in a later lecture
Do not duplicate a node another topic owns: link it and add it to `meta.alsoCovers`. If your sources contain its proof and the owning node
has `proof.status: "none"`, and your task names that file as editable, replace its proof with yours (`origin: "slides"`), append your
source, add a review note – touching only that node. A new variant (edge version, weighted version, …) becomes a new node with a
`generalizes`/`specializes`/`analogue` relation.

## 7. Validate
`npx studygraph validate --topic <id>` (inside the course repo) until 0 errors, then the full validator, and make sure no dependency cycle
involves your nodes. Warnings about reserved IDs of topics not written yet are fine. Never edit files you were not allowed to edit.

## 8. Final report (return to the orchestrator)
Counts (nodes by type, figures, applications, quiz) and validator result; unresolved links; requested registry reservations (IDs other
topics will need); review notes worth a human look; questions for the lecturer.
