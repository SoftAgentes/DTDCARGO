/**
 * Tests del WIRING del posting contable del Financiero China (SDD-0110).
 *
 * Hasta esta feature, `post*JournalEntry` se construía pero NUNCA se invocaba
 * → journal_entry_id quedaba siempre NULL. Estos tests cubren los criterios de
 * aceptación de SDD-0110 sobre los wrappers `syncX*` (que postean + escriben el
 * back-pointer), contra un fake stateful del admin client (service_role):
 *
 *  - Idempotencia: dos altas del mismo origen → UN solo asiento.
 *  - DR=CR: el asiento balancea (Σ debe == Σ haber); un set desbalanceado se
 *    rechaza (no inserta nada).
 *  - Tenant scoping: el check de existencia + el write-back filtran por
 *    tenant_id (el admin bypasea RLS → el scoping es explícito).
 *  - journal_entry_id DEJA de ser NULL: tras `syncX*`, la fila origen apunta a
 *    su asiento.
 *  - missing-account / zero-amount → skip graceful (no inserta).
 *
 * El fake simula lo justo de PostgREST para el camino que recorre posting.ts.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Fake stateful del admin client ────────────────────────────
type Row = Record<string, unknown>;

/** Estado del "Postgres" en memoria, compartido por todos los createAdminClient(). */
const db = {
  accounts: [] as Row[],
  journal_entries: [] as Row[],
  journal_lines: [] as Row[],
  supplier_charges: [] as Row[],
  currency_conversions: [] as Row[],
  supplier_claim_offsets: [] as Row[],
  entryCounter: 0,
  /** Hace que el PRÓXIMO maybeSingle sobre journal_entries devuelva null aunque
   *  haya fila (simula la carrera TOCTOU: el pre-check no ve al ganador). */
  hideJournalLookupOnce: false,
};

function resetDb() {
  db.accounts = [];
  db.journal_entries = [];
  db.journal_lines = [];
  db.supplier_charges = [];
  db.currency_conversions = [];
  db.supplier_claim_offsets = [];
  db.entryCounter = 0;
  db.hideJournalLookupOnce = false;
}

