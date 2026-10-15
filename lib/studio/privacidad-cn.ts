/**
 * Nombres y datos personales de los clientes ante el equipo de China — SDD-0531.
 *
 * La regla es la de SDD-0039 B.9, que hasta ahora vivía escrita a mano en
 * `app/studio/(app)/cn/page.tsx`: un usuario del Studio con región `cn` que no
 * es admin NO ve el nombre del cliente, sólo su Shipping Mark y los códigos.
 * Acá queda en un solo lugar para que Almacén CN, Tracking y Naviera la lean
 * igual.
 *
 * Por qué existe (PIPL): el equipo de Yiwu trata información personal dentro de
 * China (art. 3, supuesto 1), y la política publicada promete que «no ve tu
 * nombre, ni tu documento, ni tu dirección, ni tu teléfono»
 * (`app/privacidad/page.tsx` §4 y §5). Mostrárselos en el Studio hace falsa esa
 * promesa y contradice la minimización del art. 6.
 *
 * El ocultamiento va en el SERVIDOR: el dato sale de la página o de la ruta ya
 * en `null`, así que no llega al navegador. Esconderlo con CSS no serviría.
 *
 * ⚠️ Límite conocido: esto minimiza lo que el Studio entrega; NO es una frontera
 * de base de datos. La RLS de `shipments` y `clients` sólo compara tenant
 * (0012:228, 0230, 0456:203), así que un usuario que consulte PostgREST con su
 * propia sesión sigue leyendo esas columnas. Cerrar eso es otra tarea (ver
 * SDD-0531 §Riesgos).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Lo que la regla necesita de la membresía (`user_tenants`). */
export interface MembresiaConRegion {
  region?: string | null;
  role?: string | null;
}

/**
 * ¿Puede este usuario ver nombres de clientes? La regla de SDD-0039 B.9, sin
 * cambios: sólo la región `cn` sin rol `admin` queda fuera. Admin de cualquier
 * región y usuarios de Venezuela sí los ven.
 *
 * Es pura a propósito: Almacén CN ya leyó la membresía para resolver el idioma
 * y la evalúa con lo que tiene, sin una segunda consulta.
 */
export function canSeeClientNames(
  membresia: MembresiaConRegion | null | undefined,
): boolean {
  return !(membresia?.region === "cn" && membresia?.role !== "admin");
}

/**
 * Lee la membresía activa del usuario de la sesión y aplica la regla.
 *
 * Misma lectura que `getStudioAccess` (rbac-guard): `user_id` explícito,
 * `disabled_at` nulo y `limit(1)`. A diferencia de la regla pura, acá la duda
 * oculta: sin sesión, sin membresía o con la lectura en error devuelve `false`.
 * Quien llega a Tracking o Naviera ya pasó por `requireModuleView`, que exige
 * esa misma membresía, así que el caso sólo aparece si la base falla — y
 * entonces es mejor no mostrar nombres que mostrarlos a quien no debía.
 */
export async function readCanSeeClientNames(
  supabase: SupabaseClient,
): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from("user_tenants")
      .select("region, role")
      .eq("user_id", user.id)
      .is("disabled_at", null)
      .limit(1)
      .maybeSingle<{ region: string | null; role: string | null }>();
    if (error || !data) return false;
    return canSeeClientNames(data);
  } catch {
    return false;
  }
}

/**
 * Claves que identifican al cliente o lo ubican. En las filas de Tracking y
 * Naviera hoy aparecen `client_name`, `clientName` (estiba y plan de carga) y
 * `destination_gps`; el resto está por si una consulta las suma mañana: el
 * ocultamiento no debería depender de que alguien se acuerde de agregarlas.
 *
 * NO están `name` (navieras, puertos y tipos de contenedor también lo usan),
 * `notes` ni `supplier_name` (el proveedor chino no es el cliente). El Shipping
 * Mark (`markbox`, `client_markbox`) se conserva: es lo que el equipo de China
 * sí usa para trabajar.
 */
export const CLAVES_DE_DATOS_DEL_CLIENTE: ReadonlySet<string> = new Set([
  "client_name",
  "clientName",
  "customer_name",
  "customerName",
  "client_phone",
  "clientPhone",
  "client_email",
  "clientEmail",
  "client_address",
  "clientAddress",
  "client_document",
  "clientDocument",
  "client_rif",
  "clientRif",
  "contact_name",
  "contactName",
  "phone",
  "email",
  "whatsapp",
  "address",
  "rif",
  "cedula",
  "document_number",
  "documentNumber",
  "destination_gps",
  "destinationGps",
  "delivery_address",
  "deliveryAddress",
  "pod_signed_by",
  "podSignedBy",
]);

