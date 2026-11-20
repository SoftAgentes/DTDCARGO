#!/usr/bin/env node
/**
 * Clasificador de carril de integración (carriles aprobados por Sam el 2026-11-20).
 *
 * Recibe la lista de archivos de un diff y decide el carril:
 *   - `rapido`:   la PR entra con el CI en verde y se revisa en la revisión de madrugada.
 *   - `revision`: revisión independiente APPROVED + CI verde en la cabeza exacta (la regla de siempre).
 *
 * Las reglas van por ruta y son conservadoras: un archivo es `rapido` solo si cae en una lista corta de rutas
 * seguras (documentos, textos, pruebas, estilos, pantallas y recursos estáticos) y no toca nada sensible. Todo lo
 * demás, incluido lo que no se reconoce, es `revision`. Basta un archivo `revision` para que toda la PR lo sea.
 *
 * Contrato (lo usa el tren del Director; detalle en docs/runbooks/codex-engineering.md, «Carriles de integración»):
 *   node scripts/carril.mjs --json --pr <N>        # diff de la PR con `gh pr diff <N>`
 *   node scripts/carril.mjs --json <ruta>...       # rutas por argumento
 *   git diff --name-only --no-renames A B | node scripts/carril.mjs --json   # rutas por stdin
 * Códigos de salida: 0 = rapido, 1 = revision, 2 = error (no se pudo clasificar; cuenta como revision).
 *
 * Sin dependencias: solo módulos de Node.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const VERSION = 1;
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
        "scripts/__tests__/ci-workflow-contract.test.mjs",
      ].includes(r) ||
      // Los handoffs (`.agents/handoffs/`) son documentos de cada tarea: no cambian reglas.
      (/^(\.agents|\.claude|\.codex|docs\/governance)\//.test(r) && !/^\.agents\/handoffs\/[^/]+\.md$/.test(r)) ||
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
      /^privac/, /^consent/, /^cookies?$/, /^callback$/, /^proxy$/, /^middleware$/,
    ],
  },
  {
    id: "datos-personales",
    motivo: "captura, cambio, exportación o borrado de datos personales",
    palabras: [
      /^borrad/, /^purg/, /^baja$/, /^(un|re)?subscribe$/, /^export/, /^import$/, /^migrar/, /^duplicad/,
      /^merge$/, /^personas?$/, /^empleados?$/, /^employees?$/, /^expediente/, /^cedula/, /^rif$/, /^telefono/,
      /^phones?$/, /^direccion/, /^address/, /^attachments?$/, /^adjunto/, /^storage$/, /^upload/, /^pii$/,
      /^retention$/, /^habeas/, /^analytics$/, /^clarity$/, /^forms?$/, /^formulario/,
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

const RE_PRUEBA = /(^|\/)__tests__\/|\.(test|spec)\.[cm]?[jt]sx?$|^scripts\/tests\/[^/]+\.node\.mjs$|^e2e\//;
const RE_RECURSO = /\.(png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|mp4|webm|mp3|pdf)$/i;

const SEGURAS = [
  {
    id: "documentos",
    motivo: "documento",
    coincide: (r) => r.startsWith("docs/") || /\.mdx?$/i.test(r),
  },
  {
    id: "textos",
    motivo: "textos de la interfaz (diccionarios)",
    coincide: (r) => /^lib\/i18n\/(es-VE|zh-CN)\/[^/]+\.(ts|json)$/.test(r) || /^(app|public)\/.*\.txt$/.test(r),
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

/** Clasifica un archivo. Devuelve `{ ruta, carril, regla, motivo }`. */
export function clasificarArchivo(rutaCruda) {
  const ruta = normalizar(rutaCruda);
  const esPrueba = RE_PRUEBA.test(ruta);

  for (const regla of REGLAS_FIJAS) {
    if (esPrueba && !regla.tambienPruebas) continue;
    if (regla.coincide(ruta)) return { ruta, carril: "revision", regla: regla.id, motivo: regla.motivo };
  }

  const segura = SEGURAS.find((s) => s.coincide(ruta));

  if (!segura || !NO_ES_CODIGO.has(segura.id)) {
    const trozos = pedazos(ruta);
    for (const tema of TEMAS) {
      const palabra = trozos.find((t) => tema.palabras.some((re) => re.test(t)));
      if (palabra) {
        return { ruta, carril: "revision", regla: tema.id, motivo: `${tema.motivo} («${palabra}» en la ruta)` };
      }
    }
  }

  if (segura) return { ruta, carril: "rapido", regla: segura.id, motivo: segura.motivo };
  return {
    ruta,
    carril: "revision",
    regla: "sin-clasificar",
    motivo: "ruta fuera de la lista de rutas seguras (ante la duda, revisión)",
  };
}

