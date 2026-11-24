// @vitest-environment node
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import sharp from "sharp";
import jsQR from "jsqr";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import type { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/practica/[operacion]/route";
import { proxy } from "@/proxy";
import * as config from "../config";
import { API_PRACTICA, COOKIE_PRACTICA, type VistaPractica } from "../contrato";
import { abrirReferencia, referenciaPrivada } from "../identidad";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import type { StudioUserRole } from "@/lib/studio/user-types";
import { canAccessModule, canEditModule } from "@/lib/studio/rbac";
import { grantsFromRows } from "@/lib/studio/user-module-grants-queries";
import { moduleCoverage } from "@/lib/studio/user-module-grants";
import { permisosDePractica } from "../identidad";
import { CODIGOS_CHINA, COMPRA_CHINA, CONSOLIDADOS_CHINA, type ComandoEjercicioChina } from "../ejercicio-china";
import type { ComandoDestino } from "../destino";

const real = "https://studio.example.test", prueba = "https://practica.example.test", datos = "https://datos.example.test";
const clave = "a".repeat(64), canal = "b".repeat(64);
const tokenDatos = "e30." + Buffer.from(JSON.stringify({role:"practica_personal_web"})).toString("base64url") + ".cHJ1ZWJh";
const comunes = { PRACTICA_STUDIO_REAL: real, PRACTICA_STUDIO_PRUEBA: prueba, PRACTICA_SECRETO_CANAL: canal };
const origen = { ...comunes, PRACTICA_MODO: "origen", APP_ENV: "production", APP_URL: real, PRACTICA_LLAVE_IDENTIDAD: clave };
const destino = { ...comunes, PRACTICA_MODO: "destino", APP_ENV: "staging", APP_URL: prueba, NEXT_PUBLIC_GA_ID:"off",
  PRACTICA_DATOS_ORIGEN: datos, PRACTICA_DATOS_TOKEN: tokenDatos, PRACTICA_DATOS_INSTANCIA: randomUUID() };
const resolver = config.configuracionPractica;
const contexto = new AsyncLocalStorage<{ sitio: string; usuario?: string }>();
const tenant = randomUUID();
const usuarios = new Map<string, { role: StudioUserRole; warehouse_scope: string; region?: string; disabled: boolean }>();
const extras = new Map<string, { user_id: string; module_id: string; can_view: boolean; can_edit: boolean; expires_at: string }>();
const ajustesPorRol = new Map<string, { module_id: string; can_view: boolean; can_edit: boolean }[]>();
const dbOrigen = vi.hoisted(() => ({ cliente: vi.fn(), admin: vi.fn(), acceso: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: dbOrigen.cliente }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: dbOrigen.admin }));
vi.mock("@/lib/studio/rbac-guard", () => ({ getStudioAccess: dbOrigen.acceso }));

