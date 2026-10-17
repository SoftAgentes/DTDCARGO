---
sdd: "0529"
title: "Editar operarios de Venezuela: rol de su región, sin almacén, con la matriz y auditado"
status: in-progress
author: "Sam (founder) + Claude Opus 5.5 (Worker)"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0028", "0030", "0251", "0513", "0515", "0520"]
confidencialidad: interno
---

# SDD-0529 — Editar operarios de Venezuela

> Desde Studio › Operarios se puede editar a un operario de Venezuela (bodeguero,
> camionero o supervisor de despacho) sin almacén, y a uno de China con su
> almacén. El rol se elige entre los de la región del operario, que da la base;
> guardar nunca cambia un rol en silencio y el cambio de rol arrastra los modos
> con que entra a la app del teléfono. La edición autoriza con la matriz de
> módulos y deja su evento en la auditoría.

## Contexto

Sam eligió «Editar operarios de Venezuela (Recomendado)», que el Director le
describió así: «Hoy no se puede editar un operario de Venezuela desde el Studio,
porque el formulario exige un almacén de China y solo ofrece dos roles. Es un
defecto real que encontramos con los PIN.» El hallazgo está en
`.agents/handoffs/0515-pin-operarios-endurecer.md`, sección FUERA DE ALCANCE.

### Diagnóstico, verificado en `origin/main` `a8d99acf`

- `app/studio/(app)/operarios/_components/EditOperarioDrawer.tsx:54`:
  `canSubmit = !!warehouseId && …`. Los de Venezuela no tienen almacén (0023 lo
  hizo opcional; `warehouses_cn` es el catálogo de China, 0008), así que
  «Guardar cambios» quedaba deshabilitado.
- `EditOperarioDrawer.tsx:156-157`: el selector de rol sólo ofrecía «Operario» y
  «Supervisor».
- `app/studio/(app)/operarios/actions.ts:370-372`: `updateOperarioAction` exigía
  el almacén y rechazaba cualquier rol que no fuera esos dos.
- **El cambio de rol en silencio.** `actions.ts:364` hacía
  `parseStr(formData.get("role")) || "operario"`. Con el rol de hoy fuera de las
  opciones (un camionero), el `<select>` controlado queda sin opción elegida y,
  por el HTML, no viaja en el formulario: si ese operario tuviera almacén, se
  guardaba como «operario» sin avisar. Verificado por lectura; no se reprodujo en
  navegador.
- `supabase/migrations/0351_operario_rpc_exige_rol.sql:190`: la RPC
  `admin_update_operario` también rechazaba los roles de Venezuela, y en `:178`
  autorizaba con `admin|operations` escrito a mano.
- **El rol y los modos.** `admin_update_operario` cambiaba `role` y dejaba
  `roles[]` como estaba. Desde 0066 la app del teléfono decide con `roles[]`:
  `lib/auth/operario-session.ts:141` y `:237` lo usan si no está vacío, y las RPC
  de despacho lo exigen (`0328_camionero_dispatch_assignment.sql:33-34`,
  `0072_fix_audit_entity_type.sql:173`). Editar el rol no cambiaba lo que el
  operario podía hacer en `/m/ve`.
- **¿Lo resolvió la 0475?** No. `0475_pin_operarios_endurecer.sql:847`:
  `admin_set_operario_active` sigue con `assert_studio_role(array['admin',
  'operations'])`, y la cabecera (`:123`) dice que `admin_update_operario` no
  cambia. Ninguna de las dos deja evento.

### Roles reales en la base

- `operario_pins_role_check` (0020, 0025): operario, supervisor, bodeguero y
  camionero.
- `operario_pins_ve_role_requires_ve_region` (0025): bodeguero y camionero sólo
  en Venezuela.
- `operario_pins_cn_requires_warehouse` (0023): China lleva almacén.
- `operario_pins_roles_check` (0066): los modos son de esos cuatro.

## Decisiones

De Sam: la opción elegida, citada arriba. El resto lo resolvió el Worker. El
Director lo confirma o lo devuelve, y ninguna decisión bloquea la PR.

