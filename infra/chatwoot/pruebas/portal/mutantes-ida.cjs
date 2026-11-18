// infra/chatwoot/pruebas/portal/mutantes-ida.cjs — mutantes del código de la ida del chat del portal a Chatwoot
// (SDD-0586, paso 10.5, PR 1a). Los mutantes de la migración 0519 están en su envoltorio de PGlite
// (lib/studio/__tests__/chatwoot-portal.migration.test.ts) y en la carrera de dos sesiones.
//
// Uso:  node infra/chatwoot/pruebas/portal/mutantes-ida.cjs [números separados por coma]
// Necesita node_modules (vitest). Corre una prueba a la vez (--maxWorkers=1): es una corrida pesada.
//
// M0: la base sin mutar tiene que salir verde en cada archivo de prueba; si no, no corre nada. Cada mutante es
// un cambio que aparece UNA vez y tiene que hacer caer la prueba cuyo nombre se espera, no otra. El archivo
// original se respalda antes de cada mutante y se restaura siempre, también si una corrida anterior murió a
// mitad. Sale 0 solo si mueren todos.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RAIZ = path.resolve(__dirname, "../../../..");
const SALIDA = fs.mkdtempSync(path.join(os.tmpdir(), "mutantes-ida-"));
const elegidos = process.argv[2] ? new Set(process.argv[2].split(",").map(Number)) : null;
const VITEST = path.join(RAIZ, "node_modules/vitest/vitest.mjs");

const PORTAL = "lib/studio/chatwoot/portal.ts";
const ROUTER = "lib/studio/chatwoot/router-api.ts";
const CONFIG = "lib/studio/chatwoot/config.ts";
const RUTA = "app/api/cron/chatwoot-reintentos/route.ts";
const ACCION = "app/portal/(app)/mensajes/actions.ts";
const T_PORTAL = "lib/studio/chatwoot/__tests__/portal.test.ts";
const T_ROUTER = "lib/studio/chatwoot/__tests__/router-api.test.ts";
const T_RUTA = "app/api/cron/chatwoot-reintentos/__tests__/route.test.ts";
const T_ACCION = "app/portal/reintento-no-duplica.test.ts";

