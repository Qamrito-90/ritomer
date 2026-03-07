import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3001);

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  });

  response.end(JSON.stringify(payload, null, 2));
}

const server = createServer((request, response) => {
  const origin = `http://${request.headers.host ?? `localhost:${port}`}`;
  const url = new URL(request.url ?? "/", origin);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,OPTIONS"
    });
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    writeJson(response, 200, {
      status: "ok",
      service: "ritomer-backend",
      timestamp: new Date().toISOString(),
      port
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/message") {
    writeJson(response, 200, {
      title: "Ritomer backend",
      message: "L'API locale repond correctement.",
      nextStep: "Branche ici tes routes metier."
    });
    return;
  }

  writeJson(response, 404, {
    error: "Not Found",
    path: url.pathname
  });
});

server.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
