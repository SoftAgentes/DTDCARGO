"use client";

/**
 * SDD-0669 · La nota de la ficha, arriba y a la vista en todas las pestañas.
 * Es la misma nota que antes iba dentro de «Datos del cliente» (la oficina deja
 * ahí avisos como «PENDIENTE: …»). Larga, se ve en dos líneas con «Ver nota
 * completa».
 */

import { useState } from "react";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

/** A partir de aquí la nota se pliega a dos líneas. */
const LARGO_PLEGADO = 160;

export function NotaDeLaFicha({ nota }: { nota: string }) {
  const larga = nota.length > LARGO_PLEGADO || nota.includes("\n");
  const [abierta, setAbierta] = useState(false);
  return (
    <Aviso
      tono="atencion"
      titulo="Nota de la ficha"
      accion={
        larga
          ? { etiqueta: abierta ? "Ver menos" : "Ver nota completa", onClick: () => setAbierta((a) => !a) }
          : undefined
      }
    >
      <span className="studio-ficha-nota" data-plegada={larga && !abierta ? "true" : undefined}>
        {nota}
      </span>
    </Aviso>
  );
}
