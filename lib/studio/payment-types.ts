/**
 * Tipos TypeScript del módulo Cobranzas (SDD-0041 + SDD-0068).
 * Matchea schema de supabase/migrations/0079_cobranzas.sql
 * (payment_receipts + collection_activities) + 0122_recibos_cobranza.sql
 * (pagador + application_status + fund_class + invoice_id nullable).
 *
 * El recibo de pago (`PaymentReceipt`) es el ledger del cobro: un recibo por
 * cobro sobre una factura — o SIN factura cuando el pago llegó sin referencia
 * (`application_status='recibido_sin_ref'`, cláusula 7.3 del Acuerdo). `amount`
 * está en la moneda de la factura; el asiento del cobro se hace en USD
 * funcional (ver accounting/receipt-posting.ts).
 *
 * La gestión de cobranza (`CollectionActivity`) es un log liviano: contacto,
 * promesa, nota, recordatorio. El "stage" de la cola CxC se deriva (ver
 * payment-queries.ts), no se persiste como una máquina de estados.
 *
 * SDD-0068 (capa legal SDD-C): los labels de estados de pago — internos y
 * "Cliente ve" — son LITERALES de docs/legal/COPY_LEGAL_UI.md §7 (efecto
 * probatorio: cambiarlos es decisión de Claude Chat, no de código).
 */

import type { InvoiceCurrency } from "./invoice-types";

/** Método de pago del recibo (texto libre acotado, no enum SQL). */
export type PaymentMethod =
  | "efectivo"
  | "transferencia"
  | "zelle"
  | "pago_movil"
  | "usdt"
  | "otro";

export const PAYMENT_METHODS: PaymentMethod[] = [
  "efectivo",
  "transferencia",
  "zelle",
  "pago_movil",
  "usdt",
  "otro",
];

export const PAYMENT_METHOD_OPTIONS: {
  value: PaymentMethod;
  label: string;
}[] = [
  { value: "transferencia", label: "Transferencia" },
  { value: "zelle", label: "Zelle" },
  { value: "pago_movil", label: "Pago móvil" },
  { value: "usdt", label: "USDT" },
  { value: "efectivo", label: "Efectivo" },
  { value: "otro", label: "Otro" },
];

export function paymentMethodLabel(method: string): string {
  return (
    PAYMENT_METHOD_OPTIONS.find((o) => o.value === method)?.label ?? method
  );
}

// ── Pagador (SDD-0068 · decisión #7 del handoff legal) ────────

/** Quién realizó el pago: el propio cliente (default) o un tercero. */
export type PayerKind = "cliente" | "tercero";

export const PAYER_KINDS: PayerKind[] = ["cliente", "tercero"];

/** Relación del tercero con el cliente (COPY §3). */
export type PayerRelation = "familiar" | "socio" | "empleado" | "otro";

export const PAYER_RELATIONS: PayerRelation[] = [
  "familiar",
  "socio",
  "empleado",
  "otro",
];

export const PAYER_RELATION_OPTIONS: {
  value: PayerRelation;
  label: string;
}[] = [
  { value: "familiar", label: "Familiar" },
  { value: "socio", label: "Socio" },
  { value: "empleado", label: "Empleado" },
  { value: "otro", label: "Otro" },
];

export function payerRelationLabel(relation: string): string {
  return (
    PAYER_RELATION_OPTIONS.find((o) => o.value === relation)?.label ?? relation
  );
}

// ── Estados de aplicación del pago (SDD-0068 · COPY §7) ───────

/**
 * Estado de APLICACIÓN del pago (ortogonal al ciclo de la factura):
 *  - recibido_sin_ref: fondos en cuenta sin cruce (cláusula 7.3) — recibo SIN
 *    factura, asiento a la cuenta puente "Fondos por identificar".
 *  - identificado: estado intermedio válido (cruzado con operación). En V1 la
 *    UI lo colapsa — identificar = aplicar — y queda `identified_at` como traza.
 *  - aplicado: saldo actualizado (default de todo cobro normal).
 *  - rendido: incluido en la rendición quincenal a la Operadora. DEFINIDO acá,
 *    pero su transición es de SDD-D (rendición) — sin wiring en V1.
 */
export type ApplicationStatus =
  | "recibido_sin_ref"
  | "identificado"
  | "aplicado"
  | "rendido";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "recibido_sin_ref",
  "identificado",
  "aplicado",
  "rendido",
];

