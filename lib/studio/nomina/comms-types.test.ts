// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  validateSendCommInput,
  commTypeRequiresAck,
  commNeedsAck,
  commIsUnread,
  isCommType,
  isCommRefKind,
  COMM_TYPES,
  COMM_REF_KINDS,
} from "./comms-types";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("comms-types · enums", () => {
  it("COMM_TYPES espeja el Norte (4 tipos)", () => {
    expect(COMM_TYPES).toEqual(["recibo", "aviso", "llamado", "amonestacion"]);
  });
  it("isCommType / isCommRefKind", () => {
    expect(isCommType("amonestacion")).toBe(true);
    expect(isCommType("otro")).toBe(false);
    expect(isCommRefKind("payroll_run_line")).toBe(true);
    expect(isCommRefKind("clients")).toBe(false);
    expect(COMM_REF_KINDS).toContain("warning");
  });
  it("llamado/amonestacion requieren acuse; recibo/aviso no", () => {
    expect(commTypeRequiresAck("llamado")).toBe(true);
    expect(commTypeRequiresAck("amonestacion")).toBe(true);
    expect(commTypeRequiresAck("recibo")).toBe(false);
    expect(commTypeRequiresAck("aviso")).toBe(false);
  });
});

describe("comms-types · helpers de estado", () => {
  it("commNeedsAck: requires_ack && !acked_at", () => {
    expect(commNeedsAck({ requires_ack: true, acked_at: null })).toBe(true);
    expect(commNeedsAck({ requires_ack: true, acked_at: "2026-06-27T00:00:00Z" })).toBe(false);
    expect(commNeedsAck({ requires_ack: false, acked_at: null })).toBe(false);
  });
  it("commIsUnread: !read_at", () => {
    expect(commIsUnread({ read_at: null })).toBe(true);
    expect(commIsUnread({ read_at: "2026-06-27T00:00:00Z" })).toBe(false);
  });
});

describe("validateSendCommInput", () => {
  it("acepta un comm válido y deriva requires_ack del tipo", () => {
    const { input, fieldErrors } = validateSendCommInput({
      employee_id: UUID_A,
      type: "amonestacion",
      title: "Llegada tarde reiterada",
      body: "Se deja constancia...",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input).not.toBeNull();
    expect(input!.requires_ack).toBe(true); // derivado de amonestacion
    expect(input!.ref_kind).toBeNull();
    expect(input!.ref_id).toBeNull();
  });

  it("respeta requires_ack explícito sobre el derivado", () => {
    const { input } = validateSendCommInput({
      employee_id: UUID_A,
      type: "aviso",
      title: "Aviso importante",
      body: "Confirma por favor",
      requires_ack: "1",
    });
    expect(input!.requires_ack).toBe(true);
  });

  it("rechaza employee_id no-uuid", () => {
    const { fieldErrors } = validateSendCommInput({
      employee_id: "no-soy-uuid",
      type: "aviso",
      title: "x",
      body: "y",
    });
    expect(fieldErrors?.employee_id).toBeTruthy();
  });

  it("rechaza tipo fuera del enum", () => {
    const { fieldErrors } = validateSendCommInput({
      employee_id: UUID_A,
      type: "spam",
      title: "x",
      body: "y",
    });
    expect(fieldErrors?.type).toBeTruthy();
  });

  it("exige title y body", () => {
    const { fieldErrors } = validateSendCommInput({
      employee_id: UUID_A,
      type: "aviso",
      title: "  ",
      body: "",
    });
    expect(fieldErrors?.title).toBeTruthy();
    expect(fieldErrors?.body).toBeTruthy();
  });

  it("ref_kind/ref_id deben venir EN PAR (espejo del check de la DB)", () => {
    const onlyKind = validateSendCommInput({
      employee_id: UUID_A,
      type: "aviso",
      title: "x",
      body: "y",
      ref_kind: "warning",
    });
    expect(onlyKind.fieldErrors?.ref_id).toBeTruthy();

    const onlyId = validateSendCommInput({
      employee_id: UUID_A,
      type: "aviso",
      title: "x",
      body: "y",
      ref_id: UUID_B,
    });
    expect(onlyId.fieldErrors?.ref_id).toBeTruthy();

    const both = validateSendCommInput({
      employee_id: UUID_A,
      type: "aviso",
      title: "x",
      body: "y",
      ref_kind: "warning",
      ref_id: UUID_B,
    });
    expect(both.fieldErrors).toBeUndefined();
    expect(both.input!.ref_kind).toBe("warning");
    expect(both.input!.ref_id).toBe(UUID_B);
  });

  it("rechaza ref_kind fuera del enum aunque venga el id", () => {
    const { fieldErrors } = validateSendCommInput({
      employee_id: UUID_A,
      type: "aviso",
      title: "x",
      body: "y",
      ref_kind: "clients",
      ref_id: UUID_B,
    });
    expect(fieldErrors?.ref_kind).toBeTruthy();
  });
});
