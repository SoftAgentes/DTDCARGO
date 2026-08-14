/**
 * Tipos y validadores del módulo Aliados (SDD-0255).
 *
 * Un aliado es otra empresa de puerta a puerta que revende el servicio de DTD
 * bajo SU marca y atiende ELLA a sus propios clientes. Se marca a mano desde la
 * ficha de un cliente que ya existe: el aliado ES un cliente, con una fila extra
 * en `aliados` que le cuelga.
 *
 * La insignia es jerárquica — un aliado puede tener sub-aliados. La composición
 * de las dos formas del código (guardada vs impresa) vive en
 * `lib/shared/markbox-chain.ts`, que se comparte con el lado público.
 *
 * Sin Zod: validate*Input() a mano, patrón del proyecto.
 */

export const ALIADO_STATUSES = ["activo", "suspendido", "cerrado"] as const;
export type AliadoStatus = (typeof ALIADO_STATUSES)[number];

export const ALIADO_BILLING_MODELS = ["tarifa_fija", "comision_pct", "spread"] as const;
export type AliadoBillingModel = (typeof ALIADO_BILLING_MODELS)[number];

/**
 * Prefijos que NO se pueden reclamar. Espejo exacto del constraint
 * `aliados_prefix_reservado` de la migr 0362 — si cambia allá, cambia acá.
 * `DTD` es la casa; `ITS`, `AD` y `LEG` ya existen sueltos en las 10 fichas sin
 * serie del legado.
 */
export const PREFIJOS_RESERVADOS = ["DTD", "ITS", "AD", "LEG"] as const;

export type Aliado = {
  id: string;
  tenant_id: string;
  client_id: string;
  /** null = aliado raíz (el que factura con DTD). No null = sub-aliado. */
  parent_aliado_id: string | null;
  prefix: string;
  trade_name: string;
  status: AliadoStatus;
  agreement_notes: string | null;
  billing_model: AliadoBillingModel;
  billing_value: number | null;
  created_at: string;
  deleted_at: string | null;
};

/** Fila liviana para selectores y listados. */
export type AliadoOption = {
  id: string;
  /** El cliente-padre: el cliente que ES este aliado. */
  clientId: string;
  /**
   * Shipping Mark de ese cliente, para enlazar a su ficha — la ruta del Studio
   * es `/studio/clientes/[markbox]`, no por id. Opcional a propósito: los
   * selectores y la composición de la cadena no lo necesitan, y así los tests de
   * `prefixChain`/`parentOptions` siguen valiendo sin tocarlos.
   */
  markbox?: string | null;
  prefix: string;
  tradeName: string;
  parentAliadoId: string | null;
  status: AliadoStatus;
};

export type AliadoInput = {
  clientId: string;
  prefix: string;
  tradeName: string;
  parentAliadoId: string | null;
  agreementNotes: string | null;
  status: AliadoStatus;
};

export type AliadoActionState = { ok?: boolean; error?: string } | null;

export function aliadoStatusLabel(s: AliadoStatus): string {
  if (s === "activo") return "Activo";
  if (s === "suspendido") return "Suspendido";
  return "Cerrado";
}

export function aliadoStatusTone(s: AliadoStatus): "success" | "warning" | "neutral" {
  if (s === "activo") return "success";
  if (s === "suspendido") return "warning";
  return "neutral";
}

export function billingModelLabel(m: AliadoBillingModel): string {
  if (m === "tarifa_fija") return "Tarifa fija por CBM";
  if (m === "comision_pct") return "Comisión %";
  return "Spread";
}

/**
 * Valida el prefijo (la "insignia"): 2 a 4 letras, sin reservados.
 * Devuelve el prefijo normalizado en mayúsculas, o un mensaje de error.
 *
 * Una sola letra queda fuera a propósito: las series de UN carácter
 * (`DTD-A101`, `DTD-J044`) eran códigos de VENDEDOR de una práctica ya
 * descontinuada, y no queremos que un prefijo de aliado se confunda con ellas.
 */
