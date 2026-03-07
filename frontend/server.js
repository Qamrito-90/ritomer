import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT ?? 3000);
const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFile);
const publicDirectory = join(currentDirectory, "public");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

function sendFile(response, filePath) {
  const extension = extname(filePath).toLowerCase();
  const contentType = contentTypes[extension] ?? "application/octet-stream";

  response.writeHead(200, {
    "Cache-Control": "no-cache",
    "Content-Type": contentType
  });

  createReadStream(filePath).pipe(response);
}

const server = createServer((request, response) => {
  const origin = `http://${request.headers.host ?? `localhost:${port}`}`;
  const url = new URL(request.url ?? "/", origin);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const candidatePath = resolve(publicDirectory, `.${requestedPath}`);

  if (!candidatePath.startsWith(publicDirectory)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  let filePath = candidatePath;

  if (!existsSync(filePath)) {
    filePath = join(publicDirectory, "index.html");
  } else if (statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  if (!existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
    return;
  }

  sendFile(response, filePath);
});

server.listen(port, () => {
  console.log(`Frontend listening on http://localhost:${port}`);
});
