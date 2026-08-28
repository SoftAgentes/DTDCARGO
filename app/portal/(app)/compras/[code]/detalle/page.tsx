import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getPortalClient } from "@/lib/portal/portal-queries";
import { getPrealertaByCode } from "@/lib/studio/prealertas/queries";
import { PurchaseStepDetalle } from "../../nueva/PurchaseStepDetalle";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Completar ${decodeURIComponent(code)}` };
}

/**
 * SDD-0313 · Completar el detalle de una compra YA registrada.
 *
 * Esta ruta no existía y era un callejón sin salida: el paso 2 del asistente
 * sólo se montaba en el mismo render en que el alta devolvía `ok`. Si el
 * cliente recargaba, cerraba la pestaña o tocaba "Volver a mis compras", la
 * compra quedaba creada con la descripción de relleno ("Pendiente — el cliente
 * la completa") y **no había ninguna forma de volver a llenarla**. El detalle de
 * la compra es de sólo lectura y `updatePrealertaDetalleAction` no tenía otro
 * llamador.
 *
 * ## Por qué precarga
 *
 * `validatePrealertaInput({ requireDetalle: false })` cae a
 * `PREALERTA_DESCRIPCION_PENDIENTE` y `boxes = 1` cuando los campos llegan
 * vacíos. Servir esta pantalla en blanco y dejar guardar **pisaría** lo que el
 * cliente ya tenía. Por eso los valores guardados viajan como `defaultValue`.
 *
 * ## Seguridad
 *
 * `getPrealertaByCode` corre con el cliente AUTENTICADO y filtra por
 * `client_markbox`: una compra ajena o inexistente devuelve null → 404, sin
 * revelar si el código existe. Misma puerta que usa `/portal/compras/[code]`.
 *
 * ## Por qué sólo `anunciada`
 *
 * `updatePrealertaDetalleAction` rechaza cualquier otro estado: una vez que la
 * carga se tocó en bodega, el detalle lo manda el operario con la mercancía
 * delante, no el cliente. Se corta acá con un redirect en vez de dejar que el
 * cliente llene un formulario que el servidor va a rebotar.
 */
export default async function CompletarDetalleCompraPage({ params }: Props) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw);

  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) return null;

  const prealerta = await getPrealertaByCode(supabase, code, {
    markbox: client.markbox,
  });
  if (!prealerta) notFound();

  if (prealerta.status !== "anunciada") {
    redirect(`/portal/compras/${encodeURIComponent(code)}`);
  }

  return (
    <div className="max-w-[1000px]">
      <PurchaseStepDetalle
        code={prealerta.code}
        modo="suelto"
        guardado={{
          description: prealerta.description,
          boxes: prealerta.boxes,
          estValueUsd: prealerta.est_value_usd,
          trackingCn: prealerta.tracking_cn,
        }}
      />
    </div>
  );
}
