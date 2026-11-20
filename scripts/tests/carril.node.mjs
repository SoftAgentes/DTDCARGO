// Pruebas de scripts/carril.mjs, el clasificador de carriles (rápido / con revisión previa).
//
// QUÉ PROTEGEN: que nada sensible se cuele al carril rápido. Las dos mitades importan: lo sensible tiene que dar
// `revision` (una ruta por cada tema que Sam nombró) y lo seguro tiene que dar `rapido`; si todo diera `revision`,
// el carril rápido no existiría y nadie lo notaría. Además, el contrato que usa el tren: JSON y códigos de salida.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  SALIDA,
  analizarDiff,
  clasificar,
  clasificarArchivo,
  leerArgumentos,
  main,
  normalizar,
  rutasDeDiff,
} from "../carril.mjs";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const ROOT =path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "carril.mjs");

// Con un diff sin líneas sensibles: lo que da revision aquí lo decide la ruta, no la falta de diff.
const carril = (ruta, lineas = []) => clasificarArchivo(ruta, lineas).carril;
const PRESENTACION = ['<p className="texto">Hola</p>', 'const titulo = t("embarques");'];

// Una ruta real (o con la forma real) del repo por cada frontera sensible.
const SENSIBLES = {
  "migración": "supabase/migrations/0700_algo.sql",
  "contrato SQL": "supabase/tests/0700_algo.test.sql",
  "SQL fuera de supabase": "docs/runbooks/consulta.sql",
  "lib/db": "lib/db/client.ts",
  "facturación (pantalla)": "app/studio/(app)/facturacion/page.tsx",
  "facturas del portal": "app/portal/(app)/facturas/page.tsx",
  "estado de cuenta": "app/portal/(app)/estado-de-cuenta/page.tsx",
  "contabilidad": "app/studio/(app)/contabilidad/asientos/page.tsx",
  "fiscal": "lib/fiscal/libro.ts",
  "tesorería": "app/studio/(app)/tesoreria/page.tsx",
  "nómina": "app/studio/(app)/nomina/page.tsx",
  "tarifas públicas": "app/tarifas/page.tsx",
  "calculadora": "components/CalculadoraForm.tsx",
  "cotizador": "components/CotizadorFletes.tsx",
  "tasa BCV": "app/studio/(app)/bcv-rates/page.tsx",
  "registro": "app/registro/page.tsx",
  "entrar": "app/entrar/page.tsx",
  "invitar (onboarding)": "app/invitar/[token]/page.tsx",
  "acceso con token": "app/acceso/[token]/page.tsx",
  "login del portal": "app/portal/(auth)/login/page.tsx",
  "login del Studio": "app/studio/(auth)/login/page.tsx",
  "lib/auth": "lib/auth/session.ts",
  "proxy (middleware de Next 16)": "proxy.ts",
  "middleware": "middleware.ts",
  "legal del Studio": "lib/studio/legal/terminos.ts",
  "términos públicos": "app/terminos/page.tsx",
  "privacidad": "app/privacidad/page.tsx",
  "permisos": "app/studio/(app)/ajustes/permisos/page.tsx",
  "usuarios": "app/studio/(app)/usuarios/page.tsx",
  "server action": "app/studio/(app)/clientes/actions.ts",
  "server action con prefijo": "lib/studio/treasury-actions.ts",
  "carpeta _actions": "app/studio/(app)/clientes/_actions/guardar.ts",
  "ruta de API": "app/api/contact/route.ts",
  "route.ts fuera de api": "app/admin/cbm-estudio/route.ts",
  "Chatwoot": "app/studio/(app)/chatwoot/page.tsx",
  "Kommo": "lib/kommo/cliente.ts",
  "Meta": "app/studio/(app)/meta/page.tsx",
  "WhatsApp (camelCase)": "components/WhatsAppFAB.tsx",
  "correo": "app/email/plantilla/page.tsx",
  "newsletter": "app/noticias/_components/NewsletterCard.tsx",
  "webhooks": "app/studio/(app)/webhooks/page.tsx",
  "formulario (captura PII)": "components/ContactoForm.tsx",
  "consentimiento de cookies": "components/CookieConsentBanner.tsx",
  "analítica": "components/Analytics.tsx",
  "borrado": "app/studio/(app)/borrado/page.tsx",
  "exportación": "app/studio/(app)/clientes/export/page.tsx",
  "adjuntos": "app/studio/(app)/attachments/page.tsx",
  ".env": ".env.local",
  ".env.example": "infra/dtd-cargo/.env.example",
  "CI": ".github/workflows/quality.yml",
  "infraestructura": "infra/ops/publicar-web.sh",
  "Dockerfile": "Dockerfile",
  "consolidados": "scripts/consolidados/generar-lote.ts",
  "package.json": "package.json",
  "lockfile": "pnpm-lock.yaml",
  "next.config": "next.config.ts",
  "eslint (fronteras)": "eslint.config.mjs",
  "layout (puertas de acceso)": "app/studio/(app)/layout.tsx",
  "AGENTS.md": "AGENTS.md",
  "CLAUDE.md anidado": "app/studio/CLAUDE.md",
  "skill del Director": ".agents/skills/director/SKILL.md",
  "gobernanza": "docs/governance/AGENT-BRIEF.md",
  "runbook de carriles": "docs/runbooks/codex-engineering.md",
  "runbook de migraciones en prod": "docs/runbooks/aplicar-migraciones-prod.md",
  "el propio clasificador": "scripts/carril.mjs",
  "las pruebas del clasificador": "scripts/tests/carril.node.mjs",
  "contrato del CI": "scripts/__tests__/ci-workflow-contract.test.mjs",
  "lógica en lib (sin clasificar)": "lib/studio/client-queries.ts",
  "script suelto (sin clasificar)": "scripts/verify.mjs",
  "privado": "private/marca/guia.html",
  // Revisión de Dir_DTD sobre cb7de5ed8: pantallas con puertas, lecturas sin RLS o datos personales.
  "página del Studio con puerta require*()": "app/studio/(app)/admin/page.tsx",
  "página móvil con createAdminClient": "app/m/cn/page.tsx",
  "página móvil del bodeguero": "app/m/ve/bodeguero/page.tsx",
  "alta de cuentas del portal": "app/studio/(app)/admin/_components/PortalBackfillSection.tsx",
  "GPS del camionero": "app/m/ve/camionero/_components/GpsBlock.tsx",
  "perfil con push": "app/studio/_components/wiring/ProfileModal.tsx",
  "perfil del portal": "app/portal/(app)/perfil/page.tsx",
  "empresa del perfil del portal": "app/portal/(app)/perfil/empresa/page.tsx",
  "clientes del Studio": "app/studio/(app)/clientes/page.tsx",
  "página del back": "app/back/(app)/page.tsx",
  "ficha": "app/studio/(app)/ficha/_components/Resumen.tsx",
  "rbac": "components/RbacBadge.tsx",
  "project-rules": "docs/engineering/project-rules.md",
  "runbook de publicación": "docs/runbooks/publicacion-automatica-web.md",
  ".harness": ".harness/CHECKPOINTS.md",
  "ayudante de e2e": "e2e/_helpers/sesion.ts",
  "diagnóstico de e2e": "e2e/diagnostics/medir.mjs",
  "diccionario i18n (TypeScript)": "lib/i18n/es-VE/bandeja.ts",
};

