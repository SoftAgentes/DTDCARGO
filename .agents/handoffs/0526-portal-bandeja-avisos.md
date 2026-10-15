# Handoff · SDD-0526 · Portal: bandeja de avisos del cliente

| Campo | Valor |
|---|---|
| Fecha | 2026-10-15 (UTC 05:53 a 07:10 aprox.; Caracas 01:53 a 03:10) |
| Task ID / owner | `portal-bandeja-avisos` / subagente Worker del Director |
| Claim del harness | `worker-sdd-0526-portal-bandeja-avisos` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\portal-bandeja-avisos` |
| Rama | `codex/portal-bandeja-avisos` |
| Base | `origin/main` `a8d99acf` |
| SDD | [0526](../../docs/specs/0526-portal-bandeja-avisos/spec.md), `in-progress` |
| Migración | `0479_portal_bandeja_avisos` (la asignó el Director; 0476, 0477 y 0478 son de otras tareas) |
| Estado de la tarea | lista para revisión (PR en borrador, MIGRATE-FIRST) |
| Permisos | commits locales selectivos, push de la rama propia y PR en borrador contra main. Sin merge (congelados hasta el corte de esta noche), sin producción, sin aplicar nada a ninguna base real, sin `pnpm verify` completo (turno del Worker de la 0522). |

## Numeración

- La reserva pedida era la 0525, pero otra sesión la tomó 47 s antes para
  «modelos-anthropic-vacios» (`codex/sdd-reserve-0525-modelos-anthropic-vacios`,
  `9edbfd15`). Paré, lo reporté y el Director confirmó la **0526**.
- Reserva local `codex/sdd-reserve-0526-portal-bandeja-avisos` (`6b7df86f`),
  incorporada a la rama por fast-forward. No se publicó la ref de reserva.
- El primer worktree (`.claude/worktrees/agent-a6ca578525011c996`) desapareció
  entre turnos sin cambios; la rama seguía intacta y se recreó el worktree en
  `DTD-worktrees/portal-bandeja-avisos` sobre ella.

## OBJETIVO ORIGINAL

El cliente ve dentro del Portal los avisos que el sistema ya le envió sobre su
mercancía, sin depender del correo ni del push. Sam, literal: «al correo y la
notificación push a su portal, que le avisen en su portal el estatus de la
mercancía» · «sí, prepara la bandeja de avisos en el Portal».

## COMPLETADO

- **Migración 0479** (`supabase/migrations/0479_portal_bandeja_avisos.sql`), con
  cabecera «⚠️ NO APLICADA A PRODUCCIÓN.», preflight y postflight:
  - `portal_notification_seen`: una fila por vínculo del Portal con
    `last_seen_at`; RLS sin policies ni privilegios de API.
  - Trigger `client_users_forget_portal_notification_seen`: borra el visto cuando
    el vínculo cambia de estado o de persona.
  - Índice parcial `client_notif_sched_portal_inbox_idx` (status = 'sent').
  - RPC `portal_list_my_notifications(p_prealerta_id, p_limit)`: sólo `sent` con
    fecha; vínculo, tenant y Shipping Mark derivados de `auth.uid()` (frontera
    0453); ancla viva del mismo tenant y Shipping Mark; respeta «Visible en el
    portal» con la precedencia de 0402; 1 a 50 filas, 20 por defecto.
  - RPC `portal_mark_my_notifications_seen(p_hasta)`: recorta a `now()`, nunca
    retrocede, `for share` del vínculo; sin vínculo activo, 42501.
- **Espera** en `supabase/migrations-baseline.json` y **degradación declarada**
  en `supabase/pending-migration-symbol-declarations.json`.
- **Campana** (`app/portal/_components/PortalAvisosBell.tsx`): panel en
  escritorio y hoja en el teléfono, como el Norte; contador = avisos sin leer +
  respuesta del asesor, en vino; «Nuevo» en los no leídos; marca vistos hasta el
  más nuevo mostrado y baja el contador sólo cuando la base confirma; vacío sin
  promesas; Escape y × devuelven el foco.
- **Lecturas** en `lib/portal/portal-avisos-queries.ts` (sesión del cliente, sin
  cliente admin) y reglas puras en `lib/portal/portal-avisos.ts` (sin imports de
  `@/lib/studio`).
- **Detalle de compra**: historial «Avisos que te enviamos» de esa compra, al
  final, como el envío.

Criterios de aceptación de la spec: 1 a 9 con prueba automática. El 3 y el 8,
contra PGlite; NO VERIFICADOS contra producción hasta aplicar.

## Decisión de diseño: panel y no página

El Norte del Portal pone la campana como panel bajo la topbar en escritorio
(`_norte/portal/app.jsx` · `PortalTopbar`) y como hoja «Avisos» en el teléfono
(`_norte/portal/mobile-extra.jsx` · `NotifSheet`). El cliente consulta sin perder
la pantalla en la que está y no se agrega una ruta. Detalle en la spec.

## VALIDACIÓN

SHA observado: el árbol de trabajo sobre `6b7df86f` (antes de commitear); los
comandos se repitieron sin cambios de código después del último ajuste.

| Comprobación | Resultado |
|---|---|
| `vitest run` de `portal-bandeja-avisos.migration.test.ts`, `portal-avisos.test.ts`, `PortalAvisosBell.test.tsx`, `compras/[code]/page.test.tsx` | PASÓ · 87/87 (48 + 21 + 9 + 9) |
| Contrato SQL 0479 en PGlite | PASÓ · `TEST 0479 GREEN: 61 aserciones` |
| Control rojo (sin 0479) | PASÓ · falla con «la RPC de la bandeja no existe» |
| Mutantes de la migración (PGlite) | PASÓ · 39/39 muertos, cada uno en su aserción |
| Mutante `for share of cu` | SOBREVIVE (declarado): PGlite tiene una conexión |
| Mutantes manuales TypeScript | PASÓ · 21/21 muertos; control verde antes y después (9 + 21 + 9) |
| Vecinas: `PortalShell.test`, `PortalTrackingEnConstruccion.test`, `(app)/page.test` | PASÓ (dentro de una corrida de 100/100 con las propias) |
| Vecinas del gate y migraciones: `check-pending-migration-symbols.test.mjs`, migraciones 0472-0475 | PASÓ · 149/149 |
| `node --test` de `pending-migration-symbols-*` y `verify-critical-coverage` | PASÓ · 22/22 |
| `spec-migration-refs`, `invoice-read-boundary`, `portal-invoices-tenant-boundary`, `external-effect-boundaries-contract`, `fuentes-locales` | PASÓ · 43/43 |
| `pnpm typecheck` | PASÓ |
| ESLint de los archivos tocados | PASÓ · 0 errores, 0 avisos |
| `check-rsc-boundary` | PASÓ |
| `check-feature-constants` | PASÓ |
| `docs:check` (índice regenerado con `node scripts/build-docs-index.mjs`) | PASÓ · 508 specs |
| `sdd:check` (`check-numbering`) | PASÓ |
| `components:check` | PASÓ |
| `governance:check` | PASÓ |
| `check-pending-migration-symbols` | PASÓ · 0 ROJO · 1 AMARILLO declarado (sin la declaración: ROJO con las dos RPC) |
| `git diff --check` | PASÓ |
| `/ui-check` (móvil y escritorio, claro y oscuro) | PASÓ con hallazgos menores (abajo) |
| `pnpm verify` completo | NO EJECUTADO: el turno de corrida pesada es del Worker de la 0522 (instrucción del Director). La evidencia de la suite es el CI de la PR. |
| `sql-tests` y `schema-rebuild` en Docker | NO EJECUTADO: corrida pesada (Docker), turno del Director. El contrato corre en PGlite. |
| `migrations-applied` | NO EJECUTADO: el worktree no tiene credenciales; la 0479 está declarada como espera. |

### /ui-check · topbar real en un arnés

El arnés (fuera del repo, en el scratchpad) monta `PortalTopbar` real con la
campana, datos ficticios y la server action simulada, con el CSS compilado de
`app/globals.css`. Capturas en `docs/specs/0526-portal-bandeja-avisos/assets/`.

```
🎨 UI-CHECK · campana y bandeja de avisos del Portal
Hallazgos (4):
1 ⭐ [media] PortalAvisosBell.tsx (botón de la campana) — 36×36 en el teléfono,
   bajo el estándar interno de 44×44. Es la medida de toda la topbar (menú,
   calculadora, tema); cambiarla sola desalinea la fila. Queda en FUERA DE ALCANCE.