1. **Venezuela: bodeguero, camionero y supervisor. China: operario y
   supervisor.**
   - China sale de la constraint de 0025.
   - En Venezuela, «supervisor» lo aceptan las RPC de despacho
     (`0184_bodeguero_split_idempotent.sql:58`, 0328, 0072), y el login de
     `/m/ve` lo manda a la app de bodeguero (`app/m/ve/login/actions.ts:43`).
   - «Operario» en Venezuela lo admite el CHECK, pero ninguna RPC de `/m/ve` lo
     acepta. No se ofrece. Quien ya lo tenga tiene que elegir otro rol para
     guardar; no se le cambia solo.
2. **La regla vive una sola vez, en la base.** La función nueva
   `operario_roles_por_region()` la usa `admin_update_operario` para validar, y la
   página la lee para armar el selector. En TypeScript no hay una lista de roles
   por región.
3. **Editar no pide motivo.** Sigue el precedente de D1:
   `membership.role_change` en `0289_audit_d1_access_configuration.sql:260-279`
   audita el cambio de rol del personal sin motivo obligatorio. La lista de
   motivos de 0515 («Se le olvidó», «Empleado nuevo»…) es del PIN y no sirve
   aquí. AUD-01 §3 lo pide para «cambios de acceso»: queda como excepción
   propuesta (ver Gobernanza).
4. **Desactivar queda fuera** (`admin_set_operario_active`). Desactivar es
   revocar un acceso, y en D1 las revocaciones piden motivo
   (`api_key.revoke`, `membership.invitation_revoke`). Eso exige elegir una lista
   y cambiar el interruptor de la fila, que está junto a «Reactivar», y esta
   tarea no lo toca. Va con su propia SDD.
5. **Varios modos.** Si el operario entra con un solo modo, sus modos siguen al
   rol. Si tiene varios (sólo existen cargados por SQL), el rol tiene que ser uno
   de ellos y los modos no cambian; si no, la base lo rechaza con su mensaje. El
   cajón no lee `roles[]`.
6. **Un operario de Venezuela que tiene almacén lo pierde al guardar.** El cajón
   lo avisa antes. La app de `/m/ve` no usa el almacén (búsqueda en
   `app/m/ve`).

## Alcance

Una migración, `0480_operarios_editar_por_region.sql`, más el cajón y la action
de editar:

- **Base.**
  - `operario_roles_por_region()` devuelve el jsonb `{"cn": […], "ve": […]}`. Es
    IMMUTABLE, sin search_path y con EXECUTE sólo para authenticated.
  - `admin_update_operario` se reescribe desde 0351 con la misma firma y
    search_path vacío:
    - autoriza con la matriz (`operarios_module_authorized`, 0475) antes de
      buscar la fila;
    - lee la fila con FOR UPDATE;
    - toma el rol de la región de la fila, sin rol por defecto;
    - los modos siguen al rol (decisión 5);
    - China lleva un almacén activo, o el que ya tenía; Venezuela, ninguno;
    - si el nombre se repite en el almacén, P0013;
    - si nada cambia, no escribe;
    - el evento `operario_updated` se escribe en la misma transacción, sin los
      nombres.
- **App.**
  - La página lee los roles (`getOperarioRolesPorRegion`).
  - El cajón ofrece los roles de la región y el almacén sólo a los de China.
    Avisa si a uno de Venezuela se le quita el almacén, si el rol de hoy no es de
    su región y si el rol cambia.
  - La action ya no pone «operario» por defecto y manda el almacén vacío como
    NULL. Los rechazos de la base van a su campo.
  - Al guardar, un aviso.

No cambia nada del PIN: alta, «Ver PIN», «Restablecer PIN» y «Reactivar» siguen
igual. Tampoco cambian la columna de anchos de 0520, la región del operario ni el
login.

## Criterios de aceptación

El contrato es `supabase/tests/0480_operarios_editar_por_region.test.sql`
(«TEST 0480 GREEN: 119 aserciones» en PGlite) y su envoltorio
`lib/studio/__tests__/operarios-editar-por-region.migration.test.ts`.

