/**
 * SDD-0626 §3.1 · SGE-AG-01 §7 · El botón de pausa de la oficina.
 *
 * Lo que se fija aquí:
 * - Leer el estado: sin el «sí» de `is_platform_admin()` NO se crea el cliente de servicio; se lee UNA fila y nada se
 *   escribe; sin filas la oficina se trata como pausada.
 * - Cambiar la pausa: va por `office_cambiar_pausa` con el cliente que se le pasa (la sesión del usuario) y traduce los
 *   códigos de la base.
 * - La acción: los dos candados antes de leer el formulario; despausar exige la confirmación; un motivo vacío o con
 *   datos personales no llega a la base; nunca usa el cliente de servicio.
 * - La tarjeta: un solo botón, el contrario del estado; con el estado desconocido solo se puede pausar.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TarjetaPausa } from "@/app/studio/(app)/admin/oficina-virtual/_components/TarjetaPausa";

import { COLUMNAS } from "../mini-vista";
import { type LecturaPausa, cambiarPausa, leerPausa } from "../pausa";

const ROOT = resolve(__dirname, "..", "..", "..", "..");

// ── Dobles de la acción ──────────────────────────────────────────────────────────────────────────────────────────────
const doble = vi.hoisted(() => ({
  llamadas: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  respuesta: { data: null as unknown, error: null as { code: string } | null },
  moduloNiega: null as string | null,
  adminNiega: null as string | null,
  orden: [] as string[],
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      doble.orden.push(`rpc:${fn}`);
      doble.llamadas.push({ fn, args });
      return doble.respuesta;
    },
  }),
}));
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: async (_s: unknown, modulo: string) => {
    doble.orden.push(`modulo:${modulo}`);
    return doble.moduloNiega;
  },
}));
vi.mock("@/lib/studio/platform-admin", () => ({
  platformAdminDenial: async () => {
    doble.orden.push("superadmin");
    return doble.adminNiega;
  },
}));

async function accionar(campos: Record<string, string>): Promise<string> {
  const { cambiarPausaAction } = await import("@/app/studio/(app)/admin/oficina-virtual/actions");
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  try {
    await cambiarPausaAction(fd);
  } catch (e) {
    const m = /^REDIRECT \/studio\/admin\/oficina-virtual\?r=([^&]+)/.exec((e as Error).message);
    if (m) return decodeURIComponent(m[1]);
    throw e;
  }
  throw new Error("la acción no volvió a la página");
}

beforeEach(() => {
  doble.llamadas.length = 0;
  doble.orden.length = 0;
  doble.respuesta = { data: null, error: null };
  doble.moduloNiega = null;
  doble.adminNiega = null;
});

// ── Doble del cliente de servicio: solo sabe leer ────────────────────────────────────────────────────────────────────
type Respuesta = { data?: unknown; error?: { code: string; message?: string } | null };

function clienteDeLectura(respuesta: Respuesta) {
  const consultas: Array<{ tabla: string; columnas: string; orden: string | null; limite: number | null }> = [];
  const admin = {
    from(tabla: string) {
      const c = { tabla, columnas: "", orden: null as string | null, limite: null as number | null };
      const consulta = {
        select(columnas: string) {
          c.columnas = columnas;
          consultas.push(c);
          return consulta;
        },
        order(columna: string, o: { ascending: boolean }) {
          c.orden = `${columna} ${o.ascending ? "asc" : "desc"}`;
          return consulta;
        },
        limit(n: number) {
          c.limite = n;
          return consulta;
        },
        then(resolver: (r: { data: unknown; error: unknown }) => unknown) {
          return Promise.resolve(resolver({ data: respuesta.data ?? null, error: respuesta.error ?? null }));
        },
      };
      return new Proxy(consulta, {
        get(objetivo, prop) {
          if (typeof prop === "string" && ["insert", "update", "upsert", "delete"].includes(prop)) {
            throw new Error(`leerPausa intentó escribir: ${prop}`);
          }
          return Reflect.get(objetivo, prop);
        },
      });
    },
    rpc() {
      throw new Error("leerPausa no llama funciones");
    },
  } as unknown as SupabaseClient;
  return { admin, consultas };
}

const DESPAUSADA = { pausada: false, cambiado_por: "11111111-1111-4111-8111-111111111111", cambiado_en: "2026-11-18T10:42:08Z", motivo: "Etapa 1" };
const PAUSADA = { pausada: true, cambiado_por: null, cambiado_en: "2026-11-15T20:51:38Z", motivo: "La oficina nace pausada (SDD-0626 §3.1)." };

describe("pausa · leer el estado", () => {
  it("sin el «sí» de la base no se crea el cliente de servicio (ni si la pregunta falla, ni con un valor raro)", async () => {
    let creados = 0;
    const crearAdmin = () => {
      creados++;
      return clienteDeLectura({ data: [DESPAUSADA] }).admin;
    };
    const preguntas: Array<() => Promise<boolean>> = [
      async () => false,
      async () => {
        throw new Error("sin red");
      },
      (async () => "si") as unknown as () => Promise<boolean>,
    ];
    for (const esAdmin of preguntas) {
      expect(await leerPausa({ esAdmin, crearAdmin })).toEqual({ ok: false, motivo: "sin_permiso" });
    }
    expect(creados).toBe(0);
  });

  it("lee UNA fila de office_paused, la última, con las columnas de la mini-vista; no escribe", async () => {
    const { admin, consultas } = clienteDeLectura({ data: [DESPAUSADA] });
    const r = await leerPausa({ esAdmin: async () => true, crearAdmin: () => admin });
    expect(consultas).toEqual([{ tabla: "office_paused", columnas: COLUMNAS.office_paused, orden: "id desc", limite: 1 }]);
    expect(r).toEqual({
      ok: true,
      pausada: false,
      vigente: { pausada: false, cambiadoEn: "2026-11-18T10:42:08Z", quien: "persona:11111111-1111-4111-8111-111111111111", motivo: "Etapa 1" },
    });
  });

  it("sin filas la oficina se trata como pausada (falla cerrado)", async () => {
    const { admin } = clienteDeLectura({ data: [] });
    expect(await leerPausa({ esAdmin: async () => true, crearAdmin: () => admin })).toEqual({ ok: true, pausada: true, vigente: null });
  });

  it("una fila con un valor raro cuenta como pausada", async () => {
    const { admin } = clienteDeLectura({ data: [{ ...PAUSADA, pausada: null }] });
    const r = await leerPausa({ esAdmin: async () => true, crearAdmin: () => admin });
    expect(r.ok && r.pausada).toBe(true);
  });

  it("sin la 0541 dice sin_migracion; otro error dice error y el log solo lleva el código", async () => {
    const anotado: string[] = [];
    const sinTabla = clienteDeLectura({ error: { code: "42P01" } }).admin;
    expect(await leerPausa({ esAdmin: async () => true, crearAdmin: () => sinTabla, registrar: (m) => anotado.push(m) })).toEqual({
      ok: false,
      motivo: "sin_migracion",
    });
    expect(anotado).toEqual([]);
    const roto = clienteDeLectura({ error: { code: "57014", message: "fila con motivo SECRETO-DE-PRUEBA" } }).admin;
    expect(await leerPausa({ esAdmin: async () => true, crearAdmin: () => roto, registrar: (m) => anotado.push(m) })).toEqual({
      ok: false,
      motivo: "error",
    });
    expect(anotado).toEqual(["[oficina-pausa] no se pudo leer office_paused (código 57014)"]);
  });

  it("si el cliente de servicio no se puede crear, dice error sin repetir el motivo", async () => {
    const anotado: string[] = [];
    const r = await leerPausa({
      esAdmin: async () => true,
      crearAdmin: () => {
        throw new Error("VALOR-QUE-NO-DEBE-SALIR");
      },
      registrar: (m) => anotado.push(m),
    });
    expect(r).toEqual({ ok: false, motivo: "error" });
    expect(anotado.join(" ")).not.toContain("VALOR-QUE-NO-DEBE-SALIR");
  });
});

describe("pausa · cambiarla en la base", () => {
  function sesion(respuesta: { data?: unknown; error?: { code: string } | null }) {
    const llamadas: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const supabase = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        llamadas.push({ fn, args });
        return { data: respuesta.data ?? null, error: respuesta.error ?? null };
      },
    } as unknown as SupabaseClient;
    return { supabase, llamadas };
  }

  it("llama a office_cambiar_pausa con el valor y el motivo", async () => {
    const { supabase, llamadas } = sesion({ data: true });
    expect(await cambiarPausa(supabase, { pausar: true, motivo: "Fin de la sesión" })).toEqual({ ok: true, pausada: true });
    expect(llamadas).toEqual([{ fn: "office_cambiar_pausa", args: { p_pausada: true, p_motivo: "Fin de la sesión" } }]);
    const otra = sesion({ data: false });
    expect(await cambiarPausa(otra.supabase, { pausar: false, motivo: "Empieza la sesión" })).toEqual({ ok: true, pausada: false });
  });

  it("si la base no devuelve el valor pedido, no se da por hecho", async () => {
    expect(await cambiarPausa(sesion({ data: true }).supabase, { pausar: false, motivo: "x" })).toEqual({ ok: false, codigo: "error" });
    expect(await cambiarPausa(sesion({ data: null }).supabase, { pausar: true, motivo: "x" })).toEqual({ ok: false, codigo: "error" });
  });

  it("traduce los códigos de la base", async () => {
    const casos: Array<[string, string]> = [
      ["42501", "sin_permiso"],
      ["22023", "invalido"],
      ["22004", "invalido"],
      ["42883", "sin_tablas"],
      ["PGRST202", "sin_tablas"],
      ["57014", "error"],
    ];
    for (const [code, codigo] of casos) {
      expect(await cambiarPausa(sesion({ error: { code } }).supabase, { pausar: true, motivo: "x" })).toEqual({ ok: false, codigo });
    }
  });
});

describe("pausa · la acción", () => {
  it("pausar: los dos candados primero, y después la función de la base con la sesión del usuario", async () => {
    doble.respuesta = { data: true, error: null };
    expect(await accionar({ pausar: "si", motivo: "Fin de la sesión de práctica" })).toBe("ok_pausada");
    expect(doble.orden).toEqual(["modulo:admin", "superadmin", "rpc:office_cambiar_pausa"]);
    expect(doble.llamadas).toEqual([{ fn: "office_cambiar_pausa", args: { p_pausada: true, p_motivo: "Fin de la sesión de práctica" } }]);
  });

  it("despausar exige la casilla de confirmación", async () => {
    doble.respuesta = { data: false, error: null };
    expect(await accionar({ pausar: "no", motivo: "Empieza la sesión" })).toBe("sin_confirmar");
    expect(doble.llamadas).toEqual([]);
    expect(await accionar({ pausar: "no", confirmo: "on", motivo: "Empieza la sesión" })).toBe("ok_despausada");
    expect(doble.llamadas).toEqual([{ fn: "office_cambiar_pausa", args: { p_pausada: false, p_motivo: "Empieza la sesión" } }]);
  });

  it("sin el permiso del módulo o sin ser superadministrador no llega a la base", async () => {
    doble.moduloNiega = "no";
    expect(await accionar({ pausar: "si", motivo: "x" })).toBe("pausa_sin_permiso");
    doble.moduloNiega = null;
    doble.adminNiega = "no";
    expect(await accionar({ pausar: "si", motivo: "x" })).toBe("pausa_sin_permiso");
    expect(doble.llamadas).toEqual([]);
  });

  it("un valor que no es «si» ni «no», un motivo vacío o un motivo con datos personales no llegan a la base", async () => {
    expect(await accionar({ pausar: "quizas", motivo: "x" })).toBe("pausa_invalida");
    expect(await accionar({ motivo: "x" })).toBe("pausa_invalida");
    expect(await accionar({ pausar: "si", motivo: "   " })).toBe("sin_motivo");
    expect(await accionar({ pausar: "si", motivo: "x".repeat(501) })).toBe("sin_motivo");
    expect(await accionar({ pausar: "si", motivo: "avisar a prueba9@ejemplo.com" })).toBe("motivo_con_datos");
    expect(doble.llamadas).toEqual([]);
  });

  it("los rechazos de la base vuelven con el aviso de la pausa, no con el de la revisión", async () => {
    doble.respuesta = { data: null, error: { code: "42501" } };
    expect(await accionar({ pausar: "si", motivo: "x" })).toBe("pausa_sin_permiso");
    doble.respuesta = { data: null, error: { code: "42883" } };
    expect(await accionar({ pausar: "si", motivo: "x" })).toBe("sin_tablas");
    doble.respuesta = { data: null, error: { code: "57014" } };
    expect(await accionar({ pausar: "si", motivo: "x" })).toBe("pausa_error");
  });

  it("las acciones de la oficina nunca usan el cliente de servicio", () => {
    const acciones = readFileSync(resolve(ROOT, "app/studio/(app)/admin/oficina-virtual/actions.ts"), "utf8");
    expect(acciones).not.toMatch(/lib\/db\/admin|createAdminClient/);
    const lib = readFileSync(resolve(ROOT, "lib/studio/oficina/pausa.ts"), "utf8");
    // pausa.ts recibe los clientes: no crea ninguno.
    expect(lib).not.toMatch(/lib\/db\/(admin|server)|createAdminClient\(|createClient\(/);
  });

  it("cada aviso que devuelve la acción de pausa tiene su texto en la página", () => {
    const pagina = readFileSync(resolve(ROOT, "app/studio/(app)/admin/oficina-virtual/page.tsx"), "utf8");
    for (const codigo of ["ok_pausada", "ok_despausada", "sin_confirmar", "sin_tablas", "pausa_sin_permiso", "pausa_invalida", "pausa_error", "sin_motivo", "motivo_con_datos"]) {
      expect(pagina, codigo).toMatch(new RegExp(`\\b${codigo}:\\s`));
    }
    // El cliente de servicio solo se le pasa a leerPausa, que es quien pone el candado.
    expect(pagina).toMatch(/leerPausa\(\{ esAdmin: \(\) => isPlatformAdmin\(supabase\), crearAdmin: createAdminClient \}\)/);
    expect(pagina.match(/createAdminClient/g)).toHaveLength(2);
  });
});

describe("pausa · la tarjeta", () => {
  const pintar = (pausa: LecturaPausa) => renderToStaticMarkup(createElement(TarjetaPausa, { pausa, accion: () => {} }));
  const vigente = (pausada: boolean, motivo = "Etapa 1") => ({ pausada, cambiadoEn: "2026-11-18T10:42:08Z", quien: "sistema", motivo });

  it("despausada: ofrece PAUSAR, sin casilla de confirmación", () => {
    const html = pintar({ ok: true, pausada: false, vigente: vigente(false) });
    expect(html).toContain("La oficina está DESPAUSADA.");
    expect(html).toContain('name="pausar" value="si"');
    expect(html).toContain("Pausar la oficina");
    expect(html).not.toContain("Despausar la oficina");
    expect(html).not.toContain('name="confirmo"');
    expect(html).toMatch(/<textarea name="motivo" required=""/);
  });

  it("pausada: ofrece DESPAUSAR, con la casilla de confirmación obligatoria", () => {
    const html = pintar({ ok: true, pausada: true, vigente: vigente(true) });
    expect(html).toContain("La oficina está PAUSADA.");
    expect(html).toContain('name="pausar" value="no"');
    expect(html).toContain("Despausar la oficina");
    // La casilla existe y es obligatoria (el orden de los atributos lo pone React).
    const casilla = /<input[^>]*name="confirmo"[^>]*>/.exec(html)?.[0] ?? "";
    expect(casilla).toContain('type="checkbox"');
    expect(casilla).toContain('required=""');
    expect((html.match(/<button/g) ?? []).length).toBe(1);
  });

  it("sin filas: pausada, y lo dice", () => {
    const html = pintar({ ok: true, pausada: true, vigente: null });
    expect(html).toContain("La oficina está PAUSADA.");
    expect(html).toContain("No hay ningún cambio registrado");
  });

  it("si el estado no se pudo leer, solo se puede pausar", () => {
    const html = pintar({ ok: false, motivo: "error" });
    expect(html).toContain("No se pudo leer si la oficina está pausada.");
    expect(html).toContain('name="pausar" value="si"');
    expect(html).not.toContain("Despausar la oficina");
  });

  it("pausada por la auto-pausa por tope (gasto o llamadas del plan fijo): avisa que se volverá a pausar sola", () => {
    const html = pintar({ ok: true, pausada: true, vigente: vigente(true, "Auto-pausa: el gasto del mes (0.8100 USD) llegó al 80 % del tope (1 USD).") });
    expect(html).toContain("La pausó la auto-pausa por tope");
    expect(pintar({ ok: true, pausada: true, vigente: vigente(true) })).not.toContain("La pausó la auto-pausa por tope");
  });

  it("sin permiso no pinta nada; sin la 0541 lo dice y no ofrece ningún botón", () => {
    expect(pintar({ ok: false, motivo: "sin_permiso" })).toBe("");
    const html = pintar({ ok: false, motivo: "sin_migracion" });
    expect(html).toContain("migración 0541");
    expect(html).not.toContain("<form");
  });

  it("el motivo de la última pausa va como texto plano", () => {
    const html = pintar({ ok: true, pausada: true, vigente: vigente(true, '<img src=x onerror="alert(1)">') });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    const fuente = readFileSync(resolve(ROOT, "app/studio/(app)/admin/oficina-virtual/_components/TarjetaPausa.tsx"), "utf8");
    expect(fuente).not.toMatch(/dangerouslySetInnerHTML\s*=/);
  });
});
