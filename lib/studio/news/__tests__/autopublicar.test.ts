// @vitest-environment node
/**
 * SDD-0611 · El orquestador de la vía automática con una base y un Discord dobles.
 *
 * Lo que se prueba aquí es el cableado: que lee lo que F1 a F10 necesitan, que
 * le pasa a la base los motivos y la auditoría completa, que el aviso a
 * `#noticias` lleva titular, enlace y retiro (sin el cuerpo) y que su resultado
 * queda registrado para F8. Las reglas de cada filtro y de la base tienen sus
 * propias pruebas (lib/news/autopublicar/__tests__).
 */
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluarBorradorAutomatico, nombresProhibidosDe, webhookNoticias } from "../autopublicar";
import { LINEAS_ROJAS_REVISOR } from "@/lib/news/autopublicar/control";
import { huellaDe } from "@/lib/news/autopublicar/huella";
import { extraerExtracto } from "@/lib/news/derivados";
import { slugify } from "@/lib/news/slugify";
import { AHORA, DRAFT, NOMBRES_PROHIBIDOS, TENANT, TITULAR, cuerpo } from "@/lib/news/autopublicar/__tests__/fixture";

const WEBHOOK = `https://discord.com/api/webhooks/123456789012345678/${"a".repeat(68)}`;
const ENV = {
  DISCORD_TENANT_ID: TENANT,
  DISCORD_WEBHOOK_NOTICIAS: WEBHOOK,
  NEWS_NOMBRES_PROHIBIDOS: NOMBRES_PROHIBIDOS.join("\n"),
  NEXT_PUBLIC_SITE_URL: "https://dtdcargo.com",
};

const BODY = cuerpo({ palabras: 1000, subtitulos: 6, ocurrencias: 10 });

function borrador(over: Record<string, unknown> = {}) {
  const excerpt = extraerExtracto(BODY);
  const huella = huellaDe({
    tipo: "informativo",
    categoria: "importa-sin-perder-plata",
    title: TITULAR,
    focus_keyword: "importador",
    secondary_keywords: [],
    meta_description: excerpt,
    body_markdown: BODY,
  });
  return {
    id: DRAFT,
    tenant_id: TENANT,
    status: "en_revision",
    tipo: "informativo",
    categoria: "importa-sin-perder-plata",
    selected_headline: TITULAR,
    article_markdown: BODY,
    focus_keyword: "importador",
    secondary_keywords: [],
    reviewer_verdict: {
      veredicto: "aprobado", agente: "revisor", modelo: "modelo-x", version: "1",
      draft_id: DRAFT, huella, riesgo: "Ninguno a la vista.",
      lineas_rojas: Object.fromEntries(LINEAS_ROJAS_REVISOR.map((k) => [k, "cumple"])),
    },
    autopub_sources: [],
    search_console: { consulta: "como importar de china", fecha: "2026-11-10" },
    idea_tipo: "guia",
    autopub_test_noticia: { busca_google: true, ia_responde: true, sirve_6_meses: true },
    autopub_content_kind: "guide",
    autopub_cover_image_url: null,
    writer_agent: { agente: "redactor", modelo: "modelo-x", version: "1" },
    ...over,
  };
}

interface Estado {
  draft: Record<string, unknown> | null;
  settings: { enabled: boolean; daily_cap: number; weekly_cap: number } | null;
  automaticas: Array<{ created_at: string }>;
  ultimoAviso: { notice_state: string | null } | null;
  salidas: Array<{ reason: string | null }>;
  rpcResultado: Record<string, unknown>;
}

/** Base doble: responde por tabla y anota cada RPC. */
function dobleDb(e: Estado) {
  const rpcs: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const from = (tabla: string) => {
    const filtros: Record<string, unknown> = {};
    const datos = () => {
      switch (tabla) {
        case "seo_drafts": return e.draft;
        case "news_autopublish_settings": return e.settings;
        case "news_publication_audit": return e.ultimoAviso;
        case "news_post_exits": return e.salidas;
        case "news_posts":
          if ("seo_draft_id" in filtros || "slug" in filtros) return null;
          return e.automaticas;
        default: return null;
      }
    };
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => { filtros[c] = v; return q; },
      gte: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: datos(), error: null }),
      then: (ok: (r: { data: unknown; error: null }) => unknown) => Promise.resolve({ data: datos(), error: null }).then(ok),
    };
    return q;
  };
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    rpcs.push({ fn, args });
    return fn === "news_evaluacion_automatica" ? { data: e.rpcResultado, error: null } : { data: null, error: null };
  };
  return { db: { from, rpc } as unknown as SupabaseClient, rpcs };
}

function estado(over: Partial<Estado> = {}): Estado {
  return {
    draft: borrador(),
    settings: { enabled: true, daily_cap: 1, weekly_cap: 2 },
    automaticas: [],
    ultimoAviso: null,
    salidas: [],
    rpcResultado: { decision: "publicada", post_id: "40000000-0000-4000-8000-000000000001", audit_id: "50000000-0000-4000-8000-000000000001", motivos: [] },
    ...over,
  };
}

function discord(status = 200) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    void init;
    return new Response(status === 200 ? JSON.stringify({ id: "987654321098765432" }) : "{}", { status });
  });
}

