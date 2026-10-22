import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/postcss";
import type { IncomingMessage,ServerResponse } from "node:http";
import { configureQaExtraction,QaExtractionConfigurationError } from "./extraction-config";

async function main(){
const require=createRequire(path.join(process.cwd(),"package.json"));
const vitePath=require.resolve("vite",{paths:[path.dirname(require.resolve("vitest/package.json"))]});
const {createServer}=await import(pathToFileURL(vitePath).href);
const root=process.cwd();
const fixture="docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/fixture.tsx";
const port=Number(process.env.QA_PORT??4320);
const backend=process.env.QA_BACKEND_ORIGIN;
if(backend){const url=new URL(backend);if(url.protocol!=="http:"||!["127.0.0.1","localhost"].includes(url.hostname)||url.username||url.password||url.pathname!=="/"||url.search)throw new Error("QA backend must be a loopback origin");}
const extraction=configureQaExtraction(process.env,{port,backend});
process.env.DOCUMENT_IMPORT_ENABLED="true";process.env.DOCUMENT_IMPORT_PORTAL_ENABLED="true";
let handler:((req:IncomingMessage,res:ServerResponse,next:()=>void)=>Promise<void>)|null=null;
let pdfHandler:((req:IncomingMessage,res:ServerResponse)=>Promise<boolean>)|null=null;
const server=await createServer({
  configFile:false,envFile:false,root,publicDir:path.join(root,"public"),
  optimizeDeps:{entries:[fixture],noDiscovery:true,include:["react","react-dom/client","react/jsx-runtime","qrcode.react"]},
  define:{"process.env.NEXT_PUBLIC_SITE_URL":JSON.stringify(`http://127.0.0.1:${port}`)},
  resolve:{alias:{"@":root,"server-only":path.join(root,"vitest/server-only.stub.ts")}},
  css:{postcss:{plugins:[tailwind()]}},
  server:{host:"127.0.0.1",port,strictPort:true,watch:null,...(backend?{proxy:{"/api":{target:backend,changeOrigin:true},"/qa":{target:backend,changeOrigin:true}}}:{})},
  plugins:[{
    name:"synthetic-shared-document-local",
    enforce:"pre",
    configureServer(vite:{middlewares:{use:(callback:(req:IncomingMessage,res:ServerResponse,next:()=>void)=>void)=>void}}){vite.middlewares.use((req,res,next)=>{void(async()=>{if(pdfHandler&&await pdfHandler(req,res))return;const pathname=new URL(req.url??"/","http://127.0.0.1").pathname;const supplier=pathname==="/p/55555555-5555-4555-8555-555555555555";const portal=pathname.startsWith("/portal/compras");if(supplier||portal){res.statusCode=302;res.setHeader("Location","/"+fixture.replace("fixture.tsx","index.html")+"?page="+(supplier?"supplier":pathname.endsWith("/etiquetas")?"labels":"client"));res.end();return;}if(handler)await handler(req,res,next);else next();})().catch(()=>{res.statusCode=503;res.end("Demo unavailable");});});},
    transform(code:string,id:string){if(id.replaceAll("\\","/").endsWith("/app/globals.css"))return code.replace('@import "tailwindcss";','@import "tailwindcss" source(none);\n@source "../components/document-import";\n@source "../app/p/[token]";\n@source "../app/portal";\n@source "../docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion";');},
    resolveId(id:string){if(["next/navigation","next/link","next/image"].includes(id))return "\0local-demo:"+id;},
    load(id:string){if(id==="\0local-demo:next/navigation")return "export const useRouter=()=>({refresh(){},push(url){location.href=url}});";if(id==="\0local-demo:next/link")return "import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}";if(id==="\0local-demo:next/image")return "import React from 'react';export default function Image({fill,priority,unoptimized,...props}){return React.createElement('img',props)}";},
  },react()],
});
if(!backend){const {demoMiddleware}=await server.ssrLoadModule("/docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/server.ts");handler=await demoMiddleware(server,root,extraction);}
const {createPdfProxy}=await server.ssrLoadModule("/docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/pdf-proxy.ts");
const {renderConfirmedDocumentPdf}=await server.ssrLoadModule("/lib/studio/document-import/pdf.tsx");
pdfHandler=createPdfProxy({backend:backend??`http://127.0.0.1:${port}`,markbox:"DTD-DEMO",render:renderConfirmedDocumentPdf});
await server.listen();
console.log(`Demo sintética con PostgreSQL local: http://127.0.0.1:${port}/${fixture.replace("fixture.tsx","index.html")}`);
if(backend)console.log(`Frontend actualizado; conserva el PostgreSQL del proceso ${backend}. No hay conexión a producción.`);
}
main().catch(error=>{console.error(error instanceof QaExtractionConfigurationError?error.message:"La demo no pudo iniciar. Revisa su configuración local.");process.exitCode=1;});
