/** SDD-0578. Authored in P1; execution is reserved for the coordinated P2 turn. */
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  manualShipmentCodeError, membershipRpcArgs, normalizeManualShipmentCode,
  normalFlowError, observedRatesTotal, validateCloseManifestInput, validateMembershipInput,
} from "../normal-flow";
import { readNormalContext, NormalReadError } from "../queries";
import type { NormalContextPage, NormalReceipt, ObservedRates } from "../types";

const id = (n: number) => `00000000-0000-0000-0000-${n.toString(16).padStart(12, "0")}`;
const version = "f".repeat(32);
const group = (client = 1, receipt = 100, code = "S-2026-1000") => ({
  clientId: id(client), service: "puerta_a_puerta_DDP", destinationId: id(90), code,
  groupId: null, expectedGroupRevision: null, receipts: [{ receiptId: id(receipt), sourceVersion: version }],
});
const form = () => ({ operation: "form", containerId: id(50), expectedContainerRevision: 0,
  reference: id(99), reason: "Carga revisada", groups: [group()] });

describe("manual code compatible with the 0326 public reader", () => {
  it("normalizes only SQL btrim's ASCII edge spaces and uppercase", () => {
    expect(normalizeManualShipmentCode("  s-1987-001234  ")).toBe("S-1987-001234");
    expect(manualShipmentCodeError("S-1987-001234")).toBeNull();
    expect(manualShipmentCodeError("S-0000-0000")).toBeNull();
    expect(manualShipmentCodeError("S-2026-0123456789")).toBeNull();
  });
  it.each(["S-2026-123", "S-2026-01234567890", "S-26-1234", "C-2026-1234", "S-2026-12 34",
    "\tS-2026-1234", "S-2026-1234\n", "\u00a0S-2026-1234\u00a0", null])("rejects %j without inventing an auto number", (code) => {
    expect(manualShipmentCodeError(code)).not.toBeNull();
  });
});

describe("reviewed membership intentions", () => {
  it("keeps versions, canonical code, reason and reference; accepts an old year", () => {
    const raw = form(); raw.groups[0].code = " s-1987-001234 ";
    const { input, fieldErrors } = validateMembershipInput(raw);
    expect(fieldErrors).toBeUndefined();
    expect(input?.groups[0].code).toBe("S-1987-001234");
    expect(membershipRpcArgs(input!)).toEqual({ p_operation: "form", p_container_id: id(50),
      p_expected_revision: 0, p_reference: id(99), p_reason: "Carga revisada", p_groups: input!.groups });
  });
  it("rejects the same receipt in two client groups, not a silently deduplicated subset", () => {
    const raw = form(); raw.groups.push(group(2, 100, "S-2026-1001"));
    expect(validateMembershipInput(raw).input).toBeUndefined();
  });
  it("rejects two groups for one client and canonical duplicate codes", () => {
    const raw = form(); raw.groups.push(group(1, 101, "S-2026-1001"));
    expect(validateMembershipInput(raw).input).toBeUndefined();
    raw.groups[1] = group(2, 101, " s-2026-1000 ");
    expect(validateMembershipInput(raw).input).toBeUndefined();
  });
  it("extending has one target and new receipt versions, without a code", () => {
    const raw = { ...form(), operation: "extend", expectedContainerRevision: 2,
      groups: [{ ...group(), groupId: id(70), expectedGroupRevision: 1, code: null }] };
    expect(validateMembershipInput(raw).input?.groups[0]).toMatchObject({ groupId: id(70), expectedGroupRevision: 1, code: null });
    expect(validateMembershipInput({ ...raw, groups: [...raw.groups, { ...raw.groups[0], clientId: id(2) }] }).input).toBeUndefined();
    expect(validateMembershipInput({ ...raw, groups: [{ ...raw.groups[0], code: "S-2026-1999" }] }).input).toBeUndefined();
  });
  it.each(["fcl_directo", "fcl_bodega", "transporte_terrestre", "consolidacion"])("does not admit service %s into this prospective path", (service) => {
    const raw = form(); raw.groups[0].service = service;
    expect(validateMembershipInput(raw).input).toBeUndefined();
  });
  it("does not substitute an absent source version or revision with zero", () => {
    expect(validateMembershipInput({ ...form(), expectedContainerRevision: null }).input).toBeUndefined();
    const raw = form(); raw.groups[0].receipts[0].sourceVersion = "";
    expect(validateMembershipInput(raw).input).toBeUndefined();
  });
  it("requires a reason for confirmation and closing without granting authority", () => {
    expect(validateMembershipInput({ ...form(), reason: " " }).fieldErrors).toHaveProperty("reason");
    expect(validateCloseManifestInput({ containerId: id(50), expectedContainerRevision: 2,
      reference: id(99), reason: "Estiba revisada" }).input).toBeDefined();
    expect(validateCloseManifestInput({ containerId: id(50), reference: id(99), reason: "Estiba revisada" }).input).toBeUndefined();
  });
});

