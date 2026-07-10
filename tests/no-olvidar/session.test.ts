/**
 * Tests de la sesión de desbloqueo (SDD-0025 §4.11 · §5 "Tests session").
 */

import { describe, it, expect } from "vitest";
import {
  validateUnlockSession,
  markUnlocked,
  incrementFailedAttempt,
} from "@/lib/studio/no-olvidar/session";
import { makeFakeSupabase } from "./_fake-supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const USER = "user-1";

function withKeys(keys: Record<string, unknown>) {
  const fake = makeFakeSupabase({
    tables: {
      no_olvidar_user_keys: [
        { user_id: USER, failed_unlock_attempts: 0, locked_until: null, last_unlock_at: null, ...keys },
      ],
    },
  });
  return fake;
}

describe("no-olvidar/session · vigencia del unlock", () => {
  it("desbloqueado dentro de la ventana de 30 min", async () => {
    const fake = withKeys({ last_unlock_at: new Date(Date.now() - 5 * 60_000).toISOString() });
    const state = await validateUnlockSession(fake as unknown as SupabaseClient, USER);
    expect(state.unlocked).toBe(true);
    expect(state.expiresAt).toBeTruthy();
    expect(state.locked).toBe(false);
  });

  it("expirado pasados 30 min", async () => {
    const fake = withKeys({ last_unlock_at: new Date(Date.now() - 31 * 60_000).toISOString() });
    const state = await validateUnlockSession(fake as unknown as SupabaseClient, USER);
    expect(state.unlocked).toBe(false);
    expect(state.expiresAt).toBeNull();
  });

  it("sin last_unlock_at → no desbloqueado", async () => {
    const fake = withKeys({ last_unlock_at: null });
    const state = await validateUnlockSession(fake as unknown as SupabaseClient, USER);
    expect(state.unlocked).toBe(false);
  });

  it("locked_until futuro → locked=true aunque el unlock fuera reciente", async () => {
    const fake = withKeys({
      last_unlock_at: new Date().toISOString(),
      locked_until: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    const state = await validateUnlockSession(fake as unknown as SupabaseClient, USER);
    expect(state.locked).toBe(true);
    expect(state.unlocked).toBe(false);
  });
});

describe("no-olvidar/session · markUnlocked", () => {
  it("setea last_unlock_at y limpia intentos/lockout", async () => {
    const fake = withKeys({
      failed_unlock_attempts: 4,
      locked_until: new Date(Date.now() + 60_000).toISOString(),
    });
    await markUnlocked(fake as unknown as SupabaseClient, USER);
    const row = fake._rows("no_olvidar_user_keys")[0];
    expect(row.last_unlock_at).toBeTruthy();
    expect(row.failed_unlock_attempts).toBe(0);
    expect(row.locked_until).toBeNull();

    const state = await validateUnlockSession(fake as unknown as SupabaseClient, USER);
    expect(state.unlocked).toBe(true);
  });
});

describe("no-olvidar/session · rate limit", () => {
  it("no bloquea antes del umbral", async () => {
    const fake = withKeys({ failed_unlock_attempts: 0 });
    const r = await incrementFailedAttempt(fake as unknown as SupabaseClient, USER);
    expect(r.attempts).toBe(1);
    expect(r.locked).toBe(false);
    expect(r.until).toBeNull();
  });

  it("bloquea al llegar a 5 intentos (config default)", async () => {
    const fake = withKeys({ failed_unlock_attempts: 4 });
    const r = await incrementFailedAttempt(fake as unknown as SupabaseClient, USER);
    expect(r.attempts).toBe(5);
    expect(r.locked).toBe(true);
    expect(r.until).toBeTruthy();

    // y la sesión refleja el lock
    const state = await validateUnlockSession(fake as unknown as SupabaseClient, USER);
    expect(state.locked).toBe(true);
  });
});