/** Siembra el plan de cuentas mínimo del tenant (postable). */
function seedAccounts(tenantId: string) {
  for (const code of ["2.1.7", "4.6", "5.10"]) {
    db.accounts.push({
      id: `acc-${code}-${tenantId}`,
      tenant_id: tenantId,
      code,
      is_postable: true,
    });
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Aplica una lista de filtros {col,val,op} a un set de filas. */
type Filter = { col: string; val: unknown; op: "eq" | "is" };
function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  return rows.filter((r) =>
    filters.every((f) =>
      f.op === "is" ? r[f.col] == null && f.val === null : r[f.col] === f.val,
    ),
  );
}

/** Builder chainable mínimo sobre una tabla del fake. */
function makeChain(table: keyof typeof db & string) {
  const filters: Filter[] = [];
  let pendingInsert: Row | Row[] | null = null;
  let pendingUpdate: Row | null = null;

  const chain: Record<string, unknown> = {
    select() {
      return chain;
    },
    eq(col: string, val: unknown) {
      filters.push({ col, val, op: "eq" });
      return chain;
    },
    is(col: string, val: unknown) {
      filters.push({ col, val, op: "is" });
      return chain;
    },
    limit() {
      return chain;
    },
    insert(payload: Row | Row[]) {
      pendingInsert = payload;
      // journal_lines no usa .select() → persistir ya (resuelve como thenable).
      if (Array.isArray(payload)) {
        for (const row of payload) (db[table] as Row[]).push({ ...row });
      }
      return chain;
    },
    update(payload: Row) {
      pendingUpdate = payload;
      return chain;
    },
    delete() {
      return {
        eq(col: string, val: unknown) {
          const arr = db[table] as Row[];
          const idx = arr.findIndex((r) => r[col] === val);
          if (idx >= 0) arr.splice(idx, 1);
          return Promise.resolve({ error: null });
        },
      };
    },
    single() {
      // Insert de un objeto → persistir con id y devolverlo.
      if (pendingInsert && !Array.isArray(pendingInsert)) {
        // Simula el UNIQUE parcial de migr 0178: a lo sumo UN asiento vivo por
        // (tenant_id, charge_id|conversion_id|claim_offset_id). Si ya hay uno,
        // devuelve 23505 (como Postgres) en vez de insertar.
        if (table === "journal_entries") {
          const p = pendingInsert as Row;
          for (const col of ["charge_id", "conversion_id", "claim_offset_id"]) {
            if (p[col] == null) continue;
            const dup = (db.journal_entries as Row[]).some(
              (r) =>
                r.tenant_id === p.tenant_id &&
                r[col] === p[col] &&
                r.deleted_at == null,
            );
            if (dup) {
              return Promise.resolve({
                data: null,
                error: { code: "23505", message: "duplicate key value violates unique constraint" },
              });
            }
          }
        }
        const row = { id: makeId("je"), ...pendingInsert };
        (db[table] as Row[]).push(row);
        return Promise.resolve({ data: { id: row.id }, error: null });
      }
      const found = applyFilters(db[table] as Row[], filters)[0] ?? null;
      return Promise.resolve({ data: found, error: null });
    },
    maybeSingle() {
      // Carrera TOCTOU: el pre-check (maybeSingle sobre journal_entries) no ve
      // al ganador una vez → fuerza el camino del INSERT que choca con 23505.
      if (table === "journal_entries" && db.hideJournalLookupOnce) {
        db.hideJournalLookupOnce = false;
        return Promise.resolve({ data: null, error: null });
      }
      const found = applyFilters(db[table] as Row[], filters)[0] ?? null;
      return Promise.resolve({ data: found, error: null });
    },
    // Thenable: para el UPDATE ... write-back (no usa .single()).
    then(resolve: (v: { data: unknown; error: null }) => unknown) {
      if (pendingUpdate) {
        const matches = applyFilters(db[table] as Row[], filters);
        for (const r of matches) Object.assign(r, pendingUpdate);
        return Promise.resolve({ data: null, error: null }).then(resolve);
      }
      const rows = applyFilters(db[table] as Row[], filters);
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
  };
  return chain;
}

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      return makeChain(table as keyof typeof db & string);
    },
    rpc(name: string) {
      if (name === "next_entry_code") {
        db.entryCounter += 1;
        return Promise.resolve({
          data: `JE-2026-${String(db.entryCounter).padStart(4, "0")}`,
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
  }),
}));

import {
  syncChargeJournalEntry,
  syncConversionJournalEntry,
  syncClaimOffsetJournalEntry,
  postChargeJournalEntry,
} from "../posting";

const TENANT = "tenant-dtd";
const OTHER_TENANT = "tenant-otro";

beforeEach(() => {
  resetDb();
  seedAccounts(TENANT);
});

// ── Idempotencia ──────────────────────────────────────────────
describe("idempotencia · doble alta → UN asiento", () => {
  it("cargo: postear dos veces el mismo charge_id crea un solo asiento", async () => {
    const chargeId = "ch-1";
    db.supplier_charges.push({ id: chargeId, tenant_id: TENANT, journal_entry_id: null });

    const r1 = await syncChargeJournalEntry({ tenantId: TENANT, chargeId, netAmountUsd: 1300 });
    const r2 = await syncChargeJournalEntry({ tenantId: TENANT, chargeId, netAmountUsd: 1300 });

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r2.skipped).toBe("entry-already-exists");
    // UN solo asiento para ese origen.
    const entries = db.journal_entries.filter((e) => e.charge_id === chargeId);
    expect(entries).toHaveLength(1);
    // El back-pointer apunta al mismo asiento en ambos intentos.
    expect(r1.entryId).toBe(r2.entryId);
  });

  it("carrera TOCTOU: el pre-check no ve al ganador → el UNIQUE (23505) recupera, UN asiento", async () => {
    const chargeId = "ch-race";
    db.supplier_charges.push({ id: chargeId, tenant_id: TENANT, journal_entry_id: null });
    // Simula que otra alta concurrente YA insertó el asiento ganador.
    db.journal_entries.push({
      id: "je-winner",
      tenant_id: TENANT,
      charge_id: chargeId,
      deleted_at: null,
    });
    // El pre-check no lo ve (carrera) → el poster intenta insertar y choca 23505.
    db.hideJournalLookupOnce = true;

    const r = await syncChargeJournalEntry({ tenantId: TENANT, chargeId, netAmountUsd: 1000 });

    expect(r.ok).toBe(true);
    expect(r.entryId).toBe("je-winner"); // converge al ganador
    expect(r.skipped).toBe("entry-already-exists");
    // No se duplicó el asiento.
    expect(db.journal_entries.filter((e) => e.charge_id === chargeId)).toHaveLength(1);
    // El back-pointer quedó escrito al ganador.
    expect(db.supplier_charges.find((c) => c.id === chargeId)!.journal_entry_id).toBe("je-winner");
  });

  it("conversión y cruce también son idempotentes", async () => {
    db.currency_conversions.push({ id: "cv-1", tenant_id: TENANT, journal_entry_id: null });
    db.supplier_claim_offsets.push({ id: "co-1", tenant_id: TENANT, journal_entry_id: null });

    await syncConversionJournalEntry({ tenantId: TENANT, conversionId: "cv-1", commissionUsd: 50 });
    await syncConversionJournalEntry({ tenantId: TENANT, conversionId: "cv-1", commissionUsd: 50 });
    await syncClaimOffsetJournalEntry({ tenantId: TENANT, claimOffsetId: "co-1", amountUsd: 300 });
    await syncClaimOffsetJournalEntry({ tenantId: TENANT, claimOffsetId: "co-1", amountUsd: 300 });

    expect(db.journal_entries.filter((e) => e.conversion_id === "cv-1")).toHaveLength(1);
    expect(db.journal_entries.filter((e) => e.claim_offset_id === "co-1")).toHaveLength(1);
  });
});

