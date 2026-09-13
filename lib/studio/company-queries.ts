/**
 * Datos de la empresa (SDD-0120) — queries server-side.
 *
 * `getCompanyData(supabase)` arma todo lo que consume la sección
 * "Datos de la empresa" del admin: identidad fiscal (fila de `tenants`),
 * oficinas y cuentas bancarias. RLS filtra por tenant del user logueado.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CompanyBankAccount,
  CompanyData,
  CompanyIdentity,
  CompanyOffice,
} from "./company-types";

interface TenantRow {
  legal_name: string | null;
  trade_name: string | null;
  rif: string | null;
  commercial_email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  iva_enabled: boolean | null;
  iva_rate: number | string | null;
  islr_rate: number | string | null;
  igtf_rate: number | string | null;
}

interface OfficeRow {
  id: string;
  country: string;
  name: string;
  address: string;
  sort_order: number | null;
}

interface BankRow {
  id: string;
  bank_name: string;
  account_type: string;
  currency: string;
  account_number: string;
  sort_order: number | null;
}

const EMPTY_IDENTITY: CompanyIdentity = {
  legalName: "",
  tradeName: "",
  rif: "",
  commercialEmail: "",
  phone: "",
  whatsapp: "",
  website: "",
  ivaEnabled: true,
  ivaRate: 16,
  islrRate: 3,
  igtfRate: 3,
};

function num(v: number | string | null, fallback: number): number {
  if (v === null) return fallback;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Resuelve el tenant_id del user logueado (primer membership). null si no hay
 * sesión/membership. Mismo patrón que rbac-guard / feature flags.
 */
async function resolveTenantId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

export async function getCompanyData(
  supabase: SupabaseClient,
): Promise<CompanyData> {
  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) {
    return { identity: EMPTY_IDENTITY, offices: [], bankAccounts: [] };
  }
  return getCompanyDataForTenant(supabase, tenantId);
}

/**
 * Igual que `getCompanyData` pero con el tenant DADO, sin resolverlo por
 * membresía.
 *
 * 🔴 Existe por el portal (SDD-0298). `resolveTenantId` lee `user_tenants`, y un
 * cliente del portal **no está ahí**: medido el 2026-08-25, de 133 cuentas de
 * portal sólo 2 aparecen en `user_tenants`. Resultado — la factura que se bajaba
 * el cliente salía sin identidad fiscal del emisor y sin datos de pago, mientras
 * la copia del Studio los llevaba. Y es la del cliente la que va al contador.
 *
 * El llamador prueba primero la propiedad con el cliente del usuario y recién
 * después lee con el admin, acotado al tenant probado — el patrón de siempre
 * para las lecturas del portal.
 *
 * 🔴 SDD-0462: con el admin no hay RLS que acote, así que oficinas y cuentas se
 * filtran por ese tenant igual que la fila de `tenants`. Sin el filtro, el PDF
 * de la factura del portal imprimía las cuentas bancarias de TODAS las empresas.
 */
export async function getCompanyDataForTenant(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<CompanyData> {

  const [tenantRes, officesRes, banksRes] = await Promise.all([
    supabase
      .from("tenants")
      .select(
        "legal_name, trade_name, rif, commercial_email, phone, whatsapp, website, iva_enabled, iva_rate, islr_rate, igtf_rate",
      )
      .eq("id", tenantId)
      .maybeSingle<TenantRow>(),
    supabase
      .from("company_offices")
      .select("id, country, name, address, sort_order")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("company_bank_accounts")
      .select("id, bank_name, account_type, currency, account_number, sort_order")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const t = tenantRes.data;
  const identity: CompanyIdentity = t
    ? {
        legalName: t.legal_name ?? "",
        tradeName: t.trade_name ?? "",
        rif: t.rif ?? "",
        commercialEmail: t.commercial_email ?? "",
        phone: t.phone ?? "",
        whatsapp: t.whatsapp ?? "",
        website: t.website ?? "",
        ivaEnabled: t.iva_enabled ?? true,
        ivaRate: num(t.iva_rate, 16),
        islrRate: num(t.islr_rate, 3),
        igtfRate: num(t.igtf_rate, 3),
      }
    : EMPTY_IDENTITY;

  const offices: CompanyOffice[] = (officesRes.data ?? []).map((o: OfficeRow) => ({
    id: o.id,
    country: (o.country === "CN" ? "CN" : "VE") as CompanyOffice["country"],
    name: o.name,
    address: o.address,
    sortOrder: o.sort_order ?? 0,
  }));

  const bankAccounts: CompanyBankAccount[] = (banksRes.data ?? []).map((b: BankRow) => ({
    id: b.id,
    bankName: b.bank_name,
    accountType: b.account_type,
    currency: (["USD", "VES", "CNY"].includes(b.currency)
      ? b.currency
      : "USD") as CompanyBankAccount["currency"],
    accountNumber: b.account_number,
    sortOrder: b.sort_order ?? 0,
  }));

  return { identity, offices, bankAccounts };
}
