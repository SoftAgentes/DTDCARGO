// SDD-0713: el límite financiero cubre las 20 líneas y sus escapes JSON.
export const MAX_CUERPO_FACTURACION = 24 * 1024;
export const MAX_CUERPO_ACCESO = 2048;

export async function leerCuerpoFinanciero(req: Request): Promise<
  { ok: true; body: Record<string, unknown> } | { ok: false; status: 400 | 413 }
> {
  const longitud = Number(req.headers.get("content-length"));
  if (Number.isFinite(longitud) && longitud > MAX_CUERPO_FACTURACION) return { ok: false, status: 413 };
  const lector = req.body?.getReader();
  if (!lector) return { ok: false, status: 400 };
  const partes: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const parte = await lector.read();
      if (parte.done) break;
      bytes += parte.value.byteLength;
      if (bytes > MAX_CUERPO_FACTURACION) {
        await lector.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      partes.push(parte.value);
    }
    const cuerpo = new Uint8Array(bytes);
    let inicio = 0;
    for (const parte of partes) { cuerpo.set(parte, inicio); inicio += parte.byteLength; }
    return { ok: true, body: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(cuerpo)) };
  } catch { return { ok: false, status: 400 }; }
  finally { lector.releaseLock(); }
}
