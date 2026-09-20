// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  ATTACH_MAX_BYTES,
  attachmentContentTypeForExt,
  attachmentExtFromFile,
  attachmentExtFromMime,
  attachmentKindFromMime,
  attachmentKindLabel,
  buildTaskAttachmentPath,
  isAllowedAttachmentMime,
  isValidTaskAttachmentPath,
} from "./storage";

// UUIDs de prueba (shape 8-4-4-4-12).
const TENANT = "11111111-1111-4111-8111-111111111111";
const TASK = "22222222-2222-4222-8222-222222222222";
const OTHER_TENANT = "33333333-3333-4333-8333-333333333333";
const OTHER_TASK = "44444444-4444-4444-8444-444444444444";
const FILE_UUID = "55555555-5555-4555-8555-555555555555";

describe("attachmentKindFromMime", () => {
  it("image/* → foto", () => {
    expect(attachmentKindFromMime("image/jpeg")).toBe("foto");
    expect(attachmentKindFromMime("image/png")).toBe("foto");
    expect(attachmentKindFromMime("image/webp")).toBe("foto");
  });
  it("video/* → video", () => {
    expect(attachmentKindFromMime("video/mp4")).toBe("video");
    expect(attachmentKindFromMime("video/quicktime")).toBe("video");
  });
  it("resto → doc", () => {
    expect(attachmentKindFromMime("application/pdf")).toBe("doc");
    expect(attachmentKindFromMime("application/zip")).toBe("doc");
    expect(attachmentKindFromMime(null)).toBe("doc");
    expect(attachmentKindFromMime(undefined)).toBe("doc");
    expect(attachmentKindFromMime("")).toBe("doc");
  });
  it("no es sensible a mayúsculas", () => {
    expect(attachmentKindFromMime("IMAGE/JPEG")).toBe("foto");
    expect(attachmentKindFromMime("Video/MP4")).toBe("video");
  });
});

describe("attachmentKindLabel", () => {
  it("etiquetas es-VE", () => {
    expect(attachmentKindLabel("foto")).toBe("Foto");
    expect(attachmentKindLabel("video")).toBe("Video");
    expect(attachmentKindLabel("doc")).toBe("Documento");
  });
});

describe("attachmentExtFromMime", () => {
  it("mimes soportados → extensión canónica", () => {
    expect(attachmentExtFromMime("image/jpeg")).toBe("jpg");
    expect(attachmentExtFromMime("image/png")).toBe("png");
    expect(attachmentExtFromMime("image/webp")).toBe("webp");
    expect(attachmentExtFromMime("video/mp4")).toBe("mp4");
    expect(attachmentExtFromMime("application/pdf")).toBe("pdf");
  });
  it("mimes no soportados → null", () => {
    expect(attachmentExtFromMime("image/gif")).toBeNull();
    expect(attachmentExtFromMime("image/heic")).toBeNull();
    expect(attachmentExtFromMime("audio/webm")).toBeNull();
    expect(attachmentExtFromMime("application/zip")).toBeNull();
    expect(attachmentExtFromMime("")).toBeNull();
    expect(attachmentExtFromMime(null)).toBeNull();
  });
});

describe("attachmentExtFromFile", () => {
  it("usa el mime cuando existe", () => {
    expect(attachmentExtFromFile({ type: "image/jpeg", name: "x.bin" })).toBe("jpg");
  });
  it("cae al nombre cuando el mime está vacío", () => {
    expect(attachmentExtFromFile({ type: "", name: "foto.JPG" })).toBe("jpg");
    expect(attachmentExtFromFile({ type: "", name: "clip.mp4" })).toBe("mp4");
    expect(attachmentExtFromFile({ type: "", name: "doc.pdf" })).toBe("pdf");
    expect(attachmentExtFromFile({ name: "a.jpeg" })).toBe("jpg");
  });
  it("null si ni mime ni nombre encajan", () => {
    expect(attachmentExtFromFile({ type: "audio/mpeg", name: "a.mp3" })).toBeNull();
    expect(attachmentExtFromFile({ name: "a.gif" })).toBeNull();
    expect(attachmentExtFromFile({})).toBeNull();
  });
});

describe("attachmentContentTypeForExt", () => {
  it("extensión → mime canónico", () => {
    expect(attachmentContentTypeForExt("jpg")).toBe("image/jpeg");
    expect(attachmentContentTypeForExt("png")).toBe("image/png");
    expect(attachmentContentTypeForExt("webp")).toBe("image/webp");
    expect(attachmentContentTypeForExt("mp4")).toBe("video/mp4");
    expect(attachmentContentTypeForExt("pdf")).toBe("application/pdf");
  });
  it("el mime canónico siempre pasa isAllowedAttachmentMime", () => {
    for (const ext of ["jpg", "png", "webp", "mp4", "pdf"] as const) {
      expect(isAllowedAttachmentMime(attachmentContentTypeForExt(ext))).toBe(true);
    }
  });
});

