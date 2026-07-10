/**
 * Tests del flujo de recovery M-of-N (SDD-0025 §4.6 · §5 "Tests recovery").
 * Usan el fake in-memory de Supabase (_fake-supabase.ts).
 */

import { describe, it, expect } from "vitest";
import {
  requestRecovery,
  approveRecovery,
  executeRecovery,
  rejectRecovery,
  RecoveryPolicyError,
  RecoveryStateError,
} from "@/lib/studio/no-olvidar/recovery";
import { makeFakeSupabase } from "./_fake-supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const REQUESTER = "user-req";
const ADMIN_A = "admin-a";
const ADMIN_B = "admin-b";

function setup() {
  const fake = makeFakeSupabase({
    admins: [ADMIN_A, ADMIN_B],
    tables: {
      no_olvidar_user_keys: [
        {
          user_id: REQUESTER,
          private_key_ciphertext: null,
          failed_unlock_attempts: 3,
          locked_until: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
    },
  });
  return fake;
}

describe("no-olvidar/recovery · M-of-N", () => {
  it("request → 1 approval NO alcanza quórum; 2 approvals → approved", async () => {
    const fake = setup();
    const sb = fake as unknown as SupabaseClient;

    const req = await requestRecovery(sb, REQUESTER, "Perdí el acceso tras cambiar de teléfono.");
    expect(req.status).toBe("pending");
    expect(req.approvals_required).toBe(2);

    const after1 = await approveRecovery(sb, req.id, ADMIN_A);
    expect(after1.status).toBe("pending");
    expect(after1.approvals).toHaveLength(1);

    const after2 = await approveRecovery(sb, req.id, ADMIN_B);
    expect(after2.status).toBe("approved");
    expect(after2.approvals).toHaveLength(2);
  });

  it("un admin NO puede aprobar su propio request", async () => {
    const fake = makeFakeSupabase({ admins: [ADMIN_A] });
    const sb = fake as unknown as SupabaseClient;
    const req = await requestRecovery(sb, ADMIN_A, "Soy admin y perdí acceso a mi propio No-Olvidar.");
    await expect(approveRecovery(sb, req.id, ADMIN_A)).rejects.toBeInstanceOf(RecoveryPolicyError);
  });

  it("un no-admin NO puede aprobar", async () => {
    const fake = setup();
    const sb = fake as unknown as SupabaseClient;
    const req = await requestRecovery(sb, REQUESTER, "Perdí acceso, ayuda por favor.");
    await expect(approveRecovery(sb, req.id, "user-cualquiera")).rejects.toBeInstanceOf(
      RecoveryPolicyError,
    );
  });

  it("aprobar dos veces con el mismo admin es idempotente (no suma)", async () => {
    const fake = setup();
    const sb = fake as unknown as SupabaseClient;
    const req = await requestRecovery(sb, REQUESTER, "Perdí acceso al gestor interno.");
    await approveRecovery(sb, req.id, ADMIN_A);
    const again = await approveRecovery(sb, req.id, ADMIN_A);
    expect(again.approvals).toHaveLength(1);
    expect(again.status).toBe("pending");
  });

  it("execute recién funciona con quórum y resetea la master password", async () => {
    const fake = setup();
    const sb = fake as unknown as SupabaseClient;
    const req = await requestRecovery(sb, REQUESTER, "Perdí master password y recovery kit.");

    // sin quórum aún → no ejecuta
    await approveRecovery(sb, req.id, ADMIN_A);
    await expect(executeRecovery(sb, req.id, "NuevaClave-Segura-9$")).rejects.toBeInstanceOf(
      RecoveryStateError,
    );

    // con quórum → ejecuta
    await approveRecovery(sb, req.id, ADMIN_B);
    await executeRecovery(sb, req.id, "NuevaClave-Segura-9$");

    const reqRow = fake._rows("no_olvidar_recovery_requests")[0];
    expect(reqRow.status).toBe("completed");
    expect(reqRow.completed_at).toBeTruthy();

    const keys = fake._rows("no_olvidar_user_keys")[0];
    expect(keys.has_master_password).toBe(true);
    expect(keys.master_password_verifier).toBeTruthy();
    expect(keys.master_password_salt).toBeTruthy();
    expect(keys.failed_unlock_attempts).toBe(0);
    expect(keys.locked_until).toBeNull();
  });

  it("execute es idempotente: segunda vez lanza (ya completado)", async () => {
    const fake = setup();
    const sb = fake as unknown as SupabaseClient;
    const req = await requestRecovery(sb, REQUESTER, "Perdí todo, necesito reset.");
    await approveRecovery(sb, req.id, ADMIN_A);
    await approveRecovery(sb, req.id, ADMIN_B);
    await executeRecovery(sb, req.id, "OtraClave-Segura-1$");
    await expect(executeRecovery(sb, req.id, "OtraClave-Segura-1$")).rejects.toBeInstanceOf(
      RecoveryStateError,
    );
  });

  it("un request expirado no se puede aprobar y queda 'expired'", async () => {
    const fake = setup();
    const sb = fake as unknown as SupabaseClient;
    const req = await requestRecovery(sb, REQUESTER, "Perdí acceso, se me venció el pedido.");
    // forzar expiración
    fake._rows("no_olvidar_recovery_requests")[0].expires_at = new Date(
      Date.now() - 1000,
    ).toISOString();

    await expect(approveRecovery(sb, req.id, ADMIN_A)).rejects.toBeInstanceOf(RecoveryStateError);
    expect(fake._rows("no_olvidar_recovery_requests")[0].status).toBe("expired");
  });

  it("reject deja el request en 'rejected' y solo lo hace un admin", async () => {
    const fake = setup();
    const sb = fake as unknown as SupabaseClient;
    const req = await requestRecovery(sb, REQUESTER, "Pedido que un admin va a rechazar.");
    await expect(rejectRecovery(sb, req.id, "no-admin", "sospechoso")).rejects.toBeInstanceOf(
      RecoveryPolicyError,
    );
    const rejected = await rejectRecovery(sb, req.id, ADMIN_A, "No verifiqué la identidad.");
    expect(rejected.status).toBe("rejected");
  });
});
