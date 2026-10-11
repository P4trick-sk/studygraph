---
name: studygraph-course-builder
description: Turn course materials for any math or IT subject (PDF lecture notes, slides, books, Markdown notes) into a Studygraph course repo — validated, interlinked content (definitions, theorems, proofs, algorithms, examples, figures, applications, quiz questions) that the studygraph core builds into a standalone study app. Use whenever the user gives subject materials and wants a Studygraph course, a knowledge.json, a study app or website for a subject, or wants to extend, re-check or rebuild an existing course (Temno, Diskrétka).
---

# Studygraph course builder

A course is a repo that holds only `content/`; the `studygraph` core (TypeScript: schema, CLI, app) does everything
mechanical. Your work is reading the sources faithfully and writing good topic content. Deliverables: the course repo
(zip), `dist/knowledge.json`, and the built app (`dist/` site, or one file with `--single` to publish as an artifact).

Read first: `references/SCHEMA.md` (data contract) and `references/AUTHORING.md` (content rules — every extraction
prompt points to it). `K` = this skill's directory.

## 0. Get the core

The CLI is `npx studygraph …` inside a course repo (after `npm install`). In a fresh sandbox:
`npm install -g github:P4trick-sk/studygraph` (private repo: needs GitHub access; otherwise use the core zip the user
uploads: unzip, then `npm install && npm install -g .` in it). Check with `studygraph version`. Course repos created here use
`--core file:<path to core>` so they work offline; tell the user to change the pin in `package.json` to
`github:P4trick-sk/studygraph#semver:^1.0.0` afterwards (the `init` default without `--core`).

## 1. Ask (one ask_user_input call, at most 3 questions) after skimming 1–2 source files

1. **Preset** → `math` (definition, lemma, proposition, fact, theorem, algorithm, corollary, example, problem, remark),
   `cs-theory` (concept, definition, data structure, theorem, algorithm, complexity result, reduction, example, problem,
   pitfall) or `programming` (concept, language feature, API, pattern, protocol, code example, pitfall, exercise).
