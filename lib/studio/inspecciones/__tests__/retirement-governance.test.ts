import { describe, expect, it, vi } from "vitest";
import { validateInspectionRetirementInput } from "../validators";
import { retireInspectionReportGoverned } from "../queries";

const REPORT_ID = "30000000-0000-4000-8000-000000000001";

describe("validateInspectionRetirementInput", () => {
  it("normaliza una decisión válida", () => {
    expect(
      validateInspectionRetirementInput({
        report_id: REPORT_ID,
        from: "final",
        reason: "  Reporte emitido para la orden equivocada  ",
        request_ref: "inspection-retire:test-1",
      }),
    ).toEqual({
      ok: true,
      input: {
        report_id: REPORT_ID,
        from: "final",
        reason: "Reporte emitido para la orden equivocada",
        request_ref: "inspection-retire:test-1",
      },
    });
  });

  it("rechaza id, estado, motivo y referencia inválidos", () => {
    expect(
      validateInspectionRetirementInput({
        report_id: "bad",
        from: "archived",
        reason: "x",
        request_ref: "ref con espacios",
      }).ok,
    ).toBe(false);
    expect(
      validateInspectionRetirementInput({
        report_id: REPORT_ID,
        from: "archived",
        reason: "motivo válido",
        request_ref: "inspection-retire:test-2",
      }).ok,
    ).toBe(false);
    expect(
      validateInspectionRetirementInput({
        report_id: REPORT_ID,
        from: "draft",
        reason: "x",
        request_ref: "inspection-retire:test-3",
      }).ok,
    ).toBe(false);
    expect(
      validateInspectionRetirementInput({
        report_id: REPORT_ID,
        from: "draft",
        reason: "motivo válido",
        request_ref: "ref con espacios",
      }).ok,
    ).toBe(false);
  });
});

describe("retireInspectionReportGoverned", () => {
  it("mapea el contrato honesto de retención", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        outcome: "transitioned",
        report_no: "DTD-QC-0001",
        photo_count: 2,
        storage_disposition: "retained_private_objects",
      },
      error: null,
    });
    const result = await retireInspectionReportGoverned(
      { rpc } as never,
      {
        reportId: REPORT_ID,
        expectedStatus: "draft",
        reason: "Reporte duplicado confirmado",
        requestRef: "inspection-retire:test-4",
      },
    );
    expect(result).toEqual({
      outcome: "transitioned",
      reportNo: "DTD-QC-0001",
      photoCount: 2,
      storageDisposition: "retained_private_objects",
    });
    expect(rpc).toHaveBeenCalledWith("retire_inspection_report_governed", {
      p_report_id: REPORT_ID,
      p_expected_status: "draft",
      p_reason: "Reporte duplicado confirmado",
      p_request_ref: "inspection-retire:test-4",
    });
  });

  it("acepta replay con la misma evidencia", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        outcome: "replayed",
        report_no: "DTD-QC-0001",
        photo_count: 0,
        storage_disposition: "retained_private_objects",
      },
      error: null,
    });
    await expect(
      retireInspectionReportGoverned({ rpc } as never, {
        reportId: REPORT_ID,
        expectedStatus: "draft",
        reason: "Reporte duplicado confirmado",
        requestRef: "inspection-retire:test-5",
      }),
    ).resolves.toMatchObject({ outcome: "replayed", photoCount: 0 });
  });

  it("propaga el error del RPC", async () => {
    const dbError = { code: "40001", message: "conflict" };
    const rpc = vi.fn().mockResolvedValue({ data: null, error: dbError });
    await expect(
      retireInspectionReportGoverned({ rpc } as never, {
        reportId: REPORT_ID,
        expectedStatus: "draft",
        reason: "Reporte duplicado confirmado",
        requestRef: "inspection-retire:test-6",
      }),
    ).rejects.toBe(dbError);
  });

  it("rechaza respuestas que afirman borrado u omiten evidencia", async () => {
    for (const data of [
      {
        outcome: "transitioned",
        report_no: "DTD-QC-0001",
        photo_count: 2,
        storage_disposition: "deleted_objects",
      },
      {
        outcome: "transitioned",
        report_no: "",
        photo_count: -1,
        storage_disposition: "retained_private_objects",
      },
    ]) {
      const rpc = vi.fn().mockResolvedValue({ data, error: null });
      await expect(
        retireInspectionReportGoverned({ rpc } as never, {
          reportId: REPORT_ID,
          expectedStatus: "draft",
          reason: "Reporte duplicado confirmado",
          requestRef: "inspection-retire:test-7",
        }),
      ).rejects.toThrow("Respuesta inválida");
    }
  });
});
