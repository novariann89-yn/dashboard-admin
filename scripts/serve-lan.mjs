import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";

const root = fileURLToPath(new URL("../out/", import.meta.url));
const port = Number(process.env.PORT ?? 3000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function lanAddress() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";

    const filePath = normalize(join(root, pathname));
    if (!filePath.startsWith(root)) {
      response.writeHead(403).end("forbidden");
      return;
    }

    try {
      const info = await stat(filePath);
      const target = info.isDirectory() ? join(filePath, "index.html") : filePath;
      const data = await readFile(target);
      response.writeHead(200, {
        "content-type": MIME[extname(target)] ?? "application/octet-stream",
        "cache-control": "no-cache",
      });
      response.end(data);
      return;
    } catch {
      const data = await readFile(join(root, "index.html"));
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-cache",
      });
      response.end(data);
    }
  } catch {
    response.writeHead(500).end("error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Dashboard Admin siap di http://${lanAddress()}:${port}`);
  console.log(`Lokal: http://127.0.0.1:${port}`);
});