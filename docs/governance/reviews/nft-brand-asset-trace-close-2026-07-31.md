---
id: REV-SGE-032
title: Cierre del warning NFT en assets privados de marca
date: 2026-07-31
status: cerrado-local
scope: app/marca/asset/[name]
---

# REV-SGE-032 — Cierre del warning NFT

## Residuo reproducido

`pnpm build` terminaba correctamente, pero Turbopack advertía que el NFT de
`app/marca/asset/[name]/route.ts` había trazado el proyecto completo. El acceso
usaba `path.join(process.cwd(), rel)`, donde `rel` incluía desde la whitelist la
ruta completa `private/marca/...`; la traza reportada alcanzaba
`next.config.ts`. Al acotar ese handler, el build dejó de señalarlo y reveló el
mismo patrón en `app/interno/(app)/marca/d/[bundle]/route.ts`.

## Corrección acotada

Los handlers conservan login, whitelist, headers, nombres y contenido. Sus
operaciones de filesystem ahora quedan estáticamente acotadas a
`private/marca/`, `public/brand/` o `docs/marketing/`. Ningún nombre recibido
del request se usa como ruta; cada raíz y valor relativo provienen de mapas
cerrados.

No se modificó `next.config.ts`, la CSP, `outputFileTracingIncludes`, el Brand
Book ni otra ruta pública o privada. La allowlist se amplió al segundo handler
sólo después de que la nueva traza del build lo identificó.

## Evidencia

- ocho pruebas focales: autenticación antes de filesystem, rechazo de traversal,
  resolución dentro de raíces estáticas, headers y errores seguros;
- build de producción: verde con Next.js 16.2.11, 155 rutas y sin
  `Encountered unexpected file in NFT list`;
- `git diff --check`: verde.

## Clasificación

- `SGE-00`: cumplimiento; frontera y evidencia explícitas;
- `ERR-01`: cumplimiento; el fallo de lectura conserva respuesta 404 segura;
- `A11Y-01`, `BTN-01`, `HTD-01`, `FRM-01`, `LOD-01`, `NUM-01`: no aplica;
- excepciones: ninguna.
