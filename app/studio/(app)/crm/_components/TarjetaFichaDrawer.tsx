"use client";

/**
 * Ficha de la tarjeta del CRM propio (SDD-0587 · paso 6.3).
 *
 * Es el `LeadDrawer` de Kommo llevado a la tarjeta propia: mismos verbos de
 * nota, tarea y asesor, pero sin cola ni «en camino», porque Studio es el
 * maestro y escribe directo. Suma lo que el drawer de Kommo no tenía: el
 * historial de etapas, la fuente con su atribución y los dos asesores de D9
 * por separado —el dueño de la tarjeta, que se cambia aquí, y quien contesta
 * el chat, que se cambia en Chatwoot y aquí solo se lee—.
 *
 * Se lee al abrir (`cargarFichaTarjetaAction`) y se vuelve a leer después de
 * cada cambio, para que lo que se ve sea lo que quedó guardado.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import {
  ESTADO_CHAT_LABEL,
  ORIGEN_MOVIMIENTO_LABEL,
  fechaCorta,
  type CrmFichaTarjeta,
} from "@/lib/studio/crm-ficha";
import { FUENTE_LABEL, nombreEtapa, type CrmEtapa } from "@/lib/studio/crm-tablero";
import {
  agregarNotaTarjetaAction,
  agregarTareaTarjetaAction,
  cambiarDuenoTarjetaAction,
  cargarFichaTarjetaAction,
  completarTareaTarjetaAction,
} from "../tarjeta-actions";

type Estado =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | { fase: "lista"; ficha: CrmFichaTarjeta };

export function TarjetaFichaDrawer({
  tarjetaId,
  etapas,
  canEdit,
  onClose,
  onCambio,
}: {
  tarjetaId: string;
  etapas: CrmEtapa[];
  canEdit: boolean;
  onClose: () => void;
  /** Algo cambió en la base: el tablero se vuelve a leer. */
  onCambio: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    void cargarFichaTarjetaAction(tarjetaId).then((res) => {
      if (!vivo) return;
      setEstado("error" in res ? { fase: "error", mensaje: res.error } : { fase: "lista", ficha: res.ficha });
    });
    return () => {
      vivo = false;
    };
  }, [tarjetaId, version]);

  const recargar = useCallback(() => {
    setVersion((v) => v + 1);
    onCambio();
  }, [onCambio]);

  const titulo =
    estado.fase === "lista" ? (estado.ficha.nombre ?? "Lead sin nombre") : "Ficha de la tarjeta";

  return (
    <DrawerShell
      title={titulo}
      subtitle={
        estado.fase === "lista" && estado.ficha.shippingMark
          ? `Shipping Mark ${estado.ficha.shippingMark}`
          : "Tarjeta del CRM propio"
      }
      onClose={onClose}
      pending={false}
      width={600}
    >
      <div style={{ padding: "var(--s-5) var(--s-6)", overflowY: "auto", flex: 1 }}>
        {estado.fase === "cargando" && (
          <p role="status" style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            Cargando la ficha…
          </p>
        )}
        {estado.fase === "error" && (
          // SDD-0603 tramo 5d: el error de cargar el panel recién abierto es
          // un `Aviso` de error (alert), con «Reintentar» como su acción.
          <Aviso
            tono="error"
            accion={{
              etiqueta: "Reintentar",
              onClick: () => {
                setEstado({ fase: "cargando" });
                setVersion((v) => v + 1);
              },
            }}
          >
            {estado.mensaje}
          </Aviso>
        )}
        {estado.fase === "lista" && (
          <Ficha ficha={estado.ficha} etapas={etapas} canEdit={canEdit} onCambio={recargar} />
        )}
      </div>
    </DrawerShell>
  );
}