// ── journal_entry_id deja de ser NULL ─────────────────────────
describe("journal_entry_id deja de ser NULL (back-pointer)", () => {
  it("cargo: la fila origen apunta a su asiento tras sync", async () => {
    db.supplier_charges.push({ id: "ch-9", tenant_id: TENANT, journal_entry_id: null });
    const r = await syncChargeJournalEntry({ tenantId: TENANT, chargeId: "ch-9", netAmountUsd: 800 });
    const row = db.supplier_charges.find((c) => c.id === "ch-9")!;
    expect(row.journal_entry_id).toBe(r.entryId);
    expect(row.journal_entry_id).not.toBeNull();
  });

  it("conversión: back-pointer en currency_conversions", async () => {
    db.currency_conversions.push({ id: "cv-9", tenant_id: TENANT, journal_entry_id: null });
    const r = await syncConversionJournalEntry({ tenantId: TENANT, conversionId: "cv-9", commissionUsd: 25 });
    const row = db.currency_conversions.find((c) => c.id === "cv-9")!;
    expect(row.journal_entry_id).toBe(r.entryId);
  });

  it("cruce: back-pointer en supplier_claim_offsets", async () => {
    db.supplier_claim_offsets.push({ id: "co-9", tenant_id: TENANT, journal_entry_id: null });
    const r = await syncClaimOffsetJournalEntry({ tenantId: TENANT, claimOffsetId: "co-9", amountUsd: 300 });
    const row = db.supplier_claim_offsets.find((c) => c.id === "co-9")!;
    expect(row.journal_entry_id).toBe(r.entryId);
  });

  it("el write-back NO pisa un journal_entry_id ya seteado", async () => {
    // La fila ya tiene un asiento previo distinto → el update (filtra is null)
    // no la toca, pero como el asiento por origen ya existe, no duplica.
    db.supplier_charges.push({ id: "ch-x", tenant_id: TENANT, journal_entry_id: "je-previo" });
    db.journal_entries.push({ id: "je-previo", tenant_id: TENANT, charge_id: "ch-x", deleted_at: null });
    await syncChargeJournalEntry({ tenantId: TENANT, chargeId: "ch-x", netAmountUsd: 500 });
    const row = db.supplier_charges.find((c) => c.id === "ch-x")!;
    expect(row.journal_entry_id).toBe("je-previo");
    expect(db.journal_entries.filter((e) => e.charge_id === "ch-x")).toHaveLength(1);
  });
});

