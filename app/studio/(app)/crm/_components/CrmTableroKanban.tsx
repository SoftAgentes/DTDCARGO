"use client";

/**
 * Columnas de un embudo del CRM propio (SDD-0587 · paso 6.3).
 *
 * Toma el layout del tablero de Kommo (`KommoBoardView`: columnas = etapas en
 * orden, antigüedad en dorado desde 30 días) y el arrastre del kanban de
 * Bitácora (HTML5 nativo, sin librería, contrato DND-01): cada tarjeta se
 * arrastra y además trae un menú de acciones con «Mover a …» que alcanza
 * cualquier etapa con teclado o con el dedo. El verbo de etapa vive en la misma
 * tarjeta, igual que `StageControl`, porque un kanban que no mueve nada enseña
 * que la pantalla no sirve (SDD-0256). SDD-0648: el menú reemplaza al selector
 * para que la tarjeta quepa en dos líneas. SDD-0671: sin botón «Abrir»; toda la
 * tarjeta abre la ficha.
 *
 * Es presentacional: quien la monta decide qué hacer con `onMove` (pedir
 * motivo si la etapa es de cierre, llamar a la acción, avisar).
 */

import { useRef, useState, type DragEvent } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { ActionMenu, type ActionMenuItem } from "@/app/studio/_components/ui/ActionMenu";
import { canalConChat, canalDeTarjeta } from "@/lib/studio/crm-canal";
import { CanalLogo } from "./CanalLogo";
import { useChatPermitido } from "./ChatPermitido";
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

/** Ruta que resuelve la conversación de Chatwoot de una tarjeta (SDD-0648 §4). */
export function rutaChatTarjeta(id: string): string {
  return `/studio/crm/chat/${encodeURIComponent(id)}`;
}

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
          // SDD-0648 §3: las columnas se reparten el ancho; si no caben, el
          // tablero se desplaza en horizontal como antes.
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(232px, 1fr)",
          gap: "var(--s-2)",
          overflowX: "auto",
          paddingBottom: "var(--s-2)",
          alignItems: "start",
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
                minWidth: 0,
                background: encima ? "var(--accion-tint)" : "var(--bg-surface)",
                border: `1px ${encima ? "dashed var(--accion)" : "solid var(--border)"}`,
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
                  gap: "var(--s-1)",
                  padding: "var(--s-1)",
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

