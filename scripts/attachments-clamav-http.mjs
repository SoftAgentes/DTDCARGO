#!/usr/bin/env node

import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { connect } from "node:net";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_BYTES = 25 * 1024 * 1024;

export function parseClamavResponse(value) {
  const response = value.replaceAll("\0", "").trim();
  if (/^stream: OK$/i.test(response)) return { clean: true, signature: null };
  const found = response.match(/^stream: (.+) FOUND$/i);
  if (found) return { clean: false, signature: found[1] };
  throw new Error(`Respuesta clamd no reconocida: ${response.slice(0, 160)}`);
}

export function tokenMatches(header, expected) {
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected ?? "");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export async function scanWithClamd(bytes, options = {}) {
  if (bytes.byteLength > MAX_BYTES) throw new Error("Archivo excede 25 MiB.");
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 3310;
  if (!new Set(["127.0.0.1", "::1", "localhost"]).has(host)) {
    throw new Error("clamd debe permanecer en loopback.");
  }
  return await new Promise((resolvePromise, reject) => {
    const socket = connect({ host, port });
    const response = [];
    const timeout = setTimeout(() => socket.destroy(new Error("Timeout de clamd.")), 60_000);
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < bytes.byteLength; offset += 64 * 1024) {
        const chunk = bytes.subarray(offset, Math.min(offset + 64 * 1024, bytes.byteLength));
        const size = Buffer.allocUnsafe(4);
        size.writeUInt32BE(chunk.byteLength);
        socket.write(size);
        socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
    socket.on("data", (chunk) => response.push(chunk));
    socket.on("error", reject);
    socket.on("close", (hadError) => {
      clearTimeout(timeout);
      if (!hadError) {
        try { resolvePromise(parseClamavResponse(Buffer.concat(response).toString("utf8"))); }
        catch (error) { reject(error); }
      }
    });
  });
}

export function createClamavAdapter(env = process.env) {
  if (env.DTD_ATTACHMENTS_CLAMAV_ADAPTER_ALLOW !== "1") {
    throw new Error("Adaptador ClamAV bloqueado: falta allow explícito.");
  }
  if (!env.DTD_ATTACHMENTS_AV_TOKEN?.trim()) throw new Error("Adaptador ClamAV sin token.");
  return createServer(async (request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8");
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200).end(JSON.stringify({ ok: true, adapter: "clamav-loopback" }));
      return;
    }
    if (request.method !== "POST" || request.url !== "/scan") {
      response.writeHead(404).end(JSON.stringify({ error: "not_found" }));
      return;
    }
    if (!tokenMatches(request.headers.authorization, env.DTD_ATTACHMENTS_AV_TOKEN)) {
      response.writeHead(401).end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    const chunks = [];
    let total = 0;
    try {
      for await (const chunk of request) {
        total += chunk.byteLength;
        if (total > MAX_BYTES) throw new Error("Archivo excede 25 MiB.");
        chunks.push(chunk);
      }
      const result = await scanWithClamd(Buffer.concat(chunks), {
        host: env.DTD_ATTACHMENTS_CLAMD_HOST ?? "127.0.0.1",
        port: Number(env.DTD_ATTACHMENTS_CLAMD_PORT ?? "3310"),
      });
      response.writeHead(200).end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(503).end(JSON.stringify({
        error: "scan_unavailable",
        detail: error instanceof Error ? error.message : String(error),
      }));
    }
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const host = "127.0.0.1";
  const port = Number(process.env.DTD_ATTACHMENTS_CLAMAV_ADAPTER_PORT ?? "8787");
  createClamavAdapter().listen(port, host, () => {
    console.log(JSON.stringify({ ok: true, adapter: "clamav-loopback", host, port }));
  });
}
