// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import QRCode from "qrcode";
import sharp from "sharp";
import jsQR from "jsqr";
import { aplicarEjercicioChina, consultarEtiquetaChina, semillaEjercicioChina, proyectarCajasChina, CODIGOS_CHINA, CONSOLIDADOS_CHINA, type ComandoEjercicioChina } from "../ejercicio-china";
import { permisosDePractica } from "../identidad";
const id=()=>randomUUID();
const recibir=(codigo:string=CODIGOS_CHINA[0],cantidad=3): Extract<ComandoEjercicioChina,{accion:"recibir"}>=>({id:id(),accion:"recibir",codigo,cantidad});
const cargar=(codigo:string,cantidad:number,consolidado:typeof CONSOLIDADOS_CHINA[number]=CONSOLIDADOS_CHINA[0]): Extract<ComandoEjercicioChina,{accion:"cargar"}>=>({id:id(),accion:"cargar",codigo,cantidad,consolidado,ancho:1});
describe("China completa por caja",()=>{
  it("separa segunda llegada y segundo consolidado preservando identidad y recepción de origen",()=>{
    let e=semillaEjercicioChina();
    e=aplicarEjercicioChina(e,recibir());
    e=aplicarEjercicioChina(e,cargar(CODIGOS_CHINA[0],2));
    expect(e.cajas.filter(c=>c.recepcion&&!c.estiba).map(c=>c.codigo)).toEqual([CODIGOS_CHINA[2]]);
    expect(e.cajas.filter(c=>!c.recepcion).map(c=>c.codigo)).toEqual([CODIGOS_CHINA[3]]);
    e=aplicarEjercicioChina(e,recibir(CODIGOS_CHINA[3],1));
    e=aplicarEjercicioChina(e,cargar(CODIGOS_CHINA[2],2,CONSOLIDADOS_CHINA[1]));
    expect(e.lotes.map(l=>l.cajas)).toEqual([[CODIGOS_CHINA[0],CODIGOS_CHINA[1]],[CODIGOS_CHINA[2],CODIGOS_CHINA[3]]]);
    expect(new Set(e.cajas.map(c=>c.codigo)).size).toBe(4);
    expect(e.cajas[2].recepcion).toBe(e.recepciones[0].id);
    expect(e.cajas[3].recepcion).toBe(e.recepciones[1].id);
    expect(e.lotes.map(l=>l.orden)).toEqual([0,0]);
    expect(JSON.stringify(e)).not.toMatch(/centavos|pagado|facturas/);
  });
  it("0245 y 0246 adoptan primero la escaneada, incluso cantidad uno",()=>{
    let e=aplicarEjercicioChina(semillaEjercicioChina(),recibir(CODIGOS_CHINA[2],1));
    expect(e.recepciones[0].cajas).toEqual([CODIGOS_CHINA[2]]);
    e=aplicarEjercicioChina(e,recibir(CODIGOS_CHINA[0],3));
    e=aplicarEjercicioChina(e,cargar(CODIGOS_CHINA[2],1));
    expect(e.lotes[0].cajas).toEqual([CODIGOS_CHINA[2]]);
    e=aplicarEjercicioChina(e,cargar(CODIGOS_CHINA[0],1));
    expect(e.lotes[1].orden).toBe(1);
  });
  it("lookup no escribe; códigos repetidos, proveedor y desconocidos no reciben",()=>{
    const e=semillaEjercicioChina(), copia=structuredClone(e);
    expect(consultarEtiquetaChina(e,CODIGOS_CHINA[0])).toEqual(consultarEtiquetaChina(e,`https://etiqueta.example.test/verificar?b=${CODIGOS_CHINA[0]}`));
    consultarEtiquetaChina(e,CODIGOS_CHINA[0]); expect(e).toEqual(copia);
    expect(()=>consultarEtiquetaChina(e,"https://etiqueta.example.test/verificar?c=DTD-PRA-CHINA&n=1/4")).toThrow(/proveedor/);
    expect(()=>consultarEtiquetaChina(e,"DTD-B-99999999")).toThrow(/desconocido/);
  });
  it("idempotencia confirma el resultado original y rechaza colisiones, cantidades y doble pertenencia",()=>{
    const cmd=recibir(), e=aplicarEjercicioChina(semillaEjercicioChina(),cmd);
    expect(aplicarEjercicioChina(e,cmd)).toEqual(e);
    expect(()=>aplicarEjercicioChina(e,{...cmd,cantidad:1})).toThrow(/otra operación/);
    expect(()=>aplicarEjercicioChina(e,recibir(CODIGOS_CHINA[3],2))).toThrow(/disponibles/);
    expect(()=>aplicarEjercicioChina(semillaEjercicioChina(),cargar(CODIGOS_CHINA[0],1))).toThrow(/primero/);
    const montada=aplicarEjercicioChina(e,cargar(CODIGOS_CHINA[0],2));
    expect(()=>aplicarEjercicioChina(montada,cargar(CODIGOS_CHINA[0],1,CONSOLIDADOS_CHINA[1]))).toThrow(/ya está montada/);
    expect(e.cajas.every(c=>!c.estiba)).toBe(true);
  });
  it("P0131: una etiqueta recibida o montada no adopta otra caja pendiente",()=>{
    const comando=recibir();
    const recibida=aplicarEjercicioChina(semillaEjercicioChina(),comando);
    const copia=structuredClone(recibida);
    expect(()=>aplicarEjercicioChina(recibida,recibir(CODIGOS_CHINA[0],1))).toThrow(/ya fue recibida/);
    expect(recibida).toEqual(copia);
    const montada=aplicarEjercicioChina(recibida,cargar(CODIGOS_CHINA[0],2));
    expect(()=>aplicarEjercicioChina(montada,recibir(CODIGOS_CHINA[0],1))).toThrow(/ya fue recibida/);
    expect(aplicarEjercicioChina(montada,comando)).toEqual(montada);
    expect(montada.recepciones).toHaveLength(1);
    expect(montada.cajas[3].recepcion).toBeUndefined();
    expect(aplicarEjercicioChina(montada,recibir(CODIGOS_CHINA[3],1)).recepciones[1].cajas).toEqual([CODIGOS_CHINA[3]]);
  });
  it("indicadores por recepción: Frágil llega a VE, tareas y evidencia interna nunca salen en proyección",()=>{
    let e=aplicarEjercicioChina(semillaEjercicioChina(),recibir());
    const recepcion=e.recepciones[0].id;
    e=aplicarEjercicioChina(e,{id:id(),accion:"fragil",recepcion,activo:true,motivo:"Vidrio ficticio"});
    e=aplicarEjercicioChina(e,{id:id(),accion:"marca",recepcion,motivo:"Solicitar carta ficticia"});
    e=aplicarEjercicioChina(e,recibir(CODIGOS_CHINA[3],1));
    e=aplicarEjercicioChina(e,cargar(CODIGOS_CHINA[2],1,CONSOLIDADOS_CHINA[1]));
    e=aplicarEjercicioChina(e,cargar(CODIGOS_CHINA[3],1,CONSOLIDADOS_CHINA[1]));
    const ve=proyectarCajasChina(e,CONSOLIDADOS_CHINA[1],"ve");
    expect(ve.map(c=>c.indicadores.map(i=>i.codigo))).toEqual([["fragil"],[]]);
    expect(proyectarCajasChina(e,CONSOLIDADOS_CHINA[1],"shipments")[0].indicadores.map(i=>i.codigo)).toEqual(["fragil","marca_sin_autorizacion"]);
    expect(JSON.stringify(ve)).not.toMatch(/tareas|evidencia|eventos|resolucion|marca_sin/);
    const tarea=e.tareas[0].id;
    expect(()=>aplicarEjercicioChina(e,{id:id(),accion:"resolver_tarea",tarea,evidencia:"PRA-CARTA-001",resolucion:"Carta ficticia revisada"})).toThrow(/Revisa la tarea/);
    e=aplicarEjercicioChina(e,{id:id(),accion:"revisar_tarea",tarea});
    e=aplicarEjercicioChina(e,{id:id(),accion:"resolver_tarea",tarea,evidencia:"PRA-CARTA-001",resolucion:"Carta ficticia revisada"});
    expect(e.tareas[0]).toMatchObject({estado:"resuelta",evidencia:"PRA-CARTA-001"});
    expect(e.recepciones[0].marcaSinAutorizacion).toBe(false);
    e=aplicarEjercicioChina(e,{id:id(),accion:"fragil",recepcion,activo:false,motivo:"Corrección ficticia"});
    expect(proyectarCajasChina(e,CONSOLIDADOS_CHINA[1],"ve")[0].indicadores).toEqual([]);
    expect(e.eventos.at(-1)?.antes.recepciones[0].fragil).toBe(true);
  });
  it("facultades usan región real de membresía, rol y edición, sin inferirla del alcance",()=>{
    const cn=(region?:string)=>permisosDePractica("warehouse","all",{},{},region).find(p=>p.id==="cn");
    expect(cn("cn")?.ejercicioCn).toBe(true); expect(cn("ve")?.ejercicioCn).toBe(false); expect(cn()?.ejercicioCn).toBe(false);
    expect(permisosDePractica("warehouse","all",{}, {},"cn").find(p=>p.id==="ve")?.incidenciaDestino).toBe(false);
    expect(permisosDePractica("warehouse","all",{}, {},"ve").find(p=>p.id==="ve")?.incidenciaDestino).toBe(true);
    expect(permisosDePractica("support","all",{}, {},"ve").find(p=>p.id==="ve")?.incidenciaDestino).toBe(false);
    expect(permisosDePractica("operations","all",{"operations:ve":{view:true,edit:false}}, {},"ve").find(p=>p.id==="ve")?.incidenciaDestino).toBe(false);
    expect(permisosDePractica("warehouse","cn",{}, {},"ve").some(p=>p.id==="ve")).toBe(false);
  });
  it("QR canónico se decodifica ópticamente y resuelve el mismo código de caja",async()=>{
    const png=await QRCode.toBuffer(CODIGOS_CHINA[0],{width:256,margin:4});
    const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const resultado=jsQR(new Uint8ClampedArray(data),info.width,info.height);
    expect(resultado?.data).toBe(CODIGOS_CHINA[0]);
    expect(consultarEtiquetaChina(semillaEjercicioChina(),resultado!.data).codigo).toBe(CODIGOS_CHINA[0]);
  });
});
