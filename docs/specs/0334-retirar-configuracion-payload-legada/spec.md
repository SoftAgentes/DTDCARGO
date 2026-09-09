---
sdd: 0334
title: Retirar la configuración activa del Payload CMS descontinuado
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0003
  - SDD-0333
confidencialidad: interno
---

# SDD-0334 — Retirar la configuración activa del Payload CMS descontinuado

## Estado real

El intento histórico de Payload CMS está descontinuado. El checkout vigente no
contiene paquete Payload, `payload.config`, árbol runtime activo ni lecturas de
`DATABASE_URL`, `PAYLOAD_SECRET` o las variables genéricas `S3_*`.

## Problema

`.env.example` todavía pedía base de datos, secreto y credenciales S3 para ese
CMS. `/studio/debug` también contaba `DATABASE_URL` y `PAYLOAD_SECRET` como
variables observadas. Esto mezclaba infraestructura muerta con el contrato real
de Supabase y con el piloto vigente de adjuntos `DTD_ATTACHMENTS_*`.

## Decisión

1. Retirar el bloque Payload/Postgres/S3 de `.env.example`.
2. Dejar de presentar `DATABASE_URL` y `PAYLOAD_SECRET` en `/studio/debug`.
3. Mantener intacta la evidencia histórica en Git, specs y archivos de archivo.
4. No tocar las variables `DTD_ATTACHMENTS_*` ni proveedores de adjuntos.

## Evidencia de ausencia

- Cero accesos runtime a las siete variables retiradas en `app/`, `lib/`,
  `scripts/`, `supabase/` e `infra/`.
- Cero paquete `payload` o `@payloadcms/*` en `package.json` y `pnpm-lock.yaml`.
- Cero `payload.config` o directorio Payload activo en el árbol versionado.

## Gobernanza

- `cumplimiento`: el contrato de entorno refleja únicamente dependencias vivas.
- `cumplimiento`: se evita confundir el S3 legado con adjuntos fail-closed.
- `no aplica`: comportamiento de usuario, migraciones, Cloud o Producción.

## Allowlist exacta

- `.env.example`
- `lib/studio/env-status.ts`
- `lib/studio/__tests__/env-status.test.ts`
- `docs/specs/0334-retirar-configuracion-payload-legada/spec.md`
- `docs/specs/README.md`
- `.agents/handoffs/2026-09-02-payload-legado-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- `.env.example` no declara variables exclusivas del Payload descontinuado.
- `/studio/debug` no cuenta esas variables como configuración activa.
- El test focal, TypeScript, ESLint, documentación y diff pasan localmente.
- No se borra evidencia histórica ni se toca configuración alojada.

## Fuera de alcance

- Reactivar o rediseñar un CMS.
- Borrar variables que puedan existir en Vercel; al no tener consumidores son
  inertes y su limpieza alojada requiere un gate separado.
- Modificar el piloto vigente de adjuntos o sus credenciales.