for (const [nombre, ruta] of Object.entries(SENSIBLES)) {
  test(`revision: ${nombre} (${ruta})`, () => {
    const r = clasificarArchivo(ruta, PRESENTACION);
    assert.equal(r.carril, "revision", `${ruta} cayó en ${r.regla}`);
    assert.ok(r.motivo.length > 0);
  });
}

const SEGURAS = {
  "spec": "docs/specs/0700-algo/spec.md",
  "spec sobre facturación (los temas no miran documentos)": "docs/specs/0681-facturacion/spec.md",
  "runbook cualquiera": "docs/runbooks/otro.md",
  "README": "README.md",
  "handoff": ".agents/handoffs/carriles-integracion-20261120.md",
  "imagen de docs": "docs/design/captura.png",
  "diccionario JSON": "lib/i18n/es-VE/bandeja.json",
  "llms-full": "app/llms-full.txt",
  "prueba vitest": "components/Footer.enlaces.test.tsx",
  "prueba de una action (es prueba, no action)": "app/portal/actions.test.ts",
  "prueba en __tests__": "app/studio/(app)/clientes/__tests__/lista.test.tsx",
  "prueba e2e": "e2e/portal.spec.ts",
  "prueba del harness": "scripts/tests/director-status.node.mjs",
  "estilo global": "app/globals.css",
  "estilo del Studio": "app/studio/studio.css",
  "tokens de diseño": "lib/design-tokens.ts",
  "componente del Studio": "app/studio/(app)/embarques/_components/TablaEmbarques.tsx",
  "componente público": "components/Footer.tsx",
  "página pública": "app/nosotros/page.tsx",
  "loading": "app/studio/(app)/embarques/loading.tsx",
  "logo": "public/brand/container.svg",
  "fuente": "lib/font-files/inter.woff2",
};