1. **Un operario de Venezuela se edita.**
   - El camionero pasa a bodeguero sin almacén.
   - Sus modos pasan a `["bodeguero"]` y el login real (`verify_operario_pin`)
     lo devuelve como bodeguero.
   - Cambiar sólo el nombre cambia sólo el nombre.
   - El cajón no tiene selector de almacén ni manda `warehouse_id`, y ofrece
     Bodeguero, Camionero y Supervisor.
2. **El rol es de su región y nunca por defecto.**
   - China rechaza bodeguero y camionero; Venezuela rechaza operario.
   - Un rol nulo, vacío, con mayúsculas o inventado da P0012, y la fila queda
     igual y sin evento.
   - En China, un rol nulo tampoco se vuelve «operario».
   - Si su rol de hoy no es de su región, el cajón arranca sin rol y no guarda
     hasta elegir uno.
   - Sin la lista de la base, el cajón no deja guardar.
   - Con otra lista, el cajón ofrece esa otra.
3. **La regla sale de la base.**
   - Cada rol que se ofrece pasa los CHECK de `operario_pins` en su región. Se
     prueba insertando una sonda por cada par región × rol.
   - Lo que la tabla admite y no se ofrece es sólo «operario» en Venezuela.
   - Para cada región y cada rol, el cajón lo ofrece si y sólo si la RPC lo
     acepta.
4. **Almacén.**
   - En China es obligatorio, existente y activo (P0023); se conserva el que ya
     tenía aunque se haya desactivado, y el cajón lo muestra «(inactivo)».
   - En Venezuela, uno con almacén da P0023.
   - Guardar sin almacén se lo quita, y el cajón lo avisa antes.
5. **Modos.**
   - Con un solo modo, el modo sigue al rol.
   - Con varios, el rol pasa a otro de ellos y los modos no cambian; un rol fuera
     de ellos da P0012.
   - Si los modos estaban vacíos, cambiar sólo el nombre los deja vacíos.
6. **La matriz decide.**
   - admin y operations editan.
   - commercial, accounting, warehouse, support, marketing, un usuario
     desactivado y una sesión vacía reciben 42501.
   - Los desvíos de 0357 funcionan en las dos direcciones; support no edita ni
     con desvío.
   - Sin permiso, un id que no existe también da 42501 (sin oráculo).
   - Otro tenant da 42501.
   - Prueba de propiedad: en los 25 casos, la RPC decide igual que
     `moduleEditDenial`. Con el candado a mano de 0351 fallan exactamente los 6
     casos donde difieren.
7. **Auditoría (AUD-01).**
   - `operario_updated` registra:
     - tenant y actor;
     - origen `rpc` y resultado `succeeded`;
     - `reason` nulo y sensibilidad `internal`;
     - región, rol, modos y almacén antes y después;
     - `cambios`, con la lista de campos cambiados.
   - Los nombres no se copian al evento, y un motivo que quedó en la sesión
     tampoco.
   - Si el evento no se puede escribir, el operario no cambia.
   - Guardar sin cambios no escribe la fila ni deja evento, pero sí la bloquea
     mientras compara.
8. **Nombre.** Es obligatorio (P0011) y se guarda recortado. El nombre en chino
   en blanco queda vacío. Repetido en el almacén da P0013; en Venezuela, donde
   no hay almacén, no choca. Si uno de Venezuela tiene nombre en chino, el cajón
   lo muestra y lo manda, así que no se borra sin verlo.
9. **La action.**
   - Corre el `moduleEditDenial` real sobre un doble que filtra con `.eq` y
     `.is` y devuelve copias.
   - Manda el rol tal cual y el almacén vacío como NULL.
   - Sin rol o sin nombre no llama a la base.
   - P0011 y P0013 van al nombre, P0012 al rol y P0023 al almacén; lo demás va
     al aviso general.
   - Sólo un guardado bueno revalida.
