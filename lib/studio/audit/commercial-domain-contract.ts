export const D3_COMMERCIAL_TABLES = [
  "renditions",
  "purchase_orders",
  "sales_orders",
  "prealertas",
] as const;

export const D3_FORBIDDEN_AUDIT_KEYS = [
  "client_name",
  "supplier_name",
  "notes",
  "total_cost_usd",
  "subtotal_usd",
  "total_usd",
  "third_party_usd",
  "local_revenue_usd",
  "net_to_operadora_usd",
] as const;
