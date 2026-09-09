---
sdd: 0333
title: Validar la configuración completa de integraciones en Studio
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0247
  - SDD-0291
confidencialidad: interno
---

# SDD-0333 — Validar la configuración completa de integraciones en Studio

## Estado real

`/studio/debug` distingue configuración declarada de salud en vivo, pero el
primer indicador miraba una sola variable por integración. El propio runtime y
los healthchecks exigen combinaciones de dos o tres variables para Supabase,
webhooks, HailuWay y SeaRates.

## Problema

Una URL sin credencial, un secreto de webhook sin API key o una key sin base de
API aparecían como `active`. El panel operativo podía mostrar “Configurado” al
mismo tiempo que el chequeo funcional se omitía por configuración incompleta.

## Decisión

1. Modelar cada integración con el conjunto completo de variables que necesita.
2. Declarar `active` sólo cuando todas tengan un valor no vacío.
3. Mantener `missing` para Supabase, que es obligatorio, y `mock` para las
   integraciones opcionales incompletas.
4. Mostrar en el panel todos los nombres requeridos sin exponer valores.
5. Considerar un valor formado sólo por espacios como ausente.

## Gobernanza

- `cumplimiento` ERR-01: el diagnóstico no presenta un verde engañoso ante una
  precondición incompleta.
- `cumplimiento` LOD-01: el estado sigue siendo server-side y no revela secretos.
- `no aplica`: cambios visuales, datos personales, migraciones, Cloud o
  Producción.

## Allowlist exacta

- `lib/studio/env-status.ts`
- `lib/studio/__tests__/env-status.test.ts`
- `docs/specs/0333-validar-configuracion-integraciones/spec.md`
- `docs/specs/README.md`
- `.agents/handoffs/2026-09-02-integraciones-configuracion-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- Supabase requiere URL y anon key.
- Resend webhook requiere API key y secret.
- Telegram webhook requiere bot token y secret.
- HailuWay requiere base URL y API key.
- SeaRates requiere base URL, platform ID y API key.
- Los tests focales, TypeScript, ESLint, documentación y diff pasan localmente.
- No se modifica configuración alojada ni se consulta un proveedor externo.

## Fuera de alcance

- Probar credenciales o disponibilidad real de proveedores.
- Configurar variables en Vercel o en otro entorno alojado.
- Rediseñar `/studio/debug` o cambiar sus permisos.
