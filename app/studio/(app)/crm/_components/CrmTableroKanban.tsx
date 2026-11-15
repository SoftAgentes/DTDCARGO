"use client";

/**
 * Columnas de un embudo del CRM propio (SDD-0587 · paso 6.3).
 *
 * Toma el layout del tablero de Kommo (`KommoBoardView`: columnas = etapas en
 * orden, antigüedad en dorado desde 30 días) y el arrastre del kanban de
 * Bitácora (HTML5 nativo, sin librería, contrato DND-01): cada tarjeta se
 * arrastra y además trae un selector «Mover a…» que alcanza cualquier etapa
 * con teclado o con el dedo. El verbo de etapa vive en la misma tarjeta, igual
 * que `StageControl`, porque un kanban que no mueve nada enseña que la pantalla
 * no sirve (SDD-0256).
 *
 * Es presentacional: quien la monta decide qué hacer con `onMove` (pedir
 * motivo si la etapa es de cierre, llamar a la acción, avisar).
 */

import { useRef, useState, type DragEvent } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  CRM_DIAS_ATENCION,
  CRM_TARJETAS_POR_COLUMNA,
  SEGMENTO_LABEL,
  destinosDe,
  nombreEtapa,
  type CrmColumna,
  type CrmEtapa,
  type CrmTablero,
  type CrmTarjetaTablero,
} from "@/lib/studio/crm-tablero";

const SIN_NOMBRE = "Lead sin nombre";

export function nombreTarjeta(t: Pick<CrmTarjetaTablero, "nombre">): string {
  return t.nombre ?? SIN_NOMBRE;
}

