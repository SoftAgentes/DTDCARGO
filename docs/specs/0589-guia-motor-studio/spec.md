---
sdd: "0589"
title: "Motor de guía propio y liviano en Studio (E9 del programa SDD-0582, paso 9.2)"
status: in-progress
author: "Claude Worker «E9 motor» (Sam)"
created: 2026-10-30
updated: 2026-11-07
supersedes: null
superseded_by: null
related: ["0582", "0233"]
confidencialidad: interno
---

# SDD-0589 — Motor de guía en Studio (E9, paso 9.2)

Programa: [SDD-0582](../0582-chatwoot-piloto/spec.md) · checklist: [fila 9.2](../0582-chatwoot-piloto/checklist.md) · guion aceptado: [`guia-guion.md`](../0582-chatwoot-piloto/guia-guion.md) (9.1, decisión K de la spec del programa).

> Solo código de Studio. No toca producción, el VPS, Meta, Chatwoot ni la base. No trae migración: el estado por usuario es de 9.3.

> **Aceptado.** Sam aceptó el 9.2 el 2026-10-30. Pregunta del Director: «¿Aceptas el 9.2 (motor de la guía)?». Respuesta literal de Sam: «Acepto el 9.2». La fila 9.2 del checklist pasa a `aceptado`. El diseño de 9.3 (§8) no entra en esta aceptación: es una propuesta con su propia puerta.

## 1. Problema

El equipo que hoy atiende en Kommo necesita ver en la pantalla dónde está cada tarea en Studio. El guion de 9.1 fija los textos, las anclas y las claves. Falta el motor que los muestra.

## 2. Qué entrega 9.2

| Pieza | Archivo | Qué hace |
|---|---|---|
| Recorridos como datos | `lib/studio/guia/tipos.ts`, `lib/studio/guia/recorridos.ts` | `GuiaRecorrido { id, ruta, pasos[] }` y `GuiaPaso { id, ancla, clave }`. `GuiaClave` es un tipo derivado del dict: solo admite claves base con `.title` y `.what` en los dos idiomas. `validarRecorrido` comprueba el formato de ancla del guion (`<pantalla>.<elemento>`) y que no se repitan los ids |
| Navegación pura | `lib/studio/guia/motor.ts` | `primerPaso`, `pasoSiguiente`, `pasoAnterior` y `contador`. Consultan `existe(ancla)` en cada movimiento: un paso sin ancla se salta y, si no queda ninguno, el recorrido no abre |
| Colocación pura | `lib/studio/guia/posicion.ts` | Pone la tarjeta debajo del ancla y, si no cabe, arriba, a la derecha o a la izquierda. Si no cabe en ningún lado, o el ancla no está, va libre abajo a la derecha. Nunca se sale del viewport |
| Progreso | `lib/studio/guia/almacen.ts` | Interfaz `GuiaAlmacen`. 9.2 usa `localStorage` con `try/catch` y respaldo en memoria. Solo guarda ids de recorrido y de paso, sin PII. 9.3 reemplaza la implementación sin tocar el motor |
| Motor | `app/studio/_components/guia/GuiaMotor.tsx` | Arranca con `?guia=<id>` o con `iniciarGuia(id)`. Solo abre en la ruta de su recorrido y reintenta 2 s si el ancla se pinta tarde. Al cambiar de ruta, cierra. Dibuja un contorno sobre el ancla con `pointer-events: none` y sigue el scroll, los cambios de tamaño y los del DOM |
| Tarjeta | `app/studio/_components/guia/GuiaTarjeta.tsx` | Tarjeta pequeña de 360 px como máximo, con `role="dialog"` no modal, sin fondo ni trampa de foco. Tiene Siguiente/Anterior/Cerrar; Escape y las flechas funcionan con el foco dentro. Muestra «Antes en Kommo» solo si la tarjeta trae `.before` |
| Textos | `lib/i18n/es-VE/guide.ts`, `lib/i18n/zh-CN/guide.ts`, `lib/i18n/dict.ts` | Dominio `guide` con los controles del guion y el recorrido de demostración. `hasI18nKey` sirve para los sufijos opcionales |
| Montaje | `app/studio/(app)/layout.tsx` | `<GuiaMotor />` dentro de `<Suspense>`, junto a `DeniedToast`. Son 5 líneas |
| Demostración | `app/studio/(app)/dashboard/page.tsx`, `.../dashboard/_components/DashboardClient.tsx` | 4 anclas: `dashboard.bienvenida`, `dashboard.kpis`, `dashboard.configurar` y `dashboard.paneles`. Se ve en `/studio/dashboard?guia=dashboard` |

### Accesibilidad y movimiento (A11Y-01, MOT-01)

- **Foco:** al abrir pasa a la tarjeta. Al navegar se queda en el botón usado; por eso «Anterior» usa `aria-disabled` y no `disabled`. Al cerrar vuelve al elemento que lo tenía antes.
- **Anuncios:** una región `role="status"` / `aria-live="polite"` dice «Guía, paso n de total: título» y, al cerrar, «Guía cerrada».
- **Teclado:** Tab sale de la tarjeta, porque no es modal. Escape cierra y ← → navegan con el foco dentro. El botón de cerrar mide 32×32 y tiene nombre accesible.
- **Movimiento:** la entrada usa `--dur` y el desplazamiento entre anclas `--dur-slow`. Con `prefers-reduced-motion: reduce` solo queda la opacidad (`--dur-fast`), el contorno no se anima y el scroll al ancla es `auto`.
- **Capas:** `z-index` 90. Queda sobre el topbar (70) y debajo de drawers (100), avisos (150) y confirmaciones (200).

### Marca

Usa solo tokens (`--bg-surface`, `--border-strong`, `--shadow-pop`, `--r-lg`, `--s-*`, `--wine-text`, `--info`, `--info-bg`, `--dur*`, `--ease`) y los botones `studio-btn` existentes. No usa glass ni hex. El texto va alineado a la izquierda y con tuteo. Una prueba vigila los 40/140 caracteres del guion, la ausencia de exclamaciones y el voseo.

## 3. Decisiones

- **D1 · Sin dependencia nueva.** El motor es propio (decisión K del programa).
- **D2 · Arranque sin botón.** El botón «Guía» y la primera vez automática son de 9.3 (preguntas S-6 y S-7). 9.2 deja `?guia=` para la capacitación de 8.1 e `iniciarGuia()` para 9.3.
- **D3 · zh-CN traducido de forma provisional.** La pregunta S-3 (traducir u ocultar en zh-CN) sigue abierta para Sam. Las claves tienen que existir en los dos idiomas, así que se tradujeron. Si Sam decide ocultar, basta con filtrar el locale en el motor.
- **D4 · Demostración en el Dashboard.** Es una pantalla general que no edita ninguna sesión de E2, E3 ni E6. No se pusieron anclas en Bandeja, CRM, Usuarios ni Actualizaciones: eso es de 9.5.
- **D5 · Claves agregadas al guion.** `guide.chrome.done` («Terminar»), `close_aria`, `card_aria`, `announce` y `closed` hacían falta para el último paso y el lector de pantalla.
- **D6 · Sin registro CMP todavía.** `GuiaTarjeta` queda como componente nuevo sin entrada en `docs/governance/components/`. Se propone registrarlo como `proposed` en 9.6, después de la prueba con la persona que atiende, para no regenerar `component-registry.json` mientras otras ramas lo tocan.

## 4. Aceptación

| # | Criterio | Evidencia |
|---|---|---|
| A1 | Motor con pasos anclados a `data-guia` | `GuiaMotor.test.tsx` «arranque» |
| A2 | Tarjeta pequeña, sin modal que bloquee | prueba «no hay fondo ni trampa de foco» (`aria-modal="false"`, clic en la pantalla con la tarjeta abierta) |
| A3 | Siguiente / Anterior / Cerrar | prueba «siguiente / anterior / terminar» y «botón Cerrar» |
| A4 | Foco, teclado y `aria-live` | prueba «flechas navegan y Escape cierra devolviendo el foco» y anuncios en `role="status"` |
| A5 | `prefers-reduced-motion` | prueba «con prefers-reduced-motion la tarjeta no se desplaza» |
| A6 | Marca e i18n es-VE y zh-CN | `/ui-check` (§5); pruebas «mismas claves», «en zh-CN usa los textos chinos» y tono |
| A7 | Recorridos como datos tipados | `tipos.ts` + prueba «todo recorrido del catálogo es válido» |
| A8 | Ancla inexistente: se salta sin romper | pruebas «salta el paso…», «sin ninguna ancla…» y «si el ancla se va con la tarjeta abierta…» |
| A9 | Demostración en una pantalla que nadie más edita | Dashboard (D4) |
| A10 | Pruebas unitarias y de componente | `lib/studio/guia/__tests__/guia.test.ts` (19) y `app/studio/_components/guia/GuiaMotor.test.tsx` (16) |

## 5. Validación local (2026-10-30)

- `vitest run lib/studio/guia app/studio/_components/guia`: **PASÓ**, 35/35. También `app/studio/(app)/dashboard`: **PASÓ**, 9/9.
- Mutantes a mano sobre `GuiaMotor.tsx`: «toda ancla existe» lo matan 3 pruebas, «sin restaurar foco» 1 y «no cierra al cambiar de ruta» 1. Se restauró el archivo.
- `tsc --noEmit` del proyecto: **PASÓ**.
- ESLint de los archivos tocados: **PASÓ**, 0 avisos.
- `/ui-check`: **OK con ajustes menores**. Se aplicó el foco visible de la tarjeta. Queda la revisión visual en vivo (claro, oscuro, móvil y zoom al 200 %) para 9.6.
- `pnpm verify` (turno del Director, 2026-10-30 18:15Z–19:37Z, punta `4efb7f89f`, `node scripts/verify.mjs`): **FALLÓ por rojos heredados; ninguno sale del diff de esta SDD**. Por comprobación:
  - PASÓ: harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols (0 ROJO, 3 AMARILLO declarados), schema-rebuild y build.
  - FALLÓ `test` (heredado): en el reintento queda sólo `scripts/__tests__/avance-checklist.test.mjs` («arranca en 0 %»: espera 0 y da 6,02). Viene de la base `37c64d114` (9.1 aceptado), que ya da 6,02 sin esta rama; la fila 9.2 en «entregado» no suma al %. `origin/main` y la base actual ya traen la prueba nueva («su % sale solo de los aceptados»). En el primer intento también cayeron, por carga, `infra/ops/tests/migraciones.test.mjs` (timeout de 600 s) y un «Failed to start forks worker»; los dos pasaron en el reintento. 13.260 pruebas pasaron.
  - FALLÓ `sql-tests` (heredado, SDD-0573): 0467_reversion_credito_carrera y 0497_reverso_al_anular_factura (normal y carrera).
  - FALLÓ `e2e` (heredado, sólo sitio público): `sin-scroll-horizontal.spec.ts:119` (Shipping Mark) en los dos intentos; `company-photo-carousel.spec.ts:93` en el reintento (había pasado en el primero). Inestables que se recuperaron: `auth.spec.ts:81` y `:106`, `cbm-ayuda.spec.ts:111` y `sin-scroll-horizontal.spec.ts:208`. Ninguna prueba e2e cubre Studio ni la guía.
  - NO DISPONIBLE: migrations-applied (el worktree no tiene `.env.local`, a propósito; esta SDD no trae migración).

