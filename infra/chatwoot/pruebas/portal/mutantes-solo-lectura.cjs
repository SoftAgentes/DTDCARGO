// infra/chatwoot/pruebas/portal/mutantes-solo-lectura.cjs — mutantes de «Studio en solo lectura» para los hilos
// del portal (SDD-0586, paso 10.5, 1c-1: E10-D41). Mismo ejecutor que el de la vuelta (mutantes-vuelta.cjs).
//
// Uso:  node infra/chatwoot/pruebas/portal/mutantes-solo-lectura.cjs [números separados por coma]
//       node infra/chatwoot/pruebas/portal/mutantes-solo-lectura.cjs --revisar   (solo cuenta los fragmentos)
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

const PIEZA = "lib/studio/chatwoot/portal-solo-lectura.ts";
const ACCIONES = "app/studio/(app)/conversaciones/actions.ts";
const RUTA = "app/api/studio/conversaciones/[id]/route.ts";
const HILO = "app/studio/(app)/conversaciones/_components/ConversationThread.tsx";
const CLIENTE = "app/studio/(app)/conversaciones/_components/ConversacionesClient.tsx";
const PAGE = "app/studio/(app)/conversaciones/page.tsx";
const T_PIEZA = "lib/studio/chatwoot/__tests__/portal-solo-lectura.test.ts";
const T_SEND = "app/studio/(app)/conversaciones/__tests__/send-reply-gate.test.ts";
const T_STATUS = "app/studio/(app)/conversaciones/__tests__/set-status-gate.test.ts";
const T_RUTA = "app/api/studio/conversaciones/[id]/__tests__/route.test.ts";
const T_HILO = "app/studio/(app)/conversaciones/__tests__/thread-solo-lectura.test.tsx";