export function CrmTableroKanban({
  tablero,
  columnas,
  etapas,
  canEdit,
  moviendo,
  onMove,
  onOpen,
}: {
  tablero: CrmTablero;
  columnas: CrmColumna[];
  /** Todas las etapas, para nombrar el origen y armar los destinos. */
  etapas: CrmEtapa[];
  canEdit: boolean;
  /** Tarjetas con un movimiento en curso. */
  moviendo: ReadonlySet<string>;
  onMove: (tarjeta: CrmTarjetaTablero, destino: CrmEtapa) => void;
  onOpen: (tarjeta: CrmTarjetaTablero) => void;
}) {
  const [sobre, setSobre] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  // El drop nativo dispara un clic fantasma en algunos navegadores.
  const arrastrando = useRef(false);

  const porId = new Map<string, CrmTarjetaTablero>();
  for (const c of columnas) for (const t of c.tarjetas) porId.set(t.id, t);

  const soltar = (e: DragEvent, destino: CrmEtapa) => {
    e.preventDefault();
    setSobre(null);
    const id = e.dataTransfer.getData("text/plain");
    const t = porId.get(id);
    if (!t || t.etapa === destino.clave || !destino.activa) return;
    setAviso(`Moviendo ${nombreTarjeta(t)} a ${destino.nombre}.`);
    onMove(t, destino);
  };

  return (
    <>
      <p role="status" aria-live="polite" style={SR_ONLY}>
        {aviso}
      </p>
      {/* Anclas de la guía (SDD-0589, 9.5): el tablero, la primera columna, y la
          primera tarjeta y el primer aviso de tareas que el motor encuentre. */}
      <div
        data-guia="embudo.tablero"
        style={{
          display: "flex",
          gap: "var(--s-3)",
          overflowX: "auto",
          paddingBottom: "var(--s-2)",
          alignItems: "flex-start",
        }}
      >
        {columnas.map(({ etapa, tarjetas }, i) => {
          const encima = sobre === etapa.clave;
          const visibles = tarjetas.slice(0, CRM_TARJETAS_POR_COLUMNA);
          const resto = tarjetas.length - visibles.length;
          return (
            <section
              key={etapa.clave}
              aria-label={`Etapa ${etapa.nombre}`}
              data-guia={i === 0 ? "embudo.columna-entrada" : undefined}
              onDragOver={(e) => {
                if (!canEdit || !etapa.activa) return;
                e.preventDefault();
                setSobre(etapa.clave);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setSobre((s) => (s === etapa.clave ? null : s));
              }}
              onDrop={(e) => canEdit && soltar(e, etapa)}
              style={{
                flex: "0 0 268px",
                width: 268,
                background: encima ? "var(--wine-tint)" : "var(--bg-surface)",
                border: `1px ${encima ? "dashed var(--wine)" : "solid var(--border)"}`,
                borderRadius: "var(--r-lg)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                transition:
                  "background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
              }}
            >
              <header
                style={{
                  padding: "var(--s-3) var(--s-3)",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg-elevated)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--s-2)",
                }}
              >
                <h3
                  title={etapa.nombre}
                  style={{
                    margin: 0,
                    flex: 1,
                    minWidth: 0,
                    font: "700 12.5px/1.2 var(--f-sans)",
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {etapa.nombre}
                </h3>
                {!etapa.activa && (
                  <Badge tone="neutral" size="sm">
                    Apagada
                  </Badge>
                )}
                {etapa.terminal && (
                  <Badge tone="neutral" size="sm">
                    Cierre
                  </Badge>
                )}
                <Badge tone="neutral" size="sm">
                  {tarjetas.length}
                </Badge>
              </header>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--s-2)",
                  padding: "var(--s-2)",
                  minHeight: 64,
                }}
              >
                {tarjetas.length === 0 ? (
                  <span
                    style={{
                      font: "400 12px/1.4 var(--f-sans)",
                      color: "var(--ink-soft)",
                      padding: "var(--s-2) var(--s-1)",
                    }}
                  >
                    Sin tarjetas en esta etapa.
                  </span>
                ) : (
                  visibles.map((t) => (
                    <TarjetaCard
                      key={t.id}
                      tarjeta={t}
                      tablero={tablero}
                      etapas={etapas}
                      canEdit={canEdit}
                      enCurso={moviendo.has(t.id)}
                      onDragStart={() => {
                        arrastrando.current = true;
                      }}
                      onDragEnd={() => {
                        setSobre(null);
                        setTimeout(() => {
                          arrastrando.current = false;
                        }, 0);
                      }}
                      onMove={(destino) => {
                        setAviso(`Moviendo ${nombreTarjeta(t)} a ${destino.nombre}.`);
                        onMove(t, destino);
                      }}
                      onOpen={() => {
                        if (!arrastrando.current) onOpen(t);
                      }}
                    />
                  ))
                )}
                {resto > 0 && (
                  <span
                    style={{
                      font: "600 11px/1.2 var(--f-sans)",
                      color: "var(--ink-soft)",
                      textAlign: "center",
                      padding: "var(--s-1) 0",
                    }}
                  >
                    +{resto} más en esta etapa. Usa la búsqueda para encontrarlas.
                  </span>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function TarjetaCard({
  tarjeta: t,
  tablero,
  etapas,
  canEdit,
  enCurso,
  onDragStart,
  onDragEnd,
  onMove,
  onOpen,
}: {
  tarjeta: CrmTarjetaTablero;
  tablero: CrmTablero;
  etapas: CrmEtapa[];
  canEdit: boolean;
  enCurso: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (destino: CrmEtapa) => void;
  onOpen: () => void;
}) {
  const nombre = nombreTarjeta(t);
  const destinos = destinosDe(etapas, tablero, t.etapa);
  const dias = t.diasEnEtapa;
  const atencion = dias != null && dias >= CRM_DIAS_ATENCION;

  return (
    <article
      data-tarjeta-id={t.id}
      data-guia="embudo.tarjeta"
      draggable={canEdit && !enCurso}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", t.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      aria-busy={enCurso}
      className="studio-row-hover"
      style={{
        background: "var(--bg-base)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "var(--s-3)",
        opacity: enCurso ? 0.6 : 1,
        cursor: canEdit && !enCurso ? "grab" : "default",
      }}
    >
      {/* SDD-0603 tramo 5d: el nombre sigue abriendo la ficha con el ratón, pero
          sale del orden de Tab; la parada de teclado y de lector es «Abrir»,
          al pie de la tarjeta. */}
      <button
        type="button"
        tabIndex={-1}
        onClick={onOpen}
        className="studio-link-quiet"
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          background: "none",
          border: 0,
          padding: 0,
          cursor: "pointer",
          font: "600 13px/1.3 var(--f-sans)",
          color: t.nombre ? "var(--ink)" : "var(--ink-soft)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {nombre}
      </button>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--s-1)",
          flexWrap: "wrap",
          marginTop: "var(--s-2)",
        }}
      >
        {tablero === "leads" && (
          <Badge tone="neutral" size="sm">
            {SEGMENTO_LABEL[t.segmento]}
          </Badge>
        )}
        {t.shippingMark && (
          <Badge tone="info" size="sm">
            {t.shippingMark}
          </Badge>
        )}
        {t.tareasVencidas > 0 ? (
          <span data-guia="embudo.tareas" style={{ display: "inline-flex" }}>
            <Badge tone="danger" size="sm">
              {t.tareasVencidas === 1 ? "1 tarea vencida" : `${t.tareasVencidas} tareas vencidas`}
            </Badge>
          </span>
        ) : t.tareasAbiertas > 0 ? (
          <span data-guia="embudo.tareas" style={{ display: "inline-flex" }}>
            <Badge tone="neutral" size="sm">
              {t.tareasAbiertas === 1 ? "1 tarea" : `${t.tareasAbiertas} tareas`}
            </Badge>
          </span>
        ) : null}
      </div>

      {t.origen && (
        <p
          style={{
            margin: "var(--s-2) 0 0",
            font: "500 11px/1.35 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          {t.origen.vuelta ? "Volvió de Clientes" : "Vino de Leads"} ·{" "}
          {nombreEtapa(etapas, t.origen.tablero, t.origen.etapa)}
        </p>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s-2)",
          marginTop: "var(--s-2)",
        }}
      >
        <span
          style={{
            font: "500 11px/1.2 var(--f-sans)",
            color: "var(--ink-soft)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {t.asesorNombre ?? "Sin dueño"}
        </span>
        <span
          title={dias == null ? "Sin fecha" : `${dias} días en esta etapa`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            font: "700 11px/1 var(--f-mono)",
            color: "var(--ink-soft)",
            flex: "0 0 auto",
          }}
        >
          {atencion && (
            // Atención = dorado en el punto, texto neutro (BRAND §Estados).
            <span
              aria-hidden
              style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--warning)" }}
            />
          )}
          {dias == null ? "—" : `${dias}d`}
          {atencion && <span style={SR_ONLY}> (más de {CRM_DIAS_ATENCION} días)</span>}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "var(--s-2)",
          marginTop: "var(--s-2)",
        }}
      >
        {enCurso ? (
          <p
            role="status"
            style={{
              margin: 0,
              flex: 1,
              font: "600 11px/1.3 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            Moviendo…
          </p>
        ) : (
          canEdit &&
          destinos.length > 0 && (
            <select
              className="studio-input"
              aria-label={`Mover ${nombre} a otra etapa`}
              value=""
              onChange={(e) => {
                const destino = destinos.find((d) => d.clave === e.target.value);
                if (destino) onMove(destino);
              }}
              style={{
                flex: 1,
                minWidth: 0,
                font: "500 12px/1 var(--f-sans)",
                // Alto ≥ 32 px: objetivo táctil del estándar de botones del Studio.
                minHeight: 32,
                padding: "var(--s-1) var(--s-2)",
              }}
            >
              <option value="" disabled>
                Mover a…
              </option>
              {destinos.map((d) => (
                <option key={d.clave} value={d.clave}>
                  {d.nombre}
                </option>
              ))}
            </select>
          )
        )}
        {/* No es arrastrable por sí mismo: la tarjeta lo es. Un clic no inicia
            arrastre, y el clic fantasma tras soltar lo descarta `onOpen`. */}
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          aria-label={`Abrir ficha de ${nombre}`}
          onClick={onOpen}
          style={{ flex: "0 0 auto" }}
        >
          Abrir
          {Icon.chevR(14)}
        </button>
      </div>
    </article>
  );
}

const SR_ONLY = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;