## 6. Allowlist exacta

- `lib/studio/guia/tipos.ts`, `motor.ts`, `posicion.ts`, `almacen.ts`, `recorridos.ts`, `__tests__/guia.test.ts`
- `app/studio/_components/guia/GuiaMotor.tsx`, `GuiaTarjeta.tsx`, `GuiaMotor.test.tsx`
- `lib/i18n/es-VE/guide.ts`, `lib/i18n/zh-CN/guide.ts`, `lib/i18n/dict.ts`, `lib/i18n/index.ts`
- `app/studio/(app)/layout.tsx` (montaje), `app/studio/(app)/dashboard/page.tsx` y `app/studio/(app)/dashboard/_components/DashboardClient.tsx` (solo los atributos `data-guia`)
- `docs/specs/0589-guia-motor-studio/spec.md`, `docs/specs/0582-chatwoot-piloto/checklist.md` (fila 9.2), `docs/specs/README.md` (índice), `.agents/handoffs/0589-e9-motor.md`

## 7. Fuera de alcance

- El estado por usuario, el botón «Guía», «No volver a mostrar», reanudar y reiniciar, con su migración: **9.3**.
- La guía dentro de Chatwoot (`DASHBOARD_SCRIPTS`, `postMessage` y archivo de selectores): **9.4**.
- Los recorridos por rol y las anclas en Bandeja, Embudo, Ficha DTD, IA, Usuarios y Actualizaciones: **9.5**.
- La prueba con la persona que atiende, el `/ui-check` en vivo y el registro CMP: **9.6**.

## 8. Diseño de 9.3 · estado por usuario (propuesta, sin código)

> Pedido del Director (2026-10-30): diseñar 9.3 sin crear la migración. El número lo asigna él (0508 o la siguiente libre); aquí va como **NNNN**. Puerta de la fila 9.3: **OK de Sam a la migración**. Aplicarla en producción es otra puerta, con el [runbook](../../runbooks/aplicar-migraciones-prod.md).

### 8.1 Qué tiene que resolver (fila 9.3 y guion)

- **Primera vez automática:** al entrar por primera vez a una pantalla con recorrido, la guía arranca sola. Se propone por pantalla, no toda junta (S-6, todavía abierta).
- **Botón «Guía»** (`guide.chrome.toggle`): abre o cierra la guía de la pantalla. Propuesta: en la barra superior de Studio (S-7).
- **«No volver a mostrar»:** apaga el arranque automático de esa pantalla, no el botón.
- **Reanudar y reiniciar:** «Seguir donde quedaste» y «Ver la guía desde el principio».
- Que el estado siga a la persona entre equipos, y que el primer pintado no parpadee ni falle la hidratación.

### 8.2 Tabla `user_guide_prefs` (patrón de la migración 0233)

Copia la forma de `user_dashboard_prefs` (`supabase/migrations/0233_user_dashboard_prefs.sql`, **C**): una fila por (tenant, usuario), `jsonb` validado en la acción y RLS por dueño.

```sql
create table if not exists public.user_guide_prefs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  state       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);
-- touch_updated_at, grants a authenticated y service_role, sin anon, RLS activa.
create policy user_guide_prefs_owner on public.user_guide_prefs
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and tenant_id in (select ut.tenant_id from public.user_tenants ut
                      where ut.user_id = (select auth.uid()) and ut.disabled_at is null)
  )
  with check (/* mismo predicado */);
```

- **Una mejora sobre la 0233:** la policy exige `disabled_at is null`, como hace la 0200 con `user_tenants` (`0200_rbac_disabled_enforcement.sql:96`, **C**). La 0233 no lo exige: un usuario desactivado conserva su fila del Dashboard. Ese hallazgo queda fuera de alcance y no se toca aquí.
- **Forma del `state`** (versionada):

  ```ts
  { v: 1, recorridos: { [recorridoId]: { pasoId: string | null; terminado: boolean; noMostrar: boolean; vistoEn: string /* ISO */ } } }
  ```

  La valida `validarEstadoGuia()` en la acción. Al leer se descartan los recorridos y pasos que ya no están en `RECORRIDOS`, para que el catálogo cambie sin migrar datos (como `validateDashboardConfigInput`).
- **Alternativa descartada:** una fila por recorrido. Da más filas y más escrituras, y no simplifica la evolución del catálogo, que se resuelve igual al leer.
- **Datos personales:** solo ids de recorrido y de paso, booleanos y una fecha. Ligados a `user_id`, describen si un empleado vio la guía. Es poco, pero 9.3 pasa por `.claude/skills/revisar-datos-ve/SKILL.md` antes de la PR (finalidad, minimización y borrado en cascada con el usuario).
- **Pruebas de contrato** en PGlite (`NNNN_*.migration.test.ts`):
  - el dueño lee y escribe su fila;
  - otro usuario del mismo tenant no la ve;
  - un usuario desactivado queda sin acceso;
  - `unique (tenant_id, user_id)` se cumple;
  - `anon` no tiene grants.

### 8.3 Caché y contrato de hidratación

1. **El servidor manda.** El layout de Studio lee la fila en el mismo `Promise.all` que ya tiene, sin que un error tumbe el shell (`.catch(() => null)`), y pasa `estadoInicial` a `<GuiaMotor>`. El primer render del servidor y el del cliente salen del mismo dato: **ningún render lee `localStorage`**, así que no hay desajuste de hidratación.
2. **Implementación de `GuiaAlmacen` para 9.3** (`almacen.ts`):
   - `leer` responde desde memoria, sembrada con `estadoInicial`;
   - `guardar` actualiza la memoria, copia a `localStorage` (`dtd.guia.v1.*`, igual que hoy) y agenda la acción `guardarEstadoGuiaAction` con espera de 650 ms, igual que el autosave del Dashboard.
3. **Al montar,** como hace el Dashboard: si llegó `estadoInicial`, se escribe sobre `localStorage`. Si el servidor falló (`null`), se lee `localStorage` **en un efecto**, después de hidratar, y se usa como respaldo hasta la próxima escritura.
4. **Conflictos:** gana la última escritura. Dos pestañas abiertas pueden pisarse el paso actual; no hay pérdida que importe.

### 8.4 Arranque y controles (cambios al motor)

- **Primera vez:** efecto tras montar. Si la ruta tiene recorrido y su estado no existe (nunca visto) y no tiene `noMostrar`, se llama `iniciarGuia(id, { origen: "auto" })` y se guarda `vistoEn` **antes** de abrir, para que recargar no lo repita.
- **API:** `iniciarGuia(id, { desde?: pasoId, origen: "auto" | "boton" | "url" })`. `desde` abre en ese paso si su ancla existe; si no, en el primero presente (mismo salto de hoy).
- **Estado abierto/cerrado para el botón:** un almacén mínimo con `useSyncExternalStore` (`estaAbierta()`, `suscribir()`). El botón lleva `aria-pressed` y alterna `toggle_on_aria` / `toggle_off_aria`.
- **Botón «Guía»:**
  - con progreso a medias, reanuda en `pasoId`;
  - terminada o nunca vista, empieza en el primer paso;
  - sin recorrido para la pantalla, no se muestra.
- **Tarjeta:**
  - con `origen: "auto"`, el primer paso muestra «No volver a mostrar», que guarda `noMostrar: true` y cierra;
  - cuando reanuda, muestra «Ver la guía desde el principio».
  - Las dos acciones son botones `ghost` pequeños: no mutan datos de negocio y no necesitan `ActionButton`.
- **Sin cambios** en el formato de los recorridos ni en la navegación de 9.2.

### 8.5 Allowlist prevista de 9.3

- `supabase/migrations/NNNN_user_guide_prefs.sql` y `NNNN_user_guide_prefs.migration.test.ts`
- `lib/studio/guia/estado-types.ts` (validador) y `lib/studio/guia/estado-queries.ts`
- `app/studio/(app)/_actions/guia.ts`: la acción `guardarEstadoGuiaAction`, junto a `comments.ts`, la acción transversal que ya existe ahí.
- `lib/studio/guia/almacen.ts`, `app/studio/_components/guia/GuiaMotor.tsx` y `GuiaTarjeta.tsx`, más un `GuiaBoton.tsx` nuevo
- `app/studio/(app)/layout.tsx` (lectura y prop) y `app/studio/(app)/_components/StudioTopbar.tsx` (el botón). Ojo: el topbar es compartido; ese cambio se coordina con el Director según quién lo esté tocando.
- `lib/i18n/*/guide.ts`, si hacen falta claves nuevas.

### 8.6 Aceptación prevista de 9.3

- Contrato SQL en verde (§8.2).
- La primera visita arranca sola una vez por pantalla.
- «No volver a mostrar» la apaga y el botón la sigue abriendo.
- Reanudar abre en el paso guardado y reiniciar abre en el primero.
- Hidratación: el primer render no lee `localStorage`; una prueba lo comprueba con `localStorage` sembrado distinto de `estadoInicial`.
- Si la lectura del servidor falla, el shell no se cae y la guía funciona con `localStorage`.
- Si el usuario está desactivado, no tiene acceso a su fila (RLS).

**Preguntas que cambian el diseño:** S-6 (por pantalla o toda junta) cambia solo cuándo se llama el arranque automático. S-7 (nombre y lugar del botón) cambia solo dónde se monta `GuiaBoton`.

## 2026-11-06 · Prueba de que la guía no se abre sola

**Por qué.** El Director General revisó la guía el 2026-11-05. Solo abre con `?guia=` o con `iniciarGuia()`, y hoy nada la llama. Pero ninguna prueba lo fijaba. La pidió para la 9.3.

**Qué se agregó.** Una prueba en `app/studio/_components/guia/GuiaMotor.test.tsx`: el motor está montado en la ruta de su recorrido, con todas las anclas y con progreso a medias guardado. Sin `?guia=` y sin `iniciarGuia()`, a los 5 s no hay tarjeta ni contorno, y el progreso guardado no cambió. La primera vez automática de 9.3 cambia esto a propósito; cuando entre, la prueba se ajusta a sus condiciones.

| Comprobación | Resultado |
|---|---|
| `GuiaMotor.test.tsx` | PASÓ: 17 de 17 |
| Mutantes: arrancar solo el recorrido de la ruta, arrancar solo a los 3 s, reanudar solo con progreso a medias | PASÓ: 3 de 3 caen por la prueba nueva. **El de los 3 s solo lo atrapa la prueba nueva**: era un hueco real |

## 2026-11-06 · Paso 9.3 · estado por usuario

**Encargo y puertas.** El Director General pidió la 9.3 entera, en local y en una PR en borrador, bajo esta SDD (2026-11-06). **No hay OK de Sam al diseño de la migración:** está en su lista, y la fila 9.3 no cuenta como OK. Fusionar la PR y aplicar la 0517, en prueba o en producción, también esperaban su OK. Llegó el mismo día (§ «Autorización y salida de la 0517»): la 0517 se aplicó en prueba a las 18:20:23Z y en producción a las 19:43:51Z, y la #384 se fusionó en `a63623ac9` a las 19:44:04Z. Las evidencias y el cierre están en `.agents/handoffs/0589-e9-estado.md`.

