# Changelog

All releases are git tags `vX.Y.Z`. Course repos pin a semver range and upgrade with `studygraph upgrade`.

## 1.1.0 — 2026-10-11

Item page and learning path layout; no schema change.
- Item page is split into sections with dividers: statement, explanation, proof, figures, connections, study, footer.
  Study it and Learn with AI are side-by-side cards above the learning path.
- Builds on / Used in / Related are tabs with counts (arrow keys switch tabs). Each shows 12 items in a responsive
  grid with a button that loads the next 12; lists of up to 4 items use one full-width column. Only item names are
  shown (no relation notes or topic names), and Used in lists same-topic items first.
- Learning path on the item page is a fixed-size card: mastered count, the next 5 items not mastered yet and links to
  study or open the full path. The path page groups items into collapsible topics with per-topic progress.

## 1.0.2 — 2026-10-11

- `init` pins `github:P4trick-sk/studygraph` instead of the `OWNER` placeholder; the course README template links
  the core repo. The replace-`OWNER` hint is gone from the CLI and README, and the course-builder skill installs from
  `github:P4trick-sk/studygraph`.
- GitHub Pages workflow that builds and deploys the demo course.

## 1.0.1 — 2026-10-09

- Release used to test `studygraph upgrade` end to end; no schema change.

## 1.0.0 — 2026-10-09

First release of the TypeScript core.
- Schema v1 as Zod schemas (`src/schema`), shared by engine, CLI and app.
- Engine and CLI: init, ingest, validate (schema, graph rules, KaTeX, computed checks), links, cycles, build
  (standalone site, single file, viewer), serve, review apply, import, migrate, upgrade.
- Study app ported to TypeScript modules: Temno layout, previews on hover and tap, search, concept map with lecture
  filter, FSRS quizzes, review mode, tutor, stats, sync, Slovak interface.
- Course repo template with GitHub Pages deploy and weekly upgrade workflows.
- Opens Temno (v0b) and Diskrétka (v0a) builds unchanged.
