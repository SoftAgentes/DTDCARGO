// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { aplicarDestino, semillaDestino, validarManifiestosDestino, vistaFisicaDestino, type ComandoDestino, type PermisosDestino } from "../destino";

const permisos: PermisosDestino = { embarcar:true, registrarLlegada:true, recibirCajas:true, gestionarIncidencia:true };
function escenario() {
  // IDs efímeros de ensayo: no presuponen los valores que publicará #812.
  const a=randomUUID(), b=randomUUID();
  const cajas=["DTD-B-99007131","DTD-B-99007132","DTD-B-99007133","DTD-B-99007134"];
  return {a,b,cajas,contexto:{generacion:1,permisos,fecha:"2026-11-24T12:00:00.000Z",viajes:[{consolidado:a,cajas:cajas.slice(0,2)},{consolidado:b,cajas:cajas.slice(2)}]}};
}
const comando=(accion:ComandoDestino["accion"],consolidado:string,extra:Partial<ComandoDestino>={}):ComandoDestino=>({id:randomUUID(),accion,consolidado,...extra});

describe("Destino propio de práctica, independiente del contrato pendiente de China", () => {
  it("recibe A sin avanzar B y reanuda B con las otras dos cajas", () => {
    const e=escenario(); let d=semillaDestino(1);
    for (const c of [comando("embarcar",e.a),comando("registrar_llegada",e.a),...e.cajas.slice(0,2).map(caja=>comando("recibir_caja",e.a,{caja}))]) d=aplicarDestino(d,c,e.contexto);
    expect(d.viajes).toHaveLength(1);
    expect(d.viajes[0]).toMatchObject({consolidado:e.a,cajas:e.cajas.slice(0,2),recibidas:e.cajas.slice(0,2),estado:"recepcion_completa"});
    const reanudado=JSON.parse(JSON.stringify(d));
    d=aplicarDestino(reanudado,comando("embarcar",e.b),e.contexto);
    d=aplicarDestino(d,comando("registrar_llegada",e.b),e.contexto);
    d=aplicarDestino(d,comando("recibir_caja",e.b,{caja:e.cajas[2]}),e.contexto);
    expect(d.viajes[1].estado).toBe("recepcion_parcial");
    d=aplicarDestino(d,comando("recibir_caja",e.b,{caja:e.cajas[3]}),e.contexto);
    expect(d.viajes[1].estado).toBe("recepcion_completa");
    expect(d.viajes[0]).toEqual(reanudado.viajes[0]);
    expect(JSON.stringify(d)).not.toContain("entregada");
  });
  it("doble lectura y replay conservan una recepción por caja y rechazan otro payload", () => {
    const e=escenario(); let d=aplicarDestino(semillaDestino(1),comando("embarcar",e.a),e.contexto);
    d=aplicarDestino(d,comando("registrar_llegada",e.a),e.contexto);
    const c=comando("recibir_caja",e.a,{caja:e.cajas[0]}); d=aplicarDestino(d,c,e.contexto);
    expect(aplicarDestino(d,c,e.contexto)).toBe(d);
    expect(aplicarDestino(d,comando("recibir_caja",e.a,{caja:e.cajas[0]}),e.contexto)).toBe(d);
    expect(d.eventos.filter(x=>x.accion==="recibir_caja")).toHaveLength(1);
    expect(()=>aplicarDestino(d,{...c,caja:e.cajas[1]},e.contexto)).toThrow(/otra operación/);
    expect(()=>aplicarDestino(d,comando("recibir_caja",e.a,{caja:e.cajas[2]}),e.contexto)).toThrow(/no pertenece/);
  });
  it("retención pendiente bloquea solo su viaje; resolución exige capacidad y motivo", () => {
    const e=escenario(); let d=semillaDestino(1);
    for (const id of [e.a,e.b]) {
      d=aplicarDestino(d,comando("embarcar",id),e.contexto);
      d=aplicarDestino(d,comando("registrar_llegada",id),e.contexto);
    }
    const apertura=comando("abrir_incidencia",e.a,{motivo:"Observación documental ficticia en destino"});
    d=aplicarDestino(d,apertura,e.contexto);
    const pendiente=structuredClone(d);
    expect(()=>aplicarDestino(d,comando("recibir_caja",e.a,{caja:e.cajas[0]}),e.contexto)).toThrow(/pendiente/);
    const resolver=comando("resolver_incidencia",e.a,{motivo:"Documentación ficticia revisada por el rol autorizado"});
    expect(()=>aplicarDestino(d,resolver,{...e.contexto,permisos:{...permisos,gestionarIncidencia:false}})).toThrow(/permiso/);
    expect(()=>aplicarDestino(d,{...resolver,motivo:" "},e.contexto)).toThrow(/resolución/);
    expect(d).toEqual(pendiente);
    d=aplicarDestino(d,comando("recibir_caja",e.b,{caja:e.cajas[2]}),e.contexto);
    expect(d.viajes[0]).toEqual(pendiente.viajes[0]);
    d=aplicarDestino(d,resolver,e.contexto);
    expect(d.viajes[0].incidencia).toMatchObject({estado:"resuelta",motivo:apertura.motivo,resolucion:resolver.motivo});
    d=aplicarDestino(d,comando("recibir_caja",e.a,{caja:e.cajas[0]}),e.contexto);
    expect(d.viajes[0].estado).toBe("recepcion_parcial");
    const fisica=vistaFisicaDestino(d);
    expect(JSON.stringify(fisica)).not.toContain(apertura.motivo);
    expect(JSON.stringify(fisica)).not.toContain(resolver.motivo);
    expect(fisica[0].observacionPendiente).toBe(false);
  });
  it("revalida permiso incluso en replay y rechaza generación vencida o viaje desconocido", () => {
    const e=escenario(), c=comando("embarcar",e.a);
    const d=aplicarDestino(semillaDestino(1),c,e.contexto);
    expect(()=>aplicarDestino(d,c,{...e.contexto,permisos:{...permisos,embarcar:false}})).toThrow(/permiso/);
    expect(()=>aplicarDestino(d,c,{...e.contexto,generacion:2})).toThrow(/cambió/);
    expect(()=>aplicarDestino(d,comando("embarcar",randomUUID()),e.contexto)).toThrow(/inexistentes/);
  });
  it("no reconstruye viajes por total ni permite cajas compartidas o cambiadas", () => {
    const e=escenario(); const d=aplicarDestino(semillaDestino(1),comando("embarcar",e.a),e.contexto);
    const antes=structuredClone(d);
    const mezclado={...e.contexto,viajes:[e.contexto.viajes[0],{consolidado:e.b,cajas:[e.cajas[0],e.cajas[2]]}]};
    expect(()=>aplicarDestino(d,comando("embarcar",e.b),mezclado)).toThrow(/otro viaje/);
    const cambiado={...e.contexto,viajes:[{consolidado:e.a,cajas:[e.cajas[1],e.cajas[2]]}]};
    expect(()=>aplicarDestino(d,comando("registrar_llegada",e.a),cambiado)).toThrow(/fijadas/);
    expect(d).toEqual(antes);
    expect(Object.keys(d).sort()).toEqual(["eventos","generacion","solicitudes","version","viajes"]);
  });
  it("rechaza la propuesta de estiba en A después de su salida y conserva B al releer A", () => {
    const e=escenario(); let d=aplicarDestino(semillaDestino(1),comando("embarcar",e.a),e.contexto);
    const origen=structuredClone(e.contexto.viajes);
    const propuesta=[{consolidado:e.a,cajas:[...e.cajas.slice(0,2),e.cajas[2]]},{consolidado:e.b,cajas:[e.cajas[3]]}];
    expect(()=>validarManifiestosDestino(d,propuesta)).toThrow(/caja disponible/);
    expect(e.contexto.viajes).toEqual(origen);
    d=aplicarDestino(d,comando("registrar_llegada",e.a),e.contexto);
    d=aplicarDestino(d,comando("recibir_caja",e.a,{caja:e.cajas[0]}),e.contexto);
    d=aplicarDestino(d,comando("embarcar",e.b),e.contexto);
    d=aplicarDestino(d,comando("registrar_llegada",e.b),e.contexto);
    d=aplicarDestino(d,comando("recibir_caja",e.b,{caja:e.cajas[2]}),e.contexto);
    const antes=structuredClone(d);
    expect(aplicarDestino(d,comando("recibir_caja",e.a,{caja:e.cajas[0]}),e.contexto)).toBe(d);
    expect(d.viajes[1]).toEqual(antes.viajes[1]);
  });
});
