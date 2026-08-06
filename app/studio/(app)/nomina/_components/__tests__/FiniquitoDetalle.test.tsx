import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Settlement } from "@/lib/studio/nomina/settlement-types";
import { FiniquitoDetalle } from "../FiniquitoDetalle";

const actions = vi.hoisted(() => ({
  anular: vi.fn(),
  lines: vi.fn(),
  confirmar: vi.fn(),
  regenerar: vi.fn(),
  eliminar: vi.fn(),
}));

vi.mock("../../actions", () => ({
  anularFiniquitoAction: actions.anular,
  listSettlementLinesAction: actions.lines,
  confirmarFiniquitoAction: actions.confirmar,
  regenerarFiniquitoAction: actions.regenerar,
  softDeleteFiniquitoAction: actions.eliminar,
}));

const settlement: Settlement = {
  id: "40000000-0000-0000-0000-000000000001",
  tenant_id: "10000000-0000-0000-0000-000000000001",
  settlement_code: "FIN-0001",
  employee_id: "60000000-0000-0000-0000-000000000001",
  employee_code: "EMP-0001",
  employee_name: "Persona de prueba",
  termination_cause: "renuncia_76",
  hire_date: "2020-01-01",
  termination_date: "2026-07-31",
  base_salary_usd: 1000,
  rules_snapshot: {},
  status: "confirmado",
  total_prestaciones_usd: 1000,
  total_fracciones_usd: 200,
  total_indemnizacion_usd: 0,
  total_intereses_usd: 50,
  total_deductions_usd: 0,
  total_net_usd: 1250,
  salario_integral_usd: 1100,
  pdf_path: null,
  journal_entry_id: "30000000-0000-0000-0000-000000000001",
  confirmed_at: "2026-07-31T12:00:00.000Z",
  notes: null,
  created_by: "20000000-0000-0000-0000-000000000001",
  created_at: "2026-07-31T11:00:00.000Z",
  updated_at: "2026-07-31T12:00:00.000Z",
  deleted_at: null,
};

describe("FiniquitoDetalle · anulación R3 SDD-0226", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.lines.mockResolvedValue({ lines: [] });
    actions.anular.mockResolvedValue({ ok: true });
  });

  it("el trigger solo abre el diálogo y explica la consecuencia", async () => {
    render(<FiniquitoDetalle settlement={settlement} onBack={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Anular" }));

    expect(actions.anular).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Anular finiquito FIN-0001" })).toBeVisible();
    expect(screen.getByText(/asiento contable asociado/)).toBeVisible();
    expect(screen.getByText(/vínculo contable se conservarán/)).toBeVisible();
  });

  it("exige motivo y alternativa accesible antes de enviar una sola solicitud", async () => {
    const onBack = vi.fn();
    render(<FiniquitoDetalle settlement={settlement} onBack={onBack} />);
    await userEvent.click(screen.getByRole("button", { name: "Anular" }));

    await userEvent.click(screen.getByLabelText(/prefiero anular con un clic/));
    await userEvent.click(screen.getByRole("button", { name: "Anular finiquito" }));
    expect(actions.anular).not.toHaveBeenCalled();

    await userEvent.type(
      screen.getByLabelText("Motivo de la anulación"),
      "Documento duplicado después de conciliación",
    );
    await userEvent.click(screen.getByRole("button", { name: "Anular finiquito" }));

    await waitFor(() => expect(actions.anular).toHaveBeenCalledTimes(1));
    expect(actions.anular).toHaveBeenCalledWith(
      settlement.id,
      "Documento duplicado después de conciliación",
      expect.stringMatching(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
    );
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  });

  it("conserva diálogo, motivo y error recuperable cuando el servidor rechaza", async () => {
    actions.anular.mockResolvedValue({ error: "El finiquito cambió. Actualiza la vista." });
    render(<FiniquitoDetalle settlement={settlement} onBack={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Anular" }));
    const reason = screen.getByLabelText("Motivo de la anulación");
    await userEvent.type(reason, "Estado revisado con el expediente");
    await userEvent.click(screen.getByLabelText(/prefiero anular con un clic/));
    await userEvent.click(screen.getByRole("button", { name: "Anular finiquito" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El finiquito cambió");
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(reason).toHaveValue("Estado revisado con el expediente");
  });

  it("durante pending no permite cancelar ni repetir", async () => {
    let resolveAction!: (value: { ok: true }) => void;
    actions.anular.mockReturnValue(new Promise((resolve) => { resolveAction = resolve; }));
    const onBack = vi.fn();
    render(<FiniquitoDetalle settlement={settlement} onBack={onBack} />);
    await userEvent.click(screen.getByRole("button", { name: "Anular" }));
    await userEvent.type(screen.getByLabelText("Motivo de la anulación"), "Revisión completa del expediente");
    await userEvent.click(screen.getByLabelText(/prefiero anular con un clic/));
    await userEvent.click(screen.getByRole("button", { name: "Anular finiquito" }));

    expect(screen.getByRole("button", { name: "Procesando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(actions.anular).toHaveBeenCalledTimes(1);

    resolveAction({ ok: true });
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  });
});
