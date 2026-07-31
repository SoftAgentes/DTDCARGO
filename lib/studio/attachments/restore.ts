import "server-only";

import { readBackupVersion, sha256Of } from "./backup";

export async function restoreAndVerifyBackup(input: {
  objectKey: string;
  versionId: string;
  expectedSha256: string;
}): Promise<{ bytes: Uint8Array; sha256: string }> {
  const bytes = await readBackupVersion(input);
  const sha256 = sha256Of(bytes);
  if (sha256 !== input.expectedSha256) throw new Error("El checksum restaurado no coincide con el protegido.");
  return { bytes, sha256 };
}

