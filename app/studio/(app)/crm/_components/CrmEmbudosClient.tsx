"use client";

/**
 * Los embudos del CRM propio (SDD-0587 · paso 6.3), vistos por segmento
 * (SDD-0647): Clientes, Leads y Leads con código (`CRM_VISTAS`).
 *
 * La vista de cada tarjeta no la elige nadie: sale del segmento calculado en
 * el momento y de si su ficha tiene Shipping Mark. Aquí solo se elige qué vista
 * mirar, se busca y se mueve de etapa dentro del embudo de esa vista.
 *
 * Mover = `crm_mover_etapa` por `moverTarjetaAction`. Una etapa de cierre
 * (Perdido) pide motivo con `ConfirmDialog`, igual que la RPC. Mientras viaja,
 * la tarjeta se pinta ya en su destino con «Moviendo…»; si el servidor dice que
 * no, vuelve a su columna y el aviso explica por qué.
 */

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { SegmentedControl } from "@/app/studio/_components/ui/SegmentedControl";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  CRM_TABLERO_CAP,
  CRM_VISTAS,
  armarColumnas,
  coincideBusqueda,
  contarPorVista,
  vistaDef,
  type CrmEtapa,
  type CrmTarjetaTablero,
  type CrmVista,
} from "@/lib/studio/crm-tablero";
import { moverTarjetaAction } from "../tarjeta-actions";
import { nombreTarjeta } from "./CrmTableroKanban";
import { CrmVistaEmbudo } from "./CrmVistaEmbudo";
import { TarjetaFichaDrawer } from "./TarjetaFichaDrawer";