// [nombre, archivo, fragmento, reemplazo, prueba, nombre (parcial) de la prueba que tiene que caer]
const M = [
  // ── Críticos: el incierto busca el source_id antes de reenviar ──
  ["incierto: no busca el source_id antes de reenviar", PORTAL, "  if (fila.verificar) {\n    const b = await buscarMensajePorSourceId", "  if (false) {\n    const b = await buscarMensajePorSourceId", T_PORTAL, "si ya entró no lo reenvía"],
  ["incierto: no lo deja marcado", PORTAL, "    p_incierto: r.ok ? false : r.incierto,", "    p_incierto: false,", T_PORTAL, "cierra el intento como incierto"],
  ["incierto: una respuesta rara a un POST no cuenta", PORTAL, 'incierto: envioIncierto(error) || error === "respuesta_invalida"', "incierto: envioIncierto(error)", T_PORTAL, "respuesta_invalida es incierto"],
  ["incierto: si no puede buscar, reenvía", PORTAL, "  return { ok: false, codigo: codigo(paso, error), incierto: true };", "  return { ok: false, codigo: codigo(paso, error), incierto: false };", T_PORTAL, "si no puede buscar, no reenvía"],
  ["incierto: la base caída no cuenta", PORTAL, '        r = { ok: false, codigo: "base", incierto: true };', '        r = { ok: false, codigo: "base", incierto: false };', T_PORTAL, "el intento queda incierto"],
  // ── Críticos: el orden y un envío por hilo ──
  ["orden: procesa al revés de como da tomar", PORTAL, "    for (const fila of filas) {", "    for (const fila of [...filas].reverse()) {", T_PORTAL, "procesa en el orden que da tomar"],
  ["un envío por hilo: el portal pide de a varios", PORTAL, "{ hiloId, limite: 1, maxVueltas: 5 }", "{ hiloId, limite: 10, maxVueltas: 5 }", T_PORTAL, "agenda el envío de ese hilo"],
  ["un envío por hilo: cierra otro intento", PORTAL, "    p_intento: fila.intento,", "    p_intento: 1,", T_PORTAL, "si ya entró no lo reenvía"],
  // ── Contacto y conversación sin duplicar ──
  ["contacto: no busca antes de crear después de un incierto", PORTAL, "    if (fila.verificar) {\n      const b = await buscarContactoPortal", "    if (false) {\n      const b = await buscarContactoPortal", T_PORTAL, "busca antes de crear"],
  ["contacto: un 422 no se busca", PORTAL, '      } else if (c.error === "http_422") {', "      } else if (false) {", T_PORTAL, "un contacto que ya existe (422)"],
  ["contacto: no se guarda antes de la conversación", PORTAL, "    await vincular(admin, cfg, fila.hilo_id, contacto, null);\n", "", T_PORTAL, "guarda el contacto, después la conversación"],
  ["conversación: no reusa la del incierto", PORTAL, "    if (fila.verificar) {\n      const libre", "    if (false) {\n      const libre", T_PORTAL, "reusa la de la bandeja que no está vinculada"],
  ["conversación: reusa una ya vinculada", PORTAL, ".filter((id) => !ocupadas.has(id))", ".filter(() => true)", T_PORTAL, "reusa la de la bandeja que no está vinculada"],
  // ── Apagado y sin configuración ──
  ["el envío no mira el flag", PORTAL, '  if (!flags.chatwoot_portal) return { ...resultado, omitido: "apagado" };\n', "", T_PORTAL, "con el flag apagado no toma nada"],
  ["el portal agenda sin configuración", PORTAL, "  if (!chatwootPortalConfig()) return;\n", "", T_PORTAL, "sin configuración no agenda nada"],
  ["la configuración no exige la bandeja", CONFIG, "!ID.test(bandeja) || ", "", T_PORTAL, "sin CHATWOOT_INBOX_PORTAL_ID da null"],
  // ── Aviso ──
  ["aviso: repite en la misma hora", PORTAL, ".filter((u) => !avisados.has(u))", ".filter(() => true)", T_PORTAL, "en la misma hora no repite"],
  ["aviso: no avisa por un solo mensaje", PORTAL, "  if (!(sinLlegar > 0)) return", "  if (!(sinLlegar > 1)) return", T_PORTAL, "un solo mensaje, en singular"],
  ["aviso: avisa sin saber a quién ya avisó", PORTAL, "  if (admins.error || ya.error) {", "  if (admins.error) {", T_PORTAL, "si no sabe a quién ya avisó"],
  // ── Cron y portal ──
  ["el cron se cae con la ida del portal", RUTA, '  const portal = await enviarPortalPendientes(admin).catch(() => ({ omitido: "error" as const }));', "  const portal = await enviarPortalPendientes(admin);", T_RUTA, "si la ida del portal lanza"],
  ["el cron avisa antes de mandar", RUTA, '  const portal = await enviarPortalPendientes(admin).catch(() => ({ omitido: "error" as const }));\n  const avisoPortal = await avisarRezagoPortal(admin).catch(() => ({ omitido: "error" as const }));', '  const avisoPortal = await avisarRezagoPortal(admin).catch(() => ({ omitido: "error" as const }));\n  const portal = await enviarPortalPendientes(admin).catch(() => ({ omitido: "error" as const }));', T_RUTA, "manda la cola del portal y después avisa"],
  ["el portal no pide el envío", ACCION, "      pedirEnvioPortal(conversationId);\n", "", T_ACCION, "envía el identificador a la firma nueva y avisa al equipo"],
  ["el portal falla si pedir el envío lanza", ACCION, "    try {\n      pedirEnvioPortal(conversationId);\n    } catch {\n      // El mensaje del cliente nunca falla por Chatwoot (E10-D24).\n    }", "    pedirEnvioPortal(conversationId);", T_ACCION, "el mensaje del cliente igual sale bien"],
  // ── La búsqueda del source_id, página por página (revisión independiente de la #424) ──
  ["búsqueda: busca desde otra hora", PORTAL, "new Date(fila.enviado_at)", "new Date(0)", T_PORTAL, "si ya entró no lo reenvía"],
  ["búsqueda: solo la primera página", ROUTER, "    antes = minId;\n", "    return { ok: true, data: null };\n", T_ROUTER, "lo encuentra en la segunda página"],
  ["búsqueda: no corta al pasar la hora", ROUTER, "    if (minCreado !== null && minCreado < limite) return { ok: true, data: null };\n", "", T_ROUTER, "corta al pasar la hora del mensaje de Studio"],
  ["búsqueda: sin el margen de 5 minutos", ROUTER, "const MARGEN_BUSQUEDA_S = 300;", "const MARGEN_BUSQUEDA_S = 0;", T_ROUTER, "el margen de 5 minutos"],
  ["búsqueda: en el tope lo da por ausente", ROUTER, '  return { ok: false, error: "busqueda_incompleta" };', "  return { ok: true, data: null };", T_ROUTER, "sin pasar la hora en el tope de páginas"],
  ["búsqueda: da vueltas si Chatwoot ignora before", ROUTER, '    if (antes !== null && minId >= antes) return { ok: false, error: "respuesta_invalida" };\n', "", T_ROUTER, "si Chatwoot ignora ?before="],
];

