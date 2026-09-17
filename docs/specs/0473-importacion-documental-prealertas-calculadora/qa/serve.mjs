import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const vitePath = require.resolve("vite", { paths: [path.dirname(require.resolve("vitest/package.json"))] });
const { createServer } = await import(pathToFileURL(vitePath));
const { default: react } = await import("@vitejs/plugin-react");
const { default: tailwind } = await import("@tailwindcss/postcss");
const root = process.cwd();
const port = Number(process.env.QA_PORT || 4318);
// 0473 no tiene "antes" contra qué comparar: el panel de carga, el editor y la
// pantalla de revisión son nuevos. Sin baseline, el fixture sólo monta lo actual.
const baselineFiles = [];
const server = await createServer({
  configFile: false, root,
  define: { "process.env.NEXT_PUBLIC_SITE_URL": JSON.stringify(`http://127.0.0.1:${port}`) }, publicDir: path.join(root, "public"),
  server: { host: "127.0.0.1", port, strictPort: true, headers: { "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' ws://127.0.0.1:*; frame-src 'self'; frame-ancestors 'self'" } },
  // `server-only` no existe en disco: lo aliasea el bundler de Next. Sin esto, el
  // lector real no se puede cargar acá y el fixture queda condenado a inventar.
  resolve: { alias: { "@": root, "server-only": path.join(root, "vitest/server-only.stub.ts") } },
  css: { postcss: { plugins: [tailwind()] } },
  plugins: [{ name: "isolated-import-review", enforce: "pre",
    configureServer(server) { server.middlewares.use((req, res, next) => {
      if (req.method === "GET" && req.url === "/p/local-fixture-only-0473") { res.statusCode = 302; res.setHeader("Location", "/docs/specs/0473-importacion-documental-prealertas-calculadora/qa/index.html?page=supplier&embedded=1"); res.end(); return; }
      /**
       * EL LECTOR DE VERDAD, no una maqueta.
       *
       * `extract.ts` es `server-only` y usa ExcelJS: no corre en el navegador. Pero
       * este servidor SÍ es Node, así que el archivo que se suelta en la pantalla se
       * manda acá, lo lee `extractDocument` —el mismo código que corre en producción—
       * y vuelve lo que entendió de verdad.
       *
       * La lectura asistida queda desarmada por construcción: sin `ANTHROPIC_API_KEY`
       * el fallback lanza en vez de llamar a nadie, y eso se traduce a un error legible.
       * Si un documento cae ahí, la pantalla lo dice en vez de disimularlo.
       */
      if (req.method === "POST" && req.url === "/qa/leer") {
        const trozos = [];
        req.on("data", (t) => trozos.push(t));
        req.on("end", async () => {
          res.setHeader("Content-Type", "application/json");
          try {
            delete process.env.ANTHROPIC_API_KEY;
            delete process.env.DOCUMENT_IMPORT_MODEL;
            const { extractDocument } = await server.ssrLoadModule("/lib/studio/document-import/extract.ts");
            const nombre = decodeURIComponent(String(req.headers["x-file-name"] || "documento.xlsx"));
            const draft = await extractDocument(new Uint8Array(Buffer.concat(trozos)), {
              fileName: nombre, kind: "unknown", sourceId: "qa", workspaceId: "qa",
            });
            res.end(JSON.stringify({ ok: true, draft }));
          } catch (error) {
            const mensaje = error instanceof Error ? error.message : String(error);
            const cayoAIA = /configuration_missing|lectura asistida/i.test(mensaje);
            // El tamaño recibido va en la respuesta a propósito: si no coincide con
            // el del archivo, el problema es el transporte y no el lector.
            const recibidos = Buffer.concat(trozos).length;
            res.end(JSON.stringify({ ok: false, cayoAIA, message: mensaje, recibidos }));
          }
        });
        return;
      }
      if (/^\/(?:p\/|api\/|portal\/)/.test(req.url || "")) { res.statusCode = 403; res.end("Fixture local: backend disabled"); return; }
      next();
    }); },
    resolveId(id) { if (id === "next/navigation" || id === "next/image" || id === "next/link") return "\0provider-qa:" + id; },
    load(id) {
      if (process.env.QA_BASELINE === "1") {
        const normalized = id.replaceAll("\\", "/");
        const file = baselineFiles.find(file => normalized.endsWith("/" + file));
        if (file) return execFileSync("git", ["show", "30a9f89082ac37e933280e0a4e3240c8ae9288e1:" + file], { encoding: "utf8" });
      }
      if (id === "\0provider-qa:next/navigation") return "export const useRouter=()=>({refresh(){}});";
      if (id === "\0provider-qa:next/image") return "import React from 'react';export default function Image({fill,priority,unoptimized,...props}){return React.createElement('img',props)}";
      if (id === "\0provider-qa:next/link") return "import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}";
    },
  }, react()],
});
await server.listen();
console.log(`Vista local ficticia: http://127.0.0.1:${port}/docs/specs/0473-importacion-documental-prealertas-calculadora/qa/index.html`);
