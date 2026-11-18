/**
 * SDD-0626 Anexo A · La salida de `soporte-chatwoot`: SOLO un objeto JSON con una de dos formas.
 *
 *   {"respuesta": {"acuse": "...", "texto": "...", "guion": "<id>"}}
 *   {"escalado": {"motivo": "...", "prioridad": 3 | 2 | 1}}
 *
 * Estricto a propósito: texto antes o después, bloque de código, claves de más o tipos raros = inválido. El
 * despachador reintenta una vez y, si sigue mal, escala (`json_invalido`).
 */
export type SalidaAgente =
  | { tipo: "respuesta"; acuse: string; texto: string; guion: string }
  | { tipo: "escalado"; motivo: string; prioridad: 1 | 2 | 3 };

export type Interpretacion = { ok: true; salida: SalidaAgente } | { ok: false; codigo: string };

const GUION_ID = /^[a-z0-9][a-z0-9_.-]{0,63}$/;

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function texto(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max ? v.trim() : null;
}

export function interpretarSalida(contenido: string | null | undefined): Interpretacion {
  if (typeof contenido !== "string" || !contenido.trim()) return { ok: false, codigo: "vacia" };
  let valor: unknown;
  try {
    valor = JSON.parse(contenido.trim());
  } catch {
    return { ok: false, codigo: "no_es_json" };
  }
  const raiz = obj(valor);
  if (!raiz) return { ok: false, codigo: "no_es_objeto" };
  const claves = Object.keys(raiz);
  if (claves.length !== 1) return { ok: false, codigo: "forma" };

  if (claves[0] === "respuesta") {
    const r = obj(raiz.respuesta);
    if (!r || Object.keys(r).some((k) => !["acuse", "texto", "guion"].includes(k))) return { ok: false, codigo: "forma" };
    const acuse = texto(r.acuse, 300);
    const cuerpo = texto(r.texto, 4000);
    const guion = typeof r.guion === "string" && GUION_ID.test(r.guion) ? r.guion : null;
    if (!acuse || !cuerpo || !guion) return { ok: false, codigo: "respuesta_incompleta" };
    return { ok: true, salida: { tipo: "respuesta", acuse, texto: cuerpo, guion } };
  }
  if (claves[0] === "escalado") {
    const e = obj(raiz.escalado);
    if (!e || Object.keys(e).some((k) => !["motivo", "prioridad"].includes(k))) return { ok: false, codigo: "forma" };
    const motivo = texto(e.motivo, 500);
    const prioridad = e.prioridad === 1 || e.prioridad === 2 || e.prioridad === 3 ? e.prioridad : null;
    if (!motivo || prioridad === null) return { ok: false, codigo: "escalado_incompleto" };
    return { ok: true, salida: { tipo: "escalado", motivo, prioridad } };
  }
  return { ok: false, codigo: "forma" };
}