/**
 * Metadata por estado. `internal` y `clientView` son LITERALES de
 * COPY_LEGAL_UI.md §7 — NO los cambies en código (efecto probatorio; los
 * cambios se deciden en Claude Chat). `clientView` puede llevar placeholders
 * `{fecha_fondos}` / `{saldo}` (ver `applicationStatusClientView`) y es null
 * cuando el estado NO es visible al cliente (`rendido`). El wiring de estos
 * textos al Portal es de una spec aparte — acá quedan listos.
 */
export const APPLICATION_STATUS_META: Record<
  ApplicationStatus,
  {
    /** Label corto para badges/listados del Studio. */
    label: string;
    /** Microcopy interno LITERAL (COPY §7, columna "Interno"). */
    internal: string;
    /** Microcopy "Cliente ve" LITERAL (COPY §7). null = no visible. */
    clientView: string | null;
    tone: "success" | "danger" | "warning" | "info" | "neutral";
  }
> = {
  recibido_sin_ref: {
    label: "Sin identificar",
    internal: "Fondos en cuenta sin cruce",
    clientView: "Pago recibido — pendiente de identificación",
    tone: "warning",
  },
  identificado: {
    label: "Identificado",
    internal: "Cruzado con operación; imputación retroactiva aplicada",
    clientView: "Pago aplicado el {fecha_fondos}",
    tone: "info",
  },
  aplicado: {
    label: "Aplicado",
    internal: "Saldo actualizado, gate de despacho evaluado",
    clientView: "Saldo: {saldo}",
    tone: "success",
  },
  rendido: {
    label: "Rendido",
    internal: "Incluido en rendición quincenal a la Operadora",
    clientView: null,
    tone: "neutral",
  },
};

export function applicationStatusLabel(status: string): string {
  return (
    APPLICATION_STATUS_META[status as ApplicationStatus]?.label ?? status
  );
}

export function applicationStatusTone(
  status: string,
): "success" | "danger" | "warning" | "info" | "neutral" {
  return APPLICATION_STATUS_META[status as ApplicationStatus]?.tone ?? "neutral";
}

/**
 * Texto "Cliente ve" con placeholders resueltos. null si el estado no es
 * visible al cliente (rendido) o no existe. PURA.
 */
export function applicationStatusClientView(
  status: string,
  vars: { fechaFondos?: string; saldo?: string } = {},
): string | null {
  const tpl = APPLICATION_STATUS_META[status as ApplicationStatus]?.clientView;
  if (tpl == null) return null;
  return tpl
    .replace("{fecha_fondos}", vars.fechaFondos ?? "{fecha_fondos}")
    .replace("{saldo}", vars.saldo ?? "{saldo}");
}

/**
 * Aviso LITERAL de COPY §3 — estado visible al cliente cuando el pago no
 * cruza. Se muestra en el drawer de identificación y sirve para el Portal.
 */
export const UNIDENTIFIED_CLIENT_NOTICE =
  "Pago recibido — pendiente de identificación. Envíanos tu referencia para aplicarlo. Una vez identificado, se imputará a la fecha en que recibimos los fondos.";

// ── Clasificación de fondos (SDD-0068 · mandato) ──────────────

/**
 * Separación contable del mandato: el flete internacional recaudado es
 * FONDOS DE TERCEROS de la Operadora (`third_party`); el ingreso propio de
 * DTD Services son los servicios locales (`local_revenue`). Nunca se mezclan
 * en un mismo asiento (los asientos de cobro son por-recibo → una clase por
 * construcción).
 */
export type FundClass = "third_party" | "local_revenue";

export const FUND_CLASSES: FundClass[] = ["third_party", "local_revenue"];

export const FUND_CLASS_META: Record<
  FundClass,
  { label: string; tone: "success" | "danger" | "warning" | "info" | "neutral" }
> = {
  third_party: { label: "Fondos de terceros", tone: "info" },
  local_revenue: { label: "Ingreso local", tone: "success" },
};

export function fundClassLabel(fc: string): string {
  return FUND_CLASS_META[fc as FundClass]?.label ?? fc;
}

export function fundClassTone(
  fc: string,
): "success" | "danger" | "warning" | "info" | "neutral" {
  return FUND_CLASS_META[fc as FundClass]?.tone ?? "neutral";
}

/**
 * Deriva la clase de fondos desde el servicio del embarque. PURA (decisión #5):
 *  - `transporte_terrestre` → local_revenue (servicio local de DTD Services).
 *  - null/undefined/'' (factura SIN shipment) → local_revenue (servicios
 *    locales facturados sin embarque internacional).
 *  - consolidacion | puerta_a_puerta_DDP | reserva_FCL → third_party.
 *  - servicio desconocido (no vacío) → third_party (conservador: tratar plata
 *    dudosa como de la Operadora nunca infla el ingreso propio).
 */
