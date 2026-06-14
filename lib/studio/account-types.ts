/**
 * Tipos TypeScript del plan de cuentas (SDD-0040 · Contabilidad).
 * Matchea schema de supabase/migrations/0078_contabilidad.sql (tabla accounts).
 *
 * El plan de cuentas es un árbol (parent → hijo). La jerarquía también es
 * derivable del `code` (parent = code sin el último segmento). Solo las hojas
 * (`is_postable = true`) reciben asientos; los grupos solo agregan saldos.
 */

/**
 * Tipo de cuenta:
 *  A   = Activo
 *  P   = Pasivo
 *  PT  = Patrimonio
 *  I   = Ingresos
 *  CGS = Costo de ventas (Cost of Goods Sold)
 *  G   = Gastos operativos
 */
export type AcctType = "A" | "P" | "PT" | "I" | "CGS" | "G";

export const ACCT_TYPES: AcctType[] = ["A", "P", "PT", "I", "CGS", "G"];

export type Account = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  type: AcctType;
  parent_id: string | null;
  qbo_type: string | null;
  /** 2ª capa estilo "detail type" de QBO (ACCT_SUBTYPES[type]). Nullable. */
  subtype: string | null;
  is_postable: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Lo que el operador edita en el drawer (sin id/timestamps). */
export type AccountInput = {
  code: string;
  name: string;
  type: AcctType;
  parent_id: string | null;
  subtype: string | null;
  is_postable: boolean;
  notes: string | null;
};

export const ACCT_TYPE_LABEL: Record<AcctType, string> = {
  A: "Activo",
  P: "Pasivo",
  PT: "Patrimonio",
  I: "Ingresos",
  CGS: "Costo de ventas",
  G: "Gastos",
};

export const ACCT_TYPE_OPTIONS: { value: AcctType; label: string }[] =
  ACCT_TYPES.map((t) => ({ value: t, label: ACCT_TYPE_LABEL[t] }));

/**
 * Subtipos por tipo de cuenta — 2ª capa estilo "detail type" de QuickBooks.
 * Al crear una cuenta, eliges Tipo → se filtran estos subtipos (cascada). Solo
 * organizan/agrupan; el reporte (P&L vs Balance) lo decide `type`, no el subtipo.
 * Pensados para la operación China↔Venezuela (logística + trading).
 */
export const ACCT_SUBTYPES: Record<
  AcctType,
  { value: string; label: string }[]
> = {
  A: [
    { value: "banco_caja", label: "Banco / Caja" },
    { value: "cuentas_cobrar", label: "Cuentas por cobrar" },
    { value: "activo_corriente", label: "Otro activo corriente" },
    { value: "activo_fijo", label: "Activo fijo" },
  ],
  P: [
    { value: "cuentas_pagar", label: "Cuentas por pagar" },
    { value: "tarjeta_credito", label: "Tarjeta de crédito" },
    { value: "impuestos_pagar", label: "Impuestos por pagar" },
    { value: "pasivo_corriente", label: "Otro pasivo corriente" },
    { value: "pasivo_largo", label: "Pasivo no corriente" },
  ],
  PT: [
    { value: "capital", label: "Capital" },
    { value: "aportes", label: "Aportes del dueño" },
    { value: "retiros", label: "Retiros del dueño" },
    { value: "resultados", label: "Resultados acumulados" },
  ],
  I: [
    { value: "flete", label: "Flete / logística" },
    { value: "accesorios", label: "Cargos accesorios" },
    { value: "aduana_gestion", label: "Gestión aduanera" },
    { value: "otros_ingresos", label: "Otros ingresos" },
  ],
  CGS: [
    { value: "flete_internacional", label: "Flete internacional" },
    { value: "transporte_terrestre", label: "Transporte terrestre" },
    { value: "aduana_importacion", label: "Aduana e impuestos de importación" },
    { value: "portuario", label: "Manipuleo / almacenaje portuario" },
    { value: "otros_costos", label: "Otros costos de venta" },
  ],
  G: [
    { value: "sueldos", label: "Sueldos y cargas" },
    { value: "alquiler", label: "Alquiler" },
    { value: "servicios", label: "Servicios / telecom" },
    { value: "flota", label: "Flota (combustible/mantenimiento)" },
    { value: "viaticos", label: "Viáticos y viajes" },
    { value: "comisiones_banco", label: "Comisiones bancarias" },
    { value: "publicidad", label: "Publicidad y marketing" },
    { value: "profesionales", label: "Honorarios profesionales" },
    { value: "otros_gastos", label: "Otros gastos" },
  ],
};

/** ¿`subtype` es válido para `type`? null/"" = sin subtipo (válido). */
export function isValidSubtype(
  type: AcctType,
  subtype: string | null,
): boolean {
  if (!subtype) return true;
  return ACCT_SUBTYPES[type].some((s) => s.value === subtype);
}

/** Label legible de un subtipo (o el value crudo si no se encuentra). */
export function acctSubtypeLabel(
  type: AcctType,
  subtype: string | null,
): string | null {
  if (!subtype) return null;
  return ACCT_SUBTYPES[type].find((s) => s.value === subtype)?.label ?? subtype;
}

