---
sdd: "0375"
title: Reserva atómica del verificador público
status: in-progress
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0374"]
confidencialidad: interno
---

# SDD-0375 — Reserva atómica del verificador público

> **Nota de importación — 2026-09-11; actualizada el 2026-09-12.** Esta spec se importa desde la
> PR #21 con su contenido original, `status: in-progress` incluido, que refleja su estado **en la
> rama de origen**. Su migración `0426_public_verify_atomic_reservation` **fue APLICADA a
> producción el 2026-09-12** con OK nominal de Sam (ledger `20260912022928 /
> 0426_public_verify_atomic_reservation`), con el archivo de esta rama idéntico al aplicado (md5
> `8e4f06a4ce6f02dfb0aa2af683a92e37`, 5622 B); esta ronda queda asentada en
> `.agents/handoffs/c-l17-verificar-throttle.md`. Por eso 0426 ya **no** figura como espera en
> `supabase/migrations-baseline.json` ni tiene declaración en
> `supabase/pending-migration-symbol-declarations.json`. El orden migrate-first se cumplió: la RPC
> `reserve_public_verify_attempt(text)` existe en la base —SECURITY INVOKER, EXECUTE sólo para
> `service_role`— antes de fusionar el código que la consume, así que `/verificar` reserva su cupo
> en vez de bloquear toda verificación. `status: in-progress` se conserva a propósito: la
> aceptación de release/smoke posdespliegue sigue abierta y no la decide esta rama. Corte focal
> L17: no se importan el cableado del runner en `scripts/verify.mjs` ni su test, ni las auditorías
> o el handoff de la rama de origen.

## Fuente y autorización

Continuación de la cola local pedida por Sam. SDD-0374 bloqueó errores, pero
dos lectores concurrentes en 39 aún permiten 41 registros. El único escritor
de aplicación localizado en app/lib/supabase/scripts es isVerifyThrottled;
el consumidor único está en app/verificar/page.tsx.
pnpm sdd:next consultó 15 refs con fetch: libres 0375 y 0426. No reserva remota.

Sólo implementación y pruebas locales. No aplicación Cloud, datos reales,
push, integración main, despliegue ni limpieza de worktrees. El objetivo
original sigue blocked en la app; no se duplica ni se modifica por otra vía.

## Contrato

1. RPC public.reserve_public_verify_attempt(p_ip text) → boolean.
   true sólo tras INSERT; false ante cupo agotado o entrada inválida.
   Límite fijo: 40 intentos dentro de los últimos 30 minutos.
2. Lock transaccional por clave textual IP, conteo e INSERT en la misma
   transacción. Hora de servidor obtenida después del lock; tiempo de espera
   de locks limitado a 2 segundos, no promesa de deadline de toda la petición.
3. VOLATILE, SECURITY INVOKER, search_path vacío; EXECUTE revocado a PUBLIC,
   anon y authenticated, concedido a service_role. No elevar a DEFINER.
   Mantener RLS, ACL de tabla, índices, columnas, triggers e históricos.
4. Exigir READ COMMITTED; aislamientos con snapshot fijo se rechazan,
   evitando que una lectura posterior al lock siga viendo un conteo viejo.
5. Admitir unknown o IP v4/v6 sintácticamente válida, máximo 64 caracteres,
   sin espacios, CIDR, zone ID, listas ni controles. Conservar el texto exacto.
   La atomicidad es por clave textual, no certifica identidad del visitante,
   canonicalización IPv6 ni confianza del proxy.
6. isVerifyThrottled conserva booleano de bloqueo: sólo error:null y data:true
   de la RPC permiten false. Ausencia, null, forma desconocida, error,
   excepción o respuesta falsa bloquean. No fallback count+insert.
   No imprimir IP, folio, mensajes del proveedor ni otros datos personales.
7. El archivo de migración es expansivo, sin DML de negocio ni borrado.
   Preflight rechaza estructura/roles/RLS incompatibles y funciones ajenas;
   reejecutar sólo sobre la misma definición propia. No alterar 0169 aplicada.

## Release y límites

0426 se aplicó y verificó nominalmente el 2026-09-12, antes de fusionar este
consumidor (ledger 20260912022928). Sin RPC el consumidor bloquea de forma
segura: ese orden es el que hay que conservar en cualquier reaplicación.
La coexistencia con una versión antigua que escribe directamente no ofrece
la garantía nueva. service_role conserva sus privilegios previos de tabla:
este slice no pretende impedir escrituras administrativas fuera de la RPC.

No modificar getRequestIp: también alimenta registro, accesos, marca,
sesiones móviles y evidencia de aceptaciones. Sus comentarios no prueban la
configuración alojada del proxy. No probar diplomas ni alumnos reales.
El cron purge-throttle sólo incluye portal_registro_throttle y
operario_pin_attempts; no incluye public_verify_throttle. La retención de esta
última queda como deuda separada: no se inventa un plazo ni se borra historial.

## Allowlist y ownership

