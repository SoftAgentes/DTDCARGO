// Pruebas de scripts/carril.mjs, el clasificador de carriles (rápido / con revisión previa).
//
// QUÉ PROTEGEN: que nada sensible se cuele al carril rápido. Las dos mitades importan: lo sensible tiene que dar
// `revision` (una ruta por cada tema que Sam nombró, y cada marca de contenido) y lo seguro tiene que dar
// `rapido`; si todo diera `revision`, el carril rápido no existiría y nadie lo notaría. Además, el contrato que usa
// el tren: JSON, cabeza atada y códigos de salida.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  SALIDA,
  TOPE_IMPORTS,
  analizarDiff,
  cargarContenido,
  clasificar,
  clasificarArchivo,
  comoTexto,
  importsLocales,
  leerArgumentos,
  lectorGit,
  main,
  normalizar,
  porLotes,
  rutasDeDiff,
} from "../carril.mjs";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHA_M = "c".repeat(40);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "carril.mjs");

const PRESENTACION = '<p className="texto">Hola</p>\nconst titulo = t("embarques");';
// Contenido leído (base y cabeza) de un archivo de código.
const leido = (...textos) => ({ textos, binario: false, importa: null });
// Con un archivo de presentación: lo que da revision aquí lo decide la ruta, no la falta de contenido.
const carril = (ruta, ...textos) => clasificarArchivo(ruta, leido(...(textos.length ? textos : [PRESENTACION]))).carril;
const delRepo = (ruta) => readFileSync(path.join(ROOT, ruta), "utf8");

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

for (const [nombre, ruta] of Object.entries(SENSIBLES)) {
  test(`revision: ${nombre} (${ruta})`, () => {
    const r = clasificarArchivo(ruta, leido(PRESENTACION));
    assert.equal(r.carril, "revision", `${ruta} cayó en ${r.regla}`);
    assert.ok(r.motivo.length > 0);
  });
}

for (const [nombre, ruta] of Object.entries(SEGURAS)) {
  test(`rapido: ${nombre} (${ruta})`, () => {
    const r = clasificarArchivo(ruta, leido(PRESENTACION));
    assert.equal(r.carril, "rapido", `${ruta} cayó en ${r.regla}: ${r.motivo}`);
  });
}

// Revisión de Dir_DTD sobre a557ca449: palabras de ruta que faltaban.
for (const ruta of [
  "app/studio/(app)/crm/_components/LeadDrawer.tsx",
  "app/studio/(app)/crm/_components/ChatPermitido.tsx",
  "components/zz/LeadCard.tsx",
  "app/studio/(app)/_components/comments/CommentsThread.tsx",
  "app/studio/(app)/debug/_components/BugsTab.tsx",
]) {
  test(`revision por ruta: ${ruta}`, () => assert.equal(carril(ruta), "revision"));
}

const MARCAS = [
  ['await requireModuleView("admin");', "require"],
  ['if (!canAccessModule(access.role, "kommo")) return null;', "canAccess*"],
  ["const access = await getStudioAccess();", "getStudioAccess"],
  ["{isAdmin && <Borrar />}", "isAdmin"],
  ['if (!hasRole(user, "ops")) return;', "hasRole"],
  ['if (!can("editar")) return;', "can("],
  ['if (!puedeEditar(rol)) return;', "puede*("],
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
  ['import { guardar } from "./actions";', "import de ./actions"],
  ['import { deleteComment } from "@/app/studio/(app)/_actions/comments";', "import de _actions/"],
  ['import { guardar } from "@/lib/studio/guia-actions";', "import de *-actions"],
  ['const { guardar } = await import("./actions");', "import() dinámico de actions"],
  ['import { createServerClient } from "@supabase/ssr";', "@supabase/"],
  ["if (!(await hasBrandAccess())) return null;", "has*Access"],
  ['const r = await fetch("/api/x");', "fetch("],
  ['<form method="post" action="/api/studio/push/subscribe">', "<form method="],
  ['<form action={guardar}><input name="cedula" /></form>', "action={"],
  ["<button formAction={borrar}>Borrar</button>", "formAction"],
  ['navigator.sendBeacon("/api/m/tms/ping", "x");', "sendBeacon("],
  ["const xhr = new XMLHttpRequest();", "XMLHttpRequest"],
  ["onSave({ monto: 0 });", "onSave({"],
  ["props.onSubmit({ cedula });", "onSubmit({"],
  ["onDeleteItem({ id });", "onDelete*({"],
  ["onConfirm({ motivo });", "onConfirm({"],
  ['import { createClient } from "@/lib/db/client";', "@/lib/db"],
  ['import { createClient } from "../../lib/db/admin";', "lib/db relativo"],
  ["const c = cookies();", "cookies()"],
];