export function validateAliadoPrefix(raw: string | null | undefined): {
  value?: string;
  error?: string;
} {
  const v = (raw ?? "").trim().toUpperCase();
  if (!v) return { error: "La insignia es obligatoria." };
  if (!/^[A-Z]{2,4}$/.test(v)) {
    return { error: "La insignia son 2 a 4 letras, sin números ni espacios (ej. HR, DC)." };
  }
  if ((PREFIJOS_RESERVADOS as readonly string[]).includes(v)) {
    return { error: `“${v}” está reservado y no se puede usar como insignia de aliado.` };
  }
  return { value: v };
}

export function validateAliadoInput(fd: FormData): {
  value?: AliadoInput;
  error?: string;
} {
  const clientId = String(fd.get("clientId") ?? "").trim();
  if (!clientId) return { error: "Falta el cliente." };

  const prefix = validateAliadoPrefix(String(fd.get("prefix") ?? ""));
  if (prefix.error) return { error: prefix.error };

  const tradeName = String(fd.get("tradeName") ?? "").trim();
  if (!tradeName) return { error: "El nombre comercial es obligatorio." };
  if (tradeName.length > 120) return { error: "El nombre comercial es muy largo (máx. 120)." };

  const parentRaw = String(fd.get("parentAliadoId") ?? "").trim();
  const parentAliadoId = parentRaw === "" ? null : parentRaw;

  const notesRaw = String(fd.get("agreementNotes") ?? "").trim();
  const agreementNotes = notesRaw === "" ? null : notesRaw.slice(0, 4000);

  const statusRaw = String(fd.get("status") ?? "activo").trim();
  const status = (ALIADO_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as AliadoStatus)
    : "activo";

  return {
    value: { clientId, prefix: prefix.value!, tradeName, parentAliadoId, agreementNotes, status },
  };
}

/**
 * Cadena de prefijos desde la raíz hasta el aliado dado, resuelta en memoria.
 * `FA` bajo `DC` → `"DC-FA"`.
 *
 * Es el espejo de la función SQL `aliado_prefix_chain()`. Existe para no pagar un
 * RPC por fila al pintar un listado; la fuente canónica al EMITIR un código sigue
 * siendo `next_markbox_aliado()`, que la compone del lado de la base.
 *
 * Tope de 10 saltos igual que la función SQL: el trigger anti-ciclo lo impide,
 * pero un ciclo acá colgaría el render.
 */
export function prefixChain(aliados: AliadoOption[], id: string): string {
  const byId = new Map(aliados.map((a) => [a.id, a]));
  const segmentos: string[] = [];
  let cursor: string | null = id;
  let saltos = 0;
  while (cursor && saltos < 10) {
    const a: AliadoOption | undefined = byId.get(cursor);
    if (!a) break;
    segmentos.unshift(a.prefix.toUpperCase());
    cursor = a.parentAliadoId;
    saltos += 1;
  }
  return segmentos.join("-");
}

/**
 * Opciones válidas como aliado PADRE de `selfId`: todos menos él mismo y menos
 * sus descendientes (eso sería un ciclo, y el trigger `aliados_guard_sin_ciclo_t`
 * lo rechaza de todos modos — acá simplemente no se los ofrecemos).
 * Con `selfId` null (aún no es aliado) se ofrecen todos.
 */
export function parentOptions(aliados: AliadoOption[], selfId: string | null): AliadoOption[] {
  if (!selfId) return aliados;
  const descendientes = new Set<string>([selfId]);
  let crecio = true;
  while (crecio) {
    crecio = false;
    for (const a of aliados) {
      if (a.parentAliadoId && descendientes.has(a.parentAliadoId) && !descendientes.has(a.id)) {
        descendientes.add(a.id);
        crecio = true;
      }
    }
  }
  return aliados.filter((a) => !descendientes.has(a.id));
}
