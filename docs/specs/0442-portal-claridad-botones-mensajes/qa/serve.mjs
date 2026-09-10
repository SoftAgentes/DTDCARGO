// Vista de componentes: sin backend, autenticación ni acciones reales.
import { createRequire } from "node:module";
import path from "node:path";
import {execFileSync} from "node:child_process";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const vitePath = require.resolve("vite", {paths: [path.dirname(require.resolve("vitest/package.json"))]});
const {createServer} = await import(pathToFileURL(vitePath));
const {default: react} = await import("@vitejs/plugin-react");
const {default: tailwind} = await import("@tailwindcss/postcss");
const root = process.cwd();
const server = await createServer({
 configFile:false, root, server:{host:"127.0.0.1",port:Number(process.env.QA_PORT || 4312),strictPort:true},
 resolve:{alias:{"@":root}},
 css:{postcss:{plugins:[tailwind()]}},
 plugins:[{name:"isolate-portal-qa",enforce:"pre",
  resolveId(id){if(id === "next/link" || id === "next/image" || /(?:^|\/)actions$/.test(id)) return "\0qa:"+id;},
  load(id){
   if(process.env.QA_BASELINE === "1" && id.replaceAll("\\", "/").endsWith("/envios/_components/PortalAlertasHub.tsx")) return execFileSync("git",["show","b8294664:app/portal/(app)/envios/_components/PortalAlertasHub.tsx"],{encoding:"utf8"});
   if(!id.startsWith("\0qa:")) return;
   if(id.endsWith("next/link")) return `import React from 'react'; export default function Link({children,...props}){return React.createElement('a',props,children)}`;
   if(id.endsWith("next/image")) return `import React from 'react'; export default function Image({fill,priority,unoptimized,...props}){return React.createElement('img',props)}`;
   return `const blocked=async()=>{throw new Error('Operación bloqueada en QA local')};export const createSupplierAction=blocked,updateSupplierAction=blocked,deleteSupplierAction=blocked,createPrealertaAction=blocked;`;
  }
 },react()],
});
await server.listen(); console.log(`QA http://127.0.0.1:${process.env.QA_PORT || 4312}/docs/specs/0442-portal-claridad-botones-mensajes/qa/index.html`);