export function deriveFundClass(
  shipmentService: string | null | undefined,
): FundClass {
  const s = String(shipmentService ?? "").trim();
  if (!s) return "local_revenue";
  if (s === "transporte_terrestre") return "local_revenue";
  return "third_party";
}

/** Un recibo de pago persistido. */
export type PaymentReceipt = {
  id: string;
  tenant_id: string;
  receipt_code: string;
  /** null = pago sin referencia aún no identificado (SDD-0068). */
  invoice_id: string | null;
  /** Snapshot al momento. null hasta identificar un pago sin referencia. */
  client_markbox: string | null;
  /** Snapshot al momento. null hasta identificar un pago sin referencia. */
  client_name: string | null;
  amount: number;
  currency: InvoiceCurrency;
  fx_rate: number | null;
  method: string;
  cash_account_id: string;
  reference: string | null;
  received_at: string; // YYYY-MM-DD — fecha de recepción de fondos (NO se toca al identificar)
  journal_entry_id: string | null;
  notes: string | null;
  // SDD-0068 (0122): pagador + estado de aplicación + clase de fondos.
  payer_kind: PayerKind;
  payer_name: string | null;
  payer_relation: PayerRelation | null;
  licit_declared: boolean;
  application_status: ApplicationStatus;
  identified_at: string | null;
  fund_class: FundClass;
  created_at: string;
  deleted_at: string | null;
};

/** Tipo de gestión de cobranza. */
export type CollectionKind = "contacto" | "promesa" | "nota" | "recordatorio";

export const COLLECTION_KINDS: CollectionKind[] = [
  "contacto",
  "promesa",
  "nota",
  "recordatorio",
];

export const COLLECTION_KIND_LABEL: Record<CollectionKind, string> = {
  contacto: "Contacto",
  promesa: "Promesa de pago",
  nota: "Nota",
  recordatorio: "Recordatorio enviado",
};

export function collectionKindLabel(kind: string): string {
  return COLLECTION_KIND_LABEL[kind as CollectionKind] ?? kind;
}

/** Una gestión de cobranza persistida. */
export type CollectionActivity = {
  id: string;
  tenant_id: string;
  invoice_id: string;
  kind: CollectionKind;
  promised_amount: number | null;
  promised_date: string | null; // YYYY-MM-DD
  next_followup: string | null; // YYYY-MM-DD
  body: string | null;
  created_at: string;
  created_by: string | null;
};

/**
 * Stage derivado de la cola CxC. NO se persiste — se deriva del saldo, el
 * vencimiento y las gestiones (`derivedStage` en payment-queries.ts).
 */
export type ReceivableStage =
  | "al-dia"
  | "vencido"
  | "contactado"
  | "promesa"
  | "pagado";

export const COB_STAGES: Record<
  ReceivableStage,
  { label: string; tone: "success" | "danger" | "warning" | "info" | "neutral" }
> = {
  "al-dia": { label: "Al día", tone: "success" },
  vencido: { label: "Vencido", tone: "danger" },
  contactado: { label: "Contactado", tone: "warning" },
  promesa: { label: "Promesa de pago", tone: "info" },
  pagado: { label: "Pagado", tone: "success" },
};

export function stageLabel(stage: ReceivableStage): string {
  return COB_STAGES[stage]?.label ?? stage;
}

export function stageTone(
  stage: ReceivableStage,
): "success" | "danger" | "warning" | "info" | "neutral" {
  return COB_STAGES[stage]?.tone ?? "neutral";
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Patrón del receipt_code: R-YYYY-NNNN (mismo que produce la SQL
 * `next_receipt_code`). Padding mínimo 4 dígitos; se extiende si pasa de 9999.
 */
export const RECEIPT_CODE_RE = /^R-\d{4}-\d{4,}$/;

/** Formatea un receipt_code. Espejo en TS de la SQL (para test sin DB). */
export function formatReceiptCode(year: number, seq: number): string {
  const padded = String(seq).padStart(4, "0");
  return `R-${year}-${padded}`;
}

// ── Input + validación del cobro ──────────────────────────────

/** Lo que se registra al cobrar (sin code/id/timestamps). */
export type PaymentInput = {
  amount: number;
  cashAccountId: string;
  method: PaymentMethod;
  receivedAt: string; // YYYY-MM-DD
  reference: string | null;
  notes: string | null;
  // SDD-0068 · pagador (decisión #7). Default: el propio cliente.
  payerKind: PayerKind;
  payerName: string | null;
  payerRelation: PayerRelation | null;
  licitDeclared: boolean;
};

export type PaymentActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof PaymentInput, string>>;
  /** receipt_code generado, para trazabilidad/toast. */
  receiptCode?: string;
};