2. **Figures** (multi-select): graph, table, plot, mermaid, code.
3. **Language**: content language (default: the sources'), alternative-term language, interface (`sk` or `en`).

Never ask about stack, design, features or outputs. Derive name, title, kicker, lead, course grouping and topic order
from the sources and state the choices at the end.

## 2. Create the repo and ingest

```bash
studygraph init <course> --name "<short name>" --title "<home title>" --kicker "<SUBJECT>" --lead "<1–2 sentences>" \
  --preset math --lang sk --alt en --ui sk --course "A:<course title>" --figures graph,table,plot --core file:<core>
cd <course> && npm install --no-audit --no-fund
cp <materials> sources/ && npx studygraph ingest [--images]
```
`ingest` needs `pdftotext` (poppler-utils) for PDFs and `unzip` for PPTX/DOCX. Pages listed under `mathFlagged` in
`sources/text/index.json` lost their formulas: reconstruct LaTeX (look at the `--images` renders) and add review notes.
Extending an existing course: `studygraph import knowledge.json <course>` instead of `init`.

## 3. Inventory — human checkpoint

- One topic per lecture or chapter (15–60 items). For each write `docs/outlines/<topic>.md`: title, one line per item
  `TYPE | title [alt term] | note | page` (+ `[proof]`), then `USES (defined elsewhere)`. Outline sub-agents, one per
  ~4 source files, for large material.
- `content/registry.json`: `topics` (id = short ascii slug, title, course, order, sourceFiles, status "planned") and
  `reserved` = canonical ids `{id, topic, title}` for the 5–12 central concepts per topic other topics will link to.
  Notions the sources assume but never define go to the first topic as `supplement` nodes; reserve them too.
- `docs/tasks/<topic>.md`: source pages, output file, editable files, figures, application ideas, quiz size.
- **Show the user the topic list and reserved ids and get a yes before extraction.**

## 4. Extraction — one topic per agent, batches of about 4

Each topic comes from a Python generator using `K/scripts/sglib.py` (`Topic`, `T`, `E`, `step`; never hand-type
JSON): `.sg/scratch/<topic>/gen.py` → `Topic(...).node(...)… .write("content")`, then
`npx studygraph validate --topic <topic>` until 0 errors.

Extraction prompt (verbatim, filled in): "Convert the <language> <field> material for topic <id> into Studygraph JSON.
Course repo: <path>. Read first: docs/tasks/<id>.md, <K>/references/AUTHORING.md (rules — follow exactly),
<K>/references/SCHEMA.md, content/config.json, content/registry.json (create every reserved id your topic owns; link
other topics only through reserved ids), docs/outlines/<id>.md, and the pages in sources/text/. Quality reference:
content/topics/<best finished topic>.json. Write the generator in .sg/scratch/<id>/gen.py with <K>/scripts/sglib.py,
run it, then `npx studygraph validate --topic <id>` until 0 errors for your nodes. Edit only your own files. Return the
AUTHORING §8 report and questions for the lecturer."

After each batch: reserve the ids agents asked for (only existing ones), set finished topics to `draft`, run
`npx studygraph cycles --apply` and the full `npx studygraph validate`, append questions to `docs/QUESTIONS.md`.
Without sub-agents do the topics yourself, one after another, the same way.

## 5. Consolidation and review

```bash
npx studygraph links            # unlinked mentions; generic targets filtered and listed
npx studygraph cycles --apply
npx studygraph validate --fix   # safe fixes only
```
Link pass: wrap real mentions as `[visible text](id)` and add the id to `uses` (prerequisite) or `relations`; reject
false positives with `npx studygraph links --reject node:target`; add 20–40 cross-topic relations with specific types
(generalizes, analogue, contrasts-with, equivalent…); `config.linkIgnore` for the 1–3 most generic notions.
Review (reviewer agents or you, per topic): coverage of every source item, fidelity (hypotheses, indices, LaTeX),
corrections recorded in `review.notes`, all quiz answers checked (`check: {verifier: "expr", expr}` for numbers),
figures verified by script. Leave `review.status` as `draft`; the human check in the app's review mode sets `checked`
(`npx studygraph review apply <patch.json>` folds the exported patch in).

## 6. Build and deliver

```bash
npx studygraph build            # dist/index.html + dist/knowledge.json (static site)
npx studygraph build --single --out dist-single   # one file with the course inside
```
- Zip the course repo (without `node_modules`, `dist`) and present it, plus `dist/knowledge.json`.
- To put the app online now: publish `dist-single/index.html` with the Artifact tool (16 MB limit; Temno with 1025
  nodes is about 4.4 MB), capabilities `{"sample": {}, "downloads": true, "db": {}, "user": {}}` for tutor, exports and
  sync. For a public site the user pushes the repo to GitHub; its Pages workflow deploys `dist/`.
- Optional check before publishing: open the page with Playwright, routing cdnjs to npm copies of marked@4.3.0,
  katex@0.16.9 and cytoscape@3.30.2 (the sandbox browser cannot reach the CDN); a multi-file build needs
  `npx studygraph serve`.
- Final message: counts (from the build), choices made (name, grouping, preset), that the content is AI-checked but
  not human-checked, where the open questions are. Short.

## Resuming

State lives in the files: `ls content/topics`, registry statuses, `.sg/scratch/<topic>/gen.py`. Redo only topics whose
file is missing or fails validation; reuse partial generators.

## Hard-won rules

- PDF text garbles formulas → reconstruct LaTeX, add a `review.notes` entry for every uncertain spot, correct real
  source errors and record the original.
- Inflected languages break term matching → links stay explicit `[any form](id)`; `links` only suggests.
- `uses` = prerequisites only; back-references go to `relations`; reference types are never prerequisites of other
  types; cycles are errors and `cycles --apply` logs every demotion — check them.
- No duplicates across lectures: restated results go to `meta.alsoCovers` (AUTHORING §6a).
- Never write JSON by hand; no literal `\n`, no LaTeX outside `$…$`, balanced `$`; `\tag` only inside `$$…$$`.
- Agents edit only their own files and scratch folder; batches of about 4 agents.
- Verify figures and quiz answers by computation. Split long statements into paragraphs.
