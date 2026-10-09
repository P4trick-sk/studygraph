# {{NAME}}

{{TITLE}} — a [Studygraph](https://github.com/OWNER/studygraph) course. This repository holds only the course
content (`content/`); the app, the tooling and the schema come from the `studygraph` core pinned in `package.json`.

## Use

```bash
npm install            # installs the pinned studygraph core
npm run serve          # validate, build and open http://localhost:8000
npm run build          # dist/index.html + dist/knowledge.json: upload dist/ to any static host
npm run build:single   # one self-contained dist/index.html (opens from disk, publishable as one file)
```

Pushing to `main` publishes the site through GitHub Pages (`.github/workflows/deploy.yml`; enable Pages with
"GitHub Actions" as the source in the repository settings).

## Edit the content

| Path | What |
| --- | --- |
| `content/config.json` | name, texts, languages, node types, figure kinds |
| `content/registry.json` | topics in order and reserved cross-topic ids |
| `content/topics/*.json` | one file per topic |
| `sources/` | the materials the content was made from |
| `docs/QUESTIONS.md` | open questions for the lecturer |

`npx studygraph validate` must pass before a build. With Claude, the `studygraph-course-builder` skill writes and
checks the content for you.

## Upgrade to a newer core

```bash
npm run upgrade:check   # is a newer studygraph release available?
npm run upgrade         # move to it, migrate the content if the schema changed, rebuild
```
`.github/workflows/upgrade.yml` does this every Monday and opens a pull request when something changed.
Built with studygraph {{ENGINE}}.
