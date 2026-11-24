"use client";

import { ClientDetailPanel } from "@/app/studio/(app)/clientes/_components/ClientDetailPanel";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

/** El fallo queda en el slot; no se representa el detalle interno del error. */
export default function ErrorDeFicha({ reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ClientDetailPanel listadoHref="/studio/clientes">
      <Aviso tono="error" titulo="No pudimos cargar la ficha" tabIndex={-1}
        accion={{ etiqueta: "Reintentar", onClick: reset }}>
        Puedes reintentar o volver al listado.
      </Aviso>
    </ClientDetailPanel>
  );
}