for (const [linea, marca] of MARCAS) {
  test(`contenido: un archivo seguro que contiene «${marca}» da revision`, () => {
    const r = clasificarArchivo("components/Footer.tsx", leido(`<p>ok</p>\n${linea}`));
    assert.equal(r.carril, "revision", linea);
    assert.equal(r.regla, "contenido-sensible");
  });
}

test("contenido: Array.from no cuenta como consulta", () => {
  assert.equal(carril("components/Footer.tsx", "const xs = Array.from(items);"), "rapido");
});

test("contenido por archivo: si la base tenía la puerta y la cabeza no, da revision", () => {
  const base = 'if (!canAccessModule(access.role, "kommo") || !access.tenantId) return null;';
  const cabeza = "if (!access.tenantId) return null;";
  assert.equal(carril("components/zz/Embudos.tsx", base, cabeza), "revision");
  assert.equal(carril("components/zz/Embudos.tsx", cabeza), "rapido", "sin la base, la cabeza sola no dice nada");
});

test("contenido por archivo: quitar el filtro de eliminados de GenerateBLModal da revision", () => {
  const ruta = "app/studio/_components/wiring/GenerateBLModal.tsx";
  const base = delRepo(ruta);
  assert.match(base, /\.is\("deleted_at", null\)/, "la base del repo tiene el filtro");
  const cabeza = base.replace(/\n\s*\.is\("deleted_at", null\)/, "");
  assert.notEqual(cabeza, base);
  const r = clasificarArchivo(ruta, leido(base, cabeza));
  assert.equal(r.carril, "revision");
  assert.equal(r.regla, "contenido-sensible");
});

test("contenido por archivo: quitar canAccessModule de CrmEmbudosSlot da revision (por ruta y por contenido)", () => {
  const ruta = "app/studio/(app)/crm/_components/CrmEmbudosSlot.tsx";
  const base = delRepo(ruta);
  assert.match(base, /canAccessModule\(/);
  const cabeza = base.replace(/!canAccessModule\([^)]*\)\s*\|\|\s*/, "");
  assert.equal(carril(ruta, base, cabeza), "revision", "por ruta (crm)");
  // En una ruta sin palabras, el contenido de la base basta.
  const r = clasificarArchivo("components/zz/Embudos.tsx", leido(base, cabeza));
  assert.equal(r.regla, "contenido-sensible");
});

for (const ruta of [
  "app/studio/(app)/_components/comments/CommentsThread.tsx",
  "app/studio/(app)/_components/comments/DeletedCommentsPanel.tsx",
]) {
  test(`contenido: ${path.basename(ruta)} importa server actions de _actions/ y da revision`, () => {
    const texto = delRepo(ruta);
    assert.match(texto, /_actions\/comments/);
    const r = clasificarArchivo("components/zz/Copia.tsx", leido(texto));
    assert.equal(r.carril, "revision");
    assert.match(r.motivo, /_actions\/comments/);
  });
}

test("contenido: importar un archivo con \"use server\" (sin «action» en el nombre) da revision", () => {
  const archivos = {
    "components/zz/Boton.tsx": 'import { guardar } from "./guardar";\nexport const B = () => <button onClick={guardar} />;',
    "components/zz/guardar.ts": '"use server";\nexport async function guardar() {}',
  };
  const leer = (_ref, ruta) => (ruta in archivos ? Buffer.from(archivos[ruta]) : null);
  const contenido = cargarContenido(["components/zz/Boton.tsx"], [SHA_B, SHA_A], porLotes(leer));
  assert.match(contenido.get("components/zz/Boton.tsx").importa, /«\.\/guardar».*use server/);
  const r = clasificar(["components/zz/Boton.tsx"], contenido);
  assert.equal(r.carril, "revision");
  assert.match(r.causantes[0].motivo, /use server/);
});

