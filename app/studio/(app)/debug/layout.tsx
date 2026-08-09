/**
 * Gate RBAC de la Torre de control (SDD-0050).
 *
 * `/studio/debug` NO está en el registro `MODULES`, así que el anti-drift de
 * `rbac-view-guard.test.ts` —que itera sobre MODULES— nunca la miró, y la ruta
 * quedaba abierta a cualquier rol que tipeara la URL. Muestra estado de las
 * variables de entorno, deploys de Vercel y salud de las integraciones: es
 * información de infraestructura, no de negocio.
 *
 * Se gatea con el módulo `admin` en vez de registrarla en MODULES para no
 * agregarle una entrada al sidebar: es una herramienta de diagnóstico a la que
 * se llega por URL, no un módulo del producto.
 */
import { requireModuleView } from "@/lib/studio/rbac-guard";

export default async function DebugGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModuleView("admin");
  return <>{children}</>;
}
