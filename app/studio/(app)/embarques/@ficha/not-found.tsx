import { ClientDetailPanel } from "@/app/studio/(app)/clientes/_components/ClientDetailPanel";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

/** Mensaje mínimo: no confirma existencia ni revela datos de la ficha. */
export default function FichaNoDisponible() {
  return (
    <ClientDetailPanel listadoHref="/studio/embarques">
      <Aviso tono="info" titulo="Ficha no disponible">
        Puedes volver al listado y elegir otra ficha.
      </Aviso>
    </ClientDetailPanel>
  );
}
