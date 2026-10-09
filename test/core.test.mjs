import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, existsSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { core, validate, build, importCourse, breakCycles, suggestLinks, init, migrate, ENGINE_VERSION } from "../lib/index.js";

const DEMO = new URL("../demo", import.meta.url).pathname;

test("sample course validates with 0 errors and no cycles", () => {
  const v = validate(DEMO);
  assert.deepEqual(v.errors, []);
  assert.equal(v.counts.nodes, 31);
  assert.equal(breakCycles(DEMO, false).demoted.length, 0);
});

test("graph: reverse edges, learning path, search, checks", () => {
  const tmp = mkdtempSync(join(tmpdir(), "sg-")); const r = build(DEMO, { out: tmp });
  assert.ok(r.ok);
  const k = JSON.parse(readFileSync(join(tmp, "knowledge.json"), "utf8"));
  const G = core.buildGraph(core.assembleCourse([k]));
  assert.ok(G.usedBy["def.injection"].includes("def.bijection"));
  assert.deepEqual(G.learningPath("thm.cantor").slice(0, 2), ["def.set", "def.cartesian-product"]);
  assert.equal(core.search(G, "bijekcia")[0].id, "def.bijection");
  assert.equal(core.search(G, "cantr")[0].id, "thm.cantor");       // one-typo match
  assert.ok(G.checkResults.length >= 4 && G.checkResults.every(c => c.ok));
});

test("FSRS: Good on a new card is about 4 days, Again is 10 minutes", () => {
  const now = Date.UTC(2026, 0, 1);
  const c = core.FSRS.review(null, 3, now);
  assert.equal(Math.round((c.due - now) / core.FSRS.DAY), 4);
  assert.equal(core.FSRS.review(c, 1, c.due).due - c.due, 10 * 60e3);
});

test("build → import round trip keeps the course valid", () => {
  const tmp = mkdtempSync(join(tmpdir(), "sg-")); build(DEMO, { out: join(tmp, "dist") });
  const ws = join(tmp, "ws"); importCourse(join(tmp, "dist", "knowledge.json"), ws);
  assert.deepEqual(validate(ws).errors, []);
  assert.ok(existsSync(join(ws, "content", "topics", "cardinality.json")));
});

test("standalone, single and viewer pages carry the right boot config", () => {
  const tmp = mkdtempSync(join(tmpdir(), "sg-"));
  const boot = f => JSON.parse(readFileSync(f, "utf8").match(/window\.SG_BOOT = (.*?);<\/script>/s)[1]);
  build(DEMO, { out: join(tmp, "a") }); build(DEMO, { out: join(tmp, "b"), single: true }); build(DEMO, { out: join(tmp, "c"), viewer: true });
  assert.equal(boot(join(tmp, "a", "index.html")).courseUrl, "knowledge.json");
  assert.equal(boot(join(tmp, "b", "index.html")).course.embedded, true);
  assert.equal(boot(join(tmp, "c", "index.html")).mode, "viewer");
  assert.equal(boot(join(tmp, "a", "index.html")).engine, ENGINE_VERSION);
});

test("init creates a course repo that validates; migrate records the engine", () => {
  const dir = join(mkdtempSync(join(tmpdir(), "sg-")), "course");
  init(dir, { name: "Test", title: "Test course", lang: "sk", core: "file:../studygraph" });
  for (const f of ["package.json", ".gitignore", ".github/workflows/deploy.yml", ".github/workflows/upgrade.yml", "content/config.json"]) assert.ok(existsSync(join(dir, f)), f);
  cpSync(join(DEMO, "content", "topics"), join(dir, "content", "topics"), { recursive: true });
  const cfg = JSON.parse(readFileSync(join(dir, "content", "config.json"), "utf8"));
  assert.equal(cfg.language.ui, "sk"); assert.equal(cfg.nodeTypes[0].label, "Definícia");
  assert.equal(migrate(dir).engine, ENGINE_VERSION);
});

test("link suggestions skip already linked targets", () => {
  const s = suggestLinks(DEMO).suggestions;
  assert.ok(s.every(x => x.node !== x.target));
});
