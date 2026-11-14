// @vitest-environment node
import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, request as httpRequest, type IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";
import type { AddressInfo } from "node:net";
import { rootCertificates } from "node:tls";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { fetchBcvObservation } from "../bcv-source";
import { BCV_INTERMEDIATE_PEM, BCV_INTERMEDIATE_SHA256, bcvTlsFetch, bcvTrustedCa } from "../bcv-tls";
import { BCV_URL } from "../bcv-types";

const html = readFileSync(new URL("./fixtures/bcv-usd-20261021.html", import.meta.url), "utf8");
// Hoja pública que www.bcv.org.ve servía el 2026-11-14 (vence 2026-11-20). Solo se
// verifica su firma contra el intermedio; las fechas no entran en la prueba.
const leaf = new X509Certificate(readFileSync(new URL("./fixtures/bcv-leaf-20261120.crt", import.meta.url)));
const intermediate = new X509Certificate(BCV_INTERMEDIATE_PEM);

describe("TLS · intermedio fijado de la fuente BCV", () => {
  it("la huella del PEM es la fijada y es el intermedio DV R36 de Sectigo", () => {
    expect(intermediate.fingerprint256).toBe(BCV_INTERMEDIATE_SHA256);
    expect(intermediate.subject).toContain("CN=Sectigo Public Server Authentication CA DV R36");
    expect(intermediate.ca).toBe(true);
    expect(new Date(intermediate.validTo).getTime()).toBeGreaterThan(Date.parse("2036-01-01T00:00:00Z"));
  });

  it("la cadena cierra: hoja del BCV ← intermedio fijado ← raíz pública del almacén de Node", () => {
    expect(leaf.checkIssued(intermediate)).toBe(true);
    expect(leaf.verify(intermediate.publicKey)).toBe(true);
    expect(leaf.checkHost("www.bcv.org.ve")).toBe("*.bcv.org.ve");
    const roots = rootCertificates.map(pem => new X509Certificate(pem));
    expect(roots.some(root => intermediate.checkIssued(root) && intermediate.verify(root.publicKey))).toBe(true);
    // El intermedio NO es una raíz: solo completa la cadena, no amplía la confianza.
    expect(rootCertificates).not.toContain(BCV_INTERMEDIATE_PEM);
  });

  it("el almacén conserva todas las raíces de Node y agrega solo el intermedio", () => {
    const ca = bcvTrustedCa();
    expect(ca).toHaveLength(rootCertificates.length + 1);
    expect(ca.slice(0, -1)).toEqual([...rootCertificates]);
    expect(ca.at(-1)).toBe(BCV_INTERMEDIATE_PEM);
  });

  it("el código no apaga la verificación ni toca el fetch global", () => {
    for (const file of ["../bcv-tls.ts", "../bcv-source.ts", "../bcv-sync.ts"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).not.toMatch(/rejectUnauthorized\s*:\s*false/);
      expect(source).not.toMatch(/NODE_TLS_REJECT_UNAUTHORIZED/);
      expect(source).not.toMatch(/globalThis\.fetch\s*=/);
    }
    expect(readFileSync(new URL("../bcv-tls.ts", import.meta.url), "utf8")).toMatch(/rejectUnauthorized: true/);
  });
});

describe("TLS · adaptador fetch sobre node:https (transporte HTTP de loopback)", () => {
  const servers: ReturnType<typeof createServer>[] = [];
  afterEach(async () => { await Promise.all(servers.splice(0).map(s => new Promise(r => s.close(r)))); });

  async function serve(handler: Parameters<typeof createServer>[1]) {
    const server = createServer(handler); servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const seen: RequestOptions[] = [];
    // Reemplaza solo el socket: las opciones TLS que arma el adaptador quedan registradas.
    const request = (url: URL, options: RequestOptions, onResponse: (response: IncomingMessage) => void) => {
      seen.push(options);
      return httpRequest({ host: "127.0.0.1", port, path: url.pathname + url.search, method: options.method,
        headers: options.headers, signal: options.signal }, onResponse);
    };
    return { fetch: bcvTlsFetch({ request }), seen };
  }

  it("pide con el almacén fijado, verificación encendida y SNI del host", async () => {
    const { fetch, seen } = await serve((_req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.end(html); });
    const response = await fetch(BCV_URL, { method: "GET", headers: { Accept: "text/html" } });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(html);
    expect(seen[0]).toMatchObject({ method: "GET", rejectUnauthorized: true, servername: "www.bcv.org.ve", agent: false });
    expect(seen[0].ca).toEqual([...bcvTrustedCa()]);
  });

  it("descomprime gzip y quita content-encoding/content-length", async () => {
    const { fetch } = await serve((_req, res) => {
      const body = gzipSync(html);
      res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip", "content-length": body.length });
      res.end(body);
    });
    const response = await fetch(BCV_URL);
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("content-length")).toBeNull();
    expect(await response.text()).toBe(html);
  });

  it("no sigue redirects: entrega el 302 con su location", async () => {
    let hits = 0;
    const { fetch } = await serve((_req, res) => { hits++; res.writeHead(302, { location: "https://evil.example/" }); res.end(); });
    const response = await fetch(BCV_URL, { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://evil.example/");
    expect(hits).toBe(1);
  });

  it("rechaza URL que no sea https y una señal ya abortada, sin conectar", async () => {
    const { fetch, seen } = await serve((_req, res) => res.end());
    await expect(fetch("http://www.bcv.org.ve/")).rejects.toThrow("BCV_TLS_HTTPS_ONLY");
    const controller = new AbortController(); controller.abort();
    await expect(fetch(BCV_URL, { signal: controller.signal })).rejects.toBeDefined();
    expect(seen).toHaveLength(0);
  });

  it("rechaza una codificación desconocida", async () => {
    const { fetch } = await serve((_req, res) => { res.writeHead(200, { "content-encoding": "zstd-raro" }); res.end("x"); });
    await expect(fetch(BCV_URL)).rejects.toThrow("BCV_TLS_UNSUPPORTED_ENCODING");
  });

  it("de punta a punta con fetchBcvObservation: misma cotización que el fetch nativo", async () => {
    const { fetch } = await serve((_req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.end(html); });
    const result = await fetchBcvObservation({ fetch, signal: new AbortController().signal, now: () => new Date("2026-10-21T07:00:00Z") });
    expect(result.quote).toMatchObject({ rate: "883.39630000", validOn: "2026-10-21" });
  });
});
