#!/usr/bin/env node
/**
 * Clasificador de carril de integración (carriles aprobados por Sam el 2026-11-20).
 *
 * Recibe la lista de archivos de un diff y decide el carril:
 *   - `rapido`:   la PR entra con el CI en verde y se revisa en la revisión de madrugada.
 *   - `revision`: revisión independiente APPROVED + CI verde en la cabeza exacta (la regla de siempre).
 *
 * Dos capas, conservadoras: un archivo es `rapido` solo si cae en una lista corta de rutas seguras (documentos,
 * textos, pruebas, estilos, pantallas y recursos estáticos), no toca nada sensible por ruta y, si es código (una
 * pantalla), sus líneas cambiadas no tocan puertas, lecturas ni escrituras de datos. Sin el diff no se puede mirar
 * el contenido, así que una pantalla clasificada solo por nombre es `revision`. Todo lo demás, incluido lo que no
 * se reconoce, es `revision`. Basta un archivo `revision` para que toda la PR lo sea.
 *
 * Contrato (lo usa el tren del Director; detalle en docs/runbooks/codex-engineering.md, «Carriles de integración»):
 *   node scripts/carril.mjs --json --pr <N>                       # diff de la PR; el JSON trae la cabeza (`head`)
 *   git diff --no-renames A B | node scripts/carril.mjs --json --diff [--head <sha>]   # diff por stdin
 *   node scripts/carril.mjs --json <ruta>...                      # solo nombres (sin contenido)
 *   git diff --name-only --no-renames A B | node scripts/carril.mjs --json            # solo nombres por stdin
 * Códigos de salida: 0 = rapido, 1 = revision, 2 = error o ayuda (no se pudo clasificar; cuenta como revision).
 *
 * Sin dependencias: solo módulos de Node.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const VERSION = 2;
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
      /^backfill/,
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
    coincide: (r) => /\.(css|scss)$/i.test(r) || r === "lib/design-tokens.ts",
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
// Capa de contenido: una pantalla en ruta segura va a `revision` si alguna línea agregada o quitada toca puertas,
// sesión, lecturas o escrituras de datos. Se miran las dos: quitar una puerta pesa igual que ponerla.
// ---------------------------------------------------------------------------------------------------------------

const CONTENIDO_SENSIBLE = [
  /\brequire\w*\s*\(/, // puertas `requireModuleView(…)`, `requireRole(…)`, y `require(…)`
  /createAdminClient/, // lectura o escritura sin RLS
  /service_role/i,
  /\bgetUser\b|\bgetSession\b/,
  /rbac/i,
  /(?<!Array)\.from\s*\(/, // consulta a una tabla
  /\.rpc\s*\(/,
  /\.(insert|update|upsert|delete)\s*\(/,
  /\bredirect\s*\(|\bnotFound\s*\(|\bpermanentRedirect\s*\(/,
  /["']use server["']/,
  /\bmethod\s*:/, // fetch con POST, PUT o DELETE
  /from\s+["'][^"']*actions?["']/, // importa una server action
  /@supabase\/|@\/lib\/(db|auth)\b/,
  /\b(cookies|headers)\s*\(\s*\)/,
];

function lineaSensible(lineas) {
  for (const linea of lineas) {
    for (const re of CONTENIDO_SENSIBLE) {
      const m = linea.match(re);
      if (m) return m[0];
    }
  }
  return null;
}

/**
 * Clasifica un archivo. `lineas` son las líneas agregadas y quitadas del diff (sin el `+`/`-`), o `undefined` si
 * solo se conoce el nombre. Devuelve `{ ruta, carril, regla, motivo }`.
 */