const delArbol = (archivos = {}) =>
  porLotes((_ref, ruta) => {
    if (ruta in archivos) return Buffer.from(archivos[ruta]);
    try {
      return readFileSync(path.join(ROOT, ruta));
    } catch {
      return null;
    }
  });

test("imports: llamar a una función de lib/ que escribe con service role (accounting) da revision", () => {
  const ruta = "components/zz/V.tsx";
  const archivos = {
    [ruta]:
      'import { voidExpenseEntriesForExpense as anular } from "@/lib/studio/accounting/expense-posting";\n' +
      "export async function V() { await anular(1, 2); return <p>ok</p>; }",
  };
  assert.match(delRepo("lib/studio/accounting/expense-posting.ts"), /createAdminClient/);
  const c = cargarContenido([ruta], [SHA_A], delArbol(archivos));
  const r = clasificarArchivo(ruta, c.get(ruta));
  assert.equal(r.carril, "revision");
  assert.match(r.motivo, /expense-posting.*facturacion-pagos-montos/);
});

test("imports: una puerta de lib/ sin marca en la pantalla (hasBrandAccess con otro nombre) da revision", () => {
  const ruta = "components/zz/M.tsx";
  const archivos = {
    [ruta]: 'import { hasBrandAccess as ver } from "@/lib/marca/access";\nexport async function M() { return (await ver()) ? <p /> : null; }',
    "components/zz/N.tsx": 'import { algo } from "@/lib/marca/access";\nexport const N = () => <p>{algo}</p>;',
  };
  const c = cargarContenido([ruta, "components/zz/N.tsx"], [SHA_A], delArbol(archivos));
  assert.equal(clasificarArchivo(ruta, c.get(ruta)).carril, "revision", "la marca hasBrandAccess está en el import");
  const n = clasificarArchivo("components/zz/N.tsx", c.get("components/zz/N.tsx"));
  assert.equal(n.carril, "revision", "lib/marca/access cae por la ruta («access»)");
  assert.match(n.motivo, /lib\/marca\/access/);
});

test("imports: segundo nivel (la pantalla importa un módulo limpio que importa uno con createAdminClient)", () => {
  const archivos = {
    "components/zz/P.tsx": 'import { listar } from "@/lib/zz/limpio";\nexport const P = () => <p>{listar()}</p>;',
    "lib/zz/limpio.ts": 'import { leer } from "./sucio";\nexport const listar = () => leer();',
    "lib/zz/sucio.ts": "export const leer = () => createAdminClient();",
  };
  const c = cargarContenido(["components/zz/P.tsx"], [SHA_A], porLotes((_ref, r) => (r in archivos ? Buffer.from(archivos[r]) : null)));
  const r = clasificarArchivo("components/zz/P.tsx", c.get("components/zz/P.tsx"));
  assert.equal(r.carril, "revision");
  assert.match(r.motivo, /importa «@\/lib\/zz\/limpio» → «\.\/sucio», sensible/);
});

test("imports: import type no cuenta, y un módulo de estilos (design-tokens) tampoco", () => {
  const archivos = {
    "components/zz/T.tsx":
      'import type { Asiento } from "@/lib/studio/accounting/expense-posting";\nimport { color } from "@/lib/design-tokens";\nexport const T = () => <p style={{ color }} />;',
  };
  const c = cargarContenido(["components/zz/T.tsx"], [SHA_A], delArbol(archivos));
  assert.equal(clasificarArchivo("components/zz/T.tsx", c.get("components/zz/T.tsx")).carril, "rapido");
});

const enMemoria = (archivos) => porLotes((_ref, r) => (r in archivos ? Buffer.from(archivos[r]) : null));

