import type { CourseBundle } from "../schema/index.js";
import type { Graph } from "../core/graph.js";
import type { Progress } from "../core/fsrs.js";

/** Set by the page the engine builds (window.SG_BOOT) — the only thing that differs between apps. */
export interface BootConfig {
  /** "standalone": one course, public site; "viewer": open any course file, sample course built in. */
  mode: "standalone" | "viewer";
  /** Course embedded in the page (single-file builds and the viewer's sample). */
  course?: CourseBundle | Record<string, unknown>;
  /** Course fetched next to the page (multi-file builds: knowledge.json). */
  courseUrl?: string;
  /** Show "Open a course file" (default: true in viewer mode, false in standalone mode). */
  allowOpen?: boolean;
  /** Core version the page was built with. */
  engine?: string;
}

export interface Route { name: string; arg?: string; q: URLSearchParams }
export interface AppState {
  course: CourseBundle | null; G: Graph; P: Progress; key: string;
  caps: Record<string, any>; capsReady?: Promise<unknown>;
  sync: { on: boolean; doc: any; at: number | null } | null;
  isDemo: boolean; route: Route | null; allowOpen?: boolean; bootCourse?: any; session: any; pushSync?: () => void; embedded?: boolean;
  boot: BootConfig;
}