export function clasificarArchivo(rutaCruda, lineas) {
  const ruta = normalizar(rutaCruda);
  const esPrueba = RE_PRUEBA.test(ruta);

  for (const regla of REGLAS_FIJAS) {
    if (esPrueba && !regla.tambienPruebas) continue;
    if (regla.coincide(ruta)) return { ruta, carril: "revision", regla: regla.id, motivo: regla.motivo };
  }

  const segura = SEGURAS.find((s) => s.coincide(ruta));
  const esCodigo = !segura || !NO_ES_CODIGO.has(segura.id);

  if (esCodigo) {
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
    if (lineas === undefined) {
      return {
        ruta,
        carril: "revision",
        regla: "sin-contenido",
        motivo: "código clasificado solo por nombre: sin el diff no se ven sus líneas (usa --pr o --diff)",
      };
    }
    const toque = lineaSensible(lineas);
    if (toque) {
      return {
        ruta,
        carril: "revision",
        regla: "contenido-sensible",
        motivo: `una línea cambiada toca puertas, sesión o datos («${toque}»)`,
      };
    }
  }

  return { ruta, carril: "rapido", regla: segura.id, motivo: segura.motivo };
}

/**
 * Clasifica un diff completo. `cambios` (opcional) es el `Map` ruta → líneas cambiadas de `analizarDiff`; sin él,
 * solo se conocen los nombres. Basta un archivo `revision` para que la PR sea `revision`.
 */
export function clasificar(rutas, cambios = null) {
  const vistos = new Set();
  const archivos = [];
  for (const cruda of rutas) {
    const ruta = normalizar(cruda);
    if (!ruta || vistos.has(ruta)) continue;
    vistos.add(ruta);
    archivos.push(clasificarArchivo(ruta, cambios ? (cambios.get(ruta) ?? []) : undefined));
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
    contenido: cambios !== null,
    causantes: causantes.map(({ ruta, regla, motivo: m }) => ({ ruta, regla, motivo: m })),
    archivos,
  };
}

export class ErrorCarril extends Error {}

/**
 * Lee un diff unificado (`gh pr diff N`, `git diff`). Devuelve un `Map` ruta → líneas agregadas y quitadas. Toma
 * las dos rutas de cada archivo (la vieja y la nueva), para que renombrar un archivo sensible a una ruta segura no
 * lo esconda: `gh pr diff --name-only` solo da la nueva. Las dos rutas comparten las líneas del archivo.
 */
