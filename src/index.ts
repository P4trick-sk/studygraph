/** Public API of the studygraph package (the CLI is a thin layer over these). */
export * from "./schema/index.js";
export * as core from "./core/index.js";
export { loadWorkspace, cycles, type Workspace } from "./engine/workspace.js";
export { validate } from "./engine/validate.js";
export { breakCycles } from "./engine/cycles.js";
export { suggestLinks, rejectSuggestion } from "./engine/links.js";
export { build, bundleOf, courseFile, renderPage } from "./engine/build.js";
export { importCourse } from "./engine/importer.js";
export { ingest } from "./engine/ingest.js";
export { init } from "./engine/init.js";
export { migrate, MIGRATIONS } from "./engine/migrate.js";
export { upgrade, releases } from "./engine/upgrade.js";
export { applyReview } from "./engine/review.js";
export { serve } from "./engine/serve.js";
export { ENGINE_VERSION } from "./engine/paths.js";
