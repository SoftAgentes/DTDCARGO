"use client";

/**
 * Ficha 360° del empleado (SDD-0652). Vista con pestañas. La fase 2 suma la
 * foto, el enlace con un usuario, «Mostrar» la cuenta y los eventos de la
 * línea de tiempo; cada acción vive en su componente y pasa por el servidor.
 *
 * Todo lo que llega aquí ya pasó por el servidor: el control de rol
 * (`getFichaEmpleadoAccess`), la cuenta enmascarada y el corte de lo que es
 * solo de admin. A Contabilidad no le llega el correo de acceso, ni el rol, ni
 * el último ingreso, ni la pestaña Acceso: no es CSS, es que no viaja.
 *
 * Cada bloque trae su resultado: sin movimientos, con datos o «No se pudo
 * cargar». Un error nunca se pinta como «no hay» (§5.3).
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import {
  bankAccountTypeLabel,
  employeeStatusLabel,
  employeeStatusTone,
  type EmployeeEditView,
} from "@/lib/studio/nomina/employee-types";
import type { Position } from "@/lib/studio/nomina/position-types";
import {
  correosDistintos,
  etiquetaAcceso,
  fmtUsdFicha,
  resumenAsistencia,
  saldoPrestamo,
  saldoPrestamos,
  type AccesoStudio,
  type AsistenciaDia,
  type Bloque,
  type CandidatoEnlace,
  type Hecho,
  type NivelFicha,
  type PrestamoFicha,
} from "@/lib/studio/nomina/ficha-empleado";
import type {
  AmonestacionFicha,
  ComunicacionFicha,
  FiniquitoFicha,
  ReciboFicha,
} from "@/lib/studio/nomina/ficha-empleado-queries";
import { ROLE_LABELS } from "@/lib/studio/user-types";
import { ActividadAcceso } from "@/app/studio/(app)/usuarios/_components/acceso/ActividadAcceso";
import { EmpleadoDrawer } from "@/app/studio/(app)/nomina/_components/EmpleadoDrawer";
import { EnlazarConUsuario, ID_MOTIVO_ENLACE, QuitarEnlace } from "./EnlaceUsuario";
import { FotoEmpleado } from "./FotoEmpleado";
import { MostrarCuenta } from "./MostrarCuenta";
import { ReintentarCarga } from "./ReintentarCarga";
import "./ficha-empleado.css";

export type FichaEmpleadoProps = {
  nivel: NivelFicha;
  employee: EmployeeEditView;
  puesto: string | null;
  acceso: AccesoStudio;
  /** Para el formulario de edición; null si el rol no edita Nómina. */
  positions: Position[] | null;
  mes: { etiqueta: string };
  prestamos: Bloque<PrestamoFicha[]>;
  asistencia: Bloque<AsistenciaDia[]>;
  amonestaciones: Bloque<AmonestacionFicha[]>;
  recibos: Bloque<ReciboFicha[]>;
  finiquitos: Bloque<FiniquitoFicha[]>;
  comunicaciones: Bloque<ComunicacionFicha[]>;
  cambioBanco: Bloque<boolean>;
  /** Línea de tiempo laboral ya unida, más las fuentes que no se pudieron leer. */
  linea: { hechos: Hecho[]; fallaron: string[] };
  /** Nombres de quienes cambiaron el acceso (pestaña Acceso, solo admin). */
  nombres: Record<string, string>;
  /** URL firmada y corta de la foto, o null (sin foto o no se pudo firmar). */
  fotoUrl: string | null;
  /** Solo admin y solo sin enlace: miembros del Studio sin ficha. A Contabilidad no le llega. */
  candidatos: Bloque<CandidatoEnlace[]> | null;
  /** Solo admin: el candidato cuyo correo de acceso es el de contacto de la ficha. Propone, no enlaza. */
  sugerencia: CandidatoEnlace | null;
};

type EnlaceProps = { elegido: string; onElegir: (userId: string) => void };

type Pestana = "resumen" | "linea" | "acceso";

const fechaDia = new Intl.DateTimeFormat("es-VE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const fechaCaracas = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Caracas",
});
const fechaHora = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Caracas",
});

/**
 * Fecha corta. Una fecha sin hora (YYYY-MM-DD) se lee en UTC para no correrse
 * un día; un instante (con hora) se muestra en la hora de Caracas.
 */
