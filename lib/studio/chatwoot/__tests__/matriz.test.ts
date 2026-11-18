/**
 * SDD-0585 · paso 2.7 · la matriz de permisos aprobada por Sam el 2026-10-30.
 * Pura: roles, destinos y los dos planes (roles y miembros).
 */
import { describe, expect, it } from "vitest";

import { configMatriz, destinosDe, planificarMiembros, planificarRoles, rolChatwootDe, type ConfigMatriz } from "../matriz";

const SERVICIO = 1;
const CFG: ConfigMatriz = { bandejaClientes: 10, bandejaLeads: 20, equipoClientes: 30, equipoLeads: 40 };
const SIN_LEADS: ConfigMatriz = { bandejaClientes: 10, bandejaLeads: null, equipoClientes: 30, equipoLeads: null };

describe("configMatriz", () => {
  it("lee los cuatro ids; vacío, cero o basura → null", () => {
    expect(
      configMatriz({
        CHATWOOT_INBOX_CLIENTES_ID: " 10 ",
        CHATWOOT_INBOX_LEADS_ID: "",
        CHATWOOT_TEAM_CLIENTES_ID: "0",
        CHATWOOT_TEAM_LEADS_ID: "4x",
      }),
    ).toEqual({ bandejaClientes: 10, bandejaLeads: null, equipoClientes: null, equipoLeads: null });
  });
});

describe("rolChatwootDe y destinosDe (la matriz)", () => {
  it("admin → administrator; todos los demás → agent", () => {
    expect(rolChatwootDe("admin")).toBe("administrator");
    for (const rol of ["commercial", "support", "operations", "accounting", "warehouse", "marketing"] as const) {
      expect(rolChatwootDe(rol)).toBe("agent");
    }
  });

  it("admin: todas las bandejas y equipos configurados", () => {
    expect(destinosDe("admin", CFG)).toEqual({ bandejas: [10, 20], equipos: [30, 40] });
    expect(destinosDe("admin", SIN_LEADS)).toEqual({ bandejas: [10], equipos: [30] });
  });

  it("comercial: Leads; atención: Clientes", () => {
    expect(destinosDe("commercial", CFG)).toEqual({ bandejas: [20], equipos: [40] });
    expect(destinosDe("support", CFG)).toEqual({ bandejas: [10], equipos: [30] });
  });

  it("hasta el corte (Leads sin configurar) comercial no tiene bandeja", () => {
    expect(destinosDe("commercial", SIN_LEADS)).toEqual({ bandejas: [], equipos: [] });
  });

  it("el resto (con override de la Bandeja): ninguna", () => {
    expect(destinosDe("operations", CFG)).toEqual({ bandejas: [], equipos: [] });
    expect(destinosDe("marketing", CFG)).toEqual({ bandejas: [], equipos: [] });
  });
});

