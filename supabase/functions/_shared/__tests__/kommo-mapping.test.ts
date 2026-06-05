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
import { mapLeadRow, mapContactRow, epochToIso } from "../kommo-mapping";

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
    });
  });
});