const VALID_METHODS = new Set<string>(PAYMENT_METHODS);
const VALID_PAYER_RELATIONS = new Set<string>(PAYER_RELATIONS);

/**
 * Validación manual del input del cobro (sin zod, patrón del repo).
 *
 * Reglas (criterios de aceptación §6 de 0041 + decisión #4 de 0068):
 *  - amount > 0 y ≤ saldo (`balance`).
 *  - cuenta de caja/banco requerida (`cashAccountId`).
 *  - receivedAt con formato YYYY-MM-DD.
 *  - pagador: si `payerKind='tercero'` → nombre + relación válida + checkbox
 *    de licitud OBLIGATORIOS (sin los 3, fieldErrors y NO se registra).
 *    Si paga el propio cliente, los campos del tercero se anulan y
 *    `licitDeclared` queda false (no aplica — sin checkbox).
 *
 * `balance` es el saldo pendiente de la factura (lo pasa el caller).
 */
export function validatePaymentInput(
  input: Partial<PaymentInput>,
  balance: number,
): {
  input?: PaymentInput;
  fieldErrors?: PaymentActionState["fieldErrors"];
} {
  const errors: PaymentActionState["fieldErrors"] = {};

  const amount = round2(Number(input.amount) || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "El monto del cobro debe ser mayor a cero.";
  } else if (amount > round2(balance) + 0.01) {
    errors.amount = `El cobro no puede superar el saldo ($${round2(balance).toFixed(2)}).`;
  }

  const cashAccountId = (input.cashAccountId ?? "").trim();
  if (!cashAccountId) {
    errors.cashAccountId = "Elige la cuenta de caja o banco que recibió el pago.";
  }

  const method: PaymentMethod = VALID_METHODS.has(input.method ?? "")
    ? (input.method as PaymentMethod)
    : "transferencia";

  const receivedAt = (input.receivedAt ?? "").trim();
  if (receivedAt && !/^\d{4}-\d{2}-\d{2}$/.test(receivedAt)) {
    errors.receivedAt = "Fecha de cobro inválida (YYYY-MM-DD).";
  }

  // Pagador (SDD-0068 · decisión #7): tercero exige nombre + relación + licitud.
  const payerKind: PayerKind = input.payerKind === "tercero" ? "tercero" : "cliente";
  const payerName = input.payerName?.trim() || null;
  const payerRelationRaw = String(input.payerRelation ?? "").trim();
  const payerRelation: PayerRelation | null = VALID_PAYER_RELATIONS.has(
    payerRelationRaw,
  )
    ? (payerRelationRaw as PayerRelation)
    : null;

  if (payerKind === "tercero") {
    if (!payerName) {
      errors.payerName = "Indica el nombre del tercero que realizó el pago.";
    }
    if (!payerRelation) {
      errors.payerRelation =
        "Indica la relación del pagador con el cliente (familiar, socio, empleado u otro).";
    }
    if (input.licitDeclared !== true) {
      errors.licitDeclared =
        "Hay que confirmar que el pagador declaró que los fondos corresponden a la operación y son de origen lícito.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      amount,
      cashAccountId,
      method,
      receivedAt: receivedAt || new Date().toISOString().slice(0, 10),
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      payerKind,
      payerName: payerKind === "tercero" ? payerName : null,
      payerRelation: payerKind === "tercero" ? payerRelation : null,
      // Pago del propio cliente: la declaración no aplica (false, sin checkbox).
      licitDeclared: payerKind === "tercero",
    },
  };
}

// ── Input + validación del pago SIN referencia (SDD-0068 #2) ──

/**
 * Lo que se registra cuando llega plata sin referencia (cláusula 7.3): monto,
 * moneda, canal, cuenta de caja, fecha de recepción, referencia bancaria
 * opcional y notas. SIN factura ni cliente (se identifican después).
 */
export type UnidentifiedPaymentInput = {
  amount: number;
  currency: InvoiceCurrency;
  /** Tasa <moneda>/USD para el asiento si la moneda no es USD/USDT. */
  fxRate: number | null;
  cashAccountId: string;
  method: PaymentMethod;
  receivedAt: string; // YYYY-MM-DD
  reference: string | null;
  notes: string | null;
};

