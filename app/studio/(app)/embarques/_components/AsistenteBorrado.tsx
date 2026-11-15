"use client";

/**
 * SDD-0560 · Asistente de borrado de un embarque.
 *
 * Cuando un embarque no se puede eliminar, este panel le muestra a quien borra
 * (admin) el plan en orden: primero lo que depende del embarque, al final el
 * embarque. Un paso a la vez:
 *
 *   · el paso siguiente tiene su botón; los demás esperan su turno;
 *   · los pasos del asistente piden confirmación (y motivo si son R3) en un
 *     `ConfirmDialog` y se ejecutan con la acción del módulo dueño;
 *   · los pasos de otro módulo abren ese módulo en otra pestaña y se vuelve a
 *     revisar el plan al terminar;
 *   · si algo no se puede resolver, el panel lo explica y no ofrece nada.
 *
 * El plan lo calcula el servidor, también antes de cada paso: si cambió (otra
 * persona resolvió o agregó algo), el paso no se ejecuta y el panel muestra el
 * plan nuevo.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import type { Bloqueo, Enlace, Paso, PasoAsistente, PlanBorrado } from "@/lib/studio/borrado/asistente";
import { ejecutarPasoDeBorradoAction, leerPlanDeBorradoAction } from "../actions";

const SIN_RESPUESTA =
  "No se pudo confirmar el paso. Vuelve a revisar el plan para ver cómo quedó.";
const SIN_LECTURA = "No se pudo revisar qué depende de este embarque. Vuelve a intentar en un momento.";

const MENSAJE_SIN_PASOS: Record<"no_disponible" | "no_encontrado" | "ya_eliminado", string> = {
  no_disponible: SIN_LECTURA,
  no_encontrado: "Este embarque ya no existe o no tienes acceso a él. Recarga la lista.",
  ya_eliminado: "Este embarque ya estaba eliminado. Recarga la lista.",
};

type Carga =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "lista"; plan: PlanBorrado };

export function AsistenteBorrado({
  shipmentId,
  shipmentCode,
  onClose,
  onEliminado,
}: {
  shipmentId: string;
  shipmentCode: string;
  onClose: () => void;
  /** El último paso eliminó el embarque. Recibe el texto de lo hecho. */
  onEliminado: (hecho: string) => void;
}) {
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });
  const [hechos, setHechos] = useState<string[]>([]);
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorPanel, setErrorPanel] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<PasoAsistente | null>(null);
  const [errorDialogo, setErrorDialogo] = useState<string | undefined>(undefined);
  const [revisando, startRevision] = useTransition();
  const [ejecutando, startEjecucion] = useTransition();
  // El efecto vuelve a marcar el montaje: en desarrollo, StrictMode monta,
  // desmonta y vuelve a montar, y sin esto `montado` quedaba en false y el
  // panel descartaba todo lo que respondía el servidor.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // Lo que se actualiza después de un `await` ya no cuenta como parte de la
  // transición (React 19) y se pintaría un render antes de que `revisando` o
  // `ejecutando` vuelvan a false: el plan nuevo junto a «Revisando…», o el
  // error con el botón todavía en «Procesando…». Por eso va dentro de otra
  // llamada a la transición: el resultado y el fin de la espera llegan juntos.
  const revisar = useCallback(() => {
    setErrorPanel(null);
    startRevision(async () => {
      try {
        const r = await leerPlanDeBorradoAction(shipmentId);
        if (!montado.current) return;
        startRevision(() => {
          if (r.ok) setCarga({ estado: "lista", plan: r.plan });
          else setCarga({ estado: "error", mensaje: r.error });
        });
      } catch {
        if (montado.current) startRevision(() => setCarga({ estado: "error", mensaje: SIN_LECTURA }));
      }
    });
  }, [shipmentId]);

  // La primera lectura, al abrir. Las siguientes las pide «Volver a revisar».
  useEffect(() => {
    let vigente = true;
    leerPlanDeBorradoAction(shipmentId)
      .then((r) => {
        if (!vigente) return;
        setCarga(r.ok ? { estado: "lista", plan: r.plan } : { estado: "error", mensaje: r.error });
      })
      .catch(() => {
        if (vigente) setCarga({ estado: "error", mensaje: SIN_LECTURA });
      });
    return () => {
      vigente = false;
    };
  }, [shipmentId]);

  const cargando = carga.estado === "cargando";
  const pending = revisando || ejecutando || cargando;

  const confirmar = (paso: PasoAsistente, motivo: string) => {
    setErrorDialogo(undefined);
    startEjecucion(async () => {
      try {
        const r = await ejecutarPasoDeBorradoAction(shipmentId, paso.clave, motivo);
        if (!montado.current) return;
        // Como en `revisar`: el resultado entra en la transición.
        startEjecucion(() => {
          if (r.ok) {
            setConfirmando(null);
            if (r.eliminado) {
              onEliminado(r.hecho);
              return;
            }
            setHechos((prev) => [...prev, r.hecho]);
            setAnuncio(r.hecho);
            setAviso(r.aviso ?? null);
            if (r.plan) setCarga({ estado: "lista", plan: r.plan });
            return;
          }
          // Si el paso sigue siendo el siguiente, el error queda en el diálogo
          // (motivo inválido, el módulo lo rechazó) y se puede reintentar. Si el
          // plan cambió, el diálogo se cierra y el panel muestra el plan nuevo.
          const sigue = r.plan?.estado === "en_curso" && r.plan.siguiente.clave === paso.clave;
          if (r.plan) setCarga({ estado: "lista", plan: r.plan });
          if (sigue) {
            setErrorDialogo(r.error);
          } else {
            setConfirmando(null);
            setAnuncio(null);
            setErrorPanel(r.error);
          }
        });
      } catch {
        if (montado.current) startEjecucion(() => setErrorDialogo(SIN_RESPUESTA));
      }
    });
  };

  return (
    <DrawerShell
      title={`Eliminar ${shipmentCode} paso a paso`}
      subtitle="Un paso a la vez. Cada paso usa la acción de su módulo y queda registrado."
      onClose={onClose}
      pending={ejecutando}
      width={560}
    >
      <div
        aria-busy={pending}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "18px 22px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-4)",
        }}
      >
        {hechos.length > 0 && <YaHecho hechos={hechos} />}

        {/* Un solo canal de anuncio para lo que acaba de pasar (AVS-01). */}
        <p role="status" style={{ margin: 0, font: "600 12.5px/1.45 var(--f-sans)", color: "var(--ink)" }}>
          {revisando || cargando ? "Revisando qué depende del embarque…" : anuncio ? `Listo: ${anuncio}` : ""}
        </p>

        {aviso && <Nota tono="warning">{aviso}</Nota>}
        {/* Advertencia y error son alerta dentro de <Aviso> (SDD-0628): ver `Nota`. */}
        {errorPanel && <Nota tono="danger">{errorPanel}</Nota>}

        {carga.estado === "error" && (
          <SinPasos mensaje={carga.mensaje} onRevisar={revisar} pending={pending} />
        )}

        {carga.estado === "lista" && (
          <Contenido
            plan={carga.plan}
            pending={pending}
            onRevisar={revisar}
            onPaso={(paso) => {
              setErrorDialogo(undefined);
              setConfirmando(paso);
            }}
          />
        )}
      </div>

      <footer
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "flex-start",
          gap: 10,
          background: "var(--bg-surface)",
          flexShrink: 0,
        }}
      >
        <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" onClick={onClose} disabled={ejecutando}>
          Cerrar
        </button>
      </footer>

      <ConfirmDialog
        open={confirmando !== null}
        danger
        reason={confirmando?.pideMotivo ?? false}
        reasonRequired={confirmando?.pideMotivo ?? false}
        reasonLabel="Motivo (obligatorio, sin datos personales)"
        reasonPlaceholder="p. ej. Embarque de prueba"
        title={confirmando ? `¿${confirmando.titulo}?` : ""}
        message={confirmando ? `${confirmando.queEs} ${confirmando.consecuencia}` : ""}
        confirmLabel={confirmando?.confirmar ?? "Confirmar"}
        cancelLabel="Cancelar"
        pending={ejecutando}
        error={errorDialogo}
        onCancel={() => {
          if (ejecutando) return;
          setConfirmando(null);
          setErrorDialogo(undefined);
        }}
        onConfirm={(motivo) => {
          if (confirmando) confirmar(confirmando, motivo);
        }}
      />
    </DrawerShell>
  );
}