/** Clasifica un diff completo. Basta un archivo `revision` para que la PR sea `revision`. */
export function clasificar(rutas) {
  const vistos = new Set();
  const archivos = [];
  for (const cruda of rutas) {
    const ruta = normalizar(cruda);
    if (!ruta || vistos.has(ruta)) continue;
    vistos.add(ruta);
    archivos.push(clasificarArchivo(ruta));
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
    causantes: causantes.map(({ ruta, regla, motivo: m }) => ({ ruta, regla, motivo: m })),
    archivos,
  };
}

export class ErrorCarril extends Error {}

/**
 * Saca las rutas de un diff unificado (`gh pr diff N`). Toma las dos rutas de cada archivo (la vieja y la nueva),
 * para que renombrar un archivo sensible a una ruta segura no lo esconda: `gh pr diff --name-only` solo da la nueva.
 */
export function rutasDeDiff(texto) {
  const rutas = new Set();
  const agregar = (r) => {
    if (r && r !== "/dev/null") rutas.add(normalizar(r));
  };
  // Solo se leen las cabeceras: dentro de un hunk, una línea borrada «-- x» se vería como «--- x».
  let enCabecera = false;
  for (const linea of texto.split(/\r?\n/)) {
    if (linea.startsWith("diff --git ")) {
      enCabecera = true;
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
    if (linea.startsWith("@@")) enCabecera = false;
    if (!enCabecera) continue;
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
  return [...rutas];
}

function leerPr(numero, ejecutar = execFileSync) {
  if (!/^\d+$/.test(String(numero))) throw new ErrorCarril(`--pr espera un número de PR, no «${numero}»`);
  let texto;
  try {
    texto = ejecutar("gh", ["pr", "diff", String(numero), "--color=never"], {
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch (error) {
    const detalle = String(error.stderr || error.message || error).trim().split(/\r?\n/)[0];
    throw new ErrorCarril(`gh pr diff ${numero} falló: ${detalle}`);
  }
  const rutas = rutasDeDiff(texto);
  if (rutas.length === 0) throw new ErrorCarril(`gh pr diff ${numero} no trajo archivos`);
  return rutas;
}

const AYUDA = `Uso: node scripts/carril.mjs [--json] (--pr <N> | <ruta>... | < lista)

Clasifica un diff en el carril «rapido» o «revision».
  --pr <N>   lee el diff de la PR con «gh pr diff <N>» (rutas vieja y nueva de cada archivo)
  <ruta>...  rutas por argumento
  (stdin)    una ruta por línea, por ejemplo: git diff --name-only --no-renames A B | node scripts/carril.mjs
  --json     salida en JSON (el contrato del tren)
Salida: 0 = rapido, 1 = revision, 2 = error (cuenta como revision).`;

export function leerArgumentos(argv) {
  const opciones = { json: false, pr: null, rutas: [], ayuda: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opciones.json = true;
    else if (a === "-h" || a === "--help") opciones.ayuda = true;
    else if (a === "--pr") {
      if (i + 1 >= argv.length) throw new ErrorCarril("--pr necesita el número de la PR");
      opciones.pr = argv[++i];
    } else if (a.startsWith("--pr=")) opciones.pr = a.slice(5);
    else if (a === "--") {
      opciones.rutas.push(...argv.slice(i + 1));
      break;
    } else if (a.startsWith("-")) throw new ErrorCarril(`opción desconocida: ${a}`);
    else opciones.rutas.push(a);
  }
  if (opciones.pr !== null && opciones.rutas.length > 0) {
    throw new ErrorCarril("usa --pr o rutas, no las dos cosas");
  }
  return opciones;
}

function texto(resultado) {
  const lineas = [`carril: ${resultado.carril}`, `motivo: ${resultado.motivo}`];
  if (resultado.causantes.length > 0) {
    lineas.push("archivos que piden revisión:");
    for (const c of resultado.causantes) lineas.push(`  ${c.ruta} — ${c.regla}: ${c.motivo}`);
  }
  return lineas.join("\n");
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
      return SALIDA.rapido;
    }
    let rutas;
    if (opciones.pr !== null) rutas = leerPr(opciones.pr, io.ejecutar);
    else if (opciones.rutas.length > 0) rutas = opciones.rutas;
    else {
      const esTty = io.stdinEsTty ?? process.stdin.isTTY;
      if (esTty) throw new ErrorCarril("faltan las rutas: pásalas por argumento, por stdin o con --pr <N>");
      const entrada = io.stdin ?? readFileSync(0, "utf8");
      rutas = entrada.split(/\r?\n/);
    }
    const resultado = { ...clasificar(rutas), origen: opciones.pr !== null ? "pr" : opciones.rutas.length ? "args" : "stdin" };
    if (opciones.pr !== null) resultado.pr = Number(opciones.pr);
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