export type UnidentifiedPaymentActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof UnidentifiedPaymentInput, string>>;
  receiptCode?: string;
};

const VALID_RECEIPT_CURRENCIES = new Set<string>(["USD", "VES", "USDT", "CNY"]);

/**
 * Validación manual del pago sin referencia:
 *  - amount > 0 (sin tope: no hay factura contra la cual acotar).
 *  - cuenta de caja/banco requerida.
 *  - moneda válida (default USD). VES exige fxRate > 0 (mismo criterio que la
 *    factura en VES — sin tasa el asiento USD no tiene sentido).
 *  - receivedAt con formato YYYY-MM-DD (default hoy).
 */
export function validateUnidentifiedPaymentInput(
  input: Partial<UnidentifiedPaymentInput>,
): {
  input?: UnidentifiedPaymentInput;
  fieldErrors?: UnidentifiedPaymentActionState["fieldErrors"];
} {
  const errors: UnidentifiedPaymentActionState["fieldErrors"] = {};

  const amount = round2(Number(input.amount) || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "El monto recibido debe ser mayor a cero.";
  }

  const cashAccountId = (input.cashAccountId ?? "").trim();
  if (!cashAccountId) {
    errors.cashAccountId = "Elige la cuenta de caja o banco que recibió el pago.";
  }

  const currency: InvoiceCurrency = VALID_RECEIPT_CURRENCIES.has(
    String(input.currency ?? ""),
  )
    ? (input.currency as InvoiceCurrency)
    : "USD";

  const fxRate =
    input.fxRate != null && Number.isFinite(Number(input.fxRate)) && Number(input.fxRate) > 0
      ? Number(input.fxRate)
      : null;
  if (currency === "VES" && !fxRate) {
    errors.fxRate = "Indica la tasa BCV para registrar un pago en bolívares.";
  }

  const method: PaymentMethod = VALID_METHODS.has(input.method ?? "")
    ? (input.method as PaymentMethod)
    : "transferencia";

  const receivedAt = (input.receivedAt ?? "").trim();
  if (receivedAt && !/^\d{4}-\d{2}-\d{2}$/.test(receivedAt)) {
    errors.receivedAt = "Fecha de recepción inválida (YYYY-MM-DD).";
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      amount,
      currency,
      fxRate,
      cashAccountId,
      method,
      receivedAt: receivedAt || new Date().toISOString().slice(0, 10),
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  };
}

// ── Input + validación de la gestión ──────────────────────────

export type ActivityInput = {
  kind: CollectionKind;
  promisedAmount: number | null;
  promisedDate: string | null; // YYYY-MM-DD
  nextFollowup: string | null; // YYYY-MM-DD
  body: string | null;
};

export type ActivityActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ActivityInput, string>>;
};

const VALID_KINDS = new Set<string>(COLLECTION_KINDS);

/**
 * Validación manual de la gestión de cobranza.
 *  - kind válido.
 *  - si kind='promesa' → promisedDate requerida (formato YYYY-MM-DD).
 *  - fechas con formato válido cuando vienen.
 */
export function validateActivityInput(input: Partial<ActivityInput>): {
  input?: ActivityInput;
  fieldErrors?: ActivityActionState["fieldErrors"];
} {
  const errors: ActivityActionState["fieldErrors"] = {};

  const kind: CollectionKind = VALID_KINDS.has(input.kind ?? "")
    ? (input.kind as CollectionKind)
    : "nota";

  const dateOk = (s: string | null | undefined): boolean =>
    !s || /^\d{4}-\d{2}-\d{2}$/.test(s);

  const promisedDate = input.promisedDate?.trim() || null;
  const nextFollowup = input.nextFollowup?.trim() || null;

  if (!dateOk(promisedDate)) {
    errors.promisedDate = "Fecha de promesa inválida (YYYY-MM-DD).";
  }
  if (!dateOk(nextFollowup)) {
    errors.nextFollowup = "Fecha de seguimiento inválida (YYYY-MM-DD).";
  }
  if (kind === "promesa" && !promisedDate) {
    errors.promisedDate = "Indica la fecha comprometida de la promesa.";
  }

  const promisedAmount =
    input.promisedAmount != null && Number.isFinite(Number(input.promisedAmount))
      ? round2(Number(input.promisedAmount))
      : null;

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      kind,
      promisedAmount: promisedAmount != null && promisedAmount > 0 ? promisedAmount : null,
      promisedDate,
      nextFollowup,
      body: input.body?.trim() || null,
    },
  };
}
