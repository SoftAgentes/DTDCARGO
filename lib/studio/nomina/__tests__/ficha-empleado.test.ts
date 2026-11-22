/**
 * SDD-0652 F1 · reglas puras de la ficha del empleado y proyecciones que van
 * al navegador. Datos sintéticos.
 */
import { describe, expect, it } from "vitest";
import {
  maskBankAccount,
  toEmployeeEditView,
  toEmployeeListItem,
  type Employee,
} from "../employee-types";
import {
  correosDistintos,
  etiquetaAcceso,
  iniciales,
  lineaDeTiempo,
  mesDeCaracas,
  nivelDeFicha,
  resumenAsistencia,
  saldoPrestamo,
  saldoPrestamos,
  type PrestamoFicha,
} from "../ficha-empleado";
import { accesoDe } from "../ficha-empleado-queries";

const FILA: Employee = {
  id: "11111111-1111-1111-1111-111111111111",
  tenant_id: "t1",
  employee_code: "EMP-0007",
  full_name: "Persona Sintética",
  national_id: "V-00000000",
  position_label: "Analista",
  department: "Operaciones",
  position_id: null,
  phone: "0000-0000000",
  email: "contacto@example.test",
  salary_usd: 321,
  hire_date: "2026-01-15",
  birth_date: "1990-05-05",
  bank_name: "Banco de prueba",
  bank_account_type: "corriente",
  bank_account: "0102 0000 00 0000004321",
  status: "activo",
  notes: "nota",
  created_by: null,
  created_at: "2026-01-15T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
  deleted_at: null,
  auth_user_id: "22222222-2222-2222-2222-222222222222",
};

describe("proyecciones para el navegador", () => {
  it("la lista no lleva cédula, sueldo, nacimiento, teléfono, banco ni el id de la cuenta", () => {
    const item = toEmployeeListItem(FILA);
    expect(Object.keys(item).sort()).toEqual(
      // `photo_url` (fase 2) es la URL firmada y corta, nunca la ruta del bucket.
      ["department", "email", "employee_code", "full_name", "has_account", "id", "photo_url", "position_id", "position_label", "status"].sort(),
    );
    expect(item.photo_url).toBeNull();
    expect(toEmployeeListItem(FILA, "https://firmada.example.test/x").photo_url).toBe("https://firmada.example.test/x");
    const texto = JSON.stringify(item);
    for (const sensible of ["V-00000000", "4321", "321", "1990-05-05", "0000-0000000", FILA.auth_user_id!]) {
      expect(texto).not.toContain(sensible);
    }
    expect(item.has_account).toBe(true);
    expect(toEmployeeListItem({ ...FILA, auth_user_id: null }).has_account).toBe(false);
  });

  it("la edición no lleva el número de cuenta ni el id de la cuenta: solo la máscara", () => {
    const vista = toEmployeeEditView(FILA);
    expect(vista).not.toHaveProperty("bank_account");
    expect(vista).not.toHaveProperty("auth_user_id");
    expect(JSON.stringify(vista)).not.toContain("0102 0000 00 0000004321");
    expect(vista.bank_account_masked).toBe("•••• 4321");
  });

  it("un campo nuevo de la fila no se cuela en la vista de edición", () => {
    const conExtra = { ...FILA, campo_nuevo_secreto: "x" } as Employee;
    expect(toEmployeeEditView(conExtra)).not.toHaveProperty("campo_nuevo_secreto");
    expect(toEmployeeListItem(conExtra)).not.toHaveProperty("campo_nuevo_secreto");
  });
});

describe("maskBankAccount", () => {
  it.each([
    ["0102-0000-00-0000004321", "•••• 4321"],
    ["  12345  ", "•••• 2345"],
    ["1234", "••••"],
    ["", null],
    [null, null],
  ])("%s → %s", (cuenta, esperado) => {
    expect(maskBankAccount(cuenta)).toBe(esperado);
  });
});

