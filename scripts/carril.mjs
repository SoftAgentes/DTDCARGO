#!/usr/bin/env node
/**
 * Clasificador de carril de integración (carriles aprobados por Sam el 2026-11-20).
 *
 * Recibe la lista de archivos de un diff y decide el carril:
 *   - `rapido`:   la PR entra con el CI en verde y se revisa en la revisión de madrugada.
 *   - `revision`: revisión independiente APPROVED + CI verde en la cabeza exacta (la regla de siempre).
 *
 * Dos capas, conservadoras. Por ruta: un archivo es candidato a `rapido` solo si cae en una lista corta de rutas
 * seguras (documentos, textos, pruebas, estilos, pantallas y recursos estáticos) y no toca nada sensible. Por
 * contenido, para el código (las pantallas): se lee el archivo completo en la base y en la cabeza, y si cualquiera
 * de las dos versiones toca puertas, sesión, lecturas o escrituras de datos, o importa una server action, es
 * `revision`. Sin leer el archivo, o si no es texto, también. Todo lo demás, incluido lo que no se reconoce, es
 * `revision`. Basta un archivo `revision` para que toda la PR lo sea.
 *
 * Contrato (lo usa el tren del Director; detalle en docs/runbooks/codex-engineering.md, «Carriles de integración»):
 *   node scripts/carril.mjs --json --pr <N>              # el del tren: diff, cabeza (`head`) y archivos con git
 *   git diff --no-renames B H | node scripts/carril.mjs --json --diff --base B --head H   # diff verificado
 *   node scripts/carril.mjs --json <ruta>...             # solo nombres (las pantallas dan revision)
 * Códigos de salida: 0 = rapido, 1 = revision, 2 = error o ayuda (no se pudo clasificar; cuenta como revision).
 *
 * Sin dependencias: solo módulos de Node.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const VERSION = 3;
export const SALIDA = Object.freeze({ rapido: 0, revision: 1, error: 2 });

// ---------------------------------------------------------------------------------------------------------------
// Reglas fijas: siempre `revision`, sea código, documento o prueba.
// ---------------------------------------------------------------------------------------------------------------

/**
 * Cada regla: `id`, `motivo`, y `coincide(ruta)`. `tambienPruebas: false` deja pasar los archivos de prueba (por
 * ejemplo, `actions.test.ts` es una prueba, no una server action); las reglas por carpeta valen para todo.
 */
const REGLAS_FIJAS = [
  {
    id: "carriles-y-gobernanza",
    motivo: "cambia las reglas de los agentes, de los carriles o de la gobernanza",
    tambienPruebas: true,
    coincide: (r) =>
      [
        "scripts/carril.mjs",
        "scripts/tests/carril.node.mjs",
        "docs/runbooks/codex-engineering.md",
        "docs/runbooks/aplicar-migraciones-prod.md",
        "docs/runbooks/publicacion-automatica-web.md",
        "docs/engineering/project-rules.md",
        "scripts/__tests__/ci-workflow-contract.test.mjs",
      ].includes(r) ||
      // Los handoffs (`.agents/handoffs/`) son documentos de cada tarea: no cambian reglas.
      (/^(\.agents|\.claude|\.codex|\.harness|docs\/governance)\//.test(r) &&
        !/^\.agents\/handoffs\/[^/]+\.md$/.test(r)) ||
      /(^|\/)(AGENTS|CLAUDE)\.md$/i.test(r),
  },
  {
    id: "secretos",
    motivo: "archivo `.env*`",
    tambienPruebas: true,
    coincide: (r) => /(^|\/)\.env/i.test(r),
  },
  {
    id: "ci",
    motivo: "CI y automatización de GitHub (`.github/`)",
    tambienPruebas: true,
    coincide: (r) => r.startsWith(".github/"),
  },
  {
    id: "base-de-datos",
    motivo: "migraciones, RLS, permisos de base o acceso directo a la base",
    tambienPruebas: true,
    coincide: (r) => /^(supabase|lib\/db)\//.test(r) || /\.sql$/i.test(r),
  },
  {
    id: "infraestructura",
    motivo: "infraestructura, contenedores o servidor",
    tambienPruebas: true,
    coincide: (r) =>
      r.startsWith("infra/") || /(^|\/)(Dockerfile[^/]*|\.dockerignore|(docker-)?compose[^/]*\.ya?ml)$/i.test(r),
  },
  {
    id: "consolidados",
    motivo: "carga de consolidados (`scripts/consolidados/`)",
    tambienPruebas: true,
    coincide: (r) => r.startsWith("scripts/consolidados/"),
  },
  {
    id: "registro-y-acceso",
    motivo: "registro, entrada, invitación o acceso (portal o Studio)",
    tambienPruebas: true,
    coincide: (r) =>
      /^app\/(registro|entrar|invitar|acceso|abrir|activar|verificar)\//.test(r) ||
      /^app\/[^/]+\/\(auth\)\//.test(r) ||
      r.startsWith("lib/auth/") ||
      /^(proxy|middleware)\.[cm]?[jt]sx?$/.test(r),
  },
  {
    id: "legal",
    motivo: "textos y reglas legales (T&C, privacidad)",
    tambienPruebas: true,
    coincide: (r) =>
      r.startsWith("lib/studio/legal/") ||
      r === "lib/legal-public.ts" ||
      /^app\/(terminos|privacidad|cookies)\//.test(r),
  },
  {
    id: "rutas-api",
    motivo: "ruta de API o webhook (escribe o recibe datos de fuera)",
    tambienPruebas: true,
    coincide: (r) => r.startsWith("app/api/") || /(^|\/)route\.[cm]?[jt]sx?$/.test(r),
  },
  {
    id: "privado",
    motivo: "carpeta `private/`",
    tambienPruebas: true,
    coincide: (r) => r.startsWith("private/"),
  },
  {
    id: "dependencias-y-configuracion",
    motivo: "dependencias, build o configuración global (lint, tipos, pruebas, Next)",
    tambienPruebas: true,
    coincide: (r) =>
      /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.npmrc|\.nvmrc|vercel\.json|skills-lock\.json|vitest\.setup\.ts)$/.test(
        r,
      ) ||
      /^(next|eslint|vitest|playwright[^/]*|postcss|tailwind)\.config\.[cm]?[jt]s$/.test(r) ||
      /^tsconfig[^/]*\.json$/.test(r),
  },
  {
    id: "pagina-con-sesion",
    motivo: "página de una zona con sesión (Studio, portal, móvil, back, interno): suele llevar puertas y lecturas",
    tambienPruebas: false,
    coincide: (r) => /^app\/(studio|portal|m|back|interno|admin)\/(.+\/)?page\.[cm]?[jt]sx?$/.test(r),
  },
  {
    id: "server-actions",
    motivo: "server action (escribe datos)",
    tambienPruebas: false,
    coincide: (r) => /(^|\/)_actions\//.test(r) || /(^|[/_.-])actions?([_.-][^/]*)?\.[cm]?[jt]sx?$/i.test(base(r)),
  },
];

