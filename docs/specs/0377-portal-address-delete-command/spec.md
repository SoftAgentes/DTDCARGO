---
sdd: "0377"
title: Borrado logico de direcciones Portal confirmado y auditable
status: in-progress
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0268", "0372"]
confidencialidad: interno
---

# SDD-0377 — Borrado lógico de direcciones Portal

> **Nota de importación — 2026-09-10, actualizada el 2026-09-11.** Esta spec se importa
> desde la PR #21 con su contenido original. Su migración `0427_portal_delete_delivery_address_command`
> **fue APLICADA a producción el 2026-09-11 con OK de Sam nombrándola**, antes de fusionar
> esta PR y para no dejar el Portal llamando una RPC inexistente.
> Ledger: `20260911041034 / 0427_portal_delete_delivery_address_command`.
> Por eso **no figura** en `pendingBelowCutoff`.

## Fuente, alcance y permisos

Continuación explícita de la cola local de saneamiento. La política SELECT
del Portal oculta deleted_at no nulo y bloquea también el UPDATE de borrado
(42501 reproducido con PostgreSQL17 y migraciones reales). El consumidor
silencia la excepción y no comprueba filas afectadas. No ampliar SELECT ni
usar service_role en el consumidor. La función compartida del Studio no cambia.

pnpm sdd:next consultó 15 refs: spec0377 y migración0427 disponibles.
No reserva remota. Sólo implementación y pruebas locales sintéticas.
0427 NO está autorizada en Cloud. Push nuevo, main, despliegues, datos reales,
limpieza final y reanudación automática del objetivo conservan sus gates.

## Contrato

- RPC pública delete_portal_delivery_address(uuid, uuid), INVOKER; comando
  privado DEFINER postgres, search_path vacío y lock_timeout de 2 segundos.
  EXECUTE sólo authenticated, no PUBLIC, anon ni service_role.
- Identidad únicamente auth.uid; exige client_users activo y cliente vivo con
  tenant coherente. SHARE en vínculo y cliente, UPDATE en dirección; revalidar
  propiedad después de esperar. No acepta identidad/tenant del formulario.
- Sólo la dirección propia exacta (id/client_id/tenant_id/markbox). Ajena,
  inexistente o principal inactivo devuelve false sin distinguir causas.
  Repetir sobre histórica propia devuelve true sin tocarla ni duplicar evento.
- Sólo cambia deleted_at con reloj servidor; updated_at por trigger existente.
  No modifica is_default, no restaura, no crea otra dirección predeterminada.
- Evento AUD-01 atómico con borrado: client_delivery_address /
  portal_delivery_address_deleted, actor user/auth.uid, source rpc,
  correlación UUID servidor. Razón fija de intención R2. Antes/después sólo
  deleted_at e is_default; sin texto postal, etiquetas, email, IP o credenciales.
  AUD-02: P2, retiro de lista activa, histórico conservado, recuperación mediante
  revisión de soporte (no se promete capacidad automática).
- Error del escritor de auditoría, resultado nulo o espera de lock fallida:
  rollback íntegro; no devolver éxito. La RPC no permite borrado físico.
- Registra un tipo en audit_entity_types, sin alterar políticas, grants,
  triggers ni datos de negocio existentes. Falla si el namespace/RPC ya existe;
  no reemplaza objetos de procedencia desconocida.
- Server Action valida UUID y cardinalidad, usa cliente de sesión y sólo
  considera éxito data===true sin error. Sin fallback legacy ni admin.
  Mensaje recuperable y correlación; logs sin contenido del proveedor/PII.
  Revalidación de caché fallida después de commit no falsea el resultado.
- Conserva confirmación inline de SDD0268. Durante envío bloquea doble envío
  y cancelar esa operación. Error persistente, accesible y enfocado; permite
  reintentar. Nunca retira la fila antes de confirmación durable.

