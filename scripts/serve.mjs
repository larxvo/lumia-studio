import http from "node:http";
import { attachCollabRelay } from "./collab-relay.mjs";
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("dist"), types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".mjs": "text/javascript", ".wasm": "application/wasm", ".json": "application/json" };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
attachCollabRelay(server, { origins: (process.env.LUMA_ALLOWED_ORIGINS || " ").trim().split(/\s*,\s*/).filter(Boolean) });
const args = process.argv.slice(2), flag = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? null : args[i + 1];
};
const port = Number(flag("--port") || process.env.PORT) || 3e3, host = flag("--host") || process.env.HOST || "127.0.0.1";
server.listen(port, host, () => console.log(`Luma Studio: http://${host}:${port}`));