10. **Preflight y postflight.**
    - Un ANTES con drift aborta sin cambiar nada. Se prueban 11 casos:
      - el cuerpo de 0351;
      - sin 0475;
      - la entidad `operario` inactiva;
      - una sobrecarga;
      - una `operario_roles_por_region` previa;
      - anon con EXECUTE;
      - una tercera región;
      - un quinto rol;
      - y faltando cualquiera de las constraints de 0025, 0023 y 0066.
    - Re-aplicar es inocuo.
    - El postflight exige cuerpos, EXECUTE y una entrada por región.
11. **Mutantes.**
    - 20 de la migración mueren en la aserción de la regla que rompen (PGlite).
    - 25 de la app mueren, con control verde antes y después (ver handoff).
12. **Aplicada a producción** con OK nominal de Sam, preflight leído antes y
    smoke después (guion en el handoff). **Pendiente.** La spec no pasa a `done`
    hasta entonces.

## Diseño

### Una sola fuente para la regla del rol

`operario_roles_por_region()` devuelve un literal jsonb. La RPC valida con
`(operario_roles_por_region() -> región) ? rol`, y la página lo lee con
`supabase.rpc` y lo pasa por `parseOperarioRolesPorRegion`. Esa función acepta la
respuesta sólo si cada región tiene una lista no vacía, sin repetidos y de roles
conocidos; si no, devuelve `null` y el cajón no deja guardar. Se descartó una
lista en TypeScript enfrentada a la de SQL por una prueba (el patrón del motivo
de 0515): la tarea pedía no escribir la regla dos veces, y con la base como
fuente un cambio de regla es sólo una migración. El costo es una llamada más al
cargar la página y el orden MIGRATE-FIRST.

### El almacén

`warehouses_cn` es un catálogo global de China sin tenant (0008). La RPC valida
por la región de la fila, no por la del formulario:

- en China, el almacén es obligatorio y tiene que existir y estar activo, salvo
  que sea el mismo que ya tenía: así guardar un nombre no obliga a cambiar un
  almacén que se desactivó;
- en Venezuela, ninguno.

No se agregó una constraint `region <> 've' or warehouse_id is null` a la tabla:
habría que leer filas de producción para saber si alguna la violaría (ver Fuera
de alcance).

### Por qué la app no lee `roles[]`

Con un solo modo (lo que crean el alta y el backfill de 0066), el rol y los modos
se mueven juntos y el cajón no necesita saber más. Varios modos sólo se cargan
por SQL; para ese caso la base explica el rechazo. Leer `roles[]` en la lista y
filtrar el selector agregaba superficie para un caso que el Studio no crea.

### Orden de despliegue: MIGRATE-FIRST

| Estado | Qué pasa |
|---|---|
| App nueva sin 0480 | `operario_roles_por_region` no existe: la página carga y el cajón dice «No se pudieron cargar los roles de cada región…» y no deja guardar a nadie |
| 0480 con la app de antes | los de China se editan igual (sus roles y su almacén son los mismos para la RPC nueva) y los de Venezuela siguen sin poder guardarse, como hoy |

Por eso se aplica 0480 con OK nominal y se despliega después. El orden está
declarado en `supabase/migrations-baseline.json`, y el símbolo, como AMARILLO en
`supabase/pending-migration-symbol-declarations.json`. No se aplica en la ventana
del corte de dtdcargo.com al servidor propio (jueves 2026-10-15 en la noche).

## Seguridad

- La matriz se mira antes de buscar la fila: sin permiso, ningún id distingue
  «no existe» de «no puedes».
- El tenant sale de la sesión (`assert_tenant_match`), nunca del formulario.
- La región tampoco viaja en el formulario: la base usa la de la fila, así que no
  se puede mandar un rol de despacho a un operario de China.
- `admin_update_operario` corre como DEFINER con search_path vacío; el EXECUTE
  queda para authenticated, como en 0351.