- supabase/migrations/0426_public_verify_atomic_reservation.sql: principal.
- lib/public/verify-throttle.ts: principal.
- lib/public/verify-throttle.test.ts: pruebas independientes.
- supabase/tests/0426_public_verify_atomic_reservation.test.sql: pruebas independientes.
- scripts/check-public-verify-concurrency.mjs: pruebas independientes; contenedor propio.
- scripts/verify.mjs: principal; ejecutar el contrato concurrente en el gate.
- __tests__/public-verify-concurrency-gate.test.ts: principal; wiring y salidas del runner.
- Esta spec y docs/specs/README.md generado: principal.
- docs/audits/2026-09-03-public-verify-atomic-local.md: principal.
- docs/audits/2026-09-03-public-verify-local.md: continuidad histórica; principal.
- docs/audits/2026-09-02-codex-arranque-checklist.md: principal.
- .agents/handoffs/2026-09-02-saneamiento-integral-close.md: principal.
- supabase/tests/0426_reserva_verificacion_carrera.test.sql: concurrencia real en la suite SQL (seguimiento 2026-09-18).
- .agents/handoffs/0375-carrera-reserva-0426.md: handoff de ese seguimiento.

## Pruebas y aceptación local

- [x] RED causal del wrapper y carrera con dos conexiones PostgreSQL reales.
- [x] GREEN: límites, ventana, inválidos, errores y respuesta booleana estricta.
- [x] Concurrencia: último cupo único; otra IP independiente; rollback y espera.
- [x] Permisos reales, invoker, aislamiento, preservación, drift y reejecución.
- [x] SQL general, rebuild, tipos, lint, suite y gate proporcional; informar SKIP.
- [x] Evidencia y conservación local selectiva; no aumentar contador original por un subpaso.
- [x] Aplicación 0426: aplicada a producción el 2026-09-12 (ledger 20260912022928).
- [ ] Release/smoke posdespliegue: gate externo independiente, fuera de esta rama.

Checkpoint47b1dd0b. El gate inicial pasó 168 contratos SQL, concurrencia,
rebuild423 y build158; falló por timeouts de worktrees. SDD-0376 corrigió ese
arnés y la suite completa posterior pasó 6.936/6.936 con configuración original.
E2E150/18 tuvo dos timeouts globales; migrations-applied SKIP. Evidencia
agregada, no un segundo verify integral ni verificación de Cloud.

**Corrección de estado (2026-09-18):** la evidencia de concurrencia de este
gate no estaba en `main`. El cableado de `scripts/verify.mjs` y
`__tests__/public-verify-concurrency-gate.test.ts` quedaron en `47b1dd0b`, sin
importar. En `main`, `scripts/check-public-verify-concurrency.mjs` existe pero
no corre en `verify`, y por defecto usa `postgres:17-alpine`, que el runner no
descarga: en esta máquina hace SKIP. Desde hoy cubre sus escenarios
`supabase/tests/0426_reserva_verificacion_carrera.test.sql`, en el paso
`sql-tests` de `verify` (no en CI): último cupo con commit y con rollback, otra
IP independiente, reloj posterior al lock, `lock_timeout` y sólo READ COMMITTED.
El script se conserva; retirarlo es una decisión aparte.

## Gobernanza y privacidad del delta

| Principio | Clasificación y evidencia prevista |
|---|---|
| SGE-00.01 | cumplimiento: mismo booleano/estado neutro del consumidor |
| SGE-00.02 | cumplimiento: migración sin DML e históricos preservados |
| SGE-00.03 | no aplica nueva permanencia/finanzas; reserva técnica acotada |
| SGE-00.04 | cumplimiento acotado: intento y aceptación en la misma transacción; no certifica auditoría de lectura del diploma |
| SGE-00.05 | cumplimiento: ACL, RLS invoker y rechazo antes del lookup |
| SGE-00.06 | cumplimiento: validación y cuota antes del INSERT |
| SGE-00.07 | cumplimiento: sólo reserva confirmada permite continuar |
| SGE-00.08 | no aplica flujo nuevo; mismos pasos para la persona |
| SGE-00.09 | cumplimiento: un único wrapper y una RPC, sin fallback divergente |
| SGE-00.10 | no aplica modificación visual o de interacción |
| SGE-00.11 | cumplimiento: conservar mensaje neutro y aviso diagnóstico mínimo |
| SGE-00.12 | cumplimiento: permisos externos conservados |

ERR-01: fallo seguro y mensaje genérico. AUD-01/02: no copiar PII a logs,
no convertir throttle en auditoría integral ni alterar retención.
Revisar-datos-ve se aplica técnicamente a IP/fecha ya existentes: sin campos,
destinatarios, finalidades ni capturas nuevos. Evaluación legal fuera de alcance.
CORRECTO/ENCONTRADO/NO VERIFICABLE se documentarán con evidencia; no certificación.

## Fuentes técnicas

- [Funciones y permisos Supabase](https://supabase.com/docs/guides/database/functions).
- [Locks transaccionales PostgreSQL 17](https://www.postgresql.org/docs/17/explicit-locking.html).
- [Aislamiento PostgreSQL 17](https://www.postgresql.org/docs/17/transaction-iso.html).

## Reversión

Revertir el consumidor reabre la carrera de SDD-0374. No borrar la tabla
ni sus filas como rollback. La función aditiva puede permanecer sin consumidor;
cualquier retiro alojado necesita autorización nominal y revisar dependencias.
