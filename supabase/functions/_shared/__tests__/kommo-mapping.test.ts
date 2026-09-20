// @vitest-environment node
/**
 * SDD-0043 Alcance B · tests del mapeo Kommo → fila espejo.
 *
 * Garantiza que la forma de fila es idéntica a la del sync read-only
 * (single source of truth) y que epochToIso convierte bien:
 *  - lead con todos los campos
 *  - lead sin campos opcionales (defaults a null / [])
 *  - contact con y sin campos
 *  - epoch (segundos) → ISO-8601 · falsy → null
 */

import { describe, it, expect } from "vitest";
import {
  mapLeadRow,
  mapContactRow,
  epochToIso,
  mapLeadContactLinks,
  parseContactFieldsShared,
} from "../kommo-mapping";
import { parseContactFields } from "@/lib/studio/kommo-convert";

const TENANT = "11111111-1111-1111-1111-111111111111";

describe("epochToIso", () => {
  it("convierte epoch en segundos a ISO-8601", () => {
    // 1700000000 s = 2023-11-14T22:13:20.000Z
    expect(epochToIso(1700000000)).toBe("2023-11-14T22:13:20.000Z");
  });

  it("null / undefined / 0 → null", () => {
    expect(epochToIso(null)).toBeNull();
    expect(epochToIso(undefined)).toBeNull();
    expect(epochToIso(0)).toBeNull();
  });
});

describe("mapLeadRow", () => {
  it("lead completo → fila con todos los campos y custom_fields crudos", () => {
    const cfv = [
      { field_id: 1, field_name: "唛头", values: [{ value: "DTD-1234" }] },
    ];
    const row = mapLeadRow(
      {
        id: 555,
        name: "Lead Demo",
        status_id: 142,
        pipeline_id: 99,
        price: 1200,
        responsible_user_id: 7,
        created_at: 1700000000,
        updated_at: 1700003600,
        closed_at: 1700007200,
        custom_fields_values: cfv,
      },
      TENANT,
    );
    expect(row).toEqual({
      tenant_id: TENANT,
      id: 555,
      name: "Lead Demo",
      status_id: 142,
      pipeline_id: 99,
      price: 1200,
      responsible_user_id: 7,
      kommo_created_at: "2023-11-14T22:13:20.000Z",
      kommo_updated_at: "2023-11-14T23:13:20.000Z",
      closed_at: "2023-11-15T00:13:20.000Z",
      custom_fields: cfv,
    });
  });

  it("lead minimal → opcionales a null y custom_fields a []", () => {
    const row = mapLeadRow({ id: 1 }, TENANT);
    expect(row).toEqual({
      tenant_id: TENANT,
      id: 1,
      name: null,
      status_id: null,
      pipeline_id: null,
      price: null,
      responsible_user_id: null,
      kommo_created_at: null,
      kommo_updated_at: null,
      closed_at: null,
      custom_fields: [],
    });
  });
});

describe("mapContactRow", () => {
  it("contact completo → fila con todos los campos", () => {
    const cfv = [{ field_id: 2, field_code: "PHONE", values: [{ value: "+58" }] }];
    const row = mapContactRow(
      {
        id: 900,
        name: "Contacto Demo",
        responsible_user_id: 3,
        created_at: 1700000000,
        updated_at: 1700003600,
        custom_fields_values: cfv,
      },
      TENANT,
    );
    expect(row).toEqual({
      tenant_id: TENANT,
      id: 900,
      name: "Contacto Demo",
      responsible_user_id: 3,
      kommo_created_at: "2023-11-14T22:13:20.000Z",
      kommo_updated_at: "2023-11-14T23:13:20.000Z",
      custom_fields: cfv,
      // Desnormalizados desde el jsonb (migración 0363). `phone_last10` NO va
      // acá: es columna GENERADA, la calcula Postgres y no puede driftear.
      phone: "+58",
      email: null,
    });
  });

  it("contact minimal → opcionales a null y custom_fields a []", () => {
    const row = mapContactRow({ id: 2 }, TENANT);
    expect(row).toEqual({
      tenant_id: TENANT,
      id: 2,
      name: null,
      responsible_user_id: null,
      kommo_created_at: null,
      kommo_updated_at: null,
      custom_fields: [],
      phone: null,
      email: null,
    });
  });
});

describe("parseContactFieldsShared ≡ parseContactFields", () => {
  // Existen dos copias porque las Edge Functions no importan de `lib/`. Este test
  // es lo único que impide que se separen en silencio — mismo patrón que la
  // equivalencia phoneKey ≡ phonesMatch de kommo-router.test.ts.
  const casos: unknown[] = [
    null,
    undefined,
    [],
    "no es un array",
    [{ field_code: "PHONE", values: [{ value: "+58 412 1668021" }] }],
    [{ field_code: "EMAIL", values: [{ value: "a@b.com" }] }],
    [
      { field_code: "PHONE", values: [{ value: "0412-1668021" }] },
      { field_code: "EMAIL", values: [{ value: "x@y.com" }] },
    ],
    // Gana el PRIMERO de cada código.
    [
      { field_code: "PHONE", values: [{ value: "111" }] },
      { field_code: "PHONE", values: [{ value: "222" }] },
    ],
    // Minúsculas: el código se normaliza a mayúsculas.
    [{ field_code: "phone", values: [{ value: "333" }] }],
    // Valor vacío se ignora, no gana el primer turno.
    [
      { field_code: "PHONE", values: [{ value: "" }] },
      { field_code: "PHONE", values: [{ value: "444" }] },
    ],
    // Formas rotas: no revientan.
    [{ field_code: "PHONE" }],
    [{ field_code: "PHONE", values: [] }],
    [null, 7, "x", { values: [{ value: "z" }] }],
    // Numérico → string.
    [{ field_code: "PHONE", values: [{ value: 584121668021 }] }],
  ];

  it.each(casos.map((c, i) => [i, c] as const))(
    "caso %i devuelve lo mismo en las dos copias",
    (_i, entrada) => {
      expect(parseContactFieldsShared(entrada)).toEqual(parseContactFields(entrada));
    },
  );
});

describe("mapLeadContactLinks", () => {
  it("saca los vínculos de _embedded.contacts respetando is_main", () => {
    expect(
      mapLeadContactLinks({
        _embedded: { contacts: [{ id: 10 }, { id: 11, is_main: true }] },
      }),
    ).toEqual([
      { id: 10, is_main: false },
      { id: 11, is_main: true },
    ]);
  });

  it("sin el embed → [] (el llamador decide si eso significa 'sin contactos')", () => {
    // Distinción que importa: si el fetch NO pidió `with=contacts`, el campo no
    // viene y borrar los vínculos existentes sería inventar que se perdieron.
    expect(mapLeadContactLinks({})).toEqual([]);
    expect(mapLeadContactLinks({ _embedded: {} })).toEqual([]);
    expect(mapLeadContactLinks({ _embedded: { contacts: null } })).toEqual([]);
  });

  it("descarta ids inválidos y deduplica", () => {
    expect(
      mapLeadContactLinks({
        _embedded: {
          contacts: [
            { id: 5 },
            { id: 5, is_main: true }, // duplicado: gana el primero
            { id: 0 },
            { id: -3 },
            { id: NaN },
          ] as { id: number; is_main?: boolean }[],
        },
      }),
    ).toEqual([{ id: 5, is_main: false }]);
  });
});
