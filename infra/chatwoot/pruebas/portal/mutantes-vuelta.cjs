// infra/chatwoot/pruebas/portal/mutantes-vuelta.cjs — mutantes del código de la vuelta del chat del portal, de
// destrabar y de la salud del webhook (SDD-0586, paso 10.5, PR 1b). Los mutantes de la migración 0520 están en su
// envoltorio de PGlite (lib/studio/__tests__/chatwoot-portal-vuelta.migration.test.ts).
//
// Uso:  node infra/chatwoot/pruebas/portal/mutantes-vuelta.cjs [números separados por coma]
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
const SALIDA = fs.mkdtempSync(path.join(os.tmpdir(), "mutantes-vuelta-"));
const elegidos = process.argv[2] ? new Set(process.argv[2].split(",").map(Number)) : null;
const VITEST = path.join(RAIZ, "node_modules/vitest/vitest.mjs");

const VUELTA = "lib/studio/chatwoot/portal-manejadores.ts";
const SALUD = "lib/studio/chatwoot/webhook-salud.ts";
const ROUTER = "lib/studio/chatwoot/router-api.ts";
const RUTA = "app/api/chatwoot/webhook/route.ts";
const CRON = "app/api/cron/chatwoot-agentes/route.ts";
const ACCION = "app/studio/(app)/bandeja/actions.ts";
const TARJETA = "app/studio/(app)/bandeja/_components/PortalChatwoot.tsx";
const T_VUELTA = "lib/studio/chatwoot/__tests__/portal-manejadores.test.ts";
const T_SALUD = "lib/studio/chatwoot/__tests__/webhook-salud.test.ts";
const T_ROUTER = "lib/studio/chatwoot/__tests__/router-api.test.ts";
const T_RUTA = "app/api/chatwoot/webhook/__tests__/route.test.ts";
const T_CRON = "app/api/cron/chatwoot-agentes/__tests__/route.test.ts";
const T_ACCION = "app/studio/(app)/bandeja/__tests__/destrabar-portal.test.ts";
const T_TARJETA = "app/studio/(app)/bandeja/__tests__/PortalChatwoot.test.tsx";

