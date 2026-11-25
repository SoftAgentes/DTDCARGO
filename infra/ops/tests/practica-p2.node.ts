// Comprobaciones ligeras: Web Request y parsers puros, sin navegador ni DB.
import assert from "node:assert/strict";
import { test } from "node:test";
import { leerCuerpoFinanciero, MAX_CUERPO_FACTURACION } from "../../../lib/studio/practica/cuerpo";
import { parseNumericExpressionDetailed } from "../../../lib/studio/util/parse-numeric-expression";
import { aplicarFactura, semillaFacturacion, totalPractica } from "../../../lib/studio/practica/facturacion";
import { esVistaPractica } from "../../../lib/studio/practica/contrato";
import { permisosVigentes } from "../../../lib/studio/practica/identidad";
import type { SupabaseClient } from "@supabase/supabase-js";

const request = (texto: string, headers: Record<string,string> = {}) => new Request("https://practica.example.test/api/practica/facturacion", {method:"POST",headers,body:texto});

test("20 conceptos máximos UTF-8 o escapados caben y se decodifican completos", async () => {
  for (const concepto of ["中".repeat(100), "\u0001".repeat(100), '"\\á🙂'.repeat(20)]) {
    const body = {espacio:"00000000-0000-4000-8000-000000000713",revision:0,comando:{accion:"guardar",codigo:"PRA-PRE-001",motivo:"\u0001".repeat(500),lineas:Array.from({length:20},()=>({concepto,cantidad:1,centavos:1}))}};
    const texto = JSON.stringify(body);
    assert.ok(Buffer.byteLength(texto)>2048);
    const r = await leerCuerpoFinanciero(request(texto,{"Content-Length":"1"}));
    assert.equal(r.ok,true);
    if (r.ok) assert.deepEqual(r.body,body);
  }
});
test("exactamente 24 KiB se admite; un byte extra se rechaza aunque mienta el header", async () => {
  const envolver = (n: number) => JSON.stringify({texto:"x".repeat(n-12)});
  const exacto = envolver(MAX_CUERPO_FACTURACION);
  assert.equal(Buffer.byteLength(exacto),MAX_CUERPO_FACTURACION);
  assert.equal((await leerCuerpoFinanciero(request(exacto))).ok,true);
  assert.deepEqual(await leerCuerpoFinanciero(request(exacto+" ",{"Content-Length":"1"})),{ok:false,status:413});
});
test("el tope cuenta bytes UTF-8, no caracteres", async () => {
  const texto = JSON.stringify({texto:"中".repeat(9000)});
  assert.ok(texto.length<MAX_CUERPO_FACTURACION);
  assert.ok(Buffer.byteLength(texto)>MAX_CUERPO_FACTURACION);
  assert.deepEqual(await leerCuerpoFinanciero(request(texto)),{ok:false,status:413});
});
test("un stream sin longitud se cancela al superar el máximo", async () => {
  let cancelado=false;
  const stream = new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(MAX_CUERPO_FACTURACION));c.enqueue(new Uint8Array(1));},cancel(){cancelado=true;}});
  const req = new Request("https://practica.example.test/api/practica/facturacion",{method:"POST",body:stream,duplex:"half"} as RequestInit);
  assert.deepEqual(await leerCuerpoFinanciero(req),{ok:false,status:413});
  assert.equal(cancelado,true);
});
test("JSON o UTF-8 inválidos se rechazan", async () => {
  assert.deepEqual(await leerCuerpoFinanciero(request("{")),{ok:false,status:400});
  const req=new Request("https://practica.example.test/",{method:"POST",body:new Uint8Array([0xff])});
  assert.deepEqual(await leerCuerpoFinanciero(req),{ok:false,status:400});
});
test("el parser canónico conserva como no válidos 12.345, vacío y edición incompleta; la coma corregida son 1234 centavos", () => {
  for(const texto of ["12.345","","12,"]) assert.notEqual(parseNumericExpressionDetailed(texto,"dinero",{decimales:2}).status,"valid");
  const r=parseNumericExpressionDetailed("12,34","dinero",{decimales:2});
  assert.equal(r.status,"valid"); assert.equal(r.value,12.34);
  const centavos=Math.round(r.value!*100);
  assert.equal(centavos,1234);
  const d=aplicarFactura(semillaFacturacion(),{accion:"guardar",codigo:"PRA-PRE-001",lineas:[{concepto:"Carga ficticia",cantidad:2,centavos}]});
  assert.equal(totalPractica(d.facturas[0].lineas),2468);
});

const sujeto = {usuario:"00000000-0000-4000-8000-000000000713",tenant:"00000000-0000-4000-8000-000000000714"};
function clienteFicticio(fallo: "auth" | "membresia" | "permisos" | "ausente" | null) {
  return {
    auth:{admin:{getUserById:async () => ({data:{user:{id:sujeto.usuario}},error:fallo === "auth" ? {status:503} : null})}},
    from:() => {
      const cadena = {
        select:() => cadena, eq:() => cadena, is:() => cadena,
        maybeSingle:async () => ({data:fallo === "ausente" ? null : {role:"accounting",warehouse_scope:"all"},error:fallo === "membresia" ? {message:"Error ficticio"} : null}),
        then:(resolver:(valor:unknown)=>unknown) => Promise.resolve(resolver({data:[],error:fallo === "permisos" ? {message:"Error ficticio"} : null})),
      };
      return cadena;
    },
  } as unknown as SupabaseClient;
}
test("una vista de estado inválida o con permisos duplicados nunca autoriza restaurar", () => {
  assert.equal(esVistaPractica({espacio:sujeto.usuario,permisos:[{id:"invoices",edicion:true}]}),true);
  for (const valor of [null,{}, {espacio:sujeto.usuario,permisos:null}, {espacio:sujeto.usuario,permisos:[{id:"invoices",edicion:"sí"}]}, {espacio:sujeto.usuario,permisos:[{id:"invoices",edicion:true},{id:"invoices",edicion:true}]}]) assert.equal(esVistaPractica(valor),false);
});
test("errores de identidad, membresía y base de permisos son indisponibilidad; la ausencia confirmada es denegación", async () => {
  for (const fallo of ["auth","membresia","permisos"] as const) await assert.rejects(permisosVigentes(clienteFicticio(fallo),sujeto));
  assert.equal(await permisosVigentes(clienteFicticio("ausente"),sujeto),null);
  assert.ok((await permisosVigentes(clienteFicticio(null),sujeto))?.some(p => p.id === "invoices" && p.edicion));
});
