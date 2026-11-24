import { resolveAppEnv, type EnvSource } from "@/lib/runtime/app-env";
import { API_PRACTICA, RUTA_PRACTICA, esToken, esUuid } from "./contrato";

interface Comunes { real: string; prueba: string; canal: string }
export interface OrigenPractica extends Comunes { modo: "origen"; llave: string }
export interface DestinoPractica extends Comunes { modo: "destino"; rest: string; tokenDatos: string; instancia: string }

function origenHttps(valor: string | undefined): string | null {
  if (!valor) return null;
  try {
    const url = new URL(valor);
    if (url.protocol !== "https:" || url.origin !== valor) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function esCredencialDePractica(valor: string | undefined): valor is string {
  if (!valor) return false;
  try {
    const partes = valor.split(".");
    if (partes.length !== 3 || !partes.every(parte => /^[\w-]+$/.test(parte))) return false;
    const claims = JSON.parse(atob(partes[1].replace(/-/g, "+").replace(/_/g, "/")));
    // PostgREST verifica la firma. Aquí se evita configurar por error un rol operativo.
    return claims.role === "practica_personal_web";
  } catch {
    return false;
  }
}

export function configuracionPractica(env: EnvSource = process.env): OrigenPractica | DestinoPractica | null {
  const real = origenHttps(env.PRACTICA_STUDIO_REAL);
  const prueba = origenHttps(env.PRACTICA_STUDIO_PRUEBA);
  const canal = env.PRACTICA_SECRETO_CANAL;
  if (!real || !prueba || real === prueba || !esToken(canal)) return null;
  const entorno = resolveAppEnv(env);
  if (env.PRACTICA_MODO === "origen" && env.APP_ENV === "production" && entorno === "production" && env.APP_URL === real) {
    const llave = env.PRACTICA_LLAVE_IDENTIDAD;
    return esToken(llave) && llave !== canal ? { modo: "origen", real, prueba, canal, llave } : null;
  }
  if (env.PRACTICA_MODO !== "destino" || entorno !== "staging" || env.APP_URL !== prueba) return null;
  const rest = origenHttps(env.PRACTICA_DATOS_ORIGEN);
  const tokenDatos = env.PRACTICA_DATOS_TOKEN;
  const instancia = env.PRACTICA_DATOS_INSTANCIA;
  if (!rest || rest === real || rest === prueba || !esCredencialDePractica(tokenDatos) || !esUuid(instancia)) return null;
  // El receptor solo usa el PostgREST de práctica. Una imagen con credenciales
  // operativas o de emisión se rechaza incluso si su APP_ENV dice staging.
  const prohibidas = ["PRACTICA_LLAVE_IDENTIDAD", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "CHATWOOT_API_TOKEN",
    "KOMMO_ACCESS_TOKEN", "WHATSAPP_ACCESS_TOKEN", "META_ACCESS_TOKEN", "STRIPE_SECRET_KEY",
    "WHATSAPP_TOKEN", "CHATWOOT_PLATFORM_TOKEN", "TELEGRAM_BOT_TOKEN", "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY"];
  if (prohibidas.some((clave) => env[clave]?.trim()) || env.NEXT_PUBLIC_GA_ID !== "off"
      || (env.NEXT_PUBLIC_CLARITY_ID && env.NEXT_PUBLIC_CLARITY_ID !== "off")) return null;
  return { modo: "destino", real, prueba, canal, rest, tokenDatos, instancia };
}

// El receptor se ejecuta aparte del staging técnico. Toda petición dinámica
// cubierta por el proxy queda cerrada salvo la página y sus operaciones de fase 1.
export function rutaDelReceptor(path: string, metodo: string, accionNext: boolean): boolean {
  if (accionNext) return false;
  if (path === RUTA_PRACTICA) return metodo === "GET" || metodo === "HEAD";
  return metodo === "POST" && ["reservar", "canjear", "estado", "salir"].some((op) => path === API_PRACTICA + op);
}