describe("SDD-0611 · orquestador de la vía automática", () => {
  it("todo en verde: la base recibe cero motivos y la auditoría completa; avisa y registra entregado", async () => {
    const { db, rpcs } = dobleDb(estado());
    const fetchImpl = discord();
    const r = await evaluarBorradorAutomatico({ db, env: ENV, ahora: AHORA, fetchImpl: fetchImpl as unknown as typeof fetch }, DRAFT);

    expect(r.ok).toBe(true);
    expect(r.evaluacion?.motivos).toEqual([]);
    const llamada = rpcs.find((x) => x.fn === "news_evaluacion_automatica")!;
    expect(llamada.args.p_motivos).toEqual([]);
    const auditoria = llamada.args.p_auditoria as Record<string, unknown>;
    expect(auditoria.writer).toEqual({ agente: "redactor", modelo: "modelo-x", version: "1" });
    expect(auditoria.reviewer).toEqual({ agente: "revisor", modelo: "modelo-x", version: "1", veredicto: "aprobado" });
    expect(auditoria.control_version).toBe("0611-control-v1");
    expect(auditoria.prompts_version).toBe("redactor@1");
    expect((llamada.args.p_post as { slug: string }).slug).toBe(slugify(TITULAR));

    const contenido = JSON.parse(String(fetchImpl.mock.calls[0][1].body)).content as string;
    expect(contenido).toContain("Publicada sola");
    expect(contenido).toContain("1 de 2 esta semana");
    expect(contenido).toContain(`https://dtdcargo.com/noticias/${slugify(TITULAR)}`);
    expect(contenido).toContain("/studio/marketing/noticias-web/retirar/40000000-0000-4000-8000-000000000001");
    expect(contenido).not.toContain(BODY.slice(0, 80));
    expect(rpcs.find((x) => x.fn === "news_registrar_aviso")!.args).toEqual({
      p_audit_id: "50000000-0000-4000-8000-000000000001",
      p_estado: "entregado",
      p_message_id: "987654321098765432",
    });
  });

  it("un filtro en rojo llega a la base como motivo, y el aviso es de retenida", async () => {
    const { db, rpcs } = dobleDb(
      estado({ ultimoAviso: { notice_state: "incierto" }, rpcResultado: { decision: "retenida", audit_id: "50000000-0000-4000-8000-000000000002", motivos: ["aviso_pendiente"] } }),
    );
    const fetchImpl = discord();
    const r = await evaluarBorradorAutomatico({ db, env: ENV, ahora: AHORA, fetchImpl: fetchImpl as unknown as typeof fetch }, DRAFT);
    expect(r.evaluacion?.motivos).toEqual(["aviso_pendiente"]);
    expect(rpcs[0].args.p_motivos).toEqual(["aviso_pendiente"]);
    const contenido = JSON.parse(String(fetchImpl.mock.calls[0][1].body)).content as string;
    expect(contenido).toContain("Retenida para revisión");
    expect(contenido).toContain("aviso_pendiente");
  });

  it("fallo parcial: si el aviso no llega, la noticia sigue publicada y queda registrado para F8", async () => {
    const { db, rpcs } = dobleDb(estado());
    const r = await evaluarBorradorAutomatico(
      { db, env: ENV, ahora: AHORA, fetchImpl: discord(500) as unknown as typeof fetch }, DRAFT);
    expect(r.decision).toBe("publicada");
    expect(r.aviso).toBe("reintentable");
    expect(rpcs.find((x) => x.fn === "news_registrar_aviso")!.args.p_estado).toBe("reintentable");
  });

  it("sin canal configurado no se pierde: queda como no entregado", async () => {
    const { db, rpcs } = dobleDb(estado());
    const r = await evaluarBorradorAutomatico({ db, env: { ...ENV, DISCORD_WEBHOOK_NOTICIAS: "" }, ahora: AHORA }, DRAFT);
    expect(r.aviso).toBe("sin_canal");
    expect(rpcs.find((x) => x.fn === "news_registrar_aviso")!.args.p_estado).toBe("rechazado");
  });

  it("dos retiradas esta semana: el aviso lo dice primero", async () => {
    const { db } = dobleDb(estado({ salidas: [{ reason: "tono" }, { reason: null }] }));
    const fetchImpl = discord();
    await evaluarBorradorAutomatico({ db, env: ENV, ahora: AHORA, fetchImpl: fetchImpl as unknown as typeof fetch }, DRAFT);
    const contenido = JSON.parse(String(fetchImpl.mock.calls[0][1].body)).content as string;
    expect(contenido.split("\n")[0]).toBe("⚠️ Van 2 retiradas esta semana (tono, motivo_pendiente).");
  });

  it("un borrador que no está en revisión no se toca", async () => {
    const { db, rpcs } = dobleDb(estado({ draft: borrador({ status: "retenido" }) }));
    const r = await evaluarBorradorAutomatico({ db, env: ENV, ahora: AHORA }, DRAFT);
    expect(r.decision).toBe("ignorada");
    expect(rpcs).toEqual([]);
  });

  it("de otro tenant, en prueba o sin lista de nombres falla cerrado", async () => {
    const otro = dobleDb(estado());
    const r1 = await evaluarBorradorAutomatico({ db: otro.db, env: { ...ENV, DISCORD_TENANT_ID: "otro" }, ahora: AHORA }, DRAFT);
    expect(r1.evaluacion?.motivos).toContain("fuera_de_alcance");
    const sinLista = dobleDb(estado());
    const r2 = await evaluarBorradorAutomatico({ db: sinLista.db, env: { ...ENV, NEWS_NOMBRES_PROHIBIDOS: "" }, ahora: AHORA }, DRAFT);
    expect(r2.evaluacion?.motivos).toContain("linea_roja:lista_no_cargada");
    expect(webhookNoticias(TENANT, { ...ENV, APP_ENV: "staging" })).toBe(null);
    expect(nombresProhibidosDe({ NEWS_NOMBRES_PROHIBIDOS: "Uno; Dos\nTres" })).toEqual(["Uno", "Dos", "Tres"]);
  });
});
