---
sdd: "0589"
title: "Motor de guía propio y liviano en Studio (E9 del programa SDD-0582, paso 9.2)"
status: in-progress
author: "Claude Worker «E9 motor» (Sam)"
created: 2026-10-30
updated: 2026-11-06
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

**Encargo y puertas.** El Director General pidió la 9.3 entera, en local y en una PR en borrador, bajo esta SDD (2026-11-06). **No hay OK de Sam al diseño de la migración:** está en su lista, y la fila 9.3 no cuenta como OK. Fusionar la PR y aplicar la 0517, en prueba o en producción, también esperan su OK.

**Número.** La 0517 la asignó el Director General, medida libre a las 03:50Z: la 0514 y la 0515 son de SDD-0606 y la 0516 de otra rama. Quedó reservada sin tocar `main`, con la rama `codex/migration-reserve-0517-user-guide-prefs` (`be6e0f949`), que nunca se fusiona.

**Decisiones pendientes de Sam, con valor provisional.** Están en `lib/studio/guia/preferencias.ts`: cambiarlas es cambiar una constante.

| Pregunta | Valor provisional (propuesta del guion) | Constante |
|---|---|---|
| S-6: ¿arranca en cada pantalla la primera vez, o una sola vez? | Por pantalla | `ARRANQUE_AUTOMATICO` |
| S-7: ¿«Guía» como nombre, en la barra superior? | «Guía», en la barra superior | `CLAVE_NOMBRE_BOTON`; el lugar es donde se monte `<GuiaBoton />` |

**El botón está hecho y probado, pero no montado.** `StudioTopbar.tsx` lo tocan tres ramas del rediseño (SDD-0603). Montarlo es una línea, `<GuiaBoton />`, cuando lo permita esa adopción. Hasta entonces, la guía se abre sola la primera vez, por `?guia=` o desde el código.

**⚠️ Aplicar la 0517 enciende el arranque automático.** Hoy el único recorrido es el de demostración del Dashboard. Cada persona de Studio lo verá abrirse solo la primera vez que entre al Dashboard después de aplicar la migración. Sin la 0517 no cambia nada: la guía no arranca sola. Sam tiene que saberlo antes de dar el OK para aplicarla.

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
| Espera de la 0517 y su degradación | `supabase/migrations-baseline.json` y `supabase/pending-migration-symbol-declarations.json` |
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
| Candado de migraciones, numeración e índice | PASÓ; la 0517, en espera sin sellar |
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