// ---------------------------------------------------------------------------------------------------------------
// Temas sensibles por palabra en la ruta (solo para código: no se aplican a documentos, textos, pruebas ni estilos).
// Cada palabra se compara con el comienzo de cada pedazo de la ruta (separado por `/ - _ . ( ) [ ]` y por
// mayúsculas), así `WhatsAppFAB.tsx`, `estado-de-cuenta/` o `facturacion/` caen. Ante la duda, la palabra entra.
// ---------------------------------------------------------------------------------------------------------------

const TEMAS = [
  {
    id: "facturacion-pagos-montos",
    motivo: "facturación, pagos, contabilidad, tarifas o montos",
    palabras: [
      /^factur/, /^invoice/, /^billing/, /^cobr(o|os|anza|anzas)$/, /^pagos?$/, /^payments?$/, /^pay$/, /^contab/,
      /^accounting/, /^financ/, /^finanz/, /^fiscal/, /^seniat/, /^tesorer/, /^treasury/, /^gastos?$/, /^expenses?$/,
      /^nomina/, /^payroll/, /^finiquito/, /^rendici/, /^renditions?$/, /^recibos?$/, /^receipts?$/, /^comprobante/,
      /^cuentas?$/, /^cost/, /^prices?$/, /^precio/, /^montos?$/, /^money/, /^tarifa/, /^rates?$/, /^bcv/, /^fx$/,
      /^cotiz/, /^estimad/, /^estimacion/, /^calcul/, /^calc$/, /^compras?$/, /^purchase/, /^ventas?$/, /^sales$/,
      /^club$/, /^fidelizacion/, /^referidos?$/, /^saldos?$/, /^credito/, /^deudas?$/, /^cx[cp]$/, /^caja$/,
      /^bancos?$/, /^ledger/, /^settlement/, /^wallet/,
    ],
  },
  {
    id: "permisos-y-acceso",
    motivo: "permisos, roles, sesión, acceso o reglas legales",
    palabras: [
      /^auth/, /^login/, /^logout/, /^sign(in|up)$/, /^sessions?$/, /^sesion/, /^identit/, /^permis/, /^roles?$/,
      /^rls$/, /^polic(y|ies)$/, /^grants?$/, /^usuarios?$/, /^users?$/, /^acceso/, /^access(?!ib)/, /^invit/,
      /^registro/, /^regist(er|ration)/, /^activar/, /^aceptar/, /^recuperar/, /^reauthor/, /^verific/,
      /^tokens?$/, /^otp$/, /^pin$/, /^password/, /^clave/, /^flags?$/, /^legal/, /^ley$/, /^terminos/,
      /^privac/, /^consent/, /^cookies?$/, /^callback$/, /^proxy$/, /^middleware$/, /^admin/, /^rbac/, /^guards?$/,
    ],
  },
  {
    id: "datos-personales",
    motivo: "captura, cambio, exportación o borrado de datos personales",
    palabras: [
      /^borrad/, /^purg/, /^baja$/, /^(un|re)?subscribe$/, /^export/, /^import$/, /^migrar/, /^duplicad/,
      /^merge$/, /^personas?$/, /^empleados?$/, /^employees?$/, /^expediente/, /^cedula/, /^rif$/, /^telefono/,
      /^phones?$/, /^direccion/, /^address/, /^attachments?$/, /^adjunto/, /^storage$/, /^upload/, /^pii$/,
      /^retention$/, /^habeas/, /^analytics$/, /^clarity$/, /^forms?$/, /^formulario/, /^clientes?$/, /^clients?$/,
      /^perfil/, /^profiles?$/, /^ficha/, /^contacto/, /^contacts?$/, /^gps$/, /^ubicacion/, /^location/, /^tms$/,
      /^backfill/, /^crm$/, /^leads?$/, /^comments?$/, /^comentario/, /^bugs?$/,
    ],
  },
  {
    id: "integraciones",
    motivo: "integraciones externas (correo, Meta, Chatwoot, Kommo, mensajería, IA o servicios)",
    palabras: [
      /^chatwoot/, /^kommo/, /^meta$/, /^whatsapp/, /^instagram/, /^facebook/, /^telegram/, /^discord/, /^email/,
      /^mail/, /^correo/, /^newsletter/, /^resend$/, /^webhooks?$/, /^searates/, /^naviera/, /^push$/, /^notif/,
      /^notify/, /^cron$/, /^api$/, /^oficina/, /^integra/, /^asistente/, /^bots?$/, /^agent/, /^openai/,
      /^anthropic/, /^ia$/, /^sms$/, /^twilio/, /^r2$/, /^s3$/, /^aws$/, /^supabase/, /^db$/, /^sql$/,
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------------
// Rutas seguras (carril rápido). Solo llega aquí lo que no cayó en una regla fija ni en un tema sensible.
// ---------------------------------------------------------------------------------------------------------------

// En `e2e/` cuentan solo los `*.spec.*`/`*.test.*`: los ayudantes y diagnósticos (`e2e/_helpers/`, `*.mjs`) son código.
const RE_PRUEBA = /(^|\/)__tests__\/|\.(test|spec)\.[cm]?[jt]sx?$|^scripts\/tests\/[^/]+\.node\.mjs$/;
const RE_RECURSO = /\.(png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|mp4|webm|mp3|pdf)$/i;

const SEGURAS = [
  {
    id: "documentos",
    motivo: "documento",
    coincide: (r) => r.startsWith("docs/") || /\.mdx?$/i.test(r),
  },
  {
    id: "textos",
    // Los diccionarios `lib/i18n/**/*.ts` son TypeScript ejecutable: van por la lógica de `lib/` (revisión).
    motivo: "texto plano publicado",
    coincide: (r) => /^lib\/i18n\/(es-VE|zh-CN)\/[^/]+\.json$/.test(r) || /^(app|public)\/.*\.txt$/.test(r),
  },
  { id: "pruebas", motivo: "prueba", coincide: (r) => RE_PRUEBA.test(r) },
  {
    id: "estilos",
    motivo: "estilos",
    coincide: (r) => /\.(css|scss)$/i.test(r),
  },
  {
    // Es TypeScript ejecutable (lo importan decenas de pantallas, con `buildWhatsAppLink`): se lee como una pantalla.
    id: "tokens-de-diseno",
    motivo: "tokens de diseño",
    coincide: (r) => r === "lib/design-tokens.ts",
  },
  {
    id: "pantallas",
    motivo: "pantalla o componente visual",
    coincide: (r) => /^(app|components)\/.+\.tsx$/.test(r) && !/(^|\/)(layout|template)\.tsx$/.test(r),
  },
  {
    id: "recursos",
    motivo: "imagen, fuente o recurso estático",
    coincide: (r) => /^(public|docs|lib\/font-files)\//.test(r) && RE_RECURSO.test(r),
  },
];

// Las reglas por tema no se aplican a lo que no es código.
const NO_ES_CODIGO = new Set(["documentos", "textos", "pruebas", "estilos", "recursos"]);

// ---------------------------------------------------------------------------------------------------------------

function base(ruta) {
  return ruta.slice(ruta.lastIndexOf("/") + 1);
}

/** Normaliza una ruta: barras de Unix, sin `./` ni comillas de git, sin espacios a los lados. */
export function normalizar(ruta) {
  let r = String(ruta).trim();
  if (r.startsWith('"') && r.endsWith('"') && r.length >= 2) r = desescaparGit(r.slice(1, -1));
  r = r.replace(/\\/g, "/").replace(/^(\.\/)+/, "").replace(/\/{2,}/g, "/");
  return r;
}

/** Git cita las rutas con bytes fuera de ASCII como `"caf\303\251"`: devuelve el texto UTF-8. */
function desescaparGit(texto) {
  const bytes = [];
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c !== "\\") {
      bytes.push(...Buffer.from(c, "utf8"));
      continue;
    }
    const sig = texto[i + 1];
    if (/[0-7]/.test(sig)) {
      bytes.push(parseInt(texto.slice(i + 1, i + 4), 8));
      i += 3;
    } else {
      const mapa = { n: 10, t: 9, '"': 34, "\\": 92 };
      bytes.push(mapa[sig] ?? sig.charCodeAt(0));
      i += 1;
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

/** Pedazos de la ruta para las reglas por tema, en minúsculas, con y sin cortar por mayúsculas. */
export function pedazos(ruta) {
  const crudos = ruta.split(/[/\-_.()[\]\s@+]+/).filter(Boolean);
  const salida = new Set();
  for (const p of crudos) {
    salida.add(p.toLowerCase());
    for (const q of p.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)) salida.add(q.toLowerCase());
  }
  return [...salida];
}

// ---------------------------------------------------------------------------------------------------------------
// Capa de contenido, por archivo: una pantalla en ruta segura va a `revision` si su versión de la base o la de la
// cabeza (el archivo completo, no solo las líneas cambiadas) toca puertas, sesión, lecturas o escrituras de datos,
// o importa una server action. Así, quitar una puerta o un filtro escrito en otra línea también cae: la base lo
// tenía. Un archivo que no se puede leer como texto (NUL, UTF-8 inválido) va a `revision`: se falla cerrado.
// ---------------------------------------------------------------------------------------------------------------

const MARCAS = [
  /\brequire\w*\s*\(/, // puertas `requireModuleView(…)`, `requireRole(…)`, y `require(…)`
  /\bcanAccess\w*/, // `canAccessModule(…)`
  /\bhas\w*Access\b/, // `hasBrandAccess()`
  /\bgetStudioAccess\b/,
  /\bisAdmin\b/,
  /\bhasRole\b/,
  /\bcan\s*\(/,
  /\bpuede\w*\s*\(/,
  /createAdminClient/, // lectura o escritura sin RLS
  /service_role/i,
  /\bgetUser\b|\bgetSession\b/,
  /rbac/i,
  /(?<!Array)\.from\s*\(/, // consulta a una tabla
  /\.rpc\s*\(/,
  /\.(insert|update|upsert|delete)\s*\(/,
  /\bredirect\s*\(|\bnotFound\s*\(|\bpermanentRedirect\s*\(/,
  /["']use server["']/,
  /\bfetch\s*\(/, // cualquier fetch: también los que escriben sin `method:`
  /\bmethod\s*:/,
  /<form\b[^>]*\bmethod\s*=/, // formulario HTML que envía a una ruta
  /\baction\s*=\s*\{/, // `<form action={guardar}>`: server action por formulario
  /\bformAction\b/,
  /\bsendBeacon\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bon(Save|Submit|Delete|Confirm)\w*\s*\(\s*\{/, // prop de acción llamada con un objeto
  /(from|import)\s*\(?\s*["'][^"']*action[^"']*["']/i, // importa de `_actions/`, `/actions`, `*-actions`
  /@supabase\/|@\/lib\/(db|auth)\b|\/lib\/db\//,
  /\b(cookies|headers)\s*\(\s*\)/,
];

const RE_CODIGO = /\.[cm]?[jt]sx?$/;
// `import … from "x"`, `export … from "x"`, `import "x"` e `import("x")`. El grupo 1 marca `import type`/`export type`,
// que no trae código y se salta. La ruta se toma con `[^"']+` a propósito: si trae un salto de línea, el archivo
// cae en revisión (no se puede leer con seguridad).
const RE_IMPORT =
  /\b(?:import|export)\b(\s+type\b)?[^"';]*?\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s+["']([^"']+)["']/g;

function marcaEn(texto) {
  for (const re of MARCAS) {
    const m = texto.match(re);
    if (m) return m[0];
  }
  return null;
}

/** `null` si el contenido no es texto: trae un byte NUL o no es UTF-8 válido. */
export function comoTexto(bytes) {
  if (bytes === null || bytes === undefined) return null;
  const b = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes), "utf8");
  if (b.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(b);
  } catch {
    return null;
  }
}

/**
 * Los imports locales con código (`@/…` y relativos; no `import type`) de un archivo, con sus rutas candidatas.
 * Los paquetes (`react`, `next/…`) no se resuelven. `raro: true` si la ruta del import trae un salto de línea.
 */
export function importsLocales(ruta, texto) {
  const salida = [];
  for (const m of texto.matchAll(RE_IMPORT)) {
    if (m[1]) continue; // import type / export type
    const spec = m[2] ?? m[3] ?? m[4];
    if (/[\r\n]/.test(spec)) {
      salida.push({ spec, candidatas: [], raro: true });
      continue;
    }
    let base;
    if (spec.startsWith("@/")) base = spec.slice(2);
    else if (spec.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(ruta), spec));
    else continue;
    const candidatas = RE_CODIGO.test(base)
      ? [base]
      : [".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"].map((ext) => `${base}${ext}`);
    salida.push({ spec, candidatas, raro: false });
  }
  return salida;
}

/** Adapta un lector de a uno (`leer(ref, ruta)` → Buffer o `null`) a lotes. */
export function porLotes(leer) {
  return (pares) => new Map(pares.map(([ref, ruta]) => [`${ref}:${ruta}`, leer(ref, ruta)]));
}

const VACIO = Object.freeze({ textos: [], binario: false, importa: null });

/** Si el archivo es código que solo por su ruta todavía podría ir por el carril rápido: hay que leerlo. */
export function necesitaLeer(ruta) {
  if (!RE_CODIGO.test(ruta)) return false;
  const r = clasificarArchivo(ruta, { ...VACIO, textos: [""] });
  // Las pruebas, los estilos y los textos no se leen cuando cambian ellos mismos (sí cuando una pantalla los importa).
  return r.carril === "rapido" && !NO_ES_CODIGO.has(r.regla);
}

/** Rutas de código seguras cuyo nombre trae una palabra de tema por casualidad («tokens»). Su contenido sí se lee. */
const SIN_TEMA_POR_NOMBRE = new Set(["lib/design-tokens.ts"]);

/** Tope del recorrido de imports: si se alcanza, la pantalla va a revisión (no se pudo mirar todo). */
export const TOPE_IMPORTS = Object.freeze({ niveles: 10, archivos: 2000 });

/**
 * Por qué un módulo importado es sensible por sí mismo, o `null` (lo que importa se mira aparte). Por ruta: una regla
 * fija, un tema (no basta «sin-clasificar», que es toda la lógica de `lib/`) o ser un archivo de prueba importado
 * desde código de producción. Por contenido: cualquier marca, incluido `"use server"`. Todo `.ts`/`.tsx` se lee, también
 * `lib/design-tokens.ts` y las pruebas: la excepción es solo para lo que no es código.
 */
function moduloSensible(ruta, texto) {
  if (!RE_CODIGO.test(ruta)) return null;
  if (RE_PRUEBA.test(ruta)) return "es un archivo de prueba importado desde código de producción";
  for (const regla of REGLAS_FIJAS) {
    if (regla.coincide(ruta)) return `${regla.id} por la ruta`;
  }
  if (!SIN_TEMA_POR_NOMBRE.has(ruta)) {
    const trozos = pedazos(ruta);
    for (const tema of TEMAS) {
      const palabra = trozos.find((t) => tema.palabras.some((re) => re.test(t)));
      if (palabra) return `${tema.id} («${palabra}» en la ruta)`;
    }
  }
  if (texto === null) return "no se puede leer como texto";
  const marca = marcaEn(texto);
  return marca ? `trae «${marca}»` : null;
}

/**
 * Lee el contenido de los archivos de código que todavía pueden ir por el carril rápido, en las revisiones dadas, y
 * recorre el **cierre completo** de sus imports con código (no `import type`), por lotes: un `git cat-file --batch`
 * por nivel. `leerVarios([[ref, ruta], …])` devuelve un `Map` "ref:ruta" → Buffer o `null`. Devuelve un `Map`
 * ruta → `{ textos, binario, importa }`: los textos de cada versión que existe, si alguna no es texto, y por qué
 * algo de lo que importa (directa o indirectamente) la hace sensible, o `null`. Si el recorrido llega al tope
 * (`TOPE_IMPORTS`), `importa` lo dice y la pantalla va a revisión.
 */
export function cargarContenido(rutas, refs, leerVarios, tope = TOPE_IMPORTS) {
  const aLeer = rutas.filter(necesitaLeer);
  const leidos = leerVarios(aLeer.flatMap((ruta) => refs.map((ref) => [ref, ruta])));
  const contenido = new Map();

  // El grafo, por versión: nodo "ref:ruta" → { ruta, propio, imports }.
  const nodos = new Map();
  const raices = []; // { ruta, ref, imports }
  for (const ruta of aLeer) {
    const entrada = { textos: [], binario: false, importa: null };
    for (const ref of refs) {
      const bytes = leidos.get(`${ref}:${ruta}`) ?? null;
      if (bytes === null) continue; // no existe en esa versión (archivo nuevo o borrado)
      const texto = comoTexto(bytes);
      if (texto === null) {
        entrada.binario = true;
        continue;
      }
      entrada.textos.push(texto);
      const imports = importsLocales(ruta, texto);
      const raro = imports.find((i) => i.raro);
      if (raro && !entrada.importa) entrada.importa = `un import con salto de línea («${raro.spec.trim()}»)`;
      raices.push({ ruta, ref, imports: imports.filter((i) => !i.raro) });
    }
    contenido.set(ruta, entrada);
  }

  // Recorrido por niveles: cada nivel lee de una vez todos los candidatos de los imports pendientes.
  let pendientes = raices.flatMap(({ ref, imports }) => imports.map((imp) => ({ ref, imp })));
  let nivel = 0;
  let topeAlcanzado = false;
  const resueltos = new Map(); // "ref:spec-candidatas" → clave del nodo o null
  const claveImport = (ref, imp) => `${ref}|${imp.candidatas.join("|")}`;
  while (pendientes.length > 0) {
    nivel += 1;
    if (nivel > tope.niveles || nodos.size > tope.archivos) {
      topeAlcanzado = true;
      break;
    }
    const porLeer = new Map();
    for (const { ref, imp } of pendientes) {
      if (resueltos.has(claveImport(ref, imp))) continue;
      for (const c of imp.candidatas) if (!nodos.has(`${ref}:${c}`)) porLeer.set(`${ref}:${c}`, [ref, c]);
    }
    const lote = leerVarios([...porLeer.values()]);
    const siguientes = [];
    for (const { ref, imp } of pendientes) {
      const k = claveImport(ref, imp);
      if (resueltos.has(k)) continue;
      let clave = null;
      for (const c of imp.candidatas) {
        const ck = `${ref}:${c}`;
        if (nodos.has(ck)) {
          clave = ck;
          break;
        }
        const bytes = lote.get(ck) ?? null;
        if (bytes === null) continue;
        const texto = comoTexto(bytes);
        const hijos = texto === null ? [] : importsLocales(c, texto);
        const raro = hijos.find((h) => h.raro);
        nodos.set(ck, {
          ruta: c,
          propio: raro ? `trae un import con salto de línea («${raro.spec.trim()}»)` : moduloSensible(c, texto),
          imports: hijos.filter((h) => !h.raro),
        });
        for (const h of hijos) if (!h.raro) siguientes.push({ ref, imp: h });
        clave = ck;
        break;
      }
      resueltos.set(k, clave); // null: no es un archivo del repo en esa versión (alias de paquete, generado)
    }
    pendientes = siguientes;
  }

  // Por qué un nodo es sensible (él o lo que importa), con memoria. Un nodo que el recorrido no expandió por el tope
  // cuenta como sensible.
  const memo = new Map();
  const sensible = (clave, ref, enCurso = new Set()) => {
    if (memo.has(clave)) return memo.get(clave);
    if (enCurso.has(clave)) return null; // ciclo: lo resuelve quien lo empezó
    const nodo = nodos.get(clave);
    if (!nodo) return null;
    if (nodo.propio) {
      memo.set(clave, { motivo: nodo.propio, cadena: [] });
      return memo.get(clave);
    }
    enCurso.add(clave);
    let r = null;
    for (const imp of nodo.imports) {
      const k = claveImport(ref, imp);
      if (!resueltos.has(k)) {
        if (topeAlcanzado) r = { motivo: "el recorrido de imports llegó al tope sin terminar", cadena: [imp.spec] };
        if (r) break;
        continue;
      }
      const hijo = resueltos.get(k);
      if (!hijo) continue;
      const s = sensible(hijo, ref, enCurso);
      if (s) {
        r = { motivo: s.motivo, cadena: [imp.spec, ...s.cadena] };
        break;
      }
    }
    enCurso.delete(clave);
    memo.set(clave, r);
    return r;
  };

  for (const { ruta, ref, imports } of raices) {
    const entrada = contenido.get(ruta);
    if (entrada.importa) continue;
    for (const imp of imports) {
      const k = claveImport(ref, imp);
      if (!resueltos.has(k)) {
        if (topeAlcanzado) {
          entrada.importa = `el recorrido de imports llegó al tope (${tope.niveles} niveles o ${tope.archivos} archivos)`;
          break;
        }
        continue;
      }
      const hijo = resueltos.get(k);
      if (!hijo) continue;
      const s = sensible(hijo, ref);
      if (s) {
        const cadena = [imp.spec, ...s.cadena].map((x) => `«${x}»`).join(" → ");
        entrada.importa = s.cadena.length === 0 ? `importa ${cadena}, que es sensible: ${s.motivo}` : `importa ${cadena}, sensible: ${s.motivo}`;
        break;
      }
    }
  }
  return contenido;
}

/**
 * Clasifica un archivo. `contenido` es `{ textos, binario, importa }` (de `cargarContenido`), o `undefined` si solo
 * se conoce el nombre. Devuelve `{ ruta, carril, regla, motivo }`.
 */
export function clasificarArchivo(rutaCruda, contenido) {
  const ruta = normalizar(rutaCruda);
  const esPrueba = RE_PRUEBA.test(ruta);

  for (const regla of REGLAS_FIJAS) {
    if (esPrueba && !regla.tambienPruebas) continue;
    if (regla.coincide(ruta)) return { ruta, carril: "revision", regla: regla.id, motivo: regla.motivo };
  }

  const segura = SEGURAS.find((s) => s.coincide(ruta));
  const esCodigo = !segura || !NO_ES_CODIGO.has(segura.id);

  if (esCodigo && !SIN_TEMA_POR_NOMBRE.has(ruta)) {
    const trozos = pedazos(ruta);
    for (const tema of TEMAS) {
      const palabra = trozos.find((t) => tema.palabras.some((re) => re.test(t)));
      if (palabra) {
        return { ruta, carril: "revision", regla: tema.id, motivo: `${tema.motivo} («${palabra}» en la ruta)` };
      }
    }
  }

  if (!segura) {
    return {
      ruta,
      carril: "revision",
      regla: "sin-clasificar",
      motivo: "ruta fuera de la lista de rutas seguras (ante la duda, revisión)",
    };
  }

  if (esCodigo) {
    const sinContenido = (motivo) => ({ ruta, carril: "revision", regla: "sin-contenido", motivo });
    if (contenido === undefined) {
      return sinContenido("código clasificado sin leer el archivo (usa --pr, o --diff con --base y --head)");
    }
    if (contenido.binario) return sinContenido("el archivo no se puede leer como texto (NUL o UTF-8 inválido)");
    if (contenido.textos.length === 0) return sinContenido("no se encontró el archivo en la base ni en la cabeza");
    for (const t of contenido.textos) {
      const marca = marcaEn(t);
      if (marca) {
        return {
          ruta,
          carril: "revision",
          regla: "contenido-sensible",
          motivo: `el archivo (en la base o en la cabeza) toca puertas, sesión o datos («${marca}»)`,
        };
      }
    }
    if (contenido.importa) {
      return { ruta, carril: "revision", regla: "contenido-sensible", motivo: contenido.importa };
    }
  }

  return { ruta, carril: "rapido", regla: segura.id, motivo: segura.motivo };
}

/**
 * Clasifica un diff completo. `contenido` (opcional) es el `Map` de `cargarContenido`; sin él, solo se conocen los
 * nombres. `binarios` son las rutas que el diff marcó como binarias. Basta un archivo `revision` para que la PR sea
 * `revision`.
 */
export function clasificar(rutas, contenido = null, binarios = new Set()) {
  const vistos = new Set();
  const archivos = [];
  for (const cruda of rutas) {
    const ruta = normalizar(cruda);
    if (!ruta || vistos.has(ruta)) continue;
    vistos.add(ruta);
    let c;
    if (contenido) {
      c = contenido.get(ruta) ?? VACIO;
      if (binarios.has(ruta)) c = { ...c, binario: true };
    }
    archivos.push(clasificarArchivo(ruta, c));
  }
  if (archivos.length === 0) throw new ErrorCarril("el diff no trae archivos: no hay nada que clasificar");

  const causantes = archivos.filter((a) => a.carril === "revision");
  const carril = causantes.length === 0 ? "rapido" : "revision";
  const reglas = [...new Set(causantes.map((a) => a.regla))];
  const motivo =
    carril === "rapido"
      ? `los ${archivos.length} archivos están en rutas del carril rápido`
      : `${causantes.length} de ${archivos.length} archivos piden revisión previa (${reglas.join(", ")})`;

  return {
    version: VERSION,
    carril,
    motivo,
    total: archivos.length,
    contenido: contenido !== null,
    causantes: causantes.map(({ ruta, regla, motivo: m }) => ({ ruta, regla, motivo: m })),
    archivos,
  };
}

export class ErrorCarril extends Error {}

/**
 * Lee un diff unificado (`gh pr diff N`, `git diff`). Devuelve `{ rutas, binarios }`. Toma las dos rutas de cada
 * archivo (la vieja y la nueva), para que renombrar un archivo sensible a una ruta segura no lo esconda:
 * `gh pr diff --name-only` solo da la nueva. `binarios` son las rutas con `Binary files … differ` o
 * `GIT binary patch`.
 */
export function analizarDiff(texto) {
  const rutas = new Set();
  const binarios = new Set();
  let actual = [];
  const agregar = (r) => {
    if (!r || r === "/dev/null") return;
    const ruta = normalizar(r);
    rutas.add(ruta);
    if (!actual.includes(ruta)) actual.push(ruta);
  };
  // Las rutas salen solo de las cabeceras: dentro de un hunk, una línea borrada «-- x» se vería como «--- x».
  let enCabecera = false;
  for (const linea of texto.split(/\r?\n/)) {
    if (linea.startsWith("diff --git ")) {
      enCabecera = true;
      actual = [];
      const resto = linea.slice("diff --git ".length);
      const citada = resto.match(/^"a\/((?:[^"\\]|\\.)*)" "b\/((?:[^"\\]|\\.)*)"$/);
      if (citada) {
        agregar(`"${citada[1]}"`);
        agregar(`"${citada[2]}"`);
        continue;
      }
      // Forma común `a/X b/X` (misma ruta): el largo la define sin ambigüedad aunque haya espacios.
      const largo = (resto.length - 5) / 2;
      if (Number.isInteger(largo) && largo > 0) {
        const x = resto.slice(2, 2 + largo);
        if (resto === `a/${x} b/${x}`) {
          agregar(x);
          continue;
        }
      }
      // Rutas distintas: las dan las líneas `rename`/`copy`/`---`/`+++`; si no, el corte en « b/».
      const corte = resto.indexOf(" b/");
      if (corte > 2 && resto.startsWith("a/")) {
        agregar(resto.slice(2, corte));
        agregar(resto.slice(corte + 3));
      }
      continue;
    }
    if (linea.startsWith("@@")) {
      enCabecera = false;
      continue;
    }
    if (!enCabecera) continue;
    if (/^Binary files .* differ$/.test(linea) || linea === "GIT binary patch") {
      for (const r of actual) binarios.add(r);
      continue;
    }
    const renombre = linea.match(/^(?:rename|copy) (?:from|to) (.+)$/);
    if (renombre) {
      agregar(renombre[1]);
      continue;
    }
    const lado = linea.match(/^(?:---|\+\+\+) (.+?)\t?$/);
    if (lado && lado[1] !== "/dev/null") {
      // `--- a/X`, o citada con el prefijo dentro: `--- "a/caf\303\251"`.
      const valor = lado[1].startsWith('"') ? normalizar(lado[1]) : lado[1];
      agregar(valor.replace(/^[ab]\//, ""));
    }
  }
  return { rutas: [...rutas], binarios };
}

/** Las rutas de un diff unificado (vieja y nueva de cada archivo). */
export function rutasDeDiff(texto) {
  return analizarDiff(texto).rutas;
}

const RE_SHA = /^[0-9a-f]{40}$/;
const OPCIONES_PROCESO = { maxBuffer: 512 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], windowsHide: true };

function correr(ejecutar, cmd, args, encoding = "utf8") {
  try {
    return ejecutar(cmd, args, { ...OPCIONES_PROCESO, encoding });
  } catch (error) {
    const detalle = String(error.stderr || error.message || error).trim().split(/\r?\n/)[0];
    throw new ErrorCarril(`${cmd} ${args.slice(0, 3).join(" ")} falló: ${detalle}`);
  }
}

/**
 * Lector por lotes con git: un solo `git cat-file --batch` para todos los pares. Lo que no existe (o no es un
 * blob) queda en `null`.
 */
export function lectorGit(ejecutar = execFileSync) {
  return (pares) => {
    const salida = new Map();
    if (pares.length === 0) return salida;
    for (const [ref, ruta] of pares) {
      if (/[\r\n]/.test(`${ref}${ruta}`)) throw new ErrorCarril(`ruta con salto de línea: «${ruta}»`);
    }
    const entrada = `${pares.map(([ref, ruta]) => `${ref}:${ruta}`).join("\n")}\n`;
    let buf;
    try {
      buf = ejecutar("git", ["cat-file", "--batch"], {
        ...OPCIONES_PROCESO,
        stdio: ["pipe", "pipe", "pipe"],
        // Como Buffer: con `encoding: "buffer"`, Node no sabría convertir un string de entrada.
        input: Buffer.from(entrada, "utf8"),
        encoding: "buffer",
      });
    } catch (error) {
      const detalle = String(error.stderr || error.message || error).trim().split(/\r?\n/)[0];
      throw new ErrorCarril(`git cat-file --batch falló: ${detalle}`);
    }
    buf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    let pos = 0;
    for (const [ref, ruta] of pares) {
      const clave = `${ref}:${ruta}`;
      const fin = buf.indexOf(0x0a, pos);
      if (fin < 0) throw new ErrorCarril("git cat-file --batch devolvió menos objetos de los pedidos");
      const cabecera = buf.subarray(pos, fin).toString("utf8");
      pos = fin + 1;
      const m = cabecera.match(/^[0-9a-f]{40,64} (\w+) (\d+)$/);
      if (!m) {
        salida.set(clave, null); // «<objeto> missing» o «ambiguous»
        continue;
      }
      const largo = Number(m[2]);
      salida.set(clave, m[1] === "blob" ? Buffer.from(buf.subarray(pos, pos + largo)) : null);
      pos += largo + 1;
    }
    if (pos !== buf.length) throw new ErrorCarril("git cat-file --batch devolvió una salida que no cuadra con lo pedido");
    return salida;
  };
}

function resolverCommit(ejecutar, ref) {
  const sha = String(correr(ejecutar, "git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`])).trim();
  if (!RE_SHA.test(sha)) throw new ErrorCarril(`«${ref}» no es un commit de este repositorio`);
  return sha;
}

function cabezaDePr(ejecutar, numero) {
  const sha = String(
    correr(ejecutar, "gh", ["pr", "view", numero, "--json", "headRefOid", "--jq", ".headRefOid"]),
  ).trim();
  if (!RE_SHA.test(sha)) throw new ErrorCarril(`gh pr view ${numero} no dio una cabeza válida («${sha}»)`);
  return sha;
}

/**
 * Lee la PR atada a su cabeza: la cabeza antes y después del diff tiene que ser la misma; si llegó un push en el
 * medio, es un error (otra vuelta). Con `esperada`, la cabeza tiene que ser esa. Después trae la cabeza con git
 * (`git fetch origin pull/<N>/head`) y lee cada archivo de código en la base (el merge-base con `baseRef`) y en la
 * cabeza.
 */
function leerPr(numero, esperada, baseRef, ejecutar = execFileSync) {
  if (!/^\d+$/.test(String(numero))) throw new ErrorCarril(`--pr espera un número de PR, no «${numero}»`);
  const n = String(numero);
  const antes = cabezaDePr(ejecutar, n);
  if (esperada && antes !== esperada) {
    throw new ErrorCarril(`la cabeza de la PR ${n} es ${antes}, no ${esperada}`);
  }
  const texto = correr(ejecutar, "gh", ["pr", "diff", n, "--color=never"]);
  const despues = cabezaDePr(ejecutar, n);
  if (despues !== antes) {
    throw new ErrorCarril(`la PR ${n} cambió de cabeza mientras se clasificaba (${antes} → ${despues})`);
  }
  const { rutas, binarios } = analizarDiff(texto);
  if (rutas.length === 0) throw new ErrorCarril(`gh pr diff ${n} no trajo archivos`);

  correr(ejecutar, "git", ["fetch", "--no-tags", "--quiet", "origin", `pull/${n}/head`]);
  if (resolverCommit(ejecutar, antes) !== antes) throw new ErrorCarril(`no se pudo traer la cabeza ${antes}`);
  const principal = resolverCommit(ejecutar, baseRef);
  const base = String(correr(ejecutar, "git", ["merge-base", antes, principal])).trim();
  if (!RE_SHA.test(base)) throw new ErrorCarril(`no hay merge-base entre ${antes} y ${baseRef}`);
  // También la versión actual de la rama base: si main agregó una marca después del merge-base, el resultado
  // fusionado la tiene. Lo que main cambie después de esta lectura no se ve: el tren exige que la PR no esté BEHIND.
  const refs = principal === base ? [base, antes] : [base, antes, principal];
  const contenido = cargarContenido(rutas, refs, lectorGit(ejecutar));
  return { rutas, binarios, contenido, head: antes, base };
}

/**
 * `--diff` con `--base` y `--head`: los dos tienen que ser commits de este repositorio y el diff de stdin tiene que
 * ser exactamente `git diff --no-renames <base> <head>`. Si no, es un error: un `head` que no ata nada no sirve.
 */
function leerDiffAtado(textoStdin, baseRef, headRef, ejecutar = execFileSync) {
  const base = resolverCommit(ejecutar, baseRef);
  const head = resolverCommit(ejecutar, headRef);
  const propio = String(correr(ejecutar, "git", ["diff", "--no-renames", base, head]));
  const limpio = (t) => t.replace(/\r\n/g, "\n").trimEnd();
  if (limpio(propio) !== limpio(textoStdin)) {
    throw new ErrorCarril(`el diff de stdin no es «git diff --no-renames ${base} ${head}»`);
  }
  const { rutas, binarios } = analizarDiff(propio);
  const contenido = cargarContenido(rutas, [base, head], lectorGit(ejecutar));
  return { rutas, binarios, contenido, head, base };
}

const AYUDA = `Uso: node scripts/carril.mjs [--json] (--pr <N> [--head <sha>] [--base <ref>] | --diff [--base <ref> --head <ref>] < diff | <ruta>... | < lista)

Clasifica un diff en el carril «rapido» o «revision».
  --pr <N>       lee el diff con «gh pr diff <N>», la cabeza con «gh pr view» y cada archivo de código completo
                 en la base y en la cabeza con git; el JSON trae «head» y «base»
  --base <ref>   rama base para el merge-base con --pr (por defecto origin/main), o la base del diff con --diff
  --head <sha>   con --pr, la cabeza tiene que ser esa; con --diff, la cabeza del diff (se verifica)
  --diff         stdin es un diff unificado; con --base y --head se verifica contra git y se leen los archivos;
                 sin ellos, las pantallas dan revision (no se puede leer su contenido)
  <ruta>...      solo nombres por argumento (una pantalla así da revision)
  (stdin)        solo nombres, una ruta por línea
  --json         salida en JSON (el contrato del tren)
Salida: 0 = rapido, 1 = revision, 2 = error o esta ayuda (cuenta como revision).`;

export function leerArgumentos(argv) {
  const opciones = { json: false, pr: null, head: null, base: null, diff: false, rutas: [], ayuda: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opciones.json = true;
    else if (a === "--diff") opciones.diff = true;
    else if (a === "-h" || a === "--help") opciones.ayuda = true;
    else if (a === "--pr" || a === "--head" || a === "--base") {
      if (i + 1 >= argv.length) throw new ErrorCarril(`${a} necesita un valor`);
      opciones[a.slice(2)] = argv[++i];
    } else if (/^--(pr|head|base)=/.test(a)) {
      const [clave, ...valor] = a.slice(2).split("=");
      opciones[clave] = valor.join("=");
    } else if (a === "--") {
      opciones.rutas.push(...argv.slice(i + 1));
      break;
    } else if (a.startsWith("-")) throw new ErrorCarril(`opción desconocida: ${a}`);
    else opciones.rutas.push(a);
  }
  const fuentes = [opciones.pr !== null, opciones.diff, opciones.rutas.length > 0].filter(Boolean).length;
  if (fuentes > 1) throw new ErrorCarril("usa una sola entrada: --pr, --diff o rutas");
  if (opciones.pr !== null && opciones.head !== null && !RE_SHA.test(opciones.head)) {
    throw new ErrorCarril(`--head espera el SHA completo de 40 caracteres, no «${opciones.head}»`);
  }
  if (opciones.diff && (opciones.head === null) !== (opciones.base === null)) {
    throw new ErrorCarril("--diff necesita --base y --head juntos (o ninguno de los dos)");
  }
  if (!opciones.diff && opciones.pr === null && (opciones.head !== null || opciones.base !== null)) {
    throw new ErrorCarril("--head y --base solo van con --pr o con --diff");
  }
  return opciones;
}

function texto(resultado) {
  const lineas = [`carril: ${resultado.carril}`, `motivo: ${resultado.motivo}`];
  if (resultado.head) lineas.push(`cabeza: ${resultado.head}`);
  if (resultado.causantes.length > 0) {
    lineas.push("archivos que piden revisión:");
    for (const c of resultado.causantes) lineas.push(`  ${c.ruta} — ${c.regla}: ${c.motivo}`);
  }
  return lineas.join("\n");
}

function leerStdin(io) {
  const esTty = io.stdinEsTty ?? process.stdin.isTTY;
  if (esTty) throw new ErrorCarril("faltan las rutas: pásalas por argumento, por stdin, con --diff o con --pr <N>");
  return io.stdin ?? readFileSync(0, "utf8");
}

/** Punto de entrada. `io` permite probarlo sin procesos: { stdin, stdinEsTty, ejecutar, out, err }. */
export function main(argv, io = {}) {
  const out = io.out ?? ((s) => process.stdout.write(s));
  const err = io.err ?? ((s) => process.stderr.write(s));
  const ejecutar = io.ejecutar ?? execFileSync;
  let json = argv.includes("--json");
  try {
    const opciones = leerArgumentos(argv);
    json = opciones.json;
    if (opciones.ayuda) {
      out(`${AYUDA}\n`);
      return SALIDA.error;
    }
    let resultado;
    if (opciones.pr !== null) {
      const r = leerPr(opciones.pr, opciones.head, opciones.base ?? "origin/main", ejecutar);
      resultado = {
        ...clasificar(r.rutas, r.contenido, r.binarios),
        origen: "pr",
        pr: Number(opciones.pr),
        head: r.head,
        base: r.base,
      };
    } else if (opciones.diff && opciones.head !== null) {
      const r = leerDiffAtado(leerStdin(io), opciones.base, opciones.head, ejecutar);
      resultado = { ...clasificar(r.rutas, r.contenido, r.binarios), origen: "diff", head: r.head, base: r.base };
    } else if (opciones.diff) {
      const { rutas } = analizarDiff(leerStdin(io));
      resultado = { ...clasificar(rutas), origen: "diff" };
    } else if (opciones.rutas.length > 0) {
      resultado = { ...clasificar(opciones.rutas), origen: "args" };
    } else {
      resultado = { ...clasificar(leerStdin(io).split(/\r?\n/)), origen: "stdin" };
    }
    out(json ? `${JSON.stringify(resultado, null, 2)}\n` : `${texto(resultado)}\n`);
    return SALIDA[resultado.carril];
  } catch (error) {
    const mensaje = error instanceof ErrorCarril ? error.message : `error inesperado: ${error?.stack || error}`;
    if (json) out(`${JSON.stringify({ version: VERSION, carril: "revision", error: mensaje }, null, 2)}\n`);
    err(`carril: ${mensaje}\n`);
    return SALIDA.error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
