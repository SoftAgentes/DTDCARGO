// infra/chatwoot/pruebas/portal/mutantes-estado.cjs — mutantes del código del estado del hilo del portal y la
// conciliación (SDD-0586, paso 10.5, 1c-2: E10-D39 y E10-D40.5). Los de la migración 0521 están en su envoltorio de
// PGlite (lib/studio/__tests__/chatwoot-portal-estado.migration.test.ts); los de la solo lectura, que la 1c-2 cambia
// (opción b: solo el flag decide), en mutantes-solo-lectura.cjs.
//
// Uso:  node infra/chatwoot/pruebas/portal/mutantes-estado.cjs [números separados por coma]
//       node infra/chatwoot/pruebas/portal/mutantes-estado.cjs --revisar   (solo cuenta los fragmentos)
// Necesita node_modules (vitest). Corre una prueba a la vez (--maxWorkers=1): es una corrida pesada.
//
// M0: la base sin mutar tiene que salir verde en cada archivo de prueba; si no, no corre nada. Cada mutante es
// un cambio que aparece UNA vez y tiene que hacer caer la prueba cuyo nombre se espera, no otra. El archivo
// original se respalda antes de cada mutante y se restaura siempre. Sale 0 solo si mueren todos.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const RAIZ = path.resolve(__dirname, "../../../..");
const revisar = process.argv[2] === "--revisar";
const elegidos = process.argv[2] && !revisar ? new Set(process.argv[2].split(",").map(Number)) : null;
const VITEST = path.join(RAIZ, "node_modules/vitest/vitest.mjs");

const MANEJADORES = "lib/studio/chatwoot/portal-manejadores.ts";
const CONCILIAR = "lib/studio/chatwoot/portal-conciliar.ts";
const PROCESAR = "lib/studio/chatwoot/webhook-procesar.ts";
const CRON = "app/api/cron/chatwoot-reintentos/route.ts";
const T_CONCILIAR = "lib/studio/chatwoot/__tests__/portal-conciliar.test.ts";
const T_NOMBRES = "lib/studio/chatwoot/__tests__/aviso-unico-por-evento.test.ts";
const T_CRON = "app/api/cron/chatwoot-reintentos/__tests__/route.test.ts";