export function acctTypeLabel(type: AcctType): string {
  return ACCT_TYPE_LABEL[type] ?? type;
}

/** Tono de badge por tipo de cuenta (paleta del sistema). */
export function acctTypeBadgeTone(
  type: AcctType,
): "neutral" | "info" | "success" | "danger" | "warning" | "wine" {
  switch (type) {
    case "A":
      return "info";
    case "P":
      return "warning";
    case "PT":
      return "wine";
    case "I":
      return "success";
    case "CGS":
      return "danger";
    case "G":
      return "neutral";
  }
}

/**
 * Lado normal de la cuenta según su tipo.
 *  - debe-normal (debit): Activo, Costo de ventas, Gastos.
 *  - haber-normal (credit): Pasivo, Patrimonio, Ingresos.
 *
 * El saldo de una cuenta se computa como (debe − haber) si es debe-normal,
 * o (haber − debe) si es haber-normal, para que un saldo positivo sea el
 * "natural" del tipo.
 */
export function normalSide(type: AcctType): "debit" | "credit" {
  return type === "A" || type === "CGS" || type === "G" ? "debit" : "credit";
}

/** Nodo del árbol del plan de cuentas (cuenta + hijos anidados). */
export type AccountNode = Account & { children: AccountNode[] };

/**
 * Profundidad de una cuenta a partir de su code (1, 1.1, 1.1.2 → 0, 1, 2).
 * Útil para el indentado del árbol sin recorrer parents.
 */
export function accountDepth(code: string): number {
  return (code.match(/\./g)?.length ?? 0);
}

/** Code del padre derivado del code (1.1.2 → 1.1, 4 → null). */
export function parentCode(code: string): string | null {
  const idx = code.lastIndexOf(".");
  return idx === -1 ? null : code.slice(0, idx);
}

/**
 * Compara dos codes jerárquicos de forma natural ("1.2" antes de "1.10",
 * "2" antes de "10"). Cada segmento numérico se compara como número.
 */
export function compareCodes(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] !== undefined ? Number(pa[i]) : -1;
    const nb = pb[i] !== undefined ? Number(pb[i]) : -1;
    const va = Number.isFinite(na) ? na : 0;
    const vb = Number.isFinite(nb) ? nb : 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

/**
 * Construye el árbol del plan de cuentas anidando por code/parent.
 *
 * Anida por prefijo del `code` (parent = code sin el último segmento) en vez
 * de por `parent_id`, así funciona aunque el `parent_id` no esté seteado (el
 * code es la fuente de verdad de la jerarquía). Cada nivel queda ordenado
 * naturalmente por code. Las cuentas huérfanas (sin padre presente) suben a
 * la raíz para no perderse.
 */
export function buildAccountTree(accounts: Account[]): AccountNode[] {
  const byCode = new Map<string, AccountNode>();
  for (const a of accounts) {
    byCode.set(a.code, { ...a, children: [] });
  }

  const roots: AccountNode[] = [];
  for (const node of byCode.values()) {
    const pc = parentCode(node.code);
    const parent = pc ? byCode.get(pc) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortRec = (nodes: AccountNode[]) => {
    nodes.sort((x, y) => compareCodes(x.code, y.code));
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);

  return roots;
}

/** Aplana un árbol a una lista en orden de despliegue (DFS por code). */
export function flattenTree(nodes: AccountNode[]): AccountNode[] {
  const out: AccountNode[] = [];
  const walk = (ns: AccountNode[]) => {
    for (const n of ns) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export type AccountActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof AccountInput, string>>;
  createdCode?: string;
};

/**
 * Validación manual del input de cuenta (sin zod, patrón del repo).
 * - code: requerido, formato jerárquico (segmentos numéricos separados por ".").
 * - name: requerido.
 * - type: uno de los 6 tipos.
 */
export function validateAccountInput(input: Partial<AccountInput>): {
  input?: AccountInput;
  fieldErrors?: AccountActionState["fieldErrors"];
} {
  const errors: AccountActionState["fieldErrors"] = {};

  const code = (input.code ?? "").trim();
  if (!code) {
    errors.code = "Indica el código de la cuenta (ej. 6.20).";
  } else if (!/^\d+(\.\d+)*$/.test(code)) {
    errors.code = "El código debe ser numérico jerárquico (ej. 6.20).";
  }

  const name = (input.name ?? "").trim();
  if (!name) errors.name = "Indica el nombre de la cuenta.";

  const type =
    input.type && ACCT_TYPES.includes(input.type) ? input.type : undefined;
  if (!type) errors.type = "Elige el tipo de cuenta.";

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  const subtype = input.subtype?.trim() || null;

  return {
    input: {
      code,
      name,
      type: type!,
      parent_id: input.parent_id?.trim() || null,
      // El subtipo solo es válido para su tipo; si no, se descarta (no bloquea).
      subtype: isValidSubtype(type!, subtype) ? subtype : null,
      is_postable: input.is_postable ?? true,
      notes: input.notes?.trim() || null,
    },
  };
}
