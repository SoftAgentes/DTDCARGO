/**
 * Posteo de la depreciación del mes (SDD-0105) — fixed_assets → journal_entries.
 *
 * Espejo EXACTO de expense-posting.ts (SDD-0079): admin client, idempotente,
 * best-effort, rollback manual, sin romper si falta una cuenta. Por cada activo
 * activo no totalmente depreciado, crea UN asiento `asentado` con
 * source='depreciacion':
 *
 *   DR  6.17  Depreciación de flota y equipos     = cuota del activo
 *   CR  1.2.9 Depreciación acumulada (contra)     = cuota del activo
 *
 * Defensa del dinero:
 *  - Idempotente por (asset, period): la fila guard en `fixed_asset_depreciation`
 *    se inserta como cerrojo (unique (asset_id, period)) ANTES del asiento. Si ya
 *    existe → skip (no se duplica el asiento). Un doble-submit choca con el unique.
 *  - El asiento SIEMPRE balancea por construcción (DR cuota = CR cuota).
 *  - Respeta el cierre de período (chequeo app `isPeriodClosed` + el trigger DB
 *    0133 como defensa dura): si el mes cae cerrado, no se postea ese activo.
 *  - Corre con admin client (service_role). Best-effort: no throwea, devuelve
 *    un resumen. Si una cuenta del plan falta → ese activo se salta (no bloquea).
 *
 * El `period` es YYYY-MM; la fecha del asiento es el último día de ese mes (así
 * el cierre de período lo cubre correctamente: depreciás "a fin de mes").
 */

import { createAdminClient } from "@/lib/db/admin";
import {
  computeDepreciation,
  DEFAULT_ACCUM_DEP_CODE,
  DEFAULT_DEP_EXPENSE_CODE,
  type FixedAsset,
} from "./fixed-asset-types";
import { isPeriodClosed } from "./period-queries";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Último día (YYYY-MM-DD) del mes `YYYY-MM`. PURA. */
export function endOfMonth(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!m) return period;
  const year = Number(m[1]);
  const month = Number(m[2]); // 1..12
  // Día 0 del mes siguiente = último día del mes actual.
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

/** Una línea del asiento de depreciación (debe XOR haber). */
export type DepreciationLine = {
  account_id: string;
  debit: number;
  credit: number;
  line_memo: string;
};

/**
 * Construye las 2 líneas del asiento de depreciación. PURA — testeable sin DB.
 *
 *   DR  expenseAccountId  = amount   (gasto de depreciación, 6.17)
 *   CR  accumAccountId    = amount   (depreciación acumulada contra, 1.2.9)
 *
 * Por construcción siempre balancea (Σ debe == Σ haber == amount).
 */
export function buildDepreciationLines(
  expenseAccountId: string,
  accumAccountId: string,
  amount: number,
): DepreciationLine[] {
  const amt = round2(amount);
  return [
    {
      account_id: expenseAccountId,
      debit: amt,
      credit: 0,
      line_memo: "Gasto de depreciación",
    },
    {
      account_id: accumAccountId,
      debit: 0,
      credit: amt,
      line_memo: "Depreciación acumulada",
    },
  ];
}

export type AssetPostingResult = {
  assetId: string;
  assetName: string;
  ok: boolean;
  amount?: number;
  entryCode?: string;
  /** Motivo cuando no se asentó (ya existía, full, falta cuenta, cerrado, etc.). */
  skipped?: string;
  error?: string;
};

export type PostDepreciationResult = {
  /** Activos que asentaron un asiento nuevo en este corrido. */
  posted: number;
  /** Activos saltados (idempotencia, full, cuenta faltante, período cerrado). */
  skipped: number;
  /** Activos con error real (no skip). */
  failed: number;
  /** Σ de las cuotas asentadas. */
  totalAmount: number;
  /** Detalle por activo (para el toast / log). */
  details: AssetPostingResult[];
};

