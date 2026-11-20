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

import { SALIDA, clasificar, clasificarArchivo, leerArgumentos, main, normalizar, rutasDeDiff } from "../carril.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "carril.mjs");

const carril = (ruta) => clasificarArchivo(ruta).carril;

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
};

for (const [nombre, ruta] of Object.entries(SENSIBLES)) {
  test(`revision: ${nombre} (${ruta})`, () => {
    const r = clasificarArchivo(ruta);
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
  "texto es-VE": "lib/i18n/es-VE/bandeja.ts",
  "texto zh-CN": "lib/i18n/zh-CN/bandeja.ts",
  "llms-full": "app/llms-full.txt",
  "prueba vitest": "components/Footer.enlaces.test.tsx",
  "prueba de una action (es prueba, no action)": "app/portal/actions.test.ts",
  "prueba en __tests__": "app/studio/(app)/clientes/__tests__/lista.test.tsx",
  "prueba e2e": "e2e/portal.spec.ts",
  "prueba del harness": "scripts/tests/director-status.node.mjs",
  "estilo global": "app/globals.css",
  "estilo del Studio": "app/studio/studio.css",
  "tokens de diseño": "lib/design-tokens.ts",
  "pantalla del Studio": "app/studio/(app)/clientes/page.tsx",
  "componente del Studio": "app/studio/(app)/embarques/_components/TablaEmbarques.tsx",
  "componente público": "components/Footer.tsx",
  "página pública": "app/nosotros/page.tsx",
  "loading": "app/studio/(app)/clientes/loading.tsx",
  "logo": "public/brand/container.svg",
  "fuente": "lib/font-files/inter.woff2",
};

for (const [nombre, ruta] of Object.entries(SEGURAS)) {
  test(`rapido: ${nombre} (${ruta})`, () => {
    const r = clasificarArchivo(ruta);
    assert.equal(r.carril, "rapido", `${ruta} cayó en ${r.regla}: ${r.motivo}`);
  });
}

test("los temas sí miran pruebas que viven en carpetas sensibles", () => {
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
  const r = clasificar(["docs/a.md", "", "docs/a.md", "components/Footer.tsx", "app/globals.css"]);
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
  assert.deepEqual(leerArgumentos(["--json", "--pr", "42"]), { json: true, pr: "42", rutas: [], ayuda: false });
  assert.equal(leerArgumentos(["--pr=7"]).pr, "7");
  assert.deepEqual(leerArgumentos(["a.md", "--", "--raro.md"]).rutas, ["a.md", "--raro.md"]);
  assert.throws(() => leerArgumentos(["--pr"]), /necesita/);
  assert.throws(() => leerArgumentos(["--pr", "1", "a.md"]), /no las dos/);
  assert.throws(() => leerArgumentos(["--nada"]), /desconocida/);
});

function correr(argv, io = {}) {
  let out = "";
  let err = "";
  const codigo = main(argv, { stdinEsTty: false, stdin: "", ...io, out: (s) => (out += s), err: (s) => (err += s) });
  return { codigo, out, err };
}

test("contrato: códigos de salida 0 rapido, 1 revision, 2 error", () => {
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
  assert.equal(r.version, 1);
  assert.equal(r.carril, "revision");
  assert.equal(r.origen, "args");
  assert.equal(r.total, 2);
  assert.equal(typeof r.motivo, "string");
  assert.deepEqual(Object.keys(r.causantes[0]).sort(), ["motivo", "regla", "ruta"]);
  assert.deepEqual(Object.keys(r.archivos[0]).sort(), ["carril", "motivo", "regla", "ruta"]);
});

test("contrato: stdin, una ruta por línea con CRLF", () => {
  const { codigo, out } = correr(["--json"], { stdin: "docs/a.md\r\ncomponents/Footer.tsx\r\n" });
  assert.equal(codigo, 0);
  const r = JSON.parse(out);
  assert.equal(r.carril, "rapido");
  assert.equal(r.origen, "stdin");
});

test("contrato: --pr usa gh pr diff N y un fallo de gh da error con JSON de revision", () => {
  const llamadas = [];
  const ok = correr(["--json", "--pr", "12"], {
    ejecutar: (cmd, args) => {
      llamadas.push([cmd, ...args]);
      return "diff --git a/docs/a.md b/docs/a.md\n--- a/docs/a.md\n+++ b/docs/a.md\n@@ -1 +1 @@\n";
    },
  });
  assert.deepEqual(llamadas, [["gh", "pr", "diff", "12", "--color=never"]]);
  assert.equal(ok.codigo, 0);
  assert.equal(JSON.parse(ok.out).pr, 12);
  assert.equal(JSON.parse(ok.out).origen, "pr");

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
  assert.match(wf, /--no-renames/);
  assert.doesNotMatch(wf, /exit "?\$codigo"?/, "el carril no se convierte en el código del job");
});