test("design-tokens: se lee; con un fetch POST da revision, sola o importada, y sin marcas sigue rapido", () => {
  const tokens = delRepo("lib/design-tokens.ts");
  assert.match(tokens, /buildWhatsAppLink/);
  const conFetch = `${tokens}\nexport async function avisar(d) { await fetch("/api/m/tms/ping", { method: "POST", body: d }); }`;
  const sola = cargarContenido(["lib/design-tokens.ts"], [SHA_B, SHA_A], porLotes((ref, r) => (r === "lib/design-tokens.ts" ? Buffer.from(ref === SHA_A ? conFetch : tokens) : null)));
  assert.equal(clasificarArchivo("lib/design-tokens.ts", sola.get("lib/design-tokens.ts")).carril, "revision", "el cambio solo en design-tokens");
  const limpia = cargarContenido(["lib/design-tokens.ts"], [SHA_A], enMemoria({ "lib/design-tokens.ts": tokens }));
  assert.equal(clasificarArchivo("lib/design-tokens.ts", limpia.get("lib/design-tokens.ts")).carril, "rapido", "«tokens» del nombre no cuenta");
  const archivos = {
    "lib/design-tokens.ts": conFetch,
    "components/zz/Aviso.tsx": 'import { avisar } from "@/lib/design-tokens";\nexport const A = () => <button onClick={() => avisar(1)} />;',
  };
  const c = cargarContenido(["components/zz/Aviso.tsx"], [SHA_A], enMemoria(archivos));
  const r = clasificarArchivo("components/zz/Aviso.tsx", c.get("components/zz/Aviso.tsx"));
  assert.equal(r.carril, "revision", "la pantalla que la importa");
  assert.match(r.motivo, /design-tokens.*fetch/);
});

test("imports: un archivo de prueba importado desde una pantalla da revision", () => {
  const archivos = {
    "lib/zz/__tests__/w.ts": "export const borrar = () => 1;",
    "components/zz/B.tsx": 'import { borrar } from "@/lib/zz/__tests__/w";\nexport const B = () => <p>{borrar()}</p>;',
  };
  const c = cargarContenido(["components/zz/B.tsx"], [SHA_A], enMemoria(archivos));
  const r = clasificarArchivo("components/zz/B.tsx", c.get("components/zz/B.tsx"));
  assert.equal(r.carril, "revision");
  assert.match(r.motivo, /archivo de prueba/);
  // El archivo de prueba cambiado por sí solo sigue siendo una prueba (carril rápido).
  assert.equal(carril("lib/zz/__tests__/w.ts"), "rapido");
});

test("imports: el cierre completo llega al tercer nivel y más", () => {
  const archivos = {
    "components/zz/P.tsx": 'import { a } from "@/lib/zz/a";\nexport const P = () => <p>{a()}</p>;',
    "lib/zz/a.ts": 'import { b } from "./b";\nexport const a = () => b();',
    "lib/zz/b.ts": 'import { c } from "./c";\nexport const b = () => c();',
    "lib/zz/c.ts": 'import { d } from "./d";\nexport const c = () => d();',
    "lib/zz/d.ts": "export const d = () => createAdminClient();",
  };
  const c = cargarContenido(["components/zz/P.tsx"], [SHA_A], enMemoria(archivos));
  const r = clasificarArchivo("components/zz/P.tsx", c.get("components/zz/P.tsx"));
  assert.equal(r.carril, "revision");
  assert.match(r.motivo, /«@\/lib\/zz\/a» → «\.\/b» → «\.\/c» → «\.\/d»/);
});

test("imports: los ciclos no cuelgan y un cierre limpio da rapido", () => {
  const archivos = {
    "components/zz/C.tsx": 'import { a } from "@/lib/zz/a";\nexport const C = () => <p>{a}</p>;',
    "lib/zz/a.ts": 'import { b } from "./b";\nexport const a = b;',
    "lib/zz/b.ts": 'import { a } from "./a";\nexport const b = 1;',
  };
  const c = cargarContenido(["components/zz/C.tsx"], [SHA_A], enMemoria(archivos));
  assert.equal(clasificarArchivo("components/zz/C.tsx", c.get("components/zz/C.tsx")).carril, "rapido");
});