export function analizarDiff(texto) {
  const cambios = new Map();
  let actual = [];
  const agregar = (r) => {
    if (!r || r === "/dev/null") return;
    const ruta = normalizar(r);
    if (!cambios.has(ruta)) cambios.set(ruta, []);
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
    if (!enCabecera) {
      if ((linea.startsWith("+") || linea.startsWith("-")) && actual.length > 0) {
        for (const ruta of actual) cambios.get(ruta).push(linea.slice(1));
      }
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
  return cambios;
}

/** Las rutas de un diff unificado (vieja y nueva de cada archivo). */
export function rutasDeDiff(texto) {
  return [...analizarDiff(texto).keys()];
}

const RE_SHA = /^[0-9a-f]{40}$/;

function correrGh(ejecutar, args) {
  try {
    return ejecutar("gh", args, {
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch (error) {
    const detalle = String(error.stderr || error.message || error).trim().split(/\r?\n/)[0];
    throw new ErrorCarril(`gh ${args.slice(0, 3).join(" ")} falló: ${detalle}`);
  }
}

function cabezaDePr(ejecutar, numero) {
  const sha = String(correrGh(ejecutar, ["pr", "view", numero, "--json", "headRefOid", "--jq", ".headRefOid"])).trim();
  if (!RE_SHA.test(sha)) throw new ErrorCarril(`gh pr view ${numero} no dio una cabeza válida («${sha}»)`);
  return sha;
}

/**
 * Lee la PR atada a su cabeza: la cabeza antes y después del diff tiene que ser la misma; si llegó un push en el
 * medio, es un error (otra vuelta). Con `esperada`, la cabeza tiene que ser esa.
 */
function leerPr(numero, esperada, ejecutar = execFileSync) {
  if (!/^\d+$/.test(String(numero))) throw new ErrorCarril(`--pr espera un número de PR, no «${numero}»`);
  const n = String(numero);
  const antes = cabezaDePr(ejecutar, n);
  if (esperada && antes !== esperada) {
    throw new ErrorCarril(`la cabeza de la PR ${n} es ${antes}, no ${esperada}`);
  }
  const texto = correrGh(ejecutar, ["pr", "diff", n, "--color=never"]);
  const despues = cabezaDePr(ejecutar, n);
  if (despues !== antes) {
    throw new ErrorCarril(`la PR ${n} cambió de cabeza mientras se clasificaba (${antes} → ${despues})`);
  }
  const cambios = analizarDiff(texto);
  if (cambios.size === 0) throw new ErrorCarril(`gh pr diff ${n} no trajo archivos`);
  return { cambios, head: antes };
}

const AYUDA = `Uso: node scripts/carril.mjs [--json] (--pr <N> [--head <sha>] | --diff [--head <sha>] < diff | <ruta>... | < lista)

Clasifica un diff en el carril «rapido» o «revision».
  --pr <N>      lee el diff de la PR con «gh pr diff <N>» y su cabeza con «gh pr view»; el JSON trae «head»
  --diff        stdin es un diff unificado (git diff --no-renames A B): mira rutas y líneas cambiadas
  --head <sha>  la cabeza clasificada (40 caracteres); con --pr, tiene que ser la cabeza actual
  <ruta>...     solo nombres por argumento (una pantalla así da revision: sin diff no se ve su contenido)
  (stdin)       solo nombres, una ruta por línea
  --json        salida en JSON (el contrato del tren)
Salida: 0 = rapido, 1 = revision, 2 = error o esta ayuda (cuenta como revision).`;

export function leerArgumentos(argv) {
  const opciones = { json: false, pr: null, head: null, diff: false, rutas: [], ayuda: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opciones.json = true;
    else if (a === "--diff") opciones.diff = true;
    else if (a === "-h" || a === "--help") opciones.ayuda = true;
    else if (a === "--pr" || a === "--head") {
      if (i + 1 >= argv.length) throw new ErrorCarril(`${a} necesita un valor`);
      opciones[a.slice(2)] = argv[++i];
    } else if (a.startsWith("--pr=")) opciones.pr = a.slice(5);
    else if (a.startsWith("--head=")) opciones.head = a.slice(7);
    else if (a === "--") {
      opciones.rutas.push(...argv.slice(i + 1));
      break;
    } else if (a.startsWith("-")) throw new ErrorCarril(`opción desconocida: ${a}`);
    else opciones.rutas.push(a);
  }
  const fuentes = [opciones.pr !== null, opciones.diff, opciones.rutas.length > 0].filter(Boolean).length;
  if (fuentes > 1) throw new ErrorCarril("usa una sola entrada: --pr, --diff o rutas");
  if (opciones.head !== null && !RE_SHA.test(opciones.head)) {
    throw new ErrorCarril(`--head espera el SHA completo de 40 caracteres, no «${opciones.head}»`);
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
      const { cambios, head } = leerPr(opciones.pr, opciones.head, io.ejecutar);
      resultado = { ...clasificar([...cambios.keys()], cambios), origen: "pr", pr: Number(opciones.pr), head };
    } else if (opciones.diff) {
      const cambios = analizarDiff(leerStdin(io));
      resultado = { ...clasificar([...cambios.keys()], cambios), origen: "diff" };
    } else if (opciones.rutas.length > 0) {
      resultado = { ...clasificar(opciones.rutas), origen: "args" };
    } else {
      resultado = { ...clasificar(leerStdin(io).split(/\r?\n/)), origen: "stdin" };
    }
    if (opciones.head !== null && !resultado.head) resultado.head = opciones.head;
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