describe("nivelDeFicha", () => {
  it("solo admin y accounting abren la ficha", () => {
    expect(nivelDeFicha("admin")).toBe("admin");
    expect(nivelDeFicha("accounting")).toBe("contabilidad");
    for (const r of ["commercial", "operations", "warehouse", "support", null, undefined] as const) {
      expect(nivelDeFicha(r)).toBeNull();
    }
  });
});

describe("préstamos y asistencia", () => {
  const p = (x: Partial<PrestamoFicha>): PrestamoFicha => ({
    id: "l",
    granted_on: "2026-02-01",
    principal_usd: 100,
    installment_usd: 10,
    installments_total: 10,
    status: "activo",
    concept: null,
    paid_usd: 0,
    ...x,
  });

  it("el saldo es lo otorgado menos lo abonado, solo de los activos, nunca negativo", () => {
    expect(saldoPrestamo(p({ paid_usd: 30 }))).toBe(70);
    expect(saldoPrestamo(p({ paid_usd: 130 }))).toBe(0);
    expect(saldoPrestamo(p({ status: "pagado" }))).toBe(0);
    expect(saldoPrestamos([p({ paid_usd: 30 }), p({ principal_usd: 50.5 }), p({ status: "cancelado" })])).toBe(120.5);
  });

  it("cuenta trabajados y ausencias", () => {
    expect(
      resumenAsistencia([
        { work_date: "2026-11-02", status: "trabajado" },
        { work_date: "2026-11-03", status: "ausente" },
        { work_date: "2026-11-04", status: "libre" },
      ]),
    ).toEqual({ trabajados: 1, ausencias: 1, registrados: 3 });
  });

  it("el mes sale en la hora de Caracas", () => {
    // 2026-12-01 02:00 UTC todavía es 30 de noviembre en Caracas (UTC-4).
    const m = mesDeCaracas(new Date("2026-12-01T02:00:00Z"));
    expect(m.desde).toBe("2026-11-01");
    expect(m.hasta).toBe("2026-11-30");
    expect(m.etiqueta).toBe("noviembre");
  });
});

describe("línea de tiempo", () => {
  it("ordena del más reciente al más antiguo y marca lo anulado", () => {
    const hechos = lineaDeTiempo({
      hireDate: "2026-01-15",
      comunicaciones: [{ created_at: "2026-03-01T12:00:00Z", type: "aviso", title: "Aviso sintético" }],
      prestamos: [{ granted_on: "2026-02-01", principal_usd: 100, status: "activo", concept: "Adelanto" }],
      amonestaciones: [{ issued_on: "2026-04-01", warning_code: "AM-0001", severity: "leve", status: "anulada" }],
      recibos: [{ period_label: "2026-05", period_end: "2026-05-31", net_usd: 300, run_status: "pagado" }],
      finiquitos: [
        { settlement_code: "LIQ-0001", termination_date: "2026-06-30", status: "anulado", created_at: "2026-07-02T00:00:00Z" },
      ],
    });
    expect(hechos.map((h) => h.tipo)).toEqual(["finiquito", "recibo", "amonestacion", "comunicacion", "prestamo", "ingreso"]);
    expect(hechos[0]!.titulo).toBe("Finiquito LIQ-0001 (anulado)");
    expect(hechos[2]!.titulo).toBe("Amonestación AM-0001 (anulada)");
  });

  it("sin fuentes queda vacía", () => {
    expect(
      lineaDeTiempo({ hireDate: null, comunicaciones: [], prestamos: [], amonestaciones: [], recibos: [], finiquitos: [] }),
    ).toEqual([]);
  });
});

