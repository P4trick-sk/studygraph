import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
/** Root of the installed studygraph package (works from lib/engine/*.js). */
export const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ENGINE_VERSION: string = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")).version;