**Número.** La 0517 la asignó el Director General, medida libre a las 03:50Z: la 0514 y la 0515 son de SDD-0606 y la 0516 de otra rama. Quedó reservada sin tocar `main`, con la rama `codex/migration-reserve-0517-user-guide-prefs` (`be6e0f949`), que nunca se fusiona.

**Decisiones pendientes de Sam, con valor provisional.** Están en `lib/studio/guia/preferencias.ts`: cambiarlas es cambiar una constante.

| Pregunta | Valor provisional (propuesta del guion) | Constante |
|---|---|---|
| S-6: ¿arranca en cada pantalla la primera vez, o una sola vez? | Por pantalla | `ARRANQUE_AUTOMATICO` |
| S-7: ¿«Guía» como nombre, en la barra superior? | «Guía», en la barra superior | `CLAVE_NOMBRE_BOTON`; el lugar es donde se monte `<GuiaBoton />` |

**El botón está hecho y probado, pero no montado.** `StudioTopbar.tsx` lo tocan tres ramas del rediseño (SDD-0603). Montarlo es una línea, `<GuiaBoton />`, cuando lo permita esa adopción. Hasta entonces, la guía se abre sola la primera vez, por `?guia=` o desde el código.

**⚠️ Aplicar la 0517 enciende el arranque automático.** Hoy el único recorrido es el de demostración del Dashboard. Cada persona de Studio lo verá abrirse solo la primera vez que entre al Dashboard después de aplicar la migración. Sin la 0517 no cambia nada: la guía no arranca sola. Sam lo supo antes de dar el OK para aplicarla: la pregunta del 2026-11-06 lo explicaba (`.agents/handoffs/0589-autorizacion-0517.txt`).

### Qué quedó

| Pieza | Archivo |
|---|---|
| Tabla `user_guide_prefs`, RLS por dueño con usuario activo | `supabase/migrations/0517_user_guide_prefs.sql` |
| Contrato SQL, 20 aserciones | `supabase/tests/0517_user_guide_prefs.test.sql` |
| Contrato en PGlite, con control rojo y 9 mutantes | `lib/studio/__tests__/guia-estado.migration.test.ts` |
| Validador del estado | `lib/studio/guia/estado-types.ts` (`validarEstadoGuia`) |
| Lectura | `lib/studio/guia/estado-queries.ts` (`leerEstadoGuia`) |
| Acción de guardado | `app/studio/(app)/_actions/guia-actions.ts` (`guardarEstadoGuiaAction`) |
| Almacén por usuario | `lib/studio/guia/almacen.ts` (`crearAlmacenServidor`) |
| Arranque automático, reanudar, reiniciar, «No volver a mostrar» y cierre por evento | `app/studio/_components/guia/GuiaMotor.tsx` y `GuiaTarjeta.tsx` |
| Botón «Guía», sin montar | `app/studio/_components/guia/GuiaBoton.tsx` |
| Montaje con el estado del servidor | `app/studio/_components/guia/GuiaStudio.tsx` y `app/studio/(app)/layout.tsx` |
| Decisiones pendientes de Sam | `lib/studio/guia/preferencias.ts` |
| Espera de la 0517 y su degradación, retiradas al aplicarla (2026-11-06); desde ahí, su sello | `supabase/migrations-baseline.json` y `supabase/pending-migration-symbol-declarations.json`; el sello, en `supabase/migrations.lock.json` |
| Inventario de acciones: 459 → 460, excepciones 17 → 18 | `lib/studio/rbac-actions-guard.test.ts` |

### En qué cambia lo propuesto en §8

1. **Arranca sola solo con estado de la base.** Si `leerEstadoGuia` devuelve `null`, porque la base no respondió o la 0517 no está aplicada, `GuiaStudio` deja `autoArranque` apagado. Así, publicar el código sin aplicar la migración no le muestra la guía a nadie de golpe.
2. **«Vista» se anota al abrir, no antes de intentar.** Si la pantalla no tiene ninguna de las anclas, no se abre y tampoco se da por vista.
3. **Un cuarto origen, `programa`:** `iniciarGuia(id)` sin origen sigue abriendo en el primer paso, como en 9.2. Solo el botón (`origen: "boton"`) sigue donde quedó.
4. **El botón no cambia de nombre accesible.** Se llama siempre «Guía» y el estado va en `aria-pressed`, que es lo correcto para un botón de alternar. `toggle_on_aria` y `toggle_off_aria` van en el `title`.
5. **`guardar` acepta cambios parciales y conserva lo demás:** guardar el paso no borra `noMostrar` ni `vistoEn`.
6. **La tabla tiene tope:** `state` tiene que ser un objeto de 16 KB como máximo, y la acción rechaza más de 16 384 caracteres antes de parsear.
7. **La acción se llama `guia-actions.ts`**, para que el contrato de RBAC la recorra. Va como excepción, con la misma razón que el Dashboard: guarda la fila propia del usuario.

### Evidencia

| Comprobación | Resultado |
|---|---|
| Contrato 0517 en PGlite: 20 aserciones, control rojo sin la 0517, 9 mutantes (sin `disabled_at`, sin dueño, sin tenant, anon con lectura, sin `unique`, estado que no es objeto, sin tope, sin trigger, sin cascada) y reaplicar | PASÓ: 13 de 13 |
| Pruebas de la guía: motor, botón, montaje con hidratación, acción, validador, almacenes y lectura | PASÓ: 75 de 75 |
| 18 mutantes del código, entre ellos: arrancar sola ya vista o sin estado de la base, «No volver a mostrar» que no guarda, botón que no sigue o sigue con la guía terminada, `?guia=` que no gana, almacén que no manda o lee el navegador al crearse, y acción sin validar o sin tope | PASÓ: 18 de 18 caen por la prueba esperada, con el control en verde antes y después. Los de `?guia=` y del tope de la acción sobrevivían en la primera vuelta: las pruebas no medían eso y se corrigieron |
| RBAC: inventario 460, excepciones 18, superficie 81 archivos | PASÓ |
| Gate de símbolos pendientes | PASÓ: 0 ROJO · 1 AMARILLO declarado (`user_guide_prefs`) |
| Candado de migraciones, numeración e índice | PASÓ; la 0517, en espera sin sellar hasta aplicarla. El cierre del 2026-11-06 la selló |
| `/ui-check` de `GuiaBoton.tsx` y `GuiaTarjeta.tsx` | OK con ajustes menores, no bloqueante: cuatro controles en el primer paso automático, para mirar en vivo en 9.6; el objetivo táctil del botón, al montarlo; el `title` como pista secundaria |
| `pnpm verify` sobre `3df4e4e96`, con turno del Director General, de 04:12:51Z a 05:04:33Z | **FALLÓ en dos pasos.** (1) `typecheck`: tres claves inventadas en `estado.test.ts` que el tipo `GuiaClave` no admite. Error mío, corregido. (2) `test`, 14 852 de 14 855: vencimientos de 600 s en `prueba-migraciones-produccion.sh` y en las pruebas con dobles de `entorno-prueba-scripts.test.mjs`, scripts bash con el pool lleno; el diff no toca `scripts` ni `infra/ops`. PASÓ: harness, lint, rsc-boundary, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols, e2e y build |
| Después de la corrección: `typecheck` entero, y las dos pruebas vencidas a solas con un worker | PASÓ; 32 de 32, en 100,4 s y unos 120 s. El `verify` entero no se repitió: la corrección solo cambia esas tres claves de una prueba |
| migrations-applied, sql-tests y schema-rebuild | NO DISPONIBLE: sin `.env.local` y con Docker apagado. El contrato SQL de la 0517 corre en PGlite: ver arriba |

### revisar-datos-ve de 9.3

Estados de la skill: **ENCONTRADO**, **CORRECTO** o **NO VERIFICABLE**. Esto no es asesoría legal.

**Inventario:** por usuario y tenant, ids de recorrido y de paso, `terminado`, `noMostrar` y la fecha en que la guía se abrió sola por primera vez. Describe si un empleado vio la guía. No hay datos de clientes. En el navegador queda la misma copia que en 9.2, ahora con dos campos más.

**Resumen:** 0 ENCONTRADO, 6 CORRECTO, 2 NO VERIFICABLE y 4 no aplica.

| # | Punto | Estado | Evidencia y comentario |
|---|---|---|---|
| 1 | Inventario | CORRECTO | `0517_user_guide_prefs.sql:43-46` y `estado-types.ts:37-57`. Solo ids, booleanos y una fecha |
| 2 | Minimización | CORRECTO | `validarEstadoGuia` descarta todo lo que no está en el catálogo (`estado-types.ts:51`). Tope de 16 KB en la tabla (`0517_user_guide_prefs.sql:46`) y en la acción (`guia-actions.ts:22`) |
| 3 | Consentimiento | No aplica | Es estado de una herramienta interna del empleado, no un dato del cliente. La base la decide Sam con su asesor si hiciera falta |
| 4 | Derechos | CORRECTO | El dueño lee y borra su fila (`0517_user_guide_prefs.sql:61-75`, `grant … delete` en la línea 79); contrato: «el dueño borra su fila» |
| 5 | Borrado | CORRECTO | En cascada con el usuario y con el tenant (`0517_user_guide_prefs.sql:43-44`); contrato: «al borrar el usuario se borra su fila» |
| 6 | Trazabilidad de solicitudes | NO VERIFICABLE | No hay registro de pedidos de acceso o borrado en Studio. Sigue igual que en el resto del programa |
| 7 | Política pública | No aplica | No es un dato que `/privacidad` tenga que nombrar: es de empleados, no de clientes |
| 8 | Terceros | CORRECTO | Nada sale de Studio y la base propia |
| 9 | Transferencia internacional | No aplica | Mismo servidor y base que el resto de Studio |
| 10 | Decisiones automatizadas | No aplica | Abrir la guía sola no decide nada sobre la persona |
| 11 | Aceptación electrónica | NO VERIFICABLE | No registra aceptaciones. Si la guía llegara a pedir una, sería otro paso |
| 12 | Titulares que no son usuarios | CORRECTO | Solo usuarios de Studio, y un usuario desactivado no accede a su fila (`0517_user_guide_prefs.sql:67` y `:74`; contrato) |

## 2026-11-06 · Autorización y salida de la 0517

**OK de Sam** (2026-11-06, ~17:35Z, en el chat del Director General, por el selector):

- **Aplicar la 0517:** «Prueba y producción (Recomendado)». La opción decía «Primero en prueba, con lectura previa; después en producción, con respaldo».
- **Fusionar la #384,** con la #383: «Sí, las dos (Recomendado)».

El texto completo está en `.agents/handoffs/0589-autorizacion-0517.txt`.

**Orden (migrate-first):** el ensayo en prueba, la lectura previa y el control previo en producción, la 0517 en producción con respaldo (la aplica el Director General) y, enseguida, la fusión. Sin la tabla, la guía no arranca sola y nada se rompe: `leerEstadoGuia` devuelve `null` con 42P01 o PGRST205 (`estado.test.ts:193`).

**Controles, en solo lectura y sin filas de negocio:**

