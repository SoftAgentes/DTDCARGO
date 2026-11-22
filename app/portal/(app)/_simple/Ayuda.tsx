import type { ReactNode } from "react";
import { StatusIcon } from "@/components/StatusIcon";
import { entradaGlosario } from "@/lib/portal/simple/contenido/glosario";

/**
 * SDD-0654 fase 2 · Ayudas de la Vista simple (§6): tres tipos fijos, con icono
 * y texto visible, nunca tooltip. Usan la franja plana del portal
 * (`.portal-aviso`, BD-037), sin colores nuevos:
 *   · Consejo: un atajo o una recomendación (franja neutra).
 *   · Recuerda: algo que conviene no olvidar (tinte de tinta, `--tint-ink`).
 *   · Atención: un riesgo real (franja de atención, el único dorado).
 */
export type TipoAyuda = "consejo" | "recuerda" | "atencion";

const ETIQUETA: Record<TipoAyuda, string> = {
  consejo: "Consejo",
  recuerda: "Recuerda",
  atencion: "Atención",
};

export function Ayuda({ tipo, children }: { tipo: TipoAyuda; children: ReactNode }) {
  return (
    <div
      className={`portal-aviso rounded-[12px] px-4 py-3 ${tipo === "recuerda" ? "vs-recuerda" : ""}`}
      data-tono={tipo === "atencion" ? "atencion" : "info"}
    >
      <span className="portal-aviso-icono">
        <StatusIcon tone={tipo === "atencion" ? "warning" : "info"} size={16} />
      </span>
      <div className="portal-aviso-cuerpo text-[15px] leading-[1.55]">
        <b className="font-extrabold">{ETIQUETA[tipo]}.</b> {children}
      </div>
    </div>
  );
}

/** Una palabra del glosario, desplegable (§6, «Glosario en línea»). */
export function Glosario({ id }: { id: string }) {
  const entrada = entradaGlosario(id);
  if (!entrada) return null;
  return (
    <details className="vs-glosario rounded-[12px] px-4 py-2">
      <summary className="flex min-h-[44px] cursor-pointer items-center text-[15px] font-bold text-ink underline underline-offset-2">
        ¿Qué es {entrada.termino.toLowerCase().startsWith("m³") ? "un m³" : `«${entrada.termino}»`}?
      </summary>
      <p className="pb-2 text-[15px] leading-[1.55]">{entrada.explicacion}</p>
    </details>
  );
}