// [nombre, archivo, fragmento, reemplazo, prueba, nombre (parcial) de la prueba que tiene que caer]
const M = [
  // ── El estado (E10-D39) ──
  ["el estado solo si el evento no es de relleno", MANEJADORES, "  await estadoDelHilo(ctx.admin, cfg.tenantId, evento.conversacion.id);", '  if (evento.conversacion.estado !== "open") await estadoDelHilo(ctx.admin, cfg.tenantId, evento.conversacion.id);', T_CONCILIAR, "en el reproceso (sin bandeja y con el estado de relleno)"],
  ["le pasa el estado del evento", MANEJADORES, "    p_chatwoot_conversation_id: conversacionId,\n  });\n  if (error) {\n    if (error.code === \"PGRST202\")", "    p_chatwoot_conversation_id: conversacionId,\n    p_estado: \"open\",\n  });\n  if (error) {\n    if (error.code === \"PGRST202\")", T_CONCILIAR, "pide el estado a la base solo con el tenant y la conversación"],
  ["el estado de otra bandeja", MANEJADORES, "  if (evento.conversacion.inboxId !== null && evento.conversacion.inboxId !== cfg.inboxPortalId) return;\n  const flags = await listFeatureFlags(ctx.admin, ctx.tenantId);\n  if (!flags.chatwoot_portal) return;\n  await estadoDelHilo(", "  const flags = await listFeatureFlags(ctx.admin, ctx.tenantId);\n  if (!flags.chatwoot_portal) return;\n  await estadoDelHilo(", T_CONCILIAR, "otra bandeja, otro tenant, el flag apagado o sin configuración"],
  ["el estado con el flag apagado", MANEJADORES, "  if (!flags.chatwoot_portal) return;\n  await estadoDelHilo(", "  await estadoDelHilo(", T_CONCILIAR, "otra bandeja, otro tenant, el flag apagado o sin configuración"],
  ["sin la 0521 lanza", MANEJADORES, "    if (error.code === \"PGRST202\") return \"sin_migracion\";\n", "", T_CONCILIAR, "sin la 0521 (PGRST202) no lanza"],
  ["el error de la base no lanza", MANEJADORES, "    throw new Error(`chatwoot_portal_estado_hilo: ${error.code ?? \"sin código\"}`);", "    return \"error\";", T_CONCILIAR, "sin la 0521 (PGRST202) no lanza"],
  ["el manejador no está en la lista", PROCESAR, "entrarLead, responderAlPortal, estadoAlPortal];", "entrarLead, responderAlPortal];", T_NOMBRES, "sobrevive a la minificación"],
  // ── La conciliación (E10-D40.5) ──
  [
    "para en el primer conocido",
    CONCILIAR,
    "  for (const m of [...juntados.values()].sort((a, b) => a.id - b.id)) {\n    if (!esRespuestaDelEquipo(m, cfg.inboxPortalId)) continue;\n    if ((await escribirRespuestaPortal(admin, cfg, conversacionId, m)) === \"insertado\") traidas += 1;\n  }",
    "  for (const m of [...juntados.values()].sort((a, b) => b.id - a.id)) {\n    if (!esRespuestaDelEquipo(m, cfg.inboxPortalId)) continue;\n    const r = await escribirRespuestaPortal(admin, cfg, conversacionId, m);\n    if (r === \"duplicado\") break;\n    if (r === \"insertado\") traidas += 1;\n  }",
    T_CONCILIAR,
    "la pérdida salteada",
  ],
  ["marca aunque lo corte el tope", CONCILIAR, "  if (completo) {\n    const { error } = await admin.rpc(", "  if (true) {\n    const { error } = await admin.rpc(", T_CONCILIAR, "si lo corta el tope de páginas"],
  ["solo la primera página", CONCILIAR, "pagina < topePaginas;", "pagina < 1;", T_CONCILIAR, "25 respuestas perdidas, con páginas de 20"],
  ["escribe en orden descendente", CONCILIAR, ".sort((a, b) => a.id - b.id)", ".sort((a, b) => b.id - a.id)", T_CONCILIAR, "25 respuestas perdidas, con páginas de 20"],
  ["no se detiene en la marca", CONCILIAR, "    if (marca !== null && minimo <= marca) {\n      completo = true;\n      break;\n    }\n", "", T_CONCILIAR, "pasa la marca y no vuelve a escribir lo de antes de ella"],
  ["lleva lo que no es del equipo", CONCILIAR, "    if (!esRespuestaDelEquipo(m, cfg.inboxPortalId)) continue;\n", "", T_CONCILIAR, "solo lleva las respuestas del equipo"],
  ["no corrige el espejo", CONCILIAR, "  await aplicarConversacion({ admin, tenantId: cfg.tenantId }, c.data, null);\n", "", T_CONCILIAR, "antes de los mensajes corrige el espejo"],
  ["un hilo que falla frena los demás", CONCILIAR, "      r.fallidos += 1;\n", "      throw e;\n", T_CONCILIAR, "un hilo que falla no frena los demás"],
  ["la marca con el más viejo", CONCILIAR, "if (masNuevo === null || m.id > masNuevo) masNuevo = m.id;", "if (masNuevo === null || m.id < masNuevo) masNuevo = m.id;", T_CONCILIAR, "25 respuestas perdidas, con páginas de 20"],
  ["sin tope de hilos", CONCILIAR, "    p_limite: topeHilos,", "    p_limite: 100,", T_CONCILIAR, "pide a la base los hilos del tenant configurado, con el tope de 20"],
  ["concilia con el flag apagado", CONCILIAR, "  if (!flags.chatwoot_portal) return { ...VACIO, omitido: \"apagado\" };\n", "", T_CONCILIAR, "con el flag apagado, sin configuración o sin la 0521"],
  // ── El cron ──
  ["el cron no concilia", CRON, "  const conciliacionPortal = await conciliarPortal(admin).catch(() => ({ omitido: \"error\" as const }));", "  const conciliacionPortal = { omitido: \"error\" as const };", T_CRON, "concilia el portal después de la ida y del aviso"],
  ["el cron cae si la conciliación lanza", CRON, "await conciliarPortal(admin).catch(() => ({ omitido: \"error\" as const }));", "await conciliarPortal(admin);", T_CRON, "si la conciliación lanza, el cron sigue"],
];

if (revisar) {
  let malos = 0;
  M.forEach(([nombre, archivo, de], i) => {
    const veces = fs.readFileSync(path.join(RAIZ, archivo), "utf8").split(de).length - 1;
    if (veces !== 1) malos += 1;
    console.log(`M${i + 1} «${nombre}»: ${veces === 1 ? "ok" : `INVÁLIDO (${veces} veces)`}`);
  });
  console.log(`${M.length} mutantes, ${malos} inválidos`);
  process.exit(malos === 0 ? 0 : 1);
}

const SALIDA = fs.mkdtempSync(path.join(os.tmpdir(), "mutantes-estado-"));

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

const respaldo = (archivo) => path.join(SALIDA, "respaldo", archivo.replace(/[\\/()[\]]/g, "_"));
fs.mkdirSync(path.join(SALIDA, "respaldo"), { recursive: true });
for (const archivo of new Set(M.map((m) => m[1]))) fs.copyFileSync(path.join(RAIZ, archivo), respaldo(archivo));

const filas = [`== mutantes del estado y la conciliación · salida en ${SALIDA}`];
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
