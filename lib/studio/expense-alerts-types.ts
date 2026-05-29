/**
 * Tipos del módulo Expense Alerts (SDD-0039 · Parte B.8).
 *
 * La alerta "cargar gastos del contenedor consolidado" cuelga de un
 * shipment (Modelo A). Matchea migración 0075_expense_alerts.
 */

export type ExpenseAlertResolution = "manual" | "auto" | "reverted";

export type ExpenseAlert = {
  id: string;
  tenant_id: string;
  shipment_id: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_reason: ExpenseAlertResolution | null;
};

/** Fila para banner/listado · alerta activa + datos del contenedor. */
export interface ActiveAlertRow {
  id: string;
  shipment_id: string;
  shipment_code: string | null;
  destination: string | null;
  created_at: string;
}