function correr(prueba, etiqueta) {
  const json = path.join(SALIDA, `${etiqueta}.json`);
  const r = spawnSync(process.execPath, [VITEST, "run", prueba, "--maxWorkers=1", "--reporter=json", `--outputFile=${json}`], {
    cwd: RAIZ,
    encoding: "utf8",
    timeout: 300_000,
  });
  if (!fs.existsSync(json)) return { status: r.status, sinReporte: true, fallidas: [], total: 0, aprobadas: 0 };
  const rep = JSON.parse(fs.readFileSync(json, "utf8"));
  const fallidas = rep.testResults.flatMap((t) => t.assertionResults.filter((a) => a.status === "failed").map((a) => a.fullName));
  return { status: r.status, fallidas, total: rep.numTotalTests, aprobadas: rep.numPassedTests };
}

const respaldo = (archivo) => path.join(SALIDA, "respaldo", archivo.replace(/[\\/()]/g, "_"));
fs.mkdirSync(path.join(SALIDA, "respaldo"), { recursive: true });
for (const archivo of new Set(M.map((m) => m[1]))) fs.copyFileSync(path.join(RAIZ, archivo), respaldo(archivo));

const filas = [`== mutantes de la ida · salida en ${SALIDA}`];
const elegidosM = M.map((m, i) => [m, i + 1]).filter(([, n]) => !elegidos || elegidos.has(n));
for (const prueba of new Set(elegidosM.map(([m]) => m[4]))) {
  const b = correr(prueba, `base-${path.basename(prueba)}`);
  const ok = b.status === 0 && b.fallidas.length === 0 && b.total > 0;
  filas.push(`M0 base ${prueba}: ${ok ? "VERDE" : "ROJA"} (${b.aprobadas}/${b.total})`);
  if (!ok) {
    console.log(filas.join("\n"));
    console.log("La base no está verde: no se corren mutantes.");
    process.exit(2);
  }
}

let vivos = 0;
for (const [[nombre, archivo, de, a, prueba, espera], n] of elegidosM) {
  const original = fs.readFileSync(respaldo(archivo), "utf8");
  const partes = original.split(de);
  if (partes.length !== 2) {
    filas.push(`M${n} «${nombre}»: INVÁLIDO (el fragmento aparece ${partes.length - 1} veces)`);
    vivos += 1;
    continue;
  }
  try {
    fs.writeFileSync(path.join(RAIZ, archivo), partes.join(a));
    const r = correr(prueba, `m${n}`);
    const cayo = r.fallidas.some((f) => f.includes(espera));
    if (!cayo) vivos += 1;
    filas.push(
      `M${n} «${nombre}»: ${cayo ? "MUERE" : "VIVE"} — ${r.fallidas.length} roja(s)` +
        (r.fallidas.length ? `: ${r.fallidas.map((f) => f.split(" > ").pop()).join(" | ")}` : "") +
        (r.sinReporte ? " (sin reporte)" : ""),
    );
  } finally {
    fs.copyFileSync(respaldo(archivo), path.join(RAIZ, archivo));
  }
}
for (const archivo of new Set(M.map((m) => m[1]))) {
  const igual = fs.readFileSync(respaldo(archivo), "utf8") === fs.readFileSync(path.join(RAIZ, archivo), "utf8");
  filas.push(`restaurado ${archivo}: ${igual ? "sí" : "NO"}`);
}
filas.push(`TOTAL: ${elegidosM.length} mutantes, ${elegidosM.length - vivos} mueren, ${vivos} viven o inválidos`);
const informe = filas.join("\n");
fs.writeFileSync(path.join(SALIDA, "informe.txt"), `${informe}\n`);
console.log(informe);
process.exit(vivos === 0 ? 0 : 1);
