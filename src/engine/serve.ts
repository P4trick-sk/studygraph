/** `studygraph serve`: a tiny static server for dist/ (fetching knowledge.json needs http, not file://). */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
export function serve(dir: string, port = 8000) {
  const server = createServer(async (req, res) => {
    let p = normalize(decodeURIComponent((req.url || "/").split("?")[0])).replace(/^(\.\.[/\\])+/, "");
    if (p.endsWith("/")) p += "index.html";
    const f = join(dir, p);
    try { if ((await stat(f)).isFile()) { res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }); res.end(await readFile(f)); return; } } catch {}
    res.writeHead(404); res.end("not found");
  });
  server.listen(port, () => console.log(`serving ${dir} at http://localhost:${port}/`));
  return server;
}
