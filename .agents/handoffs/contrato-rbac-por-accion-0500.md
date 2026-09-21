# Handoff — SDD-0500 · El anti-drift de RBAC mide por acción, no por archivo

- **Rama:** `claude/nice-clarke-4ab6eb`
- **Worktree:** `.claude/worktrees/jovial-lovelace-6d8291`
- **Base:** `main` `d9adbabf` (sin traer main después; el worktree arrancó en ese SHA)
- **Reserva SDD:** `codex/sdd-reserve-0500-contrato-rbac-por-accion` (local, sin push)
- **Spec:** [`docs/specs/0500-contrato-rbac-por-accion/spec.md`](../../docs/specs/0500-contrato-rbac-por-accion/spec.md)
- **PR:** no abierta. Cierre del día; el Director integra.

## HECHO Y COMPROBADO

### 1. El hueco real: `tracking/[id]/document-actions.ts`

Las dos mutaciones no tenían gate ninguno y el archivo no lo miraba nadie (no se
llama `actions.ts`). Pasan a `moduleEditGate(supabase, "tracking")`; el borrado
además acota por `tenant_id` del gate.

**Corrección a MI propia prosa (2026-09-21, tras el dato del Director):** escribí
que la relectura de `user_tenants` de la subida «prestaba el tenant del primer
miembro que hubiera y dejaba subir a un suspendido». **No era así.** La policy
viva en producción es `using ((user_id = (SELECT auth.uid())) AND (disabled_at IS
NULL))` —catálogo leído por el **Director**, no por esta tarea—, así que la
consulta sólo podía devolver la propia membresía activa. Era **redundancia
perdida**. Lo que de verdad faltaba en esa acción era el **gate de módulo**. Es
la misma distinción que le hice yo al parte del borrado, aplicada a mí: corregido
en el comentario del código, en la prueba y en la spec.

**Corrección al parte de origen, verificada:** el borrado **sí** hace soft-delete
de la fila; lo irreversible es el `storage.remove()` del objeto. Y **no** era un
agujero abierto: la migr `0439_shipment_document_entity_rbac.sql` ya protege la
tabla y el bucket con `document_entity_authorized('shipment', …, 'edit')`, que
exige `role <> 'support'` y `disabled_at is null`. Era **defensa en profundidad
perdida**, no incidente. Lo que sí estaba roto de cara al usuario: un `update`
que la RLS rechaza devuelve 0 filas **sin error**, así que un `support` recibía
`{ ok: true }` mientras no se borraba nada.

**Evidencia.** `app/studio/(app)/tracking/[id]/__tests__/document-actions-rbac.test.ts`,
escrita antes del arreglo:

```
antes: Tests  10 failed | 4 passed (14)
ahora: Tests  14 passed (14)
```

El perfil del rojo es el dato: el **borrado** falla los 5 casos de denegación
—incluidos «sin sesión» y «sin membresía», porque no miraba ninguna—, y la
**subida** pasa esos dos y falla `support`, `marketing`, `admin suspendido` y el
caso de que el tenant salga de la membresía de **otro** usuario.

### 2. El contrato

`lib/studio/rbac-actions-guard.test.ts` reescrito sobre
`lib/studio/__tests__/rbac-action-scan.ts` (AST con el compilador de TypeScript)
y `rbac-action-files.ts` (la superficie).

Dos reglas que fallan por caminos distintos: **(A)** un guard incondicional
domina el primer acceso; **(B)** si la acción escribe, un guard de **edición**
domina la primera escritura. La B existe para no poner en rojo los lectores que
SDD-0494/0497 gatearon a propósito con `moduleViewDenial` —son **7**— sin dejar
que un gate de vista habilite una mutación.

**Números medidos con el alcance del escáner** (`app/studio/(app)/**`, sin
`__tests__` ni `_components`), no heredados:

```
ARCHIVOS=73 (54 exactos + 19 *-actions.ts)   ACCIONES=427   SIN CANDADO=39
```

Las 39 entran en dos listas con motivo escrito por entrada: `EXCEPCIONES` (15,
candado verificado con otro nombre) y `DEUDA` (24, falta o es artesanal). Los
totales van **aparte** del veredicto por acción, más aserciones de entradas
huérfanas y de motivos-placeholder.

**Evidencia.**

```
lib/studio/rbac-actions-guard.test.ts        → 432 passed (427 acciones + 5 meta)
lib/studio/__tests__/rbac-action-scan.test.ts →  51 passed
focales del diff (4 archivos)                 → 510 passed
tsc --noEmit                                  → exit 0
eslint sobre los 7 archivos tocados           → exit 0
docs:check                                    → exit 0 (índice regenerado con `pnpm docs:index`)
sdd:check                                     → exit 0
```

