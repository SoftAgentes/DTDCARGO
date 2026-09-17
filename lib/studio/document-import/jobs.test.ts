// @vitest-environment node
/**
 * SDD-0473 — Contratos del ciclo de vida de un documento importado.
 *
 * Esta suite no describe funciones: fija las invariantes que, si se rompen,
 * producen un DATO FALSO, una FUGA entre clientes o un COBRO de IA indebido.
 *
 *  1. Ningún byte de un desconocido se lee sin coincidir con lo declarado:
 *     tamaño exacto, firma real del formato y codificación. La extensión del
 *     nombre no manda sobre el contenido; un .pdf que por dentro es XLSX se
 *     rechaza, se borra del almacenamiento y nunca queda con huella registrada.
 *  2. Una huella, un trabajo: el mismo contenido no se lee ni se cobra dos
 *     veces, y la deduplicación JAMÁS cruza espacios de trabajo (el sha256 de
 *     otro cliente no puede devolver el id de su trabajo).
 *  3. El arriendo (lease) es la única autorización para escribir el resultado.
 *     Un worker cuyo arriendo venció no pisa lo que escribió el worker vigente,
 *     ni en el camino de éxito ni en el de error. Sin arriendo válido: no
 *     escribe y lo reporta como no procesado.
 *  4. La cuota diaria y el presupuesto de tokens se reservan ANTES de contactar
 *     a la IA y antes de descargar un byte; si algo falla o no está
 *     configurado, se NIEGA la lectura (fail-closed), no se permite.
 *  5. Nunca inventar datos: sin huella coincidente no se procesa; con faltantes
 *     bloqueantes el resultado se marca `partial`, nunca `ready`.
 *  6. Lo que se persiste como error es un código saneado: nunca el texto del
 *     documento ni el mensaje crudo del proveedor de IA.
 *  7. Limpieza: un espacio caducado sólo desaparece DESPUÉS de que sus archivos
 *     privados salieron del almacenamiento.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyDocumentDraft, type DocumentDraft } from "@/lib/shared/document-import";

const extraccion = vi.hoisted(() => ({ extractDocument: vi.fn() }));
vi.mock("./extract", () => ({ extractDocument: extraccion.extractDocument }));

import type { WorkspaceRow } from "./access";
import { IMPORT_BUCKET, MAX_IMPORT_BYTES } from "./service";
import { cleanupImports, finishUpload, processImportJob, verifyFile, type ImportJob } from "./jobs";

// ── Datos sintéticos (ningún documento real de cliente) ────────────────────
const PDF = new TextEncoder().encode("%PDF-1.7\nContenido sintetico de prueba\n%%EOF");
// Cabecera local de ZIP como la escribe cualquier XLSX real: firma + versión,
// banderas y método, campos que traen bytes nulos.
const XLSX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00, ...new TextEncoder().encode("xl/workbook.xml sintetico")]);
const CSV = new TextEncoder().encode("ITEM,QUANTITY,PRICE\nBolso,10,2.5\n");
const huella = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const RUTA = "tenant-1/ws-1/job-1.pdf";
const espacioAbierto = { id: "ws-1", expires_at: null };
const ws = { id: "ws-1" } as WorkspaceRow;

function trabajo(extra: Fila = {}): Fila {
  return {
    id: "job-1", workspace_id: "ws-1", storage_path: RUTA, file_name: "proforma.pdf",
    file_kind: "proforma", content_type: "application/pdf", size_bytes: PDF.byteLength,
    status: "queued", sha256: huella(PDF), attempts: 1, lease_token: null,
    error_code: null, result: null, lease_until: "2030-01-01T00:00:00.000Z",
    ...extra,
  };
}
/** Borrador sin faltantes bloqueantes: el único que puede terminar en `ready`. */
function borradorCompleto(): DocumentDraft {
  const d = emptyDocumentDraft();
  d.supplier.company = "Fabrica Sintetica";
  d.supplier.wechat = "sintetico-cn";
  d.currency = "USD";
  d.products = [{ id: "p1", name: "Bolso", nameZh: "", code: "S1", brand: "", material: "", quantity: 100, unitPrice: 2, currency: "USD", unit: "pcs" }];
  d.groups = [{ id: "g1", label: "Cajas 1-10", cartons: 10, grossWeightKg: 50, cbm: 1.2, items: [{ productId: "p1", quantity: 100 }] }];
  return d;
}