describe("acceso al Studio (§5.1, D10)", () => {
  it("etiquetas", () => {
    expect(etiquetaAcceso({ nivel: "contabilidad", cuentaEnlazada: false, conAcceso: false })).toBe("Sin cuenta");
    expect(etiquetaAcceso({ nivel: "contabilidad", cuentaEnlazada: true, conAcceso: true })).toBe("Con acceso al Studio");
    expect(etiquetaAcceso({ nivel: "contabilidad", cuentaEnlazada: true, conAcceso: null })).toBe("Tiene cuenta");
    const base = { nivel: "admin" as const, cuentaEnlazada: true, correoAcceso: "a@x.test", ultimoIngreso: null, userId: "u", error: false };
    expect(etiquetaAcceso({ ...base, rol: "support", suspendido: true })).toBe("Acceso al Studio suspendido");
    expect(etiquetaAcceso({ ...base, rol: null, suspendido: false })).toBe("Sin acceso al Studio");
  });

  it("correos distintos sin contar mayúsculas ni espacios", () => {
    expect(correosDistintos(" A@x.test", "a@x.test ")).toBe(false);
    expect(correosDistintos("a@x.test", "b@x.test")).toBe(true);
    expect(correosDistintos(null, "b@x.test")).toBe(false);
  });

  it("iniciales", () => {
    expect(iniciales("Persona de Prueba Sintética")).toBe("PS");
    expect(iniciales("  ")).toBe("—");
  });

  function adminFalso(opts: { membresia?: unknown; errorMembresia?: boolean; email?: string }) {
    const llamadas: string[] = [];
    const chain = {
      select: () => chain,
      eq: (col: string, val: string) => {
        llamadas.push(`${col}=${val}`);
        return chain;
      },
      maybeSingle: async () =>
        opts.errorMembresia ? { data: null, error: { message: "x" } } : { data: opts.membresia ?? null, error: null },
    };
    const getUserById = async () => ({
      data: { user: { email: opts.email ?? "acceso@example.test", last_sign_in_at: "2026-11-10T10:00:00Z" } },
      error: null,
    });
    return { llamadas, client: { from: () => chain, auth: { admin: { getUserById } } } };
  }

  it("a Contabilidad solo le llega sí o no: sin correo, rol ni último ingreso", async () => {
    const { client, llamadas } = adminFalso({ membresia: { role: "support", disabled_at: null, last_login_at: null } });
    const a = await accesoDe(client as never, "contabilidad", "t1", "u1");
    expect(a).toEqual({ nivel: "contabilidad", cuentaEnlazada: true, conAcceso: true });
    expect(JSON.stringify(a)).not.toContain("acceso@example.test");
    expect(llamadas).toEqual(["tenant_id=t1", "user_id=u1"]);
  });

  it("al admin le llega el detalle, filtrado por su tenant", async () => {
    const { client, llamadas } = adminFalso({
      membresia: { role: "support", disabled_at: "2026-11-01T00:00:00Z", last_login_at: "2026-11-12T00:00:00Z" },
    });
    const a = await accesoDe(client as never, "admin", "t1", "u1");
    expect(a).toMatchObject({ nivel: "admin", correoAcceso: "acceso@example.test", rol: "support", suspendido: true });
    expect(a.nivel === "admin" && a.ultimoIngreso).toBe("2026-11-12T00:00:00Z");
    expect(llamadas).toEqual(["tenant_id=t1", "user_id=u1"]);
  });

  it("sin cuenta enlazada no consulta nada", async () => {
    const { client, llamadas } = adminFalso({});
    expect(await accesoDe(client as never, "contabilidad", "t1", null)).toEqual({
      nivel: "contabilidad",
      cuentaEnlazada: false,
      conAcceso: false,
    });
    expect(llamadas).toEqual([]);
  });

  it("si la membresía no se puede leer, Contabilidad ve «Tiene cuenta», no «Sin acceso»", async () => {
    const { client } = adminFalso({ errorMembresia: true });
    const a = await accesoDe(client as never, "contabilidad", "t1", "u1");
    expect(a).toEqual({ nivel: "contabilidad", cuentaEnlazada: true, conAcceso: null });
    expect(etiquetaAcceso(a)).toBe("Tiene cuenta");
  });
});
