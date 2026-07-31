---
sdd: "0201"
title: "Portal shell — ruta y preferencias como fuentes de verdad"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0042", "0148", "0196", "0200"]
confidencialidad: interno
---

# SDD-0201 — Portal shell · ruta y preferencias como fuentes de verdad

## 1. Propósito

Resolver tres estados sincronizados por efecto en el shell del portal sin
cambiar rutas, navegación, permisos ni contenido.

## 2. Riesgo y políticas

Riesgo **R2**. SGE-00.01/.05/.07 exige contexto y estado verdaderos: la ruta
controla el cajón y `localStorage` controla preferencias y lectura de soporte.

## 3. Contrato resultante

- la preferencia colapsada se consume como store externo con snapshot SSR;
- un cambio local o entre pestañas notifica al shell;
- el cajón móvil sólo está abierto en la ruta donde fue activado;
- Escape y el cierre explícito mantienen el comportamiento previo;
- el punto de soporte compara la última respuesta con el visto persistido.

## 4. Allowlist exacta

1. `app/portal/_components/PortalShell.tsx`
2. `app/portal/_components/PortalShell.test.tsx`
3. `docs/specs/0201-portal-shell-route-state/spec.md`
4. `docs/architecture/module-sdd-map.md`
5. `docs/specs/README.md` — generado

## 5. Fuera de alcance

- auth, datos del portal, rutas, Server Actions y Supabase;
- componentes visuales, copy, temas o permisos;
- reglas ESLint globales.

## 6. Verificación

- ESLint focalizado: **0 errores · 0 advertencias**;
- Vitest: **2/2** pruebas de respuesta no leída y contrato de stores/ruta;
- `pnpm typecheck`: verde;
- lint completo: **152 → 149 advertencias**, 0 errores;
- docs, gobernanza, componentes, plugin y `diff --check`: verdes.
