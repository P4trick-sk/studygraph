/** `studygraph review apply <patch.json>`: fold a review patch exported from the app into the topic files. */
import { ReviewPatch } from "../schema/index.js";
import { loadWorkspace, readJson } from "./workspace.js";

export function applyReview(root: string, patchFile: string) {
  const patch = ReviewPatch.parse(readJson(patchFile));
  const ws = loadWorkspace(root); const touched = new Set<string>(); const missing: string[] = [];
  for (const it of patch.items) {
    const file = ws.fileOf(it.id); if (!file) { missing.push(it.id); continue; }
    const n = ws.nodes[it.id]; n.review ||= { status: "draft", notes: [] };
    if (it.verdict === "edit" && it.path === "statement" && typeof it.value === "string") {
      n.review.notes = [...(n.review.notes || []), `Edited by ${patch.reviewer} on ${patch.date}; previous statement: ${n.statement}`];
      n.statement = it.value; n.review.status = "checked";
    } else n.review.status = it.verdict === "edit" ? "checked" : it.verdict;
    if (it.comment) n.review.notes = [...(n.review.notes || []), `${patch.reviewer} (${patch.date}): ${it.comment}`];
    if (n.review.status === "checked") { n.review.checkedBy = patch.reviewer; n.review.checkedAt = patch.date; }
    touched.add(file);
  }
  for (const f of touched) ws.save(f);
  return { applied: patch.items.length - missing.length, missing };
}
