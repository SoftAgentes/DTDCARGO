// @vitest-environment node
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/practica/[operacion]/route";
import * as config from "../config";
import { API_PRACTICA, COOKIE_PRACTICA, type VistaPractica } from "../contrato";
import { abrirReferencia, referenciaPrivada } from "../identidad";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import type { StudioUserRole } from "@/lib/studio/user-types";

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
        };
        const [nombre, campos] = funciones[u.pathname];
        const args = ["p_instancia", ...campos].map(c => body[c]);
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
    expect((await soloLectura.json()).permisos).toContainEqual({id:"invoices",edicion:false});
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
