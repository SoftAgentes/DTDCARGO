import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import type { IncomingMessage,ServerResponse } from "node:http";
import { configureQaExtraction,QaExtractionConfigurationError,qaCaseRoute } from "./extraction-config";

async function main(){
const root=process.cwd();
const port=Number(process.env.QA_PORT??4320);
const backend=process.env.QA_BACKEND_ORIGIN;
const glmFrontend=process.env.QA_GLM_TEST_FRONTEND==="true";
const nativeOnly=process.env.QA_NATIVE_TEST_ENABLED==="true";
const runtimeRoot=process.env.QA_GLM_TEST_RUNTIME_ROOT;
const runtimeMode=runtimeRoot!==undefined;
const closedRuntimeRoot="C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/packing-list-portal-confirmacion-20261021";
const closedSourceRoot="C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/packing-glm-encargo-20261022";
const nativeContext=nativeOnly&&runtimeMode&&process.env.QA_GLM_TEST_ENABLED==="false"
  &&process.env.QA_GLM_TEST_FRONTEND==="false"&&process.env.QA_PDF_EXTRACTION_ENABLED==="false"
  &&((port===4325&&backend===undefined)||(port===4326&&backend==="http://127.0.0.1:4325"));
const glmContext=!nativeOnly&&((process.env.QA_GLM_TEST_ENABLED==="true"&&!glmFrontend&&port===4323&&backend===undefined)
  ||(glmFrontend&&process.env.QA_GLM_TEST_ENABLED!=="true"&&port===4324&&backend==="http://127.0.0.1:4323"));
if(nativeOnly&&!nativeContext)throw new QaExtractionConfigurationError();
if(runtimeMode&&(runtimeRoot!==closedRuntimeRoot||path.resolve(root)!==path.resolve(closedSourceRoot)
  ||(!nativeContext&&!glmContext))){
  throw new QaExtractionConfigurationError();
}
if(backend){const url=new URL(backend);if(url.protocol!=="http:"||!["127.0.0.1","localhost"].includes(url.hostname)||url.username||url.password||url.pathname!=="/"||url.search)throw new Error("QA backend must be a loopback origin");}
const extraction=configureQaExtraction(process.env,{port,backend});
if(glmFrontend&&(port!==4324||backend!=="http://127.0.0.1:4323"||extraction.glmTest))throw new QaExtractionConfigurationError();
// The later GO supplies a clean, owned cache root. No inherited/default vendor cache.
const requestedCache=process.env.XDG_CACHE_HOME;
const cacheRoot=runtimeMode&&requestedCache?path.resolve(requestedCache):undefined;
const within=(parent:string,candidate:string)=>{const relative=path.relative(parent,candidate);return relative===""||(!path.isAbsolute(relative)&&relative!==".."&&!relative.startsWith(".."+path.sep));};
if(runtimeMode&&(!requestedCache||!path.isAbsolute(requestedCache)||!cacheRoot||path.parse(cacheRoot).root===cacheRoot
  ||[root,closedRuntimeRoot,"C:/Users/AKX generator/.config/dtdcargo"].some(reserved=>within(reserved,cacheRoot)||within(cacheRoot,reserved)))){
  throw new QaExtractionConfigurationError();
}
const runtimeEntries={
  "vite": "node_modules/.pnpm/vite@8.0.16_@types+node@20._db1984a4be61a31045a112f464fedc2c/node_modules/vite/dist/node/index.js",
  "@vitejs/plugin-react": "node_modules/.pnpm/@vitejs+plugin-react@6.0.2__e3f9902fed70d8be789b84b255b6443a/node_modules/@vitejs/plugin-react/dist/index.js",
  "@tailwindcss/postcss": "node_modules/.pnpm/@tailwindcss+postcss@4.3.0/node_modules/@tailwindcss/postcss/dist/index.mjs"
};
const runtimeAliases:ReadonlyArray<readonly [string,string]>=[
  [
    "react",
    "node_modules/.pnpm/react@19.2.4/node_modules/react"
  ],
  [
    "react-dom",
    "node_modules/.pnpm/react-dom@19.2.4_react@19.2.4/node_modules/react-dom"
  ],
  [
    "next",
    "node_modules/.pnpm/next@16.2.11_@babel+core@7._d08a723af2f56ed11bad03bde5cbd597/node_modules/next"
  ],
  [
    "exceljs",
    "node_modules/.pnpm/exceljs@4.4.0/node_modules/exceljs"
  ],
  [
    "fflate",
    "node_modules/.pnpm/fflate@0.8.3/node_modules/fflate"
  ],
  [
    "@supabase/supabase-js",
    "node_modules/.pnpm/@supabase+supabase-js@2.106.1/node_modules/@supabase/supabase-js"
  ],
  [
    "@supabase/ssr",
    "node_modules/.pnpm/@supabase+ssr@0.5.2_@supabase+supabase-js@2.106.1/node_modules/@supabase/ssr"
  ],
  [
    "@anthropic-ai/sdk",
    "node_modules/.pnpm/@anthropic-ai+sdk@0.98.0_zod@4.4.3/node_modules/@anthropic-ai/sdk"
  ],
  [
    "clsx",
    "node_modules/.pnpm/clsx@2.1.1/node_modules/clsx"
  ],
  [
    "tailwind-merge",
    "node_modules/.pnpm/tailwind-merge@3.6.0/node_modules/tailwind-merge"
  ],
  [
    "qrcode",
    "node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode"
  ],
  [
    "qrcode.react",
    "node_modules/.pnpm/qrcode.react@4.2.0_react@19.2.4/node_modules/qrcode.react"
  ],
  [
    "@react-pdf/renderer",
    "node_modules/.pnpm/@react-pdf+renderer@4.5.1_react@19.2.4/node_modules/@react-pdf/renderer"
  ],
  [
    "sharp",
    "node_modules/.pnpm/sharp@0.35.3_@types+node@20.19.41/node_modules/sharp"
  ],
  [
    "@electric-sql/pglite",
    "node_modules/.pnpm/@electric-sql+pglite@0.5.8/node_modules/@electric-sql/pglite"
  ]
];
type SsrNodeRow={id:string;aliasTarget:string;entry:string;anchor:string;format:"commonjs"|"module";names:readonly string[]};
// Finite SSR entrypoints read from the admitted physical package manifests.
const ssrNodeDefinitions:ReadonlyArray<SsrNodeRow>=[
  {
    "id": "react",
    "aliasTarget": "node_modules/.pnpm/react@19.2.4/node_modules/react",
    "entry": "node_modules/.pnpm/react@19.2.4/node_modules/react/index.js",
    "anchor": "node_modules/.pnpm/react@19.2.4/node_modules/react/package.json",
    "format": "commonjs",
    "names": [
      "Activity",
      "Children",
      "Component",
      "Fragment",
      "Profiler",
      "PureComponent",
      "StrictMode",
      "Suspense",
      "__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE",
      "__COMPILER_RUNTIME",
      "act",
      "cache",
      "cacheSignal",
      "captureOwnerStack",
      "cloneElement",
      "createContext",
      "createElement",
      "createRef",
      "forwardRef",
      "isValidElement",
      "lazy",
      "memo",
      "startTransition",
      "unstable_useCacheRefresh",
      "use",
      "useActionState",
      "useCallback",
      "useContext",
      "useDebugValue",
      "useDeferredValue",
      "useEffect",
      "useEffectEvent",
      "useId",
      "useImperativeHandle",
      "useInsertionEffect",
      "useLayoutEffect",
      "useMemo",
      "useOptimistic",
      "useReducer",
      "useRef",
      "useState",
      "useSyncExternalStore",
      "useTransition",
      "version"
    ]
  },
  {
    "id": "react/jsx-runtime",
    "aliasTarget": "node_modules/.pnpm/react@19.2.4/node_modules/react/jsx-runtime",
    "entry": "node_modules/.pnpm/react@19.2.4/node_modules/react/jsx-runtime.js",
    "anchor": "node_modules/.pnpm/react@19.2.4/node_modules/react/package.json",
    "format": "commonjs",
    "names": [
      "Fragment",
      "jsx",
      "jsxs"
    ]
  },
  {
    "id": "react/jsx-dev-runtime",
    "aliasTarget": "node_modules/.pnpm/react@19.2.4/node_modules/react/jsx-dev-runtime",
    "entry": "node_modules/.pnpm/react@19.2.4/node_modules/react/jsx-dev-runtime.js",
    "anchor": "node_modules/.pnpm/react@19.2.4/node_modules/react/package.json",
    "format": "commonjs",
    "names": [
      "Fragment",
      "jsxDEV"
    ]
  },
  {
    "id": "react-dom",
    "aliasTarget": "node_modules/.pnpm/react-dom@19.2.4_react@19.2.4/node_modules/react-dom",
    "entry": "node_modules/.pnpm/react-dom@19.2.4_react@19.2.4/node_modules/react-dom/index.js",
    "anchor": "node_modules/.pnpm/react-dom@19.2.4_react@19.2.4/node_modules/react-dom/package.json",
    "format": "commonjs",
    "names": [
      "__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE",
      "createPortal",
      "flushSync",
      "preconnect",
      "prefetchDNS",
      "preinit",
      "preinitModule",
      "preload",
      "preloadModule",
      "requestFormReset",
      "unstable_batchedUpdates",
      "useFormState",
      "useFormStatus",
      "version"
    ]
  },
  {
    "id": "react-dom/client",
    "aliasTarget": "node_modules/.pnpm/react-dom@19.2.4_react@19.2.4/node_modules/react-dom/client",
    "entry": "node_modules/.pnpm/react-dom@19.2.4_react@19.2.4/node_modules/react-dom/client.js",
    "anchor": "node_modules/.pnpm/react-dom@19.2.4_react@19.2.4/node_modules/react-dom/package.json",
    "format": "commonjs",
    "names": [
      "createRoot",
      "hydrateRoot",
      "version"
    ]
  },
  {
    "id": "next",
    "aliasTarget": "node_modules/.pnpm/next@16.2.11_@babel+core@7._d08a723af2f56ed11bad03bde5cbd597/node_modules/next",
    "entry": "node_modules/.pnpm/next@16.2.11_@babel+core@7._d08a723af2f56ed11bad03bde5cbd597/node_modules/next/dist/server/next.js",
    "anchor": "node_modules/.pnpm/next@16.2.11_@babel+core@7._d08a723af2f56ed11bad03bde5cbd597/node_modules/next/package.json",
    "format": "commonjs",
    "names": []
  },
  {
    "id": "next/headers",
    "aliasTarget": "node_modules/.pnpm/next@16.2.11_@babel+core@7._d08a723af2f56ed11bad03bde5cbd597/node_modules/next/headers",
    "entry": "node_modules/.pnpm/next@16.2.11_@babel+core@7._d08a723af2f56ed11bad03bde5cbd597/node_modules/next/headers.js",
    "anchor": "node_modules/.pnpm/next@16.2.11_@babel+core@7._d08a723af2f56ed11bad03bde5cbd597/node_modules/next/package.json",
    "format": "commonjs",
    "names": [
      "cookies",
      "headers",
      "draftMode"
    ]
  },
  {
    "id": "next/server",
    "aliasTarget": "node_modules/.pnpm/next@16.2.11_@babel+core@7._d08a723af2f56ed11bad03bde5cbd597/node_modules/next/server",
    "entry": "node_modules/.pnpm/next@16.2.11_@babel+core@7._d08a723af2f56ed11bad03bde5cbd597/node_modules/next/server.js",
    "anchor": "node_modules/.pnpm/next@16.2.11_@babel+core@7._d08a723af2f56ed11bad03bde5cbd597/node_modules/next/package.json",
    "format": "commonjs",
    "names": [
      "NextRequest",
      "NextResponse",
      "ImageResponse",
      "userAgentFromString",
      "userAgent",
      "URLPattern",
      "after",
      "connection"
    ]
  },
  {
    "id": "exceljs",
    "aliasTarget": "node_modules/.pnpm/exceljs@4.4.0/node_modules/exceljs",
    "entry": "node_modules/.pnpm/exceljs@4.4.0/node_modules/exceljs/excel.js",
    "anchor": "node_modules/.pnpm/exceljs@4.4.0/node_modules/exceljs/package.json",
    "format": "commonjs",
    "names": []
  },
  {
    "id": "fflate",
    "aliasTarget": "node_modules/.pnpm/fflate@0.8.3/node_modules/fflate",
    "entry": "node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/index.mjs",
    "anchor": "node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/package.json",
    "format": "module",
    "names": [
      "Unzip",
      "UnzipInflate",
      "strToU8",
      "unzipSync",
      "zipSync"
    ]
  },
  {
    "id": "@supabase/supabase-js",
    "aliasTarget": "node_modules/.pnpm/@supabase+supabase-js@2.106.1/node_modules/@supabase/supabase-js",
    "entry": "node_modules/.pnpm/@supabase+supabase-js@2.106.1/node_modules/@supabase/supabase-js/dist/index.mjs",
    "anchor": "node_modules/.pnpm/@supabase+supabase-js@2.106.1/node_modules/@supabase/supabase-js/package.json",
    "format": "module",
    "names": [
      "createClient"
    ]
  },
  {
    "id": "@supabase/ssr",
    "aliasTarget": "node_modules/.pnpm/@supabase+ssr@0.5.2_@supabase+supabase-js@2.106.1/node_modules/@supabase/ssr",
    "entry": "node_modules/.pnpm/@supabase+ssr@0.5.2_@supabase+supabase-js@2.106.1/node_modules/@supabase/ssr/dist/main/index.js",
    "anchor": "node_modules/.pnpm/@supabase+ssr@0.5.2_@supabase+supabase-js@2.106.1/node_modules/@supabase/ssr/package.json",
    "format": "commonjs",
    "names": [
      "createServerClient"
    ]
  },
  {
    "id": "@anthropic-ai/sdk",
    "aliasTarget": "node_modules/.pnpm/@anthropic-ai+sdk@0.98.0_zod@4.4.3/node_modules/@anthropic-ai/sdk",
    "entry": "node_modules/.pnpm/@anthropic-ai+sdk@0.98.0_zod@4.4.3/node_modules/@anthropic-ai/sdk/index.mjs",
    "anchor": "node_modules/.pnpm/@anthropic-ai+sdk@0.98.0_zod@4.4.3/node_modules/@anthropic-ai/sdk/package.json",
    "format": "module",
    "names": []
  },
  {
    "id": "clsx",
    "aliasTarget": "node_modules/.pnpm/clsx@2.1.1/node_modules/clsx",
    "entry": "node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs",
    "anchor": "node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/package.json",
    "format": "module",
    "names": []
  },
  {
    "id": "tailwind-merge",
    "aliasTarget": "node_modules/.pnpm/tailwind-merge@3.6.0/node_modules/tailwind-merge",
    "entry": "node_modules/.pnpm/tailwind-merge@3.6.0/node_modules/tailwind-merge/dist/bundle-mjs.mjs",
    "anchor": "node_modules/.pnpm/tailwind-merge@3.6.0/node_modules/tailwind-merge/package.json",
    "format": "module",
    "names": []
  },
  {
    "id": "qrcode",
    "aliasTarget": "node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode",
    "entry": "node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/lib/index.js",
    "anchor": "node_modules/.pnpm/qrcode@1.5.4/node_modules/qrcode/package.json",
    "format": "commonjs",
    "names": []
  },
  {
    "id": "qrcode.react",
    "aliasTarget": "node_modules/.pnpm/qrcode.react@4.2.0_react@19.2.4/node_modules/qrcode.react",
    "entry": "node_modules/.pnpm/qrcode.react@4.2.0_react@19.2.4/node_modules/qrcode.react/lib/esm/index.js",
    "anchor": "node_modules/.pnpm/qrcode.react@4.2.0_react@19.2.4/node_modules/qrcode.react/package.json",
    "format": "module",
    "names": [
      "QRCodeSVG"
    ]
  },
  {
    "id": "@react-pdf/renderer",
    "aliasTarget": "node_modules/.pnpm/@react-pdf+renderer@4.5.1_react@19.2.4/node_modules/@react-pdf/renderer",
    "entry": "node_modules/.pnpm/@react-pdf+renderer@4.5.1_react@19.2.4/node_modules/@react-pdf/renderer/lib/react-pdf.js",
    "anchor": "node_modules/.pnpm/@react-pdf+renderer@4.5.1_react@19.2.4/node_modules/@react-pdf/renderer/package.json",
    "format": "module",
    "names": [
      "Document",
      "Font",
      "Image",
      "Page",
      "StyleSheet",
      "Text",
      "View",
      "renderToBuffer"
    ]
  },
  {
    "id": "sharp",
    "aliasTarget": "node_modules/.pnpm/sharp@0.35.3_@types+node@20.19.41/node_modules/sharp",
    "entry": "node_modules/.pnpm/sharp@0.35.3_@types+node@20.19.41/node_modules/sharp/dist/index.mjs",
    "anchor": "node_modules/.pnpm/sharp@0.35.3_@types+node@20.19.41/node_modules/sharp/package.json",
    "format": "module",
    "names": []
  },
  {
    "id": "@electric-sql/pglite",
    "aliasTarget": "node_modules/.pnpm/@electric-sql+pglite@0.5.8/node_modules/@electric-sql/pglite",
    "entry": "node_modules/.pnpm/@electric-sql+pglite@0.5.8/node_modules/@electric-sql/pglite/dist/index.js",
    "anchor": "node_modules/.pnpm/@electric-sql+pglite@0.5.8/node_modules/@electric-sql/pglite/package.json",
    "format": "module",
    "names": [
      "PGlite"
    ]
  }
];
const ssrNodeRows:ReadonlyArray<SsrNodeRow>=ssrNodeDefinitions.map(row=>({...row,
  aliasTarget:path.join(closedRuntimeRoot,row.aliasTarget).replaceAll("\\","/"),
  entry:path.join(closedRuntimeRoot,row.entry).replaceAll("\\","/"),
  anchor:path.join(closedRuntimeRoot,row.anchor).replaceAll("\\","/"),
}));
const ssrVirtualPrefix="\0sdd0473-node-cjs:";
const normalizeSsrId=(id:string)=>id.replaceAll("\\","/");
function resolveSsrNode(id:string,options:{ssr?:boolean}|undefined){
  if(!runtimeMode||!options?.ssr)return undefined;
  const normalized=normalizeSsrId(id);
  const rowIndex=ssrNodeRows.findIndex(row=>normalized===row.id||normalized===row.aliasTarget||normalized===row.entry);
  if(rowIndex<0)return undefined;
  const row=ssrNodeRows[rowIndex];
  if(row.format==="module")return row.entry; // exact Node import-condition ESM file; Vite normal ESM processing
  return ssrVirtualPrefix+String(rowIndex);
}
function loadSsrNode(id:string,options:{ssr?:boolean}|undefined){
  if(!id.startsWith(ssrVirtualPrefix))return undefined;
  if(!runtimeMode||!options?.ssr)throw new QaExtractionConfigurationError();
  const indexText=id.slice(ssrVirtualPrefix.length);
  if(!/^(0|[1-9][0-9]*)$/.test(indexText))throw new QaExtractionConfigurationError();
  const row=ssrNodeRows[Number(indexText)];
  if(!row||row.format!=="commonjs"||!row.names.every(name=>/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)))throw new QaExtractionConfigurationError();
  return [
    'import { createRequire as createLocalRequire } from "node:module";',
    'const localRequire=createLocalRequire('+JSON.stringify(row.anchor)+');',
    'const actualModule=localRequire('+JSON.stringify(row.entry)+');',
    'export default actualModule;',
    ...row.names.map(name=>'export const '+name+'=actualModule['+JSON.stringify(name)+'];'),
  ].join("\n");
}
const require=createRequire(path.join(runtimeMode?closedRuntimeRoot:root,"package.json"));
const vitePath=runtimeMode?path.join(closedRuntimeRoot,runtimeEntries.vite)
  :require.resolve("vite",{paths:[path.dirname(require.resolve("vitest/package.json"))]});