- `operario_roles_por_region()` no tiene datos de nadie: es una constante.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0480_operarios_editar_por_region.sql` | nuevo · la migración |
| `supabase/tests/0480_operarios_editar_por_region.test.sql` | nuevo · contrato SQL |
| `lib/studio/__tests__/operarios-editar-por-region.migration.test.ts` | nuevo · PGlite: texto, contrato, control rojo, 11 preflights, 20 mutantes, propiedad de la matriz y cajón contra base |
| `supabase/migrations-baseline.json` | espera `0480_operarios_editar_por_region` |
| `supabase/pending-migration-symbol-declarations.json` | `operario_roles_por_region` (AMARILLO) |
| `lib/studio/operario-edicion.ts` | nuevo · validación de los roles de la base, opciones del cajón, campo de cada rechazo |
| `lib/studio/__tests__/operario-edicion.test.ts` | nuevo |
| `lib/studio/operario-queries.ts` | `getOperarioRolesPorRegion` |
| `lib/studio/operario-pin.ts` | `isOperarioRol` |
| `app/studio/(app)/operarios/actions.ts` | `updateOperarioAction` sin rol por defecto ni lista; almacén vacío = NULL; rechazos a su campo |
| `app/studio/(app)/operarios/page.tsx` | lee los roles de cada región |
| `app/studio/(app)/operarios/layout.tsx` | comentario del candado |
| `app/studio/(app)/operarios/_components/EditOperarioDrawer.tsx` | China y Venezuela; roles de la base; avisos; aviso al guardar |
| `app/studio/(app)/operarios/_components/EditOperarioDrawer.test.tsx` | nuevo |
| `app/studio/(app)/operarios/_components/OperariosClient.tsx` | pasa `rolesPorRegion` al cajón (la primitiva de 0520 intacta) |
| `app/studio/(app)/operarios/_components/OperariosClient.test.tsx` | la prop nueva en los cuatro render |
| `app/studio/(app)/operarios/__tests__/update-operario-actions.test.ts` | nuevo |
| `docs/specs/0529-operarios-venezuela-editar/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0529-operarios-venezuela-editar.md` | handoff |

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| AUD-01 §1, §4, §8 (atomicidad, fallo del log) | cumplimiento | evento en la RPC, en la misma transacción; contrato §10: sin el tipo de auditoría la edición falla y nada cambia |
| AUD-01 §2 (cambio de roles y acceso) | cumplimiento | `operario_updated` con rol y modos antes y después |
| AUD-01 §3 (`reason` en cambios de acceso) | **excepción propuesta** | sin motivo obligatorio, como `membership_role_changed` (0289); necesita decisión de Sam y una lista propia (decisión 3) |
| AUD-01 §5 (minimización, sin secretos) | cumplimiento | ids en vez de nombres; el contrato lo verifica sobre todos los eventos de edición |
| AUD-01 §7 (flujos modificados) | cumplimiento para editar; no conformidad preexistente fuera de alcance | desactivar sigue sin evento ni matriz (decisión 4) |
| BTN-01 | cumplimiento | una primaria («Guardar cambios»), Cancelar a la izquierda (`DrawerFooter`) |
| FRM-01, ERR-01 | cumplimiento | cada rechazo en su campo con `aria-invalid` y `aria-describedby`; lo general en `ErrorAlert`; avisos con `role="note"` y `role="status"` |
| CMP-01 | cumplimiento | `DrawerShell`, `ErrorAlert`, `useToast` |
| Trazabilidad visual (`app/studio/CLAUDE.md`) | cumplimiento parcial | aviso al guardar; la fila no se resalta (`useRowHighlight` no está en el módulo; fuera de alcance) |

## Revisión de datos (`/revisar-datos-ve`)

Advisory; no afirma cumplimiento. Alcance: lo que el cajón edita del operario
(nombre, nombre en chino, rol, almacén) y lo que la auditoría guarda de eso.

| Punto | Estado | Evidencia |
|---|---|---|
| Datos que se capturan | CORRECTO | ningún campo nuevo: los mismos que el cajón ya editaba |
| Minimización en la auditoría | CORRECTO | el evento guarda ids, región, rol, modos, almacén y la lista de campos cambiados; nunca los nombres (`0480_operarios_editar_por_region.sql`, `append_audit_event`; contrato §1) |
| Corrección de datos | CORRECTO | un operario de Venezuela con almacén de China lo pierde al guardar, con aviso previo |
| Nombre en chino de un operario de Venezuela | CORRECTO | se muestra y viaja si existe; no se borra sin verlo (`EditOperarioDrawer.test.tsx`) |
| Retención de los eventos | NO VERIFICABLE | la de AUD-02, sin purga propia |
| Datos del equipo de Yiwu (PIPL) | NO VERIFICABLE | la edición no cambia quién ve los nombres ni los transfiere; las bases de licitud y el consentimiento están fuera del código |

Marco citado desde `references/`: PIPL art. 51 (medidas técnicas y control de
permisos) por el equipo de Yiwu. Esto no es asesoría legal.

## Riesgos

- **Ventana de despliegue.** Ver MIGRATE-FIRST: sin la migración, el cajón
  «Editar» no deja guardar a nadie.
- **Drift en producción.** El md5 vivo de `admin_update_operario` no se leyó;
  el preflight exige el de 0351 (`60bff5cc…`) y aborta si difiere. El Director lo
  lee antes de aplicar (handoff).
- **La carrera no se ejerce con dos conexiones.** PGlite tiene una sola. El
  contrato prueba que la fila queda bloqueada (`xmax`), no que dos ediciones se
  serialicen. Un `*_carrera.test.sql` con dblink (patrón 0459) lo cubriría en
  `verify` con Docker.
- **Varios modos.** Si existiera un operario con varios modos, el cajón le
  ofrece todos los roles de su región y la base rechaza los que no son suyos,
  con su mensaje.

## FUERA DE ALCANCE DETECTADO

Ver el handoff.

## Validación

Ver el handoff: PASÓ / FALLÓ / NO EJECUTADO por comprobación.

## Registro de integración (2026-10-15)

- **PR:** #231 (`codex/operarios-venezuela-editar`). Cabeza `ff901b08` fusionada con `--match-head-commit`; merge `502f519d` a las 15:11:08Z.
- **CI:** «Calidad continua» PASÓ sobre esa cabeza (run 38753773729), con la suite y el build. `pnpm verify` local: NO EJECUTADO (una corrida pesada a la vez; el CI corre la suite completa).
- **Deploy:** el status de Vercel del merge dice «Deployment has completed» (15:12:52Z). El ID del deployment y el alias quedan NO VERIFICADOS: el conector de Vercel responde 403.
- **Migración `0480_operarios_editar_por_region`: APLICADA** en el servidor propio (`dtd-cargo-db-1`), migrate-first, con el OK nominal de Sam, literal: «autorizo aplicar 0476_borrado_embarques_recepciones, 0477_naviera_zarpe_avanza_envios, 0479_portal_bandeja_avisos, 0480_operarios_editar_por_region y 0482_naviera_autorizar_correlation_id en el servidor propio».
  - Antes, la lectura previa READ ONLY de la migración dio «PREFLIGHT 0480 OK».
  - `psql` con la migración y la fila del ledger en una transacción. Ledger `20261015151104 · 0480_operarios_editar_por_region`, una sentencia, md5 `1c78864e…` y 25024 bytes, igual al blob de la cabeza fusionada.
  - La PR se fusionó 4 s después de la fila del ledger, así que la app vieja y la base nueva no convivieron.
  - La espera salió de `supabase/migrations-baseline.json` en la misma PR. La cabecera «NO APLICADA» del `.sql` no se corrige: editarla rompería la identidad con el ledger.
  - Evidencia: `/srv/ops/evidencias/apply-0480-dtd-cargo-20261015T151104Z/` con `SHA256SUMS`.
- **Decisiones de Sam:** los roles de Venezuela son bodeguero, camionero y supervisor («El rol de operario ya no es necesario»), y editar un operario no pide motivo («Sí»).
- **Smoke de Sam: PENDIENTE.** Guion en `.agents/handoffs/0529-operarios-venezuela-editar.md` § «Smoke para Sam (después de aplicar 0480 y desplegar)».
- **Estado:** integrada. La spec sigue en `in-progress` hasta el smoke.