// ─── Piezas ──────────────────────────────────────────────────────────────────

function Contenido({
  plan,
  pending,
  onRevisar,
  onPaso,
}: {
  plan: PlanBorrado;
  pending: boolean;
  onRevisar: () => void;
  onPaso: (paso: PasoAsistente) => void;
}) {
  if (plan.estado === "no_disponible" || plan.estado === "no_encontrado" || plan.estado === "ya_eliminado") {
    return <SinPasos mensaje={MENSAJE_SIN_PASOS[plan.estado]} onRevisar={onRevisar} pending={pending} />;
  }
  if (plan.estado === "bloqueado") {
    return <PlanBloqueado bloqueos={plan.bloqueos} onRevisar={onRevisar} pending={pending} />;
  }

  const total = plan.pasos.length;
  return (
    <section aria-labelledby="asistente-plan-titulo" style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      <h3 id="asistente-plan-titulo" style={{ margin: 0, font: "700 14px/1.3 var(--f-sans)", color: "var(--ink)" }}>
        {total === 1 ? "Ya no queda nada que lo bloquee" : `Faltan ${total} pasos`}
      </h3>
      <p style={{ margin: 0, font: "400 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
        {total === 1
          ? "Solo falta eliminar el embarque."
          : "Se hacen en orden: primero lo que depende del embarque y al final el embarque. Cada paso se confirma por separado."}
      </p>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
        {plan.pasos.map((paso, i) => (
          <TarjetaPaso
            key={paso.clave}
            paso={paso}
            numero={i + 1}
            actual={paso.clave === plan.siguiente.clave}
            pending={pending}
            onPaso={onPaso}
            onRevisar={onRevisar}
          />
        ))}
      </ol>
    </section>
  );
}

function TarjetaPaso({
  paso,
  numero,
  actual,
  pending,
  onPaso,
  onRevisar,
}: {
  paso: Paso;
  numero: number;
  actual: boolean;
  pending: boolean;
  onPaso: (paso: PasoAsistente) => void;
  onRevisar: () => void;
}) {
  const tituloId = `asistente-paso-${numero}`;
  return (
    <li
      aria-current={actual ? "step" : undefined}
      style={{
        border: `1px solid ${actual ? "var(--ink)" : "var(--border)"}`,
        borderRadius: "var(--r-md)",
        padding: "var(--s-3) var(--s-4)",
        background: actual ? "var(--bg-surface)" : "var(--bg-elevated)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--s-2)", flexWrap: "wrap" }}>
        <span style={{ font: "700 11px/1 var(--f-mono)", color: "var(--ink-soft)" }}>Paso {numero}</span>
        <h4 id={tituloId} style={{ margin: 0, font: "700 13.5px/1.35 var(--f-sans)", color: "var(--ink)" }}>
          {paso.titulo}
        </h4>
        <Badge tone="neutral" size="xs">
          {paso.tipo === "modulo" ? `En ${paso.modulo}` : paso.modulo}
        </Badge>
      </div>
      <p style={{ margin: 0, font: "400 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>{paso.queEs}</p>
      <p style={{ margin: 0, font: "400 12.5px/1.5 var(--f-sans)", color: "var(--ink)" }}>
        <strong>Qué pasa:</strong> {paso.consecuencia}
      </p>

      {actual ? (
        <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap", marginTop: "var(--s-1)" }}>
          {paso.tipo === "modulo" ? (
            <>
              {paso.enlace && <EnlaceNuevaPestana enlace={paso.enlace} />}
              <button type="button" className="studio-btn studio-btn-primary studio-btn-sm" onClick={onRevisar} disabled={pending}>
                Ya lo hice: revisar de nuevo
              </button>
            </>
          ) : (
            <>
              {paso.enlace && <EnlaceNuevaPestana enlace={paso.enlace} />}
              <button
                type="button"
                className="studio-btn studio-btn-danger studio-btn-sm"
                onClick={() => onPaso(paso)}
                disabled={pending}
              >
                {paso.boton}
              </button>
            </>
          )}
        </div>
      ) : (
        <p style={{ margin: 0, font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          Se habilita cuando termines el paso anterior.
        </p>
      )}
    </li>
  );
}

function PlanBloqueado({ bloqueos, onRevisar, pending }: { bloqueos: Bloqueo[]; onRevisar: () => void; pending: boolean }) {
  return (
    <section aria-labelledby="asistente-bloqueado-titulo" style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      <h3 id="asistente-bloqueado-titulo" style={{ margin: 0, font: "700 14px/1.3 var(--f-sans)", color: "var(--ink)" }}>
        No se puede eliminar por ahora
      </h3>
      <p style={{ margin: 0, font: "400 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
        Esto lo impide y el asistente no lo puede resolver. Mientras siga así, no te ofrece anular ni eliminar
        nada más: no tendría sentido anular una factura si el embarque igual no se va a poder eliminar.
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
        {bloqueos.map((b) => (
          <li
            key={b.clave}
            style={{
              borderTop: "1px solid var(--border)",
              padding: "var(--s-2) 0 0",
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-1)",
            }}
          >
            <strong style={{ font: "700 13px/1.35 var(--f-sans)", color: "var(--ink)" }}>{b.titulo}</strong>
            <span style={{ font: "400 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>{b.detalle}</span>
            {b.enlace && (
              <span>
                <EnlaceNuevaPestana enlace={b.enlace} />
              </span>
            )}
          </li>
        ))}
      </ul>
      <div>
        <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" onClick={onRevisar} disabled={pending}>
          Volver a revisar
        </button>
      </div>
    </section>
  );
}

function SinPasos({ mensaje, onRevisar, pending }: { mensaje: string; onRevisar: () => void; pending: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)", alignItems: "flex-start" }}>
      <Nota tono="warning">{mensaje}</Nota>
      <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" onClick={onRevisar} disabled={pending}>
        Volver a revisar
      </button>
    </div>
  );
}

function YaHecho({ hechos }: { hechos: string[] }) {
  return (
    <section aria-labelledby="asistente-hecho-titulo">
      <h3 id="asistente-hecho-titulo" className="studio-eyebrow" style={{ margin: "0 0 var(--s-2)", color: "var(--ink-soft)" }}>
        Ya hiciste
      </h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
        {hechos.map((h, i) => (
          <li key={`${i}-${h}`} style={{ display: "flex", gap: "var(--s-2)", alignItems: "center", font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink)" }}>
            <span aria-hidden style={{ color: "var(--success)", display: "inline-flex" }}>
              {Icon.check(13)}
            </span>
            {h}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * SDD-0603 · tramo 5c: la nota es el aviso canónico. Las dos son alerta
 * (`urgente`): la advertencia sale de un paso recién ejecutado o de una
 * lectura que falló. Así el panel tiene una sola región `status`, la del
 * anuncio de arriba, y no dos que hablen a la vez.
 */
function Nota({ tono, children }: { tono: "warning" | "danger"; children: React.ReactNode }) {
  return (
    <Aviso tono={tono === "danger" ? "error" : "atencion"} urgente compacto>
      {children}
    </Aviso>
  );
}

/** LNK-01: consultar el módulo no le cuesta a Sam el lugar donde estaba. */
function EnlaceNuevaPestana({ enlace }: { enlace: Enlace }) {
  return (
    <a
      href={enlace.href}
      target="_blank"
      rel="noopener noreferrer"
      className="studio-btn studio-btn-ghost studio-btn-sm"
    >
      {enlace.etiqueta}
      <span aria-hidden style={{ display: "inline-flex" }}>
        {Icon.external(12)}
      </span>
      <span className="studio-sr-only"> (se abre en otra pestaña)</span>
    </a>
  );
}
