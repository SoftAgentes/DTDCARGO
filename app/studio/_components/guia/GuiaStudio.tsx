"use client";

/**
 * GuiaStudio · la guía montada en el layout de Studio con el estado por usuario
 * (SDD-0589, paso 9.3).
 *
 * El servidor manda: el layout lee `user_guide_prefs` y pasa `estadoInicial`. El
 * primer render del servidor y el del cliente salen de ese mismo dato; ningún render
 * lee `localStorage`, así que no hay desajuste de hidratación.
 *
 * - Con estado de la base: la memoria se siembra con él, cada cambio se copia al
 *   navegador y se manda a `guardarEstadoGuiaAction` 650 ms después, y la guía
 *   arranca sola la primera vez en cada pantalla.
 * - Sin estado (`null`: la base no respondió o la 0517 no está aplicada): guarda
 *   solo en el navegador, como en 9.2, y no arranca sola.
 */

import { useEffect, useState } from "react";
import { guardarEstadoGuiaAction } from "@/app/studio/(app)/_actions/guia-actions";
import { crearAlmacenServidor } from "@/lib/studio/guia/almacen";
import type { EstadoGuia } from "@/lib/studio/guia/estado-types";
import { RECORRIDOS } from "@/lib/studio/guia/recorridos";
import { GuiaMotor } from "./GuiaMotor";

export function GuiaStudio({ estadoInicial }: { estadoInicial: EstadoGuia | null }) {
  const [almacen] = useState(() =>
    crearAlmacenServidor({
      inicial: estadoInicial,
      guardarRemoto: (estado) => guardarEstadoGuiaAction(JSON.stringify(estado)),
    }),
  );

  // Después de hidratar: copia al navegador, o toma el navegador como respaldo.
  useEffect(() => {
    almacen.sincronizarAlMontar(RECORRIDOS.map((r) => r.id));
  }, [almacen]);

  // Lo pendiente sale al cerrar la pestaña o al desmontar.
  useEffect(() => {
    const vaciar = () => almacen.vaciar();
    window.addEventListener("pagehide", vaciar);
    return () => {
      window.removeEventListener("pagehide", vaciar);
      vaciar();
    };
  }, [almacen]);

  return <GuiaMotor almacen={almacen} autoArranque={almacen.conServidor} />;
}