function Ficha({
  ficha: f,
  etapas,
  canEdit,
  onCambio,
}: {
  ficha: CrmFichaTarjeta;
  etapas: CrmEtapa[];
  canEdit: boolean;
  onCambio: () => void;
}) {
  const utm = Object.entries(f.utm).filter(([, v]) => v);
  // Un solo reloj por lectura de la ficha: se fija al montar, no en cada render.
  const [ahoraMs] = useState(() => Date.now());

  return (
    <>
      <Seccion titulo="Resumen">
        <Dato etiqueta="Etapa en Leads" valor={nombreEtapa(etapas, "leads", f.etapaLeads)} />
        <Dato etiqueta="Etapa en Clientes" valor={nombreEtapa(etapas, "clientes", f.etapaClientes)} />
        {f.motivoPerdida && <Dato etiqueta="Motivo de cierre" valor={f.motivoPerdida} />}
        <Dato
          etiqueta="Fuente"
          valor={`${FUENTE_LABEL[f.fuente] ?? f.fuente}${f.fuenteDetalle ? ` · ${f.fuenteDetalle}` : ""}`}
        />
        {utm.length > 0 && (
          <Dato etiqueta="Campaña" valor={utm.map(([k, v]) => `${k}: ${v}`).join(" · ")} />
        )}
        <Dato etiqueta="Creada" valor={fechaCorta(f.creadaAt)} />
        <Dato etiqueta="Última actividad" valor={fechaCorta(f.ultimaActividadAt)} />
        {f.shippingMark ? (
          <p style={{ margin: "var(--s-2) 0 0" }}>
            <Link href={`/studio/clientes/${f.shippingMark}`} className="studio-link-quiet">
              Ver la ficha del cliente →
            </Link>
          </p>
        ) : (
          !f.conFicha && (
            <p style={NOTA_SUAVE}>Este lead todavía no tiene ficha de cliente.</p>
          )
        )}
      </Seccion>

      <Seccion titulo="Asesores">
        <Dueno ficha={f} canEdit={canEdit} onCambio={onCambio} />
        <div style={{ marginTop: "var(--s-4)" }}>
          <span className="studio-label">Quién contesta el chat (Chatwoot)</span>
          <p style={{ margin: 0, font: "500 13px/1.4 var(--f-sans)", color: "var(--ink)" }}>
            {f.chat == null
              ? "Sin conversación en Chatwoot ligada a esta ficha."
              : f.chat.asignado
                ? f.chat.asignado
                : f.chat.sinVincular
                  ? "Un agente de Chatwoot sin usuario de Studio vinculado"
                  : "Sin asignar"}
          </p>
          {f.chat && (
            <p style={NOTA_SUAVE}>
              Conversación {(ESTADO_CHAT_LABEL[f.chat.estado] ?? f.chat.estado).toLowerCase()}
              {f.chat.ultimaActividadAt ? ` · ${fechaCorta(f.chat.ultimaActividadAt)}` : ""}. Se
              cambia en Chatwoot; Studio no lo toca.
            </p>
          )}
        </div>
      </Seccion>

      <Seccion titulo={`Tareas (${f.tareas.filter((k) => !k.completadaAt).length} abiertas)`}>
        {canEdit && <NuevaTarea ficha={f} onCambio={onCambio} />}
        {f.tareas.length === 0 ? (
          <p style={NOTA_SUAVE}>Sin tareas.</p>
        ) : (
          <ul style={LISTA}>
            {f.tareas.map((k) => {
              const vencida = !k.completadaAt && k.venceAt != null && Date.parse(k.venceAt) < ahoraMs;
              return (
                <li key={k.id} style={ITEM}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        font: "500 13px/1.4 var(--f-sans)",
                        color: k.completadaAt ? "var(--ink-soft)" : "var(--ink)",
                        textDecoration: k.completadaAt ? "line-through" : undefined,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {k.texto}
                    </p>
                    <p style={NOTA_SUAVE}>
                      {k.venceAt ? `Vence ${fechaCorta(k.venceAt)}` : "Sin fecha"}
                      {k.asignado ? ` · ${k.asignado}` : ""}
                      {k.origen !== "manual" ? ` · ${ORIGEN_MOVIMIENTO_LABEL[k.origen] ?? k.origen}` : ""}
                    </p>
                  </div>
                  {vencida && (
                    <Badge tone="danger" size="sm">
                      Vencida
                    </Badge>
                  )}
                  {k.completadaAt ? (
                    <Badge tone="success" size="sm">
                      Hecha
                    </Badge>
                  ) : (
                    canEdit && (
                      <ActionButton
                        variant="ghost"
                        size="xs"
                        idleLabel="Marcar hecha"
                        loadingLabel="Marcando…"
                        successLabel={null}
                        onAction={() => completarTareaTarjetaAction(k.id)}
                        onSuccess={onCambio}
                      />
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Notas">
        {canEdit && <NuevaNota tarjetaId={f.id} onCambio={onCambio} />}
        {f.notas.length === 0 ? (
          <p style={NOTA_SUAVE}>Sin notas. Las notas del chat siguen en Chatwoot.</p>
        ) : (
          <ul style={LISTA}>
            {f.notas.map((n) => (
              <li key={n.id} style={{ ...ITEM, display: "block" }}>
                <p
                  style={{
                    margin: 0,
                    font: "400 13px/1.45 var(--f-sans)",
                    color: "var(--ink)",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {n.texto}
                </p>
                <p style={NOTA_SUAVE}>
                  {n.autor ?? "Sistema"} · {fechaCorta(n.creadaAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Historial de etapas">
        {f.historial.length === 0 ? (
          <p style={NOTA_SUAVE}>Todavía no se ha movido de etapa.</p>
        ) : (
          <ol style={LISTA}>
            {f.historial.map((h) => (
              <li key={h.id} style={{ ...ITEM, display: "block" }}>
                <p style={{ margin: 0, font: "500 13px/1.4 var(--f-sans)", color: "var(--ink)" }}>
                  {h.tablero === "leads" ? "Leads" : "Clientes"}:{" "}
                  {h.de ? `${nombreEtapa(etapas, h.tablero, h.de)} → ` : ""}
                  {nombreEtapa(etapas, h.tablero, h.a)}
                </p>
                <p style={NOTA_SUAVE}>
                  {ORIGEN_MOVIMIENTO_LABEL[h.origen] ?? h.origen}
                  {h.actor ? ` · ${h.actor}` : ""} · {fechaCorta(h.ocurrioAt)}
                  {h.motivo ? ` · Motivo: ${h.motivo}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Seccion>
    </>
  );
}

function Dueno({
  ficha: f,
  canEdit,
  onCambio,
}: {
  ficha: CrmFichaTarjeta;
  canEdit: boolean;
  onCambio: () => void;
}) {
  const [elegido, setElegido] = useState(f.dueno.id ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <label className="studio-label" htmlFor="crm-ficha-dueno">
        Dueño de la tarjeta (Studio)
      </label>
      {canEdit ? (
        <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "center", flexWrap: "wrap" }}>
          <select
            id="crm-ficha-dueno"
            className="studio-input"
            value={elegido}
            onChange={(e) => setElegido(e.target.value)}
            style={{ flex: "1 1 220px" }}
          >
            <option value="">Sin dueño</option>
            {f.asesores.map((a) => (
              <option key={a.userId} value={a.userId}>
                {a.nombre}
              </option>
            ))}
            {f.dueno.id && !f.asesores.some((a) => a.userId === f.dueno.id) && (
              <option value={f.dueno.id}>{f.dueno.nombre ?? "Usuario fuera del CRM"}</option>
            )}
          </select>
          <ActionButton
            variant="ghost"
            size="sm"
            idleLabel="Guardar dueño"
            loadingLabel="Guardando…"
            successLabel="Guardado"
            disabled={elegido === (f.dueno.id ?? "")}
            onAction={() => {
              setError(null);
              return cambiarDuenoTarjetaAction(f.id, elegido || null);
            }}
            onSuccess={onCambio}
            onError={setError}
          />
        </div>
      ) : (
        <p id="crm-ficha-dueno" style={{ margin: 0, font: "500 13px/1.4 var(--f-sans)", color: "var(--ink)" }}>
          {f.dueno.nombre ?? "Sin dueño"}
        </p>
      )}
      {error && <ErrorCampo mensaje={error} />}
      <p style={NOTA_SUAVE}>Es quien responde por el lead en Studio. No cambia quién contesta el chat.</p>
    </div>
  );
}

function NuevaTarea({ ficha: f, onCambio }: { ficha: CrmFichaTarjeta; onCambio: () => void }) {
  const [texto, setTexto] = useState("");
  const [vence, setVence] = useState(() => enDias(2));
  const [responsable, setResponsable] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ marginBottom: "var(--s-3)" }}>
      <label className="studio-label" htmlFor="crm-ficha-tarea">
        Nueva tarea
      </label>
      <input
        id="crm-ficha-tarea"
        type="text"
        className="studio-input"
        value={texto}
        maxLength={1000}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Volver a escribirle, mandar el estimado…"
      />
      <div style={{ display: "flex", gap: "var(--s-2)", marginTop: "var(--s-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "0 1 160px" }}>
          <label className="studio-label" htmlFor="crm-ficha-tarea-vence">
            Vence el
          </label>
          <input
            id="crm-ficha-tarea-vence"
            type="date"
            className="studio-input"
            value={vence}
            min={enDias(0)}
            onChange={(e) => setVence(e.target.value)}
          />
        </div>
        <div style={{ flex: "1 1 180px" }}>
          <label className="studio-label" htmlFor="crm-ficha-tarea-resp">
            Responsable
          </label>
          <select
            id="crm-ficha-tarea-resp"
            className="studio-input"
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
          >
            <option value="">Sin responsable</option>
            {f.asesores.map((a) => (
              <option key={a.userId} value={a.userId}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
        <ActionButton
          variant="ghost"
          size="sm"
          idleLabel="Agregar tarea"
          loadingLabel="Agregando…"
          successLabel="Agregada"
          disabled={!texto.trim()}
          onAction={async () => {
            setError(null);
            const res = await agregarTareaTarjetaAction(f.id, texto, vence || null, responsable || null);
            if (!res.error) setTexto("");
            return res;
          }}
          onSuccess={onCambio}
          onError={setError}
        />
      </div>
      <p style={NOTA_SUAVE}>Vence a las 9:00 de la mañana, hora de Venezuela.</p>
      {error && <ErrorCampo mensaje={error} />}
    </div>
  );
}

function NuevaNota({ tarjetaId, onCambio }: { tarjetaId: string; onCambio: () => void }) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ marginBottom: "var(--s-3)" }}>
      <label className="studio-label" htmlFor="crm-ficha-nota">
        Nueva nota
      </label>
      <textarea
        id="crm-ficha-nota"
        className="studio-input"
        rows={3}
        maxLength={4000}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Qué pasó en el contacto…"
        style={{ resize: "vertical", minHeight: 72 }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--s-2)" }}>
        <ActionButton
          variant="ghost"
          size="sm"
          idleLabel="Agregar nota"
          loadingLabel="Guardando…"
          successLabel="Guardada"
          disabled={!texto.trim()}
          onAction={async () => {
            setError(null);
            const res = await agregarNotaTarjetaAction(tarjetaId, texto);
            if (!res.error) setTexto("");
            return res;
          }}
          onSuccess={onCambio}
          onError={setError}
        />
      </div>
      <p style={NOTA_SUAVE}>Las notas no se pueden editar ni borrar. No pegues datos que no hagan falta.</p>
      {error && <ErrorCampo mensaje={error} />}
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--s-6)" }}>
      <h3
        className="studio-eyebrow"
        style={{ margin: "0 0 var(--s-3)", font: "700 10.5px/1 var(--f-sans)", color: "var(--ink-soft)" }}
      >
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div style={{ display: "flex", gap: "var(--s-3)", padding: "var(--s-1) 0", font: "400 13px/1.4 var(--f-sans)" }}>
      <span style={{ flex: "0 0 140px", color: "var(--ink-soft)" }}>{etiqueta}</span>
      <span style={{ flex: 1, minWidth: 0, color: "var(--ink)", overflowWrap: "anywhere" }}>{valor}</span>
    </div>
  );
}

function ErrorCampo({ mensaje }: { mensaje: string }) {
  return <ErrorAlert state={{ error: mensaje }} compact />;
}

/** YYYY-MM-DD de hoy + n días, en la zona del navegador (la del asesor). */
function enDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

const NOTA_SUAVE = {
  margin: "var(--s-1) 0 0",
  font: "400 11.5px/1.4 var(--f-sans)",
  color: "var(--ink-soft)",
} as const;

const LISTA = { listStyle: "none", margin: 0, padding: 0 } as const;

const ITEM = {
  display: "flex",
  alignItems: "center",
  gap: "var(--s-3)",
  padding: "var(--s-3) 0",
  borderTop: "1px solid var(--border)",
} as const;
