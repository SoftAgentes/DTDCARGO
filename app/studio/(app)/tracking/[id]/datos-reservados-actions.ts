/**
 * SDD-0531 · Guardar los datos del envío sin ver ni pisar la ubicación de entrega.
 *
 * Al equipo de China (región `cn`, no admin) la página le manda el envío con
 * `destination_gps` en `null`: es la dirección del cliente y la política
 * publicada promete que ese equipo no la ve (PIPL; `app/privacidad/page.tsx`
 * §4). Pero `updateShipment` escribe TODOS los campos del formulario, y un campo
 * ausente lo guarda como `null`: si ese usuario corrige el peso, borraría la
 * ubicación sin haberla visto nunca.
 *
 * Esta acción es la puerta que usa el panel cuando los datos del cliente están
 * ocultos. Lee la ubicación vigente EN EL SERVIDOR, la pone en el formulario y
 * delega en `updateShipment`, que sigue siendo la única que valida y escribe.
 * La ubicación no sale de acá: la respuesta es la misma `ActionState` de
 * siempre, sin datos.
 *
 * No amplía nada: hace lo mismo que `updateShipment` con un campo menos, y
 * repite su candado de edición antes de leer.
 */

"use server";

import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { updateShipment, type ActionState } from "./actions";

export async function updateShipmentSinUbicacion(
  id: string,
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tracking");
  if (denial) return { error: denial };

  const { data, error } = await supabase
    .from("shipments")
    .select("destination_gps")
    .eq("id", id)
    .maybeSingle<{ destination_gps: string | null }>();
  if (error || !data) return { error: "Envío no encontrado." };

  // Lo que mande el navegador en `destination_gps` no cuenta: quien usa esta
  // puerta no puede ver la ubicación, así que tampoco la reemplaza.
  const formulario = new FormData();
  for (const [campo, valor] of formData.entries()) {
    if (campo !== "destination_gps") formulario.append(campo, valor);
  }
  if (data.destination_gps) {
    formulario.set("destination_gps", data.destination_gps);
  }

  return updateShipment(id, prevState, formulario);
}