- `scripts/qa/0517-control-previo.sql`: lo que pide el preflight y que la 0517 no esté. Son 10 comprobaciones `si`/`no`.
- `scripts/qa/0517-control-posterior.sql`: una fila en el ledger y la tabla con sus 6 columnas, el `unique`, las dos cascadas, el check, el trigger, la RLS, la policy con el tenant activo, los permisos (ni `anon` ni `public`; `authenticated` con cuatro), y vacía. Son 15 comprobaciones.
- **Prueba:** `lib/studio/__tests__/guia-estado-control.migration.test.ts` los corre en PGlite con la 0517 real. Tiene tres controles (el previo y el posterior en verde, y el previo con la 0517 ya puesta) y doce mutantes, y cada mutante tumba solo su comprobación.
- **El previo, corrido en solo lectura el 2026-11-06 hacia las 18:05Z:** las 10 comprobaciones dan `si`, en prueba y en producción.

## 2026-11-06 · Pasos 9.4 y 9.5 · guía dentro de Chatwoot y recorridos por rol

**Encargo.** El Subdirector de Chatwoot pidió la 9.4 y la 9.5 en una PR en borrador contra `main`, sin desplegar nada (2026-11-06). La 9.6, la prueba con la persona que atiende, queda fuera.

**Puertas que esta PR no abre:**

- **Pegar el script en el Super Admin de Chatwoot** (`DASHBOARD_SCRIPTS`) exige OK de Sam. Sin el script, las tarjetas de Chatwoot se anclan al marco de la Bandeja y nada se rompe. Antes de pegarlo hay que resolver los hallazgos 3 y 4 de la revisión del Director General (sección «2026-11-07 · Revisión del Director General»).
- **Fusionar** también espera su OK. Fusionar publica Studio, pero los recorridos nuevos **no arrancan solos** (D11): solo abren con `?guia=<id>`. Embudo necesita además la pestaña: `?tab=embudos&guia=embudo`.
- S-1, S-6, S-7 y S-8 siguen abiertas. Los valores provisionales están en `lib/studio/guia/preferencias.ts`. S-2 se cerró el 2026-11-07 (ver «Roles» en 9.5).

### 9.4 · Diseño

**Qué recorre.** Las tarjetas «(Chatwoot)» del guion que caen dentro del panel de Chatwoot: B1 a B6 y F1. La Bandeja de Studio enmarca el panel (decisión de 2.1: iframe), así que la tarjeta sigue siendo la de Studio y solo el ancla está del otro lado del marco.

**Cómo funciona.**

1. **El script** (`infra/chatwoot/panel/guia-panel.html`) va en `DASHBOARD_SCRIPTS`, debajo del de cierre de sesión. Chatwoot 4.19.1 lo pone al final del `<body>` de cada página del panel. No dibuja nada ni lee texto: **solo mide**. Recibe la lista de anclas con sus selectores, devuelve el rectángulo de cada una (o `null`) y lleva una a la vista cuando se lo piden.
2. **Se activa por `postMessage`.** Studio manda `dtd:guia:mirar` solo mientras hay una guía abierta, y `dtd:guia:parar` al cerrarla. Sin pedido, el script no observa nada: no pesa sobre el panel. Al cargar, el script avisa `dtd:guia:listo` para que Studio repita el pedido si la guía ya estaba abierta.
3. **Los selectores viven en un solo archivo de Studio,** `lib/studio/guia/chatwoot-selectores.json`, y viajan en el mensaje. Si una versión de Chatwoot los rompe, se arreglan con una PR de Studio, sin volver a pegar nada en el Super Admin. El smoke de E3 lee ese mismo archivo.
4. **En Studio,** `usePuenteChatwoot` (en `BandejaClient`) registra un *ubicador*. El motor le pregunta por las anclas que no encuentra en su propio DOM y suma el desplazamiento del marco al rectángulo que llegó. El contorno se dibuja en Studio, encima del marco, con `pointer-events: none`.
5. **Ancla de respaldo.** Cada paso de Chatwoot trae `respaldo: "bandeja.marco"`. Si el selector no aparece (otra versión, ninguna conversación abierta, bandeja sin WhatsApp), la tarjeta se ancla al marco y el texto sigue valiendo. Así lo pide el guion.

**Protocolo.**

| Sentido | Mensaje | Contenido |
|---|---|---|
| Chatwoot → Studio | `dtd:guia:listo` | nada |
| Studio → Chatwoot | `dtd:guia:mirar` | `anclas: { [ancla]: { css: string[], cerca?: string } }` |
| Chatwoot → Studio | `dtd:guia:cajas` | `cajas: { [ancla]: { top, left, width, height } \| null }`, en coordenadas del marco; solo cuando algo cambió |
| Studio → Chatwoot | `dtd:guia:mostrar` | `ancla`, `suave` (falso con `prefers-reduced-motion`) |
| Studio → Chatwoot | `dtd:guia:parar` | nada |

**Seguridad.**

- El script acepta mensajes solo de `https://dtdcargo.com` y `https://www.dtdcargo.com`, y solo de la ventana que lo enmarca. Contesta solo a ese origen. Es la misma regla del script de cierre de sesión.
- Studio acepta mensajes solo del origen del chat y del `contentWindow` de su propio marco.
- Topes en el script: 20 anclas, 4 selectores por ancla, 200 caracteres por selector y nombres de ancla con el formato del guion. Un selector inválido se ignora sin romper el panel.
- El script no lee texto, valores, cookies ni almacenamiento: solo `getBoundingClientRect`.

**Datos personales.** No viaja ningún dato: solo nombres de ancla, selectores CSS y rectángulos (D14).

**Riesgo de versión.** Chatwoot no publica un contrato de su DOM. Los selectores salen del código fuente de `chatwoot/chatwoot` en la etiqueta `v4.19.1` (ReplyBox, ReplyTopPanel, EditorModeToggle, ReplyBottomPanel, ChatListHeader, Sidebar, ConversationAction, MultiselectDropdown, ConversationBox y TabsItem) y **no están medidos en el panel vivo** (NV). Varios usan clases de Tailwind, que cambian con facilidad. Lo que protege:

- el respaldo al marco: un selector roto deja la tarjeta en el marco, sin error;
- el smoke `infra/chatwoot/pruebas/smoke-guia.mjs`, que entra a la corrida §4 del [runbook de versiones](../../runbooks/chatwoot-versiones.md) y a su smoke S13: cada ancla obligatoria tiene que aparecer en la versión nueva;
- §3 del mismo runbook suma los archivos `.vue` de los que salen los selectores al diff de la superficie.

**Marcha atrás.**

1. **Del script:** volver a pegar en `DASHBOARD_SCRIPTS` solo `dashboard-scripts.html`, que es lo que se cargó el 2026-11-03. Las tarjetas de Chatwoot pasan al marco; el cierre de sesión no cambia.
2. **De Studio:** revertir la PR. Sin el puente, los pasos de Chatwoot se anclan al marco; sin los recorridos, no hay guía en esas pantallas.
3. Nada de esto toca datos de Chatwoot ni de Studio.

### 9.5 · Diseño

**Un recorrido del motor es una pantalla.** Las tarjetas del guion se reparten según la pantalla de `main` donde existe su ancla. Una tarjeta sin pantalla, o con un texto que no describe la pantalla real, queda pendiente con su motivo. No se inventa ninguna pantalla ni se cambia ningún texto: los textos de `guide.ts` son los del guion aceptado. La excepción son los de U1 y U3, que Sam aprobó el 2026-11-07 (ver abajo).

**Roles.** `GuiaRecorrido.roles` y `GuiaPaso.roles` son opcionales. Sin ellos, vale el permiso de la pantalla. `recorridosParaRol` filtra el catálogo con el rol del layout antes de entregárselo al motor; un recorrido sin pasos para el rol desaparece. «Agente» del guion es quien tiene el módulo Bandeja: `commercial` y `support` (`lib/studio/rbac.ts`).

| Recorrido | Ruta | Rol | Pasos (guion) | Anclas |
|---|---|---|---|---|
| `bandeja` | `/studio/bandeja` | módulo Bandeja: admin, commercial, support | B1, B2, B3, B4, B5, B6 y F1; U1, solo admin | (Chatwoot) `bandeja.composer`, `bandeja.filtro-canal`, `bandeja.buscar`, `bandeja.asignar`, `bandeja.plantillas`, `bandeja.nota-privada` y `ficha.panel`, todas con respaldo `bandeja.marco`. (Studio) `usuarios.acceso-bandeja`, en Vínculos, debajo del marco |
| `embudo` | `/studio/crm`, pestaña Embudos | admin, commercial (la RLS de la 0506) | E1, E2, E3 y E4 | `embudo.tablero`, `embudo.tarjeta`, `embudo.tareas` y `embudo.columna-entrada` |
| `cliente` | `/studio/clientes/<markbox>` | quien ve la ficha con la tarjeta de conversaciones | F3 | `cliente.conversaciones` |
| `actualizaciones` | `/studio/admin/actualizaciones` | admin | A1, A2 y A3 | `actualizaciones.version`, `actualizaciones.analizar` y `actualizaciones.pedir`; las dos últimas solo aparecen con una versión nueva publicada |

B4 (asignar) la ven admin, commercial y support: `ROLES_ASIGNAR` en `preferencias.ts`. **S-2 quedó cerrada** el 2026-11-07 a las 07:00Z. Sam, literal: «También quien atiende». El permiso real de asignar lo da Chatwoot; la constante solo decide quién ve la tarjeta.

**Embudo pide su pestaña (P-13).** `page.tsx` monta el tablero solo con `tab === "embudos"`, y sin tablero no hay anclas `embudo.*`. Hasta el P-13, el recorrido abría solo con `/studio/crm?tab=embudos&guia=embudo`. Desde el P-13, `RECORRIDO_EMBUDO` lleva `consulta: { tab: "embudos" }` y el motor pone la pestaña: `/studio/crm?guia=embudo` abre con cualquier pestaña por defecto. Ver la sección del 2026-11-07, al final.

**Pendientes, sin inventar:**

| Tarjeta | Motivo | Qué falta |
|---|---|---|
| F2 `ficha.vincular`, I2 `ficha.sugerencia`, I3 `ficha.copiar` | Están dentro de la Ficha DTD, una página de Studio que Chatwoot enmarca (`app/studio/(panel)/ficha-chat`) y que no monta el motor. I2 e I3 dependen además de 7.8 | Montar el motor en `(panel)` o una guía propia de la ficha; S-8 para F2 |
| F4 `chrome.contador-bandeja` | El contador está en `StudioSidebar`, que tocan las ramas del rediseño (SDD-0603) | Poner el ancla cuando la adopción lo permita |
| I1 `ia.interruptor`, I4 `ia.limites` | La pantalla de modos de la IA (7.7) no existe en `main` | 7.7; S-1 para I1 |
| U2 `usuarios.bandejas` | No hay en `main` una pantalla para elegir las bandejas o el equipo de cada persona: la matriz de 2.7 sale del rol | La pantalla, si se decide hacerla |
| U3 `usuarios.baja` | El texto aprobado el 2026-11-07 nombra el botón real, y el ancla está en él (`UserDetailDrawer.tsx`). Pero la ficha es un cajón: capa 100, con fondo y trampa de foco. La tarjeta de la guía va en la capa 90, debajo. Por eso, el paso (`PASO_QUITAR_ACCESO`) no entra en ningún recorrido | **9.6:** arrancar la guía desde la ficha |