// [nombre, archivo, fragmento, reemplazo, prueba, nombre (parcial) de la prueba que tiene que caer]
const M = [
  // ── La pieza: cuándo está puesta la traba ──
  ["fail-open al leer el flag", PIEZA, '  if (error) return "no_se_sabe";', '  if (error) return "apagada";', T_PIEZA, "si la lectura falla, no se sabe"],
  // 1c-2 (opción b del DG): solo el flag decide, aunque falte la configuración.
  ["vuelve a mirar la configuración", PIEZA, '  if (!tenantId) return "no_se_sabe";\n', '  if (!tenantId) return "no_se_sabe";\n  if (!process.env.CHATWOOT_INBOX_PORTAL_ID) return "apagada";\n', T_PIEZA, "sin la bandeja del portal configurada, el flag decide igual"],
  ["vuelve a mirar el tenant de la configuración", PIEZA, '  if (!tenantId) return "no_se_sabe";\n', '  if (!tenantId) return "no_se_sabe";\n  if (process.env.CHATWOOT_TENANT_ID && process.env.CHATWOOT_TENANT_ID !== tenantId) return "apagada";\n', T_PIEZA, "con la configuración de otro tenant, decide el flag"],
  ["sin tenant de la sesión deja pasar", PIEZA, '  if (!tenantId) return "no_se_sabe";', '  if (!tenantId) return "apagada";', T_PIEZA, "sin saber el tenant de la sesión"],
  ["el flag no se filtra por tenant", PIEZA, '    .eq("tenant_id", tenantId)\n', "", T_PIEZA, "encendida con el flag del tenant"],
  ["el flag no se filtra por clave", PIEZA, '    .eq("key", "chatwoot_portal")\n', "", T_PIEZA, "encendida con el flag del tenant"],
  ["no mira el canal", PIEZA, '  if (canal !== "portal") return null;\n', "", T_PIEZA, "otro canal sigue siempre"],
  ["«no se sabe» deja pasar", PIEZA, '  if (estado === "apagada") return null;', '  if (estado !== "activa") return null;', T_PIEZA, "sin poder leer el flag"],
  // ── Las acciones ──
  ["sendReply sin la traba", ACCIONES, "  const rechazo = await rechazoPortal(supabase, tenantId, conv.channel);\n  if (rechazo) return { error: rechazo };\n", "", T_SEND, "con el flag encendido y la bandeja configurada: rechaza sin insertar ni avisar"],
  ["sendReply con fail-open (pieza)", PIEZA, '  return estado === "activa" ? MENSAJE_SOLO_LECTURA : MENSAJE_NO_SE_SABE;', '  return estado === "activa" ? MENSAJE_SOLO_LECTURA : null;', T_SEND, "si no se puede leer el flag, el hilo del portal también se traba"],
  ["setStatus sin la traba", ACCIONES, "    const rechazo = await rechazoPortal(supabase, await resolveTenantId(supabase), hilo.channel);\n    if (rechazo) return { error: rechazo };\n", "", T_STATUS, "con el flag encendido y la bandeja configurada: no cambia el estado"],
  ["setStatus no resuelve el tenant", ACCIONES, "rechazoPortal(supabase, await resolveTenantId(supabase), hilo.channel)", "rechazoPortal(supabase, null, hilo.channel)", T_STATUS, "con el flag encendido y la bandeja configurada: no cambia el estado"],
  ["setStatus sigue si no pudo leer el hilo", ACCIONES, '  if (errorHilo) return { error: "No se pudo leer la conversación. Vuelve a intentar." };\n', "", T_STATUS, "si no se puede leer el hilo, no escribe"],
  ["setStatus lee el hilo sin su id", ACCIONES, '    .select("id, channel")\n    .eq("id", input!.conversation_id)\n', '    .select("id, channel")\n', T_STATUS, "el hilo se lee con la sesión y por su id"],
  // ── La ruta del detalle ──
  ["la ruta lee la Bandeja de cualquier canal", RUTA, '    conv.channel === "portal" ? conversacionEnBandeja(conv.id, conv.tenant_id) : Promise.resolve(null),', "    conversacionEnBandeja(conv.id, conv.tenant_id),", T_RUTA, "un hilo de otro canal no lee nada con service_role"],
  ["la ruta no filtra el tenant", RUTA, '    .eq("tenant_id", tenantId)\n', "", T_RUTA, "leído por el hilo y su tenant"],
  ["la ruta no filtra el hilo", RUTA, '    .eq("conversation_id", hiloId)\n', "", T_RUTA, "leído por el hilo y su tenant"],
  ["la ruta no devuelve el número", RUTA, "  return NextResponse.json({ messages, context, digests, bandeja });", "  return NextResponse.json({ messages, context, digests });", T_RUTA, "leído por el hilo y su tenant"],
  // ── La pantalla ──
  ["la caja con la traba activa", HILO, "        {!soloLectura && (\n          <form", "        {(\n          <form", T_HILO, "portal con la traba activa: aviso y enlace"],
  ["sin el aviso", HILO, "        {soloLectura && (\n          <div\n            role=\"note\"", "        {false && (\n          <div\n            role=\"note\"", T_HILO, "portal con la traba activa: aviso y enlace"],
  ["el selector sin deshabilitar", HILO, "              disabled={soloLectura}\n", "", T_HILO, "el selector de estado queda deshabilitado"],
  ["el selector sin su explicación", HILO, "              aria-describedby={soloLectura ? avisoId : undefined}\n", "", T_HILO, "el selector de estado queda deshabilitado y explicado"],
  ["el cambio de estado no se corta", HILO, "    if (soloLectura) return;\n", "", T_HILO, "no cambia el estado"],
  ["«no se sabe» deja la caja", HILO, '  const soloLectura = conv.channel === "portal" && trabaPortal !== "apagada";', '  const soloLectura = conv.channel === "portal" && trabaPortal === "activa";', T_HILO, "si no se pudo comprobar la traba"],
  ["el hilo no mira el canal", HILO, '  const soloLectura = conv.channel === "portal" && trabaPortal !== "apagada";', '  const soloLectura = trabaPortal !== "apagada";', T_HILO, "otro canal con la traba activa"],
  ["sin la prop se traba", HILO, 'realtimeTick = 0, trabaPortal = "apagada" }: Props)', 'realtimeTick = 0, trabaPortal = "activa" }: Props)', T_HILO, "sin la prop, la traba se toma por apagada"],
  ["el enlace sin el número", HILO, "href={`/studio/bandeja?c=${bandeja}`}", 'href="/studio/bandeja"', T_HILO, "portal con la traba activa: aviso y enlace"],
  ["el enlace sin conversación", HILO, "            {bandeja !== null && (", "            {(", T_HILO, "sin conversación en Chatwoot todavía"],
  ["el número no se lee del detalle", HILO, '          setBandeja(typeof data.bandeja === "number" ? data.bandeja : null);\n', "", T_HILO, "portal con la traba activa: aviso y enlace"],
  // ── El cableado page → cliente → hilo ──
  ["el cliente no pasa la traba", CLIENTE, "            trabaPortal={trabaPortal}\n", "", T_HILO, "la page calcula la traba del tenant"],
  ["la page no pasa la traba", PAGE, "        trabaPortal={trabaPortalTenant}\n", "", T_HILO, "la page calcula la traba del tenant"],
  ["la page mira otro tenant", PAGE, "    trabaPortal(supabase, tenantId),", "    trabaPortal(supabase, null),", T_HILO, "la page calcula la traba del tenant"],
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

const SALIDA = fs.mkdtempSync(path.join(os.tmpdir(), "mutantes-solo-lectura-"));

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

const filas = [`== mutantes de solo lectura · salida en ${SALIDA}`];
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