// [nombre, archivo, fragmento, reemplazo, prueba, nombre (parcial) de la prueba que tiene que caer]
const M = [
  // ── Críticos (E10-D37): qué va al portal ──
  ["va lo privado", VUELTA, "    !m.privado &&\n", "", T_VUELTA, "deja pasar solo lo saliente"],
  ["va el eco nuestro", VUELTA, '    !(m.sourceId ?? "").startsWith("dtd:") &&\n', "", T_VUELTA, "deja pasar solo lo saliente"],
  ["va lo que no es texto", VUELTA, '    (m.tipoContenido === null || m.tipoContenido === "text")', "    true", T_VUELTA, "deja pasar solo lo saliente"],
  ["un bot firma", VUELTA, '  const esUsuario = tipo === "user" || (tipo === null && m.sender_type === "User");', "  const esUsuario = true;", T_VUELTA, "un bot o un contacto no firman"],
  ["la ruta lee el texto de cualquier bandeja", VUELTA, '  if (inbox !== inboxPortalId || tipoDe(p.message_type) !== "outgoing") return null;', '  if (tipoDe(p.message_type) !== "outgoing") return null;', T_VUELTA, "otra bandeja, un entrante u otro evento dan null"],
  // ── Críticos: una sola vez ──
  ["avisa en el duplicado", VUELTA, '  if (resultado === "insertado" && fila?.cliente_id && texto) {', "  if (fila?.cliente_id !== undefined && texto) {", T_VUELTA, "un reintento (duplicado) no avisa otra vez"],
  ["no avisa al cliente", VUELTA, "    await notifyClientReplyPush(ctx.admin, { clientId: fila.cliente_id, body: texto });\n", "", T_VUELTA, "avisa al cliente una vez"],
  ["la nota no se busca antes", VUELTA, "  if (b.data !== null) return;\n", "", T_VUELTA, "la nota ya estaba (un reintento)"],
  ["sin búsqueda segura no lanza", VUELTA, "  if (!b.ok) throw new Error(`nota_buscar_${b.error}`);\n", "", T_VUELTA, "sin poder buscar la nota no se crea otra"],
  ["el archivado sin nota", VUELTA, '    await dejarNota(cfg, conversacionId, m, "archivado");', "", T_VUELTA, "a un hilo archivado no le avisa y deja su nota"],
  ["el adjunto sin nota", VUELTA, '    await dejarNota(cfg, conversacionId, m, "adjunto");', "", T_VUELTA, "con un adjunto: el texto llega al portal"],
  // ── El reproceso ──
  ["el reproceso no relee", VUELTA, "    if (!(await esDelPortal(ctx, cfg, conversacionId))) return;", "    return;", T_VUELTA, "con la conversación vinculada, lo relee y lo escribe"],
  ["relee sin mirar si es del portal", VUELTA, "    if (!(await esDelPortal(ctx, cfg, conversacionId))) return;\n", "", T_VUELTA, "no es del portal (o de otro tenant) no se relee"],
  ["el vínculo no mira el tenant", VUELTA, '    .eq("tenant_id", cfg.tenantId)\n', "", T_VUELTA, "no es del portal (o de otro tenant) no se relee"],
  ["el tipo numérico no se entiende", VUELTA, '  if (typeof v === "number" && Number.isInteger(v)) return TIPOS[v] ?? null;', '  if (typeof v === "number" && Number.isInteger(v)) return null;', T_VUELTA, "lee la fila de la API de cuenta"],
  ["la hora en segundos como milisegundos", VUELTA, '  if (typeof v === "number" && Number.isFinite(v) && v > 0) return new Date(v * 1000).toISOString();', '  if (typeof v === "number" && Number.isFinite(v) && v > 0) return new Date(v).toISOString();', T_VUELTA, "lee la fila de la API de cuenta"],
  // ── Cuándo no hace nada ──
  ["no mira el flag", VUELTA, "  if (!flags.chatwoot_portal) return;\n", "", T_VUELTA, "con el flag apagado"],
  ["sigue después de que la ruta miró", VUELTA, "  if (ctx.salientePortal === null) return;\n", "", T_VUELTA, "si la ruta ya miró y no es una respuesta del portal"],
  ["un entrante pasa", VUELTA, "  if (evento.avisar) return;\n", "", T_VUELTA, "con un entrante"],
  ["otra bandeja pasa", VUELTA, "  if (evento.conversacion.inboxId !== null && evento.conversacion.inboxId !== cfg.inboxPortalId) return;\n", "", T_VUELTA, "con otra bandeja"],
  ["otro tenant pasa", VUELTA, "  if (!cfg || cfg.tenantId !== ctx.tenantId) return;", "  if (!cfg) return;", T_VUELTA, "si el tenant del webhook no es el de la configuración"],
  // ── Lo que recibe la RPC ──
  ["la hora de Studio", VUELTA, "    p_enviado_at: m.creado,", "    p_enviado_at: new Date().toISOString(),", T_VUELTA, "escribe la respuesta con su hora y su agente"],
  ["sin agente", VUELTA, "    p_chatwoot_user_id: m.agenteId,", "    p_chatwoot_user_id: null,", T_VUELTA, "escribe la respuesta con su hora y su agente"],
  // ── El cliente de Chatwoot y la ruta ──
  ["la nota sale pública", ROUTER, 'body: { content: datos.texto, message_type: "outgoing", private: true, source_id: datos.sourceId },', 'body: { content: datos.texto, message_type: "outgoing", private: false, source_id: datos.sourceId },', T_ROUTER, "la nota privada sale saliente, privada"],
  ["releer pide la página anterior", ROUTER, "?before=${mensajeId + 1}", "?before=${mensajeId}", T_ROUTER, "leerMensaje pide la página que termina en ese mensaje"],
  ["la ruta no pasa lo saliente", RUTA, "          ? { salientePortal: salientePortalDelPayload(payload, portal.inboxPortalId) }", "          ? {}", T_RUTA, "una respuesta en la bandeja del portal llega al contexto"],
  // ── La salud del webhook ──
  ["10/8 cuenta como pública", SALUD, '["10.0.0.0", 8], ', "", T_SALUD, "10.1.2.3 no es pública"],
  ["fc00::/7 cuenta como pública", SALUD, "  if ((a & 0xfe00) === 0xfc00) return false; // fc00::/7\n", "", T_SALUD, "fd12:3456::1 no es pública"],
  ["la IPv4 mapeada no se mira", SALUD, "  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {", "  if (false) {", T_SALUD, "::ffff:10.0.0.1 no es pública"],
  ["un webhook de bandeja cuenta", SALUD, "    if (w.deBandeja) continue;\n", "", T_SALUD, "sin webhooks, con uno a otra ruta o solo de bandeja"],
  ["sin message_created no avisa", SALUD, '  if (conMensajes.length === 0) return ["webhook_sin_mensajes"];', '  if (false) return ["webhook_sin_mensajes"];', T_SALUD, "sin message_created"],
  ["cualquier IP basta", SALUD, "    if ((await resolver(n.host)).some(esIpPublica)) return [];", "    if ((await resolver(n.host)).length > 0) return [];", T_SALUD, "un host privado o que no resuelve"],
  ["el que no mide se calla", SALUD, '  if (servicioId === null) return ["webhook_no_medido"];', "  if (servicioId === null) return [];", T_SALUD, "sin usuario de servicio"],
  ["no medido se repite con Chatwoot caído", SALUD, '    if (a === "webhook_no_medido" && salud.alertas.includes("chatwoot_no_responde")) continue;\n', "", T_SALUD, "si Chatwoot no responde"],
  ["el cron no mira el webhook", CRON, "  sumarAlertasWebhook(r.salud, await revisarWebhookCuenta(cfg, ctx.servicioId));\n", "", T_CRON, "el webhook de cuenta suma sus alertas"],
  // ── Destrabar (§10.5.20) ──
  ["destrabar sin el gate de admin", ACCION, '  const gate = await tenantAdminGate(supabase);\n  if (!gate.ok) return { ok: false, error: "denied" };\n  const { data, error } = await supabase.rpc("chatwoot_portal_destrabar");', '  const { data, error } = await supabase.rpc("chatwoot_portal_destrabar");', T_ACCION, "quien no es admin no llega a la base"],
  ["destrabar con service_role", ACCION, '  const { data, error } = await supabase.rpc("chatwoot_portal_destrabar");', '  const { data, error } = await createAdminClient().rpc("chatwoot_portal_destrabar");', T_ACCION, "el admin destraba con su sesión"],
  ["el permiso negado se muestra como fallo", ACCION, '    return { ok: false, error: error.code === "42501" ? "denied" : "base" };', '    return { ok: false, error: "base" };', T_ACCION, "si la base rechaza por permiso"],
  ["reintentar con cero atascados", TARJETA, "disabled={pendiente || resumen.atascados === 0}", "disabled={pendiente}", T_TARJETA, "sin atascados el botón no se puede usar"],
  ["el foco cae al body", TARJETA, "    if (estado.ok || estado.error) resultado.current?.focus();\n", "", T_TARJETA, "con atascados: reintenta y dice cuántos"],
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

const filas = [`== mutantes de la vuelta · salida en ${SALIDA}`];
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
