/**
 * `studygraph upgrade` (run inside a course repo): move the pinned core to a newer release, then let the NEW core
 * migrate the content and rebuild. Only content/ is course-specific, so nothing else needs merging.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { ENGINE_VERSION } from "./paths.js";

const semverKey = (v: string) => v.replace(/^v/, "").split(/[.-]/).slice(0, 3).map(n => +n || 0);
const cmp = (a: string, b: string) => { const x = semverKey(a), y = semverKey(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

export function coreSpec(root: string): { spec: string; pkg: any } {
  const p = join(root, "package.json"); if (!existsSync(p)) throw new Error("no package.json: run this inside a course repo");
  const pkg = JSON.parse(readFileSync(p, "utf8"));
  const spec = pkg.devDependencies?.studygraph || pkg.dependencies?.studygraph;
  if (!spec) throw new Error("package.json does not depend on studygraph");
  return { spec, pkg };
}

/** Release tags of a git-hosted core (github:owner/repo or git+https URLs). */
export function releases(spec: string): string[] {
  const m = spec.match(/^github:([^#]+)/) || spec.match(/^git\+((?:https?|file|ssh):[^#]+)/);
  if (!m) return [];
  const url = spec.startsWith("github:") ? `https://github.com/${m[1]}.git` : m[1];
  try {
    const out = execFileSync("git", ["ls-remote", "--tags", "--refs", url], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return [...out.matchAll(/refs\/tags\/(v?\d+\.\d+\.\d+)$/gm)].map(x => x[1]).sort(cmp);
  } catch { return []; }
}

export function upgrade(root: string, o: { to?: string; check?: boolean; dryRun?: boolean } = {}) {
  const { spec, pkg } = coreSpec(root);
  const installed = ENGINE_VERSION;
  const tags = releases(spec);
  const latest = tags[tags.length - 1]?.replace(/^v/, "");
  if (o.check) return { installed, spec, latest, available: !!latest && cmp(latest, installed) > 0, tags };
  let next = spec;
  const target = o.to === "latest" || !o.to ? latest : o.to.replace(/^v/, "");
  if (target && /#semver:/.test(spec)) next = spec.replace(/#semver:.*/, `#semver:^${target}`);
  else if (target && /^github:[^#]+$/.test(spec)) next = `${spec}#semver:^${target}`;
  else if (target && /#v?\d+\.\d+\.\d+$/.test(spec)) next = spec.replace(/#v?\d+\.\d+\.\d+$/, `#v${target}`);
  if (o.dryRun) return { installed, spec, next, latest };
  if (next !== spec) {
    (pkg.devDependencies?.studygraph ? pkg.devDependencies : pkg.dependencies).studygraph = next;
    writeFileSync(join(root, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  }
  const run = (cmd: string, args: string[]) => { const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" }); if (r.status) throw new Error(`${cmd} ${args.join(" ")} failed`); };
  run("npm", next.startsWith("file:") ? ["install"] : ["install", "--no-audit", "--no-fund"]);
  run("npx", ["--no-install", "studygraph", "migrate"]);   // the newly installed core migrates the content
  run("npx", ["--no-install", "studygraph", "build"]);
  return { installed, spec, next, latest };
}