// ── Supabase falso: aplica de verdad los filtros de cada consulta ──────────
// No alcanza con espiar llamadas: el fencing por `lease_token` sólo se puede
// demostrar si el UPDATE respeta su WHERE y toca 0 filas cuando no coincide.
type Fila = Record<string, unknown>;
type Filtro = [string, string, unknown];
type Llamada = { tabla: string; op: "select" | "update" | "delete"; payload?: Fila; filtros: Filtro[] };
type Respuesta = { data: unknown; error: unknown };
type Consulta = {
  select: (cols?: string) => Consulta; update: (payload: Fila) => Consulta; delete: () => Consulta;
  eq: (c: string, v: unknown) => Consulta; neq: (c: string, v: unknown) => Consulta;
  lt: (c: string, v: unknown) => Consulta; gte: (c: string, v: unknown) => Consulta; limit: (n: number) => Consulta;
  maybeSingle: () => Promise<Respuesta>;
  then: (ok: (r: Respuesta) => unknown, fail?: (e: unknown) => unknown) => Promise<unknown>;
};
type Opciones = {
  trabajos?: Fila[]; espacios?: Fila[]; archivos?: Record<string, Uint8Array>;
  cuotas?: Record<string, boolean>; reclamo?: Fila | null; colaCaida?: boolean;
  fallaBorrado?: boolean; errorEn?: (l: Llamada) => { code?: string; message: string } | null;
};

function crearDb(opciones: Opciones = {}) {
  const tablas: Record<string, Fila[]> = {
    document_import_jobs: opciones.trabajos ?? [],
    document_workspaces: opciones.espacios ?? [],
    document_import_limits: [],
  };
  const archivos = { ...(opciones.archivos ?? {}) };
  const llamadas: Llamada[] = [];
  const descargas: string[] = [];
  const borrados: string[][] = [];
  const cumple = (fila: Fila, filtros: Filtro[]) => filtros.every(([op, col, val]) => {
    const actual = fila[col];
    if (op === "eq") return actual === val;
    if (op === "neq") return actual !== val;
    if (op === "lt") return actual !== null && actual !== undefined && String(actual) < String(val);
    if (op === "gte") return Number(actual) >= Number(val);
    return true;
  });
  const ejecutar = async (llamada: Llamada, unico: boolean): Promise<Respuesta> => {
    llamadas.push(llamada);
    const forzado = opciones.errorEn?.(llamada);
    if (forzado) return { data: null, error: forzado };
    const filas = tablas[llamada.tabla] ?? [];
    const coinciden = filas.filter((f) => cumple(f, llamada.filtros));
    if (llamada.op === "update") {
      for (const fila of coinciden) Object.assign(fila, llamada.payload);
      return { data: unico ? (coinciden[0] ? { id: coinciden[0].id } : null) : null, error: null };
    }
    if (llamada.op === "delete") {
      for (const fila of coinciden) filas.splice(filas.indexOf(fila), 1);
      return { data: null, error: null };
    }
    if (!unico) return { data: coinciden.map((f) => ({ ...f })), error: null };
    if (coinciden.length > 1) return { data: null, error: { code: "PGRST116", message: "multiple rows" } };
    return { data: coinciden[0] ? { ...coinciden[0] } : null, error: null };
  };
  const from = (tabla: string): Consulta => {
    const llamada: Llamada = { tabla, op: "select", filtros: [] };
    const filtro = (op: string) => (col: string, val: unknown) => { llamada.filtros.push([op, col, val]); return consulta; };
    const consulta: Consulta = {
      select: () => consulta,
      update: (payload) => { llamada.op = "update"; llamada.payload = payload; return consulta; },
      delete: () => { llamada.op = "delete"; return consulta; },
      eq: filtro("eq"), neq: filtro("neq"), lt: filtro("lt"), gte: filtro("gte"), limit: () => consulta,
      maybeSingle: () => ejecutar(llamada, true),
      then: (ok, fail) => ejecutar(llamada, false).then(ok, fail),
    };
    return consulta;
  };
  const rpc = vi.fn(async (nombre: string, args: Record<string, unknown>) => {
    if (nombre === "claim_document_import_job") {
      if (opciones.colaCaida) return { data: null, error: { message: "queue down" } };
      return { data: opciones.reclamo ? [{ ...opciones.reclamo }] : [], error: null };
    }
    if (nombre === "reserve_document_import_limit") return { data: opciones.cuotas?.[String(args.p_scope)] ?? true, error: null };
    return { data: null, error: null };
  });
  const storage = {
    from: (bucket: string) => ({
      download: async (ruta: string) => {
        descargas.push(`${bucket}/${ruta}`);
        const bytes = archivos[ruta];
        if (!bytes) return { data: null, error: { message: "object_not_found" } };
        const copia = bytes.slice();
        return { data: { arrayBuffer: async () => copia.buffer }, error: null };
      },
      remove: async (rutas: string[]) => {
        borrados.push(rutas.map((r) => `${bucket}/${r}`));
        if (opciones.fallaBorrado) return { data: null, error: { message: "storage_unavailable" } };
        for (const r of rutas) delete archivos[r];
        return { data: rutas, error: null };
      },
    }),
  };
  const db = { from, rpc, storage } as unknown as SupabaseClient;
  const actualizaciones = () => llamadas.filter((l) => l.op === "update" && l.tabla === "document_import_jobs");
  return { db, tablas, archivos, llamadas, descargas, borrados, rpc, actualizaciones };
}

