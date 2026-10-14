---
sdd: "0512"
title: "/back fuera de los buscadores: noindex en todo el back de contenido"
status: in-progress
author: "Claude"
created: 2026-10-14
updated: 2026-10-14
supersedes: null
superseded_by: null
related: []
confidencialidad: interno
---

# SDD-0512 — /back fuera de los buscadores

> El login y el panel del back de contenido salen con
> `<meta name="robots" content="noindex, nofollow">`, igual que `/studio`, `/portal` y `/m`.

## Contexto

Medido por el Director el 2026-10-14 con curl: `https://dtdcargo.com/back/login` y
`https://nuevo.dtdcargo.com/back/login` responden 200 con
`<meta name="robots" content="index, follow">` y sin cabecera `X-Robots-Tag`.

La causa: `app/back` no tiene layout raíz. Sus grupos `(auth)` y `(app)` no declaran
`robots`, y la página de login es un client component, que no puede exportar `metadata`.
Así que la página hereda el `robots: { index: true, follow: true }` de `app/layout.tsx`.
`/studio` (`app/studio/layout.tsx`), `/portal` (`app/portal/layout.tsx`) y `/m`
(`app/m/layout.tsx`) lo declaran en su layout raíz y por eso salen con noindex.

`app/__tests__/sitemap-cobertura-contract.test.ts` pone `back` en su lista de superficies
privadas y no comprueba que de verdad salga con noindex. Por ese hueco pasó.

## Alcance

Allowlist exacta:

- `app/back/layout.tsx` (nuevo): solo metadata, `robots: { index: false, follow: false }`, y
  devuelve un fragment para no cambiar el DOM de los grupos.
- `app/__tests__/back-noindex.test.ts` (nuevo).
- `docs/specs/0512-back-noindex/spec.md` y el índice `docs/specs/README.md`, regenerado con
  `pnpm docs:index`.
- `.agents/handoffs/back-noindex.md`.

Fuera: `app/robots.ts` no cambia (ver la decisión de abajo), no se agrega cabecera
`X-Robots-Tag` en `next.config.ts`, y no hay DB, migraciones ni cambios en el guard de
sesión de `(app)/layout.tsx`.

### Decisión: `/back` no entra al Disallow de `robots.txt`

Para que un buscador saque una URL del índice tiene que poder rastrearla y leer el noindex.
Un `Disallow` se lo impide, y la URL que ya conocía se queda indexada «URL-only». Es el
mismo criterio que ya documenta `app/robots.ts` para `/track/`. `/interno/` sí está en el
Disallow porque nació con noindex y nunca se sirvió indexable. `/back/login`, en cambio, se
sirvió con `index, follow` hasta este arreglo. No se comprobó si está en el índice: hace falta
Search Console. El Disallow se puede reconsiderar cuando Search Console confirme que `/back`
salió del índice. Además, cada entrada nueva en `robots.txt` le anuncia la ruta a cualquiera
que lo lea.

## Criterios de aceptación

1. `app/back/layout.tsx` declara `robots: { index: false, follow: false }`, y toda
   `page.tsx` bajo `app/back`, de `(auth)` y de `(app)`, resuelve a noindex, nofollow, sin
   que ninguna página lo pise con un `robots` propio.
2. `app/__tests__/back-noindex.test.ts` resuelve la herencia de metadata como Next: gana el
   `robots` del nivel más profundo que lo declara. Falla con el código de main
   (`cbce7692`) y pasa con el arreglo. Tiene controles positivos (`/studio/login`,
   `/portal/registro` y `/m` resuelven a noindex) y uno negativo (la home sigue indexable
   por `app/layout.tsx`), para que el resolutor no pueda pasar diciendo siempre «noindex».
3. `robots.txt` no cambia y no bloquea `/back` ni `/back/login`. La prueba fija la decisión,
   con un control que demuestra que sí ve los bloqueos de `/marca` e `/interno/`.

## Verificación tras desplegar (release, no PR)

Después del merge y del despliegue, con el mismo curl del Director, `/back/login` en
`dtdcargo.com` (y en `nuevo.dtdcargo.com` mientras exista) tiene que traer
`<meta name="robots" content="noindex, nofollow">`. Esto no se fusiona en la ventana del
corte de dtdcargo.com al VPS de Contabo (jueves 2026-10-15 en la noche).

## Riesgos

- Una página del back que declare su propio `robots` reemplaza entero el del layout. El
  criterio 2 lo detecta (mutante comprobado).
- El layout envuelve los dos grupos. Como devuelve un fragment y no declara `title`, no
  cambia ni el DOM ni los títulos de `(app)`.
- El efecto en buscadores tarda: Google tiene que volver a rastrear la URL.