### 3. Mutantes (sólo del diff)

| Sobre | Resultado |
|---|---|
| analizador, 15 mutantes | **15 de 15 mueren** |
| contrato, 4 mutantes | **4 de 4 mueren**, y la aserción **vieja** seguía en verde en los cuatro |

Los cuatro del contrato: abrir el borrado de documentos; mover un guard después
de la escritura; abrir **una** acción entre otras siete gateadas; abrir una
acción de un `*-actions.ts`. Es la prueba de que los tres defectos se cerraron.

El mutante que sobrevivió en la primera vuelta (`auth.getUser` como acceso) no
era prueba faltante: era **código que sobraba**. Al hacerlo portante apareció un
hueco real, `auth.updateUser` no contaba como escritura.

Scripts de mutación en el scratchpad de la sesión (no versionados); se rehacen
desde la tabla de la spec.

### 4. Correcciones al inventario de SDD-0498 que el encargo repetía

Verificadas leyendo el código. **Tres entradas no son puertas abiertas:**

- `admin/calculator-actions.ts:63` — `resolveTenantAdmin` corre **después** de
  `moduleEditDenial(supabase, "admin")`; `admin` es `ADMIN_ONLY` y `LOCKED`, así
  que el `isAdmin` de `:201/:241/:273` es redundante. Resolución de tenant.
- `tarifas/actions.ts:297` — copia literal, detrás de `moduleEditDenial(…,
  "rates")`; su `isAdmin` ni se usa.
