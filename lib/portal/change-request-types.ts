/**
 * Solicitud de cambio de datos del cliente (SDD-0151). El cliente propone un
 * cambio a sus datos de IDENTIDAD (nombre, cédula/RIF, teléfono) desde el
 * portal; el asesor lo aprueba en el Studio antes de que se aplique a `clients`.
 * Nunca markbox (código) ni email — esos son fijos por diseño.
 *
 * Compartido portal↔studio: el tipo lo lee el editor del portal y la card de
 * aprobación del Studio. Vive en lib/portal (lo origina el cliente); el Studio
 * lo importa sin problema (no cruza la frontera público↔ERP — es todo ERP).
 */

export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export interface ClientChangeRequest {
  id: string;
  tenantId: string;
  clientId: string;
  proposedName: string | null;
  proposedRif: string | null;
  proposedPhone: string | null;
  prevName: string | null;
  prevRif: string | null;
  prevPhone: string | null;
  status: ChangeRequestStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
}

/** Campos editables por el cliente. NO incluye markbox ni email (fijos). */
export type EditableField = "name" | "doc" | "phone";

/** Fila de la DB (snake_case) → dominio. */
export function mapChangeRequestRow(row: {
  id: string;
  tenant_id: string;
  client_id: string;
  proposed_name: string | null;
  proposed_rif: string | null;
  proposed_phone: string | null;
  prev_name: string | null;
  prev_rif: string | null;
  prev_phone: string | null;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
}): ClientChangeRequest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    proposedName: row.proposed_name,
    proposedRif: row.proposed_rif,
    proposedPhone: row.proposed_phone,
    prevName: row.prev_name,
    prevRif: row.prev_rif,
    prevPhone: row.prev_phone,
    status: (["pending", "approved", "rejected"].includes(row.status)
      ? row.status
      : "pending") as ChangeRequestStatus,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    reviewNote: row.review_note,
  };
}

export interface ChangeRequestDiffRow {
  field: EditableField;
  label: string;
  from: string | null;
  to: string;
}

/**
 * Lista SOLO los campos que cambian (proposed no-nulo). El label del documento
 * depende del tipo de cliente (empresa → "RIF", persona → "Cédula / RIF").
 */
export function buildChangeRequestDiff(
  req: ClientChangeRequest,
  isEmpresa: boolean,
): ChangeRequestDiffRow[] {
  const rows: ChangeRequestDiffRow[] = [];
  if (req.proposedName != null) {
    rows.push({
      field: "name",
      label: isEmpresa ? "Razón social" : "Nombre completo",
      from: req.prevName,
      to: req.proposedName,
    });
  }
  if (req.proposedRif != null) {
    rows.push({
      field: "doc",
      label: isEmpresa ? "RIF" : "Cédula / RIF",
      from: req.prevRif,
      to: req.proposedRif,
    });
  }
  if (req.proposedPhone != null) {
    rows.push({
      field: "phone",
      label: "Teléfono",
      from: req.prevPhone,
      to: req.proposedPhone,
    });
  }
  return rows;
}