test("imports: llegar al tope de niveles o de archivos da revision", () => {
  const archivos = {
    "components/zz/P.tsx": 'import { a } from "@/lib/zz/a";\nexport const P = () => <p>{a()}</p>;',
    "lib/zz/a.ts": 'import { b } from "./b";\nexport const a = () => b();',
    "lib/zz/b.ts": 'import { c } from "./c";\nexport const b = () => c();',
    "lib/zz/c.ts": "export const c = () => 1;",
  };
  assert.ok(TOPE_IMPORTS.niveles >= 8 && TOPE_IMPORTS.archivos >= 400);
  const limpio = cargarContenido(["components/zz/P.tsx"], [SHA_A], enMemoria(archivos));
  assert.equal(clasificarArchivo("components/zz/P.tsx", limpio.get("components/zz/P.tsx")).carril, "rapido");
  const corto = cargarContenido(["components/zz/P.tsx"], [SHA_A], enMemoria(archivos), { niveles: 2, archivos: 2000 });
  const r = clasificarArchivo("components/zz/P.tsx", corto.get("components/zz/P.tsx"));
  assert.equal(r.carril, "revision");
  assert.match(r.motivo, /tope/);
  const pocos = cargarContenido(["components/zz/P.tsx"], [SHA_A], enMemoria(archivos), { niveles: 10, archivos: 1 });
  assert.match(clasificarArchivo("components/zz/P.tsx", pocos.get("components/zz/P.tsx")).motivo, /tope/);
});

test("imports: un import con salto de línea en la ruta da revision (se falla cerrado)", () => {
  const archivos = { "components/zz/R.tsx": 'import x from "./a\nb";\nexport const R = () => <p />;' };
  const c = cargarContenido(["components/zz/R.tsx"], [SHA_A], porLotes((_ref, r) => (r in archivos ? Buffer.from(archivos[r]) : null)));
  const r = clasificarArchivo("components/zz/R.tsx", c.get("components/zz/R.tsx"));
  assert.equal(r.carril, "revision");
  assert.match(r.motivo, /salto de línea/);
});

test("lectorGit falla cerrado: una ruta con salto de línea o una salida que no cuadra es error", () => {
  const leer = lectorGit(() => Buffer.from(`${"e".repeat(40)} blob 2\nok\nsobra`));
  assert.throws(() => leer([[SHA_A, "a.ts"]]), /no cuadra/);
  const corta = lectorGit(() => Buffer.from(""));
  assert.throws(() => corta([[SHA_A, "a.ts"]]), /menos objetos/);
  assert.throws(() => lectorGit(() => Buffer.from(""))([[SHA_A, "a\nb.ts"]]), /salto de línea/);
  const bien = lectorGit(() => Buffer.from(`${"e".repeat(40)} blob 2\nok\nb.ts missing\n`));
  const m = bien([
    [SHA_A, "a.ts"],
    [SHA_A, "b.ts"],
  ]);
  assert.equal(String(m.get(`${SHA_A}:a.ts`)), "ok");
  assert.equal(m.get(`${SHA_A}:b.ts`), null);
});

test("importsLocales resuelve @/ y relativos, y deja fuera los paquetes", () => {
  const imports = importsLocales(
    "app/x/y/Z.tsx",
    'import a from "react";\nimport b from "@/lib/b";\nimport c from "../c";\nimport d from "./d.tsx";',
  );
  assert.deepEqual(
    imports.map((i) => [i.spec, i.candidatas[0]]),
    [
      ["@/lib/b", "lib/b.ts"],
      ["../c", "app/x/c.ts"],
      ["./d.tsx", "app/x/y/d.tsx"],
    ],
  );
});

test("binarios: un .tsx con NUL o UTF-8 inválido da revision (se falla cerrado)", () => {
  assert.equal(comoTexto(Buffer.from([0x61, 0x00, 0x62])), null);
  assert.equal(comoTexto(Buffer.from([0xff, 0xfe, 0x41])), null);
  assert.equal(comoTexto(Buffer.from("hola")), "hola");
  const leer = () => Buffer.from([0x2f, 0x2f, 0x00]);
  const contenido = cargarContenido(["components/zz/Bin.tsx"], [SHA_A], porLotes(leer));
  const r = clasificar(["components/zz/Bin.tsx"], contenido);
  assert.equal(r.carril, "revision");
  assert.equal(r.causantes[0].regla, "sin-contenido");
});

