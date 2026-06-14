/**
 * Servicios en detalle — sección de /servicios reorganizada como "el viaje de
 * tu carga" (origen → recepción en bodega → transporte y aduana → tu puerta).
 *
 * Server component fino: agrupa la lista por el viaje (`agruparPorViaje`) y la
 * pasa al explorador interactivo. El contenido de cada ficha vive en el DOM
 * (SSR) aunque el acordeón esté colapsado → el AI Agent de Kommo (que crawlea
 * dtdcargo.com) toma info certera.
 *
 * COSTURA (source-agnostic): recibe `servicios` como prop. Hoy `page.tsx` le
 * pasa el estático `SERVICIOS_DETALLE`; cuando aterrice SDD-0076, le pasará
 * `await getServiciosParaSitio()` (merge con la config del ERP) sin tocar este
 * archivo ni el explorador.
 */
import { OpenDetailsOnHash } from "@/components/OpenDetailsOnHash";
import { ServiciosExplorer } from "@/components/ServiciosExplorer";
import { agruparPorViaje } from "@/lib/servicios-timeline";
import type { ServicioDetalle } from "@/lib/servicios-detalle";

export function ServiciosDetalle({
  servicios,
}: {
  servicios: ServicioDetalle[];
}) {
  const { ddp, fases } = agruparPorViaje(servicios);

  return (
    <section className="py-16 lg:py-20" id="detalle">
      {/* Abre el acordeón destino al llegar por hash (footer /servicios#slug). */}
      <OpenDetailsOnHash />
      <div className="wrap">
        <span className="eyebrow">Servicios en detalle</span>
        <h2 className="h-section mt-4" style={{ fontSize: "clamp(28px, 4vw, 48px)" }}>
          Cada servicio,{" "}
          <span style={{ color: "var(--color-wine)" }}>sin letra chica.</span>
        </h2>
        <p className="lead mt-5 max-w-[60ch]">
          Sigue el viaje de tu carga —de China a tu puerta— y toca cada servicio
          para ver qué incluye, qué no y cómo se solicita. ¿Necesitas varios?
          Arma tu envío y cotízalos juntos.
        </p>

        <ServiciosExplorer ddp={ddp} fases={fases} />
      </div>
    </section>
  );
}
