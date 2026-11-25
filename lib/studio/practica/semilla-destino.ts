import { CONSOLIDADOS_CHINA, type EjercicioChina, type EtapaLecturaChina } from "./ejercicio-china";
import { semillaDestino, type EjercicioDestino } from "./destino";

export const COMPRA_DESTINO_PREPARADO="PRA-COMPRA-DESTINO-001";
export const CAJAS_DESTINO_PREPARADO=["DTD-B-99007141","DTD-B-99007142","DTD-B-99007143","DTD-B-99007144"] as const;
export type CasoDestinoPreparado={version:"destino-preparado-1";preparadoPara:EtapaLecturaChina;origen:EjercicioChina;destino:EjercicioDestino};
export function semillaDestinoPreparado(generacion:number,etapa:EtapaLecturaChina):CasoDestinoPreparado {
  const [a,b]=CONSOLIDADOS_CHINA;
  const origen:EjercicioChina={version:"china-completa-1",compra:COMPRA_DESTINO_PREPARADO,markbox:"DTD-PRA-DESTINO",eventos:[],tareas:[],
    cajas:CAJAS_DESTINO_PREPARADO.map((codigo,i)=>({codigo,secuencia:i+1,recepcion:i<3 ? "PRA-REC-DEST-001" : "PRA-REC-DEST-002",
      estiba:{consolidado:i<2 ? a : b,lote:i<2 ? "PRA-LOTE-DEST-001" : "PRA-LOTE-DEST-002",orden:0,ancho:i<2 ? 1 : 2}})),
    recepciones:[{id:"PRA-REC-DEST-001",cajas:[...CAJAS_DESTINO_PREPARADO.slice(0,3)],fecha:"2026-01-01T10:00:00.000Z",fragil:true,marcaSinAutorizacion:false,origen:"CN"},
      {id:"PRA-REC-DEST-002",cajas:[CAJAS_DESTINO_PREPARADO[3]],fecha:"2026-01-02T10:00:00.000Z",fragil:false,marcaSinAutorizacion:false,origen:"CN"}],
    lotes:[{id:"PRA-LOTE-DEST-001",compra:COMPRA_DESTINO_PREPARADO,cajas:[...CAJAS_DESTINO_PREPARADO.slice(0,2)],consolidado:a,orden:0,ancho:1},
      {id:"PRA-LOTE-DEST-002",compra:COMPRA_DESTINO_PREPARADO,cajas:[...CAJAS_DESTINO_PREPARADO.slice(2)],consolidado:b,orden:0,ancho:2}]};
  const destino=semillaDestino(generacion);
  if(etapa==="ve") destino.viajes=CONSOLIDADOS_CHINA.map(consolidado=>({consolidado,cajas:origen.cajas.filter(c=>c.estiba?.consolidado===consolidado).map(c=>c.codigo),recibidas:[],estado:"en_transito"}));
  return {version:"destino-preparado-1",preparadoPara:etapa,origen,destino};
}
