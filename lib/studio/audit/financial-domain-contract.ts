export const D2_FINANCIAL_TABLES = [
  "accounts",
  "journal_entries",
  "invoices",
  "payment_receipts",
  "suppliers",
  "supplier_bills",
  "supplier_payments",
] as const;

export type D2FinancialTable = (typeof D2_FINANCIAL_TABLES)[number];

export const D2_FORBIDDEN_AUDIT_KEYS = [
  "name",
  "client_name",
  "supplier_name",
  "contact_name",
  "contact_phone",
  "contact_email",
  "tax_id",
  "reference",
  "notes",
  "amount",
  "total_amount",
  "paid_amount",
] as const;

export function isD2FinancialTable(value: string): value is D2FinancialTable {
  return (D2_FINANCIAL_TABLES as readonly string[]).includes(value);
}
