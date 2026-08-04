import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertExternalEvidencePath,
  validateContractEvidence,
  validateLiveValidationReceipt,
  validatePiplEvidence,
} from "../attachments-aws-evidence.mjs";

const now = new Date("2026-08-03T22:00:00.000Z");
const accountId = "111122223333";
const sha = "a".repeat(64);

async function artifacts(kinds) {
  const dir = await mkdtemp(join(tmpdir(), "dtd-aws-evidence-"));
  return Promise.all(kinds.map(async (kind) => {
    const path = join(dir, `${kind}.txt`);
    const bytes = Buffer.from(`synthetic ${kind}\n`, "utf8");
    await writeFile(path, bytes);
    return { kind, path, sha256: createHash("sha256").update(bytes).digest("hex") };
  }));
}

function liveReceipt(overrides = {}) {
  return {
    schemaVersion: 1,
    ok: true,
    syntheticOnly: true,
    accountId,
    region: "us-east-1",
    scanBucket: "scan",
    backupBucket: "backup",
    completedAt: "2026-08-03T21:30:00.000Z",
    cleanScan: {
      status: "NO_THREATS_FOUND",
      key: "validation/4ebc4ef3-46ce-4f13-a44c-5d92b6385f84/clean.txt",
      versionId: "clean-v1",
    },
    eicarScan: {
      status: "THREATS_FOUND",
      key: "validation/4ebc4ef3-46ce-4f13-a44c-5d92b6385f84/eicar.com.txt",
      versionId: "eicar-v1",
    },
    objectLock: {
      mode: "COMPLIANCE",
      deleteDenied: true,
      key: "validation/4ebc4ef3-46ce-4f13-a44c-5d92b6385f84/immutable.json",
      versionId: "backup-v1",
      retainUntil: "2036-08-04T21:30:00.000Z",
    },
    restore: { sha256: sha, expectedSha256: sha },
    rpoMs: 1_000,
    rtoMs: 2_000,
    ...overrides,
  };
}

describe("evidencia de activación AWS", () => {
  it("acepta el simulacro solo si cuenta, buckets, EICAR, lock, restore y objetivos coinciden", () => {
    expect(validateLiveValidationReceipt(liveReceipt(), {
      accountId, region: "us-east-1", scanBucket: "scan", backupBucket: "backup",
    }, { now })).toMatchObject({ rpoMs: 1_000, rtoMs: 2_000 });
    expect(() => validateLiveValidationReceipt(liveReceipt({ accountId: "999900001111" }), {
      accountId, region: "us-east-1", scanBucket: "scan", backupBucket: "backup",
    }, { now })).toThrow("cuenta esperada");
    expect(() => validateLiveValidationReceipt(liveReceipt({ rpoMs: 3_600_001 }), {
      accountId, region: "us-east-1", scanBucket: "scan", backupBucket: "backup",
    }, { now })).toThrow("RPO");
  });

  it("rechaza evidencia dentro del repositorio", () => {
    expect(() => assertExternalEvidencePath(join(process.cwd(), "evidence.json"))).toThrow("fuera del repositorio");
  });

  it("verifica identidad contractual y hashes de todos los documentos", async () => {
    const required = ["customer-agreement", "service-terms", "dpa", "subprocessors", "account-acceptance", "billing-identity"];
    const result = await validateContractEvidence({
      schemaVersion: 1,
      accountId,
      legalEntity: "INVERSIONES DTD SERVICES, C.A.",
      accountCountry: "VE",
      contractingParty: "Amazon Web Services, Inc.",
      acceptedByRole: "representante autorizado",
      acceptedAt: "2026-08-01T12:00:00.000Z",
      reviewedAt: "2026-08-03T20:00:00.000Z",
      artifacts: await artifacts(required),
    }, { accountId }, { now });
    expect(result.artifacts).toHaveLength(6);
  });

  it("exige mecanismo PIPL, evaluación, consentimiento separado y sus hashes", async () => {
    const required = ["mechanism-decision", "impact-assessment", "separate-consent-template", "consent-register-export"];
    const base = {
      schemaVersion: 1,
      accountId,
      scope: "china-personal-data",
      mechanism: "standard-contract",
      impactAssessmentCompleted: true,
      separateConsentVerified: true,
      approvedByRole: "asesoría China",
      decidedAt: "2026-08-03T20:00:00.000Z",
      artifacts: await artifacts(required),
    };
    await expect(validatePiplEvidence(base, { accountId }, { now })).resolves.toMatchObject({ mechanism: "standard-contract" });
    await expect(validatePiplEvidence({ ...base, separateConsentVerified: false }, { accountId }, { now }))
      .rejects.toThrow("consentimiento separado");
  });
});
