import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests de la server action addDocumentVersion (SDD-0060 Slice B). Cubre la
 * acceptance §5 Slice B (parte action):
 *  - arma el path SERVER-SIDE con uuid nuevo (object viejo conservado · append-only)
 *  - re-valida mime/size
 *  - rollback del object si la RPC falla
 *  - traduce no_data_found → mensaje de "reintentá" (carrera de concurrencia)
 *  - listDocumentVersionsAction delega en la query (RLS por tenant) + valida input
 *
 * createClient/getUser/rpc/storage/revalidatePath se mockean; la lógica de la
 * action corre real. Mismo enfoque que app/studio/(app)/_actions/comments.test.ts.
 */

// ─── Mocks de I/O ────────────────────────────────────────────
const mockCreateClient = vi.fn();
const mockRevalidate = vi.fn();
const mockListVersions = vi.fn();

vi.mock("@/lib/db/server", () => ({
  createClient: () => mockCreateClient(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => mockRevalidate(...a),
}));
vi.mock("@/lib/studio/documents/queries", () => ({
  listDocumentVersions: (...a: unknown[]) => mockListVersions(...a),
}));

import {
  addDocumentVersion,
  listDocumentVersionsAction,
} from "../actions";

const ROOT = "11111111-1111-4111-8111-111111111111";
const TENANT = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";

type SupaCfg = {
  user?: { id: string } | null;
  tenant?: string | null;
  head?: Record<string, unknown> | null;
  uploadError?: { message: string } | null;
  rpcError?: { code?: string; message?: string } | null;
};

/** Stub mínimo del SupabaseClient que la action toca. Registra storage ops. */
function makeSupabase(cfg: SupaCfg) {
  const uploads: { path: string; contentType?: string }[] = [];
  const removes: string[][] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];

  const supabase = {
    auth: {
      getUser: async () => ({
        data: { user: cfg.user === undefined ? { id: USER } : cfg.user },
      }),
    },
    rpc: async (name: string, args?: unknown) => {
      rpcCalls.push({ name, args });
      if (name === "get_user_tenant_id") {
        const t = cfg.tenant === undefined ? TENANT : cfg.tenant;
        return { data: t, error: t ? null : { message: "no tenant" } };
      }
      if (name === "add_document_version") {
        return { data: null, error: cfg.rpcError ?? null };
      }
      return { data: null, error: null };
    },
    from() {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        maybeSingle: async () => ({
          data: cfg.head === undefined ? defaultHead() : cfg.head,
          error: null,
        }),
      };
      return builder;
    },
    storage: {
      from() {
        return {
          upload: async (path: string, _file: unknown, opts?: { contentType?: string }) => {
            uploads.push({ path, contentType: opts?.contentType });
            return { error: cfg.uploadError ?? null };
          },
          remove: async (paths: string[]) => {
            removes.push(paths);
            return { error: null };
          },
        };
      },
    },
  };

  return { supabase, uploads, removes, rpcCalls };
}

function defaultHead() {
  return {
    root_id: ROOT,
    entity_type: "shipment",
    entity_id: "44444444-4444-4444-4444-444444444444",
    name: "BL COSCO",
  };
}

/** Construye un File PDF chiquito. */
function pdfFile(size = 1024, name = "bl.pdf"): File {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type: "application/pdf" });
}