// No third-party import occurs until the closed runtime/context/cache checks pass.
const {createServer}=await import(pathToFileURL(vitePath).href);
const react=(runtimeMode?await import(pathToFileURL(path.join(closedRuntimeRoot,runtimeEntries["@vitejs/plugin-react"])).href)
  :await import("@vitejs/plugin-react")).default;
const tailwind=(runtimeMode?await import(pathToFileURL(path.join(closedRuntimeRoot,runtimeEntries["@tailwindcss/postcss"])).href)
  :await import("@tailwindcss/postcss")).default;
const fixture="docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/fixture.tsx";
const ownedGlobals=path.join(root,"app/globals.css").replaceAll("\\","/");
const tailwindRelative=runtimeMode?path.relative(path.join(root,"app"),path.join(closedRuntimeRoot,"node_modules/.pnpm/tailwindcss@4.3.0/node_modules/tailwindcss/index.css")).replaceAll("\\","/"):null;
if(runtimeMode&&tailwindRelative!=="../../packing-list-portal-confirmacion-20261021/node_modules/.pnpm/tailwindcss@4.3.0/node_modules/tailwindcss/index.css")throw new QaExtractionConfigurationError();
process.env.DOCUMENT_IMPORT_ENABLED="true";process.env.DOCUMENT_IMPORT_PORTAL_ENABLED="true";
let handler:((req:IncomingMessage,res:ServerResponse,next:()=>void)=>Promise<void>)|null=null;
let pdfHandler:((req:IncomingMessage,res:ServerResponse)=>Promise<boolean>)|null=null;
const server=await createServer({
  configFile:false,envFile:false,root,publicDir:path.join(root,"public"),
  ...(runtimeMode?{cacheDir:path.join(cacheRoot!,nativeOnly?"sdd0473-native-vite":"sdd0473-glm-vite",String(port))}:{}),
  optimizeDeps:{entries:[fixture],noDiscovery:true,include:["react","react-dom/client","react/jsx-runtime","qrcode.react"]},
  define:{"process.env.NEXT_PUBLIC_SITE_URL":JSON.stringify(`http://127.0.0.1:${port}`),"process.env.NEXT_PUBLIC_QA_GLM_TEST":JSON.stringify(glmFrontend||!!extraction.glmTest?"true":"false"),"process.env.NEXT_PUBLIC_QA_NATIVE_TEST":JSON.stringify(nativeOnly?"true":"false")},
  resolve:{alias:runtimeMode?[
    {find:"@",replacement:root},
    {find:"server-only",replacement:path.join(root,"vitest/server-only.stub.ts")},
    ...runtimeAliases.map(([name,relative])=>({
      // The exact Next adapters below must reach resolveId without prefix rewriting.
      find:name==="next"?/^next(?!\/(?:navigation|link|image)$)(?=\/|$)/:new RegExp("^"+name.replaceAll(".","\\.")+"(?=/|$)"),
      replacement:path.join(closedRuntimeRoot,relative).replaceAll("\\","/"),
    })),
  ]:{"@":root,"server-only":path.join(root,"vitest/server-only.stub.ts")}},
  css:{postcss:{plugins:[tailwind()]}},
  server:{host:"127.0.0.1",port,strictPort:true,watch:null,...(runtimeMode?{fs:{strict:true,allow:[root,path.join(closedRuntimeRoot,"node_modules"),cacheRoot!]}}:{}),...(backend?{proxy:{"/api":{target:backend,changeOrigin:true},"/qa":{target:backend,changeOrigin:true}}}:{})},
  plugins:[{
    name:"synthetic-shared-document-local",
    enforce:"pre",
    configureServer(vite:{middlewares:{use:(callback:(req:IncomingMessage,res:ServerResponse,next:()=>void)=>void)=>void}}){vite.middlewares.use((req,res,next)=>{void(async()=>{if(pdfHandler&&await pdfHandler(req,res))return;const pathname=new URL(req.url??"/","http://127.0.0.1").pathname;const canonical=(glmFrontend||extraction.glmTest)?qaCaseRoute(pathname):null;if(canonical){res.statusCode=302;res.setHeader("Location","/"+fixture.replace("fixture.tsx","index.html")+`?page=${canonical.page}&case=${canonical.kind}`);res.end();return;}const supplier=pathname==="/p/55555555-5555-4555-8555-555555555555";const portal=pathname.startsWith("/portal/compras");if(!(glmFrontend||extraction.glmTest)&&(supplier||portal)){res.statusCode=302;res.setHeader("Location","/"+fixture.replace("fixture.tsx","index.html")+"?page="+(supplier?"supplier":pathname.endsWith("/etiquetas")?"labels":"client"));res.end();return;}if(handler)await handler(req,res,next);else next();})().catch(()=>{res.statusCode=503;res.end("Demo unavailable");});});},
    transform(code:string,id:string){
      const normalizedId=id.replaceAll("\\","/");
      const ownedStyle=runtimeMode?normalizedId.split("?")[0]===ownedGlobals:normalizedId.endsWith("/app/globals.css");
      if(ownedStyle){
        const bare='@import "tailwindcss";';
        if(runtimeMode&&code.split(bare).length!==2)throw new QaExtractionConfigurationError();
        const selectedImport=runtimeMode?'@import "'+tailwindRelative+'" source(none);':'@import "tailwindcss" source(none);';
        return code.replace(bare,selectedImport+'\n@source "../components/document-import";\n@source "../app/p/[token]";\n@source "../app/portal";\n@source "../docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion";');
      }
    },
    resolveId(id:string,_importer:string|undefined,options?:{ssr?:boolean}){const native=resolveSsrNode(id,options);if(native!==undefined)return native;if(["next/navigation","next/link","next/image"].includes(id))return "\0local-demo:"+id;},
    load(id:string,options?:{ssr?:boolean}){const native=loadSsrNode(id,options);if(native!==undefined)return native;if(id==="\0local-demo:next/navigation")return "export const useRouter=()=>({refresh(){},push(url){location.href=url}});";if(id==="\0local-demo:next/link")return "import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}";if(id==="\0local-demo:next/image")return "import React from 'react';export default function Image({fill,priority,unoptimized,...props}){return React.createElement('img',props)}";},
  },react()],
});
if(!backend){const {demoMiddleware}=await server.ssrLoadModule("/docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/server.ts");handler=await demoMiddleware(server,root,extraction,{nativeOnly});}
if(!nativeOnly){
const {createPdfProxy}=await server.ssrLoadModule("/docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/pdf-proxy.ts");
const {renderConfirmedDocumentPdf}=await server.ssrLoadModule("/lib/studio/document-import/pdf.tsx");
if(!glmFrontend&&!extraction.glmTest)pdfHandler=createPdfProxy({backend:backend??`http://127.0.0.1:${port}`,markbox:"DTD-DEMO",render:renderConfirmedDocumentPdf});
}
await server.listen();
console.log(`Demo sintética con PostgreSQL local: http://127.0.0.1:${port}/${fixture.replace("fixture.tsx","index.html")}`);
if(backend)console.log(`Frontend actualizado; conserva el PostgreSQL del proceso ${backend}. No hay conexión a producción.`);
}
main().catch(error=>{console.error(error instanceof QaExtractionConfigurationError?error.message:"La demo no pudo iniciar. Revisa su configuración local.");process.exitCode=1;});