for (const [nombre, ruta] of Object.entries(SEGURAS)) {
  test(`rapido: ${nombre} (${ruta})`, () => {
    const r = clasificarArchivo(ruta, PRESENTACION);
    assert.equal(r.carril, "rapido", `${ruta} cayó en ${r.regla}: ${r.motivo}`);
  });
}

const LINEAS_SENSIBLES = [
  ['await requireModuleView("admin");', "require"],
  ["const db = createAdminClient();", "createAdminClient"],
  ["const rol = 'service_role';", "service_role"],
  ["const { data: { user } } = await supabase.auth.getUser();", "getUser"],
  ['import { puede } from "@/lib/studio/rbac-guard";', "rbac"],
  ['const { data } = await db.from("clients").select("*");', ".from("],
  ['await db.rpc("cerrar_lote", { id });', ".rpc("],
  ["await tabla.update({ nombre });", ".update("],
  ['redirect("/studio/login");', "redirect("],
  ["if (!fila) notFound();", "notFound("],
  ['"use server";', "use server"],
  ['await fetch("/api/gps", { method: "POST", body });', "method:"],
  ['import { guardar } from "./actions";', "import de actions"],
  ['import { createServerClient } from "@supabase/ssr";', "@supabase/"],
  ["const c = cookies();", "cookies()"],
];

for (const [linea, marca] of LINEAS_SENSIBLES) {
  test(`contenido: una pantalla segura que agrega o quita «${marca}» da revision`, () => {
    const r = clasificarArchivo("components/Footer.tsx", ["<p>ok</p>", linea]);
    assert.equal(r.carril, "revision", linea);
    assert.equal(r.regla, "contenido-sensible");
  });
}

test("contenido: Array.from no cuenta como consulta", () => {
  assert.equal(carril("components/Footer.tsx", ["const xs = Array.from(items);"]), "rapido");
});

test("contenido: una pantalla sin diff (solo el nombre) da revision", () => {
  const r = clasificarArchivo("components/Footer.tsx");
  assert.equal(r.carril, "revision");
  assert.equal(r.regla, "sin-contenido");
  // Lo que no es código no necesita el diff.
  assert.equal(clasificarArchivo("docs/a.md").carril, "rapido");
  assert.equal(clasificarArchivo("app/globals.css").carril, "rapido");
});

test("contenido: las pruebas no miran líneas (un mock de .from( sigue siendo prueba)", () => {
  assert.equal(carril("components/Footer.test.tsx", ['db.from("clients")']), "rapido");
});

test("página pública fuera de las zonas con sesión: rapido solo si sus líneas no tocan datos", () => {
  assert.equal(carril("app/nosotros/page.tsx", ["<h1>Nosotros</h1>"]), "rapido");
  assert.equal(carril("app/nosotros/page.tsx", ['const x = await db.from("noticias").select();']), "revision");
});

test("analizarDiff guarda las líneas agregadas y quitadas, no las de contexto", () => {
  const diff = [
    "diff --git a/components/Footer.tsx b/components/Footer.tsx",
    "--- a/components/Footer.tsx",
    "+++ b/components/Footer.tsx",
    "@@ -1,3 +1,3 @@",
    " const db = createAdminClient(); // contexto, no cuenta",
    '-await requireModuleView("x");',
    "+<p>hola</p>",
  ].join("\n");
  const cambios = analizarDiff(diff);
  assert.deepEqual(cambios.get("components/Footer.tsx"), ['await requireModuleView("x");', "<p>hola</p>"]);
  const r = clasificar([...cambios.keys()], cambios);
  assert.equal(r.carril, "revision", "quitar una puerta pesa igual que ponerla");
  assert.equal(r.contenido, true);

  const soloContexto = analizarDiff(diff.replace('-await requireModuleView("x");\n', ""));
  assert.equal(clasificar([...soloContexto.keys()], soloContexto).carril, "rapido", "el contexto no cuenta");
});

