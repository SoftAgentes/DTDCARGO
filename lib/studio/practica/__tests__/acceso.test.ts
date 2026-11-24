// @vitest-environment node
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
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
const usuarios = new Map<string, { role: StudioUserRole; warehouse_scope: string; disabled: boolean }>();
const extras = new Map<string, { user_id: string; module_id: string; can_view: boolean; can_edit: boolean; expires_at: string }>();
const dbOrigen = vi.hoisted(() => ({ cliente: vi.fn(), admin: vi.fn(), acceso: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: dbOrigen.cliente }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: dbOrigen.admin }));
vi.mock("@/lib/studio/rbac-guard", () => ({ getStudioAccess: dbOrigen.acceso }));

function usuario(role: StudioUserRole, scope = "all") {
  const id = randomUUID();
  usuarios.set(id, { role, warehouse_scope: scope, disabled: false });
  return id;
}
function solicitar(sitio: string, op: string, body: object, opc: { usuario?: string; sesion?: string; headers?: Record<string,string> } = {}) {
  const headers = { "Content-Type":"application/json", Host: new URL(sitio).host, Origin:sitio,
    ...(opc.sesion ? { Cookie: COOKIE_PRACTICA + "=" + opc.sesion } : {}), ...opc.headers };
  return contexto.run({ sitio, usuario: opc.usuario }, () => POST(new NextRequest(sitio + API_PRACTICA + op,
    { method:"POST", headers, body: JSON.stringify(body) }), { params: Promise.resolve({ operacion:op }) }));
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
      auth: { admin:{ getUserById:(id:string) => ({ data:{ user:usuarios.has(id) ? { id } : null }, error:null }) } },
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
            return { data:miembro?.disabled ? null : miembro, error:null };
          },
          then:(recibir:(v:unknown)=>void) => {
            expect(["studio_role_module_overrides","studio_user_module_grants"]).toContain(tabla);
            expect(filtros.tenant_id).toBe(tenant);
            const extra = tabla === "studio_user_module_grants" && extras.get(String(filtros.user_id));
            recibir({ data:extra ? [extra] : [], error:null });
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
      expect([prueba + API_PRACTICA + "reservar", real + API_PRACTICA + "permisos"]).toContain(url);
      expect(headers.Authorization).toBe("Bearer " + canal);
      return solicitar(u.origin, u.pathname.slice(API_PRACTICA.length), body, { headers });
    });
  }, 60000);
  afterAll(async () => { vi.unstubAllGlobals(); vi.restoreAllMocks(); await db?.close(); });

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
    expect(a.vista.permisos).toContainEqual({id:"cn",edicion:true});
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
    expect(permisosDePractica("warehouse","cn",{},extra)).toContainEqual({id:"cn",edicion:true});
    expect(canAccessModule("warehouse","clients",{},extra)).toBe(true);
    const soporte = await entrar(usuario("support"));
    expect(soporte.vista.permisos).toContainEqual({id:"cn",edicion:false});
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
    try {
      for (const width of [390,1280]) for (const tema of ["light","dark"]) {
        const cuentaId = usuario("warehouse", "cn");
        let cuenta: Awaited<ReturnType<typeof entrar>>;
        const sufijo = tema === "light" ? "" : "-dark";
        const contextoBrowser = await browser.newContext({ viewport:{width,height:900}, serviceWorkers:"block" });
        const inesperadas: string[] = [];

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
            cuenta = {pase:req.postDataJSON().pase,sesion:r.cookies.get(COOKIE_PRACTICA)!.value,vista};
            return ruta.fulfill({status:r.status,json:vista});
          }
          if (u.origin === prueba && config.rutaDelReceptor(u.pathname,req.method(),!!req.headers()["next-action"])) {
            const res = await frontera(prueba,u.pathname.slice(API_PRACTICA.length),req.postDataJSON(),cuenta.sesion,req.headers().origin);
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
          p.on("pageerror", e => console.error("Error de pantalla", e.message));
          await esperar(p.getByRole("heading",{name:"Permisos de tu pr\u00e1ctica"})).toBeVisible();
          await esperar(p.getByRole("heading",{name:"Almacén China y Consolidado de práctica"})).toBeVisible();
          await esperar(p.getByRole("heading",{name:"Facturación de práctica",exact:true})).toHaveCount(0);
          await p.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true}).click();
          await esperar(p.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true})).toBeDisabled();
          await p.reload();
          const avanzada=p.locator("fieldset").filter({has:p.locator("legend",{hasText:"PRA-EMB-001"})});
          await esperar(p.locator("fieldset").filter({has:p.locator("legend",{hasText:"PRA-EMB-003"})})).toContainText("Estado: recibida");
          await esperar(avanzada).toContainText("Estado: recibida");
          await p.getByLabel("Ayuda: recibir en China",{exact:true}).focus();
          await p.getByLabel("Ayuda: recibir en China",{exact:true}).press("Enter");
          await esperar(p.locator('details:has(summary[aria-label="Ayuda: recibir en China"])')).toHaveAttribute("open", "");
          await p.screenshot({path:resolve(carpeta,`china-almacen-${width}${sufijo}.png`),fullPage:true});
          const otraPestana = await contextoBrowser.newPage();
          await otraPestana.goto(prueba + "/studio/practica");
          await esperar(otraPestana.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true})).toBeDisabled();
          await p.getByRole("button",{name:"Reiniciar mi práctica",exact:true}).click();
          await p.getByRole("button",{name:"Cancelar",exact:true}).click();
          await p.reload();
          await esperar(p.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true})).toBeDisabled();
          await p.getByRole("button",{name:"Reiniciar mi práctica",exact:true}).click();
          await p.getByRole("button",{name:"Confirmar reiniciar",exact:true}).click();
          await esperar(p.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true})).toBeEnabled();
          // La pestaña anterior conserva su revisión; el servidor rechaza su escritura.
          await otraPestana.getByRole("button",{name:"Recibir PRA-EMB-004",exact:true}).click();
          await esperar(otraPestana.getByRole("alert")).toContainText("La práctica cambió");
          await otraPestana.reload();
          await esperar(otraPestana.getByRole("button",{name:"Recibir PRA-EMB-003",exact:true})).toBeEnabled();
          await otraPestana.close();
          await p.screenshot({path:resolve(carpeta,`reinicio-almacen-${width}${sufijo}.png`),fullPage:true});
          usuarios.get(cuentaId)!.role="admin";
          await p.reload();
          await p.getByRole("button",{name:"Consolidar PRA-EMB-001",exact:true}).click();
          await esperar(avanzada).toContainText("PRA-CON-001");
          await p.getByRole("button",{name:"Recibir PRA-EMB-004",exact:true}).click();
          await p.getByRole("button",{name:"Identificar con marca ficticia",exact:true}).click();
          await p.getByRole("button",{name:"Consolidar PRA-EMB-004",exact:true}).click();
          await p.reload();
          await esperar(avanzada).toContainText("PRA-CAJA-001, PRA-CAJA-002");
          await esperar(avanzada).toContainText("Estado: consolidada");
          await avanzada.getByRole("button",{name:"Embarcar PRA-EMB-001",exact:true}).click();
          await esperar(avanzada).toContainText("Estado: embarcada");
          await avanzada.getByRole("button",{name:"Registrar llegada a aduana",exact:true}).click();
          await esperar(avanzada).toContainText("Estado: en_aduana");
          await avanzada.getByRole("button",{name:/Confirmar liberaci/}).click();
          await esperar(avanzada).toContainText("Estado: recibida_ve");
          await p.reload();
          await esperar(avanzada).toContainText("Estado: recibida_ve");

          await p.screenshot({path:resolve(carpeta,`consolidado-${width}${sufijo}.png`),fullPage:true});
          await p.getByLabel("Documento",{exact:true}).selectOption("PRA-FAC-002");
          await p.getByRole("button",{name:"Revisar PRA-PRE-001 en Facturación",exact:true}).click();
          await esperar(p.getByLabel("Documento",{exact:true})).toHaveValue("PRA-PRE-001");
          await p.getByLabel("Concepto 1",{exact:true}).fill("Cambio sin guardar ficticio");
          await p.getByRole("button",{name:"Revisar PRA-PRE-001 en Facturación",exact:true}).click();
          await esperar(p.getByRole("dialog",{name:"Descartar conceptos sin guardar"})).toBeVisible();
          await p.getByRole("button",{name:"Cancelar",exact:true}).click();
          await esperar(p.getByLabel("Concepto 1",{exact:true})).toHaveValue("Cambio sin guardar ficticio");
          await p.getByRole("button",{name:"Revisar PRA-PRE-001 en Facturación",exact:true}).click();
          await p.getByRole("button",{name:"Descartar conceptos",exact:true}).click();
          await esperar(p.getByLabel("Concepto 1",{exact:true})).toHaveValue("Carga propuesta");
          const guardar = p.getByRole("button",{name:"Guardar conceptos",exact:true});
          await esperar(guardar).toBeEnabled();
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
          await p.getByRole("button",{name:"Confirmar emitir",exact:true}).click();
          await esperar(p.getByRole("button",{name:"Emitir factura ficticia",exact:true})).toBeDisabled();
          await p.getByRole("button",{name:"Vista previa de correo",exact:true}).click();
          await esperar(p.locator('p[role="status"]')).toContainText("Simulado · Correo a cliente@ejemplo.invalid");
          await p.getByRole("button",{name:"Vista previa de WhatsApp",exact:true}).click();
          await esperar(p.locator('p[role="status"]')).toContainText("Simulado · WhatsApp a Cliente ficticio");
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
          await p.getByRole("button",{name:"Volver al Studio real",exact:true}).click();
          await esperar(p).toHaveURL(real+"/studio/dashboard");
          expect(inesperadas).toEqual([]);
          console.log(`PASÓ pantalla persistida ${width}px ${tema}; membresía financiera revocada y warehouse denegado; support consulta; capturas ${carpeta}; cero peticiones externas`);
        } finally { await contextoBrowser.close(); }
      }
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
    expect(regla).toContain("reservar|canjear|estado|salir|facturacion");
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