export function CrmEmbudosClient({
  etapas,
  tarjetas,
  ocultas,
  recortado,
  canEdit,
  tableroInicial,
}: {
  etapas: CrmEtapa[];
  tarjetas: CrmTarjetaTablero[];
  ocultas: number;
  recortado: boolean;
  canEdit: boolean;
  tableroInicial: CrmVista;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startRefresh] = useTransition();
  const [, startMove] = useTransition();
  const [vista, setVista] = useState<CrmVista>(tableroInicial);
  const def = vistaDef(vista);
  const tablero = def.tablero;
  const [busqueda, setBusqueda] = useState("");
  // Etapa que se pinta mientras el movimiento viaja (id → clave de destino).
  // Es optimista: al terminar la transición vuelve a lo que diga el servidor,
  // así un error devuelve la tarjeta a su columna sin código extra.
  const [enVuelo, ponerEnVuelo] = useOptimistic(
    new Map<string, string>(),
    (m: Map<string, string>, [id, clave]: [string, string]) => new Map(m).set(id, clave),
  );
  const [cierre, setCierre] = useState<{ tarjeta: CrmTarjetaTablero; destino: CrmEtapa } | null>(
    null,
  );
  const [fichaId, setFichaId] = useState<string | null>(null);

  const vistas = useMemo(
    () =>
      tarjetas.map((t) => {
        const destino = enVuelo.get(t.id);
        return destino ? { ...t, etapa: destino } : t;
      }),
    [tarjetas, enVuelo],
  );

  const conteo = useMemo(() => contarPorVista(tarjetas), [tarjetas]);

  const filtradas = useMemo(
    () => vistas.filter((t) => coincideBusqueda(t, busqueda)),
    [vistas, busqueda],
  );
  const columnas = useMemo(
    () => armarColumnas(etapas, filtradas, tablero, def),
    [etapas, filtradas, tablero, def],
  );
  const enEsteTablero = filtradas.filter((t) => t.tablero === tablero && def.incluye(t)).length;

  const elegirVista = (k: CrmVista) => {
    setVista(k);
    router.replace(`/studio/crm?tab=embudos&embudo=${k}`, { scroll: false });
  };

  const mover = (t: CrmTarjetaTablero, destino: CrmEtapa, motivo: string | null) =>
    startMove(async () => {
      ponerEnVuelo([t.id, destino.clave]);
      const res = await moverTarjetaAction(t.id, t.tablero, destino.clave, motivo);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.show({
        eventKey: "crm:tarjeta-movida",
        tone: res.movida ? "success" : "info",
        message: res.movida
          ? `${nombreTarjeta(t)} pasó a ${destino.nombre}`
          : `${nombreTarjeta(t)} ya tenía la etapa ${destino.nombre}`,
        priority: "normal",
        scope: "module",
        dedupeKey: `crm:tarjeta-movida:${t.id}`,
      });
      // Dentro de la misma transición: la tarjeta sigue en su destino hasta que
      // llegan los datos nuevos, sin parpadear de vuelta a su columna vieja.
      router.refresh();
    });

  const pedirMovimiento = (t: CrmTarjetaTablero, destino: CrmEtapa) => {
    if (destino.terminal) {
      setCierre({ tarjeta: t, destino });
      return;
    }
    mover(t, destino, null);
  };

  if (tarjetas.length === 0) {
    return (
      <EmptyState
        eyebrow="CRM propio"
        title="Todavía no hay tarjetas."
        description={
          ocultas > 0
            ? `Hay ${ocultas} ${ocultas === 1 ? "tarjeta escondida porque su ficha está borrada" : "tarjetas escondidas porque sus fichas están borradas"}.`
            : "Las tarjetas llegan cuando un lead escribe al número de leads o se registra en la web."
        }
      />
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "var(--s-3)",
          flexWrap: "wrap",
          marginBottom: "var(--s-4)",
        }}
      >
        <SegmentedControl<CrmVista>
          variant="pills"
          ariaLabel="Segmento"
          value={vista}
          onChange={elegirVista}
          options={CRM_VISTAS.map((o) => ({
            value: o.key,
            label: `${o.label} (${conteo[o.key]})`,
          }))}
        />
        <div style={{ minWidth: 240, flex: "0 1 320px" }}>
          <label className="studio-label" htmlFor="crm-embudos-buscar">
            Buscar por nombre o Shipping Mark
          </label>
          <input
            id="crm-embudos-buscar"
            type="search"
            className="studio-input"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre o DTD-0000"
          />
        </div>
      </div>

      {busqueda.trim() && enEsteTablero === 0 && (
        <p
          role="status"
          style={{
            font: "400 12.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "0 0 var(--s-3)",
          }}
        >
          Ninguna tarjeta de {def.nombre} coincide con la búsqueda.
        </p>
      )}

      {/* SDD-0648 §3-§4: vista Tablero | Lista y aviso del chat que no se pudo abrir. */}
      <CrmVistaEmbudo
        tablero={tablero}
        columnas={columnas}
        etapas={etapas}
        canEdit={canEdit}
        moviendo={new Set(enVuelo.keys())}
        onMove={pedirMovimiento}
        onOpen={(t) => setFichaId(t.id)}
      />

      <p
        style={{
          font: "400 11.5px/1.45 var(--f-sans)",
          color: "var(--ink-soft)",
          marginTop: "var(--s-3)",
          maxWidth: 820,
        }}
      >
        {canEdit
          ? "Arrastra una tarjeta a otra columna o usa «Mover a…». "
          : "Vista de lectura: tu permiso no mueve tarjetas. "}
        Nadie elige el segmento: una tarjeta pasa sola a Clientes cuando su ficha tiene un envío
        (aunque ya esté entregado; no cuentan borradores ni cancelados) o carga recibida en
        China. Sin carga, va a Leads con código si su ficha tiene Shipping Mark, y a Leads si no.
        Una cotización sola no la hace cliente.
        {ocultas > 0 &&
          ` ${ocultas} ${ocultas === 1 ? "tarjeta está escondida porque su ficha está borrada" : "tarjetas están escondidas porque sus fichas están borradas"}.`}
        {recortado &&
          ` Se muestran las ${CRM_TABLERO_CAP.toLocaleString("es-VE")} tarjetas con actividad más reciente.`}
      </p>

      {cierre && (
        <ConfirmDialog
          open
          title={`Mover a ${cierre.destino.nombre}`}
          message={`${nombreTarjeta(cierre.tarjeta)} queda cerrada en «${cierre.destino.nombre}». Escribe el motivo: queda en el historial de la tarjeta.`}
          confirmLabel={`Mover a ${cierre.destino.nombre}`}
          reason
          reasonRequired
          reasonLabel="Motivo"
          reasonPlaceholder="No le conviene el tiempo de tránsito, compró con otro…"
          initialFocus="reason"
          onCancel={() => setCierre(null)}
          onConfirm={(motivo) => {
            const { tarjeta, destino } = cierre;
            setCierre(null);
            mover(tarjeta, destino, motivo.trim().slice(0, 200));
          }}
        />
      )}

      {fichaId && (
        <TarjetaFichaDrawer
          tarjetaId={fichaId}
          etapas={etapas}
          canEdit={canEdit}
          onClose={() => setFichaId(null)}
          onCambio={() => startRefresh(() => router.refresh())}
        />
      )}
    </div>
  );
}