function fd(file: File | null, extra: Record<string, string> = {}): FormData {
  const f = new FormData();
  if (file) f.set("file", file);
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("addDocumentVersion", () => {
  it("happy path: sube object server-side y llama la RPC; revalida", async () => {
    const { supabase, uploads, removes, rpcCalls } = makeSupabase({});
    mockCreateClient.mockResolvedValue(supabase);

    const res = await addDocumentVersion(ROOT, fd(pdfFile(), { version_note: "corregido monto" }));
    expect(res.ok).toBe(true);

    // path SERVER-SIDE: {tenant}/{entity_type}/{entity_id}/{uuid}.pdf
    expect(uploads).toHaveLength(1);
    const parts = uploads[0].path.split("/");
    expect(parts[0]).toBe(TENANT);
    expect(parts[1]).toBe("shipment");
    expect(parts[2]).toBe("44444444-4444-4444-4444-444444444444");
    expect(parts[3]).toMatch(/\.pdf$/);
    // content_type canónico
    expect(uploads[0].contentType).toBe("application/pdf");

    // RPC con el path recién subido + la nota
    const rpc = rpcCalls.find((c) => c.name === "add_document_version");
    expect(rpc).toBeTruthy();
    const args = rpc!.args as Record<string, unknown>;
    expect(args.p_root).toBe(ROOT);
    expect(args.p_storage_path).toBe(uploads[0].path);
    expect(args.p_version_note).toBe("corregido monto");

    // no rollback en happy path
    expect(removes).toHaveLength(0);
    expect(mockRevalidate).toHaveBeenCalled();
  });

  it("rollback del object si la RPC falla (no_data_found → mensaje de reintentá)", async () => {
    const { supabase, uploads, removes } = makeSupabase({
      rpcError: { code: "no_data_found", message: "cadena inexistente" },
    });
    mockCreateClient.mockResolvedValue(supabase);

    const res = await addDocumentVersion(ROOT, fd(pdfFile()));
    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/reintent/i);
    // el object recién subido se borra (append-only: solo el nuevo, no el viejo)
    expect(uploads).toHaveLength(1);
    expect(removes).toEqual([[uploads[0].path]]);
  });

  it("RPC con insufficient_privilege → mensaje de permiso", async () => {
    const { supabase, removes } = makeSupabase({
      rpcError: { code: "42501", message: "permission denied" },
    });
    mockCreateClient.mockResolvedValue(supabase);
    const res = await addDocumentVersion(ROOT, fd(pdfFile()));
    expect(res.error).toMatch(/permiso/i);
    expect(removes).toHaveLength(1); // rollback
  });

  it("rechaza mime no permitido (no sube nada)", async () => {
    const { supabase, uploads } = makeSupabase({});
    mockCreateClient.mockResolvedValue(supabase);
    const bad = new File([new Uint8Array(10)], "x.html", { type: "text/html" });
    const res = await addDocumentVersion(ROOT, fd(bad));
    expect(res.fieldErrors?.file).toBeTruthy();
    expect(uploads).toHaveLength(0);
  });

  it("rechaza archivo sobre el límite de 10 MB (no sube nada)", async () => {
    const { supabase, uploads } = makeSupabase({});
    mockCreateClient.mockResolvedValue(supabase);
    const big = pdfFile(11 * 1024 * 1024);
    const res = await addDocumentVersion(ROOT, fd(big));
    expect(res.fieldErrors?.file).toBeTruthy();
    expect(uploads).toHaveLength(0);
  });

  it("rechaza root_id inválido (no toca storage)", async () => {
    const { supabase, uploads } = makeSupabase({});
    mockCreateClient.mockResolvedValue(supabase);
    const res = await addDocumentVersion("no-uuid", fd(pdfFile()));
    expect(res.error).toMatch(/inválida/i);
    expect(uploads).toHaveLength(0);
  });

  it("falla temprano si la cadena no existe / no es del tenant (head null)", async () => {
    const { supabase, uploads } = makeSupabase({ head: null });
    mockCreateClient.mockResolvedValue(supabase);
    const res = await addDocumentVersion(ROOT, fd(pdfFile()));
    expect(res.error).toMatch(/no se encontró/i);
    expect(uploads).toHaveLength(0);
  });

  it("sin archivo → fieldError", async () => {
    const { supabase } = makeSupabase({});
    mockCreateClient.mockResolvedValue(supabase);
    const res = await addDocumentVersion(ROOT, fd(null));
    expect(res.fieldErrors?.file).toBeTruthy();
  });

  it("sin sesión → error de sesión", async () => {
    const { supabase, uploads } = makeSupabase({ user: null });
    mockCreateClient.mockResolvedValue(supabase);
    const res = await addDocumentVersion(ROOT, fd(pdfFile()));
    expect(res.error).toMatch(/sesión/i);
    expect(uploads).toHaveLength(0);
  });

  it("sin tenant → error de tenant", async () => {
    const { supabase, uploads } = makeSupabase({ tenant: null });
    mockCreateClient.mockResolvedValue(supabase);
    const res = await addDocumentVersion(ROOT, fd(pdfFile()));
    expect(res.error).toMatch(/tenant/i);
    expect(uploads).toHaveLength(0);
  });
});

describe("listDocumentVersionsAction", () => {
  it("delega en listDocumentVersions con el rootId", async () => {
    const { supabase } = makeSupabase({});
    mockCreateClient.mockResolvedValue(supabase);
    mockListVersions.mockResolvedValue([{ id: "v1", version_no: 1 }]);
    const res = await listDocumentVersionsAction(ROOT);
    expect(mockListVersions).toHaveBeenCalledWith(supabase, ROOT);
    expect(res).toHaveLength(1);
  });

  it("rootId inválido → [] sin tocar la query", async () => {
    const res = await listDocumentVersionsAction("no-uuid");
    expect(res).toEqual([]);
    expect(mockListVersions).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
