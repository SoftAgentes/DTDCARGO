"use client";

/**
 * SDD-0530 · «Marcar zarpado» / «Marcar arribado» con sus envíos.
 *
 * Abrir el diálogo no cambia nada (BTN-01). El diálogo nombra el contenedor, la
 * cantidad de envíos y la consecuencia —sus envíos avanzan y a sus clientes les
 * sale el aviso— antes de confirmar (MP-01 R2: el estado de cada envío se puede
 * corregir en Tracking, pero el correo ya salió). Mientras corre, el diálogo
 * queda abierto y bloquea un segundo envío; si falla, el error se queda en el
 * diálogo y se puede reintentar sin riesgo: si el contenedor ya cambió, el
 * servidor no repite nada.
 *
 * El resumen lo guarda el padre (`onResumen`): este botón desaparece apenas el
 * contenedor cambia de estado, y el resumen tiene que seguir a la vista.
 */

import { useState } from "react";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  lineaResumenAvance,
  type AvanceContenedor,
  type ResumenAvanceContenedor,
} from "@/lib/studio/naviera/avance-por-contenedor";

export type ResultadoAccionAvance = {
  ok?: boolean;
  error?: string;
  avance?: ResumenAvanceContenedor;
};

export function mensajeConfirmacionAvance(
  to: AvanceContenedor,
  consolidationRef: string,
  totalEnvios: number,
): string {
  if (totalEnvios === 0) {
    return `${consolidationRef} no tiene envíos asignados: sólo cambia el estado del contenedor.`;
  }
  const uno = totalEnvios === 1;
  const sujeto = uno
    ? `El envío de ${consolidationRef} pasa`
    : `Los ${totalEnvios} envíos de ${consolidationRef} pasan`;
  const clientes = uno ? "A su cliente le sale" : "A sus clientes les sale";
  const noSeTocan =
    "No se tocan los entregados, los cancelados, los que están en excepción ni los que ya van más adelante. Cada cambio queda en el historial del envío.";
  if (to === "zarpado") {
    return `${sujeto} a «Embarcado». ${clientes} el aviso de embarque, según las reglas de avisos. ${noSeTocan}`;
  }
  return `${sujeto} a «En aduana». ${clientes} «Tu carga llegó a Venezuela» y, si está activa, la regla de aviso de aduana. ${noSeTocan}`;
}

export function AvanceContenedorAccion({
  to,
  consolidationRef,
  totalEnvios,
  onAvanzar,
  onResumen,
}: {
  to: AvanceContenedor;
  consolidationRef: string;
  /** Envíos distintos colgados del contenedor (lo que se ve en el detalle). */
  totalEnvios: number;
  onAvanzar: () => Promise<ResultadoAccionAvance>;
  onResumen: (resumen: ResumenAvanceContenedor) => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const etiqueta = to === "zarpado" ? "Marcar zarpado" : "Marcar arribado";

  // El doble envío lo frena ConfirmDialog (`pending` y su candado de un solo
  // envío, que se suelta cuando llega un error nuevo).
  const confirmar = async () => {
    setPending(true);
    setError(null);
    try {
      const r = await onAvanzar();
      if (!r.ok || !r.avance) {
        setError(r.error ?? "No se pudo cambiar el estado del contenedor.");
        return;
      }
      setOpen(false);
      onResumen(r.avance);
      toast.success(lineaResumenAvance(r.avance));
    } catch {
      setError(
        "No se pudo confirmar el cambio. Puedes volver a intentarlo: si ya se hizo, no se repite.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="studio-btn studio-btn-dark studio-btn-sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {etiqueta}
      </button>
      <ConfirmDialog
        open={open}
        title={`${etiqueta} · ${consolidationRef}`}
        message={mensajeConfirmacionAvance(to, consolidationRef, totalEnvios)}
        confirmLabel={etiqueta}
        pending={pending}
        error={error ?? undefined}
        onCancel={() => {
          if (pending) return;
          setOpen(false);
          setError(null);
        }}
        onConfirm={() => {
          void confirmar();
        }}
      />
    </>
  );
}
