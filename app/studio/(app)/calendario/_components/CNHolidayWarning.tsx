/**
 * CNHolidayWarning — card permanente sobre el impacto de los feriados
 * críticos CN (SDD-0015). Información estratégica: regla de las
 * 3 semanas de anticipación.
 *
 * Desde el tramo 4b de SDD-0603 es un `<Aviso tono="atencion">` (BD-037):
 * franja plana con icono, sin contorno.
 */

import { Aviso } from "@/app/studio/_components/ui/Aviso";

export function CNHolidayWarning() {
  return (
    <Aviso tono="atencion" titulo="Atención feriados CN">
      <strong>Año Nuevo Chino</strong> (16-24 feb) y <strong>Golden Week</strong>{" "}
      (1-7 oct) paralizan Yiwu y Shenzhen. Planifica zarpes con{" "}
      <strong>3 semanas de anticipación</strong>.
    </Aviso>
  );
}
