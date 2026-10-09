/* Libraries loaded from the CDN as browser globals, and the claude.ai artifact runtime (absent elsewhere). */
declare const marked: { parse(s: string): string; parseInline(s: string): string };
declare const katex: { renderToString(tex: string, opts?: Record<string, unknown>): string };
declare const cytoscape: (opts: Record<string, unknown>) => any;
declare const mermaid: { initialize(o: Record<string, unknown>): void; render(id: string, code: string): Promise<{ svg: string }> };
interface Window {
  katex?: unknown; marked?: unknown; hljs?: { highlightElement(el: Element): void };
  claude?: { use(name: string): Promise<any> };
  SG_BOOT?: import("./boot-types.js").BootConfig;
}
interface Element { dataset: DOMStringMap; style: CSSStyleDeclaration; focus(): void; hidden: boolean }