/**
 * Resuelve un account_id del plan: usa el id explícito del activo si está y es
 * postable; si no, busca por `code` (default). Devuelve null si no existe.
 */
async function resolveAccountId(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  explicitId: string | null,
  fallbackCode: string,
): Promise<string | null> {
  if (explicitId) {
    const { data } = await admin
      .from("accounts")
      .select("id, is_postable")
      .eq("tenant_id", tenantId)
      .eq("id", explicitId)
      .maybeSingle<{ id: string; is_postable: boolean }>();
    if (data?.id && data.is_postable) return data.id;
  }
  const { data: byCode } = await admin
    .from("accounts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("code", fallbackCode)
    .maybeSingle<{ id: string }>();
  return byCode?.id ?? null;
}

/**
 * Postea la depreciación de UN activo para un mes. Idempotente por
 * (asset, period). No throwea — devuelve un AssetPostingResult.
 *
 * Pasos:
 *  1. Cuota del mes (computeDepreciation, PURA). Si full → skip.
 *  2. Resolver cuentas 6.17 / 1.2.9 ANTES del cerrojo. Si falta → skip (no se
 *     inserta una fila de depreciación transitoria sin asiento).
 *  3. Cerrojo de idempotencia: insertar la fila guard en
 *     fixed_asset_depreciation (unique (asset_id, period)). Si choca → skip.
 *  4. Crear el asiento `asentado` + 2 líneas (rollback manual si fallan).
 *  5. Linkear el asiento al guard (entry_id).
 */
export async function postDepreciationForAsset(
  asset: FixedAsset,
  period: string,
  opts: { closingDate: string | null; postedBy?: string | null },
): Promise<AssetPostingResult> {
  const base: AssetPostingResult = {
    assetId: asset.id,
    assetName: asset.name,
    ok: true,
  };
  try {
    const admin = createAdminClient();
    const entryDate = endOfMonth(period);

    // Período cerrado (chequeo app antes de tocar la DB; el trigger 0133 es la
    // defensa dura). Si el mes está cerrado, no posteamos este activo.
    if (isPeriodClosed(opts.closingDate, entryDate)) {
      return { ...base, skipped: "periodo-cerrado" };
    }

    // Solo activos "activo" (los de baja / ya depreciados no se depreciacian).
    if (asset.status !== "activo") {
      return { ...base, skipped: "no-activo" };
    }

    // 1. Cuota del mes. Si ya está full → skip (sin asiento).
    const sched = computeDepreciation(
      {
        cost: asset.cost,
        salvage_value: asset.salvage_value,
        useful_life_months: asset.useful_life_months,
        acquired_on: asset.acquired_on,
      },
      entryDate,
    );
    const amount = round2(sched.remainingThisMonth);
    if (sched.fullyDepreciated || amount <= 0) {
      return { ...base, skipped: "sin-cuota" };
    }

    // 2. Resolver las cuentas del asiento (6.17 gasto / 1.2.9 acumulada) ANTES
    //    del cerrojo: si falta una cuenta, saltamos sin haber insertado una fila
    //    de depreciación transitoria (amount>0 / entry_id=null) que un lector
    //    concurrente podría ver. La idempotencia no se afecta (el cerrojo sigue
    //    siendo la inserción de la guard, abajo).
    const expenseAccountId = await resolveAccountId(
      admin,
      asset.tenant_id,
      asset.expense_account_id,
      DEFAULT_DEP_EXPENSE_CODE,
    );
    const accumAccountId = await resolveAccountId(
      admin,
      asset.tenant_id,
      asset.accum_dep_account_id,
      DEFAULT_ACCUM_DEP_CODE,
    );
    if (!expenseAccountId || !accumAccountId) {
      return { ...base, skipped: "missing-account" };
    }

    // 3. Cerrojo de idempotencia: insertamos la fila guard. El unique
    //    (asset_id, period) rechaza un re-corrido / doble-submit del mismo mes.
    const { data: guard, error: guardErr } = await admin
      .from("fixed_asset_depreciation")
      .insert({
        asset_id: asset.id,
        tenant_id: asset.tenant_id,
        period,
        amount,
        posted_by: opts.postedBy ?? null,
      })
      .select("id")
      .single();
    if (guardErr) {
      // 23505 = unique violation → ya se depreció este mes (idempotente).
      if ((guardErr as { code?: string }).code === "23505") {
        return { ...base, skipped: "ya-depreciado" };
      }
      return { ...base, ok: false, error: guardErr.message };
    }

    // 4. entry_code atómico (mismo RPC que el resto de posteos).
    const { data: codeData, error: codeErr } = await admin.rpc(
      "next_entry_code",
      { p_tenant_id: asset.tenant_id },
    );
    if (codeErr || !codeData) {
      await admin.from("fixed_asset_depreciation").delete().eq("id", guard.id);
      return {
        ...base,
        ok: false,
        error: codeErr?.message ?? "next_entry_code falló",
      };
    }
    const entryCode = String(codeData);

    // 5. Insertar el asiento (asentado) + sus 2 líneas balanceadas.
    const { data: insertedEntry, error: entryErr } = await admin
      .from("journal_entries")
      .insert({
        tenant_id: asset.tenant_id,
        entry_code: entryCode,
        entry_date: entryDate,
        memo: `Depreciación ${period} · ${asset.name}`,
        status: "asentado",
        source: "depreciacion",
        posted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (entryErr || !insertedEntry) {
      // El trigger de cierre (0133) o cualquier fallo: liberamos el guard.
      await admin.from("fixed_asset_depreciation").delete().eq("id", guard.id);
      return {
        ...base,
        ok: false,
        error: entryErr?.message ?? "no se pudo crear el asiento",
      };
    }

    const lines = buildDepreciationLines(
      expenseAccountId,
      accumAccountId,
      amount,
    ).map((l) => ({ ...l, entry_id: insertedEntry.id }));
    const { error: linesErr } = await admin.from("journal_lines").insert(lines);
    if (linesErr) {
      // Rollback manual del header + del guard (no hay transacción cross-statement).
      await admin.from("journal_entries").delete().eq("id", insertedEntry.id);
      await admin.from("fixed_asset_depreciation").delete().eq("id", guard.id);
      return { ...base, ok: false, error: linesErr.message };
    }

    // 6. Linkear el asiento al registro de depreciación.
    await admin
      .from("fixed_asset_depreciation")
      .update({ entry_id: insertedEntry.id })
      .eq("id", guard.id);

    // Si este mes cerró la depreciación, marcamos el activo como `depreciado`.
    if (round2(sched.accumulated) >= round2(sched.depreciableBase) - 0.005) {
      await admin
        .from("fixed_assets")
        .update({ status: "depreciado" })
        .eq("id", asset.id)
        .eq("tenant_id", asset.tenant_id);
    }

    return { ...base, amount, entryCode };
  } catch (e) {
    return {
      ...base,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Postea la depreciación del mes para TODOS los activos pasados. Best-effort,
 * idempotente por activo+mes. Devuelve un resumen agregado.
 */
export async function postDepreciationForPeriod(
  assets: FixedAsset[],
  period: string,
  opts: { closingDate: string | null; postedBy?: string | null },
): Promise<PostDepreciationResult> {
  const details: AssetPostingResult[] = [];
  let posted = 0;
  let skipped = 0;
  let failed = 0;
  let totalAmount = 0;

  for (const asset of assets) {
    const r = await postDepreciationForAsset(asset, period, opts);
    details.push(r);
    if (!r.ok) failed += 1;
    else if (r.entryCode) {
      posted += 1;
      totalAmount = round2(totalAmount + (r.amount ?? 0));
    } else {
      skipped += 1;
    }
  }

  return { posted, skipped, failed, totalAmount, details };
}
