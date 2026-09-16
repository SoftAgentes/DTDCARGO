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
const port = Number(process.env.QA_PORT || 4316);
const baselineFiles = ["app/p/[token]/PackingListFormSection.tsx", "app/p/[token]/ProviderShareClient.tsx", "app/p/[token]/SupplierUploadSection.tsx", "app/portal/_components/ShareProviderButton.tsx"];
const server = await createServer({
  configFile: false, root,
  define: { "process.env.NEXT_PUBLIC_SITE_URL": JSON.stringify(`http://127.0.0.1:${port}`) }, publicDir: path.join(root, "public"),
  server: { host: "127.0.0.1", port, strictPort: true, headers: { "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' ws://127.0.0.1:*; frame-src 'self'; frame-ancestors 'self'" } },
  resolve: { alias: { "@": root } }, css: { postcss: { plugins: [tailwind()] } },
  plugins: [{ name: "isolated-provider-review", enforce: "pre",
    configureServer(server) { server.middlewares.use((req, res, next) => {
      if (req.method === "GET" && req.url === "/p/local-fixture-only-0468") { res.statusCode = 302; res.setHeader("Location", "/docs/specs/0468-portal-enlace-proveedor-ux/qa/index.html?page=supplier&embedded=1"); res.end(); return; }
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
console.log(`Vista local ficticia: http://127.0.0.1:${port}/docs/specs/0468-portal-enlace-proveedor-ux/qa/index.html`);
