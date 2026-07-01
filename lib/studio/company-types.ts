/**
 * Datos de la empresa (SDD-0120) — types, enums, validators.
 *
 * Tres piezas:
 *   · CompanyIdentity  → identidad fiscal + contacto + tasas (columnas de `tenants`).
 *   · CompanyOffice    → oficina CN/VE (tabla `company_offices`).
 *   · CompanyBankAccount → cuenta bancaria (tabla `company_bank_accounts`).
 *
 * Sin Zod (convención del Studio): cada `validate*` devuelve
 * `{ input, fieldErrors }`. La server action corta si hay `fieldErrors`.
 */

// ── Enums lógicos (text + CHECK en DB) ────────────────────────
export const OFFICE_COUNTRIES = ["VE", "CN"] as const;
export type OfficeCountry = (typeof OFFICE_COUNTRIES)[number];

export const BANK_CURRENCIES = ["USD", "VES", "CNY"] as const;
export type BankCurrency = (typeof BANK_CURRENCIES)[number];

// ── Shapes ────────────────────────────────────────────────────
export interface CompanyIdentity {
  legalName: string;
  tradeName: string;
  rif: string;
  commercialEmail: string;
  phone: string;
  whatsapp: string;
  website: string;
  ivaEnabled: boolean;
  ivaRate: number;
  islrRate: number;
  igtfRate: number;
}

export interface CompanyOffice {
  id: string;
  country: OfficeCountry;
  name: string;
  address: string;
  sortOrder: number;
}

export interface CompanyBankAccount {
  id: string;
  bankName: string;
  accountType: string;
  currency: BankCurrency;
  accountNumber: string;
  sortOrder: number;
}

/** Todo lo que consume la sección "Datos de la empresa". */
export interface CompanyData {
  identity: CompanyIdentity;
  offices: CompanyOffice[];
  bankAccounts: CompanyBankAccount[];
}

// ── Estado de las server actions (patrón `{ error }` del Studio) ──
export interface CompanyActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

// ── Labels / helpers de presentación ──────────────────────────
export function officeCountryLabel(c: OfficeCountry): string {
  return c === "VE" ? "Venezuela" : "China";
}

export function bankCurrencyLabel(c: BankCurrency): string {
  switch (c) {
    case "USD":
      return "Dólares · USD";
    case "VES":
      return "Bolívares · VES";
    case "CNY":
      return "Yuan · CNY";
  }
}

// ── Validadores ───────────────────────────────────────────────

// RIF venezolano: una letra de tipo (V/E/J/P/G) + 8 o 9 dígitos.
// Aceptamos con o sin guiones; se normaliza a "J-30182554-9".
const RIF_RE = /^([VEJPG])-?(\d{8,9})-?(\d)?$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function s(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeRif(raw: string): string | null {
  const m = raw.replace(/\s+/g, "").match(RIF_RE);
  if (!m) return null;
  const type = m[1].toUpperCase();
  const body = m[2];
  // RIF canónico = tipo + 9 dígitos (8 cuerpo + 1 verificador). Si vino con
  // 9 en el cuerpo y sin verificador, ya está completo.
  const digits = m[3] ? `${body}${m[3]}` : body;
  if (digits.length < 9) return null;
  return `${type}-${digits.slice(0, 8)}-${digits.slice(8)}`;
}

function parseRate(raw: string): number | null {
  if (raw === "") return null;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

export function validateCompanyIdentityInput(fd: FormData): {
  input?: CompanyIdentity;
  fieldErrors?: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};

  const legalName = s(fd.get("legal_name"));
  const tradeName = s(fd.get("trade_name"));
  const rifRaw = s(fd.get("rif"));
  const commercialEmail = s(fd.get("commercial_email"));
  const phone = s(fd.get("phone"));
  const whatsapp = s(fd.get("whatsapp"));
  const website = s(fd.get("website"));

  if (!legalName) fieldErrors.legal_name = "La razón social es obligatoria.";

  let rif = "";
  if (rifRaw) {
    const norm = normalizeRif(rifRaw);
    if (!norm) fieldErrors.rif = "RIF inválido (ej: J-30182554-9).";
    else rif = norm;
  }

  if (commercialEmail && !EMAIL_RE.test(commercialEmail)) {
    fieldErrors.commercial_email = "Email inválido.";
  }

  const ivaEnabled =
    fd.get("iva_enabled") === "on" ||
    fd.get("iva_enabled") === "true" ||
    fd.get("iva_enabled") === "1";

  const ivaRate = parseRate(s(fd.get("iva_rate")));
  const islrRate = parseRate(s(fd.get("islr_rate")));
  const igtfRate = parseRate(s(fd.get("igtf_rate")));
  if (ivaRate === null) fieldErrors.iva_rate = "Tasa entre 0 y 100.";
  if (islrRate === null) fieldErrors.islr_rate = "Tasa entre 0 y 100.";
  if (igtfRate === null) fieldErrors.igtf_rate = "Tasa entre 0 y 100.";

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  return {
    input: {
      legalName,
      tradeName,
      rif,
      commercialEmail,
      phone,
      whatsapp,
      website,
      ivaEnabled,
      ivaRate: ivaRate as number,
      islrRate: islrRate as number,
      igtfRate: igtfRate as number,
    },
  };
}

export function validateOfficeInput(fd: FormData): {
  input?: Omit<CompanyOffice, "id" | "sortOrder">;
  fieldErrors?: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};

  const countryRaw = s(fd.get("country"));
  const name = s(fd.get("name"));
  const address = s(fd.get("address"));

  if (!(OFFICE_COUNTRIES as readonly string[]).includes(countryRaw)) {
    fieldErrors.country = "Elige un país.";
  }
  if (!name) fieldErrors.name = "El nombre de la oficina es obligatorio.";
  if (!address) fieldErrors.address = "La dirección es obligatoria.";

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  return {
    input: { country: countryRaw as OfficeCountry, name, address },
  };
}

export function validateBankAccountInput(fd: FormData): {
  input?: Omit<CompanyBankAccount, "id" | "sortOrder">;
  fieldErrors?: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};

  const bankName = s(fd.get("bank_name"));
  const accountType = s(fd.get("account_type"));
  const currencyRaw = s(fd.get("currency"));
  const accountNumber = s(fd.get("account_number"));

  if (!bankName) fieldErrors.bank_name = "El banco es obligatorio.";
  if (!accountType) fieldErrors.account_type = "El tipo de cuenta es obligatorio.";
  if (!(BANK_CURRENCIES as readonly string[]).includes(currencyRaw)) {
    fieldErrors.currency = "Elige la moneda.";
  }
  if (!accountNumber) fieldErrors.account_number = "El número de cuenta es obligatorio.";

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  return {
    input: {
      bankName,
      accountType,
      currency: currencyRaw as BankCurrency,
      accountNumber,
    },
  };
}
