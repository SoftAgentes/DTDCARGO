/**
 * SDD-0654 fase 2 · Motor de la guía del portal (§6.2).
 *
 * Se midió el de la SDD-0589 (`lib/studio/guia/**`): su parte de pasos es
 * genérica, pero el componente que la pinta está atado al i18n, a los roles y a
 * las rutas del Studio, y declara a propósito que no atrapa el foco. El AC-15
 * pide lo contrario (los diálogos contienen el foco). Extraerlo costaba más que
 * escribir este motor chico, así que el Studio no se toca.
 *
 * Lógica pura, sin DOM: `existe(ancla)` la inyecta quien pinta. Un paso cuya
 * ancla no está en la pantalla se salta (por ejemplo, el botón de tema cuando no
 * se muestra).
 */
import type { PasoGuia, Recorrido } from "./contenido/guia";

export type FaseGuia =
  | { tipo: "paso"; lista: "pasos" | "extra"; i: number }
  | { tipo: "continuar" }
  | { tipo: "fin" };

type Existe = (ancla: string) => boolean;

function presente(paso: PasoGuia, existe: Existe): boolean {
  return paso.ancla === null || existe(paso.ancla);
}

function buscar(
  rec: Recorrido,
  lista: "pasos" | "extra",
  desde: number,
  existe: Existe,
): FaseGuia | null {
  const pasos = (lista === "pasos" ? rec.pasos : rec.extra) ?? [];
  for (let i = desde; i < pasos.length; i++) {
    if (presente(pasos[i], existe)) return { tipo: "paso", lista, i };
  }
  return null;
}

/** Después de los pasos: la pregunta, si hay extras que mostrar; si no, fin. */
function trasPasos(rec: Recorrido, existe: Existe): FaseGuia {
  if (rec.continuar && buscar(rec, "extra", 0, existe)) return { tipo: "continuar" };
  return { tipo: "fin" };
}

export function primeraFase(rec: Recorrido, existe: Existe): FaseGuia {
  return buscar(rec, "pasos", 0, existe) ?? trasPasos(rec, existe);
}

/**
 * La fase que sigue. En «continuar», `aceptaExtra` decide: sí → los extras;
 * no → fin.
 */
export function siguienteFase(
  rec: Recorrido,
  fase: FaseGuia,
  existe: Existe,
  aceptaExtra = false,
): FaseGuia {
  if (fase.tipo === "fin") return fase;
  if (fase.tipo === "continuar") {
    return aceptaExtra ? (buscar(rec, "extra", 0, existe) ?? { tipo: "fin" }) : { tipo: "fin" };
  }
  const sig = buscar(rec, fase.lista, fase.i + 1, existe);
  if (sig) return sig;
  return fase.lista === "pasos" ? trasPasos(rec, existe) : { tipo: "fin" };
}

export function pasoDe(rec: Recorrido, fase: FaseGuia): PasoGuia | null {
  if (fase.tipo !== "paso") return null;
  const pasos = (fase.lista === "pasos" ? rec.pasos : rec.extra) ?? [];
  return pasos[fase.i] ?? null;
}
