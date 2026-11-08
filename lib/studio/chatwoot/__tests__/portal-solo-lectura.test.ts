// @vitest-environment node
/**
 * SDD-0586 (10.5, 1c-1) · la traba de los hilos del portal: cuándo está puesta.
 *
 * El doble de la base registra los filtros de la lectura del flag: uno que no filtra daría verde
 * aunque el código no mirara el tenant ni la clave.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { MENSAJE_NO_SE_SABE, MENSAJE_SOLO_LECTURA, rechazoPortal, trabaPortal } from "../portal-solo-lectura";

const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";

function base(fila: { enabled: boolean } | null | "error") {
  const filtros: [string, unknown][] = [];
  const tablas: string[] = [];
  const supabase = {
    from(tabla: string) {
      tablas.push(tabla);
      const q = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          filtros.push([col, val]);
          return q;
        },
        maybeSingle: async () => (fila === "error" ? { data: null, error: { code: "XX000" } } : { data: fila, error: null }),
      };
      return q;
    },
  };
  return { supabase: supabase as unknown as Parameters<typeof trabaPortal>[0], filtros, tablas };
}

const configurar = (tenant = T1) => {
  vi.stubEnv("CHATWOOT_ROUTER_TOKEN", "tok-router-sintetico");
  vi.stubEnv("CHATWOOT_ACCOUNT_ID", "1");
  vi.stubEnv("CHATWOOT_INBOX_PORTAL_ID", "9");
  vi.stubEnv("CHATWOOT_TENANT_ID", tenant);
};

afterEach(() => vi.unstubAllEnvs());

describe("trabaPortal", () => {
  it("encendida con el flag del tenant y la bandeja configurada", async () => {
    configurar();
    const b = base({ enabled: true });
    expect(await trabaPortal(b.supabase, T1)).toBe("activa");
    expect(b.tablas).toEqual(["feature_flags"]);
    expect(b.filtros).toEqual([["tenant_id", T1], ["key", "chatwoot_portal"]]);
  });

  it("apagada con el flag apagado o sin su fila", async () => {
    configurar();
    expect(await trabaPortal(base({ enabled: false }).supabase, T1)).toBe("apagada");
    expect(await trabaPortal(base(null).supabase, T1)).toBe("apagada");
  });

  it("si la lectura falla, no se sabe (y la acción traba)", async () => {
    configurar();
    expect(await trabaPortal(base("error").supabase, T1)).toBe("no_se_sabe");
  });

  // SDD-0586 1c-2 (decisión del DG, opción b): solo el flag decide, aunque falte la configuración.
  it("sin la bandeja del portal configurada, el flag decide igual (fail-closed)", async () => {
    for (const falta of ["CHATWOOT_INBOX_PORTAL_ID", "CHATWOOT_ROUTER_TOKEN", "CHATWOOT_ACCOUNT_ID", "CHATWOOT_TENANT_ID"]) {
      configurar();
      vi.stubEnv(falta, "");
      const b = base({ enabled: true });
      expect(await trabaPortal(b.supabase, T1), falta).toBe("activa");
      expect(b.filtros, falta).toEqual([["tenant_id", T1], ["key", "chatwoot_portal"]]);
      expect(await trabaPortal(base({ enabled: false }).supabase, T1), falta).toBe("apagada");
    }
  });

  it("con la configuración de otro tenant, decide el flag del tenant de la sesión", async () => {
    configurar(T2);
    const b = base({ enabled: true });
    expect(await trabaPortal(b.supabase, T1)).toBe("activa");
    expect(b.filtros).toEqual([["tenant_id", T1], ["key", "chatwoot_portal"]]);
  });

  it("con la configuración pero sin saber el tenant de la sesión, no se sabe", async () => {
    configurar();
    expect(await trabaPortal(base({ enabled: true }).supabase, null)).toBe("no_se_sabe");
  });
});

describe("rechazoPortal", () => {
  it("un hilo del portal con la traba activa: el mensaje de la Bandeja", async () => {
    configurar();
    expect(await rechazoPortal(base({ enabled: true }).supabase, T1, "portal")).toBe(MENSAJE_SOLO_LECTURA);
  });

  it("un hilo del portal sin poder leer el flag: el mensaje de «no se pudo comprobar»", async () => {
    configurar();
    expect(await rechazoPortal(base("error").supabase, T1, "portal")).toBe(MENSAJE_NO_SE_SABE);
  });

  it("un hilo del portal con la traba apagada: sigue", async () => {
    configurar();
    expect(await rechazoPortal(base({ enabled: false }).supabase, T1, "portal")).toBeNull();
  });

  it("otro canal sigue siempre, sin leer el flag", async () => {
    configurar();
    for (const canal of ["email", "whatsapp", null, undefined]) {
      const b = base("error");
      expect(await rechazoPortal(b.supabase, T1, canal)).toBeNull();
      expect(b.tablas).toEqual([]);
    }
  });

  it("los dos mensajes nombran la Bandeja de Chatwoot", () => {
    expect(MENSAJE_SOLO_LECTURA).toMatch(/Bandeja de Chatwoot/);
    expect(MENSAJE_NO_SE_SABE).toMatch(/No se pudo comprobar.*Bandeja de Chatwoot/);
  });
});