test("binarios: «Binary files … differ» en el diff marca el archivo aunque se lea", () => {
  const diff = "diff --git a/components/zz/Bin.tsx b/components/zz/Bin.tsx\nnew file mode 100644\nindex 0..1\nBinary files /dev/null and b/components/zz/Bin.tsx differ\n";
  const { rutas, binarios } = analizarDiff(diff);
  assert.deepEqual(rutas, ["components/zz/Bin.tsx"]);
  assert.ok(binarios.has("components/zz/Bin.tsx"));
  const contenido = new Map([["components/zz/Bin.tsx", leido(PRESENTACION)]]);
  assert.equal(clasificar(rutas, contenido, binarios).carril, "revision");
});

test("contenido: un archivo de código sin leer (solo el nombre) da revision", () => {
  const r = clasificarArchivo("components/Footer.tsx");
  assert.equal(r.carril, "revision");
  assert.equal(r.regla, "sin-contenido");
  assert.equal(clasificarArchivo("components/Footer.tsx", leido()).regla, "sin-contenido", "ni en base ni en cabeza");
  // Lo que no es código no necesita leerse.
  assert.equal(clasificarArchivo("docs/a.md").carril, "rapido");
  assert.equal(clasificarArchivo("app/globals.css").carril, "rapido");
});

test("contenido: las pruebas no se leen (un mock de .from( sigue siendo prueba)", () => {
  assert.equal(carril("components/Footer.test.tsx", 'db.from("clients")'), "rapido");
});

test("página pública fuera de las zonas con sesión: rapido solo si el archivo no toca datos", () => {
  assert.equal(carril("app/nosotros/page.tsx", "<h1>Nosotros</h1>"), "rapido");
  assert.equal(carril("app/nosotros/page.tsx", 'const x = await db.from("noticias").select();'), "revision");
});

test("las reglas por carpeta sí alcanzan a las pruebas que viven ahí", () => {
  assert.equal(carril("app/registro/__tests__/registro.test.tsx"), "revision");
  assert.equal(carril("app/api/contact/__tests__/route.test.ts"), "revision");
  assert.equal(carril("supabase/tests/0001.test.sql"), "revision");
});

