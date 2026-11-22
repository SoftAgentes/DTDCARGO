// @vitest-environment node
/**
 * SDD-0646 (D-1, opción C) · La dirección interna, la pregunta «¿está sin
 * comprobar?», el paso de la cuenta a su dirección interna, la emisión del
 * enlace y el inventario de los caminos que acuñan un enlace de entrada.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const avisos: Array<{ tenantId: string; email: string; markbox: string; url: string }> = [];
let avisoOk = true;
vi.mock("@/lib/studio/registro-link-aviso-email", () => ({
  sendRegistroLinkAvisoEmail: async (
    _a: unknown,
    tenantId: string,
    input: { email: string; markbox: string; url: string },
  ) => {
    avisos.push({ tenantId, ...input });
    return avisoOk ? { ok: true } : { ok: false, error: "resend caído" };
  },
}));

import {
  CORREO_INTERNO_DOMINIO,
  comprobarCorreoUrl,
  esCorreoInterno,
  esDominioInterno,
} from "@/lib/portal/correo-comprobacion";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { loadAccessTarget } from "../access-link";
import {
  correoSinComprobar,
  direccionInternaDelCliente,
  emitirYEnviarComprobacion,
  nuevoCorreoInterno,
  pasarCuentaADireccionInterna,
} from "../correo-comprobacion";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

beforeEach(() => {
  avisos.length = 0;
  avisoOk = true;
});

describe("dirección interna", () => {
  it("⭐ 128 bits aleatorios en un dominio reservado que no recibe correo", () => {
    const a = nuevoCorreoInterno();
    const b = nuevoCorreoInterno();
    expect(a).toMatch(/^c-[0-9a-f]{32}@sin-comprobar\.invalid$/);
    expect(a).not.toBe(b);
    expect(CORREO_INTERNO_DOMINIO.endsWith(".invalid")).toBe(true);
    expect(esCorreoInterno(a)).toBe(true);
    expect(esDominioInterno(a.toUpperCase())).toBe(true);
  });

  it("un correo de verdad no es interno", () => {
    expect(esCorreoInterno("ana@example.test")).toBe(false);
    expect(esDominioInterno("ana@sin-comprobar.invalid.example.test")).toBe(false);
    expect(esDominioInterno(null)).toBe(false);
  });

  it("⭐ la app y la migración 0559 validan la MISMA forma", () => {
    const sql = readFileSync(
      resolve(ROOT, "supabase/migrations/0559_registro_link_correo_comprobado.sql"),
      "utf8",
    );
    // La forma exacta (check de la tabla y vínculo) y el dominio (la pregunta).
    expect(sql).toContain("'^c-[0-9a-f]{32}@sin-comprobar\\.invalid$'");
    expect(sql).toContain("'@sin-comprobar\\.invalid$'");
    expect(sql).toContain("|| '@sin-comprobar.invalid'");
    expect(`@${CORREO_INTERNO_DOMINIO}`).toBe("@sin-comprobar.invalid");
  });

  it("⭐ ningún envío toma la dirección interna como destinatario", async () => {
    // Un admin sin nada: si `sendEmail` siguiera de largo, reventaría al leer la config.
    const res = await sendEmail({} as never, "t-1", {
      to: `  C-${"a".repeat(32)}@Sin-Comprobar.invalid `,
      subject: "x",
      html: "<p>x</p>",
    });
    expect(res).toEqual({ ok: false, error: "destinatario sin correo comprobado" });
  });
});

describe("correoSinComprobar", () => {
  const admin = (resp: unknown) => {
    const rpc = vi.fn(async () => resp);
    return { admin: { rpc } as never, rpc };
  };

  it("devuelve lo que dice la base, con el correo normalizado", async () => {
    const { admin: a, rpc } = admin({ data: [{ bloquea: true, pendiente: false }], error: null });
    await expect(correoSinComprobar(a, "  Ana@Example.test ")).resolves.toEqual({
      estado: "ok",
      bloquea: true,
      pendiente: false,
    });
    expect(rpc).toHaveBeenCalledWith("portal_email_sin_comprobar", { p_email: "ana@example.test" });
  });

  it("⭐ la dirección interna se bloquea sin preguntar", async () => {
    const { admin: a, rpc } = admin({ data: [{ bloquea: false, pendiente: false }], error: null });
    const r = await correoSinComprobar(a, nuevoCorreoInterno());
    expect(r).toEqual({ estado: "ok", bloquea: true, pendiente: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(["PGRST202", "42883"])("sin la migración (%s) lo dice aparte", async (code) => {
    const { admin: a } = admin({ data: null, error: { code, message: "no existe" } });
    await expect(correoSinComprobar(a, "ana@example.test")).resolves.toEqual({ estado: "sin-migracion" });
  });

  it("⭐ cualquier otro fallo es `error` (los que llaman no mandan el enlace)", async () => {
    const { admin: a } = admin({ data: null, error: { code: "XX000", message: "boom" } });
    await expect(correoSinComprobar(a, "ana@example.test")).resolves.toEqual({ estado: "error" });
    const { admin: vacio } = admin({ data: [], error: null });
    await expect(correoSinComprobar(vacio, "ana@example.test")).resolves.toEqual({ estado: "error" });
    await expect(correoSinComprobar({} as never, "ana@example.test")).resolves.toEqual({ estado: "error" });
  });
});

describe("pasarCuentaADireccionInterna", () => {
  function make(authError: unknown = null, rpcError: unknown = null) {
    const pasos: Array<[string, unknown]> = [];
    const admin = {
      auth: {
        admin: {
          updateUserById: async (id: string, attrs: unknown) => {
            pasos.push(["auth", { id, attrs }]);
            return { data: null, error: authError };
          },
        },
      },
      rpc: async (name: string, args: unknown) => {
        pasos.push([name, args]);
        return { data: null, error: rpcError };
      },
    } as never;
    return { admin, pasos };
  }
  const input = { checkId: "chk-1", authUserId: "auth-1", internalEmail: `c-${"b".repeat(32)}@sin-comprobar.invalid` };

  it("cambia la cuenta y después lo anota en la base", async () => {
    const { admin, pasos } = make();
    await expect(pasarCuentaADireccionInterna(admin, input)).resolves.toEqual({ ok: true });
    expect(pasos).toEqual([
      ["auth", { id: "auth-1", attrs: { email: input.internalEmail, email_confirm: true } }],
      ["portal_email_check_auth_interno", { p_check_id: "chk-1" }],
    ]);
  });

  it("⭐ si Auth no la cambia, la base no anota nada", async () => {
    const { admin, pasos } = make({ message: "boom" });
    const r = await pasarCuentaADireccionInterna(admin, input);
    expect(r.ok).toBe(false);
    expect(pasos.map(([n]) => n)).toEqual(["auth"]);
  });
});

describe("emitirYEnviarComprobacion", () => {
  function make(issue: unknown) {
    const llamadas: Array<[string, Record<string, unknown>]> = [];
    const admin = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        llamadas.push([name, args]);
        return issue;
      },
    } as never;
    return { admin, llamadas };
  }
  const fila = { data: [{ tenant_id: "t-1", markbox: "DTD-8001", pending_email: "ana@example.test" }], error: null };

  it("⭐ a la base va el hash; el token sólo viaja en el enlace, al correo por comprobar", async () => {
    const { admin, llamadas } = make(fila);
    await expect(emitirYEnviarComprobacion(admin, "chk-1")).resolves.toEqual({ ok: true });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].email).toBe("ana@example.test");
    expect(avisos[0].markbox).toBe("DTD-8001");
    const token = avisos[0].url.split("/registro/correo/")[1];
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(avisos[0].url).toBe(comprobarCorreoUrl(token));
    expect(llamadas).toEqual([
      [
        "portal_email_check_issue",
        { p_check_id: "chk-1", p_token_hash: createHash("sha256").update(token).digest("hex") },
      ],
    ]);
  });

  it("dos emisiones no repiten token", async () => {
    const { admin } = make(fila);
    await emitirYEnviarComprobacion(admin, "chk-1");
    await emitirYEnviarComprobacion(admin, "chk-1");
    expect(avisos[0].url).not.toBe(avisos[1].url);
  });

  it("si la base no emite, no sale ningún correo", async () => {
    const { admin } = make({ data: null, error: { message: "ya_comprobado" } });
    const r = await emitirYEnviarComprobacion(admin, "chk-1");
    expect(r.ok).toBe(false);
    expect(avisos).toHaveLength(0);
  });

  it("si el correo no sale, lo dice", async () => {
    avisoOk = false;
    const { admin } = make(fila);
    const r = await emitirYEnviarComprobacion(admin, "chk-1");
    expect(r.ok).toBe(false);
  });
});

describe("acceso por WhatsApp de una cuenta sin comprobar (SDD-0253)", () => {
  type Acceso = { auth_user_id: string | null };
  function make(
    check: { auth_user_id: string } | null,
    checkError: unknown = null,
    cuenta: { email: string | null; error?: unknown } = { email: null },
    accesos: { data: Acceso[] | null; error?: unknown } = { data: [{ auth_user_id: "auth-1" }] },
  ) {
    const filtros: Array<[string, string, unknown]> = [];
    const leidas: string[] = [];
    const admin = {
      auth: {
        admin: {
          getUserById: async (id: string) => {
            leidas.push(id);
            return { data: { user: cuenta.email ? { email: cuenta.email } : null }, error: cuenta.error ?? null };
          },
        },
      },
      from(table: string) {
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: (c: string, v: unknown) => {
            filtros.push([table, `eq:${c}`, v]);
            return chain;
          },
          is: (c: string, v: unknown) => {
            filtros.push([table, `is:${c}`, v]);
            return chain;
          },
          maybeSingle: async () =>
            table === "clients"
              ? { data: { name: "Ana", email: "ana@example.test" }, error: null }
              : { data: check, error: checkError },
          then: (ok: (v: unknown) => unknown) =>
            ok(table === "client_users" ? { data: accesos.data, error: accesos.error ?? null } : { data: null, error: null }),
        };
        return chain;
      },
    } as never;
    return { admin, filtros, leidas };
  }
  const FICHA = { name: "Ana", email: "ana@example.test" };

  it("⭐ la entrada se acuña para la dirección que lleva la cuenta, no para el correo de la ficha", async () => {
    const interna = `c-${"c".repeat(32)}@sin-comprobar.invalid`;
    const { admin, filtros, leidas } = make({ auth_user_id: "auth-1" }, null, { email: interna.toUpperCase() });
    await expect(loadAccessTarget(admin, "c-1")).resolves.toEqual({ name: "Ana", email: interna });
    // Sólo cuentas por link sin comprobar; la dirección se le pregunta a Auth.
    expect(filtros).toContainEqual(["client_email_checks", "is:verified_at", null]);
    expect(filtros).toContainEqual(["client_email_checks", "eq:client_id", "c-1"]);
    // Y sólo si esa cuenta sigue siendo el acceso activo del cliente.
    expect(filtros).toContainEqual(["client_users", "eq:client_id", "c-1"]);
    expect(filtros).toContainEqual(["client_users", "eq:status", "active"]);
    expect(leidas).toEqual(["auth-1"]);
  });

  it("⭐ no supone qué lleva la cuenta: si el paso quedó a medias, usa lo que diga Auth", async () => {
    const { admin } = make({ auth_user_id: "auth-1" }, null, { email: "otra@example.test" });
    await expect(loadAccessTarget(admin, "c-1")).resolves.toEqual({ name: "Ana", email: "otra@example.test" });
  });

  it("⭐ si Auth no responde, falla cerrado: no hay entrada (ni cae al correo de la ficha)", async () => {
    const { admin } = make({ auth_user_id: "auth-1" }, null, { email: null, error: { message: "boom" } });
    await expect(loadAccessTarget(admin, "c-1")).resolves.toBeNull();
  });

  it("⭐ si Auth no devuelve la cuenta, también falla cerrado", async () => {
    const { admin } = make({ auth_user_id: "auth-1" }, null, { email: null });
    await expect(loadAccessTarget(admin, "c-1")).resolves.toBeNull();
  });

  it("⭐ un error al leer la comprobación que no es «la tabla no existe» falla cerrado", async () => {
    for (const code of ["57014", "PGRST301", "08006", undefined]) {
      const { admin, leidas } = make(null, { code, message: "boom" });
      await expect(loadAccessTarget(admin, "c-1")).resolves.toBeNull();
      expect(leidas).toEqual([]);
    }
  });

  it("⭐ si no se pueden leer los accesos del cliente, falla cerrado", async () => {
    const { admin, leidas } = make({ auth_user_id: "auth-1" }, null, { email: "x@example.test" }, {
      data: null,
      error: { code: "57014" },
    });
    await expect(loadAccessTarget(admin, "c-1")).resolves.toBeNull();
    expect(leidas).toEqual([]);
  });

  it("⭐ revocado y reinvitado por correo: la cuenta vieja del link no recibe la entrada", async () => {
    const { admin, leidas } = make({ auth_user_id: "auth-1" }, null, { email: "vieja@example.test" }, {
      data: [{ auth_user_id: "auth-2" }],
    });
    await expect(loadAccessTarget(admin, "c-1")).resolves.toEqual(FICHA);
    expect(leidas).toEqual([]);
  });

  it("⭐ reinvitado, sin aceptar: la invitación sigue pendiente (ningún acceso activo) y falla cerrado", async () => {
    // La fila nueva de la invitación está en `invited`: la consulta sólo trae los accesos activos.
    const { admin, filtros, leidas } = make({ auth_user_id: "auth-1" }, null, { email: "vieja@example.test" }, {
      data: [],
    });
    await expect(loadAccessTarget(admin, "c-1")).resolves.toBeNull();
    expect(filtros).toContainEqual(["client_users", "eq:status", "active"]);
    expect(leidas).toEqual([]);
  });

  it("⭐ revocado y sin ningún acceso activo: falla cerrado (no crea una cuenta con el correo sin comprobar)", async () => {
    const { admin } = make({ auth_user_id: "auth-1" }, null, { email: "vieja@example.test" }, { data: [] });
    await expect(loadAccessTarget(admin, "c-1")).resolves.toBeNull();
  });

  it("un cliente de otro camino (o sin la migración) entra con su correo de siempre", async () => {
    await expect(loadAccessTarget(make(null).admin, "c-1")).resolves.toEqual(FICHA);
    await expect(loadAccessTarget(make(null, { code: "42P01" }).admin, "c-1")).resolves.toEqual(FICHA);
    await expect(loadAccessTarget(make(null, { code: "PGRST205" }).admin, "c-1")).resolves.toEqual(FICHA);
  });

  it("si algo explota, falla cerrado", async () => {
    await expect(direccionInternaDelCliente({} as never, "c-1")).resolves.toEqual({ estado: "error" });
  });
});

describe("⭐ inventario: quién acuña un enlace que abre el portal", () => {
  /**
   * Si aparece un archivo nuevo que acuña o manda un enlace de entrada, esta
   * prueba falla. Antes de agregarlo a la lista hay que decidir cómo respeta la
   * regla de D-1: un correo sin comprobar no recibe un enlace de entrada.
   */
  const PERMITIDOS: Record<string, string> = {
    // Define `generatePortalAccessLink`; el correo de invitación pregunta
    // `correoSinComprobar` antes de acuñar.
    "lib/studio/portal-invite-email.ts": "define; la invitación pregunta antes de acuñar",
    // Define `mintPortalMagicToken`; sólo lo llama `/entrar`.
    "lib/studio/portal/magic-link.ts": "define",
    // `/entrar`: pregunta `correoSinComprobar` antes de acuñar o de caer a Auth.
    "app/entrar/actions.ts": "pregunta antes de acuñar",
    // Acceso por WhatsApp (SDD-0253): no manda correo; es la recuperación de las
    // cuentas sin comprobar y acuña para la cuenta vinculada.
    "app/entrar/[code]/actions.ts": "no manda correo; redirige en el POST",
    // Registro por link: acuña para la dirección interna y lo entrega en la página.
    "app/registro/link/[token]/actions.ts": "dirección interna; se entrega en la página",
    // Autoservicio (SDD-0672): con el correo al que salió el enlace, abrirlo ya
    // probó ese correo (la base lo exige en `bind_self`); con otro correo, la
    // dirección interna como en el registro por link. Se entrega en la página.
    "app/registro/activar/[token]/actions.ts": "correo probado o dirección interna; se entrega en la página",
  };

  function archivos(dir: string, out: string[] = []): string[] {
    for (const nombre of readdirSync(dir)) {
      if (nombre === "node_modules" || nombre === "__tests__" || nombre.startsWith(".")) continue;
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) archivos(ruta, out);
      else if (/\.(ts|tsx)$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)) out.push(ruta);
    }
    return out;
  }

  it("sólo los caminos conocidos acuñan o piden un enlace de entrada", () => {
    const patron =
      /generatePortalAccessLink\s*\(|mintPortalMagicToken\s*\(|\.generateLink\s*\(|signInWithOtp\s*\(|resetPasswordForEmail\s*\(|inviteUserByEmail\s*\(/;
    const encontrados = [...archivos(resolve(ROOT, "app")), ...archivos(resolve(ROOT, "lib"))]
      .filter((f) => patron.test(readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")))
      .map((f) => relative(ROOT, f).replace(/\\/g, "/"))
      .sort();
    expect(encontrados).toEqual(Object.keys(PERMITIDOS).sort());
  });

  it("⭐ /entrar no llega a Auth por ningún camino sin haber preguntado antes", () => {
    const src = readFileSync(resolve(ROOT, "app/entrar/actions.ts"), "utf8");
    const cuerpo = src.slice(src.indexOf("export async function requestMagicLink("));
    const pregunta = cuerpo.indexOf("await correoSinComprobar(");
    expect(pregunta).toBeGreaterThan(-1);
    // Todas las caídas al camino de Auth (`signInWithOtp`) y todo acuñado van después.
    const usos = [...cuerpo.matchAll(/sendMagicLinkLegacy\(|signInWithOtp\(|mintPortalMagicToken\(/g)].map(
      (m) => m.index ?? -1,
    );
    expect(usos.length).toBeGreaterThan(0);
    for (const i of usos) expect(i, "llega a Auth antes de preguntar").toBeGreaterThan(pregunta);
    // Y `signInWithOtp` sólo vive dentro del camino viejo, que sólo se llama desde ahí.
    expect([...src.matchAll(/signInWithOtp\(/g)]).toHaveLength(1);
    expect(src.indexOf("signInWithOtp(")).toBeLessThan(src.indexOf("export async function requestMagicLink("));
    expect(src.indexOf("signInWithOtp(")).toBeGreaterThan(src.indexOf("async function sendMagicLinkLegacy("));
  });

  it("los dos que mandan el enlace por correo preguntan antes si está sin comprobar", () => {
    for (const f of ["lib/studio/portal-invite-email.ts", "app/entrar/actions.ts"]) {
      const src = readFileSync(resolve(ROOT, f), "utf8");
      const pregunta = src.indexOf("await correoSinComprobar(");
      expect(pregunta, `${f} no pregunta`).toBeGreaterThan(-1);
      const acuna = Math.min(
        ...["await generatePortalAccessLink(", "await mintPortalMagicToken("]
          .map((s) => src.indexOf(s))
          .filter((i) => i > -1),
      );
      expect(pregunta, `${f} acuña antes de preguntar`).toBeLessThan(acuna);
    }
  });
});
