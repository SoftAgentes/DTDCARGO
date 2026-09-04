# CSP con nonce de la aplicación privada · SDD-0413 · evidencia local

Fecha: 2026-09-04

Alcance: Studio, Back, Portal, PWA ERP/empresa, Entrar y Registro

Fuera de alcance: datos reales, Cloud, push, `main`, despliegue, reescritura de
documentos Marca y limpieza de worktrees

## Decisión

Next necesita recibir la CSP y el nonce en el request para aplicarlos a sus
scripts. Un nonce también fuerza render dinámico, por lo que aplicarlo al sitio
público completo eliminaría SSG/ISR y su caché. La implementación queda limitada
a las rutas que ya pasan por `proxy.ts` para resolver sesión; la baseline pública
y las excepciones de Marca permanecen en `next.config.ts`.

Referencia primaria:
<https://nextjs.org/docs/app/guides/content-security-policy>.

## Hallazgo reproducido

La primera prueba de navegador cargó `/studio/login` con los bundles de Next
correctamente nonced, pero bloqueó el script inline que restaura tema y densidad:

`Executing inline script violates ... script-src 'nonce-…' 'strict-dynamic'`.

El DOM confirmó que ese script no tenía nonce. La corrección lee `x-nonce` en el
layout del Studio y lo coloca explícitamente en el tag; no se agregó hash fijo ni
se reabrió `unsafe-inline`.

## Evidencia ejecutada

- RED unitario: constructor inexistente y 9 fallos del proxy sin CSP/nonce.
- GREEN focal: 35/35 entre constructor, cookie bridge, matcher y redirección.
- Suite unitaria completa: 7.308/7.308 en 578 archivos.
- Build de producción: 158 rutas, TypeScript y generación completa correctos.
- Navegador de producción local, `/studio/login`: título correcto y 0 errores o
  warnings de consola después del correctivo.
- Header privado observado: nonce por request, `strict-dynamic`,
  `script-src-attr 'none'`, sin `unsafe-inline` ni `unsafe-eval` en `script-src`.
- `/portal` sin sesión redirige a `/entrar` y termina con 0 errores de consola.
- `/` permanece prerenderizada (`x-nextjs-prerender: 1`, caché pública) y conserva
  la baseline compatible con Analytics/JSON-LD; 0 errores CSP.
- `/marca/doc/Logo Oficial.html` quedó fuera del proxy. Sin acceso devolvió 401,
  pero el response conservó exclusivamente la CSP autorizada del visor, con sus
  tres CDN exactos, `SAMEORIGIN` y `noindex`; no se leyó Storage.

## Límites de la evidencia

El navegador usó URL y llave sintéticas para impedir acceso a Supabase real. Por
eso certifica render, headers, redirects y consola, no login real ni el contenido
de un documento protegido. La construcción intentó sólo el host inválido del
fixture; no hubo lectura ni escritura Cloud.

`style-src 'unsafe-inline'` permanece de forma explícita porque las superficies
usan atributos `style` de React. Retirarlo exige otro inventario y otra prueba de
navegador; no se presenta como resuelto por este slice.

## Estado

- Local: **CORRECTO**.
- Producción: **NO VERIFICABLE**; no se publicó ni desplegó.
- Checklist original: 59/106 (55,7 %), 47 pendientes.
- Migraciones preparadas sin aplicar: 44 (0401–0444); este slice no agrega SQL.
