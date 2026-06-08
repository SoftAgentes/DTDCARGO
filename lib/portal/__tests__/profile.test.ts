/**
 * Tests del perfil del cliente (REGISTRO EXPRESS · founder 2026-06-07).
 *
 *  - getProfileCompleteness: deriva hasPhoto/hasAddress/complete leyendo la fila
 *    del cliente del portal (helper aislada get_portal_client_id). Stub mínimo
 *    encadenable, mismo criterio que activation.test.ts.
 *  - validatePhotoFile: validación pura del File subido (presencia/MIME/tamaño).
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfileCompleteness } from "../portal-queries";
import { validatePhotoFile, PHOTO_MAX_BYTES } from "../client-photo";

function stub(opts: {
  portalClientId: string | null;
  cedulaPhotoPath?: string | null;
  address?: string | null;
}): SupabaseClient {
  return {
    rpc(fn: string) {
      if (fn === "get_portal_client_id") {
        return Promise.resolve({ data: opts.portalClientId, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    from() {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () =>
          Promise.resolve({
            data: {
              cedula_photo_path: opts.cedulaPhotoPath ?? null,
              address: opts.address ?? null,
            },
            error: null,
          }),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("getProfileCompleteness — perfil completo = foto + dirección", () => {
  it("ambas cargadas → complete", async () => {
    const r = await getProfileCompleteness(
      stub({ portalClientId: "c-1", cedulaPhotoPath: "t/DTD-1/x.jpg", address: "Av. X" }),
    );
    expect(r).toEqual({ hasPhoto: true, hasAddress: true, complete: true });
  });

  it("solo foto → incompleto por dirección", async () => {
    const r = await getProfileCompleteness(
      stub({ portalClientId: "c-1", cedulaPhotoPath: "t/DTD-1/x.jpg", address: null }),
    );
    expect(r).toEqual({ hasPhoto: true, hasAddress: false, complete: false });
  });

  it("solo dirección → incompleto por foto", async () => {
    const r = await getProfileCompleteness(
      stub({ portalClientId: "c-1", cedulaPhotoPath: "  ", address: "Av. X" }),
    );
    expect(r).toEqual({ hasPhoto: false, hasAddress: true, complete: false });
  });

  it("ninguna → todo false", async () => {
    const r = await getProfileCompleteness(
      stub({ portalClientId: "c-1", cedulaPhotoPath: null, address: "" }),
    );
    expect(r).toEqual({ hasPhoto: false, hasAddress: false, complete: false });
  });

  it("principal no-cliente del portal → todo false", async () => {
    const r = await getProfileCompleteness(stub({ portalClientId: null }));
    expect(r).toEqual({ hasPhoto: false, hasAddress: false, complete: false });
  });
});

describe("validatePhotoFile — foto de identidad", () => {
  it("rechaza si no hay archivo", () => {
    expect(validatePhotoFile(null)).toEqual({
      ok: false,
      error: expect.stringMatching(/sube la foto/i),
    });
  });

  it("rechaza un valor que no es File", () => {
    const r = validatePhotoFile("una-string" as unknown as FormDataEntryValue);
    expect(r.ok).toBe(false);
  });

  it("rechaza MIME no permitido", () => {
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const r = validatePhotoFile(pdf);
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/formato/i) });
  });

  it("rechaza archivo demasiado pesado", () => {
    const big = new File([new Uint8Array(PHOTO_MAX_BYTES + 1)], "big.jpg", {
      type: "image/jpeg",
    });
    const r = validatePhotoFile(big);
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/pesada/i) });
  });

  it("acepta una imagen JPG válida", () => {
    const jpg = new File([new Uint8Array(1024)], "cedula.jpg", { type: "image/jpeg" });
    const r = validatePhotoFile(jpg);
    expect(r.ok).toBe(true);
  });
});
