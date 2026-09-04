import { describe, expect, it } from "vitest";
import {
  mapProfileEditQuota,
  profileEditQuotaLabel,
  UNAVAILABLE_PROFILE_EDIT_QUOTA,
} from "../profile-edit-quota";

describe("cupo de edición del perfil · SDD-0439", () => {
  it("resta cambios aplicados y reservados", () => {
    const quota = mapProfileEditQuota({
      limit_count: 3,
      applied_count: 1,
      reserved_count: 1,
      remaining_count: 1,
    });
    expect(quota).toEqual({
      limit: 3,
      applied: 1,
      reserved: 1,
      remaining: 1,
      available: true,
    });
    expect(profileEditQuotaLabel(quota)).toBe("1 de 3 cambios disponibles");
  });

  it("no confía en un remanente de servidor mayor al matemático", () => {
    expect(
      mapProfileEditQuota({
        limit_count: 3,
        applied_count: 3,
        reserved_count: 0,
        remaining_count: 99,
      }).remaining,
    ).toBe(0);
  });

  it("falla cerrado cuando la RPC no está disponible", () => {
    expect(UNAVAILABLE_PROFILE_EDIT_QUOTA.remaining).toBe(0);
    expect(profileEditQuotaLabel(UNAVAILABLE_PROFILE_EDIT_QUOTA)).toMatch(
      /temporalmente no disponible/i,
    );
  });
});