Por eso no hay recorrido de Usuarios ni de IA. U1 va en el recorrido `bandeja`, U3 espera a la 9.6, y U2, I1 e I4 no tienen pantalla en `main`.

**Textos que prometen pasos pendientes.** Se usan tal cual, porque son los aceptados, pero describen el estado final del programa:

| Tarjeta | Lo que dice | Paso del que depende |
|---|---|---|
| B1 | «El cliente lo recibe en el mismo número de siempre» | 4.5 |
| B2 | Contestar el correo desde la Bandeja | 4.8 |
| B3 | La bandeja «Archivo Kommo» | 5.5 |
| B5 | «Tienen el mismo texto que las de Kommo» | 4.5 |
| E1 | «Entra a Embudo en el menú»: hoy es CRM › Embudos. «Los leads ya vienen de Kommo» | 6.5 |
| E2 | «Algunas etapas cambian solas, como cuando sale una cotización» | 6.6 |
| E3 | «Studio te avisa de los leads sin atender…» | 6.6 y 6.7 |

Por esto mismo vale D11: ningún recorrido nuevo arranca solo antes de la 9.6.

**Propuesta de textos para U1 y U3, aplicada.** Fue primero al DG, porque el guion está aprobado. Sam la aprobó el 2026-11-07 a las 07:02Z, literal: «Apruebo los dos». Los textos quedan palabra por palabra:

- U1, en el recorrido `bandeja`, solo admin. Qué es: «Desde Vínculos decides quién entra a la Bandeja. No hay que crear la cuenta dos veces.» Ahora aquí: «Invita a la persona en Usuarios y vincúlala aquí. Studio le crea la cuenta en el chat.»
- U3, en la ficha de la persona. Ahora aquí: «Abre a la persona en Usuarios y pulsa Suspender acceso. Se cierra su sesión en la Bandeja y ya no puede entrar por fuera.»

Las huellas son el sha256 del texto entre « », 16 caracteres: U1 «Qué es», 86 caracteres, `d5654c7bab073a82`; U1 «Ahora aquí», 86, `ceae585ea7ba8997`; U3 «Ahora aquí», 121, `c8036fae1eaf9340`. El «Antes en Kommo» de las dos y el «Qué es» de U3 son los del guion. Están en `guide.users.grant` y `guide.users.revoke`, y `guia.test.ts` comprueba las tres huellas.

### Decisiones

- **D7 · Studio dibuja, Chatwoot mide.** Hay una sola tarjeta, la de 9.2, con su accesibilidad, su marca y sus textos de i18n. Se descartó dibujar la tarjeta dentro de Chatwoot: eran dos implementaciones de foco, teclado y anuncios, y sin los tokens de Studio.
- **D8 · Selectores en Studio, no en el script.** Arreglarlos tras una versión nueva es una PR normal. El script pegado cambia poco, y cada cambio suyo pide un OK.
- **D9 · Respaldo al marco por paso** (`GuiaPaso.respaldo`). El motor salta un paso solo si faltan las dos anclas.
- **D10 · Ubicadores registrables** (`lib/studio/guia/ubicadores.ts`). El motor no sabe de Chatwoot: pregunta a los ubicadores por las anclas que no están en su DOM. La Bandeja registra el suyo.
- **D11 · Sin arranque automático para los recorridos nuevos** (`arranqueAutomatico: false`). La 0517 está aplicada en producción: sin esto, fusionar abriría estas guías solas a todo el equipo, con textos que prometen pasos que faltan y sin la 9.6. Se abren con `?guia=bandeja`, `?guia=embudo`, `?guia=cliente` y `?guia=actualizaciones`. Para Embudo, hasta el P-13 hacía falta además `?tab=embudos`; desde el P-13 la pone el motor. Encenderlo es cambiar ese campo, después de la 9.6 y con OK de Sam.
- **D12 · Roles en los datos** (`roles` en el recorrido y en el paso), filtrados con `recorridosParaRol` antes del motor. Mostrar una tarjeta de más no es un agujero, porque cada pantalla tiene su gate, pero el guion fija quién ve cada tarjeta.
- **D13 · zh-CN provisional,** como D3: las claves nuevas se traducen porque el tipo exige los dos idiomas. S-3 sigue abierta.
- **D14 · Sin revisión aparte de datos personales.** No se captura, mueve ni guarda ningún dato nuevo: los ids de recorrido y de paso ya estaban en la 0517, y el puente solo mueve geometría.

### Allowlist exacta de 9.4 y 9.5

- **Motor:** `lib/studio/guia/tipos.ts`, `motor.ts`, `recorridos.ts`, `preferencias.ts`, `ubicadores.ts` (nuevo), `puente-chatwoot.ts` (nuevo) y `chatwoot-selectores.json` (nuevo); `app/studio/_components/guia/GuiaMotor.tsx`, `GuiaStudio.tsx` y `usePuenteChatwoot.ts` (nuevo).
- **Textos:** `lib/i18n/es-VE/guide.ts` y `lib/i18n/zh-CN/guide.ts`.
- **Montaje:** `app/studio/(app)/layout.tsx`, solo la prop `rol` de `<GuiaStudio>`.
- **Anclas `data-guia`:**
  - `app/studio/(app)/bandeja/_components/BandejaClient.tsx`, más el puente;
  - `app/studio/(app)/crm/_components/CrmTableroKanban.tsx`;
  - `app/studio/(app)/clientes/_components/ChatwootConversacionesCard.tsx`;
  - `app/studio/(app)/admin/actualizaciones/_components/ActualizacionesPanel.tsx`;
  - `app/studio/(app)/bandeja/_components/VinculosAdmin.tsx`, para U1 (agregado el 2026-11-07);
  - `app/studio/(app)/usuarios/_components/UserDetailDrawer.tsx`, para U3 (agregado el 2026-11-07).
- **Chatwoot:** `infra/chatwoot/panel/guia-panel.html` (nuevo), `infra/chatwoot/pruebas/smoke-guia.mjs` y `smoke-guia-nucleo.mjs` (nuevos).
- **Pruebas:** `lib/studio/guia/__tests__/guia.test.ts`, `puente.test.ts` (nuevo) y `anclas.test.ts` (nuevo); `lib/studio/chatwoot/__tests__/guia-panel.test.ts` (nuevo); `app/studio/_components/guia/GuiaMotor.test.tsx`, `GuiaStudio.test.tsx` y `usePuenteChatwoot.test.tsx` (nuevo).
- **Documentos:** esta spec, `docs/runbooks/chatwoot-versiones.md` (pieza propia, §3, §4 y S13), `docs/runbooks/chatwoot-agentes.md` (cómo pegar los dos scripts y la marcha atrás), `.agents/handoffs/0589-e9-recorridos.md` y, desde el 2026-11-07, `docs/specs/0582-chatwoot-piloto/guia-guion.md` (B4, U1, U3 y la pregunta S-2). Las filas 9.4 y 9.5 del checklist no se tocan, igual que la 9.3: las mueve quien cuenta el avance. El texto propuesto está en el handoff.

### Aceptación de 9.4 y 9.5

| # | Criterio | Evidencia |
|---|---|---|
| G1 | El script solo atiende a Studio desde el marco padre y responde solo a ese origen | `guia-panel.test.ts` |
| G2 | El script mide lo pedido, con `cerca`, y avisa solo cuando algo cambió; un selector inválido o de más no rompe nada | `guia-panel.test.ts` |
| G3 | `mostrar` lleva el ancla a la vista y `parar` deja de observar | `guia-panel.test.ts` |
| G4 | El script no lee texto, cookies ni almacenamiento | `guia-panel.test.ts` (análisis del texto) |
| G5 | Los selectores están en un solo archivo, con formato válido, y el smoke y el script resuelven igual | `puente.test.ts` y `guia-panel.test.ts` |
| G6 | Studio acepta cajas solo del marco y del origen del chat, y las pasa a coordenadas de la página | `puente.test.ts` y `usePuenteChatwoot.test.tsx` |
| G7 | Un paso de Chatwoot sin su ancla se ancla al marco; sin marco, se salta | `GuiaMotor.test.tsx` |
| G8 | Al llegar la caja, el contorno pasa del marco al elemento | `GuiaMotor.test.tsx` |
| G9 | Smoke en E3 | `smoke-guia.mjs` con su núcleo probado; S13 en §6 y la corrida en §4 del runbook. **Correrlo contra un Chatwoot real queda NO EJECUTADO:** no hay Docker en esta PC ni OK de despliegue |
| R1 | Recorridos del catálogo válidos, con claves en es-VE y zh-CN y el tono del guion | `guia.test.ts` |
| R2 | Cada ancla de Studio existe en la pantalla que dice el recorrido | `anclas.test.ts`, con piso de coincidencias y mutante |
| R3 | Filtro por rol: B4 para admin, commercial y support (S-2), U1 solo admin, Actualizaciones solo admin y Embudo sin support | `guia.test.ts` |
| R4 | Ningún recorrido nuevo arranca solo | `GuiaMotor.test.tsx` y `GuiaStudio.test.tsx` |
| R5 | El layout pasa el rol a la guía | `GuiaStudio.test.tsx` |
| R6 | El recorrido Embudo abre en `/studio/crm?guia=embudo`, sin `?tab=`, con la pestaña por defecto en Dirección (hoy), Embudos (S0 de la 6.6) o Resumen (S3). El motor pone `?tab=embudos` (P-13). Antes del P-13 abría solo con `/studio/crm?tab=embudos&guia=embudo` | Las anclas en `CrmTableroKanban`: `anclas.test.ts`. La pestaña y la apertura con cada pestaña por defecto: `GuiaEmbudoPestana.test.tsx`, roja sobre `main` `ecadbac91` y con mutantes (P-13, abajo). Que el tablero solo se monta con `tab === "embudos"`: leído en `page.tsx`. Abrirlo en la página real: **NO EJECUTADO** |
| R7 | U1 y U3 llevan los textos aprobados, comprobados con su huella. El ancla de U1 está en Vínculos y la de U3, en el botón Suspender acceso de la ficha. U3 no entra en ningún recorrido hasta la 9.6 | `guia.test.ts` y `anclas.test.ts`. Abrir U1 en la página real: **NO EJECUTADO**. Arrancar U3 desde la ficha: 9.6 |

### Qué cambió frente al diseño

- **El ubicador distingue tres casos** (`GuiaUbicador.caja`). `undefined`: el panel no tiene el ancla. `null`: la tiene, pero fuera de la parte visible del marco. Una caja: la tiene a la vista. En el segundo caso el motor ancla la tarjeta al marco y le pide al panel `mostrar`; cuando llega la caja nueva, el contorno pasa al elemento.
- **El título de F3 se cortó** a «Conversaciones en la ficha del cliente» (38 caracteres). El del guion tenía 42, y el guion manda cortar el texto antes que agrandar la tarjeta.
- **Comillas internas «».** El guion usa comillas rectas dentro de sus «» («Archivo Kommo», «usuario responsable», «Ventas DTD», «Ping 23 h», «Leads entrantes»). En `guide.ts` van con «», como el resto del diccionario. Es tipografía; la redacción no cambia.
- **Varias anclas repetidas.** `embudo.tarjeta` y `embudo.tareas` están en todas las tarjetas; el motor toma la primera del DOM.