test("las reglas por carpeta sí alcanzan a las pruebas que viven ahí", () => {
  assert.equal(carril("app/registro/__tests__/registro.test.tsx"), "revision");
  assert.equal(carril("app/api/contact/__tests__/route.test.ts"), "revision");
  assert.equal(carril("supabase/tests/0001.test.sql"), "revision");
});

test("una ruta desconocida da revision (ante la duda, revisión)", () => {
  const r = clasificarArchivo("carpeta-nueva/algo.ts");
  assert.equal(r.carril, "revision");
  assert.equal(r.regla, "sin-clasificar");
});

test("normaliza barras de Windows, ./ y comillas de git", () => {
  assert.equal(normalizar(".\\supabase\\migrations\\0001.sql"), "supabase/migrations/0001.sql");
  assert.equal(normalizar("./docs//a.md"), "docs/a.md");
  assert.equal(normalizar('"docs/caf\\303\\251.md"'), "docs/café.md");
  assert.equal(carril(".\\supabase\\migrations\\0001.sql"), "revision");
});

test("PR mixta: un archivo sensible vuelve revision a toda la PR y lo nombra", () => {
  const r = clasificar(["docs/a.md", "app/globals.css", "supabase/migrations/0700_x.sql", "app/x/actions.ts"]);
  assert.equal(r.carril, "revision");
  assert.equal(r.total, 4);
  assert.deepEqual(
    r.causantes.map((c) => c.ruta),
    ["supabase/migrations/0700_x.sql", "app/x/actions.ts"],
  );
  assert.match(r.motivo, /2 de 4/);
  assert.match(r.motivo, /base-de-datos/);
  assert.match(r.motivo, /server-actions/);
});

test("PR solo de rutas seguras: rapido, sin causantes", () => {
  const cambios = new Map([["components/Footer.tsx", PRESENTACION]]);
  const r = clasificar(["docs/a.md", "", "docs/a.md", "components/Footer.tsx", "app/globals.css"], cambios);
  assert.equal(r.carril, "rapido");
  assert.equal(r.total, 3, "ignora líneas vacías y repetidas");
  assert.deepEqual(r.causantes, []);
});

test("un diff sin archivos es un error, no un rapido", () => {
  assert.throws(() => clasificar(["", "  "]), /no trae archivos/);
});

test("rutasDeDiff toma la ruta vieja y la nueva de un renombre", () => {
  const diff = [
    "diff --git a/supabase/migrations/0700_x.sql b/docs/x.md",
    "similarity index 100%",
    "rename from supabase/migrations/0700_x.sql",
    "rename to docs/x.md",
    "diff --git a/docs/con espacio.md b/docs/con espacio.md",
    "index 1..2 100644",
    "--- a/docs/con espacio.md",
    "+++ b/docs/con espacio.md",
    "@@ -1 +1 @@",
    "--- esto es una línea borrada que empieza con dos guiones",
    "+++ y esta, una agregada",
    "diff --git a/components/Nuevo.tsx b/components/Nuevo.tsx",
    "new file mode 100644",
    "--- /dev/null",
    "+++ b/components/Nuevo.tsx",
    'diff --git "a/docs/caf\\303\\251.md" "b/docs/caf\\303\\251.md"',
    "Binary files differ",
  ].join("\n");
  const rutas = rutasDeDiff(diff).sort();
  assert.deepEqual(rutas, [
    "components/Nuevo.tsx",
    "docs/café.md",
    "docs/con espacio.md",
    "docs/x.md",
    "supabase/migrations/0700_x.sql",
  ]);
  assert.equal(clasificar(rutas).carril, "revision", "el renombre desde supabase/ no se esconde");
});

test("leerArgumentos: --pr, rutas y errores de uso", () => {
  assert.deepEqual(leerArgumentos(["--json", "--pr", "42"]), {
    json: true,
    pr: "42",
    head: null,
    diff: false,
    rutas: [],
    ayuda: false,
  });
  assert.equal(leerArgumentos(["--pr=7"]).pr, "7");
  assert.equal(leerArgumentos(["--diff", "--head", SHA_A]).head, SHA_A);
  assert.deepEqual(leerArgumentos(["a.md", "--", "--raro.md"]).rutas, ["a.md", "--raro.md"]);
  assert.throws(() => leerArgumentos(["--pr"]), /necesita/);
  assert.throws(() => leerArgumentos(["--pr", "1", "a.md"]), /una sola entrada/);
  assert.throws(() => leerArgumentos(["--diff", "a.md"]), /una sola entrada/);
  assert.throws(() => leerArgumentos(["--head", "abc123"]), /40 caracteres/);
  assert.throws(() => leerArgumentos(["--nada"]), /desconocida/);
});

