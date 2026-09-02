import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const DENIED_RESPONSE = JSON.stringify({
  code: "E2E_SUPABASE_UNAVAILABLE",
  message: "Supabase no está configurado en este E2E local.",
});

function applyCommonHeaders(response) {
  response.setHeader("access-control-allow-headers", "*");
  response.setHeader("access-control-allow-methods", "*");
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("cache-control", "no-store");
  response.setHeader("content-type", "application/json; charset=utf-8");
}

export function createSupabaseDenyServer() {
  return createServer((request, response) => {
    applyCommonHeaders(response);

    if (request.method === "GET" && request.url === "/__health") {
      response.writeHead(200);
      response.end(JSON.stringify({ mode: "deny-only", ok: true }));
      return;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    response.writeHead(503);
    response.end(DENIED_RESPONSE);
  });
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1_024 || port > 65_535) {
    throw new Error("El puerto deny-only debe ser un entero entre 1024 y 65535.");
  }
  return port;
}

function startFromCli() {
  const port = parsePort(process.argv[2]);
  const server = createSupabaseDenyServer();

  const close = () => server.close(() => process.exit(0));
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  server.listen(port, "127.0.0.1", () => {
    process.stdout.write(`Supabase E2E deny-only listo en 127.0.0.1:${port}\n`);
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  startFromCli();
}