test("una ruta desconocida da revision (ante la duda, revisión)", () => {
  const r = clasificarArchivo("carpeta-nueva/algo.ts", leido(PRESENTACION));
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
  const contenido = new Map([["components/Footer.tsx", leido(PRESENTACION)]]);
  const r = clasificar(["docs/a.md", "", "docs/a.md", "components/Footer.tsx", "app/globals.css"], contenido);
  assert.equal(r.carril, "rapido");
  assert.equal(r.total, 3, "ignora líneas vacías y repetidas");
  assert.deepEqual(r.causantes, []);
  assert.equal(r.contenido, true);
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

test("leerArgumentos: --pr, --diff, --base, --head y errores de uso", () => {
  assert.deepEqual(leerArgumentos(["--json", "--pr", "42"]), {
    json: true,
    pr: "42",
    head: null,
    base: null,
    diff: false,
    rutas: [],
    ayuda: false,
  });
  assert.equal(leerArgumentos(["--pr=7"]).pr, "7");
  assert.equal(leerArgumentos(["--diff", "--base", "HEAD^1", "--head", "HEAD"]).base, "HEAD^1");
  assert.deepEqual(leerArgumentos(["a.md", "--", "--raro.md"]).rutas, ["a.md", "--raro.md"]);
  assert.throws(() => leerArgumentos(["--pr"]), /necesita/);
  assert.throws(() => leerArgumentos(["--pr", "1", "a.md"]), /una sola entrada/);
  assert.throws(() => leerArgumentos(["--diff", "a.md"]), /una sola entrada/);
  assert.throws(() => leerArgumentos(["--pr", "1", "--head", "abc123"]), /40 caracteres/);
  assert.throws(() => leerArgumentos(["--diff", "--head", SHA_A]), /--base y --head juntos/);
  assert.throws(() => leerArgumentos(["--head", SHA_A, "a.md"]), /solo van con --pr o con --diff/);
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
  assert.equal(r.version, 3);
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
  // Una pantalla por nombre, sin leerla, no puede ir por el carril rápido.
  assert.equal(correr(["--json"], { stdin: "components/Footer.tsx\n" }).codigo, 1);
});

const diffDe = (ruta, linea = "+hola") =>
  `diff --git a/${ruta} b/${ruta}\n--- a/${ruta}\n+++ b/${ruta}\n@@ -1 +1 @@\n${linea}\n`;

/**
 * gh y git falsos. `cabezas`: lo que devuelve cada `gh pr view`. `archivos`: { "<ref>:<ruta>": texto }.
 * `diffGit`: lo que devuelve `git diff`. Los refs se resuelven a sí mismos si son SHA, o por `refs`.
 */
function falso({ cabezas = [SHA_A, SHA_A], diff = diffDe("docs/a.md"), archivos = {}, diffGit = diff, refs = {} } = {}) {
  const llamadas = [];
  const ejecutar = (cmd, args, opts = {}) => {
    llamadas.push([cmd, ...args].join(" "));
    if (cmd === "gh" && args[1] === "view") return `${cabezas.shift()}\n`;
    if (cmd === "gh" && args[1] === "diff") return diff;
    if (cmd === "git" && args[0] === "fetch") return "";
    if (cmd === "git" && args[0] === "rev-parse") {
      const ref = args.at(-1).replace(/\^\{commit\}$/, "");
      const sha = refs[ref] ?? ([SHA_A, SHA_B, SHA_M].includes(ref) ? ref : null);
      if (!sha) throw Object.assign(new Error("no existe"), { stderr: "fatal: no existe" });
      return `${sha}\n`;
    }
    if (cmd === "git" && args[0] === "merge-base") return `${SHA_M}\n`;
    if (cmd === "git" && args[0] === "diff") return diffGit;
    if (cmd === "git" && args[0] === "cat-file") {
      // Formato de `git cat-file --batch`: «<sha> blob <largo>», salto, contenido y salto; o «<pedido> missing».
      const partes = [];
      for (const pedido of String(opts.input).split("\n").filter(Boolean)) {
        if (pedido in archivos) {
          const cuerpo = Buffer.from(archivos[pedido]);
          partes.push(Buffer.from(`${"e".repeat(40)} blob ${cuerpo.length}\n`), cuerpo, Buffer.from("\n"));
        } else partes.push(Buffer.from(`${pedido} missing\n`));
      }
      return Buffer.concat(partes);
    }
    throw new Error(`llamada inesperada: ${cmd} ${args.join(" ")}`);
  };
  return { llamadas, ejecutar };
}

test("contrato: --pr ata la clasificación a la cabeza, lee base y cabeza con git y devuelve head y base", () => {
  const f = falso({ refs: { "origin/main": SHA_B } });
  const ok = correr(["--json", "--pr", "12"], { ejecutar: f.ejecutar });
  assert.deepEqual(
    f.llamadas.filter((l) => l.startsWith("gh")),
    [
      "gh pr view 12 --json headRefOid --jq .headRefOid",
      "gh pr diff 12 --color=never",
      "gh pr view 12 --json headRefOid --jq .headRefOid",
    ],
  );
  assert.ok(f.llamadas.includes("git fetch --no-tags --quiet origin pull/12/head"));
  assert.ok(f.llamadas.some((l) => l.startsWith(`git merge-base ${SHA_A} ${SHA_B}`)));
  assert.equal(ok.codigo, 0, ok.err);
  const r = JSON.parse(ok.out);
  assert.equal(r.version, 3);
  assert.equal(r.pr, 12);
  assert.equal(r.origen, "pr");
  assert.equal(r.head, SHA_A);
  assert.equal(r.base, SHA_M);
  assert.equal(r.contenido, true);
});

test("contrato: --pr da revision si la base del archivo tenía la puerta, aunque el diff la quite", () => {
  const ruta = "components/zz/Embudos.tsx";
  const f = falso({
    refs: { "origin/main": SHA_B },
    diff: diffDe(ruta, '-if (!canAccessModule(rol, "kommo")) return null;'),
    archivos: {
      [`${SHA_M}:${ruta}`]: 'if (!canAccessModule(rol, "kommo")) return null;\nreturn <p>x</p>;',
      [`${SHA_A}:${ruta}`]: "return <p>x</p>;",
    },
  });
  const r = correr(["--json", "--pr", "12"], { ejecutar: f.ejecutar });
  assert.equal(r.codigo, 1, r.err);
  assert.equal(JSON.parse(r.out).causantes[0].regla, "contenido-sensible");
});

test("contrato: --pr con un archivo de presentación en base y cabeza da rapido", () => {
  const ruta = "components/zz/Tarjeta.tsx";
  const f = falso({
    refs: { "origin/main": SHA_B },
    diff: diffDe(ruta, "+<p>nuevo</p>"),
    archivos: { [`${SHA_M}:${ruta}`]: "<p>viejo</p>", [`${SHA_A}:${ruta}`]: "<p>nuevo</p>" },
  });
  const r = correr(["--json", "--pr", "12"], { ejecutar: f.ejecutar });
  assert.equal(r.codigo, 0, r.err);
});

test("contrato: un push durante la clasificación es error, no un rapido", () => {
  const r = correr(["--json", "--pr", "12"], { ejecutar: falso({ cabezas: [SHA_A, SHA_B] }).ejecutar });
  assert.equal(r.codigo, 2);
  assert.match(JSON.parse(r.out).error, /cambió de cabeza/);
});

test("contrato: --pr con --head distinto de la cabeza actual es error", () => {
  const r = correr(["--json", "--pr", "12", "--head", SHA_B], { ejecutar: falso().ejecutar });
  assert.equal(r.codigo, 2);
  assert.match(JSON.parse(r.out).error, /no b{40}/);
});

test("contrato: --diff --base --head verifica que el diff sea ese y lee los archivos", () => {
  const ruta = "components/zz/Tarjeta.tsx";
  const diff = diffDe(ruta, "+<p>nuevo</p>");
  const archivos = { [`${SHA_B}:${ruta}`]: "<p>viejo</p>", [`${SHA_A}:${ruta}`]: "<p>nuevo</p>" };
  const refs = { "HEAD^1": SHA_B, HEAD: SHA_A };

  const ok = correr(["--json", "--diff", "--base", "HEAD^1", "--head", "HEAD"], {
    stdin: diff,
    ejecutar: falso({ diff, archivos, refs }).ejecutar,
  });
  assert.equal(ok.codigo, 0, ok.err);
  const r = JSON.parse(ok.out);
  assert.equal(r.origen, "diff");
  assert.equal(r.head, SHA_A);
  assert.equal(r.base, SHA_B);
  assert.equal(r.contenido, true);

  const otro = correr(["--json", "--diff", "--base", "HEAD^1", "--head", "HEAD"], {
    stdin: diffDe("docs/a.md"),
    ejecutar: falso({ diff, archivos, refs }).ejecutar,
  });
  assert.equal(otro.codigo, 2, "el diff de stdin no es el de base..head");
  assert.match(JSON.parse(otro.out).error, /no es «git diff/);

  const noExiste = correr(["--json", "--diff", "--base", "HEAD^1", "--head", SHA_B.replace(/b/g, "d")], {
    stdin: diff,
    ejecutar: falso({ diff, archivos, refs }).ejecutar,
  });
  assert.equal(noExiste.codigo, 2, "un head que no existe se rechaza");
});

test("contrato: --diff sin --base ni --head solo ve nombres (una pantalla da revision)", () => {
  const { codigo, out } = correr(["--json", "--diff"], { stdin: diffDe("components/Footer.tsx") });
  assert.equal(codigo, 1);
  const r = JSON.parse(out);
  assert.equal(r.contenido, false);
  assert.equal(r.head, undefined, "sin --head no hay cabeza que reportar");
  assert.equal(correr(["--json", "--diff"], { stdin: diffDe("docs/a.md") }).codigo, 0);
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

test("el check de CI es liviano, informativo y usa el clasificador de main", () => {
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
  assert.match(wf, /carril\.mjs" --json --diff --base HEAD\^1 --head HEAD/, "diff verificado y archivos leídos");
  assert.doesNotMatch(wf, /exit "?\$codigo"?/, "el carril no se convierte en el código del job");
});
