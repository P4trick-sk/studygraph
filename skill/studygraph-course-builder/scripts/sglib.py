"""Helpers for topic generator scripts (Studygraph schema v1).

A generator script builds ONE topic and writes <course>/content/topics/<id>.json:

    import sys; sys.path.insert(0, "<skill>/scripts")
    from sglib import Topic, T, E, step
    t = Topic("cardinality", "Mohutnosť", course="A", order=3, source_files=["MNOZINY.pdf"])
    t.meta(summary="…", overview="…", key_questions=["…"], prerequisites=["functions"])
    t.node("def.countable", "definition", "Spočítateľná množina",
           r"Množina je **spočítateľná**, ak … [bijekcia](def.bijection) …",
           uses=["def.bijection"], terms=[T("spočítateľná množina", "countable set")], page=16,
           expl=E(intuition=r"…", detailed=r"…", pitfalls=[r"…"], examples=[r"…"]))
    t.proof("thm.cantor", steps=[step(r"…", why=r"…", uses=["def.power-set"])], idea=r"…")
    t.figure_table("fig.x", "Title", columns=[...], rows=[[...]], illustrates=["def.countable"])
    t.quiz_mcq("quiz.card-1", r"Prompt", [r"a", r"b"], answer=1, explanation=r"…", about=["def.countable"])
    t.write("<course>/content")      # basic checks, then writes the file

Use raw strings r"…" for anything with LaTeX. Every inline link [text](id) must also be in uses or relations;
write() adds a missing one to relations as see-also and prints a note.
"""
import json, os, re

LINK = re.compile(r"\[([^\]]+)\]\(([a-z][a-z0-9]*\.[A-Za-z0-9][\w-]*)\)")
TEX_N = re.compile(r"\\n(?![a-zA-Z])")  # a literal backslash-n that is not the start of a TeX command


def T(term, alt=None, symbol=None):
    d = {"term": term}
    if alt: d["alt"] = alt
    if symbol: d["symbol"] = symbol
    return d


def E(intuition="", detailed="", pitfalls=None, examples=None):
    return {"intuition": intuition, "detailed": detailed, "pitfalls": list(pitfalls or []), "examples": list(examples or [])}


def step(text, why="", uses=None):
    return {"text": text, "why": why, "uses": list(uses or [])}


