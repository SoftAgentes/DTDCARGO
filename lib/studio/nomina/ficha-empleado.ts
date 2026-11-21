/**
 * Reglas puras de la ficha 360° del empleado (SDD-0652 F1). Sin I/O: se prueban
 * sin base. Las consultas viven en `ficha-empleado-queries.ts` y el control de
 * acceso en `ficha-empleado-guard.ts`.
 */

import type { StudioUserRole } from "@/lib/studio/user-types";

// ── Quién ve qué ────────────────────────────────────────────────
/**
 * `admin` ve todo, incluido el acceso al Studio (correo de acceso, rol, último
 * ingreso). `contabilidad` ve la ficha laboral y solo sabe si la persona tiene
 * cuenta y si tiene acceso (D10). Cualquier otro rol, nada.
 */
export type NivelFicha = "admin" | "contabilidad";

export function nivelDeFicha(role: StudioUserRole | null | undefined): NivelFicha | null {
  if (role === "admin") return "admin";
  if (role === "accounting") return "contabilidad";
  return null;
}

// ── Resultado de un bloque ──────────────────────────────────────
/** Cada bloque carga solo: si falla, la ficha lo dice en ese bloque (§5.3). */
export type Bloque<T> = { ok: true; data: T } | { ok: false };

export function bloqueOk<T>(data: T): Bloque<T> {
  return { ok: true, data };
}
export const BLOQUE_ERROR: Bloque<never> = { ok: false };

// ── Préstamos ───────────────────────────────────────────────────
export type PrestamoFicha = {
  id: string;
  granted_on: string;
  principal_usd: number;
  installment_usd: number;
  installments_total: number;
  status: "activo" | "pagado" | "cancelado";
  concept: string | null;
  paid_usd: number;
};

/** Saldo de un préstamo activo: lo otorgado menos lo abonado, nunca negativo. */
export function saldoPrestamo(p: Pick<PrestamoFicha, "principal_usd" | "paid_usd" | "status">): number {
  if (p.status !== "activo") return 0;
  return Math.max(0, Math.round((p.principal_usd - p.paid_usd) * 100) / 100);
}

export function saldoPrestamos(prestamos: PrestamoFicha[]): number {
  const total = prestamos.reduce((acc, p) => acc + saldoPrestamo(p), 0);
  return Math.round(total * 100) / 100;
}

// ── Asistencia del mes ──────────────────────────────────────────
export type AsistenciaDia = { work_date: string; status: "trabajado" | "ausente" | "libre" | "feriado" };

export function resumenAsistencia(dias: AsistenciaDia[]): { trabajados: number; ausencias: number; registrados: number } {
  let trabajados = 0;
  let ausencias = 0;
  for (const d of dias) {
    if (d.status === "trabajado") trabajados += 1;
    else if (d.status === "ausente") ausencias += 1;
  }
  return { trabajados, ausencias, registrados: dias.length };
}

/** Primer y último día del mes de `hoy` (YYYY-MM-DD), en la hora de Caracas. */
export function mesDeCaracas(hoy: Date = new Date()): { desde: string; hasta: string; etiqueta: string } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(hoy);
  const y = Number(partes.find((p) => p.type === "year")?.value);
  const m = Number(partes.find((p) => p.type === "month")?.value);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  const etiqueta = new Intl.DateTimeFormat("es-VE", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  return { desde: `${y}-${mm}-01`, hasta: `${y}-${mm}-${String(ultimo).padStart(2, "0")}`, etiqueta };
}

// ── Línea de tiempo laboral ─────────────────────────────────────
export type HechoTono = "info" | "wine" | "warning" | "danger" | "success" | "neutral";

export type Hecho = {
  /** Fecha del hecho, YYYY-MM-DD o ISO. Ordena la línea. */
  fecha: string;
  tipo: "ingreso" | "comunicacion" | "prestamo" | "amonestacion" | "recibo" | "finiquito" | "evento";
  titulo: string;
  detalle?: string;
  tono: HechoTono;
};