### Evidencia de 9.4 y 9.5 (2026-11-06)

| Comprobación | Resultado |
|---|---|
| Pruebas de la guía: `lib/studio/guia`, `app/studio/_components/guia` y `lib/studio/chatwoot/__tests__/guia-panel.test.ts`, con `--pool=threads --maxWorkers=1` | PASÓ: 140 de 140 en 9 archivos (contado con el reporte JSON de Vitest). Hay 69 pruebas nuevas: `guia-panel.test.ts` 18, `puente.test.ts` 17, `usePuenteChatwoot.test.tsx` 13, `anclas.test.ts` 4, `guia.test.ts` +8, `GuiaMotor.test.tsx` +6 y `GuiaStudio.test.tsx` +3 |
| Pantallas tocadas: `bandeja`, `crm/_components`, `clientes/_components` y `admin/actualizaciones` | PASÓ: 170 de 170 en 18 archivos |
| 12 mutantes, uno por vez y restaurados: el script sin control de origen, sin control de ventana, que manda sin cambios, que ignora `cerca` o que contesta a `*`; el puente sin control de ventana, que mide sin guía abierta o que no olvida al cerrar; el motor sin respaldo o que arranca solo igual; el rol que no filtra pasos, y las coordenadas sin recorte | PASÓ: 12 de 12 caen por su prueba, con la suite en verde antes y después. Los archivos quedaron iguales a su original |
| `tsc --noEmit` del proyecto | PASÓ |
| ESLint de los archivos tocados, con `--max-warnings=0` | PASÓ. Los `.mjs` de `infra/` están fuera de ESLint por configuración; se revisaron con `node --check` |
| `docs:check`, `sdd:check`, `components:check`, `governance:check`, `rsc-boundary` y `git diff --check` | PASÓ |
| `smoke-guia.mjs` sin variables | Sale con 2 y no imprime nada sensible |
| `smoke-guia.mjs` contra un Chatwoot real (ensayo de §4 o S13) | **NO EJECUTADO:** no hay Docker en esta PC y no hay OK de despliegue. Los selectores siguen NV en el panel vivo |
| Script pegado en `DASHBOARD_SCRIPTS` | **NO EJECUTADO:** es una puerta con OK de Sam |
| `/ui-check` del diff | OK con ajustes menores, no bloqueante. Aplicado: las comillas «». Para mirar en vivo en la 9.6: con la tarjeta sobre el marco, la colocación libre la deja abajo a la derecha, encima del composer del chat. Ya anotado: el texto de E1 («Embudo en el menú») |
| `pnpm verify` | **NO EJECUTADO:** necesita turno del Director General. Queda para el CI de la PR |

### 2026-11-07 · S-2 cerrada y textos de U1 y U3

**Encargo.** El Subdirector de Chatwoot trajo dos respuestas de Sam, sobre `3a570e5fb` y antes de la revisión del Director General:

- **S-2,** 2026-11-07 07:00Z: «También quien atiende». `ROLES_ASIGNAR` pasa a `["admin", "commercial", "support"]`.
- **U1 y U3,** 2026-11-07 07:02Z: «Apruebo los dos». Los textos de la propuesta se aplican palabra por palabra, con las huellas de arriba.

**Qué cambió:**

- U1 entra al final del recorrido `bandeja`, solo admin, con el ancla en la sección Vínculos (`VinculosAdmin.tsx`). Es un ancla de Studio, sin respaldo al marco.
- U3 tiene su ancla en el botón Suspender acceso de la ficha de la persona (`UserDetailDrawer.tsx`). El paso existe (`PASO_QUITAR_ACCESO`), pero no entra en ningún recorrido. La ficha se abre con `?persona=<id>` y es un `DrawerShell`: capa 100, fondo y trampa de foco. La tarjeta de la guía va en la capa 90, así que quedaría debajo. Arrancar la guía desde la ficha queda para la 9.6. No se inventó pantalla.
- `guide.users.grant` y `guide.users.revoke` existen igual en es-VE y zh-CN. zh-CN sigue provisional (D13).

**Rojo previo de B4.** La prueba nueva se corrió primero con `ROLES_ASIGNAR = ["admin"]`. Falló en `guia.test.ts:175`: `pasosDe("commercial", "bandeja")` dio `B1, B2, B3, B5, B6, F1`, sin B4. Con los tres roles, pasa.

| Comprobación | Resultado |
|---|---|
| Pruebas de la guía: `lib/studio/guia`, `app/studio/_components/guia` y `guia-panel.test.ts`, con `--pool=threads --maxWorkers=1` | PASÓ: 144 de 144 en 9 archivos (reporte JSON de Vitest). Hay 4 pruebas nuevas: los textos de U1 y U3 con su huella, U1 solo admin, el ancla de U1 en Vínculos y la de U3 en la ficha |
| `puente.test.ts` | Ajustada: el archivo de selectores cubre los pasos de Chatwoot de la Bandeja, y el único que queda fuera es U1 |
| Pantallas tocadas: `bandeja` y `usuarios` | PASÓ: 131 de 131 en 11 archivos |
| 3 mutantes, uno por vez y restaurados: sin el ancla de U1, sin el ancla de U3 y el texto de U3 cambiado | PASÓ: 3 de 3 caen por su prueba. Los archivos quedaron iguales a su original (sha256) |
| Huellas medidas sobre `lib/i18n/es-VE/guide.ts` | `d5654c7bab073a82`, `ceae585ea7ba8997` y `c8036fae1eaf9340`, iguales a las aprobadas |
| `tsc --noEmit` del proyecto | PASÓ |
| ESLint de los 9 archivos de código tocados, con `--max-warnings=0` | PASÓ |
| `sdd:check` (`scripts/check-numbering.mjs`), `docs:check` y `git diff --check` | PASÓ |
| Abrir U1 en la página real | **NO EJECUTADO** |
| `pnpm verify` | **NO EJECUTADO:** lo corre el Director General en su turno |

### 2026-11-07 · Revisión del Director General

**Fuente.** Mensaje del Director General, hacia las 09:25Z, sobre la cabeza `b218f1004`. La revisión independiente salió APPROVED, sin graves. Su `pnpm verify` (08:28Z a 09:19Z, en un worktree aparte) dio exit 1 por dos causas:

- **`test`:** dos pruebas de scripts bash con dobles pasaron los 600 s (`infra/ops/tests/migraciones.test.mjs:483` y `scripts/__tests__/entorno-prueba-scripts.test.mjs`). El DG lo atribuye al ambiente, y esta PR no toca esos archivos. No se cambió nada.
- **`pending-migration-symbols`:** `GuiaStudio.tsx:48` no tenía la evidencia `autoArranque={almacen.conServidor}`. Esa declaración de la 0517 ya no está en `main`, porque la retiró el cierre de la #405, pero la base `7a3cde25d` la arrastraba.

**Qué se hizo:**

- **Merge (no rebase) de `origin/main` `5650ac4fe`,** con el driver de `main` (`scripts/merge-generated-records.mjs`). Salió sin conflictos. El índice regenerado con `build-docs-index.mjs` quedó igual al que resolvió el driver. `supabase/pending-migration-symbol-declarations.json` y `migrations-baseline.json` quedaron idénticos a los de `main`: ninguno nombra la 0517.
- **Hallazgo 1 (baja):** al retomar con el botón, `GuiaMotor.tsx` miraba solo el ancla del paso (`existeAncla`) y no su respaldo, a diferencia del resto del motor. Sin el script del panel, cerrar en un paso de Chatwoot y volver a abrir arrancaba en B1. Ahora usa `pasoPresente`. La prueba nueva de `GuiaMotor.test.tsx` falló antes del cambio: guardó B6, pero abrió en «Contestar un WhatsApp», 1 de 2. Con el cambio, pasa.
- **Hallazgo 2 (baja):** en `guia-panel.html`, `mostrar` leía `pedido[datos.ancla]`, que acepta `__proto__` o `constructor` y lanzaba un TypeError. Ahora exige un ancla propia del pedido (`Object.prototype.hasOwnProperty.call`). La prueba nueva de `guia-panel.test.ts` falló antes con `TypeError: Cannot read properties of undefined (reading 'length')`. Con el cambio, pasa.

**Pendientes antes de pegar el script en el VPS** (hallazgos 3 y 4, sin cambiar en esta PR):

- **Hallazgo 3 · El panel ejecuta cualquier selector.** El script acepta los selectores que le manda Studio en `dtd:guia:mirar` y los pasa a `document.querySelector`. `limpiar` acota la cantidad y el largo, pero no cuáles. La propuesta del DG es una lista fija dentro del script. Ese cambio pide pegar el script otra vez después de cada versión de Chatwoot, lo que choca con D8; hay que decidirlo antes de pegarlo.
- **Hallazgo 4 · `bandeja.asignar` y `ficha.panel` son frágiles.** `bandeja.asignar` usa clases de maquetación (`[class*='md:w-[320px]'] .relative.w-full.mb-2 > button`). `ficha.panel` usa una posición (`.conversation-details-wrap ul > li:nth-child(2) > a`). El smoke (`smoke-guia.mjs`) solo mide que algo coincida, no que sea el control correcto. Hace falta un ancla más firme o un smoke que mire qué elemento encontró.

Evidencia de esta ronda:

| Comprobación | Resultado |
|---|---|
| Pruebas de la guía: `lib/studio/guia`, `app/studio/_components/guia` y `guia-panel.test.ts`, con `--pool=threads --maxWorkers=1` | PASÓ: 146 de 146 en 9 archivos (reporte JSON de Vitest), con 2 pruebas nuevas, una por hallazgo |
| Pantallas `bandeja` y `usuarios`, ya con `main` | PASÓ: 145 de 145 en 12 archivos |
| `tsc --noEmit` del proyecto, ya con `main` | PASÓ |
| ESLint de `GuiaMotor.tsx`, `GuiaMotor.test.tsx` y `guia-panel.test.ts`, con `--max-warnings=0` | PASÓ. `guia-panel.html` está fuera de ESLint por configuración (`infra/**`); su script pasó `node --check` |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO y 2 AMARILLO declarados, la 0514 y la 0515, que vinieron de `main`. Nada de la 0517 ni de `GuiaStudio.tsx` |
| `sdd:check` (`scripts/check-numbering.mjs`), `docs:check` y `git diff --check` | PASÓ |
| `pnpm verify` | **NO EJECUTADO:** lo corre el Director General en su turno |

## 2026-11-07 · Paso P-13: la guía llega a Embudos con cualquier pestaña por defecto

> **Paso abierto el 2026-11-07,** después de que la #408 entrara en `main`. El encargo lo trajo el Subdirector de Chatwoot. El registro original sigue tal cual; el diseño, la allowlist y la evidencia están al final de esta sección.

**Fuente.** Decisión del Director General del 2026-11-07, hacia las 04:20Z. La propuesta es de E6, encontrada en la 6.6 (SDD-0614 §2.1), y la trajo el Subdirector de Chatwoot.

**El problema (P-13).**

- En el tramo S3 de la 6.6, la pestaña por defecto de `/studio/crm` pasa a ser **Resumen**.
- Sin `?tab=`, la página ya no monta el tablero.
- `RECORRIDO_EMBUDO` (9.5) no encuentra entonces sus anclas `embudo.*` y no abre: `rutaCoincide` mira el camino, no la pestaña.
- E6 lo infirió del código; nadie lo corrió. Hoy no rompe nada: D11 tiene apagado el arranque automático.