- `crm/actions.ts:123/:213/:272` — **ya cerradas por SDD-0497 (PR #180)**. Las
  tres tienen `moduleEditDenial(supabase, "kommo")` al tope (hoy `:182`, `:272`,
  `:333`); los números del inventario son de antes de esa PR.

## PENDIENTES DE ESTA TAREA

1. **`lib/studio/renditions/actions-helpers.ts:58`** (`resolveAdminTenant`, sin
   `user_id` ni `disabled_at`; dinero + módulo `SUPERADMIN_ONLY`). Está en mi
   frontera y **no llegué a revisarlo** por el cierre. Es el de mayor valor
   pendiente.
2. **Vaciar la `DEUDA` (24 entradas).** El orden que sugiere lo observado:
   `documentos/signDocumentUrl` (firma **cualquier** `storagePath` del bucket sin
   validar path ni rol), `gastos/exportExpensesCsvAction` (saca un archivo con
   los gastos del mes con sólo sesión), `nomina` ×2 (dinero + PII), las cuatro de
   `usuarios` que parecen ser del propio usuario pero cuyo alcance **no
   verifiqué** — por eso están en `DEUDA` y no en `EXCEPCIONES`.
3. ~~`pnpm verify` completo no se corrió~~ → **CORRIDO** el 2026-09-21 con turno
   del Director. Veredicto abajo.
4. ~~Traer `main`~~ → **HECHO dos veces** (merge con el driver, nunca rebase), la
   segunda sobre `0807b69d`. El índice lo resolvió el driver y `pnpm docs:index`
   no tuvo nada que corregir; `docs:check` y `sdd:check` en 0.

## VERDICTO DE `pnpm verify` (2026-09-21, sobre `4dda15f7`)

**Exit real 1**, 16 de 17 pasos corrieron. Terminó 18:12:07Z.

**El exit hay que leerlo del archivo donde se captura `$?`.** La notificación del
harness informó «exit code 0» y era el del `date` con que cerré la cadena. Ver
[[una-corrida-pesada-a-la-vez]] y el aviso del Director: hoy la última orden de
una cadena se llevó el crédito del exit cuatro veces.

| Paso | Resultado |
|---|---|
| harness · lint · rsc-boundary · typecheck · edge-functions · test · docs:check · numbering · feature-constants · components:check · governance:check · pending-migration-symbols · sql-tests · schema-rebuild · **e2e** | **PASÓ** (15) |
| migrations-applied | **SKIP** — sin `.env.local`. No se afirma nada sobre producción. |
| build | **FALLÓ** (exit 1) — 18 errores de Turbopack, todos `next/font/google` |

Dos fallos que el Director anticipó **no aparecieron**: el flake de `harness`
(`verify-watchdog.node.mjs:248`) y el «pasó con aviso» de `e2e` por el worker de
WebKit. Con la máquina libre, los dos pasaron limpios — lo que refuerza que son
de contención.

### El rojo de `build`: local, no reproducido, no bloquea

**Tres builds en frío del mismo árbol salieron verdes:** el paso
`node scripts/check-build.mjs` del CI sobre este SHA, el deploy de Vercel sobre
este SHA, y una corrida local del mismo script (exit 0, 22,0 s, 162 páginas).
Los seis archivos que el error nombra —`lib/fonts.ts`,
`app/portal/(app)/layout.tsx`, `next.config.ts`, `pnpm-workspace.yaml`,
`pnpm-lock.yaml`, `package.json`— son **idénticos a `origin/main`**. Apunta a la
red hacia Google Fonts en un build en frío desde Windows.

**Una explicación que armé y hubo que retirar**, porque el error vale más que el
acierto: el log avisa «multiple lockfiles» y Turbopack elige el checkout
principal como raíz (este worktree vive dentro de `.claude/worktrees/`). Encajaba
con el síntoma y estaba citada. **Es falsa:** ese mismo aviso aparece en las
corridas de build que salieron VERDES. Una explicación que encaja con el síntoma
no es una causa hasta que se la enfrenta a un caso donde el síntoma no está.

Y el primer reintento local **no fue un control limpio**: reusó el `.next`
caliente, mientras que `verify` construye en frío en `.next-verify`. El control
que valía fue correr `scripts/check-build.mjs` solo.

## FUERA DE ALCANCE DETECTADO

### Frontera con la sesión «Endpoints HTTP» [33de82] — NO tocado

El Director asignó `app/api/**` a esa sesión. Del inventario de SDD-0498 quedan
allá, sin revisar por mí:

- `app/api/studio/searates/probe/route.ts:41`
- `app/api/studio/legal/evidence/[code]/route.ts:56`
- `lib/http/studio-session.ts:50` — **resuelto por el Director el 2026-09-21**:
  `requireStudioSession()` lee `user_tenants` sin `user_id` ni `disabled_at`,
  pero la policy viva en producción corta las dos cosas (la leyó él). Es
  **redundancia perdida, no agujero**, y no es de ninguna de las dos tareas de
  hoy: su dueño es la spec que extienda este contrato a `app/api/**`. Uno de sus
  cuatro consumidores es `shipments/route.ts`.

### Decisión de producto, no de gate

SDD-0497 gateó el mapa de etapas de Kommo con `moduleEditDenial("kommo")`, que
admite `commercial` además de `admin`. El encargo lo describe como **admin-only**
y sugiere `tenantAdminGate`. Cambiarlo **restringe** (dirección segura) pero le
saca la pantalla a `commercial`: **es decisión de Sam**, no de una tarea de
contratos. No lo toqué. **El Director la lleva a Sam** (confirmado el
2026-09-21); hasta que haya respuesta, el gate se queda como lo dejó SDD-0497.

### UI sin `canEdit`

`app/studio/(app)/tracking/[id]/_components/ShipmentDocsPanel.tsx` no recibe
`canEdit` y le muestra el formulario de subida y el botón de borrar a **todo el
mundo**, `support` incluido. Ahora reciben una denegación decente en vez de un
`{ ok: true }` falso, pero el control no debería estar visible. Es cambio de UI y
pasa por `/ui-check`; el patrón de la casa está en
`crm/__tests__/stage-control.test.ts` («la UI deriva `canEdit` del mismo
predicado que la acción»).

### Contratos hermanos con el mismo vicio

`app/studio/(app)/crm/__tests__/stage-control.test.ts:74` sigue afirmando sobre
el **texto** de `crm/actions.ts` (caso 2 de project-rules). No lo toqué: el
contrato nuevo cubre el gate de esas acciones por comportamiento, pero la
aserción de texto sigue ahí y sobrevive a quitar una de sus cinco apariciones.

### Documentación a actualizar al integrar

`docs/engineering/project-rules.md` L189-L318 dice del caso 1 que «es tarea
propia y ya está encolada». Al fusionar esto, esa frase y la fila 1 de la tabla
quedan desactualizadas. **No las edité** para no tocar un documento compartido en
un cierre con tres sesiones abiertas.

## Archivos tocados

```
app/studio/(app)/tracking/[id]/document-actions.ts                    (M)
app/studio/(app)/tracking/[id]/__tests__/document-actions-rbac.test.ts (A)
lib/studio/rbac-actions-guard.test.ts                                 (M, reescrito)
lib/studio/__tests__/rbac-action-scan.ts                              (A)
lib/studio/__tests__/rbac-action-scan.test.ts                         (A)
lib/studio/__tests__/rbac-action-files.ts                             (A)
lib/studio/__tests__/user-tenants-double.ts                           (M, +storage)
docs/specs/0500-contrato-rbac-por-accion/spec.md                      (A)
docs/specs/README.md                                                  (M, regenerado)
```

**Sin migración.** Nada que aplicar en producción.