beforeEach(() => {
  extraccion.extractDocument.mockReset();
  extraccion.extractDocument.mockResolvedValue(emptyDocumentDraft());
  vi.stubEnv("DOCUMENT_IMPORT_DAILY_JOBS", "100");
  vi.stubEnv("DOCUMENT_IMPORT_DAILY_TOKEN_BUDGET", "2000000");
});
afterEach(() => vi.unstubAllEnvs());

describe("Barrera de archivo: lo que dice la carga contra lo que traen los bytes", () => {
  type Meta = Pick<ImportJob, "size_bytes" | "file_name" | "content_type">;
  const meta = (extra: Partial<Meta> = {}): Meta =>
    ({ size_bytes: PDF.byteLength, file_name: "proforma.pdf", content_type: "application/pdf", ...extra });
  /** Exige rechazo explícito: si `verifyFile` devuelve una huella, la prueba cae. */
  function rechaza(bytes: Uint8Array, job: Meta, status: number, code: string) {
    let fallo: unknown;
    try { const sha = verifyFile(bytes, job); throw new Error(`se aceptó el archivo y devolvió ${sha}`); }
    catch (e) { fallo = e; }
    expect(fallo).toMatchObject({ status, code });
  }

  it("rechaza una carga cuyo tamaño no es exactamente el declarado", () => {
    rechaza(PDF.subarray(0, PDF.byteLength - 1), meta(), 422, "size_mismatch");
    rechaza(new Uint8Array([...PDF, 0x20]), meta(), 422, "size_mismatch");
    rechaza(new Uint8Array(0), meta({ size_bytes: 0 }), 422, "size_mismatch");
    const gigante = new Uint8Array(MAX_IMPORT_BYTES + 1);
    gigante.set(new TextEncoder().encode("%PDF-1.7"));
    rechaza(gigante, meta({ size_bytes: gigante.byteLength }), 422, "size_mismatch");
  });

  it("rechaza un PDF que no empieza con la cabecera %PDF-", () => {
    // La cabecera desplazada tampoco vale: el lector nativo sí la toleraría.
    const desplazado = new TextEncoder().encode("basura%PDF-1.7 luego la cabecera");
    rechaza(desplazado, meta({ size_bytes: desplazado.byteLength }), 415, "signature_mismatch");
    const texto = new TextEncoder().encode("esto es texto plano, no un PDF");
    rechaza(texto, meta({ size_bytes: texto.byteLength }), 415, "signature_mismatch");
  });

  it("rechaza un XLSX sin la firma PK\\x03\\x04 del contenedor ZIP", () => {
    const xlsx = (bytes: Uint8Array) => ({ size_bytes: bytes.byteLength, file_name: "packing.xlsx", content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const vacio = new Uint8Array([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0]); // ZIP vacío: no es un libro
    rechaza(vacio, xlsx(vacio), 415, "signature_mismatch");
    rechaza(PDF, xlsx(PDF), 415, "signature_mismatch");
  });

  it("rechaza un CSV con bytes nulos o que no es UTF-8 válido", () => {
    const csv = (bytes: Uint8Array) => ({ size_bytes: bytes.byteLength, file_name: "lista.csv", content_type: "text/csv" });
    const conNulo = new Uint8Array([...CSV, 0x00, 0x41]);
    rechaza(conNulo, csv(conNulo), 415, "invalid_csv");
    const latin1 = new Uint8Array([0x42, 0x6f, 0x6c, 0x73, 0xf3, 0x6e]); // "Bolsón" en latin-1
    rechaza(latin1, csv(latin1), 415, "invalid_csv");
    const truncado = new Uint8Array([0xe2, 0x82]); // secuencia UTF-8 cortada
    rechaza(truncado, csv(truncado), 415, "invalid_csv");
  });

  it("rechaza el contenido que no corresponde a la extensión, aunque sea un formato soportado", () => {
    // El ataque real: subir un XLSX llamándolo .pdf para que lo lea otro motor.
    rechaza(XLSX, meta({ size_bytes: XLSX.byteLength }), 415, "signature_mismatch");
    rechaza(PDF, { size_bytes: PDF.byteLength, file_name: "x.xlsx", content_type: "text/csv" }, 415, "signature_mismatch");
    // El CSV no tiene firma que comparar: lo que corta el binario es exigir
    // texto UTF-8 sin bytes nulos, que ningún XLSX ni PDF real cumple.
    rechaza(XLSX, { size_bytes: XLSX.byteLength, file_name: "x.csv", content_type: "text/csv" }, 415, "invalid_csv");
    const pdfReal = new Uint8Array([...PDF, 0x00, 0x0a]);
    rechaza(pdfReal, { size_bytes: pdfReal.byteLength, file_name: "x.csv", content_type: "text/csv" }, 415, "invalid_csv");
    // Y el content_type declarado por el navegador nunca habilita nada: manda
    // la extensión del nombre guardado y, sobre ella, el contenido.
    rechaza(XLSX, { size_bytes: XLSX.byteLength, file_name: "x.pdf", content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, 415, "signature_mismatch");
  });

  it("devuelve la huella exacta del contenido y cambia con un solo byte distinto", () => {
    expect(verifyFile(PDF, meta())).toBe(huella(PDF));
    const alterado = new Uint8Array(PDF);
    alterado[alterado.byteLength - 1] = 0x21;
    expect(verifyFile(alterado, meta())).not.toBe(huella(PDF));
    expect(verifyFile(CSV, { size_bytes: CSV.byteLength, file_name: "lista.csv", content_type: "text/csv" })).toBe(huella(CSV));
  });
});

describe("Cierre de carga: una huella, un trabajo, un cobro", () => {
  const cargando = (extra: Fila = {}) => trabajo({ status: "uploading", sha256: null, ...extra });

  it("no crea un segundo trabajo cuando el mismo contenido ya fue cargado", async () => {
    const previo = trabajo({ id: "job-1", status: "ready", storage_path: "tenant-1/ws-1/job-1.pdf" });
    const nuevo = cargando({ id: "job-2", storage_path: "tenant-1/ws-1/job-2.pdf" });
    const f = crearDb({ trabajos: [previo, nuevo], archivos: { "tenant-1/ws-1/job-2.pdf": PDF } });
    const r = await finishUpload(f.db, ws, "job-2");
    expect(r).toMatchObject({ jobId: "job-1", status: "ready", duplicate: true });
    expect(nuevo.status).toBe("cancelled");
    expect(nuevo.error_code).toBe("duplicate");
    expect(nuevo.sha256).toBeNull(); // nunca se registra como carga válida
    expect(previo.status).toBe("ready"); // el trabajo original no se toca
    expect(f.borrados).toEqual([[`${IMPORT_BUCKET}/tenant-1/ws-1/job-2.pdf`]]);
  });

  it("no deduplica contra el documento de otro espacio de trabajo", async () => {
    // Si la búsqueda por huella no estuviera acotada al espacio, este cliente
    // recibiría el id del trabajo de otro: fuga de información entre clientes.
    const ajeno = trabajo({ id: "job-ajeno", workspace_id: "ws-2", status: "ready", storage_path: "tenant-9/ws-2/job-ajeno.pdf" });
    const propio = cargando({ id: "job-2", storage_path: "tenant-1/ws-1/job-2.pdf" });
    const f = crearDb({ trabajos: [ajeno, propio], archivos: { "tenant-1/ws-1/job-2.pdf": PDF } });
    const r = await finishUpload(f.db, ws, "job-2");
    expect(r).toEqual({ jobId: "job-2", status: "queued" });
    expect(propio.sha256).toBe(huella(PDF));
    expect(ajeno.status).toBe("ready");
    expect(f.borrados).toEqual([]);
  });

  it("marca fallida la carga y borra el objeto cuando el contenido no supera la verificación", async () => {
    const job = cargando({ file_name: "proforma.pdf", size_bytes: XLSX.byteLength });
    const f = crearDb({ trabajos: [job], archivos: { [RUTA]: XLSX } });
    await expect(finishUpload(f.db, ws, "job-1")).rejects.toMatchObject({ status: 415, code: "signature_mismatch" });
    expect(job.status).toBe("failed");
    expect(job.error_code).toBe("signature_mismatch");
    expect(job.sha256).toBeNull();
    expect(f.borrados).toEqual([[`${IMPORT_BUCKET}/${RUTA}`]]);
  });

  it("niega el cierre de carga cuando el objeto no llegó al almacenamiento", async () => {
    const job = cargando();
    const f = crearDb({ trabajos: [job], archivos: {} });
    await expect(finishUpload(f.db, ws, "job-1")).rejects.toMatchObject({ status: 422, code: "upload_incomplete" });
    expect(job.status).toBe("uploading");
    expect(job.sha256).toBeNull();
  });

  it("no vuelve a encolar un trabajo que ya salió del estado de carga", async () => {
    // Reintentar «uploaded» sobre un trabajo listo pagaría la IA dos veces.
    const job = trabajo({ status: "ready" });
    const f = crearDb({ trabajos: [job], archivos: { [RUTA]: PDF } });
    expect(await finishUpload(f.db, ws, "job-1")).toEqual({ jobId: "job-1", status: "ready" });
    expect(f.descargas).toEqual([]);
    expect(f.actualizaciones()).toEqual([]);
  });

  it("no expone trabajos de otro espacio de trabajo aunque se conozca el id", async () => {
    const ajeno = trabajo({ id: "job-1", workspace_id: "ws-2" });
    const f = crearDb({ trabajos: [ajeno] });
    await expect(finishUpload(f.db, ws, "job-1")).rejects.toMatchObject({ status: 404, code: "not_found" });
    expect(f.descargas).toEqual([]);
  });

  it("un archivo cuya lectura falló se puede reintentar: el intento muerto le deja su lugar", async () => {
    // Quien deja sin salida al cliente es el índice único (workspace_id,sha256) sobre las
    // filas NO canceladas: mientras el intento fallido conserve la huella, ninguna carga del
    // mismo archivo puede sellarla. Acá el doble lo aplica de verdad, porque con sólo sacar
    // los `failed` del SELECT el UPDATE choca contra el índice y esto queda rojo.
    const fallido = trabajo({ id: "job-1", status: "failed", error_code: "extraction_failed", storage_path: "tenant-1/ws-1/job-1.pdf" });
    const reintento = cargando({ id: "job-2", storage_path: "tenant-1/ws-1/job-2.pdf" });
    const f = crearDb({
      trabajos: [fallido, reintento],
      archivos: { "tenant-1/ws-1/job-1.pdf": PDF, "tenant-1/ws-1/job-2.pdf": PDF },
      errorEn: (l) => (l.op === "update" && l.payload?.sha256 != null && fallido.status !== "cancelled"
        ? { code: "23505", message: "document_import_content_idx" } : null),
    });
    expect(await finishUpload(f.db, ws, "job-2")).toEqual({ jobId: "job-2", status: "queued" });
    expect(reintento.sha256).toBe(huella(PDF));
    expect(reintento.status).toBe("queued");
    expect(fallido.status).toBe("cancelled");
    expect(fallido.error_code).toBe("extraction_failed"); // por qué falló sigue siendo legible
    // Y su copia privada no se queda en el almacenamiento ocupando lugar.
    expect(f.borrados).toEqual([[`${IMPORT_BUCKET}/tenant-1/ws-1/job-1.pdf`]]);
    expect(f.archivos["tenant-1/ws-1/job-1.pdf"]).toBeUndefined();
  });

  it.each([["queued"], ["processing"], ["ready"], ["partial"]])(
    "un trabajo %s con la misma huella sigue bloqueando: el contenido no se lee ni se cobra dos veces", async (status) => {
      // El reintento es sólo para el callejón sin salida. Un trabajo vivo —en cola, leyéndose
      // o ya leído— sigue mandando: abrirle paso a una carga igual pagaría la IA dos veces.
      const vivo = trabajo({ id: "job-1", status, storage_path: "tenant-1/ws-1/job-1.pdf" });
      const nuevo = cargando({ id: "job-2", storage_path: "tenant-1/ws-1/job-2.pdf" });
      const f = crearDb({ trabajos: [vivo, nuevo], archivos: { "tenant-1/ws-1/job-2.pdf": PDF } });
      expect(await finishUpload(f.db, ws, "job-2")).toEqual({ jobId: "job-1", status, duplicate: true });
      expect(vivo.status).toBe(status);
      expect(nuevo.status).toBe("cancelled");
      expect(nuevo.sha256).toBeNull();
      expect(f.borrados).toEqual([[`${IMPORT_BUCKET}/tenant-1/ws-1/job-2.pdf`]]);
    });
});

describe("Lectura asistida: el arriendo manda sobre el resultado", () => {
  const vigente = () => trabajo({ status: "processing", lease_token: "arriendo-vigente", result: { marcador: "worker-vigente" }, attempts: 1 });
  const entorno = (reclamo: Fila, guardado: Fila, extra: Opciones = {}) =>
    crearDb({ trabajos: [guardado], espacios: [espacioAbierto], archivos: { [RUTA]: PDF }, reclamo, ...extra });

  it("guarda la lectura cuando el arriendo del worker sigue vigente", async () => {
    const guardado = vigente();
    const borrador = borradorCompleto();
    extraccion.extractDocument.mockResolvedValue(borrador);
    const f = entorno({ ...guardado, lease_token: "arriendo-vigente" }, guardado);
    expect(await processImportJob(f.db, "job-1")).toEqual({ processed: true, status: "ready" });
    expect(guardado.result).toEqual(borrador);
    expect(guardado.status).toBe("ready");
    expect(guardado.lease_until).toBeNull();
  });

  it("no deja que un worker con arriendo vencido pise el resultado del worker vigente", async () => {
    // El worker lento terminó su extracción DESPUÉS de que la cola reasignó el
    // trabajo: su UPDATE no toca ninguna fila y no puede reportar que procesó.
    const guardado = vigente();
    extraccion.extractDocument.mockResolvedValue(borradorCompleto());
    const f = entorno({ ...guardado, lease_token: "arriendo-vencido", attempts: 2 }, guardado);
    expect(await processImportJob(f.db, "job-1")).toEqual({ processed: false, status: "ready" });
    expect(guardado.result).toEqual({ marcador: "worker-vigente" });
    expect(guardado.status).toBe("processing");
    expect(guardado.lease_token).toBe("arriendo-vigente");
    expect(guardado.lease_until).toBe("2030-01-01T00:00:00.000Z");
  });

  it("tampoco deja que un worker con arriendo vencido marque fallido el trabajo ajeno", async () => {
    const guardado = vigente();
    extraccion.extractDocument.mockRejectedValue(Object.assign(new Error("timeout"), { code: "extraction_failed", retryable: true }));
    const f = entorno({ ...guardado, lease_token: "arriendo-vencido", attempts: 3 }, guardado);
    await processImportJob(f.db, "job-1");
    expect(guardado.status).toBe("processing");
    expect(guardado.error_code).toBeNull();
    expect(guardado.result).toEqual({ marcador: "worker-vigente" });
  });

  it("niega la lectura cuando la cola no responde, en vez de leer a ciegas", async () => {
    const f = crearDb({ colaCaida: true });
    await expect(processImportJob(f.db)).rejects.toMatchObject({ status: 503, code: "queue_unavailable" });
    expect(extraccion.extractDocument).not.toHaveBeenCalled();
  });

  it("no hace nada cuando la cola no entrega ningún trabajo", async () => {
    const f = crearDb({ reclamo: null });
    expect(await processImportJob(f.db)).toEqual({ processed: false });
    expect(extraccion.extractDocument).not.toHaveBeenCalled();
    expect(f.rpc).toHaveBeenCalledTimes(1);
  });
});

describe("Cuota y presupuesto antes de la IA", () => {
  const entorno = (extra: Opciones = {}) => {
    const guardado = trabajo({ status: "processing", lease_token: "arriendo-vigente" });
    const f = crearDb({ trabajos: [guardado], espacios: [espacioAbierto], archivos: { [RUTA]: PDF }, reclamo: { ...guardado }, ...extra });
    return { ...f, guardado };
  };

  it("no llama a la IA ni descarga el archivo cuando la cuota diaria está agotada", async () => {
    const f = entorno({ cuotas: { "processing-global": false } });
    expect(await processImportJob(f.db, "job-1")).toMatchObject({ status: "queued", code: "quota_exceeded" });
    expect(extraccion.extractDocument).not.toHaveBeenCalled();
    expect(f.descargas).toEqual([]);
    expect(f.guardado.error_code).toBe("quota_exceeded");
    // Agotada la cuota general, ni siquiera se reserva presupuesto de tokens.
    expect(f.rpc.mock.calls.filter(([n, a]) => n === "reserve_document_import_limit" && a.p_scope === "ai-token-budget")).toEqual([]);
  });

  it("reserva el peor caso de tokens antes de contactar a la IA y se niega si no alcanza", async () => {
    const f = entorno({ cuotas: { "ai-token-budget": false } });
    expect(await processImportJob(f.db, "job-1")).toMatchObject({ code: "quota_exceeded" });
    expect(extraccion.extractDocument).not.toHaveBeenCalled();
    expect(f.descargas).toEqual([]);
    const reserva = f.rpc.mock.calls.find(([n, a]) => n === "reserve_document_import_limit" && a.p_scope === "ai-token-budget");
    expect(reserva?.[1]).toMatchObject({ p_units: 200000, p_limit: 2000000 });
  });

  it("niega la lectura si la capacidad de lectura no está configurada", async () => {
    for (const valor of ["", "0", "abc", "-5", "1.5"]) {
      extraccion.extractDocument.mockClear();
      vi.stubEnv("DOCUMENT_IMPORT_DAILY_TOKEN_BUDGET", valor);
      const f = entorno();
      expect(await processImportJob(f.db, "job-1")).toMatchObject({ code: "budget_not_configured" });
      expect(extraccion.extractDocument).not.toHaveBeenCalled();
      expect(f.descargas).toEqual([]);
    }
  });

  it("no reserva presupuesto ni lee documentos de un espacio caducado o ilegible", async () => {
    const caducado = entorno({ espacios: [{ id: "ws-1", expires_at: "2020-01-01T00:00:00.000Z" }] });
    expect(await processImportJob(caducado.db, "job-1")).toMatchObject({ status: "failed", code: "expired" });
    expect(extraccion.extractDocument).not.toHaveBeenCalled();
    expect(caducado.rpc.mock.calls.filter(([n]) => n === "reserve_document_import_limit")).toEqual([]);

    const ilegible = entorno({ errorEn: (l) => (l.tabla === "document_workspaces" ? { message: "rls" } : null) });
    expect(await processImportJob(ilegible.db, "job-1")).toMatchObject({ status: "failed", code: "expired" });
    expect(extraccion.extractDocument).not.toHaveBeenCalled();
  });

  it("no convierte en permiso un error al leer el espacio, ni cuando la respuesta trae una fila", async () => {
    // Fail-closed de verdad: si la consulta del espacio falla (RLS, timeout), la
    // lectura se niega aunque la respuesta venga acompañada de datos. Sin esto,
    // quitar la comprobación del error pasa desapercibido y se procesa —y se
    // cobra— un documento de un espacio que nunca se pudo validar.
    const base = entorno();
    const original = (base.db as unknown as { from: (t: string) => unknown }).from;
    const db = {
      ...(base.db as unknown as Record<string, unknown>),
      from: (tabla: string): unknown =>
        tabla === "document_workspaces"
          ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "ws-1", expires_at: null }, error: { message: "permission denied" } }) }) }) }
          : original(tabla),
    } as unknown as SupabaseClient;
    expect(await processImportJob(db, "job-1")).toMatchObject({ status: "failed", code: "expired" });
    expect(extraccion.extractDocument).not.toHaveBeenCalled();
    expect(base.rpc.mock.calls.filter(([n]) => n === "reserve_document_import_limit")).toEqual([]);
  });

  it("limita los reintentos: el último intento transitorio termina en fallo, no en cola", async () => {
    extraccion.extractDocument.mockRejectedValue(Object.assign(new Error("502"), { code: "provider_down", status: 502 }));
    const primero = entorno();
    expect(await processImportJob(primero.db, "job-1")).toMatchObject({ status: "queued", code: "provider_down" });

    const guardado = trabajo({ status: "processing", lease_token: "arriendo-vigente", attempts: 3 });
    const ultimo = crearDb({ trabajos: [guardado], espacios: [espacioAbierto], archivos: { [RUTA]: PDF }, reclamo: { ...guardado } });
    expect(await processImportJob(ultimo.db, "job-1")).toMatchObject({ status: "failed", code: "provider_down" });
    expect(guardado.status).toBe("failed");
  });

  it("espacia el reintento según los intentos ya gastados, en vez de reencolar para ya mismo", async () => {
    // Un fallo transitorio que vuelve a estar disponible en el mismo instante
    // arma un bucle: cada vuelta reserva 200k tokens del presupuesto diario.
    extraccion.extractDocument.mockRejectedValue(Object.assign(new Error("502"), { code: "provider_down", status: 502 }));
    const espera = async (attempts: number) => {
      const fila = trabajo({ status: "processing", lease_token: "arriendo-vigente", attempts });
      const f = crearDb({ trabajos: [fila], espacios: [espacioAbierto], archivos: { [RUTA]: PDF }, reclamo: { ...fila } });
      const antes = Date.now();
      expect(await processImportJob(f.db, "job-1")).toMatchObject({ status: "queued", code: "provider_down" });
      return Date.parse(String(fila.available_at)) - antes;
    };
    const primera = await espera(1);
    expect(primera).toBeGreaterThanOrEqual(60000);
    expect(await espera(2)).toBeGreaterThanOrEqual(primera + 55000);
  });

  it("no reintenta un error permanente del documento", async () => {
    extraccion.extractDocument.mockRejectedValue(Object.assign(new Error("pdf roto"), { code: "invalid_pdf", retryable: false }));
    const f = entorno();
    expect(await processImportJob(f.db, "job-1")).toMatchObject({ status: "failed", code: "invalid_pdf" });
    expect(f.guardado.status).toBe("failed");
  });
});

