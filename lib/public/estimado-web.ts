/**
 * SDD-0061 Fase B1 — Lógica pura del estimado web.
 *
 * Convierte el payload que mandan las calculadoras públicas (`/tarifas` LCL
 * y `/estimacion` marítimo/aéreo) en la fila de `public.quotes` que persiste el
 * route handler, valida el input (sin Zod, validador propio estilo `validate*Input`),
 * y arma el mensaje de WhatsApp con la nota + el código `EST-XXXX`.
 *
 * FRONTERA: este módulo NO importa Supabase ni código del ERP. Es pura
 * transformación de datos → es testeable con stubs y vive del lado público.
 * El acceso a la DB lo hace SOLO `app/api/public/estimacion/route.ts`.
 *
 * `quotes` tiene columnas NOT NULL (client_name, service, origin, destination,
 * subtotal_usd, total_usd, packaging) que NO se aflojaron en la migración: las
 * LLENAMOS acá con los datos de la calc o defaults sensatos (decisión SDD-0061).
 */

/** El servicio que se guarda en quotes.service (enum shipment_service). */
export type EstimadoService =
  | "consolidado_lcl"
  | "puerta_a_puerta_DDP"
  | "fcl_directo"
  | "transporte_terrestre";

/** Calculadora de origen del estimado. */
export type EstimadoCalcKind = "lcl" | "aereo" | "maritimo";

/** Payload que mandan las calculadoras públicas al endpoint. */
export type EstimadoWebPayload = {
  /** Qué calculadora lo generó (LCL en vivo, o el form marítimo/aéreo). */
  calc: EstimadoCalcKind;
  /** Contacto del visitante. */
  prospectName?: string | null;
  prospectWhatsapp?: string | null;
  prospectEmail?: string | null;
  /** Nota libre opcional (ej "Tengo la mercancía lista"). */
  nota?: string | null;
  /** Origen (texto, ej "Yiwu, CN"). Default sensato si la calc no lo provee. */
  origin?: string | null;
  /** Destino (texto, ej "Valencia, VE" o "Maracay"). */
  destination?: string | null;
  /** Volumen total en m³ (CBM). */
  cbm?: number | null;
  /** Peso total en kg. */
  weightKg?: number | null;
  /** Cajas (si la calc las conoce). */
  boxes?: number | null;
  /** Embalaje (carton | paleta | madera | especial | estandar). */
  packaging?: string | null;
  /** Monto total estimado en USD. */
  totalUsd?: number | null;
  /** Subtotal en USD (si la calc lo desglosa; default = total). */
  subtotalUsd?: number | null;
};

/** Input validado y normalizado (lo que se mapea a la fila). */
export type EstimadoWebInput = {
  calc: EstimadoCalcKind;
  /** Obligatorios post-validación (el validador garantiza no-null). */
  prospectName: string;
  prospectWhatsapp: string;
  /** Opcionales. */
  prospectEmail: string | null;
  nota: string | null;
  origin: string;
  destination: string;
  cbm: number | null;
  weightKg: number | null;
  boxes: number | null;
  packaging: string;
  totalUsd: number;
  subtotalUsd: number;
};

export type EstimadoFieldErrors = Partial<
  Record<"prospectName" | "prospectWhatsapp" | "totalUsd" | "calc", string>
>;

export type EstimadoValidation =
  | { input: EstimadoWebInput; fieldErrors?: undefined }
  | { input?: undefined; fieldErrors: EstimadoFieldErrors };

const VALID_CALCS: EstimadoCalcKind[] = ["lcl", "aereo", "maritimo"];

function trimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Valida + normaliza el payload del estimado web (sin Zod).
 *
 * Reglas mínimas (baja fricción, decisión founder — no gateamos el precio):
 *  - calc debe ser una de las calculadoras conocidas.
 *  - nombre y teléfono son obligatorios (es el contacto que el asesor usará).
 *  - total estimado > 0 (sin un precio no hay estimado que capturar).
 *  - email es opcional.
 */