function usuario(role: StudioUserRole, scope = "all", region = "cn") {
  const id = randomUUID();
  usuarios.set(id, { role, warehouse_scope: scope, region, disabled: false });
  return id;
}
function solicitar(sitio: string, op: string, body: object, opc: { usuario?: string; sesion?: string; headers?: Record<string,string>; texto?: string } = {}) {
  const headers = { "Content-Type":"application/json", Host: new URL(sitio).host, Origin:sitio,
    ...(opc.sesion ? { Cookie: COOKIE_PRACTICA + "=" + opc.sesion } : {}), ...opc.headers };
  return contexto.run({ sitio, usuario: opc.usuario }, () => POST(new NextRequest(sitio + API_PRACTICA + op,
    { method:"POST", headers, body: opc.texto ?? JSON.stringify(body) }), { params: Promise.resolve({ operacion:op }) }));
}
async function frontera(sitio: string, op: string, body: object, sesion: string, origin: string) {
  const request = new NextRequest(sitio + API_PRACTICA + op, {method:"POST",headers:{Host:new URL(sitio).host,Origin:origin,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const anterior=process.env.PRACTICA_MODO;
  process.env.PRACTICA_MODO="destino";
  let paso;
  try { paso=await contexto.run({sitio},()=>proxy(request)); }
  finally { if(anterior === undefined) delete process.env.PRACTICA_MODO; else process.env.PRACTICA_MODO=anterior; }
  if(paso.status !== 200) return paso;
  return solicitar(sitio,op,body,{sesion,headers:{Origin:origin}});
}
async function entrar(id: string) {
  const emision = await solicitar(real, "emitir", {}, { usuario:id });
  expect(emision.status).toBe(200);
  const { pase } = await emision.json();
  const canje = await solicitar(prueba, "canjear", { pase });
  expect(canje.status).toBe(200);
  const cookie = canje.cookies.get(COOKIE_PRACTICA)!;
  expect(cookie).toMatchObject({ httpOnly:true, secure:true, sameSite:"strict", path:"/" });
  expect(cookie.domain).toBeUndefined();
  return { pase, sesion:cookie.value, vista:await canje.json() as VistaPractica };
}

describe("Fase 1 · acceso entre sitios, sin salida a Internet", () => {
  let db: PGlite;
  let disponible = true;
  let falloOrigen: "auth" | "membresia" | "extras" | "invalida" | "503" | null = null;
  beforeAll(async () => {
    db = await pgliteLimpio();
    await db.exec("set dtd.destino = 'practica-personal-nueva'");
    await db.exec(readFileSync(resolve("infra/ops/staging/practica-personal.sql"), "utf8"));
    await db.exec(readFileSync(resolve("infra/ops/staging/practica-facturacion.sql"), "utf8"));
    await db.exec(readFileSync(resolve("infra/ops/staging/practica-china.sql"), "utf8"));
    destino.PRACTICA_DATOS_INSTANCIA = (await db.query<{ instancia: string }>("select instancia from practica_privada.destino")).rows[0].instancia as ReturnType<typeof randomUUID>;
    await db.exec("set role practica_personal_web");
    vi.spyOn(config, "configuracionPractica").mockImplementation(() => resolver(contexto.getStore()?.sitio === real ? origen : destino));
    dbOrigen.acceso.mockImplementation(() => {
      const userId = contexto.getStore()?.usuario;
      const miembro = userId ? usuarios.get(userId) : undefined;
      return { userId, tenantId:tenant, role:miembro && !miembro.disabled ? miembro.role : null };
    });
    dbOrigen.admin.mockReturnValue({
      auth: { admin:{ getUserById:(id:string) => ({ data:{ user:usuarios.has(id) ? { id } : null }, error:falloOrigen === "auth" ? {status:503} : null }) } },
      from:(tabla:string) => {
        const filtros: Record<string,unknown> = {};
        const cadena = {
          select:() => cadena,
          eq:(k:string,v:unknown) => { filtros[k]=v; return cadena; },
          is:(k:string,v:unknown) => { filtros[k]=v; return cadena; },
          maybeSingle:() => {
            expect(tabla).toBe("user_tenants");
            expect(filtros).toMatchObject({tenant_id:tenant, disabled_at:null});
            const miembro = usuarios.get(String(filtros.user_id));
            return { data:miembro?.disabled ? null : miembro, error:falloOrigen === "membresia" ? {message:"Base ficticia indisponible"} : null };
          },
          then:(recibir:(v:unknown)=>void) => {
            expect(["studio_role_module_overrides","studio_user_module_grants"]).toContain(tabla);
            expect(filtros.tenant_id).toBe(tenant);
            const extra = tabla === "studio_user_module_grants" && extras.get(String(filtros.user_id));
            recibir({ data:tabla === "studio_role_module_overrides" ? (ajustesPorRol.get(String(filtros.role)) ?? []) : extra ? [extra] : [], error:falloOrigen === "extras" ? {message:"Base ficticia indisponible"} : null });
          },
        };
        return cadena;
      },
    });
    vi.stubGlobal("fetch", async (url:string, init:RequestInit) => {
      const u = new URL(url);
      expect(init.redirect).toBe("error");
      expect(init.cache).toBe("no-store");
      const body = JSON.parse(String(init.body));
      const headers = init.headers as Record<string,string>;
      if (u.origin === datos) {
        expect(headers.Authorization).toBe("Bearer " + tokenDatos);
        const funciones: Record<string,[string,string[]]> = {
          "/rpc/practica_reservar":["practica_reservar",["p_huella","p_propietario","p_referencia"]],
          "/rpc/practica_canjear":["practica_canjear",["p_huella","p_sesion"]],
          "/rpc/practica_sesion":["practica_sesion",["p_sesion"]],
          "/rpc/practica_cerrar":["practica_cerrar",["p_sesion"]],
          "/rpc/practica_reiniciar":["practica_reiniciar",["p_sesion","p_revision","p_fin_revision","p_documento"]],
          "/rpc/practica_china":["practica_china",["p_sesion","p_revision","p_documento"]],
          "/rpc/practica_facturacion":["practica_facturacion",["p_sesion","p_revision","p_documento"]],
        };
        const [nombre, campos] = funciones[u.pathname];
        const args = ["p_instancia", ...campos].map(c => c === "p_documento" && body[c] ? JSON.stringify(body[c]) : body[c] ?? null);
        const marcadores = args.map((_, i) => "$" + (i+1)).join(",");
        const { rows } = await db.query<{ valor:unknown }>("select public." + nombre + "(" + marcadores + ") as valor", args);
        return Response.json(rows[0].valor);
      }
      if (!disponible) throw new Error("Enlace de prueba interrumpido");
      if (u.origin === real && falloOrigen === "invalida") return Response.json({permisos:"respuesta ficticia inválida"});
      if (u.origin === real && falloOrigen === "503") return Response.json(null,{status:503});
      expect([prueba + API_PRACTICA + "reservar", real + API_PRACTICA + "permisos"]).toContain(url);
      expect(headers.Authorization).toBe("Bearer " + canal);
      return solicitar(u.origin, u.pathname.slice(API_PRACTICA.length), body, { headers });
    });
  }, 60000);
  afterAll(async () => { vi.unstubAllGlobals(); vi.restoreAllMocks(); await db?.close(); });

  async function prepararOrigenDestino(completo=true) {
    const id=usuario("admin","all","ve"), cuenta=await entrar(id);
    const origen=async (operacion?:ComandoEjercicioChina,revision?:number)=>solicitar(prueba,"china",{espacio:cuenta.vista.espacio,modulo:"cn",revision,
      ...(operacion ? {comando:{accion:"ejercicio",envio:COMPRA_CHINA,operacion}} : {})},{sesion:cuenta.sesion});
    let v=await (await origen()).json();
    const hacer=async (operacion:ComandoEjercicioChina)=>{const r=await origen(operacion,v.revision);expect(r.status).toBe(200);v=await r.json();return v;};
    await hacer({id:randomUUID(),accion:"recibir",codigo:CODIGOS_CHINA[0],cantidad:3});
    const recepcion=v.documento.ejercicio.recepciones[0].id;
    await hacer({id:randomUUID(),accion:"fragil",recepcion,activo:true,motivo:"Manejo físico ficticio"});
    await hacer({id:randomUUID(),accion:"marca",recepcion,motivo:"MOTIVO_INTERNO_CN_NO_DEVOLVER_A_VE"});
    await hacer({id:randomUUID(),accion:"cargar",codigo:CODIGOS_CHINA[0],cantidad:2,consolidado:CONSOLIDADOS_CHINA[0],ancho:1});
    if (completo) {
      await hacer({id:randomUUID(),accion:"recibir",codigo:CODIGOS_CHINA[3],cantidad:1});
      await hacer({id:randomUUID(),accion:"cargar",codigo:CODIGOS_CHINA[2],cantidad:2,consolidado:CONSOLIDADOS_CHINA[1],ancho:2});
    }
    const destinoOp=(etapa:"shipments"|"ve",consolidado:string,cmd?:ComandoDestino,revision?:number)=>solicitar(prueba,"china",{
      espacio:cuenta.vista.espacio,etapa,consolidado,revision,...(cmd ? {destino:cmd} : {}),
    },{sesion:cuenta.sesion});
    const raw=async()=>{const r=await db.query<{valor:{revision:number;documento:import("../china").ChinaPractica}}>(
      "select public.practica_china($1,$2) as valor",[destino.PRACTICA_DATOS_INSTANCIA,createHash("sha256").update(cuenta.sesion).digest("hex")]);return r.rows[0].valor;};
    return {id,cuenta,origen,destinoOp,raw};
  }

  it("conecta dos parciales por caja, filtra Frágil en VE y resuelve observación sin tocar facturas",async()=>{
    const e=await prepararOrigenDestino(),[a,b]=CONSOLIDADOS_CHINA;
    const fin=()=>solicitar(prueba,"facturacion",{espacio:e.cuenta.vista.espacio},{sesion:e.cuenta.sesion});
    const financiera=await (await fin()).json();
    const leer=async(etapa:"shipments"|"ve",c:string)=>{const r=await e.destinoOp(etapa,c);expect(r.status).toBe(200);return r.json();};
    let v=await leer("shipments",a);
    expect(v.cajas.map((c:{codigo:string})=>c.codigo)).toEqual(CODIGOS_CHINA.slice(0,2));
    expect(v.cajas.every((c:{indicadores:{codigo:string}[]})=>c.indicadores.some(i=>i.codigo==="marca_sin_autorizacion"))).toBe(true);
    const fisica=await leer("ve",b);
    expect(fisica.cajas.map((c:{codigo:string})=>c.codigo)).toEqual(CODIGOS_CHINA.slice(2));
    expect(fisica.cajas.map((c:{indicadores:{codigo:string}[]})=>c.indicadores.map(i=>i.codigo))).toEqual([["fragil"],[]]);
    for (const datos of [v,fisica]) {
      const texto=JSON.stringify(datos);
      for (const prohibido of ["MOTIVO_INTERNO_CN_NO_DEVOLVER_A_VE","tareas","eventos","ejercicio","PRA-CARTA-001"]) expect(texto).not.toContain(prohibido);
    }
    const actuar=async(etapa:"shipments"|"ve",c:string,accion:ComandoDestino["accion"],extra:Partial<ComandoDestino>={})=>{
      v=await leer(etapa,c);const r=await e.destinoOp(etapa,c,{id:randomUUID(),accion,consolidado:c,...extra},v.revision);expect(r.status).toBe(200);v=await r.json();return v;
    };
    await actuar("shipments",a,"embarcar"); await actuar("ve",a,"registrar_llegada");
    await actuar("shipments",a,"abrir_incidencia",{motivo:"Observación aduanal ficticia de destino"});
    expect((await e.destinoOp("ve",a,{id:randomUUID(),accion:"recibir_caja",consolidado:a,caja:CODIGOS_CHINA[0]},v.revision)).status).toBe(409);
    usuarios.get(e.id)!.role="warehouse"; usuarios.get(e.id)!.region="cn";
    const resolver={id:randomUUID(),accion:"resolver_incidencia" as const,consolidado:a,motivo:"Revisión logística ficticia completada"};
    expect((await e.destinoOp("ve",a,resolver,v.revision)).status).toBe(403);
    usuarios.get(e.id)!.role="operations"; usuarios.get(e.id)!.region="ve";
    v=await leer("shipments",a);
    const resuelta=await e.destinoOp("shipments",a,resolver,v.revision);expect(resuelta.status).toBe(200);
    const sinMotivo=await leer("ve",a);expect(JSON.stringify(sinMotivo)).not.toContain(resolver.motivo);
    const recibir={id:randomUUID(),accion:"recibir_caja" as const,consolidado:a,caja:CODIGOS_CHINA[0]};
    const dobles=await Promise.all([e.destinoOp("ve",a,recibir,sinMotivo.revision),e.destinoOp("ve",a,recibir,sinMotivo.revision)]);
    expect(dobles.map(r=>r.status)).toEqual([200,200]);
    await actuar("ve",a,"recibir_caja",{caja:CODIGOS_CHINA[1]});
    expect(v.viaje.estado).toBe("recepcion_completa");expect((await leer("ve",b)).viaje).toBeNull();
    await actuar("shipments",b,"embarcar"); await actuar("ve",b,"registrar_llegada");
    await actuar("ve",b,"recibir_caja",{caja:CODIGOS_CHINA[2]});
    const antesB=structuredClone(v.viaje);
    const repetida=await e.destinoOp("ve",a,{...recibir,id:randomUUID()},0);expect(repetida.status).toBe(200);
    expect((await leer("ve",b)).viaje).toEqual(antesB);
    await actuar("ve",b,"recibir_caja",{caja:CODIGOS_CHINA[3]});
    expect(v.viaje.estado).toBe("recepcion_completa");
    const raw=await e.raw();expect(raw.documento.destino?.eventos.filter(x=>x.accion==="recibir_caja")).toHaveLength(4);
    usuarios.get(e.id)!.role="admin";
    expect((await (await fin()).json()).documento).toEqual(financiera.documento);
    expect(raw.documento.ejercicio?.compra).toBe(COMPRA_CHINA);
    const otra=await entrar(usuario("admin"));
    expect((await solicitar(prueba,"china",{espacio:otra.vista.espacio,etapa:"ve",consolidado:a},{sesion:e.cuenta.sesion})).status).toBe(403);
  });

  it("el CAS único fija A contra estibas tardías y no congela snapshots que perdieron la carrera",async()=>{
    const [a]=CONSOLIDADOS_CHINA;
    const e=await prepararOrigenDestino(false);
    const antes=await (await e.destinoOp("shipments",a)).json();
    const embarcar={id:randomUUID(),accion:"embarcar" as const,consolidado:a};
    expect((await e.destinoOp("shipments",a,embarcar,antes.revision)).status).toBe(200);
    const cargar={id:randomUUID(),accion:"cargar" as const,codigo:CODIGOS_CHINA[2],cantidad:1,consolidado:a,ancho:1};
    expect((await e.origen(cargar,antes.revision)).status).toBe(409);
    const vigente=await (await e.origen()).json();
    expect((await e.origen(cargar,vigente.revision)).status).toBe(409);
    const raw=await e.raw();
    expect(raw.documento.ejercicio?.cajas[2].estiba).toBeUndefined();
    expect(raw.documento.destino?.viajes[0].cajas).toEqual(CODIGOS_CHINA.slice(0,2));
    const primeroOrigen=await prepararOrigenDestino(false);
    const viejo=await (await primeroOrigen.destinoOp("shipments",a)).json();
    expect((await primeroOrigen.origen({...cargar,id:randomUUID()},viejo.revision)).status).toBe(200);
    expect((await primeroOrigen.destinoOp("shipments",a,{...embarcar,id:randomUUID()},viejo.revision)).status).toBe(409);
    expect((await primeroOrigen.raw()).documento.destino).toBeUndefined();
    const carrera=await prepararOrigenDestino(false);
    const inicio=await (await carrera.destinoOp("shipments",a)).json();
    const resultados=await Promise.all([carrera.destinoOp("shipments",a,{...embarcar,id:randomUUID()},inicio.revision),carrera.origen({...cargar,id:randomUUID()},inicio.revision)]);
    expect(resultados.map(r=>r.status).sort()).toEqual([200,409]);
    const final=await carrera.raw();
    if (final.documento.destino) expect(final.documento.destino.viajes[0].cajas).toEqual(final.documento.ejercicio?.cajas.filter(c=>c.estiba?.consolidado===a).map(c=>c.codigo));
    else expect(final.documento.ejercicio?.cajas.filter(c=>c.estiba?.consolidado===a)).toHaveLength(3);
  });

  it("indisponibilidad de origen/base y respuestas inválidas no se convierten en revocación", async () => {
    const id = usuario("accounting"); const cuenta = await entrar(id);
    const estado = () => solicitar(prueba,"estado",{espacio:cuenta.vista.espacio},{sesion:cuenta.sesion});
    try {
      for (const fallo of ["auth","membresia","extras","invalida","503"] as const) {
        falloOrigen = fallo;
        expect((await estado()).status).toBe(503);
        expect((await solicitar(prueba,"facturacion",{espacio:cuenta.vista.espacio},{sesion:cuenta.sesion})).status).toBe(503);
        falloOrigen = null;
        expect((await estado()).status).toBe(200);
      }
      disponible = false; expect((await estado()).status).toBe(503);
      disponible = true; expect((await estado()).status).toBe(200);
      usuarios.get(id)!.disabled = true;
      expect((await estado()).status).toBe(403);
      usuarios.get(id)!.disabled = false;
      const otra = await entrar(usuario("accounting"));
      expect((await solicitar(prueba,"estado",{espacio:cuenta.vista.espacio},{sesion:otra.sesion})).status).toBe(403);
      expect((await solicitar(prueba,"estado",{espacio:cuenta.vista.espacio})).status).toBe(401);
    } finally { falloOrigen = null; disponible = true; }
  });

  it("dos personas del mismo rol y una administradora conservan copias independientes", async () => {
    const ana = usuario("operations"), bea = usuario("operations");
    const [a,b,admin] = await Promise.all([entrar(ana),entrar(bea),entrar(usuario("admin"))]);
    expect(new Set([a.vista.espacio,b.vista.espacio,admin.vista.espacio]).size).toBe(3);
    expect(a.vista.permisos).toEqual(b.vista.permisos);
    expect(admin.vista.permisos).toHaveLength(5);
    expect((await solicitar(prueba,"estado",{espacio:b.vista.espacio},{sesion:admin.sesion})).status).toBe(403);
    expect((await solicitar(prueba,"estado",{espacio:a.vista.espacio},{sesion:b.sesion})).status).toBe(403);
    expect((await solicitar(prueba,"salir",{espacio:a.vista.espacio},{sesion:b.sesion})).headers.has("set-cookie")).toBe(false);
    expect((await solicitar(prueba,"estado",{espacio:b.vista.espacio},{sesion:b.sesion})).status).toBe(200);
    expect((await solicitar(prueba,"canjear",{pase:a.pase})).status).toBe(403);
    const [otra, simultanea] = await Promise.all([entrar(ana),entrar(ana)]);
    expect([otra.vista.espacio,simultanea.vista.espacio]).toEqual([a.vista.espacio,a.vista.espacio]);
    expect((await solicitar(prueba,"salir",{espacio:a.vista.espacio},{sesion:a.sesion})).status).toBe(200);
    expect((await solicitar(prueba,"estado",{espacio:a.vista.espacio},{sesion:a.sesion})).status).toBe(403);
    expect((await entrar(ana)).vista.espacio).toBe(a.vista.espacio);
  });

  it("aplica el alcance del almacén, un recorte de rol y la baja con una sesión abierta", async () => {
    const id = usuario("warehouse","cn");
    const { vista, sesion } = await entrar(id);
    expect(vista.permisos.map(p => p.id)).toContain("cn");
    expect(vista.permisos.map(p => p.id)).not.toContain("ve");
    extras.set(id, { user_id:id, module_id:"invoices", can_view:true, can_edit:false, expires_at:new Date(Date.now() + 60000).toISOString() });
    const soloLectura = await solicitar(prueba,"estado",{espacio:vista.espacio},{sesion});
    expect((await soloLectura.json()).permisos).not.toContainEqual(expect.objectContaining({id:"invoices"}));
    expect((await solicitar(prueba,"facturacion",{espacio:vista.espacio},{sesion})).status).toBe(403);
    extras.get(id)!.expires_at = new Date(0).toISOString();
    usuarios.get(id)!.role = "marketing";
    const revisada = await solicitar(prueba,"estado",{espacio:vista.espacio},{sesion});
    expect(revisada.status).toBe(200);
    const { permisos } = await revisada.json();
    expect(permisos).not.toContainEqual(expect.objectContaining({id:"cn"}));
    expect(permisos).not.toContainEqual(expect.objectContaining({id:"invoices"}));
    usuarios.get(id)!.disabled = true;
    expect((await solicitar(prueba,"estado",{espacio:vista.espacio},{sesion})).status).toBe(403);
    expect((await solicitar(real,"emitir",{},{usuario:id})).status).toBe(403);
  });

  it("Facturación por la frontera del receptor: permiso efectivo, doble envío, dos cuentas y reset concurrente", async () => {
    const id = usuario("warehouse", "cn");
    extras.set(id, { user_id:id, module_id:"invoices", can_view:true, can_edit:false, expires_at:new Date(Date.now() + 60000).toISOString() });
    const a = await entrar(id), b = await entrar(usuario("accounting"));
    const pedir = (s: typeof a, datos: object = {}) => {
      expect(config.rutaDelReceptor(API_PRACTICA + "facturacion", "POST", false)).toBe(true);
      return solicitar(prueba, "facturacion", { espacio:s.vista.espacio, ...datos }, { sesion:s.sesion });
    };
    expect(a.vista.permisos).not.toContainEqual(expect.objectContaining({id:"invoices"}));
    expect(a.vista.permisos).toContainEqual({id:"cn",edicion:true,ejercicioCn:true});
    expect((await pedir(a)).status).toBe(403);
    extras.get(id)!.can_edit = true;
    for (const accion of ["guardar","emitir","anular","pagar","reiniciar"]) {
      expect((await pedir(a, { revision:0, comando:{ accion, codigo:"PRA-PRE-001", motivo:"Caso ficticio" } })).status).toBe(403);
    }
    expect((await pedir(b, { espacio:a.vista.espacio })).status).toBe(403);
    const inicial = await (await pedir(b)).json();
    const cobrar = { revision:inicial.revision, comando:{ accion:"pagar", codigo:"PRA-FAC-002" } };
    const pagos = await Promise.all([pedir(b,cobrar),pedir(b,cobrar)]);
    expect(pagos.map(p => p.status).sort()).toEqual([200,409]);
    const pagada = await (await pedir(b)).json();
    expect(pagada.documento.facturas[1].pagado).toBe(30000);
    expect(pagada.documento.eventos).toHaveLength(1);
    const reset = { revision:pagada.revision, comando:{ accion:"reiniciar", codigo:"espacio" } };
    expect((await Promise.all([pedir(b,reset),pedir(b,reset)])).map(p => p.status).sort()).toEqual([200,409]);
    expect((await (await pedir(b)).json()).documento.generacion).toBe(2);
    usuarios.get(id)!.role = "accounting";
    expect((await (await pedir(a)).json()).documento.generacion).toBe(1);
    expect((await pedir(a, { revision:0, comando:{ accion:"emitir", codigo:"PRA-PRE-001" } })).status).toBe(200);
    expect((await solicitar(prueba,"salir",{espacio:a.vista.espacio},{sesion:a.sesion})).status).toBe(200);
    const reanudada = await entrar(id);
    expect(reanudada.vista.espacio).toBe(a.vista.espacio);
    expect((await (await pedir(reanudada)).json()).documento.facturas[0].estado).toBe("emitida");
    usuarios.get(id)!.role = "warehouse";
    expect((await pedir(reanudada)).status).toBe(403);
  });

  it("conserva extras cubiertos y consulta sin edición, sin inventar un perfil financiero de lectura", async () => {
    const extra = grantsFromRows([{user_id:"ficticio",module_id:"clients",can_view:true,can_edit:true,expires_at:null}]);
    expect(moduleCoverage("clients")).toBe("covered");
    expect(canAccessModule("warehouse","clients")).toBe(false);
    expect(canAccessModule("warehouse","clients",{},extra)).toBe(true);
    expect(canEditModule("warehouse","clients",{},extra)).toBe(true);
    expect(permisosDePractica("warehouse","cn",{},extra,"cn")).toContainEqual({id:"cn",edicion:true,ejercicioCn:true});
    expect(canAccessModule("warehouse","clients",{},extra)).toBe(true);
    const soporte = await entrar(usuario("support"));
    expect(soporte.vista.permisos).toContainEqual({id:"cn",edicion:false,ejercicioCn:false});
    expect(soporte.vista.permisos).not.toContainEqual(expect.objectContaining({id:"invoices"}));
    expect(moduleCoverage("invoices")).toBe("money_phase");
    expect(permisosDePractica("accounting","all",{}, {invoices:{view:true,edit:false}})).toContainEqual({id:"invoices",edicion:true});
  });

  it("aplica restricciones por acción y revocación de membresía financiera", async () => {
    const id = usuario("accounting"), cuenta = await entrar(id);
    const pedir = (revision = 0, comando?: object) => solicitar(prueba,"facturacion",{espacio:cuenta.vista.espacio,revision,comando},{sesion:cuenta.sesion});
    expect((await pedir()).status).toBe(200);
    for (const comando of [
      {accion:"emitir",codigo:"PRA-FAC-002"},
      {accion:"pagar",codigo:"PRA-PRE-001"},
      {accion:"anular",codigo:"PRA-PRE-001",motivo:"Prueba ficticia"},
      {accion:"anular",codigo:"PRA-FAC-002",motivo:"x"},
      {accion:"guardar",codigo:"PRA-FAC-002",lineas:[{concepto:"Ficticio",cantidad:1,centavos:1}]},
      {accion:"guardar",codigo:"PRA-PRE-001",lineas:[{concepto:"Ficticio",cantidad:1,centavos:-1}]},
    ]) expect((await pedir(0,comando)).status).toBe(409);
    expect((await (await pedir()).json()).revision).toBe(0);
    expect((await pedir(0,{accion:"anular",codigo:"PRA-FAC-002",motivo:"Corregir concepto ficticio"})).status).toBe(200);
    expect((await pedir(1,{accion:"pagar",codigo:"PRA-FAC-002"})).status).toBe(409);
    expect((await pedir(1,{accion:"emitir",codigo:"PRA-PRE-001"})).status).toBe(200);
    expect((await pedir(2,{accion:"pagar",codigo:"PRA-PRE-001"})).status).toBe(200);
    expect((await pedir(3,{accion:"anular",codigo:"PRA-PRE-001",motivo:"No se puede con pago vivo"})).status).toBe(409);
    usuarios.get(id)!.disabled = true;
    expect((await pedir()).status).toBe(403);
    for (const accion of ["guardar","emitir","anular","pagar","reiniciar"]) expect((await pedir(3,{accion,codigo:"PRA-PRE-001"})).status).toBe(403);
  });

  it("China atraviesa proxy, inicia sin Facturación, persiste y aísla permisos y reinicio", async () => {
    const id = usuario("warehouse", "cn"), otra = await entrar(usuario("warehouse", "cn"));
    const a = await entrar(id);
    const op = (cuenta: typeof a, body: object = {}) => frontera(prueba,"china",{espacio:cuenta.vista.espacio,modulo:"cn",...body},cuenta.sesion,prueba);
    let r = await op(a); expect(r.status).toBe(200);
    let v = await r.json();
    expect(v.documento.cargas[0].envio).toBe("PRA-EMB-001");
    expect(JSON.stringify(v)).not.toMatch(/centavos|pagado|lineas/);
    const comando = {accion:"recibir",envio:"PRA-EMB-003"};
    r = await op(a,{revision:v.revision,comando}); expect(r.status).toBe(200);
    v = await r.json();
    expect((await (await op(a)).json()).documento.cargas[1].estado).toBe("recibida");
    expect((await (await op(otra)).json()).documento.cargas[1].estado).toBe("pendiente");
    expect((await op(a,{espacio:otra.vista.espacio})).status).toBe(403);
    expect((await op(a,{modulo:"naviera",revision:v.revision,comando:{accion:"consolidar",envio:"PRA-EMB-001"}})).status).toBe(403);
    expect((await op(a,{revision:v.revision-1,comando})).status).toBe(409);
    const pestana = await entrar(id);
    expect(pestana.vista.espacio).toBe(a.vista.espacio);
    const revisionVieja=v.revision;
    const reiniciada=await op(a,{revision:v.revision,comando:{accion:"reiniciar",envio:"espacio"}});
    expect(reiniciada.status).toBe(200);
    v=await reiniciada.json();
    expect(v.documento.generacion).toBe(2);
    expect(JSON.stringify(v)).not.toMatch(/centavos|pagado|lineas/);
    expect((await op(pestana,{revision:revisionVieja,comando})).status).toBe(409);
    expect((await solicitar(prueba,"facturacion",{espacio:a.vista.espacio},{sesion:a.sesion})).status).toBe(403);
    expect((await (await op(otra)).json()).documento.generacion).toBe(1);
    usuarios.get(id)!.role="support";
    expect((await op(a)).status).toBe(200);
    expect((await op(a,{revision:v.revision,comando})).status).toBe(403);
    usuarios.get(id)!.role="admin";
    const consolidar = {modulo:"naviera",revision:v.revision,comando:{accion:"consolidar",envio:"PRA-EMB-001"}};
    const consolidada=await op(a,consolidar); expect(consolidada.status).toBe(200);
    v=await consolidada.json();
    expect(v.documento.cargas[0]).toMatchObject({envio:"PRA-EMB-001",cajas:["PRA-CAJA-001","PRA-CAJA-002"],preorden:"PRA-PRE-001",consolidado:"PRA-CON-001"});
    const repetida=await op(a,{...consolidar,revision:v.revision});
    const repetidaVista=await repetida.json();
    expect(repetida.status).toBe(200);
    expect(repetidaVista.documento.eventos).toEqual(v.documento.eventos);
    v=repetidaVista;
    const f = await solicitar(prueba,"facturacion",{espacio:a.vista.espacio},{sesion:a.sesion});
    const fv=await f.json();
    const reset=await solicitar(prueba,"facturacion",{espacio:a.vista.espacio,revision:fv.revision,comando:{accion:"reiniciar",codigo:"espacio"}},{sesion:a.sesion});
    expect(reset.status).toBe(200);
    expect((await op(a,{revision:v.revision,comando})).status).toBe(409);
    const nueva=await (await op(a)).json();
    expect(nueva.documento.generacion).toBe(3);
    expect(nueva.documento.cargas[1].estado).toBe("pendiente");
    expect((await (await op(otra)).json()).documento.generacion).toBe(1);
    usuarios.get(id)!.disabled=true;
    expect((await op(a)).status).toBe(403);
  });

  it("Embarques y VE revalidan cada permiso, revisión y pertenencia al espacio", async () => {
    const id = usuario("admin");
    const cuenta = await entrar(id);
    const otra = await entrar(usuario("admin"));
    const op = (body: object) => frontera(prueba,"china",{espacio:cuenta.vista.espacio,...body},cuenta.sesion,prueba);
    let v = await (await op({modulo:"naviera"})).json();
    const ejecutar = async (modulo: string, accion: string) => {
      const r = await op({modulo,revision:v.revision,comando:{accion,envio:"PRA-EMB-001"}});
      expect(r.status).toBe(200); v = await r.json();
    };
    await ejecutar("naviera","consolidar");
    expect((await op({modulo:"ve",revision:v.revision,comando:{accion:"embarcar",envio:"PRA-EMB-001"}})).status).toBe(403);
    await ejecutar("shipments","embarcar");
    usuarios.get(id)!.role = "warehouse"; usuarios.get(id)!.warehouse_scope = "cn";
    expect((await op({modulo:"ve",revision:v.revision,comando:{accion:"aduana",envio:"PRA-EMB-001"}})).status).toBe(403);
    usuarios.get(id)!.role = "admin";
    await ejecutar("ve","aduana");
    await ejecutar("ve","recibir_ve");
    expect(v.documento.cargas[0]).toMatchObject({estado:"recibida_ve",preorden:"PRA-PRE-001",cliente:"DTD-PRA-001"});
    expect((await op({modulo:"ve",espacio:otra.vista.espacio})).status).toBe(403);
    usuarios.get(id)!.disabled = true;
    expect((await op({modulo:"ve"})).status).toBe(403);
  });

  it.each(["shipments", "ve"])("reinicia con edición exclusiva de %s y deniega consulta", async modulo => {
    const id=usuario("operations"), cuenta=await entrar(id);
    const op=(body: object={})=>frontera(prueba,"china",{espacio:cuenta.vista.espacio,modulo,...body},cuenta.sesion,prueba);
    const ajustar=(edicion:boolean)=>ajustesPorRol.set("operations",["cn","naviera","shipments","ve"].map(m=>({module_id:m,can_view:m===modulo,can_edit:m===modulo && edicion})));
    try {
      ajustar(true);
      let v=await (await op()).json();
      expect(v.permisos).toEqual([{id:modulo,edicion:true,incidenciaDestino:false}]);
      const reinicio=await op({revision:v.revision,comando:{accion:"reiniciar",envio:"espacio"}});
      expect(reinicio.status).toBe(200); v=await reinicio.json();
      expect(v.generacion).toBe(2);
      ajustar(false);
      expect((await (await op()).json()).permisos).toEqual([{id:modulo,edicion:false,incidenciaDestino:false}]);
      expect((await op({revision:v.revision,comando:{accion:"reiniciar",envio:"espacio"}})).status).toBe(403);
    } finally { ajustesPorRol.delete("operations"); }
  });

  it("recarga permisos operativos separados y conserva solo las lecturas autorizadas", async () => {
    const id=usuario("operations"), cuenta=await entrar(id);
    const op=(body: object={})=>frontera(prueba,"china",{espacio:cuenta.vista.espacio,modulo:"cn",...body},cuenta.sesion,prueba);
    const ajustes=(cn:boolean, naviera:boolean, verCn=true)=>ajustesPorRol.set("operations",[{module_id:"cn",can_view:verCn,can_edit:cn},{module_id:"naviera",can_view:true,can_edit:naviera},{module_id:"shipments",can_view:false,can_edit:false},{module_id:"ve",can_view:false,can_edit:false}]);
    try {
      ajustes(false,true);
      let v=await (await op()).json();
      expect(v.permisos).toEqual([{id:"cn",edicion:false,ejercicioCn:false},{id:"naviera",edicion:true}]);
      expect((await op({revision:v.revision,comando:{accion:"recibir",envio:"PRA-EMB-003"}})).status).toBe(403);
      const c=await op({modulo:"naviera",revision:v.revision,comando:{accion:"consolidar",envio:"PRA-EMB-001"}});expect(c.status).toBe(200);
      ajustes(true,false); v=await (await op()).json();
      expect(v.permisos).toEqual([{id:"cn",edicion:true,ejercicioCn:true},{id:"naviera",edicion:false}]);
      expect((await op({modulo:"naviera",revision:v.revision,comando:{accion:"consolidar",envio:"PRA-EMB-001"}})).status).toBe(403);
      expect((await op({revision:v.revision,comando:{accion:"recibir",envio:"PRA-EMB-003"}})).status).toBe(200);
      ajustes(false,false,false); v=await (await op()).json();
      expect(v.permisos).toEqual([{id:"naviera",edicion:false}]);
      expect(v.documento.cargas[1].estado).toBe("recibida");
      expect((await op({revision:v.revision,comando:{accion:"reiniciar",envio:"espacio"}})).status).toBe(403);
      usuarios.get(id)!.disabled=true; expect((await op()).status).toBe(403);
    } finally { ajustesPorRol.delete("operations"); }
  });

  it("admite 20 conceptos de 100 caracteres con UTF-8 y escapes, y limita bytes reales", async () => {
    const cuenta = await entrar(usuario("accounting"));
    let revision = 0;
    for (const concepto of ["中".repeat(100), "\u0001".repeat(100)]) {
      const body = {espacio:cuenta.vista.espacio,revision,comando:{accion:"guardar",codigo:"PRA-PRE-001",lineas:Array.from({length:20},()=>({concepto,cantidad:1,centavos:1}))}};
      const texto = JSON.stringify(body);
      expect(Buffer.byteLength(texto)).toBeGreaterThan(2048);
      const res = await solicitar(prueba,"facturacion",body,{sesion:cuenta.sesion,texto,headers:{"Content-Length":"1"}});
      expect(res.status).toBe(200);
      const datos = await res.json();
      expect(datos.documento.facturas[0].lineas).toHaveLength(20);
      expect(datos.documento.facturas[0].lineas[0].concepto).toBe(concepto);
      revision = datos.revision;
    }
    const grande = JSON.stringify({espacio:cuenta.vista.espacio,relleno:"x".repeat(24576)});
    const res = await solicitar(prueba,"facturacion",{}, {sesion:cuenta.sesion,texto:grande,headers:{"Content-Length":"1"}});
    expect(res.status).toBe(413);
    expect((await res.json()).error).toContain("tus cambios siguen en el editor");
    expect((await solicitar(prueba,"estado",{}, {sesion:cuenta.sesion,texto:JSON.stringify({relleno:"x".repeat(2048)})})).status).toBe(413);
  });

  it("ejercicio CN: lookup sin escrituras, compatibilidad histórica, replay CAS y proyección por rol sin datos internos", async()=>{
    const id=usuario("warehouse","all","cn"), a=await entrar(id);
    const op=(body:object={})=>frontera(prueba,"china",{espacio:a.vista.espacio,modulo:"cn",...body},a.sesion,prueba);
    const huella=createHash("sha256").update(a.sesion).digest("hex");
    const leerSql=async()=> (await db.query<{valor:{revision:number;documento:unknown}}>("select public.practica_china($1,$2) as valor",[destino.PRACTICA_DATOS_INSTANCIA,huella])).rows[0].valor;
    const consulta=await op({consulta:"DTD-B-99007131"});expect(consulta.status).toBe(200);
    expect((await leerSql()).documento).toBeNull();
    let vista=await (await op()).json();
    // Documento viejo sin campo aditivo: una lectura no modifica su revisión ni su JSON.
    const legado=structuredClone(vista.documento); delete legado.ejercicio;
    const legadoGuardado=(await db.query<{valor:{revision:number}}>("select public.practica_china($1,$2,$3,$4::jsonb) as valor",[destino.PRACTICA_DATOS_INSTANCIA,huella,vista.revision,JSON.stringify(legado)])).rows[0].valor;
    vista=await (await op()).json();expect(vista.revision).toBe(legadoGuardado.revision);
    expect((await leerSql()).documento).toEqual(legado);
    const ejecutar=async(operacion:object,revision=vista.revision)=>{
      const res=await op({revision,comando:{accion:"ejercicio",envio:"PRA-COMPRA-CHINA-001",operacion}});
      if(res.ok) vista=await res.json(); return res;
    };
    const recibir={id:randomUUID(),accion:"recibir",codigo:"DTD-B-99007131",cantidad:3};
    const previa=vista.revision;expect((await ejecutar(recibir)).status).toBe(200);
    const eventos=vista.documento.ejercicio.eventos.length;
    expect((await ejecutar(recibir,previa)).status).toBe(200);
    expect(vista.documento.ejercicio.eventos).toHaveLength(eventos);
    expect(vista.documento.cargas).toEqual(legado.cargas);
    const recepcion=vista.documento.ejercicio.recepciones[0].id;
    for(const operacion of [{id:randomUUID(),accion:"fragil",recepcion,activo:true,motivo:"Vidrio ficticio"},{id:randomUUID(),accion:"marca",recepcion,motivo:"Falta carta de muestra"},{id:randomUUID(),accion:"cargar",codigo:"DTD-B-99007131",cantidad:2,consolidado:"PRA-CON-CN-A",ancho:1}]) expect((await ejecutar(operacion)).status).toBe(200);
    // JSONB puede reordenar claves: un replay semántico no vuelve a mutar.
    const fragil=vista.documento.ejercicio.eventos.find((e:{comando:{accion:string}})=>e.comando.accion==="fragil").comando;
    const revisionPersistida=vista.revision;
    expect((await ejecutar({motivo:fragil.motivo,activo:fragil.activo,recepcion:fragil.recepcion,accion:fragil.accion,id:fragil.id},previa)).status).toBe(200);
    expect(vista.revision).toBe(revisionPersistida);
    expect((await ejecutar({...fragil,motivo:"Otro motivo ficticio"},previa)).status).toBe(409);
    const estiba=vista.documento.ejercicio.eventos.find((e:{comando:{accion:string}})=>e.comando.accion==="cargar").comando;
    expect((await ejecutar({ancho:estiba.ancho,consolidado:estiba.consolidado,cantidad:estiba.cantidad,codigo:estiba.codigo,accion:estiba.accion,id:estiba.id},previa)).status).toBe(200);
    expect(vista.revision).toBe(revisionPersistida);
    expect((await ejecutar({...estiba,cantidad:1},previa)).status).toBe(409);
    usuarios.get(id)!.region="ve";
    const ve=await op({etapa:"ve",consolidado:"PRA-CON-CN-A"});expect(ve.status).toBe(200);
    const vv=await ve.json(); expect(vv.incidenciaDestino).toBe(true);
    expect(vv.cajas.map((c:{indicadores:{codigo:string}[]})=>c.indicadores.map(i=>i.codigo))).toEqual([["fragil"],["fragil"]]);
    expect(JSON.stringify(vv)).not.toMatch(/tareas|evidencia|eventos|resolucion|ejercicio|marca_sin_autorizacion/);
    const emb=await (await op({etapa:"shipments",consolidado:"PRA-CON-CN-A"})).json();
    expect(emb.cajas[0].indicadores.map((i:{codigo:string})=>i.codigo)).toEqual(["fragil","marca_sin_autorizacion"]);
    expect(JSON.stringify(emb)).not.toMatch(/tareas|evidencia|eventos|resolucion|ejercicio/);
    expect((await ejecutar({id:randomUUID(),accion:"fragil",recepcion,activo:false,motivo:"Intento desde VE"})).status).toBe(403);
    delete usuarios.get(id)!.region;
    expect((await (await op({etapa:"ve",consolidado:"PRA-CON-CN-A"})).json()).incidenciaDestino).toBe(false);
    expect((await ejecutar({id:randomUUID(),accion:"recibir",codigo:"DTD-B-99007134",cantidad:1})).status).toBe(403);
    usuarios.get(id)!.role="accounting";
    expect((await op()).status).toBe(200); // Lectura operativa por naviera; no operaciones CN.
    expect((await op({etapa:"shipments",consolidado:"PRA-CON-CN-A"})).status).toBe(200);
    usuarios.get(id)!.disabled=true;
    expect((await op({etapa:"ve",consolidado:"PRA-CON-CN-A"})).status).toBe(403);
  });

  // Corrida de navegador explícita; CI unitario no instala Chromium. Se reporta el SKIP.
  it.skipIf(process.env.PRACTICA_NAVEGADOR !== "1")("recorrido persistido de pantalla a 390 y 1280 px, sin efectos externos", async () => {
    const require = createRequire(import.meta.url);
    const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");
    const { chromium, expect: esperar } = await import("@playwright/test");
    const paquete = await build({ stdin:{ contents:`import {useState} from 'react'; import {EntradaPractica} from './app/studio/_components/wiring/EntradaPractica'; import {createRoot} from 'react-dom/client'; import {PracticaPersonal} from './app/studio/practica/PracticaPersonal'; import './app/studio/tokens.css'; import './app/studio/studio.css'; function Perfil(){const [abierto,setAbierto]=useState(false);return <><button onClick={()=>setAbierto(true)}>Mi perfil</button>{abierto && <EntradaPractica origen='${prueba}'/>}</>}; createRoot(document.getElementById('app')).render(location.origin==='${real}'?<Perfil/>:<PracticaPersonal real='${real}'/>);`, loader:"tsx", resolveDir:process.cwd() }, jsx:"automatic", bundle:true, write:false, outdir:"salida", define:{"process.env.NODE_ENV":'"production"',"process.env":'{}'} });
    const js = paquete.outputFiles.find((f: {path:string}) => f.path.endsWith(".js")).text;
    const globales = readFileSync("app/globals.css","utf8");
    const tipografia = globales.slice(globales.indexOf(".portal-sys,"),globales.indexOf("/* Números de la calculadora"));
    const fuentes = `@font-face {font-family:Nunito;src:url(/nunito.woff2)} @font-face {font-family:Sora;src:url(/sora.woff2)} :root{--font-nunito:Nunito;--font-sora:Sora} *{box-sizing:border-box} body{margin:0} button,input,select{font:inherit}`;
    const css = fuentes + tipografia + paquete.outputFiles.find((f: {path:string}) => f.path.endsWith(".css")).text;
    const browser = await chromium.launch({ executablePath:process.env.PRACTICA_CHROMIUM || chromium.executablePath(), headless:true });
    const carpeta = resolve(tmpdir(), process.env.PRACTICA_EVIDENCIA || "sdd-0713-fase-3"); mkdirSync(carpeta, { recursive:true });
    const matriz: string[] = [];
    try {
      for (const width of [390,1280]) for (const tema of ["light","dark"]) {
        const cuentaId = usuario("warehouse", "cn");
        let confirmarCuenta: (cuenta: Awaited<ReturnType<typeof entrar>>) => void = () => { throw new Error("El ensayo no preparó el receptor del canje."); };
        const cuentaCanjeada = new Promise<Awaited<ReturnType<typeof entrar>>>(resolver => { confirmarCuenta = resolver; });
        let sesionActual = "";
        let demorarEstado = false;
        let liberarEstados: (() => void)[] = [];
        let lecturasFactura = 0;
        let escriturasFactura = 0;
        let falloEstado: "503" | "red" | "invalida" | null = null;
        let falloCierre = false;
        let rechazarEscritura = false;
        let retenerUna = false;
        const pendientesEstado: (() => void)[] = [];
        const sufijo = tema === "light" ? "" : "-dark";
        const contextoBrowser = await browser.newContext({ viewport:{width,height:900}, hasTouch:width===390, isMobile:width===390, serviceWorkers:"block" });
        const inesperadas: string[] = [];
        let demora: {accion:string; avisar:()=>void; esperar:Promise<void>} | undefined;
        const demorar=(accion:string)=>{
          let avisar!:()=>void, liberar!:()=>void;
          const observada=new Promise<void>(r=>{avisar=r;});
          const esperar=new Promise<void>(r=>{liberar=r;});
          demora={accion,avisar,esperar}; return {observada,liberar};
        };
        let salidas=0;
        let perderRespuestaEjercicio=false;
        let perderRespuestaDestino=false;
        await contextoBrowser.addInitScript(tema => {
          const aplicar = () => { document.documentElement.dataset.theme = tema; };
          if (document.documentElement) aplicar(); else document.addEventListener("DOMContentLoaded",aplicar,{once:true});
        },tema);
        await contextoBrowser.route("**/*", async ruta => {
          const req = ruta.request(), u = new URL(req.url());
          if ([real,prueba].includes(u.origin) && u.pathname === "/app.js") return ruta.fulfill({contentType:"application/javascript",body:js});
          if ([real,prueba].includes(u.origin) && u.pathname === "/app.css") return ruta.fulfill({contentType:"text/css",body:css});
          if (u.origin === prueba && ["/nunito.woff2","/sora.woff2"].includes(u.pathname)) return ruta.fulfill({contentType:"font/woff2",body:readFileSync(u.pathname === "/nunito.woff2" ? "lib/font-files/nunito-sans-latin-wght.woff2" : "lib/font-files/sora-latin-wght.woff2")});
          if (u.origin === prueba && u.pathname === "/studio/practica" && config.rutaDelReceptor(u.pathname,req.method(),false)) return ruta.fulfill({contentType:"text/html",body:'<html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body class="studio-sys"><div id="app"></div><script src="/app.js"></script></body></html>'});
          if (u.origin === real && u.pathname === "/studio/perfil") return ruta.fulfill({contentType:"text/html",body:'<html><body><div id="app"></div><script src="/app.js"></script></body></html>'});
          if (u.origin === real && u.pathname === API_PRACTICA + "emitir") {
            const r = await solicitar(real,"emitir",{}, {usuario:cuentaId});
            return ruta.fulfill({status:r.status,json:await r.json()});
          }
          if (u.origin === prueba && u.pathname === API_PRACTICA + "canjear") {
            const r = await solicitar(prueba,"canjear",req.postDataJSON());
            const vista = await r.json();
            const cookie = r.cookies.get(COOKIE_PRACTICA);
            if (r.status !== 200 || !cookie || !vista.espacio) throw new Error("El canje no confirmó una sesión de práctica.");
            sesionActual = cookie.value;
            confirmarCuenta({pase:req.postDataJSON().pase,sesion:cookie.value,vista});
            return ruta.fulfill({status:r.status,json:vista});
          }
          if (u.origin === prueba && config.rutaDelReceptor(u.pathname,req.method(),!!req.headers()["next-action"])) {
            if (u.pathname === API_PRACTICA+"salir" && falloCierre) return ruta.abort("failed");
            if (u.pathname === API_PRACTICA+"estado") {
              if (falloEstado === "red") return ruta.abort("failed");
              if (falloEstado === "503") return ruta.fulfill({status:503,json:null});
              if (falloEstado === "invalida") return ruta.fulfill({status:200,json:{espacio:req.postDataJSON().espacio,permisos:"inválidos"}});
            }
            if (u.pathname === API_PRACTICA+"facturacion" && req.postDataJSON().comando && rechazarEscritura) return ruta.fulfill({status:413,contentType:"text/plain",body:"Request Entity Too Large"});
            if (u.pathname === API_PRACTICA+"estado" && demorarEstado) await new Promise<void>(resolver => liberarEstados.push(resolver));
            if (u.pathname === API_PRACTICA+"facturacion") {
              if (req.postDataJSON().comando) escriturasFactura++; else lecturasFactura++;
            }
            const res = await frontera(prueba,u.pathname.slice(API_PRACTICA.length),req.postDataJSON(),sesionActual,req.headers().origin);
            if (u.pathname.endsWith("/salir")) salidas++;
            if (demora && (req.postDataJSON()?.comando?.accion ?? req.postDataJSON()?.destino?.accion) === demora.accion) {
              const actual=demora; demora=undefined; actual.avisar(); await actual.esperar;
            }
            if (u.pathname === API_PRACTICA+"estado" && retenerUna) {
              retenerUna = false;
              await new Promise<void>(resolver => { pendientesEstado.push(resolver); });
            }
            if(u.pathname === API_PRACTICA+"canjear") sesionActual=res.cookies.get(COOKIE_PRACTICA)?.value ?? sesionActual;
            if(perderRespuestaEjercicio && req.postDataJSON()?.comando?.accion==="ejercicio") {perderRespuestaEjercicio=false;return ruta.abort("failed");}
            if(perderRespuestaDestino && req.postDataJSON()?.destino) {perderRespuestaDestino=false;return ruta.abort("failed");}
            return ruta.fulfill({status:res.status,json:await res.json()});
          }
          if (u.origin === real && u.pathname === "/studio/dashboard") return ruta.fulfill({contentType:"text/html",body:"<h1>Studio real de muestra</h1>"});
          inesperadas.push(req.method()+" "+req.url()); return ruta.abort();
        });
        try {
          const perfil = await contextoBrowser.newPage();
          await perfil.goto(real + "/studio/perfil");
          await perfil.getByRole("button",{name:"Mi perfil",exact:true}).click();
          const apertura = perfil.waitForEvent("popup");
          await perfil.getByRole("button",{name:"Entrar a modo de prueba",exact:true}).click();
          const p = await apertura;
          const cuenta = await cuentaCanjeada;
          p.on("pageerror", e => console.error("Error de pantalla", e.message));
          await esperar(p.getByRole("heading",{name:"Permisos de tu pr\u00e1ctica"})).toBeVisible();
          await esperar(p.getByRole("heading",{name:"Almacén China y Consolidado de práctica"})).toBeVisible();
          await esperar(p.getByRole("heading",{name:"Facturación de práctica",exact:true})).toHaveCount(0);
          const ejercicio=p.getByRole("region",{name:"China de principio a fin",exact:true});
          await esperar(ejercicio).toBeVisible();
          const revisionInicial=(await (await solicitar(prueba,"china",{espacio:cuenta.vista.espacio,modulo:"cn"},{sesion:sesionActual})).json()).revision;
          await ejercicio.getByText("Etiqueta de práctica y ayuda para el lector",{exact:true}).click();
          const pngQr=await ejercicio.getByRole("img",{name:"QR de caja inventada",exact:true}).screenshot();
          const rawQr=await sharp(pngQr).ensureAlpha().raw().toBuffer({resolveWithObject:true});
          const decodificado=jsQR(new Uint8ClampedArray(rawQr.data),rawQr.info.width,rawQr.info.height);
          expect(decodificado?.data).toBe("DTD-B-99007131");
          const entradaCodigo=ejercicio.getByLabel("Código de etiqueta de práctica",{exact:true});
          await ejercicio.getByRole("button",{name:"Enfocar lector de teclado",exact:true}).click();
          await entradaCodigo.pressSequentially(decodificado!.data); await entradaCodigo.press("Enter");
          await esperar(ejercicio.getByText(/4 pendientes de llegada/)).toBeVisible();
          await ejercicio.getByLabel("Cajas que llegaron",{exact:true}).fill("3");
          await ejercicio.getByRole("button",{name:"Cancelar consulta sin recibir",exact:true}).click();
          await esperar(ejercicio.getByRole("status",{name:"Resumen de cajas",exact:true})).toContainText("4 por llegar · 0 disponibles");
          expect((await (await solicitar(prueba,"china",{espacio:cuenta.vista.espacio,modulo:"cn"},{sesion:sesionActual})).json()).revision).toBe(revisionInicial);
          await entradaCodigo.fill("DTD-B-99999999"); await entradaCodigo.press("Enter");
          await esperar(p.getByRole("alert")).toContainText("Código desconocido");
          await entradaCodigo.fill("https://etiqueta.example.test/verificar?c=DTD-PRA-CHINA&n=1/4"); await entradaCodigo.press("Enter");
          await esperar(p.getByRole("alert")).toContainText("proveedor");
          // La vía manual consulta el mismo caso y confirma la cantidad rectificada.
          await entradaCodigo.fill("DTD-B-99007131"); await ejercicio.getByRole("button",{name:"Consultar etiqueta de práctica",exact:true}).click();
          await ejercicio.getByLabel("Cajas que llegaron",{exact:true}).fill("3");
          await ejercicio.getByRole("button",{name:"Confirmar recepción de práctica",exact:true}).click();
          await esperar(ejercicio.getByText(/^Recibo PRA-REC-CN-001: 3 cajas/)).toBeVisible();
          await esperar(ejercicio.getByRole("status",{name:"Resumen de cajas",exact:true})).toContainText("1 por llegar · 3 disponibles");
          const consultaRepetida=(await (await solicitar(prueba,"china",{espacio:cuenta.vista.espacio,modulo:"cn"},{sesion:sesionActual})).json()).revision;
          await entradaCodigo.press("Enter"); await esperar(ejercicio.getByText(/Esta caja ya fue recibida/)).toBeVisible();
          expect((await (await solicitar(prueba,"china",{espacio:cuenta.vista.espacio,modulo:"cn"},{sesion:sesionActual})).json()).revision).toBe(consultaRepetida);
          await ejercicio.getByLabel("Motivo inventado del indicador",{exact:true}).fill("Vidrio inventado en recepción uno");
          perderRespuestaEjercicio=true;
          await ejercicio.getByRole("button",{name:"Aplicar Frágil de práctica",exact:true}).click();
          await ejercicio.getByRole("button",{name:"Reintentar la misma operación",exact:true}).click();
          await esperar(ejercicio.getByText("Frágil / 易碎 · CN · Sin cobro",{exact:true})).toBeVisible();
          await ejercicio.getByLabel("Motivo inventado del indicador",{exact:true}).fill("Falta carta inventada de autorización");
          await ejercicio.getByRole("button",{name:"Registrar Marca sin autorización de práctica",exact:true}).click();
          await esperar(ejercicio.getByText("Recepción PRA-REC-CN-001 · Estado: pendiente",{exact:true})).toBeVisible();
          await ejercicio.getByLabel("Cajas a montar",{exact:true}).fill("2");
          await ejercicio.getByRole("button",{name:"Confirmar carga del lote",exact:true}).click();
          await esperar(ejercicio.getByRole("status",{name:"Resumen de cajas",exact:true})).toContainText("1 por llegar · 1 disponibles en China · 2 en A · 0 en B");
          await entradaCodigo.fill("DTD-B-99007134"); await entradaCodigo.press("Enter");
          await ejercicio.getByLabel("Cajas que llegaron",{exact:true}).fill("1");
          await ejercicio.getByRole("button",{name:"Confirmar recepción de práctica",exact:true}).click();
          await esperar(ejercicio.getByText(/^Recibo PRA-REC-CN-002: 1 cajas/)).toBeVisible();
          await entradaCodigo.fill("DTD-B-99007133"); await entradaCodigo.press("Enter");
          await ejercicio.getByLabel("Consolidado de práctica",{exact:true}).selectOption("PRA-CON-CN-B");
          await ejercicio.getByLabel("Cajas a montar",{exact:true}).fill("2");
          await ejercicio.getByLabel("Posición al ancho",{exact:true}).selectOption("2");
          await ejercicio.getByRole("button",{name:"Confirmar carga del lote",exact:true}).click();
          await esperar(ejercicio.getByRole("status",{name:"Resumen de cajas",exact:true})).toContainText("0 por llegar · 0 disponibles en China · 2 en A · 2 en B");
          await entradaCodigo.press("Enter");
          await esperar(ejercicio.getByRole("button",{name:"Confirmar carga del lote",exact:true})).toBeDisabled();
          usuarios.get(cuentaId)!.warehouse_scope="all"; usuarios.get(cuentaId)!.region="ve";
          const origenB=await (await solicitar(prueba,"china",{espacio:cuenta.vista.espacio,etapa:"ve",consolidado:"PRA-CON-CN-B"},{sesion:sesionActual})).json();
          expect(origenB.cajas.map((c:{recepcion:string;indicadores:unknown[]})=>[c.recepcion,c.indicadores.length])).toEqual([["PRA-REC-CN-001",1],["PRA-REC-CN-002",0]]);
          expect(JSON.stringify(origenB)).not.toMatch(/tareas|evidencia|eventos|resolucion|ejercicio/);
          usuarios.get(cuentaId)!.warehouse_scope="cn"; usuarios.get(cuentaId)!.region="cn";
          await ejercicio.getByRole("button",{name:"Tomar tarea documental de práctica",exact:true}).click();
          await ejercicio.getByLabel("Evidencia documental de muestra",{exact:true}).selectOption("PRA-CARTA-001");
          await ejercicio.getByLabel("Resolución interna inventada",{exact:true}).fill("Oficina revisó la carta sintética de autorización");
          await ejercicio.getByRole("button",{name:"Resolver tarea documental de práctica",exact:true}).click();
          await esperar(ejercicio.getByText(/Evidencia: PRA-CARTA-001/)).toBeVisible();
          await p.screenshot({path:resolve(carpeta,`china-completa-${width}${sufijo}.png`),fullPage:true});
          // El mismo ejercicio continúa en destino sin copiar cajas ni documentos.
          usuarios.get(cuentaId)!.role="admin";
          const finAntesDestino=await (await solicitar(prueba,"facturacion",{espacio:cuenta.vista.espacio},{sesion:sesionActual})).json();
          usuarios.get(cuentaId)!.role="operations";usuarios.get(cuentaId)!.region="ve";usuarios.get(cuentaId)!.warehouse_scope="all";
          const vistaDestino=p.getByRole("region",{name:"Viajes parciales y recepción física de práctica",exact:true});
          await vistaDestino.getByRole("button",{name:"Recargar destino y permisos",exact:true}).click();
          const etapaDestino=vistaDestino.getByLabel("Vista de destino",{exact:true});
          const parcialDestino=vistaDestino.getByLabel("Consolidado de destino",{exact:true});
          const estadoDestino=vistaDestino.getByRole("status",{name:"Estado del viaje",exact:true});
          await esperar(vistaDestino.getByRole("list",{name:"Cajas del viaje",exact:true}).getByRole("listitem")).toHaveCount(2);
          await esperar(vistaDestino.getByText("Frágil / 易碎 · CN",{exact:true})).toHaveCount(2);
          await vistaDestino.getByRole("button",{name:"Embarcar este parcial de práctica",exact:true}).click();
          await esperar(estadoDestino).toContainText("En tránsito");
          await etapaDestino.selectOption("ve");
          await vistaDestino.getByRole("button",{name:"Registrar llegada física de este parcial",exact:true}).click();
          await esperar(estadoDestino).toContainText("Llegada física registrada");
          await vistaDestino.getByRole("button",{name:"Registrar observación aduanal ficticia",exact:true}).click();
          await p.getByLabel("Motivo ficticio de destino",{exact:true}).fill("Observación aduanal de muestra en destino");
          await p.getByRole("button",{name:"Confirmar observación ficticia",exact:true}).click();
          await esperar(vistaDestino.getByText("Observación de destino: pendiente.",{exact:true})).toBeVisible();
          await esperar(vistaDestino.getByLabel("Código DTD-B en destino",{exact:true})).toBeDisabled();
          // La carta China ya estaba resuelta; eso no resolvió la observación VE.
          usuarios.get(cuentaId)!.role="warehouse";usuarios.get(cuentaId)!.region="cn";
          await vistaDestino.getByRole("button",{name:"Recargar destino y permisos",exact:true}).click();
          await esperar(vistaDestino.getByRole("button",{name:"Resolver observación ficticia de destino",exact:true})).toHaveCount(0);
          const denegada=await solicitar(prueba,"china",{espacio:cuenta.vista.espacio,etapa:"ve",consolidado:CONSOLIDADOS_CHINA[0],revision:0,
            destino:{id:randomUUID(),accion:"resolver_incidencia",consolidado:CONSOLIDADOS_CHINA[0],motivo:"Intento ficticio sin capacidad"}},{sesion:sesionActual});
          expect(denegada.status).toBe(403);
          usuarios.get(cuentaId)!.role="operations";usuarios.get(cuentaId)!.region="ve";
          await vistaDestino.getByRole("button",{name:"Recargar destino y permisos",exact:true}).click();
          await vistaDestino.getByRole("button",{name:"Resolver observación ficticia de destino",exact:true}).click();
          await p.getByLabel("Motivo ficticio de destino",{exact:true}).fill("Revisión logística inventada completada");
          await p.getByRole("button",{name:"Confirmar resolución ficticia",exact:true}).click();
          await esperar(vistaDestino.getByText("Observación de destino: resuelta.",{exact:true})).toBeVisible();
          const leerCajaDestino=async(codigo:string,esperarConfirmacion=true)=>{
            const input=vistaDestino.getByLabel("Código DTD-B en destino",{exact:true});await input.fill(codigo);await input.press("Enter");
            if (esperarConfirmacion) await esperar(input).toHaveValue("");
          };
          await leerCajaDestino(CODIGOS_CHINA[0]);await esperar(estadoDestino).toContainText("1 de 2 cajas");
          await leerCajaDestino(CODIGOS_CHINA[0]);await esperar(estadoDestino).toContainText("1 de 2 cajas");
          const destinoDemorado=demorar("recibir_caja");
          await leerCajaDestino(CODIGOS_CHINA[1],false);await destinoDemorado.observada;
          const salidaDestino=p.getByRole("button",{name:"Volver al Studio real",exact:true});
          await esperar(salidaDestino).toBeDisabled();await salidaDestino.evaluate((el:HTMLButtonElement)=>el.click());expect(salidas).toBe(0);
          destinoDemorado.liberar();await esperar(salidaDestino).toBeEnabled();
          await esperar(estadoDestino).toContainText("Recepción física completa · Recepción física: 2 de 2 cajas");
          await parcialDestino.selectOption(CONSOLIDADOS_CHINA[1]);
          await esperar(vistaDestino.getByRole("heading",{name:`${CONSOLIDADOS_CHINA[1]} · Recepción física VE`,exact:true})).toBeVisible();
          await esperar(estadoDestino).toHaveCount(0);
          const cajasB=vistaDestino.getByRole("list",{name:"Cajas del viaje",exact:true}).getByRole("listitem");
          await esperar(cajasB).toHaveCount(2);await esperar(cajasB.nth(0)).toContainText(CODIGOS_CHINA[2]);
          await esperar(cajasB.nth(0)).toContainText("Frágil / 易碎");await esperar(cajasB.nth(1)).not.toContainText("Frágil");
          const payloadVe=await (await solicitar(prueba,"china",{espacio:cuenta.vista.espacio,etapa:"ve",consolidado:CONSOLIDADOS_CHINA[1]},{sesion:sesionActual})).json();
          expect(JSON.stringify(payloadVe)).not.toMatch(/tareas|evidencia|eventos|resolucion|ejercicio|marca_sin_autorizacion/);
          await p.reload();await etapaDestino.selectOption("ve");
          await esperar(estadoDestino).toContainText("2 de 2 cajas");
          await parcialDestino.selectOption(CONSOLIDADOS_CHINA[1]);await etapaDestino.selectOption("shipments");
          await vistaDestino.getByRole("button",{name:"Embarcar este parcial de práctica",exact:true}).click();await esperar(estadoDestino).toContainText("En tránsito");
          await etapaDestino.selectOption("ve");await vistaDestino.getByRole("button",{name:"Registrar llegada física de este parcial",exact:true}).click();
          await esperar(estadoDestino).toContainText("Llegada física registrada");
          perderRespuestaDestino=true;
          await leerCajaDestino(CODIGOS_CHINA[2],false);
          await vistaDestino.getByRole("button",{name:"Reintentar la misma operación de destino",exact:true}).click();
          await esperar(estadoDestino).toContainText("1 de 2 cajas");
          await parcialDestino.selectOption(CONSOLIDADOS_CHINA[0]);await esperar(estadoDestino).toContainText("2 de 2 cajas");
          await leerCajaDestino(CODIGOS_CHINA[0]);await esperar(estadoDestino).toContainText("2 de 2 cajas");
          await parcialDestino.selectOption(CONSOLIDADOS_CHINA[1]);await esperar(estadoDestino).toContainText("1 de 2 cajas");
          await leerCajaDestino(CODIGOS_CHINA[3]);await esperar(estadoDestino).toContainText("Recepción física completa · Recepción física: 2 de 2 cajas");
          await p.screenshot({path:resolve(carpeta,`destino-parciales-${width}${sufijo}.png`),fullPage:true});
          usuarios.get(cuentaId)!.role="admin";
          expect((await (await solicitar(prueba,"facturacion",{espacio:cuenta.vista.espacio},{sesion:sesionActual})).json()).documento).toEqual(finAntesDestino.documento);
          usuarios.get(cuentaId)!.role="warehouse";usuarios.get(cuentaId)!.region="cn";usuarios.get(cuentaId)!.warehouse_scope="cn";
          await p.getByRole("button",{name:"Recargar cargas y permisos",exact:true}).click();
          await ejercicio.getByLabel("Recepción para indicadores",{exact:true}).selectOption("PRA-REC-CN-001");
          await ejercicio.getByLabel("Motivo inventado del indicador",{exact:true}).fill("Corrección inventada sin cobro");
          await ejercicio.getByRole("button",{name:"Retirar Frágil de práctica",exact:true}).click();
          await p.reload();
          await esperar(ejercicio.getByRole("status",{name:"Resumen de cajas",exact:true})).toContainText("0 por llegar · 0 disponibles en China · 2 en A · 2 en B");
          await esperar(ejercicio.getByText(/Evidencia: PRA-CARTA-001/)).toBeVisible();
          const recepcionDemorada=demorar("recibir");
          await p.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true}).click();
          await recepcionDemorada.observada;
          const salida=p.getByRole("button",{name:"Volver al Studio real",exact:true});
          await esperar(salida).toBeDisabled();
          await salida.evaluate((el:HTMLButtonElement)=>el.click());
          expect(salidas).toBe(0);
          await esperar(p.getByRole("status").filter({hasText:"Guardando o consultando"})).toBeVisible();
          recepcionDemorada.liberar();
          await esperar(salida).toBeEnabled();
          await esperar(p.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true})).toBeDisabled();
          await p.reload();
          const avanzada=p.locator("fieldset").filter({has:p.locator("legend",{hasText:"PRA-EMB-001"})});
          await esperar(p.locator("fieldset").filter({has:p.locator("legend",{hasText:"PRA-EMB-003"})})).toContainText("Estado: recibida");
          await esperar(avanzada).toContainText("Estado: recibida");
          await p.getByLabel("Ayuda: recibir en China",{exact:true}).focus();
          await p.getByLabel("Ayuda: recibir en China",{exact:true}).press("Enter");
          await esperar(p.locator('details:has(summary[aria-label="Ayuda: recibir en China"])')).toHaveAttribute("open", "");
          await p.screenshot({path:resolve(carpeta,`china-almacen-${width}${sufijo}.png`),fullPage:true});
          // Una pestaña independiente también entra por el perfil: no recibe
          // sessionStorage precargado ni toma prestada la identidad de otra.
          const segundaApertura = perfil.waitForEvent("popup");
          await perfil.getByRole("button",{name:"Entrar a modo de prueba",exact:true}).click();
          const otraPestana = await segundaApertura;
          await esperar(otraPestana.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true})).toBeDisabled();
          await p.getByRole("button",{name:"Reiniciar mi práctica",exact:true}).click();
          await p.getByRole("button",{name:"Cancelar",exact:true}).click();
          await p.reload();
          await esperar(p.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true})).toBeDisabled();
          await p.getByRole("button",{name:"Reiniciar mi práctica",exact:true}).click();
          const reinicioDemorado=demorar("reiniciar");
          await p.getByRole("button",{name:"Confirmar reiniciar",exact:true}).click();
          await reinicioDemorado.observada; await esperar(salida).toBeDisabled();
          reinicioDemorado.liberar(); await esperar(salida).toBeEnabled();
          await esperar(p.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true})).toBeEnabled();
          await esperar(ejercicio.getByRole("status",{name:"Resumen de cajas",exact:true})).toContainText("4 por llegar · 0 disponibles");
          // La pestaña anterior conserva su revisión; el servidor rechaza su escritura.
          await otraPestana.getByRole("button",{name:"Recibir PRA-EMB-004",exact:true}).click();
          await esperar(otraPestana.getByRole("alert")).toContainText("La práctica cambió");
          await otraPestana.reload();
          await esperar(otraPestana.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true})).toBeEnabled();
          await otraPestana.close();
          await p.screenshot({path:resolve(carpeta,`reinicio-almacen-${width}${sufijo}.png`),fullPage:true});
          usuarios.get(cuentaId)!.role="support";
          await p.getByRole("button",{name:"Recargar cargas y permisos",exact:true}).click();
          await esperar(p.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true})).toHaveCount(0);
          await esperar(p.getByRole("button",{name:"Identificar con marca ficticia",exact:true})).toHaveCount(0);
          await esperar(p.getByRole("button",{name:"Reiniciar mi práctica",exact:true})).toHaveCount(0);
          await esperar(avanzada).toContainText("PRA-CAJA-001, PRA-CAJA-002");
          usuarios.get(cuentaId)!.role="admin";
          await p.reload();
          const consolidacionDemorada=demorar("consolidar");
          await p.getByRole("button",{name:"Consolidar PRA-EMB-001",exact:true}).click();
          await consolidacionDemorada.observada; await esperar(salida).toBeDisabled();
          consolidacionDemorada.liberar(); await esperar(salida).toBeEnabled();
          await esperar(avanzada).toContainText("PRA-CON-001");
          await p.getByRole("button",{name:"Recibir PRA-EMB-004",exact:true}).click();
          const identificacionDemorada=demorar("identificar");
          await p.getByRole("button",{name:"Identificar con marca ficticia",exact:true}).click();
          await identificacionDemorada.observada; await esperar(salida).toBeDisabled();
          identificacionDemorada.liberar(); await esperar(salida).toBeEnabled();
          await p.getByRole("button",{name:"Consolidar PRA-EMB-004",exact:true}).click();
          await p.reload();
          await esperar(avanzada).toContainText("PRA-CAJA-001, PRA-CAJA-002");
          await esperar(avanzada).toContainText("Estado: consolidada");
          for (const funcion of ["Embarcar","Facturar desde Embarques","Llegada a aduana","Recibir en Venezuela","Recepción Venezuela"]) {
            const ayuda = p.getByLabel(`Ayuda: ${funcion}`,{exact:true});
            await ayuda.focus(); await ayuda.press("Enter");
            await esperar(ayuda.locator("..")).toHaveAttribute("open", "");
            if (funcion === "Recepción Venezuela") await esperar(p.getByText(/Faro no está habilitado/)).toBeVisible();
            await ayuda.press("Enter");
            if (width === 390) { await ayuda.tap(); await esperar(ayuda.locator("..")).toHaveAttribute("open", ""); await ayuda.tap(); }
          }
          await avanzada.getByRole("button",{name:"Embarcar PRA-EMB-001",exact:true}).click();
          await esperar(avanzada).toContainText("Estado: embarcada");
          await avanzada.getByRole("button",{name:"Registrar llegada a aduana",exact:true}).click();
          await esperar(avanzada).toContainText("Estado: en_aduana");
          const venezuelaDemorada=demorar("recibir_ve");
          await avanzada.getByRole("button",{name:/Confirmar liberaci/}).click();
          await venezuelaDemorada.observada;
          await esperar(salida).toBeDisabled();
          await salida.evaluate((el:HTMLButtonElement)=>el.click()); expect(salidas).toBe(0);
          venezuelaDemorada.liberar(); await esperar(salida).toBeEnabled();
          await esperar(avanzada).toContainText("Estado: recibida_ve");
          await p.reload();
          await esperar(avanzada).toContainText("Estado: recibida_ve");

          await p.screenshot({path:resolve(carpeta,`consolidado-${width}${sufijo}.png`),fullPage:true});
          await p.getByLabel("Documento",{exact:true}).selectOption("PRA-FAC-002");
          const escriturasAntesFacturar=escriturasFactura;
          await avanzada.getByRole("button",{name:/^Facturar.*PRA-EMB-001/}).click();
          await esperar(p.getByLabel("Documento",{exact:true})).toHaveValue("PRA-PRE-001");
          expect(escriturasFactura).toBe(escriturasAntesFacturar);
          await p.getByLabel("Concepto 1",{exact:true}).fill("Cambio sin guardar ficticio");
          await esperar(p.getByLabel("Concepto 1",{exact:true})).toHaveValue("Cambio sin guardar ficticio");
          await p.getByRole("button",{name:"Revisar PRA-PRE-001 en Facturación",exact:true}).click();
          await esperar(p.getByRole("dialog",{name:"Descartar conceptos sin guardar"})).toBeVisible();
          await esperar(p.getByLabel("Concepto 1",{exact:true})).toHaveValue("Cambio sin guardar ficticio");
          await p.getByRole("button",{name:"Cancelar",exact:true}).click();
          await esperar(p.getByLabel("Concepto 1",{exact:true})).toHaveValue("Cambio sin guardar ficticio");
          await p.getByRole("button",{name:"Revisar PRA-PRE-001 en Facturación",exact:true}).click();
          await p.getByRole("button",{name:"Descartar conceptos",exact:true}).click();
          await esperar(p.getByLabel("Concepto 1",{exact:true})).toHaveValue("Carga propuesta");
          // Dos razones simultáneas: terminar una no libera la otra.
          await p.getByLabel("Concepto 1",{exact:true}).fill("Cambio pendiente simultáneo");
          const simultanea=demorar("recibir");
          await p.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true}).click();
          await simultanea.observada; await esperar(salida).toBeDisabled();
          await p.getByRole("button",{name:"Descartar conceptos sin guardar",exact:true}).click();
          await p.getByRole("button",{name:"Descartar conceptos",exact:true}).click();
          await esperar(salida).toBeDisabled();
          simultanea.liberar(); await esperar(salida).toBeEnabled();
          await p.getByLabel("Concepto 1",{exact:true}).fill("Otro cambio pendiente");
          // Una lectura también mantiene el bloqueo mientras el editor está sucio.
          await p.getByRole("button",{name:"Recargar cargas y permisos",exact:true}).click();
          await esperar(p.getByRole("button",{name:"Recargar cargas y permisos",exact:true})).toBeEnabled();
          await esperar(salida).toBeDisabled();
          await p.getByRole("button",{name:"Descartar conceptos sin guardar",exact:true}).click();
          await p.getByRole("button",{name:"Descartar conceptos",exact:true}).click();
          await esperar(salida).toBeEnabled();
          const guardar = p.getByRole("button",{name:"Guardar conceptos",exact:true});
          await esperar(guardar).toBeEnabled();
          // La selección de una factura distinta tampoco vuelve al valor inicial.
          await p.getByLabel("Documento",{exact:true}).selectOption("PRA-FAC-002");
          const estadoSeleccion = p.waitForResponse(r => r.url().endsWith("/api/practica/estado"));
          await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
          await estadoSeleccion;
          await esperar(p.getByLabel("Documento",{exact:true})).toHaveValue("PRA-FAC-002");
          await p.getByLabel("Documento",{exact:true}).selectOption("PRA-PRE-001");
          await p.getByRole("button",{name:"Repartir USD 300 en tres conceptos",exact:true}).click();
          const conceptoBorrador = p.getByLabel("Concepto 2",{exact:true});
          await conceptoBorrador.fill("Concepto ficticio sin guardar");
          await esperar(conceptoBorrador).toHaveValue("Concepto ficticio sin guardar");
          await conceptoBorrador.focus();
          const lecturasAntes = lecturasFactura;
          demorarEstado = true;
          const otra = await contextoBrowser.newPage(); await otra.goto("about:blank"); await otra.bringToFront(); await p.bringToFront();
          // También fuerza la notificación de retorno en motores headless que no
          // distinguen visibilidad entre pestañas; la petición real queda retenida.
          await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
          await esperar(p.getByText("Comprobando identidad y permisos…",{exact:true})).toBeVisible();
          await esperar(p.getByLabel("Concepto 2",{exact:true})).toBeDisabled();
          demorarEstado = false; liberarEstados.forEach(liberar => liberar()); liberarEstados = [];
          await esperar(p.getByText("Comprobando identidad y permisos…",{exact:true})).toHaveCount(0);
          await esperar(conceptoBorrador).toHaveValue("Concepto ficticio sin guardar");
          await esperar(conceptoBorrador).toBeFocused();
          expect(lecturasFactura).toBe(lecturasAntes);
          await esperar(p.getByLabel("Concepto 3",{exact:true})).toHaveCount(1);
          await otra.close();
          for (const fallo of ["503","red","invalida"] as const) {
            await conceptoBorrador.focus(); falloEstado = fallo;
            await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
            const reintentar = p.getByRole("button",{name:"Reintentar comprobación",exact:true});
            await esperar(reintentar).toBeVisible();
            await esperar(conceptoBorrador).toHaveValue("Concepto ficticio sin guardar");
            await esperar(conceptoBorrador).not.toBeVisible();
            await esperar(conceptoBorrador).toBeDisabled();
            await p.getByRole("button",{name:"Descartar edición y volver al Studio real",exact:true}).click();
            await p.getByRole("button",{name:"Seguir aquí",exact:true}).click();
            falloEstado = null; await reintentar.click();
            await esperar(conceptoBorrador).toBeVisible();
            await esperar(conceptoBorrador).toBeFocused();
            await esperar(conceptoBorrador).toHaveValue("Concepto ficticio sin guardar");
            await esperar(p.getByLabel("Documento",{exact:true})).toHaveValue("PRA-PRE-001");
            expect(lecturasFactura).toBe(lecturasAntes);
          }
          // El precio inválido se conserva y no sale por la API. El canónico
          // acepta coma venezolana y devuelve centavos al corregir.
          const precio = p.getByLabel("Precio USD 1",{exact:true});
          await precio.fill("12.345"); const escriturasAntes = escriturasFactura;
          await guardar.click(); await esperar(precio).toHaveValue("12.345");
          await esperar(precio).toHaveAttribute("aria-invalid","true");
          await esperar(precio).toBeFocused();
          expect(escriturasFactura).toBe(escriturasAntes);
          await precio.fill(""); await esperar(precio).toHaveValue("");
          // También se borra con teclado, como lo haría una persona.
          await precio.fill("12.345"); await guardar.click();
          await esperar(precio).toBeFocused();
          await precio.press("ControlOrMeta+A"); await precio.press("Backspace");
          await esperar(precio).toHaveValue("");
          await precio.fill("12,"); await guardar.click(); await esperar(precio).toHaveValue("12,");
          expect(escriturasFactura).toBe(escriturasAntes);
          // El 413 de Traefik puede ser texto plano: el editor debe permitir corregir.
          await precio.fill("12,34"); rechazarEscritura = true; await guardar.click();
          await esperar(p.getByText(/El contenido supera 24 KiB/)).toBeVisible();
          await esperar(precio).toHaveValue("12,34"); rechazarEscritura = false;
          await precio.fill("12,34"); await guardar.click(); await esperar(guardar).toBeEnabled();
          await esperar(p.getByText(/Total guardado:.*112,34/)).toBeVisible();
          const guardadoPrecio = await solicitar(prueba,"facturacion",{espacio:cuenta.vista.espacio},{sesion:cuenta.sesion});
          expect((await guardadoPrecio.json()).documento.facturas[0].lineas[0].centavos).toBe(1234);
          await p.getByRole("button",{name:"Repartir USD 300 en carga y sobrepeso",exact:true}).click();
          await guardar.click(); await esperar(guardar).toBeEnabled();
          await p.reload(); await esperar(p.getByLabel("Concepto 2",{exact:true})).toHaveValue("Sobrepeso");
          await esperar(p.getByText(/Total guardado:.*300,00/)).toBeVisible();
          await p.getByRole("button",{name:"Repartir USD 300 en tres conceptos",exact:true}).click();
          await p.getByLabel("Concepto 3",{exact:true}).fill("Manipulación ficticia");
          await guardar.click(); await esperar(guardar).toBeEnabled();
          await p.reload(); await esperar(p.getByLabel("Precio USD 3",{exact:true})).toHaveValue("50");
          await esperar(p.getByText(/Total guardado:.*300,00/)).toBeVisible();
          await p.getByRole("button",{name:"Agregar artículo elegido por ti",exact:true}).click();
          await p.getByLabel("Concepto 4",{exact:true}).fill("Embalaje ficticio");
          await p.getByLabel("Precio USD 4",{exact:true}).fill("12.34");
          await guardar.click(); await esperar(guardar).toBeEnabled();
          await p.getByRole("button",{name:"Reiniciar mi práctica",exact:true}).click();
          await p.getByRole("button",{name:"Cancelar",exact:true}).click();
          await p.reload();
          await esperar(p.getByLabel("Concepto 4",{exact:true})).toHaveValue("Embalaje ficticio");
          await esperar(p.getByText(/Total guardado:.*312,34/)).toBeVisible();
          await esperar(avanzada).toContainText("Estado: recibida_ve");
          await p.evaluate(() => window.scrollTo(0,0)); await p.screenshot({path:resolve(carpeta,`conceptos-${width}${sufijo}.png`),fullPage:true});
          await p.getByRole("button",{name:"Emitir factura ficticia",exact:true}).dblclick();
          await esperar(p.getByRole("dialog")).toContainText("PRA-PRE-001");
          await p.getByRole("button",{name:"Cancelar",exact:true}).click();
          await esperar(p.getByRole("button",{name:"Emitir factura ficticia",exact:true})).toBeEnabled();
          await p.getByRole("button",{name:"Emitir factura ficticia",exact:true}).click();
          await p.getByRole("button",{name:/los datos/}).click();
          const emisionDemorada=demorar("emitir");
          await p.getByRole("button",{name:"Confirmar emitir",exact:true}).click();
          await emisionDemorada.observada; await esperar(salida).toBeDisabled();
          emisionDemorada.liberar(); await esperar(salida).toBeEnabled();
          await esperar(p.getByRole("button",{name:"Emitir factura ficticia",exact:true})).toBeDisabled();
          await esperar(avanzada.getByRole("button",{name:/^Facturar/})).toHaveCount(0);
          await esperar(avanzada).toContainText("PRA-PRE-001 - emitida");
          const comprobacionClientes=await solicitar(prueba,"facturacion",{espacio:cuenta.vista.espacio},{sesion:cuenta.sesion});
          const facturasClientes=(await comprobacionClientes.json()).documento.facturas;
          expect(facturasClientes[1]).toMatchObject({codigo:"PRA-FAC-002",embarque:"PRA-EMB-002",cliente:"DTD-PRA-002",estado:"emitida",pagado:0});
          await p.getByRole("button",{name:"Vista previa de correo",exact:true}).click();
          await esperar(p.locator('section[aria-labelledby="titulo-facturacion"] p[role="status"]')).toContainText("Simulado · Correo a cliente@ejemplo.invalid");
          await p.getByRole("button",{name:"Vista previa de WhatsApp",exact:true}).click();
          await esperar(p.locator('section[aria-labelledby="titulo-facturacion"] p[role="status"]')).toContainText("Simulado · WhatsApp a Cliente ficticio");
          await p.getByRole("button",{name:"Anular factura ficticia",exact:true}).click();
          await p.getByLabel("Motivo ficticio",{exact:true}).fill("Corregir concepto ficticio");
          await p.getByRole("button",{name:"Confirmar anular",exact:true}).click();
          await esperar(p.getByRole("button",{name:"Pagar saldo ficticio una vez",exact:true})).toBeDisabled();
          await p.reload(); await esperar(p.getByText(/PRA-PRE-001.*Embarque PRA-EMB-001.*anulada/)).toBeVisible();
          await p.getByLabel("Documento",{exact:true}).selectOption("PRA-FAC-002");
          await p.getByRole("button",{name:"Pagar saldo ficticio una vez",exact:true}).dblclick();
          await esperar(p.getByText(/Recibo ficticio:/)).toBeVisible();
          await p.getByRole("button",{name:"Reiniciar mi práctica",exact:true}).click();
          await p.getByRole("button",{name:"Confirmar reiniciar",exact:true}).click();
          await esperar(p.getByRole("button",{name:"Pagar saldo ficticio una vez",exact:true})).toBeEnabled();
          await esperar(avanzada).toContainText("Estado: recibida");
          expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
          await p.evaluate(() => window.scrollTo(0,0)); await p.screenshot({path:resolve(carpeta,`reiniciada-${width}${sufijo}.png`),fullPage:true});
          const ayudaEmitir = p.getByLabel("Ayuda: Emitir",{exact:true});
          await ayudaEmitir.focus(); await ayudaEmitir.press("Enter");
          await esperar(p.locator('details:has(summary[aria-label="Ayuda: Emitir"])')).toHaveAttribute("open", "");
          await ayudaEmitir.press("Enter");
          // Recargar operación mantiene el borrador con permisos iguales y
          // conserva el estado oculto ante fallo transitorio, sin otra lectura financiera.
          await p.getByLabel("Documento",{exact:true}).selectOption("PRA-PRE-001");
          await p.getByLabel("Concepto 1",{exact:true}).fill("Borrador conservado al consultar permisos");
          const lecturasAntesRecarga=lecturasFactura;
          await p.getByRole("button",{name:"Recargar cargas y permisos",exact:true}).click();
          await esperar(p.getByLabel("Concepto 1",{exact:true})).toBeVisible();
          await esperar(p.getByLabel("Concepto 1",{exact:true})).toHaveValue("Borrador conservado al consultar permisos");
          expect(lecturasFactura).toBe(lecturasAntesRecarga);
          falloEstado="red";
          await p.getByRole("button",{name:"Recargar cargas y permisos",exact:true}).click();
          await esperar(p.getByRole("button",{name:"Reintentar comprobación",exact:true})).toBeVisible();
          await esperar(p.getByLabel("Concepto 1",{exact:true})).toHaveValue("Borrador conservado al consultar permisos");
          await esperar(p.getByLabel("Concepto 1",{exact:true})).toBeHidden();
          falloEstado=null;
          await p.getByRole("button",{name:"Reintentar comprobación",exact:true}).click();
          await esperar(p.getByLabel("Concepto 1",{exact:true})).toBeVisible();
          await esperar(p.getByLabel("Concepto 1",{exact:true})).toHaveValue("Borrador conservado al consultar permisos");
          expect(lecturasFactura).toBe(lecturasAntesRecarga);
          // Recorte sin recargar página ni cambiar pestaña, cuatro capacidades.
          const ajustarOperativos=(cn:boolean, naviera:boolean, shipments:boolean, ve:boolean)=>ajustesPorRol.set("operations",[
            {module_id:"cn",can_view:true,can_edit:cn},{module_id:"naviera",can_view:true,can_edit:naviera},
            {module_id:"shipments",can_view:true,can_edit:shipments},{module_id:"ve",can_view:true,can_edit:ve},
          ]);
          usuarios.get(cuentaId)!.role="operations";
          usuarios.get(cuentaId)!.warehouse_scope="all";
          ajustarOperativos(false,true,true,true);
          await p.getByRole("button",{name:"Recargar cargas y permisos",exact:true}).click();
          await esperar(p.getByRole("heading",{name:"Facturación de práctica",exact:true})).toHaveCount(0);
          await esperar(p.getByRole("button",{name:/^Facturar|^Revisar PRA/})).toHaveCount(0);
          expect(await p.locator("main").innerText()).not.toContain("Borrador conservado al consultar permisos");
          expect((await frontera(prueba,"facturacion",{espacio:cuenta.vista.espacio},sesionActual,prueba)).status).toBe(403);
          await esperar(p.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true})).toHaveCount(0);
          await esperar(p.getByRole("button",{name:"Consolidar PRA-EMB-001",exact:true})).toBeEnabled();
          await esperar(avanzada.getByRole("button",{name:"Embarcar PRA-EMB-001",exact:true})).toHaveCount(1);
          await esperar(avanzada.getByRole("button",{name:"Registrar llegada a aduana",exact:true})).toHaveCount(1);
          await esperar(p.getByText("Almacén China: Solo consulta · Consolidado: Consulta y edición · Embarque: Consulta y edición · Recepción Venezuela: Consulta y edición",{exact:true})).toBeVisible();
          ajustarOperativos(true,false,false,true);
          await p.getByRole("button",{name:"Recargar cargas y permisos",exact:true}).click();
          await esperar(p.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true})).toBeEnabled();
          await esperar(p.getByRole("button",{name:"Consolidar PRA-EMB-001",exact:true})).toHaveCount(0);
          await esperar(avanzada.getByRole("button",{name:"Embarcar PRA-EMB-001",exact:true})).toHaveCount(0);
          await esperar(avanzada.getByRole("button",{name:"Registrar llegada a aduana",exact:true})).toHaveCount(1);
          await esperar(p.getByText("Almacén China: Consulta y edición · Consolidado: Solo consulta · Embarque: Solo consulta · Recepción Venezuela: Consulta y edición",{exact:true})).toBeVisible();
          ajustarOperativos(false,false,false,false);
          await p.getByRole("button",{name:"Recargar cargas y permisos",exact:true}).click();
          await esperar(p.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true})).toHaveCount(0);
          await esperar(p.getByRole("button",{name:"Consolidar PRA-EMB-001",exact:true})).toHaveCount(0);
          await esperar(avanzada.getByRole("button",{name:"Registrar llegada a aduana",exact:true})).toHaveCount(0);
          await esperar(p.getByRole("button",{name:"Reiniciar mi práctica",exact:true})).toHaveCount(0);
          await esperar(p.getByText("Almacén China: Solo consulta · Consolidado: Solo consulta · Embarque: Solo consulta · Recepción Venezuela: Solo consulta",{exact:true})).toBeVisible();
          usuarios.get(cuentaId)!.warehouse_scope="cn";
          await p.getByRole("button",{name:"Recargar cargas y permisos",exact:true}).click();
          await esperar(p.getByText("Almacén China: Solo consulta · Consolidado: Solo consulta · Embarque: Solo consulta",{exact:true})).toBeVisible();
          expect((await frontera(prueba,"china",{espacio:cuenta.vista.espacio,modulo:"ve",revision:0,comando:{accion:"recibir_ve",envio:"PRA-EMB-001"}},sesionActual,prueba)).status).toBe(403);
          await esperar(avanzada).toContainText("PRA-CAJA-001, PRA-CAJA-002");
          ajustesPorRol.delete("operations");
          // Mismo espacio abierto: el cambio de rol retira el detalle financiero,
          // incluso si quedó un extra de edición inválido para la operación real.
          usuarios.get(cuentaId)!.role = "warehouse";
          extras.set(cuentaId,{user_id:cuentaId,module_id:"invoices",can_view:true,can_edit:true,expires_at:new Date(Date.now()+60000).toISOString()});
          await p.reload();
          await esperar(p.getByRole("heading",{name:"Permisos de tu práctica"})).toBeVisible();
          await esperar(p.getByRole("heading",{name:"Facturación de práctica",exact:true})).toHaveCount(0);
          await esperar(p.getByText("Almacén China",{exact:true})).toBeVisible();
          expect(await p.locator("main").innerText()).not.toContain("PRA-FAC-002");
          for (const comando of [undefined,{accion:"pagar",codigo:"PRA-FAC-002"},{accion:"anular",codigo:"PRA-FAC-002",motivo:"Ficticio"}]) {
            const res = await frontera(prueba,"facturacion",{espacio:cuenta.vista.espacio,revision:0,comando},cuenta.sesion,prueba);
            expect(res.status).toBe(403);
          }
          await p.screenshot({path:resolve(carpeta,`warehouse-denegado-${width}${sufijo}.png`),fullPage:true});
          usuarios.get(cuentaId)!.role = "support";
          await p.reload();
          await esperar(p.getByText("Almacén China",{exact:true})).toBeVisible();
          await esperar(p.getByText("Solo consulta",{exact:true}).first()).toBeVisible();
          await esperar(p.getByRole("heading",{name:"Facturación de práctica",exact:true})).toHaveCount(0);
          // Cambio de cuenta con borrador abierto: el espacio esperado de esta
          // pestaña deja de coincidir con la cookie de la otra persona.
          usuarios.get(cuentaId)!.role = "accounting";
          await p.reload(); await esperar(guardar).toBeEnabled();
          await p.getByLabel("Documento",{exact:true}).selectOption("PRA-PRE-001");
          await p.getByLabel("Concepto 1",{exact:true}).fill("Borrador ficticio revocado");
          // Una respuesta válida antigua no revive acceso tras una denegación nueva.
          retenerUna = true;
          await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
          await esperar.poll(() => pendientesEstado.length).toBe(1);
          usuarios.get(cuentaId)!.role = "warehouse";
          await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
          await esperar(p.getByText("Comprobando identidad y permisos…",{exact:true})).toHaveCount(0);
          await esperar(p.getByRole("heading",{name:"Facturación de práctica",exact:true})).toHaveCount(0);
          pendientesEstado.shift()?.();
          expect(await p.locator("main").innerText()).not.toContain("Borrador ficticio revocado");
          // Una denegación antigua tampoco descarta la verificación nueva.
          retenerUna = true;
          await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
          await esperar.poll(() => pendientesEstado.length).toBe(1);
          usuarios.get(cuentaId)!.role = "accounting";
          await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
          await esperar(guardar).toBeEnabled();
          pendientesEstado.shift()?.();
          await p.getByLabel("Concepto 1",{exact:true}).fill("Borrador ficticio de cuenta anterior");
          await esperar(guardar).toBeEnabled();
          const otraCuenta = await entrar(usuario("accounting")); sesionActual = otraCuenta.sesion;
          await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
          await esperar(p.getByText("Para abrir tu práctica, entra desde Mi perfil en el Studio real.",{exact:true})).toBeVisible();
          expect(await p.locator("main").innerText()).not.toContain("Borrador ficticio de cuenta anterior");
          expect(await p.locator("main").innerText()).not.toContain("PRA-FAC-002");
          // Descartar sigue disponible durante la indisponibilidad; si tampoco
          // puede cerrarse la sesión remota, se advierte y permite salir localmente.
          sesionActual = cuenta.sesion;
          await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
          await esperar(guardar).toBeEnabled();
          await p.getByLabel("Concepto 1",{exact:true}).fill("Borrador ficticio a descartar");
          falloEstado = "503"; falloCierre = true;
          await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
          await esperar(p.getByRole("button",{name:"Reintentar comprobación",exact:true})).toBeVisible();
          await p.getByRole("button",{name:"Descartar edición y volver al Studio real",exact:true}).click();
          await p.getByRole("button",{name:"Descartar y salir",exact:true}).click();
          await esperar(p.getByText(/No se pudo confirmar el cierre remoto/)).toBeVisible();
          await esperar(p.getByLabel("Concepto 1",{exact:true})).toHaveCount(0);
          await p.getByRole("button",{name:"Volver sin confirmar el cierre",exact:true}).click();
          await esperar(p).toHaveURL(real+"/studio/dashboard");
          expect(inesperadas).toEqual([]);
          console.log(`PASÓ fase 4 ${width}px ${tema}: entrada desde perfil por canje, carga hasta Venezuela, revisión sin emisión, cancelación, dos confirmaciones, pendientes y otro cliente intacto; Faro local sin servicio.`);
          matriz.push(`${width}-${tema}`);
          console.log(`PASÓ pantalla persistida ${width}px ${tema}; membresía financiera revocada y warehouse denegado; support consulta; capturas ${carpeta}; cero peticiones externas`);
        } finally { await contextoBrowser.close(); }
      }
      if (process.env.PRACTICA_RECIBO) writeFileSync(process.env.PRACTICA_RECIBO,JSON.stringify(matriz));
    } finally { await browser.close(); }
  }, 120000);

  it("rechaza acceso anónimo, otro sitio, canal inválido, y fallos de comunicación", async () => {
    expect((await solicitar(real,"emitir",{})).status).toBe(403);
    expect((await solicitar(real,"emitir",{},{headers:{Origin:prueba}})).status).toBe(403);
    expect((await solicitar(prueba,"estado",{},{headers:{Host:new URL(real).host}})).status).toBe(403);
    expect((await solicitar(prueba,"reservar",{})).status).toBe(403);
    expect((await solicitar(real,"permisos",{})).status).toBe(403);
    const id = usuario("accounting");
    const {vista,sesion} = await entrar(id);
    disponible = false;
    try {
      expect((await solicitar(real,"emitir",{},{usuario:id})).status).toBe(503);
      expect((await solicitar(prueba,"estado",{espacio:vista.espacio},{sesion})).status).toBe(503);
      expect((await solicitar(prueba,"salir",{espacio:vista.espacio},{sesion})).status).toBe(200);
    } finally { disponible = true; }
  });

  it("exige una configuración dedicada y limita rutas y métodos a la fase abierta", () => {
    expect(resolver({})).toBeNull();
    expect(resolver({ ...origen, APP_ENV:"staging" })).toBeNull();
    for (const cambio of [{ APP_ENV:"production" }, { PRACTICA_DATOS_ORIGEN:real }, { PRACTICA_LLAVE_IDENTIDAD:clave },
      { SUPABASE_SERVICE_ROLE_KEY:"inventada" }, { NEXT_PUBLIC_GA_ID:"" }, { PRACTICA_DATOS_TOKEN:"otro-rol" }]) {
      expect(resolver({ ...destino, ...cambio })).toBeNull();
    }
    for (const ruta of ["/api/correos", "/api/cron", "/studio/facturacion", "/api/pagos", "/studio/bandeja", "/api/practica/emitir"]) {
      expect(config.rutaDelReceptor(ruta,"POST",false)).toBe(false);
    }
    expect(config.rutaDelReceptor("/studio/practica","POST",true)).toBe(false);
    expect(config.rutaDelReceptor("/studio/practica","GET",false)).toBe(true);
    expect(config.rutaDelReceptor("/api/practica/estado","POST",false)).toBe(true);
    expect(config.rutaDelReceptor("/api/practica/facturacion","POST",false)).toBe(true);
    for (const metodo of ["GET", "HEAD", "PUT", "DELETE"]) expect(config.rutaDelReceptor("/api/practica/facturacion",metodo,false)).toBe(false);
    expect(config.rutaDelReceptor("/api/practica/facturacion","POST",true)).toBe(false);
    const regla = readFileSync("infra/ops/staging/practica-traefik.yml.tmpl", "utf8");
    expect(regla).toContain("reservar|canjear|estado|salir");
    expect(regla).toContain('Path(`/api/practica/facturacion`)');
    expect(regla).toContain("maxRequestBodyBytes: 24576");
    expect(regla).toContain("maxRequestBodyBytes: 2048");
    expect(regla).toContain("Method(`POST`)");
  });

  it("lleva una identidad opaca, acotada por persona, empresa, clave y caducidad", () => {
    const sujeto = {usuario:randomUUID(),tenant};
    const a = referenciaPrivada(sujeto,clave,0), b = referenciaPrivada(sujeto,clave,0);
    expect(a.propietario).toBe(b.propietario);
    expect(a.referencia).not.toBe(b.referencia);
    expect(a.propietario).not.toBe(referenciaPrivada({...sujeto,tenant:randomUUID()},clave,0).propietario);
    expect(abrirReferencia(a.referencia,clave,1)).toEqual(sujeto);
    expect(abrirReferencia(a.referencia,canal,1)).toBeNull();
    expect(abrirReferencia(a.referencia,clave,4*3600_000)).toBeNull();
  });
});