describe("isAllowedAttachmentMime", () => {
  it("acepta imagen/video/pdf del bucket", () => {
    expect(isAllowedAttachmentMime("image/jpeg")).toBe(true);
    expect(isAllowedAttachmentMime("image/png")).toBe(true);
    expect(isAllowedAttachmentMime("image/webp")).toBe(true);
    expect(isAllowedAttachmentMime("video/mp4")).toBe(true);
    expect(isAllowedAttachmentMime("application/pdf")).toBe(true);
  });
  it("rechaza audio (es solo para actas) y otros", () => {
    expect(isAllowedAttachmentMime("audio/webm")).toBe(false);
    expect(isAllowedAttachmentMime("audio/mp4")).toBe(false);
    expect(isAllowedAttachmentMime("image/gif")).toBe(false);
    expect(isAllowedAttachmentMime("application/zip")).toBe(false);
    expect(isAllowedAttachmentMime(null)).toBe(false);
    expect(isAllowedAttachmentMime(undefined)).toBe(false);
    expect(isAllowedAttachmentMime("")).toBe(false);
  });
});

describe("buildTaskAttachmentPath ↔ isValidTaskAttachmentPath", () => {
  it("build → valida ida y vuelta para cada extensión", () => {
    for (const ext of ["jpg", "png", "webp", "mp4", "pdf"] as const) {
      const path = buildTaskAttachmentPath({
        tenantId: TENANT,
        taskId: TASK,
        uuid: FILE_UUID,
        ext,
      });
      expect(path).toBe(`${TENANT}/bitacora_task/${TASK}/${FILE_UUID}.${ext}`);
      expect(isValidTaskAttachmentPath(path, TENANT, TASK)).toBe(true);
    }
  });
});

describe("isValidTaskAttachmentPath — defensa en profundidad", () => {
  const ok = `${TENANT}/bitacora_task/${TASK}/${FILE_UUID}.jpg`;

  it("acepta el shape correcto del tenant + tarea", () => {
    expect(isValidTaskAttachmentPath(ok, TENANT, TASK)).toBe(true);
  });

  it("rechaza traversal `..`", () => {
    expect(
      isValidTaskAttachmentPath(
        `${TENANT}/bitacora_task/${TASK}/../secret.jpg`,
        TENANT,
        TASK,
      ),
    ).toBe(false);
    expect(isValidTaskAttachmentPath(`${TENANT}/../${FILE_UUID}.jpg`, TENANT, TASK)).toBe(false);
  });

  it("rechaza otro tenant (1er segmento ≠ tenant del caller)", () => {
    expect(isValidTaskAttachmentPath(ok, OTHER_TENANT, TASK)).toBe(false);
    const alien = `${OTHER_TENANT}/bitacora_task/${TASK}/${FILE_UUID}.jpg`;
    expect(isValidTaskAttachmentPath(alien, TENANT, TASK)).toBe(false);
  });

  it("rechaza otra tarea (2do nivel ≠ taskId esperado)", () => {
    expect(isValidTaskAttachmentPath(ok, TENANT, OTHER_TASK)).toBe(false);
    const alien = `${TENANT}/bitacora_task/${OTHER_TASK}/${FILE_UUID}.jpg`;
    expect(isValidTaskAttachmentPath(alien, TENANT, TASK)).toBe(false);
  });

  it("rechaza la carpeta del acta (bitacora_meeting) y otras", () => {
    expect(
      isValidTaskAttachmentPath(
        `${TENANT}/bitacora_meeting/${TASK}/${FILE_UUID}.jpg`,
        TENANT,
        TASK,
      ),
    ).toBe(false);
  });

  it("rechaza extensiones fuera de la lista (incl. audio)", () => {
    for (const bad of ["gif", "heic", "mp3", "webm", "m4a", "exe", "svg"]) {
      expect(
        isValidTaskAttachmentPath(
          `${TENANT}/bitacora_task/${TASK}/${FILE_UUID}.${bad}`,
          TENANT,
          TASK,
        ),
      ).toBe(false);
    }
  });

  it("rechaza segmentos que no son uuid (nombre de archivo arbitrario)", () => {
    expect(
      isValidTaskAttachmentPath(`${TENANT}/bitacora_task/${TASK}/foto.jpg`, TENANT, TASK),
    ).toBe(false);
  });

  it("rechaza tenant/taskId del caller mal formados (no uuid)", () => {
    expect(isValidTaskAttachmentPath(ok, "no-uuid", TASK)).toBe(false);
    expect(isValidTaskAttachmentPath(ok, TENANT, "no-uuid")).toBe(false);
  });

  it("rechaza no-string / vacío / con sufijo o prefijo extra", () => {
    expect(isValidTaskAttachmentPath(123 as unknown as string, TENANT, TASK)).toBe(false);
    expect(isValidTaskAttachmentPath("", TENANT, TASK)).toBe(false);
    expect(isValidTaskAttachmentPath(`${ok} `, TENANT, TASK)).toBe(false);
    expect(isValidTaskAttachmentPath(`x/${ok}`, TENANT, TASK)).toBe(false);
    expect(isValidTaskAttachmentPath(`${ok}.extra`, TENANT, TASK)).toBe(false);
  });
});

describe("ATTACH_MAX_BYTES", () => {
  it("es el límite del bucket bitacora (50 MB)", () => {
    expect(ATTACH_MAX_BYTES).toBe(50 * 1024 * 1024);
  });
});