export function validateEstimadoInput(
  payload: Partial<EstimadoWebPayload>,
): EstimadoValidation {
  const fieldErrors: EstimadoFieldErrors = {};

  const calc =
    typeof payload.calc === "string" &&
    VALID_CALCS.includes(payload.calc as EstimadoCalcKind)
      ? (payload.calc as EstimadoCalcKind)
      : null;
  if (!calc) fieldErrors.calc = "Calculadora de origen inválida.";

  const prospectName = trimOrNull(payload.prospectName);
  if (!prospectName) fieldErrors.prospectName = "Dinos tu nombre.";

  const prospectWhatsapp = trimOrNull(payload.prospectWhatsapp);
  if (!prospectWhatsapp) fieldErrors.prospectWhatsapp = "Dinos tu WhatsApp o teléfono.";

  const totalUsd = num(payload.totalUsd);
  if (totalUsd == null || totalUsd <= 0) {
    fieldErrors.totalUsd = "El estimado no tiene un monto válido.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const subtotal = num(payload.subtotalUsd);
  const packaging = trimOrNull(payload.packaging) ?? "carton";

  return {
    input: {
      calc: calc!,
      prospectName: prospectName!,
      prospectWhatsapp: prospectWhatsapp!,
      prospectEmail: trimOrNull(payload.prospectEmail),
      nota: trimOrNull(payload.nota),
      origin: trimOrNull(payload.origin) ?? "China",
      destination: trimOrNull(payload.destination) ?? "Venezuela",
      cbm: num(payload.cbm),
      weightKg: num(payload.weightKg),
      boxes: num(payload.boxes),
      packaging,
      totalUsd: totalUsd!,
      // Sin subtotal explícito → igual al total (la calc no siempre desglosa).
      subtotalUsd: subtotal != null && subtotal > 0 ? subtotal : totalUsd!,
    },
  };
}

/**
 * El servicio que se guarda según la calculadora de origen. Hoy las tres
 * calculadoras públicas (LCL/aéreo/marítimo) cotizan el flujo China→VE puerta a
 * puerta DDP, que es el producto comercial de la web → todas mapean a
 * `puerta_a_puerta_DDP`. Se deja como función (no constante) para extender el
 * mapeo si la web suma otros productos sin tocar a los callers.
 */
export function serviceForCalc(_calc: EstimadoCalcKind): EstimadoService {
  return "puerta_a_puerta_DDP";
}

/**
 * La fila lista para insertar en `public.quotes`. `quote_code`, `id`, `tenant_id`
 * los completa el route handler (correlativo + tenant). Acá llenamos TODOS los
 * NOT NULL de la tabla con datos de la calc o defaults sensatos.
 */
export type EstimadoQuoteRow = {
  client_markbox: null;
  client_name: string;
  prospect_name: string;
  prospect_email: string | null;
  prospect_whatsapp: string;
  nota: string | null;
  source: "web";
  status: "draft";
  service: EstimadoService;
  origin: string;
  destination: string;
  cbm: number | null;
  weight_kg: number | null;
  boxes: number | null;
  packaging: string;
  subtotal_usd: number;
  packaging_cost: number;
  total_usd: number;
};

/**
 * Mapea el input validado a la fila de `quotes`. `client_name` (NOT NULL) se
 * llena con el nombre del prospecto — es el snapshot del momento, igual que en
 * el Studio. `subtotal_usd`/`total_usd` (NOT NULL) vienen del estimado.
 */
export function buildEstimadoRow(input: EstimadoWebInput): EstimadoQuoteRow {
  return {
    client_markbox: null,
    client_name: input.prospectName,
    prospect_name: input.prospectName,
    prospect_email: input.prospectEmail,
    prospect_whatsapp: input.prospectWhatsapp,
    nota: input.nota,
    source: "web",
    status: "draft",
    service: serviceForCalc(input.calc),
    origin: input.origin,
    destination: input.destination,
    cbm: input.cbm,
    weight_kg: input.weightKg,
    boxes: input.boxes,
    packaging: input.packaging,
    subtotal_usd: input.subtotalUsd,
    packaging_cost: 0,
    total_usd: input.totalUsd,
  };
}

/**
 * Arma el mensaje de WhatsApp final: el cuerpo que ya construyó cada calculadora
 * (`baseMessage`) + la nota del visitante (si la dejó) + el código EST-XXXX para
 * que el asesor cruce el mensaje con el estimado ya capturado en el ERP.
 */
export function buildEstimadoWhatsAppMessage(args: {
  baseMessage: string;
  nota?: string | null;
  estimateCode?: string | null;
}): string {
  const parts = [args.baseMessage.trimEnd()];
  const nota = trimOrNull(args.nota);
  if (nota) {
    parts.push("", `Nota: ${nota}`);
  }
  const code = trimOrNull(args.estimateCode);
  if (code) {
    parts.push("", `Mi código de estimado: ${code}`);
  }
  return parts.join("\n");
}
