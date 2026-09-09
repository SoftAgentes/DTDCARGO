---
sdd: 0321
title: E2E local acotado y con concurrencia estable
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0320
confidencialidad: interno
---

# SDD-0321 — E2E local acotado y con concurrencia estable

## Problema

El gate local ejecutaba 16 workers en esta máquina y no tenía tiempo máximo
global. En una corrida ya terminada, un worker de WebKit quedó vivo después del
último caso; `pnpm verify` no devolvió control hasta terminar manualmente ese PID.

## Contrato

1. La ejecución local usa como máximo ocho workers por defecto para reducir la
   presión simultánea de navegadores y compilación en entornos multiventana.
2. CI usa un worker por defecto; ambos entornos admiten un override explícito.
3. La suite completa tiene un tiempo máximo global de ocho minutos, también
   configurable de forma explícita.
4. Workers fuera de 1–32 y timeouts menores a un minuto o mayores a una hora
   fallan antes de iniciar Playwright.
5. Los límites sólo afectan el arnés de pruebas; no cambian runtime, datos ni
   comportamiento del producto.

## Aceptación

- Los límites predeterminados y sus overrides tienen contratos unitarios.
- El E2E completo termina sin intervención manual en los tres proyectos.
- `pnpm verify` conserva todos sus gates y sigue marcando como no medido el
  ledger de migraciones cuando el worktree no tiene credenciales.

## Fuera de alcance

- Ejecutar Tier 3 sin un branch efímero sembrado.
- Aplicar migraciones o escribir en Supabase Cloud.
- Ocultar fallos funcionales con reintentos adicionales.