/**
 * Tarjeta compacta (SDD-0648 §1, SDD-0671). Dos líneas y una sola acción visible:
 *   1. logo del canal + nombre (abre la ficha; es la parada de teclado);
 *   2. segmento o Shipping Mark · dueño · días;
 *   3. solo si existen: tareas y de dónde vino.
 * «Mover», «Abrir ficha» y «Abrir chat» viven en un `ActionMenu` de 32 × 32
 * (BTN-01 §7, BD-037): nada oprimible baja de 32 px y la fila de controles ya
 * no ocupa media tarjeta.
 *
 * SDD-0671 (Sam: «eso de abrir está muy grande. Elimínalo, porque ya al oprimir
 * se abre automáticamente»): no hay botón «Abrir». Un clic en cualquier parte
 * de la tarjeta que no sea el menú abre la ficha; con teclado, el nombre es un
 * botón con nombre accesible «Abrir ficha de …» (Enter o Espacio).
 */
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
  const canal = canalDeTarjeta(t.fuente, t.utmSource);
  // SDD-0648 §4: solo si se puede entrar a la Bandeja (rol + flag `chatwoot_inbox`).
  const conChat = useChatPermitido() && (canalConChat(canal) || t.shippingMark != null);

  const acciones: ActionMenuItem[] = [
    { key: "ficha", label: "Abrir ficha", icon: "doc", onSelect: onOpen },
    ...(conChat
      ? [{ key: "chat", label: "Abrir chat", icon: "chat" as const, href: rutaChatTarjeta(t.id) }]
      : []),
    ...(canEdit && destinos.length > 0
      ? [
          { key: "sep-mover", separator: true as const },
          ...destinos.map((d) => ({
            key: `mover-${d.clave}`,
            label: `Mover a ${d.nombre}`,
            onSelect: () => onMove(d),
          })),
        ]
      : []),
  ];

  const segmento = tablero === "leads" ? SEGMENTO_LABEL[t.segmento] : null;
  const extras = t.tareasVencidas > 0 || t.tareasAbiertas > 0 || t.origen != null;

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
      onClick={(e) => {
        // SDD-0671: toda la tarjeta abre la ficha, salvo los controles propios
        // (el nombre ya llama a `onOpen`; el menú hace lo suyo).
        if (enCurso) return;
        if ((e.target as HTMLElement).closest("button, a, [role='menu'], [role='menuitem']")) return;
        onOpen();
      }}
      className="studio-row-hover"
      style={{
        background: "var(--bg-base)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "var(--s-1) var(--s-1) var(--s-1) var(--s-2)",
        opacity: enCurso ? 0.6 : 1,
        cursor: enCurso ? "default" : canEdit ? "grab" : "pointer",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        columnGap: "var(--s-1)",
        alignItems: "center",
      }}
    >
      {/* SDD-0648 (/ui-check): el nombre abre la ficha y abarca las dos líneas,
          así es un objetivo de 32 px (BD-037). SDD-0671: vuelve a ser la parada
          de teclado y de lector («Abrir ficha de …»), porque ya no hay botón
          «Abrir». Un clic fantasma tras soltar lo descarta `onOpen`. */}
      <button
        type="button"
        aria-label={`Abrir ficha de ${nombre}`}
        onClick={onOpen}
        className="studio-link-quiet"
        style={{
          gridRow: "1 / span 2",
          gridColumn: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minWidth: 0,
          minHeight: 32,
          textAlign: "left",
          background: "none",
          border: 0,
          padding: 0,
          cursor: "pointer",
          color: "inherit",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "var(--s-1)", minWidth: 0 }}>
          {canal && <CanalLogo canal={canal} />}
          {/* SDD-0676: los otros canales vinculados a la ficha del cliente. */}
          {(t.canalesExtra ?? []).map((c) => (
            <CanalLogo key={c} canal={c} />
          ))}
          <span
            style={{
              minWidth: 0,
              font: "600 13px/1.3 var(--f-sans)",
              color: t.nombre ? "var(--ink)" : "var(--ink-soft)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {nombre}
          </span>
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-1)",
            minWidth: 0,
            font: "500 11px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {[segmento, t.shippingMark, t.asesorNombre ?? "Sin dueño"].filter(Boolean).join(" · ")}
          </span>
          <span aria-hidden>·</span>
          <span
            title={dias == null ? "Sin fecha" : `${dias} días en esta etapa`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--s-1)",
              font: "700 11px/1 var(--f-mono)",
              color: atencion ? "var(--ink)" : "var(--ink-soft)",
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
        </span>
      </button>

      <div
        style={{
          gridRow: "1 / span 2",
          gridColumn: 2,
          display: "flex",
          alignItems: "center",
          gap: "var(--s-1)",
        }}
      >
        {enCurso ? (
          <span role="status" style={{ font: "600 11px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
            Moviendo…
          </span>
        ) : (
          <ActionMenu items={acciones} ariaLabel={`Acciones de ${nombre}`} align="end" size="sm" />
        )}
      </div>

      {extras && (
        <div
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            alignItems: "center",
            gap: "var(--s-1)",
            flexWrap: "wrap",
            marginTop: "var(--s-1)",
            font: "500 11px/1.35 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
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
          {t.origen && (
            <span>
              {t.origen.vuelta ? "Volvió de Clientes" : "Vino de Leads"} ·{" "}
              {nombreEtapa(etapas, t.origen.tablero, t.origen.etapa)}
            </span>
          )}
        </div>
      )}
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
