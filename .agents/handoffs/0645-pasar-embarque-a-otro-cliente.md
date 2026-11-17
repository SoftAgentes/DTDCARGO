# Handoff · SDD-0645 — Pasar embarque a otro cliente

- **Owner:** Worker (sesión «reasignar-embarque»), encargado por el Subdirector Portal; números del DG.
- **Ruta:** `.claude/worktrees/reasignar-embarque-5e850d` · **Rama:** `claude/reasignar-embarque-5e850d` · base `main`.
- **SDD:** `docs/specs/0645-pasar-embarque-a-otro-cliente/spec.md` · **Migración:** `0551_pasar_embarque_a_otro_cliente` (sin aplicar).
- **Permisos del encargo:** push de la rama propia y PR a `main`. Sin merge, sin producción, sin aplicar migraciones.

## OBJETIVO ORIGINAL

Pedido de Sam (2026-11-16): que Alejandro, de operaciones, pueda pasar adentro del ERP las líneas sin código del
consolidado 64 (cargadas en la ficha provisional) a su dueño real. Hoy el Studio no permite cambiar el cliente de un
embarque.

## COMPLETADO

- Spec con allowlist exacta y decisiones (§4); D1 (código del embarque) y D2 (`commercial`) quedan para Sam.
- Migración 0551: `reassign_shipment_client(uuid, uuid, text, boolean)` SECURITY DEFINER, `search_path` vacío,
  EXECUTE sólo `authenticated`, gate interno (operations/admin activo, tenant de la sesión, embarque y cliente del
  mismo tenant), vista previa, bloqueos, todo o nada, evento `shipment_client_reassigned`.
- Desarme `supabase/desarmes/0551_desarme.sql`; espera en `migrations-baseline.json`; degradación declarada.
- Contrato `supabase/tests/0551_…test.sql` (con `alter default privileges` como el de la 0532) y su runner PGlite
  con control rojo y mutantes.
- Acción RBAC `reassign_shipment_owner` (operations + admin), dos server actions, panel y modal en el detalle.

## VALIDACIÓN

En esta PC (Windows), con el turno del DG, 2026-11-16:

| Comprobación | Resultado |
|---|---|
| Contrato 0551 en PGlite: verde (77 aserciones), control rojo y 21 mutantes | PASÓ (23/23) |
| Vitest del cambio: RBAC, inventario de acciones, textos, actions, panel | PASÓ (5 archivos, 558) |
| `ocultar-nombres-cn.test.tsx` (China no ve el panel; Venezuela sí) | PASÓ |
| `spec-migration-refs.test.ts` | PASÓ (tras nombrar el desarme sin extensión) |
| `pending-migration-symbols` | PASÓ: 0 ROJO · 1 AMARILLO declarado (0551) |
| numbering, docs:check, governance:check, components:check, build | PASÓ |
| `pnpm verify` → test | FALLÓ por carga y un test ajeno; ver abajo |
| sql-tests y schema-rebuild (Docker) | NO DISPONIBLE (sin Docker) |
| migrations-applied | NO DISPONIBLE (sin credenciales en el worktree) |
| Concurrencia real (FOR UPDATE) | NO VERIFICADO |
| `/ui-check` | OK con ajustes menores (px fijos como el FooterActions vecino) |

Los fallos de `verify` que no son de este cambio: los scripts bash con dobles (`migraciones.test.mjs`,
`entorno-prueba-scripts.test.mjs`) cortaron a los 600 s; `PackingListProductsStep`, `standard-format`,
`la-accion-lanza` y `DocumentReviewClient` pasan aislados (timeouts por carga). `solo-superadmin-crea-admin` ›
«la app invita solo por audit_d1_execute» se pasa de 20 s también aislado: recorre ~3.100 archivos de
`lib/app/components`; este cambio suma 3. Queda para el CI de Linux.

## D1 de Sam (2026-11-16)

Registrada literal en la spec §4.4. Implementada: `ClienteCambiado.tsx` (anterior tachado, «nuevo» con explicación del
código, historial) y `lib/studio/reasignar-historial.ts` (lectura acotada de `shipment_client_reassigned`). Sus
pruebas (`reasignar-historial.test.ts`, `ClienteCambiado.test.tsx` y las aserciones nuevas de `ocultar-nombres-cn`)
se escribieron sin correr: esperan el turno de PC del DG; mientras, el portón es el CI.

## PENDIENTES DE ESTA TAREA

- D2 (`commercial`) sin respuesta: rige la recomendada. D3 (¿el Portal muestra la trazabilidad?) abierta para Sam.
- Aplicar la 0551: OK nominal de Sam en el chat del DG + runbook. Migrate-first.
- Concurrencia real (dos personas pasando el mismo embarque a la vez): NO VERIFICADO; PGlite tiene una conexión.

## FUERA DE ALCANCE DETECTADO

- Asignar una recepción CN huérfana que no está en un embarque: no hay flujo en `cn/actions.ts`.
- `updateInvoice` (`facturacion/actions.ts`) cambia el texto del cliente de un borrador sin alinear el embarque.
- `merge_clients` (0361) no mueve embarques, facturas ni recepciones.

## Impacto documental

- Spec nueva y su índice (`docs/specs/README.md`). Ningún documento canónico más cambia: la regla de permisos vive
  en `lib/studio/rbac.ts` y en la migración.
- Privacidad: no se capturan datos personales nuevos; el evento guarda sólo Shipping Marks. El panel no se muestra al
  equipo de China (SDD-0531) porque el buscador muestra nombres.
