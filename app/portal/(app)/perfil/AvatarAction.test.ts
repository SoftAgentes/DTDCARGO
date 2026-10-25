// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({
  clientId: "client-1" as string | null,
  row: { tenant_id: "tenant-1", markbox: "DTD-5452", avatar_path: "tenant-1/DTD-5452/avatar/vieja.jpg" } as
    | { tenant_id: string; markbox: string; avatar_path: string | null }
    | null,
  upload: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => stubs.revalidatePath(...a) }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
// SDD-0552: identidad, tenant y markbox salen del principal Portal de la sesión.
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () =>
    stubs.clientId
      ? {
          userId: "u1",
          tenantId: "tenant-1",
          client: { id: stubs.clientId, markbox: "DTD-5452", name: "Cliente sintético" },
        }
      : null,
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: stubs.row, error: null }) }) }),
      update: (values: unknown) => ({ eq: async () => stubs.update(values) }),
    }),
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => stubs.upload(...a),
        remove: (...a: unknown[]) => stubs.remove(...a),
      }),
    },
  }),
}));

const { updateAvatarAction, removeAvatarAction } = await import("./avatar-actions");

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
function jpegWithExif(): Uint8Array<ArrayBuffer> {
  const exif = ascii("Exif\0\0GPS 10.4806,-66.9036");
  const app1 = [0xff, 0xe1, 0, exif.length + 2, ...exif];
  const sos = [0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0xff, 0xd9];
  return Uint8Array.from([0xff, 0xd8, ...app1, ...sos]);
}
const form = (file: File) => {
  const fd = new FormData();
  fd.set("avatar", file);
  return fd;
};

beforeEach(() => {
  stubs.clientId = "client-1";
  stubs.row = { tenant_id: "tenant-1", markbox: "DTD-5452", avatar_path: "tenant-1/DTD-5452/avatar/vieja.jpg" };
  stubs.upload.mockReset().mockResolvedValue({ error: null });
  stubs.update.mockReset().mockResolvedValue({ error: null });
  stubs.remove.mockReset().mockResolvedValue({ error: null });
  stubs.revalidatePath.mockReset();
});

describe("updateAvatarAction (SDD-0487)", () => {
  it("sube el JPEG sin EXIF, apunta al nuevo y borra el viejo", async () => {
    const out = await updateAvatarAction({}, form(new File([jpegWithExif()], "avatar.jpg", { type: "image/jpeg" })));
    expect(out).toEqual({ ok: true });
    const [path, body, options] = stubs.upload.mock.calls[0];
    expect(path).toMatch(/^tenant-1\/DTD-5452\/avatar\/[0-9a-f-]+\.jpg$/);
    expect(options).toMatchObject({ contentType: "image/jpeg", upsert: false });
    const uploaded = String.fromCharCode(...new Uint8Array(body as Buffer));
    expect(uploaded).not.toMatch(/GPS|Exif/);
    expect(stubs.update).toHaveBeenCalledWith({ avatar_path: path });
    expect(stubs.remove).toHaveBeenCalledWith(["tenant-1/DTD-5452/avatar/vieja.jpg"]);
  });

  it("control: el archivo de la prueba sí trae GPS", () => {
    expect(String.fromCharCode(...jpegWithExif())).toMatch(/GPS/);
  });

  it.each([
    ["un HEIC sin preparar", new File([new Uint8Array(10)], "x.heic", { type: "image/heic" }), "Elige una foto: JPG, PNG o la del iPhone."],
    ["un JPEG de más de 2 MB", new File([new Uint8Array(2 * 1024 * 1024 + 1)], "x.jpg", { type: "image/jpeg" }), "Esa foto es demasiado pesada. Elige otra."],
    ["un JPEG roto", new File([new Uint8Array([0xff, 0xd8, 0x00])], "x.jpg", { type: "image/jpeg" }), "No pudimos leer esa foto. Elige otra o conviértela a JPG."],
  ])("rechaza %s sin subir nada", async (_label, file, error) => {
    expect(await updateAvatarAction({}, form(file))).toEqual({ error });
    expect(stubs.upload).not.toHaveBeenCalled();
  });

  it("sin sesión no hace nada", async () => {
    stubs.clientId = null;
    const out = await updateAvatarAction({}, form(new File([jpegWithExif()], "a.jpg", { type: "image/jpeg" })));
    expect(out).toEqual({ error: "Tu sesión expiró. Vuelve a entrar al portal." });
    expect(stubs.upload).not.toHaveBeenCalled();
  });

  it("si el puntero no se guarda, borra lo recién subido", async () => {
    stubs.update.mockResolvedValue({ error: { message: "x" } });
    await updateAvatarAction({}, form(new File([jpegWithExif()], "a.jpg", { type: "image/jpeg" })));
    const [path] = stubs.upload.mock.calls[0];
    expect(stubs.remove).toHaveBeenCalledWith([path]);
  });
});

describe("removeAvatarAction (SDD-0487)", () => {
  it("borra primero el objeto y después el puntero", async () => {
    const order: string[] = [];
    stubs.remove.mockImplementation(async () => (order.push("remove"), { error: null }));
    stubs.update.mockImplementation(async () => (order.push("update"), { error: null }));
    expect(await removeAvatarAction()).toEqual({ ok: true, removed: true });
    expect(stubs.remove).toHaveBeenCalledWith(["tenant-1/DTD-5452/avatar/vieja.jpg"]);
    expect(stubs.update).toHaveBeenCalledWith({ avatar_path: null });
    expect(order).toEqual(["remove", "update"]);
  });

  it("si Storage no borra, deja el puntero para reintentar", async () => {
    stubs.remove.mockResolvedValue({ error: { message: "x" } });
    expect(await removeAvatarAction()).toEqual({ error: "No pudimos quitar tu foto. Prueba de nuevo." });
    expect(stubs.update).not.toHaveBeenCalled();
  });

  it("sin foto no hace nada y responde bien", async () => {
    stubs.row = { tenant_id: "tenant-1", markbox: "DTD-5452", avatar_path: null };
    expect(await removeAvatarAction()).toEqual({ ok: true, removed: true });
    expect(stubs.remove).not.toHaveBeenCalled();
  });
});
