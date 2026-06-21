import { describe, it, expect } from "vitest";
import {
  validateEvidenceFile,
  inferEvidenceType,
  isImageMime,
  collectEvidenceFiles,
  CLAIM_EVIDENCE_MAX_BYTES,
  CLAIM_EVIDENCE_MAX_FILES,
} from "../claim-evidence";

function file(name: string, type: string, bytes = 4): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("inferEvidenceType", () => {
  it("mapea por MIME", () => {
    expect(inferEvidenceType("image/jpeg")).toBe("foto");
    expect(inferEvidenceType("image/png")).toBe("foto");
    expect(inferEvidenceType("application/pdf")).toBe("documento");
    expect(inferEvidenceType("text/plain")).toBe("otro");
  });
});

describe("isImageMime", () => {
  it("detecta imágenes", () => {
    expect(isImageMime("image/jpeg")).toBe(true);
    expect(isImageMime("application/pdf")).toBe(false);
    expect(isImageMime(null)).toBe(false);
    expect(isImageMime(undefined)).toBe(false);
  });
});

describe("validateEvidenceFile", () => {
  it("acepta una imagen válida", () => {
    const f = file("daño.jpg", "image/jpeg");
    const r = validateEvidenceFile(f);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file).toBe(f);
  });

  it("acepta un PDF", () => {
    expect(validateEvidenceFile(file("factura.pdf", "application/pdf")).ok).toBe(true);
  });

  it("rechaza un MIME no permitido", () => {
    const r = validateEvidenceFile(file("nota.txt", "text/plain"));
    expect(r.ok).toBe(false);
  });

  it("rechaza null o archivo vacío", () => {
    expect(validateEvidenceFile(null).ok).toBe(false);
    expect(validateEvidenceFile(file("x.jpg", "image/jpeg", 0)).ok).toBe(false);
  });

  it("rechaza un archivo demasiado pesado", () => {
    const big = file("grande.jpg", "image/jpeg", CLAIM_EVIDENCE_MAX_BYTES + 1);
    expect(validateEvidenceFile(big).ok).toBe(false);
  });
});

describe("collectEvidenceFiles", () => {
  it("toma los válidos del campo 'evidence'", () => {
    const fd = new FormData();
    fd.append("evidence", file("a.jpg", "image/jpeg"));
    fd.append("evidence", file("b.pdf", "application/pdf"));
    const { files, skipped } = collectEvidenceFiles(fd);
    expect(files.length).toBe(2);
    expect(skipped).toBe(0);
  });

  it("cuenta los archivos inválidos como skipped", () => {
    const fd = new FormData();
    fd.append("evidence", file("bad.txt", "text/plain"));
    fd.append("evidence", file("ok.jpg", "image/jpeg"));
    const { files, skipped } = collectEvidenceFiles(fd);
    expect(files.length).toBe(1);
    expect(skipped).toBe(1);
  });

  it("topa en CLAIM_EVIDENCE_MAX_FILES", () => {
    const fd = new FormData();
    for (let i = 0; i < CLAIM_EVIDENCE_MAX_FILES + 4; i++) {
      fd.append("evidence", file(`f${i}.jpg`, "image/jpeg"));
    }
    const { files } = collectEvidenceFiles(fd);
    expect(files.length).toBe(CLAIM_EVIDENCE_MAX_FILES);
  });

  it("no rompe con campo vacío", () => {
    expect(collectEvidenceFiles(new FormData())).toEqual({ files: [], skipped: 0 });
  });
});