2  [baja] arnés — las fuentes del Portal (Sora, Nunito Sans, JetBrains Mono) no
   se cargan en el arnés; el código del ancla se ve en la sans del sistema.
   En la app sí carga (`jetbrainsMonoUi` en el layout).
3  [baja] PortalNotificationHistory.tsx — la fecha del historial no fija la zona
   horaria (preexistente). FUERA DE ALCANCE.
4  [baja] el velo de la hoja pasó a navy en los dos temas (como el Norte); el
   del cajón del menú sigue con `--color-ink`, que en oscuro aclara.
✅ Lo que está bien: sólo tokens (`--color-*`, `--hero-from`, `--portal-info`);
   contraste medido en el navegador: claro 16,49 / 12,63 / 10,58 / 10,58 (título,
   texto, «Nuevo», contador); oscuro 13,08 / 7,33 / 6,44 / 4,96; estados vacío,
   sin leer, marcando y confirmado; foco devuelto; avisos de 61-121 px y × de
   44×44 en la hoja; sin desborde a 375 px; tuteo, sin voseo.
Veredicto: OK para commit.
```

## COMMITS

- `6b7df86f` — reserva de la SDD-0526 (stub), incorporada por fast-forward.
- `585b207e` — `feat(db)`: migración 0479, contrato SQL, prueba PGlite, espera,
  declaración del gate y lecturas en `lib/portal`.
- `3484d1e0` — `feat(portal)`: campana con la bandeja, layout, shell, topbar e
  historial de la compra, con sus pruebas.
- Commit que contiene este documento — `docs(sdd)`: spec, índice, capturas y
  handoff.

## PR / BRANCH

- Rama `codex/portal-bandeja-avisos` → `main`, PR en **borrador** (MIGRATE-FIRST).
  La URL queda en el mensaje de cierre al Director.

## PENDIENTES DE ESTA TAREA

1. **Aplicar 0479** con OK nominal de Sam y el runbook, de a una, con name
   exacto `0479_portal_bandeja_avisos`, **antes** de desplegar; no en la ventana
   del corte de esta noche. Antes, leer en producción (READ ONLY, sin filas) lo
   que exige el preflight: RLS sin FORCE y dueño postgres (o BYPASSRLS) en
   `client_users`, `clients`, `client_notification_schedule`,
   `client_notification_rules`, `shipments` y `prealertas`; el CHECK
   `client_notif_sched_una_ancla` validado; ninguna policy de la API sobre la
   cola; ningún objeto de 0479 ya creado.
2. Tras aplicar: sacar la espera del baseline y la declaración del gate, y fijar
   en la prueba la identidad del archivo (md5 y bytes) contra el ledger, como
   hizo la 0475.
3. CI de la PR (incluye la suite completa) y, si el Director lo programa,
   `sql-tests` y `schema-rebuild` en Docker.
4. Smoke de Sam (abajo) después del despliegue.
5. Al cerrar: Graphify y Archify desde main integrado (en este worktree nuevo
   `knowledge:status` da structural INVALID, semantic pendiente y Archify sin
   runtime; no se construyeron aquí por ser corrida pesada).

## Smoke para Sam (después de aplicar 0479 y desplegar)

Con un cliente de prueba que ya tenga avisos enviados por correo o push:

1. Entra al Portal. La campana muestra un número en vino: los avisos que todavía
   no viste (más 1 si tu asesor te respondió). Si dice «9+», son más de nueve.
2. Toca la campana. En la computadora se abre un panel; en el teléfono, una hoja
   desde abajo. Cada aviso trae título, texto, «Compra» o «Envío» con su código y
   la fecha en hora de Venezuela. Los nuevos dicen «Nuevo».
   **Falla si:** aparece un aviso que no te llegó por correo o push, uno de otro
   cliente, o uno de un envío eliminado.
3. Cierra y vuelve a abrir: el número ya no está (queda 1 sólo si hay respuesta
   del asesor sin leer) y ningún aviso dice «Nuevo». Recarga la página: sigue
   igual. Ábrelo en otro dispositivo con la misma cuenta: también.
4. Toca un aviso: abre la compra o el envío de ese aviso.
5. Abre una compra que tenga el aviso «Tu carga llegó a nuestra bodega en
   China»: al final aparece «Avisos que te enviamos · El historial de
   notificaciones de esta compra.».
6. Entra con otra cuenta de cliente: no ve ninguno de esos avisos.
7. En el Studio (Administración › Notificaciones) apaga «Visible en el portal»
   de un evento que ya se le envió al cliente de prueba: ese aviso desaparece
   de su bandeja; el correo ya enviado no cambia.

Total esperado en el paso 2: tantos avisos como correos o push enviados a ese
cliente (hasta 20 en la campana), del más nuevo al más viejo.

## FUERA DE ALCANCE DETECTADO

1. **El historial del envío no respeta «Visible en el portal».**
   `app/portal/(app)/envios/[code]/page.tsx` usa `listShipmentNotificationHistory`
   (`lib/studio/notifications/notification-history-queries.ts`) con el cliente
   admin: un aviso oculto en la bandeja sí aparece en el detalle del envío.
   Pasarlo a la RPC pediría un filtro por envío en la base (otra migración).
2. **Fecha del historial sin zona horaria.** `PortalNotificationHistory`
   (`formatSentAt`) usa `toLocaleDateString` sin `timeZone`; en el servidor
   propio sale en la hora del servidor. La bandeja ya fija `America/Caracas`.
3. **Botones de la topbar de 36×36** en el teléfono (A11Y-01 pide 44×44 en
   superficies táctiles): menú, calculadora, campana y tema.
4. **El punto del asesor en la barra lateral** (`PortalSidebar`) sigue en
   `--color-status-danger`; una respuesta no es un error (BRAND, 2026-09-05).
5. **El velo del cajón del menú** (`PortalSidebar`) usa `--color-ink`, que en
   oscuro es crema y aclara el fondo; la hoja de avisos ya usa navy.
6. **Avisos de compras eliminadas** se siguen despachando (ya anotado por la
   SDD-0511); la bandeja ya no los muestra.
7. **Prueba de carrera revocar ↔ marcar** con dos conexiones (dblink, patrón
   0459) no existe; sólo correría en Docker.
8. **Avisos `skipped` por falta de destino** (cliente sin correo ni push) no
   entran a la bandeja, como pide el encargo. Si el Portal debe ser un canal por
   sí mismo, es una decisión de la SDD-0524 o de una nueva.

## Impacto documental

- Canónicos actualizados: la spec 0526 y el índice `docs/specs/README.md`.
- No cambian reglas estables (AGENTS, project-rules, BRAND).
- Graphify y Archify: NO EJECUTADOS en este worktree (ver Pendientes 5).
- Obsidian: sin cambios.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR en borrador; programar el CI y, si
  corresponde, `sql-tests`/`schema-rebuild` en Docker; pedirle a Sam el OK
  nominal de la 0479 fuera de la ventana del corte; aplicar, desplegar enseguida
  y hacer el smoke.
- **Cambios compartidos:** `supabase/migrations-baseline.json` y
  `supabase/pending-migration-symbol-declarations.json` (las 0522-0524 también
  pueden tocarlos: el conflicto es de unión) y `docs/specs/README.md` (driver del
  índice).
- **No toca** nada de la SDD-0524 (`lib/studio/notifications/*`, acciones de
  recepción).
- **Ownership:** el claim se libera al terminar esta sesión.