describe("Nunca inventar datos ni filtrar texto del documento", () => {
  const entorno = (extra: Opciones = {}, job: Fila = {}) => {
    const guardado = trabajo({ status: "processing", lease_token: "arriendo-vigente", ...job });
    const f = crearDb({ trabajos: [guardado], espacios: [espacioAbierto], archivos: { [RUTA]: PDF }, reclamo: { ...guardado }, ...extra });
    return { ...f, guardado };
  };

  it("no lee un documento cuyo contenido cambió después de la carga", async () => {
    const otro = new TextEncoder().encode("%PDF-1.7\nOtro contenido sustituido\n%%EOF");
    const f = entorno({ archivos: { [RUTA]: otro } }, { size_bytes: otro.byteLength });
    expect(await processImportJob(f.db, "job-1")).toMatchObject({ status: "failed", code: "content_changed" });
    expect(extraccion.extractDocument).not.toHaveBeenCalled();
    expect(f.guardado.result).toBeNull();
  });

  it("no procesa un trabajo sin huella registrada", async () => {
    const f = entorno({}, { sha256: null });
    expect(await processImportJob(f.db, "job-1")).toMatchObject({ status: "failed", code: "content_changed" });
    expect(extraccion.extractDocument).not.toHaveBeenCalled();
  });

  it("niega la lectura cuando el almacenamiento no entrega el archivo", async () => {
    const f = entorno({ archivos: {} });
    expect(await processImportJob(f.db, "job-1")).toMatchObject({ code: "storage_unavailable" });
    expect(extraccion.extractDocument).not.toHaveBeenCalled();
  });

  it("marca partial, nunca ready, cuando el documento deja faltantes bloqueantes", async () => {
    const incompleto = emptyDocumentDraft();
    incompleto.products = [{ id: "p1", name: "Bolso", nameZh: "", code: "", brand: "", material: "", quantity: null, unitPrice: null, currency: null, unit: "pcs" }];
    extraccion.extractDocument.mockResolvedValue(incompleto);
    const f = entorno();
    expect(await processImportJob(f.db, "job-1")).toEqual({ processed: true, status: "partial" });
    expect(f.guardado.status).toBe("partial");
    expect(f.guardado.result).toEqual(incompleto); // se guarda lo leído, sin rellenar huecos
  });

  it("guarda sólo códigos saneados: ni el texto del documento ni el mensaje del proveedor", async () => {
    const secreto = "Proforma ACME 12345 · total 9999 USD · sk-ant-api03-secreto";
    extraccion.extractDocument.mockRejectedValue(Object.assign(new Error(secreto), { code: `Detalle: ${secreto}` }));
    const f = entorno();
    const r = await processImportJob(f.db, "job-1");
    expect(r).toMatchObject({ code: "extraction_failed" });
    expect(f.guardado.error_code).toBe("extraction_failed");
    const persistido = JSON.stringify(f.actualizaciones().map((l) => l.payload));
    expect(persistido).not.toContain("ACME");
    expect(persistido).not.toContain("sk-ant");
    expect(persistido).not.toContain("9999");
  });

  it("rechaza códigos con mayúsculas, dígitos o separadores que no son códigos internos", async () => {
    for (const codigo of ["Extraction_Failed", "error 42", "a".repeat(61), "ruta/documento", "", "codigo-con-guion"]) {
      extraccion.extractDocument.mockRejectedValue(Object.assign(new Error("x"), { code: codigo }));
      const f = entorno();
      expect(await processImportJob(f.db, "job-1")).toMatchObject({ code: "extraction_failed" });
    }
    extraccion.extractDocument.mockRejectedValue(Object.assign(new Error("x"), { code: "extraction_incomplete" }));
    const valido = entorno();
    expect(await processImportJob(valido.db, "job-1")).toMatchObject({ code: "extraction_incomplete" });
  });
});

