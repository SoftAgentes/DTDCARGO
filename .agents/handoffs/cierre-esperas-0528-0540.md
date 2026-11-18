# Handoff · cierre de las esperas 0528, 0538, 0539 y 0540

- **Rama:** `claude/cierre-esperas-0528-0540`, desde `main` `f6f8199d6`. Worktree `.claude/worktrees/cierre-esperas-0528-0540`.
- **SDD:** 0624 (0528) y 0622 (0538, 0539 y 0540). Runbook `docs/runbooks/aplicar-migraciones-prod.md` §6.
- **Encargo:** del Director General, el 2026-11-15, después de aplicar las cuatro en producción.

## Aplicación en producción (dato del Director General)

Las aplicó el Director General con la autorización en bloque de Sam, que nombra las cuatro. El texto literal está en `AUTORIZACION.txt` de cada evidencia. Antes, a las 17:08:36Z, se publicó la web en `f6f8199d6`, que es posterior a `c2dd2855c`, como pide la 0528. Las cuatro pasaron la previa, el COMMIT y la verificación (ledger y cuerpos vivos). Después de cada una la web siguió healthy y con 0 errores en el log.

| Migración | COMMIT (UTC) | md5 del ledger | Bytes | Evidencia en `/srv/ops/evidencias/` |
|---|---|---|---|---|
| `0528_rls_lectura_dinero_y_gastos` | 2026-11-15 17:09:21 | `112f3178f116613a9c784fcfe0a1eb54` | 23082 | `apply-0528-dtd-cargo-20261115T170921Z` |
| `0538_studio_user_module_grants` | 2026-11-15 17:09:49 | `1deed08847cda609f150b95ed50d0b2c` | 31624 | `apply-0538-dtd-cargo-20261115T170948Z` |
| `0539_comercial_acepta_accesos_por_persona` | 2026-11-15 17:10:11 | `565d7607876eca42f7b54eb39cfe506e` | 16774 | `apply-0539-dtd-cargo-20261115T171008Z` |
| `0540_comercial_rls_por_modulo` | 2026-11-15 17:10:53 | `8ae2c0c52dacebbf7164fbdffbe66acb` | 25190 | `apply-0540-dtd-cargo-20261115T171051Z` |

El md5 de cada archivo en `f6f8199d6` (`md5sum`) es igual al del ledger.

## Qué cambió

- `node infra/ops/migraciones/retirar-espera.mjs <nombre> --md5 <md5>` para las cuatro:
  - quitó sus entradas de `supabase/migrations-baseline.json › pendingBelowCutoff`;
  - quitó tres declaraciones de `supabase/pending-migration-symbol-declarations.json`: una de la 0528 y dos de la 0538. La 0539 y la 0540 no tenían;
  - las selló en `supabase/migrations.lock.json`.
  - `revisarAMano` salió vacío en las cuatro.
- La única espera que queda es `0541_oficina_cable_tablas`.
- La cabecera «NO APLICADA A PRODUCCIÓN» de los `.sql` no se toca (§6.2).

## Pruebas que afirman la espera

Busqué a mano, porque `revisarAMano` no alcanza:
- los archivos de prueba que leen `pendingBelowCutoff` o el baseline y nombran alguna de las cuatro;
- los textos con «espera», «todavía», «sin aplicar» o «mientras» junto a los números.

No hay ninguna prueba que afirme la espera. Solo hay dos comentarios sobre la degradación cerrada que siguen siendo ciertos como defensa, «por ejemplo, la 0538 sin aplicar»: `lib/studio/rbac-guard.ts:72` y `lib/studio/user-module-grants-queries.ts:10`. No los toqué, porque el código no cambia.

## Evidencia

- `node scripts/migrations-lock.mjs`: exit 0. Da 528 selladas, la mayor la 0543, 1 espera sin sellar (la 0541) y 0 nuevas.
- `node scripts/check-pending-migration-symbols.mjs`: 0 ROJO y 0 AMARILLO.
- `pnpm docs:check`: PASÓ (619 specs).
- `pnpm sdd:check`: PASÓ.
- `git diff --check`: limpio.
- `check-migrations-applied`: NO DISPONIBLE en el worktree, porque no tiene `.env.local`. Lo mide el CI.

## Pendientes

- El smoke por rol en producción lo hace Sam con su sesión: contabilidad con CRM, y comercial sin asientos.
- La revisión y la fusión de esta PR las hace el Director General.

## FUERA DE ALCANCE DETECTADO

Ninguno.