**Condiciones del Director General.**

1. Lo resuelve la SDD-0589 en un **paso aparte, con PR propia, después de la #408**. No es un ajuste de `836edcd18`.
2. La 6.6 no toca la guía.
3. **S3 de la 6.6 no se fusiona antes de este paso.**
4. El paso trae una prueba que **falla hoy, con Dirección por defecto**, y también con Resumen por defecto, como queda en S3. Con el arreglo, **pasa**. El Director General amplió esta regla el 2026-11-07, al confirmar la observación de abajo. El arreglo es un recorrido que abre `?tab=embudos` o un `rutaCoincide` que mira la pestaña. Lo elige y lo justifica el Worker al abrir el paso.
5. **No arranca todavía.** E9 no abre pasos nuevos hasta que el Director General cierre la revisión de la #408.

**Observación del Worker (2026-11-07).** Leído en el código, sin correrlo, sobre `836edcd18` y sobre `origin/main` en `f28c5dcc1`:

- La pestaña por defecto ya es **Dirección**, no Embudos (`resolveKommoTab`, en `app/studio/(app)/crm/_components/kommo-tabs.shared.ts`). `page.tsx` monta el tablero solo con `tab === "embudos"`.
- Por eso, hoy `/studio/crm?guia=embudo` tampoco abre: el motor reintenta 2 s, no encuentra ancla y no abre. El recorrido abre en `/studio/crm?tab=embudos&guia=embudo`.
- D11 decía `?guia=embudo`, sin la pestaña. El 2026-11-07 se corrigió a `?tab=embudos&guia=embudo`, igual que en el handoff y en la nota de puertas de 9.4 y 9.5. Además, R6 quedó en la aceptación.
- Ningún enlace del código usa `?guia=embudo`.

El P-13 no lo trae S3: ya existe. S3 cambia la pestaña por defecto, de Dirección a Resumen, y el resultado es el mismo. Por eso, la condición 4 pide que la prueba falle también hoy.

### P-13 · Diseño (2026-11-07)

**D15 · El recorrido pide su pestaña y el motor la pone.** De las dos salidas de la condición 4:

- **Un `rutaCoincide` que mire la pestaña, solo, no abre nada.** Haría que la guía se niegue fuera de Embudos. Pero el tablero lo monta el servidor solo con `?tab=embudos`, así que alguien tiene que poner la pestaña en la URL.
- **Que `crm/page.tsx` abra Embudos con `?guia=embudo`** toca `page.tsx` y `kommo-tabs.shared.ts`, que la 6.6 edita en S0 y S3 (SDD-0614 §2.1). La guía quedaría metida en el CRM, y tampoco cubriría el botón «Guía», que abre sin `?guia=`.
- **Elegida:** un campo opcional, `GuiaRecorrido.consulta`. `RECORRIDO_EMBUDO` lleva `consulta: { tab: "embudos" }`. `rutaCoincide` sigue mirando solo el camino; `consultaCoincide` mira la consulta, y `urlConConsulta` arma la URL de destino. Todo queda en archivos de la guía: la 6.6 no toca la guía, y la guía no toca la 6.6.

| Situación | Qué hace el motor |
|---|---|
| `?guia=embudo`, el botón o `iniciarGuia("embudo")` en `/studio/crm` sin `?tab=embudos` | `router.replace` a la misma ruta con `tab=embudos`, sin scroll y con los demás parámetros (`?guia=`, `?embudo=`). Cuando la URL ya tiene la pestaña, abre con reintentos de hasta 10 s (`REINTENTOS_TRAS_PESTANA`): el servidor tiene que leer el tablero, que llega detrás de su Suspense |
| Ya en `?tab=embudos` | No navega. Abre como antes, con 2 s de reintentos |
| Arranque automático, apagado por D11 | No cambia la pestaña de nadie. Abre solo si la persona ya está en Embudos, y entrar a la pestaña también cuenta |
| La persona cambia de pestaña mientras la guía espera | La espera se cancela y la guía no la devuelve a Embudos. Solo el primer intento de cada pedido navega; los reintentos no |
| La persona cambia de pestaña con la guía abierta | La guía cierra, igual que al cambiar de ruta |
| Fuera de `/studio/crm` | Nada cambia: ni navega ni abre |

No depende de la pestaña por defecto: Dirección (hoy), Embudos (S0) y Resumen (S3) dan lo mismo. Con Embudos por defecto y sin `?tab=`, el motor hace un `replace` de más, que deja la pestaña escrita en la URL y no cambia lo que se ve. `validarRecorrido` rechaza una consulta vacía, una con un valor vacío y una que fije `guia`.

**Gobernanza:**

- **A11Y-01:** cumplimiento. La tarjeta y su foco no cambian: al abrir, el foco pasa a la tarjeta, como antes. La barra de pestañas la sigue pintando `KommoClient` con la pestaña que resuelve el servidor.
- **MOT-01:** cumplimiento. El `replace` va con `scroll: false` y no hay animación nueva.
- **LOD-01:** no aplica. La carga del tablero sigue siendo la de `CrmEmbudosCargando`, sin cambios.
- **CMP-01:** no aplica. No hay componente nuevo ni reemplazado.
- **Datos personales:** no aplica, como D14. La consulta solo lleva el nombre de la pestaña.

### Allowlist exacta del P-13

- **Motor:** `lib/studio/guia/tipos.ts` (el campo `consulta` y su validación), `lib/studio/guia/recorridos.ts` (la consulta de `RECORRIDO_EMBUDO`, `consultaCoincide` y `urlConConsulta`) y `app/studio/_components/guia/GuiaMotor.tsx`.
- **Pruebas:**
  - `app/studio/_components/guia/GuiaEmbudoPestana.test.tsx` (nueva);
  - `lib/studio/guia/__tests__/guia.test.ts`;
  - una línea `useRouter` en el doble de `next/navigation` de `GuiaMotor.test.tsx`, `GuiaStudio.test.tsx`, `GuiaBoton.test.tsx` y `usePuenteChatwoot.test.tsx`, porque el motor ahora usa el router.
- **Documentos:** esta spec (R6, D11, el párrafo de Embudo en 9.5 y esta sección), `.agents/handoffs/0589-e9-recorridos.md` (la URL de R6 y la de D11) y `.agents/handoffs/0589-p13-embudo-pestana.md` (nuevo).
- **No toca:** nada de `app/studio/(app)/crm/` (`page.tsx`, `kommo-tabs.shared.ts`, `KommoClient.tsx`, el tablero), `app/studio/(app)/layout.tsx`, los textos de `lib/i18n/*/guide.ts`, el checklist del programa, producción, Chatwoot ni `DASHBOARD_SCRIPTS`.

### Aceptación del P-13

| # | Criterio | Evidencia |
|---|---|---|
| P1 | `/studio/crm?guia=embudo` lleva a Embudos y abre en E1 con la pestaña por defecto en Dirección (hoy), Resumen (S3), Embudos (S0) y la que da `resolveKommoTab` en la rama | `GuiaEmbudoPestana.test.tsx`, 4 casos. Rojo sobre `main` con Dirección, Resumen y `resolveKommoTab` |
| P2 | Cambia la pestaña con `replace`, sin scroll, y conserva `?guia=` y los demás parámetros | `GuiaEmbudoPestana.test.tsx` y `guia.test.ts` (`urlConConsulta`) |
| P3 | Después de cambiar de pestaña espera al tablero: 2,7 s en total entre la URL y el tablero, y 6 s de tablero | `GuiaEmbudoPestana.test.tsx`, 2 casos |
| P4 | El botón (`iniciarGuia` con origen `boton`) también lleva a Embudos | `GuiaEmbudoPestana.test.tsx` |
| P5 | Ni el arranque automático ni un reintento cambian la pestaña, y si la persona se va mientras la guía espera, no la devuelve a Embudos | `GuiaEmbudoPestana.test.tsx`, 3 casos |
| P6 | Cambiar de pestaña con la guía abierta la cierra | `GuiaEmbudoPestana.test.tsx` |
| P7 | Ya en `?tab=embudos`, no navega; fuera de `/studio/crm`, ni navega ni abre | `GuiaEmbudoPestana.test.tsx`, 2 casos |
| P8 | La pestaña que pide el recorrido existe en el CRM (`resolveKommoTab("embudos")`), y `consultaCoincide`, `urlConConsulta` y `validarRecorrido` cubren la consulta | `GuiaEmbudoPestana.test.tsx` y `guia.test.ts` |
| P9 | Abrir `/studio/crm?guia=embudo` en la página real | **NO EJECUTADO:** la prueba simula la página, con el tablero montado solo con `tab === "embudos"`, como en `crm/page.tsx` |

### Evidencia del P-13 (2026-11-07)

| Comprobación | Resultado |
|---|---|
| Rojo previo, antes de tocar el código, sobre `main` `ecadbac91`, con la primera versión de la prueba (12 casos) | FALLÓ, como se esperaba: 9 de 12. Con Dirección, Resumen y `resolveKommoTab`, «la guía no abrió». Pasaron los 3 que ya valían en `main`: Embudos por defecto, `?tab=embudos` en la URL y fuera de `/studio/crm` |
| Prueba nueva con el arreglo | PASÓ: 15 de 15 |
| 6 mutantes, de a uno, con turno del Subdirector (18:01Z a 18:03Z), sobre `GuiaEmbudoPestana.test.tsx` y `guia.test.ts` | PASÓ: base sin mutar en verde (47 de 47) y 6 de 6 muertos. M0, los tres archivos fuente como en `origin/main`: caen 14, entre ellos Dirección y Resumen; es el rojo de la versión final de la prueba. M1, sin `consulta`: caen 12. M2, un reintento que navega; M3, el arranque automático que navega; M4, los 2 s de siempre tras cambiar de pestaña; M5, sin cierre al cambiar de pestaña: cae 1 cada uno, el de su caso. Cada archivo vuelve a su huella y `git diff --stat` queda idéntico |
| Pruebas de la guía: `lib/studio/guia`, `app/studio/_components/guia` y `guia-panel.test.ts`, con `--pool=threads --maxWorkers=1` | PASÓ: 164 de 164 en 10 archivos (reporte JSON de Vitest), 18 nuevas |
| `tsc --noEmit` del proyecto | PASÓ, en el segundo intento. El primero dio TS2493 en la prueba nueva, que leía el segundo argumento de un doble declarado con uno. Se corrigió con `toHaveBeenLastCalledWith` y la prueba volvió a pasar 15 de 15 |
| ESLint de los 9 archivos `.ts`/`.tsx` tocados, con `--max-warnings=0` | PASÓ |
| `node scripts/check-numbering.mjs`, `node scripts/build-docs-index.mjs --check` y `git diff --check` | PASÓ |
| `/ui-check` | OK para commit. Un hallazgo bajo: entre el `replace` y la tarjeta, la guía no da una señal propia; se ve la carga del tablero. Queda para la prueba en vivo de la 9.6 |
| Ningún archivo de `app/studio/(app)/crm/` en el diff | PASÓ: `git diff --name-only origin/main -- "app/studio/(app)/crm"` sale vacío |
| `GuiaEmbudoPestana.test.tsx` con el `kommo-tabs.shared.ts` de S0 de la SDD-0614 (`88d479ca2`, local de E6: Embudos por defecto y las pestañas de Kommo ocultas), puesto en su lugar y restaurado después con su huella | PASÓ: 15 de 15. Los casos de Dirección y Resumen simulan la pestaña por defecto y no leen la real. El que usa `resolveKommoTab` no depende de cuál sea |
| Merge de `origin/main` `7e75f7708` con el driver de `main`, y el índice regenerado con `docs:index` | PASÓ: sin conflictos y sin cambios del índice tras regenerar (596 specs). `docs:check`, `check-numbering` y `git diff --check`, en verde. El merge no trae dependencias ni configuración de pruebas |
| `pnpm verify` | **NO EJECUTADO:** lo corre el Director General en su turno |

