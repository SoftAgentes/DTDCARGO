---
sdd: 0325
title: Throttle fail-closed para el acceso CBM interno
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0317
  - SDD-0042
confidencialidad: interno
---

# SDD-0325 — Throttle fail-closed para el acceso CBM interno

## Problema

`POST /admin/cbm-estudio` valida una credencial global y, cuando coincide,
acuña una sesión de ocho horas. SDD-0317 retiró el secreto de la URL, pero el
formulario todavía permite intentos ilimitados por IP. Esto deja una superficie
de fuerza bruta y consumo repetido sin una barrera server-side.

## Modelo de amenaza

- Frontera: request HTTP público con IP y `token` no confiables.
- Activos: credencial interna, sesión firmada y disponibilidad de la
  presentación.
- Abuso principal: adivinar la credencial o saturar el POST con repeticiones.
- Elevación: una coincidencia entrega acceso durante ocho horas.
- Divulgación: respuestas, logs, cookie y clave de throttle no deben contener la
  credencial ni la IP en claro.

## Contrato

1. El POST admite como máximo cinco intentos por IP en cada ventana fija de 15
   minutos, incluso cuando llegan en paralelo.
2. La clave persistida usa namespace `cbm-estudio:` y SHA-256 de la IP resuelta;
   nunca guarda la IP en claro.
3. Cada ventana dispone de cinco UUID determinísticos derivados de la clave y
   el índice del slot. La unicidad del PK existente decide atómicamente qué
   solicitudes ocupan los slots, sin carrera `count → insert`.
4. Cada intento admitido se registra antes de comparar la credencial,
   incluyendo intentos válidos, inválidos o formularios malformados.
5. Al alcanzar el límite responde `429`, no acuña cookie e incluye
   `Retry-After: 900`.
6. Si el cliente privilegiado o el registro no están disponibles, el
   acceso falla cerrado con `503` y sin formulario reutilizable.
7. El contenido y la sesión existente continúan sirviéndose sólo mediante GET
   con cookie firmada vigente.
8. No se agrega migración: se reutiliza `portal_registro_throttle`, protegida por
   RLS y accesible sólo mediante `service_role`.

## Gobernanza

- `cumplimiento`: ERR-01; errores de seguridad mínimos, persistentes y sin
  detalles internos.
- `cumplimiento`: FRM-01; validación server-side y bloqueo de repetición.
- `cumplimiento`: LOD-01; no hay estado optimista ni doble mutación permitida.
- `cumplimiento`: minimización; IP hasheada y secreto nunca persistido.
- `no aplica`: cambios visuales, nuevos datos de negocio, migraciones y Cloud.

## Allowlist exacta

- `app/admin/cbm-estudio/route.ts`
- `app/admin/cbm-estudio/route.test.ts`
- `docs/specs/0325-throttle-acceso-cbm/spec.md`
- `docs/specs/README.md`
- `.agents/handoffs/2026-09-02-cbm-estudio-throttle-close.md`

## Aceptación

- Intento válido bajo el límite conserva la cookie segura y la URL limpia.
- Intento inválido bajo el límite registra sólo la clave hasheada.
- Un burst de seis solicitudes ocupa cinco slots y devuelve un solo 429.
- Fallos de cliente o insert responden 503 sin comparar/acceder.
- Tests focales, TypeScript, lint, documentación, gobernanza y gate canónico
  pasan sin regresiones.