class Topic:
    def __init__(self, id, title, course="A", order=1, source_files=None, status="draft"):
        self.data = {"schemaVersion": 1,
                     "meta": {"id": id, "title": title, "course": course, "order": order,
                              "sourceFiles": list(source_files or []), "summary": "", "overview": "",
                              "keyQuestions": [], "prerequisites": [], "alsoCovers": [], "status": status},
                     "nodes": [], "figures": [], "applications": [], "quiz": []}
        self._ids = set()

    # ---------- meta
    def meta(self, **kw):
        alias = {"key_questions": "keyQuestions", "also_covers": "alsoCovers", "source_files": "sourceFiles"}
        for k, v in kw.items():
            self.data["meta"][alias.get(k, k)] = v
        return self

    def _new_id(self, i):
        if i in self._ids:
            raise ValueError(f"duplicate id {i}")
        self._ids.add(i)

    # ---------- nodes
    def node(self, id, type, title, statement, uses=(), relations=(), terms=(), aliases=(), tags=(),
             origin="slides", page=None, slide=None, source_file=None, label=None, expl=None, figures=(),
             difficulty=1, importance=2, attribution=None, notes=(), status="draft", checks=None):
        """origin: slides (needs a page or slide) | supplement | generated.
        relations: [("analogue", "thm.x", "optional note"), ...] or dicts."""
        self._new_id(id)
        rel = []
        for r in relations:
            rel.append(r if isinstance(r, dict) else {"type": r[0], "target": r[1], **({"note": r[2]} if len(r) > 2 else {})})
        n = {"id": id, "type": type, "topic": self.data["meta"]["id"], "title": title,
             "terms": [dict(x) for x in terms], "aliases": list(aliases), "tags": list(tags), "origin": origin,
             "statement": statement, "uses": list(uses), "relations": rel, "figures": list(figures),
             "difficulty": difficulty, "importance": importance, "review": {"status": status, "notes": list(notes)}}
        if origin == "slides":
            s = {"file": source_file or (self.data["meta"]["sourceFiles"] or ["?"])[0]}
            if page is not None: s["page"] = page
            if slide is not None: s["slide"] = slide
            if label: s["label"] = label
            n["source"] = [s]
        if expl: n["explanation"] = expl
        if attribution: n["attribution"] = attribution
        if checks: n["checks"] = checks
        self.data["nodes"].append(n)
        return n

    def get(self, id):
        for n in self.data["nodes"]:
            if n["id"] == id:
                return n
        raise KeyError(id)

    def proof(self, node_id, steps=(), idea="", strategy="", status=None, origin="slides"):
        """status: full | sketch | none (default: full with steps, none without)."""
        p = {"origin": origin, "status": status or ("full" if steps else "none"), "steps": list(steps)}
        if idea: p["idea"] = idea
        if strategy: p["strategy"] = strategy
        self.get(node_id)["proof"] = p
        return p

    # ---------- figures
    def _fig(self, id, kind, title, caption, illustrates, origin, sources, body):
        self._new_id(id)
        f = {"id": id, "kind": kind, "title": title, "caption": caption, "origin": origin,
             "illustrates": list(illustrates), "sources": list(sources or []), **body}
        self.data["figures"].append(f)
        for i in illustrates:
            try:
                n = self.get(i)
                if id not in n["figures"]:
                    n["figures"].append(id)
            except KeyError:
                pass
        return f

    def figure_graph(self, id, title, vertices, edges, caption="", illustrates=(), directed=False, animations=(),
                     origin="generated", sources=None):
        """vertices [{id, x, y, label}] (any scale, y downwards); edges [{id, source, target, label?, directed?}];
        animations [{title?, steps: [{caption, highlight: [vertex/edge ids], edgeLabels?: {edge: label}}]}]"""
        return self._fig(id, "graph", title, caption, illustrates, origin, sources,
                         {"directed": directed, "vertices": list(vertices), "edges": list(edges), "animations": list(animations)})

    def figure_table(self, id, title, columns, rows, caption="", illustrates=(), origin="generated", sources=None):
        return self._fig(id, "table", title, caption, illustrates, origin, sources,
                         {"columns": list(columns), "rows": [list(r) for r in rows]})

    def figure_plot(self, id, title, x, y, fns=(), points=(), series=(), caption="", illustrates=(), origin="generated", sources=None):
        """x = [min, max], y = [min, max]; fns [{expr: "x^2", label}] using x, ^, sin, cos, tan, exp, log, sqrt, abs, PI;
        points [{x, y, label}]; series [{label, points: [[x, y], ...]}]"""
        return self._fig(id, "plot", title, caption, illustrates, origin, sources,
                         {"plot": {"x": list(x), "y": list(y), "fns": list(fns), "points": list(points), "series": list(series)}})

    def figure_mermaid(self, id, title, code, caption="", illustrates=(), origin="generated", sources=None):
        return self._fig(id, "mermaid", title, caption, illustrates, origin, sources, {"code": code})

    def figure_code(self, id, title, code, language="python", caption="", illustrates=(), origin="generated", sources=None):
        return self._fig(id, "code", title, caption, illustrates, origin, sources, {"language": language, "code": code})

    # ---------- applications and quiz
    def application(self, id, title, summary, scenario, modelling, solution, connects, tags=(), figures=(), origin="generated"):
        self._new_id(id)
        a = {"id": id, "title": title, "summary": summary, "scenario": scenario, "modelling": modelling,
             "solution": solution, "connects": list(connects), "figures": list(figures), "tags": list(tags), "origin": origin}
        self.data["applications"].append(a)
        return a

    def _quiz(self, id, kind, prompt, answer, explanation, about, difficulty, options=None, check=None):
        self._new_id(id)
        q = {"id": id, "kind": kind, "prompt": prompt, "answer": answer, "explanation": explanation,
             "about": list(about), "difficulty": difficulty}
        if options is not None: q["options"] = list(options)
        if check: q["check"] = check
        self.data["quiz"].append(q)
        return q

    def quiz_mcq(self, id, prompt, options, answer, explanation="", about=(), difficulty=1, check=None):
        """answer = index into options; check = {"verifier": "expr", "expr": "2**4"} compares with options[answer]."""
        if not 0 <= answer < len(options):
            raise ValueError(f"{id}: answer index out of range")
        return self._quiz(id, "mcq", prompt, answer, explanation, about, difficulty, options, check)

    def quiz_tf(self, id, prompt, answer, explanation="", about=(), difficulty=1):
        return self._quiz(id, "truefalse", prompt, bool(answer), explanation, about, difficulty)

    def quiz_card(self, id, prompt, answer, explanation="", about=(), difficulty=1):
        return self._quiz(id, "flashcard", prompt, answer, explanation, about, difficulty)

    def quiz_open(self, id, prompt, answer, explanation="", about=(), difficulty=2):
        return self._quiz(id, "open", prompt, answer, explanation, about, difficulty)

    # ---------- write
    @staticmethod
    def texts(n):
        out = [n["statement"]]
        for v in (n.get("explanation") or {}).values():
            out += v if isinstance(v, list) else [v]
        p = n.get("proof") or {}
        out += [p.get("idea", ""), p.get("strategy", "")]
        for s in p.get("steps", []):
            out += [s["text"], s.get("why", "")]
        return [t for t in out if t]

    def write(self, content_dir="content"):
        notes = []
        for n in self.data["nodes"]:
            refs = set(n["uses"]) | {r["target"] for r in n["relations"]}
            for tx in self.texts(n):
                for m in LINK.finditer(tx):
                    tgt = m.group(2)
                    if tgt.startswith(("fig.", "app.")) or tgt in refs or tgt == n["id"]:
                        continue
                    n["relations"].append({"type": "see-also", "target": tgt}); refs.add(tgt)
                    notes.append(f"{n['id']}: link to {tgt} added to relations as see-also (move it to uses if it is a prerequisite)")
                if TEX_N.search(tx):
                    notes.append(f"{n['id']}: literal \\n in text – use real line breaks")
                if tx.replace("\\$", "").count("$") % 2:
                    notes.append(f"{n['id']}: unbalanced $")
        path = os.path.join(content_dir, "topics", self.data["meta"]["id"] + ".json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(self.data, fh, ensure_ascii=False, indent=1)
        d = self.data
        print(f"wrote {path}: {len(d['nodes'])} nodes, {len(d['figures'])} figures, "
              f"{len(d['applications'])} applications, {len(d['quiz'])} quiz items")
        for m in notes:
            print("  note:", m)
        return path
