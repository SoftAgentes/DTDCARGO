#!/usr/bin/env node
/**
 * SDD-0604 · Avisa a IndexNow las URLs del sitemap público.
 *
 * Por defecto solo muestra lo que enviaría. Con `--enviar` hace el POST real, y
 * necesita que `public/<clave>.txt` ya esté publicado en el dominio.
 *
 * La clave no es secreta: el protocolo exige publicarla para probar que el sitio
 * es dueño del dominio.
 */
import { pathToFileURL } from "node:url";

export const HOST = "dtdcargo.com";
export const CLAVE = "6ef16632b634eaa88dbcdf9f00cfea05";
export const LIMITE_URLS = 10_000;

export function urlsDelSitemap(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
    .map((m) => m[1])
    .filter((url) => new URL(url).host === HOST);
}

export function cuerpoIndexNow(urls) {
  return {
    host: HOST,
    key: CLAVE,
    keyLocation: `https://${HOST}/${CLAVE}.txt`,
    urlList: urls.slice(0, LIMITE_URLS),
  };
}

async function principal() {
  const enviar = process.argv.includes("--enviar");
  const sitemap = await fetch(`https://${HOST}/sitemap.xml`);
  if (!sitemap.ok) throw new Error(`sitemap respondió ${sitemap.status}`);

  const cuerpo = cuerpoIndexNow(urlsDelSitemap(await sitemap.text()));
  if (cuerpo.urlList.length === 0) throw new Error("el sitemap no trajo URLs del dominio");
  console.log(`${cuerpo.urlList.length} URLs de ${HOST}`);

  if (!enviar) {
    console.log("Sin enviar. Usa --enviar para avisar a IndexNow.");
    return;
  }

  const respuesta = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(cuerpo),
  });
  console.log(`IndexNow respondió ${respuesta.status}`);
  if (!respuesta.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