function esObjetoPlano(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Copia de `valor` con cada clave de `CLAVES_DE_DATOS_DEL_CLIENTE` en `null`, a
 * cualquier profundidad (el plan de carga guarda el nombre dentro de `input` y
 * de `result.pasos`). Nunca muta lo que recibe: la lectura original queda
 * intacta para quien sí puede verla.
 *
 * Una clave ausente sigue ausente — no se inventan campos — y lo que no es un
 * objeto plano ni un arreglo (fechas, números, cadenas) pasa tal cual.
 */
export function ocultarDatosDelCliente<T>(valor: T): T {
  if (Array.isArray(valor)) {
    return valor.map((v) => ocultarDatosDelCliente(v)) as unknown as T;
  }
  if (!esObjetoPlano(valor)) return valor;

  const copia: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(valor)) {
    copia[clave] = CLAVES_DE_DATOS_DEL_CLIENTE.has(clave)
      ? null
      : ocultarDatosDelCliente(v);
  }
  return copia as T;
}

/** Aplica el ocultamiento sólo cuando la regla lo pide. */
export function segunVisibilidad<T>(valor: T, puedeVerNombres: boolean): T {
  return puedeVerNombres ? valor : ocultarDatosDelCliente(valor);
}

/** Lo que este módulo necesita saber de un plan de carga guardado (0298). */
export interface PlanConLotes {
  input?: ReadonlyArray<{ clientName?: string | null }> | null;
  result?: { avisos?: ReadonlyArray<{ mensaje?: string | null }> | null } | null;
}

/** Cómo se nombra en un aviso al lote cuyo cliente no se puede mostrar. */
export const LOTE_SIN_NOMBRE = "Lote sin Shipping Mark";

/**
 * El plan de carga es el único lugar de Naviera donde el nombre del cliente
 * también viaja DENTRO de un texto: el motor (`lib/shared/estiba-plan.ts`,
 * `etiquetaLote`) nombra a un lote sin Shipping Mark por su cliente en el aviso
 * «… no entró completo». Borrar la clave `clientName` no alcanza para ese
 * texto, así que acá se reemplaza cada nombre de `input` que aparezca en
 * `result.avisos[].mensaje` y después se oculta el resto como en cualquier fila.
 *
 * Sólo se tocan los avisos, que son de lectura. Nunca un texto que se edita y
 * se vuelve a guardar (notas): reescribirlo ahí borraría el nombre de la base.
 */
export function ocultarDatosDelPlanDeCarga<T extends PlanConLotes>(plan: T): T {
  const nombres = (plan.input ?? [])
    .map((l) => l.clientName?.trim() ?? "")
    .filter((n) => n.length > 0)
    // El más largo primero: «Ana María» antes que «Ana».
    .sort((a, b) => b.length - a.length);

  const avisos = plan.result?.avisos;
  const conAvisosLimpios =
    nombres.length > 0 && plan.result && Array.isArray(avisos)
      ? {
          ...plan,
          result: {
            ...plan.result,
            avisos: avisos.map((a) =>
              typeof a.mensaje === "string"
                ? {
                    ...a,
                    mensaje: nombres.reduce(
                      (texto, nombre) => texto.split(nombre).join(LOTE_SIN_NOMBRE),
                      a.mensaje,
                    ),
                  }
                : a,
            ),
          },
        }
      : plan;

  return ocultarDatosDelCliente(conAvisosLimpios);
}

/**
 * Cómo se nombra al cliente en una fila. Con los nombres ocultos se muestra su
 * Shipping Mark —lo mismo que ve el equipo en Almacén CN—, y no «Sin cliente»,
 * que diría algo falso: el cliente existe, lo que no se muestra es su nombre.
 * Con los nombres visibles se conserva exactamente lo que la pantalla ya hacía.
 */
export function etiquetaDelCliente(
  fila: { client_name: string | null; client_markbox: string | null },
  nombresOcultos: boolean,
): string {
  if (nombresOcultos) return fila.client_markbox?.trim() || "Sin Shipping Mark";
  return fila.client_name ?? "Sin cliente";
}