function fmtFecha(v: string | null | undefined): string {
  if (!v) return "—";
  const soloDia = v.length <= 10;
  const d = new Date(soloDia ? `${v}T00:00:00Z` : v);
  if (Number.isNaN(d.getTime())) return "—";
  return soloDia ? fechaDia.format(d) : fechaCaracas.format(d);
}

function fmtFechaHora(v: string | null): string {
  if (!v) return "Nunca";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : fechaHora.format(d);
}

const NOMINA = "/studio/nomina";

export function FichaEmpleadoVista(p: FichaEmpleadoProps) {
  const { employee: e, nivel, acceso } = p;
  const esAdmin = nivel === "admin";
  const pestanas: { id: Pestana; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "linea", label: "Línea de tiempo" },
    ...(esAdmin && acceso.nivel === "admin" && acceso.userId ? [{ id: "acceso" as const, label: "Acceso" }] : []),
  ];
  const [pestana, setPestana] = useState<Pestana>("resumen");
  const [editando, setEditando] = useState(false);
  const [elegido, setElegido] = useState("");
  const router = useRouter();
  const titulo = useRef<HTMLHeadingElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  // Al abrir la ficha, el foco va al título (§5.4).
  useEffect(() => {
    titulo.current?.focus();
  }, []);

  const moverConTeclado = (ev: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = pestanas.length;
    let j = -1;
    if (ev.key === "ArrowRight") j = (i + 1) % n;
    else if (ev.key === "ArrowLeft") j = (i - 1 + n) % n;
    else if (ev.key === "Home") j = 0;
    else if (ev.key === "End") j = n - 1;
    if (j < 0) return;
    ev.preventDefault();
    setPestana(pestanas[j]!.id);
    tabs.current[j]?.focus();
  };

  return (
    <div style={{ maxWidth: 1440 }}>
      <Link
        href={NOMINA}
        className="studio-link-quiet"
        style={{ font: "500 12px/1 var(--f-sans)", display: "inline-block", marginBottom: 14 }}
      >
        ← Volver a Empleados
      </Link>

      {/* ── Cabecera ─────────────────────────────────────────── */}
      <header className="ficha-emp-cabecera">
        <FotoEmpleado
          employeeId={e.id}
          nombre={e.full_name}
          fotoUrl={p.fotoUrl}
          puedeCambiar={!!p.positions && e.status !== "egresado"}
        />
        <div className="ficha-emp-cabecera-id">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", flexWrap: "wrap" }}>
            <h1
              ref={titulo}
              tabIndex={-1}
              className="studio-display ficha-emp-titulo"
              style={{ fontSize: 26, margin: 0, color: "var(--ink)" }}
            >
              {e.full_name}
            </h1>
            <Badge tone={employeeStatusTone(e.status)} size="md">
              {employeeStatusLabel(e.status)}
            </Badge>
          </div>
          <div style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 4 }}>
            <span className="ficha-emp-mono">{e.employee_code}</span>
            {(p.puesto || e.position_label || e.department) && (
              <> · {[p.puesto ?? e.position_label, e.department].filter(Boolean).join(" · ")}</>
            )}
          </div>

          {/* Los cinco datos que no se mezclan (§5.1). */}
          <dl className="ficha-emp-cinco">
            <div>
              <dt>Correo de contacto</dt>
              <dd className={e.email ? undefined : "ficha-emp-vacio"}>{e.email ?? "Sin correo"}</dd>
            </div>
            {acceso.nivel === "admin" && acceso.cuentaEnlazada && (
              <div>
                <dt>Correo de acceso</dt>
                <dd className={acceso.correoAcceso ? undefined : "ficha-emp-vacio"}>
                  {acceso.correoAcceso ?? (acceso.error ? "No se pudo leer" : "—")}
                  {correosDistintos(e.email, acceso.correoAcceso) && (
                    <small style={{ display: "block", color: "var(--ink-soft)" }}>Distinto del de contacto</small>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt>Cuenta</dt>
              <dd>{acceso.cuentaEnlazada ? "Tiene cuenta" : "Sin cuenta"}</dd>
            </div>
            {acceso.cuentaEnlazada && (
              <div>
                <dt>Acceso al Studio</dt>
                <dd>{etiquetaAcceso(acceso)}</dd>
              </div>
            )}
            <div>
              <dt>Estado laboral</dt>
              <dd>{employeeStatusLabel(e.status)}</dd>
            </div>
            <div>
              <dt>Teléfono</dt>
              <dd className={e.phone ? "ficha-emp-mono" : "ficha-emp-vacio"}>{e.phone ?? "Sin teléfono"}</dd>
            </div>
          </dl>
        </div>
        {p.positions && (
          <button type="button" className="studio-btn studio-btn-primary" onClick={() => setEditando(true)}>
            Editar
          </button>
        )}
      </header>

      {/* ── Avisos ───────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)", marginBottom: "var(--s-5)" }}>
        {p.cambioBanco.ok && p.cambioBanco.data && (
          <Aviso tono="atencion" titulo="Cambio de banco por revisar">
            Esta persona pidió cambiar su cuenta bancaria. Revísalo en{" "}
            <Link href={`${NOMINA}?tab=solicitudes`} className="studio-link-quiet">
              Solicitudes
            </Link>{" "}
            antes del próximo pago.
          </Aviso>
        )}
        {p.sugerencia && acceso.nivel === "admin" && !acceso.cuentaEnlazada && e.status !== "egresado" && (
          <Aviso
            tono="info"
            titulo="Puede ser la misma persona"
            accion={{
              etiqueta: "Elegir para enlazar",
              onClick: () => {
                // Propone, no enlaza: deja elegida a la persona y el foco en el motivo.
                setElegido(p.sugerencia!.userId);
                setPestana("resumen");
                setTimeout(() => document.getElementById(ID_MOTIVO_ENLACE)?.focus(), 0);
              },
            }}
          >
            El correo de contacto de esta ficha es el correo de acceso de {p.sugerencia.nombre}. Si es la misma persona,
            enlázala con su motivo.
          </Aviso>
        )}
        {acceso.nivel === "admin" && acceso.cuentaEnlazada && acceso.suspendido && (
          <Aviso tono="info" titulo="Acceso al Studio suspendido">
            Su cuenta está suspendida en el Studio. Ojo: eso no le cierra la app del empleado.
          </Aviso>
        )}
      </div>

      {/* ── Pestañas ─────────────────────────────────────────── */}
      <div role="tablist" aria-label="Secciones de la ficha del empleado" className="studio-tabs" style={{ marginBottom: "var(--s-5)" }}>
        {pestanas.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`ficha-emp-tab-${t.id}`}
            aria-selected={pestana === t.id}
            aria-controls={`ficha-emp-panel-${t.id}`}
            data-activa={pestana === t.id ? "true" : undefined}
            tabIndex={pestana === t.id ? 0 : -1}
            className="studio-tab"
            onClick={() => setPestana(t.id)}
            onKeyDown={(ev) => moverConTeclado(ev, i)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {pestana === "resumen" && (
        <div role="tabpanel" id="ficha-emp-panel-resumen" aria-labelledby="ficha-emp-tab-resumen">
          <Resumen {...p} elegido={elegido} onElegir={setElegido} />
        </div>
      )}
      {pestana === "linea" && (
        <div role="tabpanel" id="ficha-emp-panel-linea" aria-labelledby="ficha-emp-tab-linea">
          <LineaDeTiempo linea={p.linea} />
        </div>
      )}
      {pestana === "acceso" && acceso.nivel === "admin" && acceso.userId && (
        <div role="tabpanel" id="ficha-emp-panel-acceso" aria-labelledby="ficha-emp-tab-acceso">
          <section className="ficha-emp-card">
            <ActividadAcceso userId={acceso.userId} nombres={p.nombres} version="" />
          </section>
        </div>
      )}

      {editando && p.positions && (
        <EmpleadoDrawer
          employee={e}
          positions={p.positions.filter((x) => x.active)}
          canManageUsers={false}
          onClose={() => {
            // Al guardar, el panel se cierra: se vuelve a pedir la ficha para que
            // la cabecera y los bloques muestren lo nuevo.
            setEditando(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ── Resumen ─────────────────────────────────────────────────────
function Resumen(p: FichaEmpleadoProps & EnlaceProps) {
  const { employee: e, acceso } = p;
  const conAcceso = acceso.nivel === "admin";
  const saldo = p.prestamos.ok ? saldoPrestamos(p.prestamos.data) : null;
  const asis = p.asistencia.ok ? resumenAsistencia(p.asistencia.data) : null;

  return (
    <>
      <div className="ficha-emp-kpis">
        <KpiCard value={fmtUsdFicha(e.salary_usd)} label="Sueldo mensual" sub="Indexado en USD" />
        <KpiCard
          value={saldo === null ? "—" : fmtUsdFicha(saldo)}
          label="Saldo de préstamos"
          sub={saldo === null ? "No se pudo cargar" : saldo === 0 ? "Sin saldo pendiente" : "Por descontar"}
        />
        <KpiCard
          value={asis === null ? "—" : String(asis.trabajados)}
          label={`Días trabajados en ${p.mes.etiqueta}`}
          sub={
            asis === null
              ? "No se pudo cargar"
              : asis.registrados === 0
                ? "Sin asistencia registrada este mes"
                : `${asis.ausencias} ${asis.ausencias === 1 ? "ausencia" : "ausencias"}`
          }
        />
      </div>

      <div className={conAcceso ? "ficha-emp-grid" : "ficha-emp-grid ficha-emp-grid--sin-acceso"}>
        <div className="ficha-emp-col ficha-emp-col--datos">
          <section className="ficha-emp-card" aria-labelledby="ficha-emp-datos">
            <h2 id="ficha-emp-datos" className="studio-eyebrow" style={{ margin: "0 0 var(--s-3)" }}>
              Datos personales
            </h2>
            <dl style={{ margin: 0 }}>
              <Dato label="Cédula" value={e.national_id} mono />
              <Dato label="Nacimiento" value={e.birth_date ? fmtFecha(e.birth_date) : null} />
              <Dato label="Ingreso" value={e.hire_date ? fmtFecha(e.hire_date) : null} />
            </dl>
          </section>
          <section className="ficha-emp-card" aria-labelledby="ficha-emp-banco">
            <h2 id="ficha-emp-banco" className="studio-eyebrow" style={{ margin: "0 0 var(--s-3)" }}>
              Banco
            </h2>
            <dl style={{ margin: 0 }}>
              <Dato label="Banco" value={e.bank_name} />
              <Dato label="Tipo de cuenta" value={e.bank_account_type ? bankAccountTypeLabel(e.bank_account_type) : null} />
              {!e.bank_account_masked && <Dato label="Cuenta" value={null} mono />}
            </dl>
            {e.bank_account_masked && <MostrarCuenta employeeId={e.id} enmascarada={e.bank_account_masked} />}
          </section>
          {e.notes && (
            <section className="ficha-emp-card" aria-labelledby="ficha-emp-notas">
              <h2 id="ficha-emp-notas" className="studio-eyebrow" style={{ margin: "0 0 var(--s-3)" }}>
                Notas
              </h2>
              <p style={{ margin: 0, font: "400 12.5px/1.5 var(--f-sans)", color: "var(--ink)", whiteSpace: "pre-wrap" }}>
                {e.notes}
              </p>
            </section>
          )}
        </div>

        <div className="ficha-emp-col ficha-emp-col--nomina">
          <Tarjeta titulo="Préstamos" id="prestamos" irA="Préstamos" verTodo={`${NOMINA}?tab=prestamos`}>
            <ListaBloque
              bloque={p.prestamos}
              vacio="No tiene préstamos."
              max={5}
              fila={(l) => (
                <li key={l.id}>
                  <span>
                    {fmtUsdFicha(l.principal_usd)}
                    <small>
                      {fmtFecha(l.granted_on)}
                      {l.concept ? ` · ${l.concept}` : ""}
                    </small>
                  </span>
                  <span style={{ textAlign: "right" }}>
                    {l.status === "activo" ? `Saldo ${fmtUsdFicha(saldoPrestamo(l))}` : l.status === "pagado" ? "Pagado" : "Cancelado"}
                  </span>
                </li>
              )}
            />
          </Tarjeta>
          <Tarjeta titulo="Recibos de nómina" id="recibos" irA="Recibos" verTodo={`${NOMINA}?tab=recibos`}>
            <ListaBloque
              bloque={p.recibos}
              vacio="Todavía no aparece en ningún corte de nómina."
              max={5}
              fila={(r) => (
                <li key={r.id}>
                  <span>
                    {r.period_label}
                    <small>{r.run_status === "anulado" ? "Corte anulado" : `Hasta ${fmtFecha(r.period_end)}`}</small>
                  </span>
                  <span className="ficha-emp-mono">{fmtUsdFicha(r.net_usd)}</span>
                </li>
              )}
            />
          </Tarjeta>
          <Tarjeta titulo="Comunicaciones" id="comunicaciones" irA="Comunicaciones" verTodo={`${NOMINA}?tab=comunicaciones`}>
            <ListaBloque
              bloque={p.comunicaciones}
              vacio="No se le ha enviado ninguna comunicación."
              max={5}
              fila={(c) => (
                <li key={c.id}>
                  <span style={{ minWidth: 0 }}>
                    {c.title}
                    <small>{fmtFecha(c.created_at)}</small>
                  </span>
                  <span style={{ color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
                    {c.requires_ack ? (c.acked_at ? "Acusó recibo" : "Sin acuse") : c.read_at ? "Leída" : "Sin leer"}
                  </span>
                </li>
              )}
            />
          </Tarjeta>
          {/* Amonestaciones y finiquito: compactos, sin destacarlos (§5.2). */}
          <Compacta
            titulo="Amonestaciones"
            bloque={p.amonestaciones}
            texto={(xs) => {
              const vigentes = xs.filter((a) => a.status !== "anulada").length;
              return vigentes === 0 ? "Ninguna vigente" : `${vigentes} vigente${vigentes === 1 ? "" : "s"}`;
            }}
            href={`${NOMINA}?tab=amonestaciones`}
          />
          <Compacta
            titulo="Finiquito"
            bloque={p.finiquitos}
            texto={(xs) => {
              const vivo = xs.find((s) => s.status !== "anulado");
              if (!vivo) return xs.length ? "Solo anulados" : "No tiene";
              return `${vivo.settlement_code} · ${vivo.status === "borrador" ? "borrador" : "confirmado"}`;
            }}
            href={`${NOMINA}?tab=liquidaciones`}
          />
        </div>

        {acceso.nivel === "admin" && (
          <div className="ficha-emp-col ficha-emp-col--acceso">
            <section className="ficha-emp-card" aria-labelledby="ficha-emp-acceso">
              <h2 id="ficha-emp-acceso" className="studio-eyebrow" style={{ margin: "0 0 var(--s-3)" }}>
                Acceso al Studio
              </h2>
              {!acceso.cuentaEnlazada ? (
                p.candidatos ? (
                  <EnlazarConUsuario
                    employeeId={e.id}
                    egresado={e.status === "egresado"}
                    candidatos={p.candidatos}
                    elegido={p.elegido}
                    onElegir={p.onElegir}
                  />
                ) : (
                  <p className="ficha-emp-nota">Sin cuenta enlazada.</p>
                )
              ) : (
                <>
                  {acceso.error && (
                    <Aviso tono="error" compacto>
                      No se pudo leer todo el acceso. Lo que falta aparece como «—».
                    </Aviso>
                  )}
                  <dl style={{ margin: 0 }}>
                    <Dato label="Estado" value={etiquetaAcceso(acceso)} />
                    <Dato label="Rol" value={acceso.rol ? ROLE_LABELS[acceso.rol] : null} />
                    <Dato label="Último ingreso" value={fmtFechaHora(acceso.ultimoIngreso)} />
                  </dl>
                  {acceso.userId && (
                    <Link
                      href={`/studio/usuarios?persona=${encodeURIComponent(acceso.userId)}`}
                      className="studio-link-quiet"
                      style={{ display: "inline-block", marginTop: "var(--s-3)", font: "600 12.5px/1.3 var(--f-sans)" }}
                    >
                      Ver ficha de usuario
                    </Link>
                  )}
                  <div style={{ marginTop: "var(--s-4)", display: "flex", justifyContent: "flex-end" }}>
                    <QuitarEnlace employeeId={e.id} nombre={e.full_name} />
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

// ── Piezas ──────────────────────────────────────────────────────
function Dato({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="ficha-emp-row">
      <dt>{label}</dt>
      <dd className={value ? (mono ? "ficha-emp-mono" : undefined) : "ficha-emp-vacio"}>{value || "—"}</dd>
    </div>
  );
}

/** `irA` lleva a la pestaña de Nómina; no está filtrada por persona, por eso no dice «Ver todo». */
function Tarjeta({ titulo, id, verTodo, irA, children }: { titulo: string; id: string; verTodo: string; irA: string; children: ReactNode }) {
  return (
    <section className="ficha-emp-card" aria-labelledby={`ficha-emp-${id}`}>
      <div className="ficha-emp-card-head">
        <h2 id={`ficha-emp-${id}`} className="studio-eyebrow" style={{ margin: 0 }}>
          {titulo}
        </h2>
        <Link href={verTodo} className="studio-link-quiet" style={{ font: "600 12px/1.2 var(--f-sans)" }}>
          Ir a {irA}
        </Link>
      </div>
      {children}
    </section>
  );
}

function NoSePudo() {
  return <ReintentarCarga compacto>No se pudo cargar este bloque.</ReintentarCarga>;
}

function ListaBloque<T>({
  bloque,
  vacio,
  max,
  fila,
}: {
  bloque: Bloque<T[]>;
  vacio: string;
  max: number;
  fila: (x: T) => ReactNode;
}) {
  if (!bloque.ok) return <NoSePudo />;
  if (bloque.data.length === 0) {
    return <p style={{ margin: 0, font: "400 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>{vacio}</p>;
  }
  return <ul className="ficha-emp-lista">{bloque.data.slice(0, max).map(fila)}</ul>;
}

function Compacta<T>({
  titulo,
  bloque,
  texto,
  href,
}: {
  titulo: string;
  bloque: Bloque<T[]>;
  texto: (xs: T[]) => string;
  href: string;
}) {
  return (
    <section className="ficha-emp-card ficha-emp-card--compacta" aria-label={titulo}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--s-3)", alignItems: "center" }}>
        <span style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>{titulo}</span>
        {bloque.ok && (
          <Link href={href} className="studio-link-quiet" style={{ font: "500 12.5px/1.3 var(--f-sans)" }}>
            {texto(bloque.data)}
          </Link>
        )}
      </div>
      {!bloque.ok && (
        <div style={{ marginTop: "var(--s-2)" }}>
          <NoSePudo />
        </div>
      )}
    </section>
  );
}

const FUENTE: Record<string, string> = {
  prestamos: "préstamos",
  amonestaciones: "amonestaciones",
  recibos: "recibos",
  finiquitos: "finiquitos",
  comunicaciones: "comunicaciones",
  eventos: "cambios registrados (enlace, foto, consultas de la cuenta)",
};

function LineaDeTiempo({ linea }: { linea: FichaEmpleadoProps["linea"] }) {
  return (
    <section className="ficha-emp-card" aria-labelledby="ficha-emp-linea-titulo">
      <h2 id="ficha-emp-linea-titulo" className="studio-eyebrow" style={{ margin: "0 0 var(--s-2)" }}>
        Hechos laborales
      </h2>
      <p style={{ margin: "0 0 var(--s-3)", font: "400 12px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
        Ingreso, préstamos, recibos, comunicaciones, amonestaciones y finiquito, del más reciente al más antiguo. También
        el enlace con su usuario, los cambios de foto y cada consulta de la cuenta completa, desde que se registran. Los
        cambios de sueldo, banco o estado todavía no quedan registrados.
      </p>
      {linea.fallaron.length > 0 && (
        <div style={{ marginBottom: "var(--s-3)" }}>
          <Aviso tono="error" compacto>
            No se pudieron cargar: {linea.fallaron.map((f) => FUENTE[f] ?? f).join(", ")}. Lo de abajo puede estar
            incompleto.
          </Aviso>
        </div>
      )}
      {linea.hechos.length === 0 ? (
        <p style={{ margin: 0, font: "400 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
          Todavía no hay hechos registrados.
        </p>
      ) : (
        <ol className="ficha-emp-linea">
          {linea.hechos.map((h, i) => (
            <li key={`${h.tipo}-${h.fecha}-${i}`}>
              <time dateTime={h.fecha.slice(0, 10)}>{fmtFecha(h.fecha)}</time>
              <div>
                <div style={{ font: "600 12.5px/1.4 var(--f-sans)", color: "var(--ink)" }}>{h.titulo}</div>
                {h.detalle && (
                  <div style={{ font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>{h.detalle}</div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