const rates = (known: string, missing: string[] = [], complete = true): ObservedRates => ({
  membershipRevision: 1, observedAt: "2026-10-21T14:00:00Z", snapshotIds: [], receiptCount: 2,
  missingReceiptIds: missing, knownSubtotalCents: known, totalCents: missing.length || !complete ? null : known, complete,
});
describe("observed rates never become a financial total by approximation", () => {
  it("sums integer cents beyond the safe Number boundary exactly", () => {
    expect(observedRatesTotal([rates("9007199254740991"), rates("2")])).toEqual({
      knownSubtotalCents: "9007199254740993", totalCents: "9007199254740993", missing: 0, complete: true,
    });
  });
  it("retains a known subtotal while a new receipt has no tariff or a read is incomplete", () => {
    expect(observedRatesTotal([rates("15000"), rates("0", [id(110)])])).toMatchObject({ knownSubtotalCents: "15000", totalCents: null, missing: 1 });
    expect(observedRatesTotal([rates("15000", [], false)]).totalCents).toBeNull();
  });
  it("rejects an invalid amount as an error, not a missing/zero price", () => {
    expect(() => observedRatesTotal([rates("NaN")])).toThrow();
    expect(() => observedRatesTotal([{ ...rates("15000"), totalCents: "20000" }])).toThrow();
  });
  it("does not expose another tenant or a raw SQL error", () => {
    expect(normalFlowError({ hint: "dtd-client-normal", message: "NORMAL_CODE_UNAVAILABLE: private detail" })).toBe("Código no disponible.");
    expect(normalFlowError({ message: "relation secrets tenant-X" })).not.toContain("tenant-X");
  });
});

const receipt = (n: number): NormalReceipt => ({ receiptId: id(n), receiptCode: `WR-${n}`, warehouseId: id(8),
  clientId: id(1), clientMarkbox: "DTD-1001", clientName: null, service: null, destination: null,
  measures: { cbm: "1.000", weightKg: "100.00", boxes: 1 }, sourceVersion: version, eligible: true,
  blockedReason: null, shipmentId: null, groupId: null });
const page = (receipts: NormalReceipt[], nextReceiptId: string | null, readToken = "complete-input"): NormalContextPage => ({
  availability: "ready", readToken, observedAt: "2026-10-21T14:00:00Z", manifest: null,
  destinations: [{ id: id(90), label: "Valencia" }], receipts, nextReceiptId,
});

describe("dedicated complete reader", () => {
  it("fetches every page, including records after the old 100/200 display limits", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: page(Array.from({ length: 200 }, (_, i) => receipt(i+100)), id(299)), error: null })
      .mockResolvedValueOnce({ data: page([receipt(300)], null), error: null });
    const context = await readNormalContext({ rpc } as unknown as SupabaseClient, id(50));
    expect(context.complete).toBe(true); expect(context.receipts).toHaveLength(201);
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_after_receipt_id: id(299), p_page_size: 200 });
  });
  it("rejects a changed fingerprint, repeated cursor and duplicate receipt across pages", async () => {
    const changed = vi.fn().mockResolvedValueOnce({ data: page([receipt(100)], id(100)), error: null })
      .mockResolvedValueOnce({ data: page([receipt(101)], null, "changed-input"), error: null });
    await expect(readNormalContext({ rpc: changed } as unknown as SupabaseClient, id(50))).rejects.toBeInstanceOf(NormalReadError);
    const duplicate = vi.fn().mockResolvedValueOnce({ data: page([receipt(100)], id(100)), error: null })
      .mockResolvedValueOnce({ data: page([receipt(100)], null), error: null });
    await expect(readNormalContext({ rpc: duplicate } as unknown as SupabaseClient, id(50))).rejects.toBeInstanceOf(NormalReadError);
  });
  it("does not call a failed/missing-schema page an empty complete selection", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(readNormalContext({ rpc } as unknown as SupabaseClient, id(50))).rejects.toMatchObject({ code: "missing_schema" });
  });
});