describe("Limpieza: los archivos privados salen antes que su espacio", () => {
  const caducado = { id: "ws-1", expires_at: "2020-01-01T00:00:00.000Z" };

  it("no borra el espacio caducado mientras sus archivos sigan en almacenamiento", async () => {
    const f = crearDb({ espacios: [caducado], trabajos: [trabajo()], fallaBorrado: true });
    expect(await cleanupImports(f.db)).toEqual({ removed: 0 });
    expect(f.tablas.document_workspaces).toHaveLength(1);
    expect(f.borrados).toEqual([[`${IMPORT_BUCKET}/${RUTA}`]]);
  });

  it("borra el espacio caducado sólo después de sacar sus archivos", async () => {
    const f = crearDb({ espacios: [caducado], trabajos: [trabajo()], archivos: { [RUTA]: PDF } });
    expect(await cleanupImports(f.db)).toEqual({ removed: 1 });
    expect(f.tablas.document_workspaces).toHaveLength(0);
    expect(f.archivos[RUTA]).toBeUndefined();
    const borradoEspacio = f.llamadas.findIndex((l) => l.tabla === "document_workspaces" && l.op === "delete");
    expect(borradoEspacio).toBeGreaterThan(-1);
    expect(f.borrados).toHaveLength(1);
  });

  it("conserva el espacio si no puede listar sus trabajos", async () => {
    const f = crearDb({
      espacios: [caducado], trabajos: [trabajo()],
      errorEn: (l) => (l.tabla === "document_import_jobs" && l.op === "select" ? { message: "rls" } : null),
    });
    expect(await cleanupImports(f.db)).toEqual({ removed: 0 });
    expect(f.tablas.document_workspaces).toHaveLength(1);
    expect(f.borrados).toEqual([]);
  });

  it("no toca espacios vigentes", async () => {
    const f = crearDb({ espacios: [{ id: "ws-2", expires_at: "2999-01-01T00:00:00.000Z" }, { id: "ws-3", expires_at: null }], trabajos: [] });
    expect(await cleanupImports(f.db)).toEqual({ removed: 0 });
    expect(f.tablas.document_workspaces).toHaveLength(2);
  });
});
