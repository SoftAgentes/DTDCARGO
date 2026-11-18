/**
 * Tope de tamaño del cuerpo del webhook de Chatwoot (SDD-0585, 2.3, v3).
 *
 * Se aplica ANTES de calcular la firma: un cuerpo enorme no llega a hashearse
 * ni a registrarse. Dos defensas, porque Content-Length puede faltar o mentir:
 *   1. `Content-Length` mayor que el tope → se rechaza sin leer nada;
 *   2. lectura del flujo con cuenta de bytes: al pasar el tope se cancela y no
 *      se pide el resto.
 *
 * El payload de un `message_created` de Chatwoot 4.19.1 pesa unos pocos KB (los
 * adjuntos van por URL, no en el cuerpo); 256 KiB deja margen de sobra.
 */

export const LIMITE_CUERPO_BYTES = 256 * 1024;

export type CuerpoLeido = { ok: true; texto: string } | { ok: false };

export async function leerCuerpoAcotado(req: Request, limite = LIMITE_CUERPO_BYTES): Promise<CuerpoLeido> {
  const declarado = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declarado) && declarado > limite) return { ok: false };
  if (!req.body) return { ok: true, texto: "" };

  const lector = req.body.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) {
      await lector.cancel().catch(() => undefined);
      return { ok: false };
    }
    trozos.push(value);
  }
  const junto = new Uint8Array(total);
  let pos = 0;
  for (const t of trozos) {
    junto.set(t, pos);
    pos += t.byteLength;
  }
  return { ok: true, texto: new TextDecoder().decode(junto) };
}