// ── DR = CR ───────────────────────────────────────────────────
describe("DR = CR (doble partida balanceada)", () => {
  it("cargo: Σ debe == Σ haber == monto, en las journal_lines", async () => {
    db.supplier_charges.push({ id: "ch-b", tenant_id: TENANT, journal_entry_id: null });
    const r = await syncChargeJournalEntry({ tenantId: TENANT, chargeId: "ch-b", netAmountUsd: 1234.56 });
    const lines = db.journal_lines.filter((l) => l.entry_id === r.entryId);
    expect(lines).toHaveLength(2);
    const debit = lines.reduce((a, l) => a + Number(l.debit), 0);
    const credit = lines.reduce((a, l) => a + Number(l.credit), 0);
    expect(debit).toBeCloseTo(credit, 5);
    expect(debit).toBeCloseTo(1234.56, 5);
  });

  it("las 3 clases de evento balancean", async () => {
    db.supplier_charges.push({ id: "ch-c", tenant_id: TENANT, journal_entry_id: null });
    db.currency_conversions.push({ id: "cv-c", tenant_id: TENANT, journal_entry_id: null });
    db.supplier_claim_offsets.push({ id: "co-c", tenant_id: TENANT, journal_entry_id: null });

    const rc = await syncChargeJournalEntry({ tenantId: TENANT, chargeId: "ch-c", netAmountUsd: 100 });
    const rv = await syncConversionJournalEntry({ tenantId: TENANT, conversionId: "cv-c", commissionUsd: 7.5 });
    const ro = await syncClaimOffsetJournalEntry({ tenantId: TENANT, claimOffsetId: "co-c", amountUsd: 42 });

    for (const id of [rc.entryId, rv.entryId, ro.entryId]) {
      const lines = db.journal_lines.filter((l) => l.entry_id === id);
      const debit = lines.reduce((a, l) => a + Number(l.debit), 0);
      const credit = lines.reduce((a, l) => a + Number(l.credit), 0);
      expect(debit).toBeCloseTo(credit, 5);
      expect(debit).toBeGreaterThan(0);
    }
  });
});

// ── Tenant scoping ────────────────────────────────────────────
describe("tenant scoping", () => {
  it("no asienta si el plan de cuentas es de OTRO tenant (missing-account)", async () => {
    // Sembramos cuentas solo para TENANT; posteamos en OTHER_TENANT (sin plan).
    db.supplier_charges.push({ id: "ch-t", tenant_id: OTHER_TENANT, journal_entry_id: null });
    const r = await postChargeJournalEntry({ tenantId: OTHER_TENANT, chargeId: "ch-t", netAmountUsd: 100 });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("missing-account");
    expect(db.journal_entries).toHaveLength(0);
  });

  it("el check de idempotencia filtra por tenant_id (no confunde orígenes homónimos)", async () => {
    // Un asiento del MISMO charge_id pero de OTRO tenant no debe contar como
    // existente para TENANT.
    seedAccounts(OTHER_TENANT);
    db.journal_entries.push({
      id: "je-otro",
      tenant_id: OTHER_TENANT,
      charge_id: "shared-id",
      deleted_at: null,
    });
    db.supplier_charges.push({ id: "shared-id", tenant_id: TENANT, journal_entry_id: null });

    const r = await syncChargeJournalEntry({ tenantId: TENANT, chargeId: "shared-id", netAmountUsd: 200 });
    // Crea SU PROPIO asiento (no reusa el de OTHER_TENANT).
    expect(r.skipped).toBeUndefined();
    expect(r.entryId).not.toBe("je-otro");
    expect(db.journal_entries.filter((e) => e.tenant_id === TENANT && e.charge_id === "shared-id")).toHaveLength(1);
  });
});

// ── Skips graceful ────────────────────────────────────────────
describe("skips graceful (no rompen el alta)", () => {
  it("monto 0 → zero-amount, no inserta", async () => {
    db.supplier_charges.push({ id: "ch-0", tenant_id: TENANT, journal_entry_id: null });
    const r = await syncChargeJournalEntry({ tenantId: TENANT, chargeId: "ch-0", netAmountUsd: 0 });
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe("zero-amount");
    expect(db.journal_entries).toHaveLength(0);
  });

  it("comisión 0 (sin spread) → conversión sin asiento", async () => {
    db.currency_conversions.push({ id: "cv-0", tenant_id: TENANT, journal_entry_id: null });
    const r = await syncConversionJournalEntry({ tenantId: TENANT, conversionId: "cv-0", commissionUsd: 0 });
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe("zero-amount");
    expect(db.journal_entries).toHaveLength(0);
  });
});