Bloquear vínculo antes de cliente puede contender con merge de clientes
(orden inverso): se admite aborto recuperable/rollback, no promesa de ausencia
de deadlocks. No se aumenta ningún timeout para ocultar fallos.

## Allowlist y ownership

- supabase/migrations/0427_portal_delete_delivery_address_command.sql: principal.
- supabase/tests/0427_portal_delete_delivery_address_command.test.sql: regresión SQL independiente.
- scripts/check-portal-address-concurrency.mjs: principal, PostgreSQL sintético.
- scripts/check-portal-address-browser.mjs: prueba independiente del componente real.
- scripts/e2e/portal-address-browser-fixture.tsx: fixture sintética, sin ruta de producto.
- scripts/verify.mjs: sólo cableado de ese gate si procede.
- app/portal/(app)/perfil/address-actions.ts: principal, sólo borrado y su estado.
- app/portal/(app)/perfil/address-actions.delete.test.ts: principal.
- app/portal/(app)/perfil/PortalAddresses.tsx: principal, estado del borrado.
- app/portal/(app)/perfil/PortalAddresses.delete-state.test.tsx: regresión UI independiente.
- Esta spec y docs/specs/README.md generado.
- docs/audits/2026-09-03-portal-address-delete-local.md.
- docs/audits/2026-09-02-codex-arranque-checklist.md.
- .agents/handoffs/2026-09-02-saneamiento-integral-close.md.
- supabase/tests/0427_borrado_direccion_carrera.test.sql: concurrencia real en la suite SQL (seguimiento 2026-09-18).
- .agents/handoffs/carrera-0421-0427.md: handoff de ese seguimiento.

## Aceptación

- [x] RED SQL causal del UPDATE con RLS real, sin simular la política.
- [x] RED UI/action y GREEN sin bajar aserciones.
- [x] SQL real: matriz identidad/tenant/propiedad, idempotencia, ACL, postestado
      y rollback de auditoría. Políticas y permisos previos preservados.
- [x] Concurrencia real: revalidación tras revocación/transferencia, dos borrados,
      commit/rollback y timeout acotado; no eventos duplicados.
      Corrección de estado (2026-09-18): la evidencia previa no estaba en
      `main`, porque `scripts/check-portal-address-concurrency.mjs` no se
      importó. Desde hoy la cubre `supabase/tests/0427_borrado_direccion_carrera.test.sql`,
      con los ocho escenarios, en el paso `sql-tests` de `verify` (no en CI).
- [x] Unitarios, tipos, lint, docs, componentes y gobernanza.
- [x] Browser local con datos sintéticos, sin consultar filas reales.
- [x] Evidencia y pendientes explícitos; Cloud permanece no aplicado.

La suite Portal pasa27casos. El gate previo tuvo tres timeouts del CLI;
SDD0378 lo ejecuta después del grupo paralelo y la suite nueva pasa7066/7066,
550archivos,390,65s. SQL169/rebuild424 y build158 pasan. Sigue E2E con150/18
y2errores globales, ahora correctamente rojo. No declarar cierre ni release.

## Gobernanza aplicable (evidencia final en acta)

SGE00.01/11: verbo y consecuencia explícitos. 02/06/07: conservación y estado
durable. 03: P2/R2. 04: auditoría atómica. 05: identidad y permisos negativos.
08: conserva dos pasos. 09: excepción inline heredada SDD0268, sin importar
Studio; reutiliza PortalFieldError. 10: teclado/foco/alert medidos; no se
certifica WCAG completa. 12: autorización local conservada, sin gates externos.
MP01: P2, sin borrado físico. ERR01/FRM01/BTN01/LOD01: error recuperable,
submit/cancel coherentes y estado pendiente. AUD01/AUD02: evento y disposición
mínima sin payload postal. Restauración automática y decisión de qué dirección
pasa a predeterminada permanecen fuera de alcance: no presentarlas como
capacidades existentes ni como cumplimiento demostrado.