export type FuentesLinea = {
  hireDate: string | null;
  comunicaciones: { created_at: string; type: string; title: string }[];
  prestamos: Pick<PrestamoFicha, "granted_on" | "principal_usd" | "status" | "concept">[];
  amonestaciones: { issued_on: string; warning_code: string; severity: string; status: string }[];
  recibos: { period_label: string; period_end: string; net_usd: number; run_status: string }[];
  finiquitos: { settlement_code: string; termination_date: string; status: string; created_at: string }[];
};

const usd = new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function fmtUsdFicha(n: number): string {
  return usd.format(n);
}

const COMUNICACION: Record<string, string> = {
  recibo: "Recibo enviado",
  aviso: "Aviso",
  llamado: "Llamado de atención",
  amonestacion: "Amonestación enviada",
};

const SEVERIDAD: Record<string, string> = { leve: "leve", grave: "grave", muy_grave: "muy grave" };

/** Une los hechos laborales de la persona, del más reciente al más antiguo. */
export function lineaDeTiempo(f: FuentesLinea): Hecho[] {
  const hechos: Hecho[] = [];
  if (f.hireDate) {
    hechos.push({ fecha: f.hireDate, tipo: "ingreso", titulo: "Ingreso a la empresa", tono: "info" });
  }
  for (const c of f.comunicaciones) {
    hechos.push({
      fecha: c.created_at,
      tipo: "comunicacion",
      titulo: COMUNICACION[c.type] ?? "Comunicación",
      detalle: c.title,
      tono: "neutral",
    });
  }
  for (const p of f.prestamos) {
    hechos.push({
      fecha: p.granted_on,
      tipo: "prestamo",
      titulo: `Préstamo de ${fmtUsdFicha(p.principal_usd)}`,
      detalle: [p.concept, p.status === "activo" ? null : p.status === "pagado" ? "pagado" : "cancelado"]
        .filter(Boolean)
        .join(" · ") || undefined,
      tono: "neutral",
    });
  }
  for (const a of f.amonestaciones) {
    const anulada = a.status === "anulada";
    hechos.push({
      fecha: a.issued_on,
      tipo: "amonestacion",
      titulo: `Amonestación ${a.warning_code}${anulada ? " (anulada)" : ""}`,
      detalle: SEVERIDAD[a.severity] ?? a.severity,
      tono: anulada ? "neutral" : "warning",
    });
  }
  for (const r of f.recibos) {
    const anulado = r.run_status === "anulado";
    hechos.push({
      fecha: r.period_end,
      tipo: "recibo",
      titulo: `Nómina ${r.period_label}${anulado ? " (anulada)" : ""}`,
      detalle: `Neto ${fmtUsdFicha(r.net_usd)}`,
      tono: anulado ? "neutral" : "success",
    });
  }
  for (const s of f.finiquitos) {
    const anulado = s.status === "anulado";
    hechos.push({
      fecha: anulado ? s.created_at : s.termination_date,
      tipo: "finiquito",
      titulo: `Finiquito ${s.settlement_code}${anulado ? " (anulado)" : s.status === "borrador" ? " (borrador)" : ""}`,
      tono: anulado ? "neutral" : "danger",
    });
  }
  return hechos.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

// ── Eventos de la ficha (SDD-0652 fase 2) ───────────────────────
/** Un evento de auditoría de la ficha, tal como lo devuelve la RPC: sin payload ni motivo. */
export type EventoFicha = {
  id: string;
  entity_type: string;
  event_type: string;
  occurred_at: string;
  actor_id: string | null;
};

const EVENTO: Record<string, { titulo: string; tono: HechoTono }> = {
  user_linked: { titulo: "Se enlazó con un usuario del Studio", tono: "info" },
  user_unlinked: { titulo: "Se quitó el enlace con su usuario", tono: "warning" },
  photo_set: { titulo: "Se cambió la foto", tono: "neutral" },
  photo_removed: { titulo: "Se quitó la foto", tono: "neutral" },
  bank_account_revealed: { titulo: "Se consultó la cuenta bancaria completa", tono: "neutral" },
  payroll_settlement_voided: { titulo: "Se anuló un finiquito", tono: "danger" },
};

/** Los eventos como hechos de la línea de tiempo. Un evento que no se conoce se dice sin inventar. */
export function hechosDeEventos(eventos: EventoFicha[], nombres: Record<string, string>): Hecho[] {
  return eventos.map((ev) => {
    const meta = EVENTO[ev.event_type] ?? { titulo: "Cambio registrado en la ficha", tono: "neutral" as HechoTono };
    const quien = ev.actor_id ? nombres[ev.actor_id] : undefined;
    return {
      fecha: ev.occurred_at,
      tipo: "evento" as const,
      titulo: meta.titulo,
      detalle: quien ? `Por ${quien}` : undefined,
      tono: meta.tono,
    };
  });
}

/** Une dos listas de hechos, del más reciente al más antiguo. */
export function unirHechos(a: Hecho[], b: Hecho[]): Hecho[] {
  return [...a, ...b].sort((x, y) => (x.fecha < y.fecha ? 1 : x.fecha > y.fecha ? -1 : 0));
}

// ── Enlace con un usuario (SDD-0652 §4) ─────────────────────────
/** Miembro activo del Studio que todavía no tiene ficha. Solo lo recibe admin. */
export type CandidatoEnlace = { userId: string; nombre: string; correoAcceso: string | null };

/**
 * La sugerencia de §4 punto 3: si el correo de contacto de la ficha es
 * **exactamente** el de acceso de un candidato, se propone. No enlaza: propone.
 * Con dos candidatos con el mismo correo no se sugiere ninguno.
 */
export function sugerenciaDeEnlace(correoContacto: string | null, candidatos: CandidatoEnlace[]): CandidatoEnlace | null {
  const buscado = (correoContacto ?? "").trim().toLowerCase();
  if (!buscado) return null;
  const iguales = candidatos.filter((c) => (c.correoAcceso ?? "").trim().toLowerCase() === buscado);
  return iguales.length === 1 ? iguales[0]! : null;
}

/** El motivo que piden las RPC de la ficha: de 4 a 500 caracteres, sin contar los espacios de los bordes. */
export function motivoValido(motivo: string | null | undefined): boolean {
  const n = (motivo ?? "").trim().length;
  return n >= 4 && n <= 500;
}

// ── Los cinco datos que no se mezclan (§5.1) ────────────────────
export type AccesoStudio =
  /** Solo para admin. */
  | {
      nivel: "admin";
      cuentaEnlazada: boolean;
      correoAcceso: string | null;
      rol: StudioUserRole | null;
      suspendido: boolean;
      ultimoIngreso: string | null;
      userId: string | null;
      /** La lectura de Auth o de la membresía falló: se dice, no se inventa. */
      error: boolean;
    }
  /** Para Contabilidad: solo sí o no (D10). */
  | { nivel: "contabilidad"; cuentaEnlazada: boolean; conAcceso: boolean | null };

/** Texto corto del acceso al Studio, igual para los dos niveles. */
export function etiquetaAcceso(a: AccesoStudio): string {
  if (!a.cuentaEnlazada) return "Sin cuenta";
  if (a.nivel === "contabilidad") {
    if (a.conAcceso === null) return "Tiene cuenta";
    return a.conAcceso ? "Con acceso al Studio" : "Sin acceso al Studio";
  }
  if (a.error) return "Tiene cuenta";
  if (!a.rol) return "Sin acceso al Studio";
  return a.suspendido ? "Acceso al Studio suspendido" : "Con acceso al Studio";
}

/** El correo de contacto y el de acceso, solo si son distintos (sin mayúsculas ni espacios). */
export function correosDistintos(contacto: string | null, acceso: string | null): boolean {
  const a = (contacto ?? "").trim().toLowerCase();
  const b = (acceso ?? "").trim().toLowerCase();
  return !!a && !!b && a !== b;
}

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "—";
  const a = partes[0]![0] ?? "";
  const b = partes.length > 1 ? (partes[partes.length - 1]![0] ?? "") : "";
  return (a + b).toUpperCase();
}