**Qué cambió mientras se hacía.** La primera corrida verde de la guía dio 141 de 142. El rojo era de la prueba: un solo `act` largo no deja que React pinte entre timers. Al corregirla, avanzando el reloj de a 50 ms, aparecieron dos riesgos del diseño, que se arreglaron con su prueba:

- 2 s no alcanzan después de cambiar de pestaña, porque el servidor todavía lee el tablero. De ahí los 10 s de `REINTENTOS_TRAS_PESTANA`.
- Un reintento podía devolver a Embudos a quien ya se había ido. Desde el arreglo, solo navega el primer intento de cada pedido.

También salió del arranque automático una comprobación de la consulta que repetía la de `intentarAbrir`: un mutante sobre ella habría sobrevivido sin cambiar nada visible.

### 2026-11-07 · Seguimiento del P-13: pedidos que quedan vivos (B1 y B2)

**Fuente.** El Director General revisó la #416 (`a0b4457a4`) por su cuenta, la aprobó y dejó dos observaciones BAJAS que no bloquean. El Subdirector de Chatwoot las encargó en una PR aparte, después de que se fusione la #416. La rama es `claude/0589-p13-seguimiento` y sale de `a0b4457a4`.

| # | Hallazgo | Arreglo |
|---|---|---|
| B1 | `GuiaMotor.tsx:345`: si la persona cambia de pestaña antes de que termine el `router.replace`, el pedido queda pendiente y la guía se abre sola minutos después, cuando la persona entra a Embudos | El pedido guarda la URL del momento en que se hizo (`consultaDelPedido`). Mientras la URL siga igual, el cambio de pestaña sigue en camino. Si cambia a otra URL sin la pestaña pedida, el pedido se olvida |
| B2 | `:347` y `:385`: pulsar «Guía» dos veces durante la espera deja dos series de reintentos, y la segunda puede devolver la tarjeta al primer paso. `cerrarGuia` tampoco cancelaba la espera que deja un cambio de pestaña | Una sola espera a la vez (`esperaRef`): la nueva cancela la anterior, y `cerrarGuia` también la cancela. Además, el arranque automático no reemplaza un pedido de la persona que sigue en curso. Sin esa guarda, el arreglo mismo le quitaría la espera de 10 s al botón cuando la 9.6 encienda el arranque automático |

### Allowlist exacta del seguimiento

- **Motor:** `app/studio/_components/guia/GuiaMotor.tsx`.
- **Pruebas:** `app/studio/_components/guia/GuiaEmbudoPestana.test.tsx`. El doble de `next/navigation` agrega `persona(query)`: como en Next, la navegación de la persona cancela el `replace` que el motor tenga en curso.
- **Documentos:** esta spec y `.agents/handoffs/0589-p13-seguimiento.md` (nuevo).
- **No toca:** `lib/studio/guia/` ni nada de `app/studio/(app)/crm/`, `app/studio/(app)/layout.tsx`, los textos de la guía, producción, Chatwoot ni `DASHBOARD_SCRIPTS`.

### Aceptación del seguimiento

| # | Criterio | Evidencia |
|---|---|---|
| S1 | B1: con el pedido por `?guia=` y por el botón, si la persona pasa a otra pestaña antes de que termine el cambio, la guía no se abre sola cuando vuelve a Embudos minutos después | `GuiaEmbudoPestana.test.tsx`, 2 casos, con rojo previo sobre `a0b4457a4` |
| S2 | B2: pedir la guía otra vez durante la espera, con el botón o desde el código, no reabre la tarjeta: sigue en el paso 2 después de 12 s y sin «Ver la guía desde el principio» | `GuiaEmbudoPestana.test.tsx`, 2 casos, con rojo previo |
| S3 | B2: `cerrarGuia()` durante la espera la cancela, y la guía no abre cuando llega el tablero | `GuiaEmbudoPestana.test.tsx`, con rojo previo |
| S4 | Con el arranque automático encendido, su efecto no reemplaza la espera del botón: un tablero de 4 s abre igual, y la tarjeta es la del botón, sin «No volver a mostrar» | `GuiaEmbudoPestana.test.tsx`. Sobre `a0b4457a4` pasaba: protege el arreglo de B2, y lo mata el mutante que quita la guarda |
| S5 | Lo del P-13 sigue igual | Los 15 casos de la #416 y la suite de la guía |

### Evidencia del seguimiento (2026-11-07)

Con el turno de máquina que dio el Subdirector y la regla nueva de dos corridas medianas a la vez como máximo.

| Comprobación | Resultado |
|---|---|
| Rojo previo: las pruebas nuevas contra el `GuiaMotor.tsx` de `a0b4457a4`, la cabeza de la #416 (mutante M0) | FALLÓ, como se esperaba: 5 de 21. Caen B1 por URL, B1 por botón, B2 con el botón, B2 desde el código y B2 con `cerrarGuia` |
| Las mismas pruebas con el arreglo | PASÓ: 21 de 21 |
| 5 mutantes, de a uno, con base verde | PASÓ: 5 de 5 muertos. M0 tumba 5. MB1, sin olvidar el pedido, tumba los 2 de B1. MB2a, sin cancelar la espera anterior, tumba los 2 de la doble pedida. MB2b, con `cerrarGuia` sin cancelar, tumba 1. MB2c, sin la guarda del arranque automático, tumba 1 (S4). Todo restaurado, con `git diff --stat` igual |
| Suite de la guía: `lib/studio/guia`, `app/studio/_components/guia` y `guia-panel.test.ts`, con 1 worker | PASÓ: 170 de 170 en 10 archivos |
| `tsc --noEmit` | PASÓ |
| ESLint de `GuiaMotor.tsx` y `GuiaEmbudoPestana.test.tsx`, con `--max-warnings=0` | PASÓ |
| `check-numbering`, `build-docs-index --check` y `git diff --check` | PASÓ |
| `pnpm verify` y la página real | NO EJECUTADO. El portón es el CI «Calidad continua» de la PR |

**Qué cambió mientras se hacía.** La primera versión de la prueba de la doble pulsación quedó viva frente a M0 y MB2a: pasaba sin el arreglo. Con el botón, la segunda apertura retoma el paso guardado y la tarjeta sigue en «2 de 4». El daño estaba, pero se veía de otra forma: el foco vuelve a la tarjeta y aparece «Ver la guía desde el principio». La prueba quedó parametrizada con el botón y desde el código (`programa`, que sí vuelve a «1 de 4»), y además exige que no aparezca «Ver la guía desde el principio».

### 2026-11-07 · Revisión de la #418: pedir la guía otra vez acortaba la espera

**Fuente.** Revisión independiente de la #418 sobre `ee22c804a`: CHANGES_REQUESTED. B1 y B2 quedaron cerrados, pero el arreglo de B2 trajo una regresión. Al pedir la guía otra vez mientras Embudos carga, el evento llama a `abrirCuandoHaya` con los 8 reintentos por defecto (unos 2 s). Esa llamada cancela la espera viva de 40 reintentos (unos 10 s). El revisor lo midió con una prueba temporal, con tableros de 3 s y 5 s y dos pulsaciones: la #418 no abría ninguno, y el motor de `a0b4457a4` sí.

**Arreglo:**

- La espera guarda cuántos intentos le quedan (`restantes`). Una espera nueva del mismo recorrido se queda con esos intentos, si son más que los suyos: pedir la guía otra vez no acorta la espera.
- Además se arregló lo menor que señaló la revisión: con dos pulsaciones rápidas, antes de que cambie la pestaña, el motor pedía dos veces el `router.replace`. Ahora, si el mismo cambio de pestaña ya va en camino, el pedido nuevo solo reemplaza las opciones del anterior. El evento conserva el pedido en camino del mismo recorrido y olvida el de otro.
- Con la herencia de intentos, el mutante que quita la guarda del arranque automático (MB2c) quedó vivo: el arranque automático heredaba los 10 s y la tarjeta abría igual. El daño se ve en que la abre como arranque automático, con «No volver a mostrar» y la guía anotada como vista. Por eso, S4 ahora exige que la tarjeta sea la del botón.

**Allowlist:** la misma del seguimiento, `GuiaMotor.tsx` y `GuiaEmbudoPestana.test.tsx`, más esta spec y el handoff. Con esta subida va también el merge de `origin/main` `250e86f65`, que ya trae la #416 y la #415 (S0).

| # | Criterio | Evidencia |
|---|---|---|
| S6 | Pedir la guía otra vez mientras carga un tablero de 4 s o de 6 s no acorta la espera: la tarjeta abre en E1 | `GuiaEmbudoPestana.test.tsx`, 2 casos, rojos contra `ee22c804a` |
| S7 | Dos pulsaciones seguidas, antes de que cambie la pestaña, piden el cambio una sola vez y la guía abre | `GuiaEmbudoPestana.test.tsx`, rojo contra `ee22c804a` |

| Comprobación | Resultado |
|---|---|
| Rojo de la revisión: las pruebas contra el `GuiaMotor.tsx` de `ee22c804a` (M0r) | FALLÓ, como se esperaba: 3 de 24. Caen los dos tableros lentos y las dos pulsaciones seguidas |
| Con el arreglo | PASÓ: 24 de 24 |
| 8 mutantes, de a uno, con base verde | PASÓ: 8 de 8 muertos. M0r tumba 3. MH, la segunda pulsación con los 8 reintentos por defecto, tumba los 2 de tablero lento. MD, que pide otra vez el cambio en camino, y MD2, en el que el evento lo olvida, tumban 1 cada uno. MB1 tumba 2, MB2a tumba 2, MB2b tumba 1 y MB2c, sin la guarda, tumba 1 desde que S4 exige la tarjeta del botón. En la primera tanda MB2c quedó vivo. Todo restaurado |
| ESLint de los 2 archivos, con `--max-warnings=0` | PASÓ |
| Merge de `origin/main` `250e86f65` con el driver de `main`, y el índice regenerado | PASÓ: sin conflictos y sin cambios del índice tras regenerar (596 specs) |
| Suite de la guía sobre el árbol fusionado, más `crm/__tests__/guia-se-queda.test.ts` de la S0, con 1 worker | PASÓ: 182 de 182 en 11 archivos |
| `tsc --noEmit` sobre el árbol fusionado | PASÓ |
| `check-numbering`, `build-docs-index --check` y `git diff --check` | PASÓ |
| `pnpm verify` y la página real | NO EJECUTADO. El portón es el CI «Calidad continua» |
