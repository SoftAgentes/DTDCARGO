# Handoff · Cierre de migraciones del 2026-11-08: la 0518, la 0521, la 0522, la 0523 y la 0524

- **Owner:** Claude Worker «10.5», en la sesión que inició el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`). El DG y el Subdirector decidieron el alcance.
- **Claim:** `worker-10.5-cierre`.
- **Ruta y rama:** `DTD-worktrees/0586-cierre-0518-0521`, rama `codex/0586-cierre-0518-0521`, PR #463. Se trajo main dos veces: `88a87b181` (tren 4) y `e4e3b1173` (tren 5).
- **Runbook:** [aplicar-migraciones-prod](../../docs/runbooks/aplicar-migraciones-prod.md), §6. Este handoff es el registro del paso 3.

## Qué se cierra

- **Sellada en esta PR:** la 0518, la 0521, la 0522 y la 0523, con `infra/ops/migraciones/retirar-espera.mjs <nombre> --md5 <md5>`. El script saca la espera del baseline y sus declaraciones de símbolos, y la sella en `supabase/migrations.lock.json` con `ledger` exacta.
- **Las pruebas que afirmaban la espera:** se buscaron por valor en todo el repo, y pasaron a fijar «aplicada y sellada con su md5». Son cuatro:
  - `lib/news/autopublicar/__tests__/noticias-0518.migration.test.ts`, de SEO;
  - `lib/studio/__tests__/chatwoot-portal-estado.migration.test.ts`;
  - `lib/studio/__tests__/chatwoot-bot.migration.test.ts`, de E7;
  - `lib/studio/__tests__/chatwoot-portal-carga.migration.test.ts`.
- **La 0524, sellada en su cierre chico** (PR propia desde `33c286e01`, después del tren 6, decisión del DG del 2026-11-08): `retirar-espera` con su md5 y su envoltorio, `chatwoot-portal-puerta4.migration.test.ts`, pasado a «aplicada y sellada». En la #463 había quedado registrada sin sellar, porque su archivo y su espera vivían en la #462. Es el mismo patrón de la 0523, que entró en el #460 y se cerró en la #463.
- **Las cabeceras «NO APLICADA A PRODUCCIÓN» no se tocan:** el ledger guarda el texto exacto.

## Registro (§6, paso 3)

**De dónde salen los datos:**
- **La `version`, la hora del COMMIT, las filas y la evidencia** las sacó el DG de sus evidencias en el VPS (`/srv/ops/evidencias/<carpeta>`: `aplicar.out`, `verificar.out` y `registro.txt`), sin consultar producción. «Filas» es el total de filas del ledger después del COMMIT.
- **El md5 y los bytes** se comprobaron contra el archivo de la rama antes de retirar cada espera.
- **La hora del merge** sale de GitHub.

| Migración | SDD | md5 · bytes | Entorno | `version` | COMMIT (UTC) | Filas | Evidencia |
|---|---|---|---|---|---|---|---|
| `0518_noticias_publicacion_automatica` | 0611 | `c692dfa9c4ad31e3352721400c3e3ceb` · 44672 | prueba | `20261108143112` | 2026-11-08T14:31:12.259Z | 507 | `apply-0518-dtd-cargo-staging-20261108T143111Z` |
| | | | producción | `20261108143204` | 2026-11-08T14:32:04.484Z | 519 | `apply-0518-dtd-cargo-20261108T143201Z` |
| `0521_chatwoot_portal_estado` | 0586 | `9613db9ca81059c4f6b308a0d84cb6e5` · 18458 | prueba | `20261108150101` | 2026-11-08T15:01:02.044Z | 508 | `apply-0521-dtd-cargo-staging-20261108T150059Z` |
| | | | producción | `20261108150154` | 2026-11-08T15:01:54.460Z | 520 | `apply-0521-dtd-cargo-20261108T150153Z` |
| `0523_chatwoot_portal_carga` | 0586 | `83b016e0ac8aa2fe24172ae07642a60c` · 23960 | prueba | `20261108163933` | 2026-11-08T16:39:33.095Z | 509 | `apply-0523-dtd-cargo-staging-20261108T163932Z` |
| | | | producción | `20261108164015` | 2026-11-08T16:40:15.902Z | 521 | `apply-0523-dtd-cargo-20261108T164015Z` |
| `0522_chatwoot_bot` | 0618 | `042eacc23862df84138ddbbd7f02503a` · 35074 | prueba | `20261108195845` | 2026-11-08T19:58:45.620Z | 510 | `apply-0522-dtd-cargo-staging-20261108T195844Z` |
| | | | producción | `20261108195920` | 2026-11-08T19:59:20.678Z | 522 | `apply-0522-dtd-cargo-20261108T195919Z` |
| `0524_chatwoot_portal_puerta4` | 0586 | `8891e2a4cda6197eec57653ec178d40a` · 22764 | prueba | `20261108202540` | 2026-11-08T20:25:41.033Z | 511 | `apply-0524-dtd-cargo-staging-20261108T202540Z` |
| | | | producción | `20261108202610` | 2026-11-08T20:26:10.148Z | 523 | `apply-0524-dtd-cargo-20261108T202609Z` |

**Lo que salió de dónde:**
- **Las cinco** se aplicaron desde la cabeza de su PR: la 0518 desde la #417, la 0521 desde la #453, la 0522 desde la #459 en `af2cd684d`, la 0523 desde la #456 en `a8cbfc780` y la 0524 desde la #462 en `0daf79264`.
- **La `version`** la calcula el servidor dentro de la transacción (runbook §7). En la 0521 y la 0524, en prueba, quedó un segundo antes del COMMIT.

**Los OK literales de Sam, en el chat del DG:**
- **La 0518, a las ~04:15Z.** El selector «¿para qué es el OK?» tenía las opciones «Encender el portal», «Publicar la web», «Aplicar la 0518» y «Solo enterado». Sam escribió en texto libre: «Tú decides cuál va primero. O decide si las tres van al mismo tiempo o cuál va primero, o aplica las tres.»
- **La 0521 (~15:00Z), la 0523 (~16:20Z), la 0522 (~18:15Z) y la 0524 (~20:20Z).** A «¿Autorizas aplicar la 05NN, primero en prueba.dtdcargo.com y luego en producción?», Sam respondió «Sí, prueba y producción».

**Los merges a main (GitHub):**
- **La 0518 y la 0521:** la #417 y la #453 en el tren #457, `9019d3997`, a las 2026-11-08T16:37:59Z. Las dos PR figuran como merged a las 16:38:01Z.
- **La 0523:** la #456 en el tren #460, `88a87b181`, a las 2026-11-08T17:35:12Z. La PR figura a las 17:35:14Z.
- **La 0522:** la #459 en el tren #465, `e4e3b1173`, a las 2026-11-08T20:48:02Z. La PR figura a las 20:48:04Z.
- **La 0524:** la #462 en el tren #466, `33c286e01`, a las 2026-11-08T21:44:40Z. La PR figura a las 21:44:42Z.

## Punteros en las SDD

- **En la 0586** (la 0521, la 0523 y la 0524): está la sección «2026-11-08 · La 0521, la 0523 y la 0524 aplicadas», que apunta aquí.
- **Excepción, con motivo, para la 0518 y la 0522:** el puntero en su SDD está pendiente y lo pone su dueño.
  - **La 0611 (la 0518)** es del Subdirector de SEO. El DG le avisa.
  - **La 0618 (la 0522)** la va a tocar la PR E2 de E7. El Subdirector de Chatwoot le avisa.

## Validación

| Comprobación | Estado |
|---|---|
| Antes de cada `retirar-espera`: el md5 y los bytes del archivo contra el ledger, y en la 0518 también el blob (`30c81cde…`) | PASÓ |
| Después del merge de `e4e3b1173`: el baseline, el candado y las declaraciones, clave por clave contra los dos padres | PASÓ: no revivió ninguna espera sellada, no se perdió ninguna declaración, y lo que vino de main quedó idéntico |
| `migrations-lock verificar` y el gate, antes y después del commit de la 0522 | PASÓ. El gate dio 0 rojos y 0 amarillos |
| `docs:check` y `sdd:check` | PASÓ |
| Los envoltorios de la 0518, la 0521 y la 0523, `migraciones.test.mjs` y `check-migrations-applied` (en `2a4ea23f3`, con el turno del Subdirector) | PASÓ: 156 casos |
| El envoltorio de la 0522, ya como «aplicada y sellada» | Pide turno |
| `pnpm verify` y el build local | NO EJECUTADO, por la regla de la máquina |

## Pendientes de esta tarea

- **El commit de la 0522:** el DG revisa el delta antes de publicar.
- **Los punteros de la 0611 y la 0618:** los ponen sus dueños.