function correr(argv, io = {}) {
  let out = "";
  let err = "";
  const codigo = main(argv, { stdinEsTty: false, stdin: "", ...io, out: (s) => (out += s), err: (s) => (err += s) });
  return { codigo, out, err };
}

test("contrato: códigos de salida 0 rapido, 1 revision, 2 error o ayuda", () => {
  assert.equal(correr(["--help"]).codigo, 2, "la ayuda no se confunde con rapido");
  assert.deepEqual(SALIDA, { rapido: 0, revision: 1, error: 2 });
  assert.equal(correr(["docs/a.md"]).codigo, 0);
  assert.equal(correr(["supabase/x.sql"]).codigo, 1);
  assert.equal(correr([]).codigo, 2, "stdin vacío");
  assert.equal(correr(["--json"], { stdinEsTty: true }).codigo, 2, "sin rutas ni stdin");
});

test("contrato: el JSON trae carril, motivo, causantes y archivos", () => {
  const { codigo, out } = correr(["--json", "docs/a.md", "app/api/x/route.ts"]);
  assert.equal(codigo, 1);
  const r = JSON.parse(out);
  assert.equal(r.version, 2);
  assert.equal(r.carril, "revision");
  assert.equal(r.origen, "args");
  assert.equal(r.contenido, false, "por argumentos solo se conocen los nombres");
  assert.equal(r.total, 2);
  assert.equal(typeof r.motivo, "string");
  assert.deepEqual(Object.keys(r.causantes[0]).sort(), ["motivo", "regla", "ruta"]);
  assert.deepEqual(Object.keys(r.archivos[0]).sort(), ["carril", "motivo", "regla", "ruta"]);
});

test("contrato: stdin, una ruta por línea con CRLF", () => {
  const { codigo, out } = correr(["--json"], { stdin: "docs/a.md\r\napp/globals.css\r\n" });
  assert.equal(codigo, 0);
  const r = JSON.parse(out);
  assert.equal(r.carril, "rapido");
  assert.equal(r.origen, "stdin");
  // Una pantalla por nombre, sin diff, no puede ir por el carril rápido.
  assert.equal(correr(["--json"], { stdin: "components/Footer.tsx\n" }).codigo, 1);
});

const DIFF_DOC = "diff --git a/docs/a.md b/docs/a.md\n--- a/docs/a.md\n+++ b/docs/a.md\n@@ -1 +1 @@\n+hola\n";

function ghFalso(cabezas, diff = DIFF_DOC) {
  const llamadas = [];
  const ejecutar = (cmd, args) => {
    llamadas.push([cmd, ...args].join(" "));
    if (args[1] === "view") return `${cabezas.shift()}\n`;
    return diff;
  };
  return { llamadas, ejecutar };
}

test("contrato: --pr ata la clasificación a la cabeza y la devuelve en el JSON", () => {
  const gh = ghFalso([SHA_A, SHA_A]);
  const ok = correr(["--json", "--pr", "12"], { ejecutar: gh.ejecutar });
  assert.deepEqual(gh.llamadas, [
    "gh pr view 12 --json headRefOid --jq .headRefOid",
    "gh pr diff 12 --color=never",
    "gh pr view 12 --json headRefOid --jq .headRefOid",
  ]);
  assert.equal(ok.codigo, 0);
  const r = JSON.parse(ok.out);
  assert.equal(r.version, 2);
  assert.equal(r.pr, 12);
  assert.equal(r.origen, "pr");
  assert.equal(r.head, SHA_A);
  assert.equal(r.contenido, true);
});

test("contrato: un push durante la clasificación es error, no un rapido", () => {
  const r = correr(["--json", "--pr", "12"], { ejecutar: ghFalso([SHA_A, SHA_B]).ejecutar });
  assert.equal(r.codigo, 2);
  assert.match(JSON.parse(r.out).error, /cambió de cabeza/);
});

