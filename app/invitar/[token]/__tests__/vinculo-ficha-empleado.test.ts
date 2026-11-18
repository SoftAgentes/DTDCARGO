// @vitest-environment node
/**
 * SDD-0600 · aceptar una invitación enlaza el login con la ficha de empleado SOLO si el
 * correo es exactamente el de la invitación.
 *
 * `app/m/emp` muestra lo que corresponde a `nomina_employees.auth_user_id`: un enlace a
 * la ficha equivocada le abre a una persona el recibo de pago de otra. El doble aplica
 * los comodines de verdad, porque comparando exacto no podría verlo.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { coincideIlike } from "@/lib/shared/__tests__/coincide-ilike";

type Ficha = {
  id: string;
  tenant_id: string;
  email: string | null;
  auth_user_id: string | null;
  deleted_at: string | null;
};

const mocks = vi.hoisted(() => ({
  correoInvitado: "ana_diaz@empresa.test",
  fichas: [] as Ficha[],
  fallaLectura: false,
  /** Lo que se le pidió a la base con `.ilike`. */
  patrones: [] as string[],
}));

/** Tabla en memoria que aplica los filtros, tanto al leer como al actualizar. */
function fichasConsulta(cambios: Partial<Ficha> | null) {
  const filtros: Array<(f: Ficha) => boolean> = [];
  const chain = {
    select: () => chain,
    eq: (col: keyof Ficha, valor: unknown) => {
      filtros.push((f) => f[col] === valor);
      return chain;
    },
    is: (col: keyof Ficha, valor: unknown) => {
      filtros.push((f) => f[col] === valor);
      return chain;
    },
    ilike: (col: keyof Ficha, patron: string) => {
      mocks.patrones.push(patron);
      filtros.push((f) => coincideIlike(String(f[col] ?? ""), patron));
      return chain;
    },
    in: (col: keyof Ficha, valores: unknown[]) => {
      filtros.push((f) => valores.includes(f[col]));
      return chain;
    },
    then: (resolver: (valor: unknown) => unknown) => {
      if (mocks.fallaLectura && !cambios) {
        return Promise.resolve({ data: null, error: { message: "boom" } }).then(resolver);
      }
      const filas = mocks.fichas.filter((f) => filtros.every((pasa) => pasa(f)));
      if (cambios) for (const f of filas) Object.assign(f, cambios);
      return Promise.resolve({ data: filas, error: null }).then(resolver);
    },
  };
  return chain;
}

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        createUser: async () => ({ data: { user: { id: "usuario-nuevo" } }, error: null }),
      },
    },
    from(tabla: string) {
      if (tabla === "user_invitations") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: async () => ({
            data: {
              id: "inv-1",
              email: mocks.correoInvitado,
              role: "operator",
              accepted_at: null,
              revoked_at: null,
              expires_at: new Date(Date.now() + 86_400_000).toISOString(),
              invited_by: "admin-1",
              tenant_id: "tenant-1",
            },
          }),
        };
        return chain;
      }
      if (tabla === "nomina_employees") {
        return {
          select: () => fichasConsulta(null),
          update: (cambios: Partial<Ficha>) => fichasConsulta(cambios),
        };
      }
      throw new Error(`tabla sin doble: ${tabla}`);
    },
  }),
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { signInWithPassword: async () => ({ error: null }) },
    rpc: async () => ({ error: null }),
  }),
}));

import { acceptInvitationFormAction } from "../actions";

function formulario() {
  const data = new FormData();
  data.set("token", "token-de-prueba-suficientemente-largo");
  data.set("password", "clave-de-prueba-larga");
  return data;
}

function ficha(id: string, email: string | null, extra: Partial<Ficha> = {}): Ficha {
  return { id, tenant_id: "tenant-1", email, auth_user_id: null, deleted_at: null, ...extra };
}

const enlazadas = () => mocks.fichas.filter((f) => f.auth_user_id === "usuario-nuevo").map((f) => f.id);

beforeEach(() => {
  mocks.correoInvitado = "ana_diaz@empresa.test";
  mocks.fichas = [];
  mocks.fallaLectura = false;
  mocks.patrones = [];
});

describe("/invitar · el enlace con la ficha de empleado", () => {
  it.each(["ana.diaz@empresa.test", "ana-diaz@empresa.test", "anaxdiaz@empresa.test"])(
    "invitada ana_diaz NO queda enlazada a la ficha de %s",
    async (correoDeLaFicha) => {
      mocks.fichas = [ficha("parecida", correoDeLaFicha)];

      await expect(acceptInvitationFormAction({}, formulario())).resolves.toEqual({
        ok: true,
        userId: "usuario-nuevo",
      });

      expect(enlazadas()).toEqual([]);
    },
  );

  it.each(["%@empresa.test", "*@empresa.test", "ana*@empresa.test", "ana%@empresa.test"])(
    "un correo invitado %s no alcanza ninguna ficha",
    async (correo) => {
      mocks.correoInvitado = correo;
      mocks.fichas = [ficha("otra", "ana.diaz@empresa.test")];

      await acceptInvitationFormAction({}, formulario());

      expect(enlazadas()).toEqual([]);
    },
  );

  it.each([
    ["ana_diaz@empresa.test", "ana_diaz@empresa.test"],
    ["Ana_Diaz@Empresa.TEST", "ana_diaz@empresa.test"],
    ["ana+dtd@empresa.test", "ana+dtd@empresa.test"],
    ["a*b@empresa.test", "a*b@empresa.test"],
  ])("la ficha %s sí queda enlazada a la invitada %s", async (correoDeLaFicha, invitada) => {
    mocks.correoInvitado = invitada;
    mocks.fichas = [ficha("real", correoDeLaFicha)];

    await acceptInvitationFormAction({}, formulario());

    expect(enlazadas()).toEqual(["real"]);
  });

  it("entre un parecido y la exacta, enlaza solo la exacta", async () => {
    mocks.fichas = [ficha("parecida", "ana.diaz@empresa.test"), ficha("real", "ana_diaz@empresa.test")];

    await acceptInvitationFormAction({}, formulario());

    expect(enlazadas()).toEqual(["real"]);
    expect(mocks.fichas[0].auth_user_id).toBeNull();
    // Sin comodines en la consulta: no trae filas que después hay que descartar.
    expect(mocks.patrones).toEqual(["ana\\_diaz@empresa.test"]);
  });

  it("no pisa una ficha ya enlazada, ni toca otro tenant, ni una ficha borrada", async () => {
    mocks.fichas = [
      ficha("con-login", "ana_diaz@empresa.test", { auth_user_id: "otro-usuario" }),
      ficha("otro-tenant", "ana_diaz@empresa.test", { tenant_id: "tenant-2" }),
      ficha("borrada", "ana_diaz@empresa.test", { deleted_at: "2026-10-01T00:00:00Z" }),
    ];

    await acceptInvitationFormAction({}, formulario());

    expect(enlazadas()).toEqual([]);
    expect(mocks.fichas[0].auth_user_id).toBe("otro-usuario");
  });

  it("si la búsqueda de la ficha falla, la cuenta queda igual: el enlace es una conveniencia", async () => {
    mocks.fallaLectura = true;
    mocks.fichas = [ficha("real", "ana_diaz@empresa.test")];

    await expect(acceptInvitationFormAction({}, formulario())).resolves.toEqual({
      ok: true,
      userId: "usuario-nuevo",
    });

    expect(enlazadas()).toEqual([]);
  });
});
