// @vitest-environment node
/**
 * SDD-0600 · la baja de marketing le quita el permiso SOLO al correo del enlace.
 *
 * `.ilike` toma `_` como comodín: la baja de `juan_perez@x.test` también le quitaba el
 * permiso a `juan.perez@x.test`, que nunca la pidió. El enlace está firmado, así que nadie
 * lo provoca a propósito, pero `_` es común en un correo de verdad. El doble aplica los
 * comodines: comparando exacto no podría verlo.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { coincideIlike } from "@/lib/shared/__tests__/coincide-ilike";
import { signUnsubscribeToken } from "../unsubscribe-token";

const SECRET = "test-unsubscribe-secret";
const OPTIN = "2026-01-01T00:00:00Z";

type Cliente = {
  id: string;
  tenant_id: string;
  email: string | null;
  email_marketing_optin_at: string | null;
};

const mocks = vi.hoisted(() => ({
  clientes: [] as Cliente[],
  fallaLectura: false,
  fallaEscritura: false,
  /** Lo que se le pidió a la base con `.ilike`. */
  patrones: [] as string[],
}));

function consulta(cambios: Partial<Cliente> | null) {
  const filtros: Array<(c: Cliente) => boolean> = [];
  const chain = {
    select: () => chain,
    eq: (col: keyof Cliente, valor: unknown) => {
      filtros.push((c) => c[col] === valor);
      return chain;
    },
    ilike: (col: keyof Cliente, patron: string) => {
      mocks.patrones.push(patron);
      filtros.push((c) => coincideIlike(String(c[col] ?? ""), patron));
      return chain;
    },
    in: (col: keyof Cliente, valores: unknown[]) => {
      filtros.push((c) => valores.includes(c[col]));
      return chain;
    },
    then: (resolver: (valor: unknown) => unknown) => {
      if (cambios && mocks.fallaEscritura) {
        return Promise.resolve({ error: { message: "boom" } }).then(resolver);
      }
      if (!cambios && mocks.fallaLectura) {
        return Promise.resolve({ data: null, error: { message: "boom" } }).then(resolver);
      }
      const filas = mocks.clientes.filter((c) => filtros.every((pasa) => pasa(c)));
      if (cambios) for (const c of filas) Object.assign(c, cambios);
      return Promise.resolve({ data: filas, error: null }).then(resolver);
    },
  };
  return chain;
}

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from(tabla: string) {
      if (tabla !== "clients") throw new Error(`tabla sin doble: ${tabla}`);
      return {
        select: () => consulta(null),
        update: (cambios: Partial<Cliente>) => consulta(cambios),
      };
    },
  }),
}));

import { GET } from "@/app/api/email/unsubscribe/[token]/route";

function cliente(id: string, email: string | null, tenant_id = "tenant-1"): Cliente {
  return { id, tenant_id, email, email_marketing_optin_at: OPTIN };
}

async function darDeBaja(email: string) {
  const token = signUnsubscribeToken({ email, tenantId: "tenant-1", audience: "marketing" }, SECRET);
  const response = await GET(
    new NextRequest(`https://sitio.test/api/email/unsubscribe/${encodeURIComponent(token)}`),
    { params: Promise.resolve({ token }) },
  );
  return response.headers.get("location");
}

const dadosDeBaja = () =>
  mocks.clientes.filter((c) => c.email_marketing_optin_at === null).map((c) => c.id);

beforeEach(() => {
  process.env.EMAIL_UNSUBSCRIBE_SECRET = SECRET;
  mocks.clientes = [];
  mocks.fallaLectura = false;
  mocks.fallaEscritura = false;
  mocks.patrones = [];
});

describe("baja de marketing · el correo se compara literal", () => {
  it("la baja de juan_perez no le quita el permiso a juan.perez", async () => {
    mocks.clientes = [cliente("parecido", "juan.perez@x.test"), cliente("real", "juan_perez@x.test")];

    const destino = await darDeBaja("juan_perez@x.test");

    expect(destino).toBe("https://sitio.test/email/baja?estado=marketing");
    expect(dadosDeBaja()).toEqual(["real"]);
    // Sin comodines en la consulta: no trae filas que después hay que descartar.
    expect(mocks.patrones).toEqual(["juan\\_perez@x.test"]);
  });

  it("`*` no alcanza a nadie más: no se puede escapar, y por eso se compara", async () => {
    mocks.clientes = [cliente("parecido", "a%b@x.test"), cliente("real", "a*b@x.test")];

    await darDeBaja("a*b@x.test");

    expect(dadosDeBaja()).toEqual(["real"]);
  });

  it.each([
    ["juan+dtd@x.test", "juan+dtd@x.test"],
    ["Juan_Perez@X.test", "juan_perez@x.test"],
    ["a%b@x.test", "a%b@x.test"],
  ])("el cliente %s sí queda de baja con el enlace de %s", async (guardado, enlace) => {
    mocks.clientes = [cliente("real", guardado)];

    await darDeBaja(enlace);

    expect(dadosDeBaja()).toEqual(["real"]);
  });

  it("varias filas con el mismo correo quedan todas de baja, como antes", async () => {
    mocks.clientes = [cliente("uno", "ana@x.test"), cliente("dos", "ANA@x.test")];

    await darDeBaja("ana@x.test");

    expect(dadosDeBaja()).toEqual(["uno", "dos"]);
  });

  it("no toca el mismo correo en otro tenant", async () => {
    mocks.clientes = [cliente("real", "ana@x.test"), cliente("otro", "ana@x.test", "tenant-2")];

    await darDeBaja("ana@x.test");

    expect(dadosDeBaja()).toEqual(["real"]);
  });

  it("sin ninguna fila sigue confirmando la baja: el enlace no revela nada", async () => {
    await expect(darDeBaja("nadie@x.test")).resolves.toBe(
      "https://sitio.test/email/baja?estado=marketing",
    );
  });

  it("si no puede leer, avisa el error en vez de confirmar una baja que no hizo", async () => {
    mocks.fallaLectura = true;
    mocks.clientes = [cliente("real", "ana@x.test")];

    await expect(darDeBaja("ana@x.test")).resolves.toBe(
      "https://sitio.test/email/baja?estado=error",
    );
    expect(dadosDeBaja()).toEqual([]);
  });

  it("si no puede escribir, avisa el error", async () => {
    mocks.fallaEscritura = true;
    mocks.clientes = [cliente("real", "ana@x.test")];

    await expect(darDeBaja("ana@x.test")).resolves.toBe(
      "https://sitio.test/email/baja?estado=error",
    );
  });
});