describe("planificarRoles", () => {
  const cuenta = [
    { userId: SERVICIO, rol: "administrator" as const },
    { userId: 3, rol: "administrator" as const },
    { userId: 7, rol: "agent" as const },
  ];

  it("nada que cambiar si cada uno tiene su rol", () => {
    expect(
      planificarRoles({
        agentes: [
          { chatwootUserId: 3, rol: "admin" },
          { chatwootUserId: 7, rol: "commercial" },
        ],
        miembrosCuenta: cuenta,
        servicioId: SERVICIO,
      }),
    ).toEqual({ cambios: [], bloqueadas: [] });
  });

  it("alta de quien no está en la cuenta, con su rol", () => {
    const r = planificarRoles({ agentes: [{ chatwootUserId: 9, rol: "support" }], miembrosCuenta: cuenta, servicioId: SERVICIO });
    expect(r.cambios).toEqual([{ chatwootUserId: 9, rol: "agent", alta: true }]);
  });

  it("Studio manda: un admin hecho a mano en Chatwoot vuelve a agent", () => {
    const r = planificarRoles({
      agentes: [
        { chatwootUserId: 3, rol: "admin" },
        { chatwootUserId: 7, rol: "commercial" },
      ],
      miembrosCuenta: [...cuenta.slice(0, 2), { userId: 7, rol: "administrator" }],
      servicioId: SERVICIO,
    });
    expect(r).toEqual({ cambios: [{ chatwootUserId: 7, rol: "agent", alta: false }], bloqueadas: [] });
  });

  it("promoción: un admin de Studio que es agent en Chatwoot pasa a administrator", () => {
    const r = planificarRoles({ agentes: [{ chatwootUserId: 7, rol: "admin" }], miembrosCuenta: cuenta, servicioId: SERVICIO });
    expect(r.cambios).toEqual([{ chatwootUserId: 7, rol: "administrator", alta: false }]);
  });

  it("el último admin humano no se degrada: queda bloqueado (el de servicio no cuenta)", () => {
    const r = planificarRoles({ agentes: [{ chatwootUserId: 3, rol: "commercial" }], miembrosCuenta: cuenta, servicioId: SERVICIO });
    expect(r).toEqual({ cambios: [], bloqueadas: [3] });
  });

  it("sin el id de servicio no se sabe quién es humano: ninguna degradación, aunque haya varios admins", () => {
    const r = planificarRoles({
      agentes: [{ chatwootUserId: 3, rol: "commercial" }],
      miembrosCuenta: [...cuenta, { userId: 4, rol: "administrator" }],
      servicioId: null,
    });
    expect(r).toEqual({ cambios: [], bloqueadas: [3] });
  });

  it("dos admins que bajan a la vez: el primero baja, el segundo queda bloqueado", () => {
    const r = planificarRoles({
      agentes: [
        { chatwootUserId: 3, rol: "support" },
        { chatwootUserId: 4, rol: "support" },
      ],
      miembrosCuenta: [...cuenta, { userId: 4, rol: "administrator" }],
      servicioId: SERVICIO,
    });
    expect(r).toEqual({ cambios: [{ chatwootUserId: 3, rol: "agent", alta: false }], bloqueadas: [4] });
  });

  it("una promoción en la misma corrida deja degradar al otro, y se aplica PRIMERO", () => {
    const r = planificarRoles({
      agentes: [
        { chatwootUserId: 3, rol: "support" },
        { chatwootUserId: 7, rol: "admin" },
      ],
      miembrosCuenta: cuenta,
      servicioId: SERVICIO,
    });
    expect(r.bloqueadas).toEqual([]);
    expect(r.cambios).toEqual([
      { chatwootUserId: 7, rol: "administrator", alta: false },
      { chatwootUserId: 3, rol: "agent", alta: false },
    ]);
  });

  it("un vínculo al usuario de servicio no se toca nunca", () => {
    const r = planificarRoles({ agentes: [{ chatwootUserId: SERVICIO, rol: "commercial" }], miembrosCuenta: cuenta, servicioId: SERVICIO });
    expect(r).toEqual({ cambios: [], bloqueadas: [] });
  });
});

describe("planificarMiembros", () => {
  const destinos = (rol: Parameters<typeof destinosDe>[0]) => destinosDe(rol, CFG).bandejas;
  const agentes = [
    { chatwootUserId: 3, rol: "admin" as const },
    { chatwootUserId: 7, rol: "commercial" as const },
    { chatwootUserId: 8, rol: "support" as const },
  ];
  const enCuenta = new Set([SERVICIO, 3, 7, 8]);

  it("lista completa por bandeja, ordenada; sin cambio si ya es esa", () => {
    const r = planificarMiembros({
      agentes,
      enCuenta,
      servicioId: SERVICIO,
      actuales: new Map([
        [10, [8, 3]],
        [20, []],
      ]),
      destinos,
    });
    expect(r).toEqual([{ id: 20, userIds: [3, 7] }]);
  });

  it("Studio manda: saca a quien se agregó a mano sin vínculo, y a quien cambió de rol", () => {
    const r = planificarMiembros({
      agentes,
      enCuenta,
      servicioId: SERVICIO,
      actuales: new Map([[10, [3, 7, 8, 55]]]),
      destinos,
    });
    expect(r).toEqual([{ id: 10, userIds: [3, 8] }]);
  });

  it("el usuario de servicio se queda donde estaba y no se agrega donde no estaba", () => {
    const r = planificarMiembros({
      agentes,
      enCuenta,
      servicioId: SERVICIO,
      actuales: new Map([
        [10, [SERVICIO]],
        [20, [3, 7]],
      ]),
      destinos,
    });
    expect(r).toEqual([{ id: 10, userIds: [SERVICIO, 3, 8] }]);
  });

  it("quien no está en la cuenta no entra (Chatwoot rechazaría el PATCH entero)", () => {
    const r = planificarMiembros({
      agentes,
      enCuenta: new Set([SERVICIO, 3, 7]),
      servicioId: SERVICIO,
      actuales: new Map([[10, []]]),
      destinos,
    });
    expect(r).toEqual([{ id: 10, userIds: [3] }]);
  });

  it("solo mira las bandejas que pudo leer", () => {
    expect(planificarMiembros({ agentes, enCuenta, servicioId: SERVICIO, actuales: new Map(), destinos })).toEqual([]);
  });

  it("duplicados en la lista actual no cuentan como cambio", () => {
    expect(
      planificarMiembros({ agentes, enCuenta, servicioId: SERVICIO, actuales: new Map([[20, [7, 3, 7]]]), destinos }),
    ).toEqual([]);
  });
});
