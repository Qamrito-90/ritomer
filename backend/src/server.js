import "dotenv/config";
import { createServer } from "node:http";
import {
  closeDatabaseConnection,
  getDatabaseStatus,
  initializeDatabase
} from "./database.js";

const port = Number(process.env.PORT ?? 3001);

await initializeDatabase();

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
    const databaseStatus = getDatabaseStatus();

    writeJson(response, 200, {
      database: databaseStatus,
      status: "ok",
      service: "ritomer-backend",
      timestamp: new Date().toISOString(),
      port
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/message") {
    const databaseStatus = getDatabaseStatus();
    const databaseMessage =
      databaseStatus.status === "connected"
        ? `MongoDB connected on database "${databaseStatus.databaseName}".`
        : "MongoDB is not connected yet. Complete the Atlas connection string in backend/.env.";

    writeJson(response, 200, {
      database: databaseStatus,
      title: "Ritomer backend",
      message: "L'API locale repond correctement.",
      nextStep: databaseMessage
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

async function shutdown(signal) {
  console.log(`${signal} received. Closing backend.`);
  await closeDatabaseConnection();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
