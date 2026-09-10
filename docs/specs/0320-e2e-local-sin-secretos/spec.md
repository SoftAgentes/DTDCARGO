---
sdd: 0320
title: E2E local sin secretos alojados
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0168
confidencialidad: interno
---

# SDD-0320 — E2E local sin secretos alojados

## Problema

`pnpm verify` levanta un `next dev` propio en cada worktree. En una copia limpia,
sin `.env.local`, las rutas de acceso alcanzadas por `proxy.ts` intentan crear el
cliente Supabase con URL y anon key vacíos. Por eso quince casos Tier 1 fallan en
los tres proyectos de navegador aunque el código bajo prueba sea correcto.

## Contrato

1. Si Playwright levanta un webserver sobre loopback y no existe configuración
   pública Supabase, levanta además un servidor local deny-only y entrega su URL
   al proceso hijo junto con una anon key explícitamente no secreta.
2. El servidor sintético sólo expone un healthcheck; rechaza lecturas y
   escrituras con un error JSON corto, no accede a Cloud y no conserva datos.
3. Una configuración pública completa conserva exactamente sus valores.
4. Una configuración parcial falla temprano: no se mezcla un valor real con
   otro sintético.
5. Un entorno Tier 3 efímero validado propaga su URL y anon key al webserver.
6. Un `BASE_URL` remoto no recibe fallback local porque sus variables pertenecen
   al servidor ya desplegado, no al proceso de Playwright.

## Aceptación

- Las pruebas unitarias del config cubren los seis contratos y el servidor
  deny-only demuestra que no acepta lecturas ni escrituras.
- Los Tier 1 de `auth.spec.ts` y `global-search.spec.ts` pasan sin `.env.local`.
- El gate canónico no necesita copiar credenciales al worktree.
- La configuración no contiene secretos reales ni cambia comportamiento de
  producción.

## Fuera de alcance

- Sembrar las fixtures Tier 3.
- Consultar o modificar Supabase Cloud.
- Cambiar la política de autenticación del producto.
