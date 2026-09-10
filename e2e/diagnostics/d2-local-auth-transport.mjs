/** Optional diagnostic transport for an existing, unpublished local Kong.
 * Loopback only; forwards anonymous GET/OPTIONS /auth/v1/user, no service changes.
 * Preserves Host/Origin and all CORS headers. Forces Connection: close per probe.
 */
import net from "node:net";
import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const id = process.env.D2_KONG_ID;
if (!/^[a-f0-9]{64}$/.test(id ?? "")) throw new Error("D2_KONG_ID must be the verified full container ID");
const config = JSON.parse(fs.readFileSync(process.env.D2_PUBLIC_CONFIG, "utf8"));
const anonKey = config.localKey;
if (!anonKey || JSON.parse(Buffer.from(anonKey.split(".")[1], "base64url")).role !== "anon") throw new Error("Local anon key required");
const check = spawnSync("docker", ["inspect", "--format", "{{.Id}} {{.State.Running}}", id], { encoding: "utf8" });
if (check.status !== 0 || check.stdout.trim() !== `${id} true`) throw new Error("Existing Kong identity/liveness mismatch");
const children = new Set();
const sockets = new Set();
const servers = [];
let closing = false;
const receipt = { startedAt: new Date().toISOString(), containerId: id, target: "127.0.0.1:8000 inside existing Kong", listeners: [], requests: [], changesToServices: false };
const save = () => fs.writeFileSync(process.env.D2_TRANSPORT_RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
try {
for (const host of ["127.0.0.1", "::1"]) {
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => socket.destroy());
    socket.once("close", () => sockets.delete(socket));
    socket.setTimeout(15_000, () => socket.destroy());
    let buffer = Buffer.alloc(0);
    const readHeaders = (data) => {
      buffer = Buffer.concat([buffer, data]);
      const end = buffer.indexOf("\r\n\r\n");
      if (buffer.length > 16_384) return socket.destroy();
      if (end < 0) return;
      socket.removeListener("data", readHeaders);
      socket.pause();
      const lines = buffer.subarray(0, end).toString("latin1").split("\r\n");
      const [method, requestPath, version] = lines.shift().split(" ");
      const headerEntries = lines.map((line) => { const i = line.indexOf(":"); return [line.slice(0, i).toLowerCase(), line.slice(i + 1).trim()]; });
      const headers = Object.fromEntries(headerEntries);
      const allowed = ["GET", "OPTIONS"].includes(method) && requestPath === "/auth/v1/user" && version === "HTTP/1.1"
        && headerEntries.length === new Set(headerEntries.map(([name]) => name)).size
        && !headers.cookie && !headers["proxy-authorization"]
        && buffer.length === end + 4 && !headers["transfer-encoding"] && Number(headers["content-length"] ?? 0) === 0
        && (method === "OPTIONS" || headers.apikey === anonKey)
        && (!headers.authorization || headers.authorization === `Bearer ${anonKey}`);
      if (!allowed) return socket.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
      const requestReceipt = { at: new Date().toISOString(), method, path: requestPath, host: headers.host, origin: headers.origin, requestedHeaders: headers["access-control-request-headers"] ?? null };
      receipt.requests.push(requestReceipt);
      save();
      const child = spawn("docker", ["exec", "-i", id, "nc", "-w", "8", "127.0.0.1", "8000"], { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
      requestReceipt.clientPid = child.pid;
      children.add(child);
      const timer = setTimeout(() => child.kill(), 12_000);
      child.once("error", () => socket.destroy());
      child.stdin.on("error", () => socket.destroy());
      child.once("close", (code) => { clearTimeout(timer); children.delete(child); requestReceipt.transportExit = code; requestReceipt.closedAt = new Date().toISOString(); save(); });
      // Each connection accepts exactly one request; pipelined follow-ups are rejected.
      socket.on("data", () => socket.destroy());
      socket.once("close", () => child.kill());
      let responseHead = Buffer.alloc(0);
      const captureHead = (chunk) => {
        responseHead = Buffer.concat([responseHead, chunk]);
        const boundary = responseHead.indexOf("\r\n\r\n");
        if (boundary < 0 && responseHead.length < 32_768) return;
        child.stdout.removeListener("data", captureHead);
        if (boundary >= 0) {
          const responseLines = responseHead.subarray(0, boundary).toString("latin1").split("\r\n");
          requestReceipt.statusLine = responseLines.shift();
          requestReceipt.corsHeaders = responseLines.filter((line) => /^(access-control-|vary:|server:)/i.test(line));
          save();
        }
        responseHead = Buffer.alloc(0);
      };
      child.stdout.on("data", captureHead);
      child.stdout.pipe(socket);
      const forwarded = lines.filter((line) => !/^connection:/i.test(line));
      // BusyBox nc must retain stdin until the response; early EOF loses replies.
      child.stdin.write(`${method} ${requestPath} ${version}\r\n${forwarded.join("\r\n")}\r\nConnection: close\r\n\r\n`);
      socket.resume();
    };
    socket.on("data", readHeaders);
  });
  servers.push(server);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen({ host, port: 55431, ipv6Only: true }, resolve); });
  receipt.listeners.push({ host, port: 55431 });
}
} catch (error) {
  for (const server of servers) server.close();
  throw error;
}
save();
console.log(JSON.stringify({ ready: true, containerId: id, listeners: receipt.listeners, only: "anonymous GET/OPTIONS /auth/v1/user" }));
async function close() {
  if (closing) return;
  closing = true;
  const childClosures = [...children].map((child) => new Promise((resolve) => child.once("close", resolve)));
  for (const socket of sockets) socket.destroy();
  for (const child of children) child.kill();
  await Promise.all(childClosures);
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  receipt.finishedAt = new Date().toISOString();
  receipt.remainingOwnedConnections = sockets.size;
  save();
  process.stdin.pause();
  process.exitCode = 0;
}
process.stdin.setEncoding("utf8");
process.stdin.on("data", (data) => { if (data.trim() === "stop") void close(); });
process.once("SIGINT", close);
process.once("SIGTERM", close);
// No orphan listener even if the supervising session disappears.
setTimeout(close, 10 * 60_000).unref();
