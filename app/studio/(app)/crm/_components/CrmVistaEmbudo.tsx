"use client";

/**
 * Vista de un embudo del CRM: Tablero o Lista (SDD-0648 §3, D6), y el aviso
 * cuando «Abrir chat» no encontró conversación (§4).
 *
 * Recibe lo mismo que el tablero; `CrmEmbudosClient` sigue a cargo del
 * embudo, la búsqueda y los movimientos. La vista elegida se recuerda en este
 * navegador, como conveniencia: si el almacenamiento falla, se abre el tablero.
 */

import { useEffect, useState } from "react";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { SegmentedControl } from "@/app/studio/_components/ui/SegmentedControl";
import type { CrmColumna, CrmEtapa, CrmTablero, CrmTarjetaTablero } from "@/lib/studio/crm-tablero";
import { CrmEmbudosLista } from "./CrmEmbudosLista";
import { CrmTableroKanban } from "./CrmTableroKanban";

type Vista = "tablero" | "lista";
export const CLAVE_VISTA = "dtd:crm:vista-embudo";
const CLAVE = CLAVE_VISTA;

/** Avisos que deja la ruta del chat en `?chat=` (SDD-0648 §4). */
const AVISO_CHAT: Record<string, { tono: "info" | "error"; texto: string }> = {
  sin: { tono: "info", texto: "Esa tarjeta todavía no tiene conversación en Chatwoot." },
  error: {
    tono: "error",
    texto: "No se pudo abrir el chat: Chatwoot no respondió. Vuelve a intentarlo desde la tarjeta.",
  },
  sin_bandeja: {
    tono: "info",
    texto: "Tu usuario no tiene la Bandeja de Chatwoot. Pídesela a un administrador para chatear desde el CRM.",
  },
};

export function CrmVistaEmbudo(props: {
  tablero: CrmTablero;
  columnas: CrmColumna[];
  etapas: CrmEtapa[];
  canEdit: boolean;
  moviendo: ReadonlySet<string>;
  onMove: (tarjeta: CrmTarjetaTablero, destino: CrmEtapa) => void;
  onOpen: (tarjeta: CrmTarjetaTablero) => void;
}) {
  const [vista, setVista] = useState<Vista>("tablero");
  // `?chat=sin|error` lo pone la ruta del chat (SDD-0648 §4) al no encontrarlo.
  const [chat, setChat] = useState<string | null>(null);
  const aviso = chat ? AVISO_CHAT[chat] : undefined;

  // Se lee al montar, no al pintar en el servidor: así no hay desajuste de hidratación.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única del navegador al montar
    setChat(new URLSearchParams(window.location.search).get("chat"));
    try {
      if (window.localStorage.getItem(CLAVE) === "lista") setVista("lista");
    } catch {
      /* sin almacenamiento: queda el tablero */
    }
  }, []);

  const elegir = (v: Vista) => {
    setVista(v);
    try {
      window.localStorage.setItem(CLAVE, v);
    } catch {
      /* sin almacenamiento: la vista vale solo en esta visita */
    }
  };

  return (
    <div data-ancho-completo>
      {aviso && (
        <div style={{ marginBottom: "var(--s-3)" }}>
          <Aviso tono={aviso.tono} compacto>
            {aviso.texto}
          </Aviso>
        </div>
      )}
      <div
        style={{
          marginBottom: "var(--s-3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s-2)",
          flexWrap: "wrap",
        }}
      >
        <SegmentedControl<Vista>
          variant="pills"
          ariaLabel="Vista del embudo"
          value={vista}
          onChange={elegir}
          options={[
            { value: "tablero", label: "Tablero" },
            { value: "lista", label: "Lista" },
          ]}
        />
      </div>
      {vista === "lista" ? (
        <CrmEmbudosLista tablero={props.tablero} columnas={props.columnas} onOpen={props.onOpen} />
      ) : (
        <CrmTableroKanban
          tablero={props.tablero}
          columnas={props.columnas}
          etapas={props.etapas}
          canEdit={props.canEdit}
          moviendo={props.moviendo}
          onMove={props.onMove}
          onOpen={props.onOpen}
        />
      )}
    </div>
  );
}
