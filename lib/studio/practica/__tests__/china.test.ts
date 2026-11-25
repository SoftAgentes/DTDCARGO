import { describe, it, expect } from "vitest";
import { aplicarChina, semillaChina } from "../china";
describe("Carga personal China y Consolidado", () => {
 it("conserva envío y cajas, con reintentos sin eventos duplicados", () => {
  const base = semillaChina();
  const recibida = aplicarChina(base, { accion: "recibir", envio: "PRA-EMB-001" });
  expect(aplicarChina(recibida, { accion: "recibir", envio: "PRA-EMB-001" })).toEqual(recibida);
  const consolidada = aplicarChina(recibida, { accion: "consolidar", envio: "PRA-EMB-001" });
  expect(consolidada.cargas[0].cajas).toEqual(base.cargas[0].cajas);
  expect(consolidada.cargas[0].preorden).toBe("PRA-PRE-001");
  expect(aplicarChina(consolidada, { accion: "consolidar", envio: "PRA-EMB-001" })).toEqual(consolidada);
  expect(base.cargas[0].estado).toBe("recibida");
 });
 it("recibir e identificar no inventa preorden; huérfana exige identificación", () => {
  const recibida = aplicarChina(semillaChina(), { accion: "recibir", envio: "PRA-EMB-004" });
  expect(() => aplicarChina(recibida, { accion: "consolidar", envio: "PRA-EMB-004" })).toThrow();
  const identificada = aplicarChina(recibida, { accion: "identificar", envio: "PRA-EMB-004" });
  expect(identificada.cargas[2].preorden).toBeUndefined();
  expect(aplicarChina(identificada, { accion: "consolidar", envio: "PRA-EMB-004" }).cargas[2].estado).toBe("consolidada");
 });
});
