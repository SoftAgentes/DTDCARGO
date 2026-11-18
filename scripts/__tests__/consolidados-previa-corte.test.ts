// @vitest-environment node
/**
 * SDD-0543 F2 · El corte de la previa de producción, corrido de verdad en PostgreSQL embebido.
 *
 * `previa.sql` de un lote `--entorno produccion` termina con un bloque `do $corte$` que aborta si
 * alguna marca no resuelve a un cliente vivo: en producción el lote nunca crea clientes ni aliados.
 * Acá el bloque, el MISMO texto que genera `generarSql`, corre en PGlite sobre un esquema mínimo
 * (tenants, clients y un `resolve_markbox` que busca por markbox, sin historial ni fusiones: el
 * real es de la migración 0367 y lo cubre `schema-rebuild`). Tres casos: sin cliente corta,
 * cliente borrado corta, cliente vivo pasa.
 */
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import { agruparLote, type Rastreo } from "../consolidados/modelo";
import { generarSql, type OpcionesSql } from "../consolidados/lote-sql";

const R61: Rastreo = {
  numero: 61,
  etiqueta: "MG-019#61",
  modalidad: "FCL",
  puertoCarga: "YIWU",
  fechaCarga: "2026-09-08",
  contenedor: "MRSU9497682",
  precinto: null,
  naviera: "MSK",
  puertoLlegada: "Barranquilla",
  etaExcel: null,
  link: null,
  filaExcel: 1,
};

const PROD: OpcionesSql = {
  entorno: "produccion",
  crearClientesFaltantes: false,
  facturas: true,
  pol: "NGB",
  polNombre: "Ningbo",
  containerType: "40HC",
  vessel: "Por confirmar",
  lote: "carga-consolidado:61:cafebabe",
  tenantSlug: "dtd",
};

const TENANT = "00000000-0000-0000-0000-000000000001";
const CLIENTE = "00000000-0000-0000-0000-0000000000a1";
const ESQUEMA = `
create table public.tenants (id uuid primary key, slug text);
create table public.clients (id uuid primary key, tenant_id uuid, markbox text, deleted_at timestamptz);
create function public.resolve_markbox(p uuid, m text)
returns table(client_id uuid, canonical_markbox text, was_redirected boolean) language sql stable as
$$ select c.id, c.markbox, false from public.clients c where c.tenant_id = p and upper(c.markbox) = upper(m) limit 1 $$;
insert into public.tenants values ('${TENANT}', 'dtd');`;

function bloqueCorte(): string {
  const l = agruparLote(R61, [], { eta: "2026-10-25", modalidad: "fcl", dueno: "MG-019" });
  const previa = generarSql(l, PROD, { rastreo: "a".repeat(64), packing: "" }).previa;
  const i = previa.indexOf("do $corte$");
  expect(i).toBeGreaterThan(0);
  return previa.slice(i, previa.indexOf("$corte$;", i) + "$corte$;".length);
}

let db: PGlite | null = null;
afterEach(async () => {
  await db?.close();
  db = null;
});

async function correr(semilla: string): Promise<void> {
  db = new PGlite();
  await db.exec(ESQUEMA + semilla);
  await db.exec(bloqueCorte());
}

// PGlite arranca un Postgres entero en WASM: bajo carga tarda más que el tope de 5 s por prueba.
describe("SDD-0543 F2 · corte de la previa de producción (PGlite)", { timeout: 60_000 }, () => {
  it("sin cliente con esa marca: corta con el conteo y la etiqueta", async () => {
    await expect(correr("")).rejects.toThrow(
      "previa: 1 marca(s) sin resolver a un cliente vivo en producción (MG-0019)",
    );
  });

  it("cliente borrado: también corta", async () => {
    await expect(correr(`insert into public.clients values ('${CLIENTE}', '${TENANT}', 'MG-019', now());`)).rejects.toThrow(
      /previa: 1 marca\(s\) sin resolver/,
    );
  });

  it("cliente vivo (por el segundo candidato): pasa", async () => {
    await expect(correr(`insert into public.clients values ('${CLIENTE}', '${TENANT}', 'MG-019', null);`)).resolves.toBeUndefined();
  });
});
