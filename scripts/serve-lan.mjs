import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const root = fileURLToPath(new URL("../out/", import.meta.url));
const port = Number(process.env.PORT ?? 3000);

const certPath = join(projectRoot, "certs", "server.crt");
const keyPath = join(projectRoot, "certs", "server.key");
const useHttps = existsSync(certPath) && existsSync(keyPath);

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

async function handler(request, response) {
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
}

const logRequest = (request, response) => {
  const started = Date.now();
  response.on("finish", () => {
    console.log(
      `${new Date().toISOString()} ${request.method} ${request.url} ${response.statusCode} ${Date.now() - started}ms`,
    );
  });
};

const server = useHttps
  ? createHttpsServer(
      {
        key: await readFile(keyPath),
        cert: await readFile(certPath),
      },
      (request, response) => {
        logRequest(request, response);
        void handler(request, response);
      },
    )
  : createHttpServer((request, response) => {
      logRequest(request, response);
      void handler(request, response);
    });

const scheme = useHttps ? "https" : "http";

server.listen(port, "0.0.0.0", () => {
  console.log(`Dashboard Admin siap di ${scheme}://${lanAddress()}:${port}`);
  console.log(`Lokal: ${scheme}://127.0.0.1:${port}`);
  if (!useHttps) {
    console.log(
      "Mode HTTP: PWA offline belum bisa diinstal. Jalankan 'npm run cert' untuk HTTPS.",
    );
  }
});