test("contrato: --pr con --head distinto de la cabeza actual es error", () => {
  const r = correr(["--json", "--pr", "12", "--head", SHA_B], { ejecutar: ghFalso([SHA_A, SHA_A]).ejecutar });
  assert.equal(r.codigo, 2);
  assert.match(JSON.parse(r.out).error, /no b{40}/);
});

test("contrato: --pr con una pantalla que toca datos da revision", () => {
  const diff =
    "diff --git a/components/Footer.tsx b/components/Footer.tsx\n--- a/components/Footer.tsx\n" +
    "+++ b/components/Footer.tsx\n@@ -1 +1 @@\n+const db = createAdminClient();\n";
  const r = correr(["--json", "--pr", "12"], { ejecutar: ghFalso([SHA_A, SHA_A], diff).ejecutar });
  assert.equal(r.codigo, 1);
  assert.equal(JSON.parse(r.out).causantes[0].regla, "contenido-sensible");
});

test("contrato: --diff por stdin mira el contenido y repite --head", () => {
  const { codigo, out } = correr(["--json", "--diff", "--head", SHA_A], { stdin: DIFF_DOC });
  assert.equal(codigo, 0);
  const r = JSON.parse(out);
  assert.equal(r.origen, "diff");
  assert.equal(r.head, SHA_A);
  assert.equal(r.contenido, true);
});

test("contrato: un fallo de gh da error con JSON de revision", () => {
  const falla = correr(["--json", "--pr", "12"], {
    ejecutar: () => {
      const e = new Error("gh falló");
      e.stderr = "HTTP 406: diff too large\n";
      throw e;
    },
  });
  assert.equal(falla.codigo, 2);
  const r = JSON.parse(falla.out);
  assert.equal(r.carril, "revision");
  assert.match(r.error, /406/);

  assert.equal(correr(["--json", "--pr", "abc"]).codigo, 2, "número inválido");
});

test("CLI real: argumentos y stdin con el proceso de Node", () => {
  const rapido = spawnSync(process.execPath, [SCRIPT, "--json", "docs/a.md"], { encoding: "utf8", windowsHide: true });
  assert.equal(rapido.status, 0, rapido.stderr);
  assert.equal(JSON.parse(rapido.stdout).carril, "rapido");

  const revision = spawnSync(process.execPath, [SCRIPT, "--json"], {
    input: "app/globals.css\nsupabase/migrations/0700_x.sql\n",
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(revision.status, 1, revision.stderr);
  assert.equal(JSON.parse(revision.stdout).causantes[0].ruta, "supabase/migrations/0700_x.sql");

  const texto = spawnSync(process.execPath, [SCRIPT, "app/x/actions.ts"], { encoding: "utf8", windowsHide: true });
  assert.equal(texto.status, 1);
  assert.match(texto.stdout, /^carril: revision$/m);
  assert.match(texto.stdout, /app\/x\/actions\.ts — server-actions/);
});

test("el check de CI es liviano, informativo y usa el clasificador de main", async () => {
  const { readFileSync } = await import("node:fs");
  const wf = readFileSync(path.join(ROOT, ".github", "workflows", "carril.yml"), "utf8");
  assert.match(wf, /^permissions:\s*\n  contents: read\s*$/m);
  assert.doesNotMatch(wf, /:\s*write\s*$/m, "sin permisos de escritura");
  assert.doesNotMatch(wf, /\bsecrets\./, "sin secretos");
  assert.doesNotMatch(wf, /pull_request_target|workflow_run/);
  const sinComentarios = wf.replace(/^\s*#.*$/gm, "");
  assert.doesNotMatch(sinComentarios, /pnpm|npm (ci|install)|vitest|setup-node/, "no instala dependencias ni corre la suite");
  assert.match(wf, /uses: actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7\.0\.1/);
  assert.match(wf, /persist-credentials: false/);
  assert.match(wf, /git show HEAD\^1:scripts\/carril\.mjs/, "manda el clasificador de la base");
  assert.match(wf, /git diff --no-renames HEAD\^1 HEAD/, "pasa el diff completo, no solo los nombres");
  assert.match(wf, /carril\.mjs" --json --diff --head "\$\(git rev-parse HEAD\^2\)"/, "registra la cabeza de la PR");
  assert.doesNotMatch(wf, /exit "?\$codigo"?/, "el carril no se convierte en el código del job");
});
