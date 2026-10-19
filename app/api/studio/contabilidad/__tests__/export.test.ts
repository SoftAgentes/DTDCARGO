/**
 * SDD-0557 · GET /api/studio/contabilidad/export?tipo=diario
 *
 * La sesión se mockea (como en las rutas de Tracking). El gate usa la MATRIZ
 * real (`canAccessModule` de rbac.ts) con el módulo que la ruta le pasa: si la
 * ruta se olvida del gate o le pasa otro módulo, el rol commercial entra.
 * El contrato AST de `rbac-api-guard.test.ts` fija además que el módulo sea
 * `accounting` y que el corte vaya antes de leer.
 */
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dobleListados, type Fila } from "@/lib/studio/__tests__/listados-double";
import { DIARIO_CSV_HEADERS } from "@/lib/studio/accounting/libro-control";

const h = vi.hoisted(() => ({
  client: null as unknown,
  role: "accounting" as string,
  sinSesion: false,
}));

vi.mock("@/lib/http/studio-session", () => ({
  requireStudioSession: async () =>
    h.sinSesion
      ? NextResponse.json({ error: "No autorizado." }, { status: 401 })
      : { supabase: h.client, user: { id: "u1" }, tenantId: "t1", role: h.role },
}));
vi.mock("@/lib/studio/rbac-guard", async () => {
  const { canAccessModule } = await import("@/lib/studio/rbac");
  return {
    moduleViewDenial: async (_s: unknown, moduleId: string) =>
      canAccessModule(h.role as never, moduleId, {}) ? null : "No tienes permiso para ver esto.",
  };
});

import { GET } from "../export/route";

const PLAN: Fila[] = [
  { id: "banco", code: "1.1.1", name: "Banco", type: "A", tenant_id: "t1", parent_id: null, qbo_type: null, subtype: null, is_postable: true, notes: null, created_at: "", updated_at: "" },
  { id: "cap", code: "3.1", name: "Capital", type: "PT", tenant_id: "t1", parent_id: null, qbo_type: null, subtype: null, is_postable: true, notes: null, created_at: "", updated_at: "" },
];
const asiento = (id: string, entry_date: string, status: string, memo: string): Fila => ({
  id, entry_code: `A-${id}`, entry_date, memo, status, source: "manual", deleted_at: null,
});

function sembrar() {
  h.client = dobleListados(
    {
      accounts: PLAN,
      journal_entries: [
        asiento("e1", "2025-03-01", "asentado", '=HYPERLINK("http://x","y")'),
        asiento("e2", "2025-03-10", "asentado", "Aporte"),
        asiento("e3", "2025-03-11", "anulado", "Anulado"),
      ],
      journal_lines: [
        { id: "l1", entry_id: "e1", account_id: "banco", debit: 100, credit: 0, line_memo: null },
        { id: "l2", entry_id: "e1", account_id: "cap", debit: 0, credit: 100, line_memo: null },
        { id: "l3", entry_id: "e2", account_id: "banco", debit: 50, credit: 0, line_memo: null },
        { id: "l4", entry_id: "e2", account_id: "cap", debit: 0, credit: 50, line_memo: null },
        { id: "l5", entry_id: "e3", account_id: "banco", debit: 9, credit: 0, line_memo: null },
        { id: "l6", entry_id: "e3", account_id: "cap", debit: 0, credit: 9, line_memo: null },
      ],
    },
    { serverCap: 1000 },
  ).client;
}

const pedir = (qs: string) => GET(new Request(`http://studio.test/api/studio/contabilidad/export${qs}`));

beforeEach(() => {
  h.role = "accounting";
  h.sinSesion = false;
  sembrar();
});

describe("acceso", () => {
  it("sin sesión: 401", async () => {
    h.sinSesion = true;
    expect((await pedir("?tipo=diario")).status).toBe(401);
  });

  it("rol commercial: 403 con el mensaje del gate", async () => {
    h.role = "commercial";
    const r = await pedir("?tipo=diario");
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe("No tienes permiso para ver esto.");
  });

  it("accounting y admin: 200", async () => {
    expect((await pedir("?tipo=diario")).status).toBe(200);
    h.role = "admin";
    expect((await pedir("?tipo=diario")).status).toBe(200);
  });
});

describe("el CSV del diario", () => {
  it("adjunto, privado, BOM, cabecera exacta y una fila por línea asentada", async () => {
    const r = await pedir("?tipo=diario");
    expect(r.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(r.headers.get("Content-Disposition")).toMatch(/^attachment; filename="diario-inicio-a-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    // `text()` se come el BOM al decodificar: se mira en los bytes.
    const bytes = new Uint8Array(await r.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const cuerpo = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    const [cabecera, ...filas] = cuerpo.slice(1).split("\r\n");
    expect(cabecera).toBe(DIARIO_CSV_HEADERS.join(","));
    expect(filas).toHaveLength(4);
    expect(cuerpo).not.toContain("Anulado");
  });

  it("neutraliza fórmulas en los conceptos", async () => {
    const cuerpo = await (await pedir("?tipo=diario")).text();
    expect(cuerpo).toContain(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(cuerpo).not.toMatch(/(^|,)=HYPERLINK/m);
  });

  it("desde y hasta válidos: solo ese rango y el nombre lo dice", async () => {
    const r = await pedir("?tipo=diario&desde=2025-03-05&hasta=2025-03-31");
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Disposition")).toBe('attachment; filename="diario-2025-03-05-a-2025-03-31.csv"');
    const filas = (await r.text()).replace(/^﻿/, "").split("\r\n").slice(1);
    expect(filas).toHaveLength(2);
    expect(filas.every((f) => f.startsWith("2025-03-10,"))).toBe(true);
  });
});

describe("validación", () => {
  it.each([
    ["?tipo=otro", /tipo/],
    ["?tipo=diario&desde=2025-13-01", /no es válida/],
    ["?tipo=diario&desde=2025-03-10&hasta=2025-03-01", /al revés/],
  ])("%s → 400", async (qs, mensaje) => {
    const r = await pedir(qs);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(mensaje);
  });
});
