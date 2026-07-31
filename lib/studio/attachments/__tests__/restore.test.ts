import { beforeEach, describe, expect, it, vi } from "vitest";

const readBackupVersion = vi.fn();
vi.mock("../backup", () => ({
  readBackupVersion,
  sha256Of: (bytes: Uint8Array) => bytes[0] === 1 ? "good" : "bad",
}));

describe("restore", () => {
  beforeEach(() => readBackupVersion.mockReset());
  it("entrega bytes solo si el checksum coincide", async () => {
    readBackupVersion.mockResolvedValue(new Uint8Array([1]));
    const { restoreAndVerifyBackup } = await import("../restore");
    await expect(restoreAndVerifyBackup({ objectKey: "k", versionId: "v", expectedSha256: "good" })).resolves.toMatchObject({ sha256: "good" });
  });
  it("falla cerrado ante corrupción", async () => {
    readBackupVersion.mockResolvedValue(new Uint8Array([2]));
    const { restoreAndVerifyBackup } = await import("../restore");
    await expect(restoreAndVerifyBackup({ objectKey: "k", versionId: "v", expectedSha256: "good" })).rejects.toThrow("no coincide");
  });
});

