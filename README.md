# studygraph

The core of Studygraph: the schema, the engine, the command line and the study app for interlinked knowledge-graph
courses (definitions, theorems, proofs, algorithms, examples, figures, applications, quizzes).

**One core, many apps.** Every course lives in its own repository that contains only `content/` and depends on this
package. `studygraph build` turns that content into a static site; a newer core reaches every course with
`studygraph upgrade`. Nothing but the content differs between apps.

```
studygraph (this repo)                 course repo (one per subject, from `studygraph init`)
├─ src/schema   Zod schema = contract   ├─ content/config.json      name, languages, node types
├─ src/core     shared logic            ├─ content/registry.json    topics, reserved ids
├─ src/engine   validate, build, …      ├─ content/topics/*.json    the knowledge
├─ src/app      the study app (TS)      ├─ sources/                 materials
├─ src/cli.ts   studygraph command      ├─ package.json             "studygraph": "github:…#semver:^1.0.0"
├─ template/    new course repo files   └─ .github/workflows        deploy (Pages) + weekly upgrade PR
└─ demo/        sample course                     │  npx studygraph build
                                                  ▼
                                        dist/index.html + dist/knowledge.json  → any static host
```

## Make a new course app

```bash
npx --yes github:P4trick-sk/studygraph init my-course --name "Temno" --title "Matematika nekonečna" \
    --kicker "TEÓRIA MNOŽÍN A LOGIKA" --lang sk --alt en --course "A:Teória množín"
cd my-course && git init && npm install
# put materials in sources/, write content/ (by hand or with the studygraph-course-builder skill)
npx studygraph ingest && npx studygraph validate
npm run serve                              # http://localhost:8000
git add . && git commit -m "First topics" && git push   # GitHub Pages workflow publishes it
```
Existing builds become course repos with `npx studygraph import knowledge.json my-course`.

## Commands

| Command | Does |
| --- | --- |
| `init <dir> --name --title [--kicker --lead --preset --lang --alt --ui --course ID:Title --figures --core SPEC]` | new course repo from `template/` |
| `ingest [dir] [files] [--images]` | per-page text from PDF, PPTX, DOCX, Markdown into `sources/text/`, garbled-maths pages flagged |
| `validate [dir] [--topic ID] [--fix] [--json] [--no-katex]` | Zod schema + graph rules + KaTeX parse + computed checks |
| `links [dir] [--topic ID] [--max N]`, `links --reject node:target` | unlinked mentions (suggestions only) |
| `cycles [dir] [--apply]` | break prerequisite cycles, log demotions |
| `build [dir] [--single] [--viewer] [--out DIR] [--allow-errors] [--allow-open]` | the static app (below) |
| `serve [dir] [--port N] [--build]` | local web server for `dist/` |
| `review apply <patch.json> [dir]` | fold a review patch exported from the app into the content |
| `import <knowledge.json> <dir>` | flat course file (Temno, Diskrétka, any build) → course repo |
| `migrate [dir] [--dry-run]` | apply content migrations for this core's schema version |
| `upgrade [dir] [--check] [--to X.Y.Z\|latest] [--dry-run]` | move a course repo to a newer core, migrate, rebuild |

## Build outputs

| Flag | Output | Use |
| --- | --- | --- |
| (none) | `dist/index.html` + `dist/knowledge.json` + `.nojekyll` | public site on GitHub Pages, Netlify, any static host; needs http (use `serve` locally) |
| `--single` | one `dist/index.html` with the course inside | opens from disk; publish as one file (also as a claude.ai artifact) |
| `--viewer` | the viewer: opens any course file, the course is its sample | the "open your own file" app |

Standalone builds hide "Open a course file"; add `--allow-open` to keep it. The page records the core version
(`<meta name="generator">`, footer).

## Upgrading course apps

Releases of this repo are git tags `vX.Y.Z` (semver). A course pins a range, e.g. `#semver:^1.0.0`.

- `npx studygraph upgrade --check` lists the newest tag.
- `npx studygraph upgrade` rewrites the pin, reinstalls, then runs the **new** core's `migrate` (content changes
  between schema versions, see `src/engine/migrate.ts`) and `build`. Commit the result.
- The course's `.github/workflows/upgrade.yml` runs this every Monday and opens a pull request.
- Patch and minor releases never change the schema; a schema change is a major release with a migration.

Release checklist: update `CHANGELOG.md`, bump `version` in `package.json`, `npm run build && npm test`,
commit, `git tag vX.Y.Z && git push --tags`.

## Develop

```bash
npm install            # also builds lib/ (prepare)
npm run typecheck      # engine/core/schema strict; app with relaxed null checks
npm test               # node:test unit tests on the sample course
npm run demo           # dist-demo/index.html: the viewer with the sample course
python3 test/smoke.py  # Playwright run over every view (pip install playwright; python3 -m playwright install chromium)
```
The app is TypeScript in `src/app/` bundled by esbuild into `lib/app/app.js`; the page template is
`app-template/index.html`. marked, KaTeX and Cytoscape load from cdnjs at runtime.

## Content with Claude

`skill/studygraph-course-builder` is a Claude skill that turns course materials into `content/` and runs these
commands. Zip the folder and add it as a skill.
