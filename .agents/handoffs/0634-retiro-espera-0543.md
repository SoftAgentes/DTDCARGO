# Handoff · SDD-0634 · El retiro de la espera de la 0543

- **Rama:** `claude/docs-retirar-espera-0543`, desde `origin/main` `af6ffff86` (la fusión de la #578). Worktree `.claude/worktrees/docs-retirar-espera-0543`.
- **Quién:** Worker de documentación, por encargo del Subdirector de Chatwoot, pedido por el DG (2026-11-15).
- **Spec:** ninguna; no hace falta SDD. Es el cierre del runbook de quien aplica (SDD-0546, `aplicar-migraciones-prod.md` §6) y no toca ningún `.sql`.

## Qué cambia

1. **La espera de la 0543**, aplicada en producción el 2026-11-15 a las 15:42:24Z con el OK de Sam «Autorizo la 0543». Evidencia del DG: `/srv/ops/evidencias/apply-0543-dtd-cargo-20261115T154222Z` (md5 `c44c34f2aeba188ba18194ee29b135f3`, 12953 bytes, cuerpos vivos iguales a los del archivo, disparador con `tgenabled=A`). La #578 se fusionó a las 15:42:43Z con `--match-head-commit 61d66a2ff`, y `main` quedó en `af6ffff86`.
   - `node infra/ops/migraciones/retirar-espera.mjs 0543_feature_flags_exige_superadmin --md5 c44c34f2aeba188ba18194ee29b135f3`. El md5 es el del DG, de la evidencia del apply; coincide con el del archivo local (12953 bytes), y el script lo exige.
   - `node scripts/migrations-lock.mjs`: 524 selladas (la mayor, la 0543), 5 esperas sin sellar, 0 nuevas sin sellar.
   - Resultado: `supabase/migrations-baseline.json` pierde solo la entrada de la 0543, y `supabase/migrations.lock.json` suma su sello (sha256 `38316b9c…9c73`, md5 `c44c34f2…35f3`, 12953 bytes, ledger 2026-11-15, forma exacta). Declaraciones de símbolos que quitar: 0.
2. **El ítem 2 de FUERA DE ALCANCE** de `0634-audit-d1-flags-superadmin.md`: ya no es cierto que el baseline declare la 0542; la retiró la #581. El ítem dice ahora cómo quedó el baseline. Se agregó el ítem 4: la #579 (B4) entró por SQUASH, con `3793b4ca3`.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| Huella de las líneas «OK nominal» (`grep 'OK nominal' <archivo> \| md5sum \| cut -c1-8`) | PASÓ: runbook `79131b41` y guion `693fb4f3`, iguales antes y después. `copia-columnas.tsv` sin tocar (md5 `cc1534a8a223e37ab9485451d5ee922c`) |
| `docs:check` | PASÓ |
| `sdd:check` | PASÓ |
| El candado de migraciones (`scripts/migrations-lock.mjs`) | PASÓ, exit 0 |
| Su prueba (`node --test scripts/tests/migrations-lock.node.mjs`) | PASÓ: 23 de 23 |
| El gate de símbolos (`scripts/check-pending-migration-symbols.mjs`) | PASÓ: 0 ROJO, 3 AMARILLO declarados (las esperas que siguen) |
| El `.sql` de la 0543 | Sin tocar: md5 `c44c34f2aeba188ba18194ee29b135f3`, 12953 bytes |
| Las otras esperas (0528, 0538, 0539, 0540, 0541) | Intactas en el baseline |
| Pruebas que afirmen la espera de la 0543 | Ninguna: `retirar-espera.mjs` no marcó nada para revisar a mano |
| `pnpm verify`, vitest, build, Docker | NO EJECUTADO |
| La gate `migrations-applied` | NO EJECUTADO: necesita credenciales de producción. La mide el CI de la PR |

## Pendientes de esta tarea

- La revisión y la fusión de la PR, que hace el DG.

## FUERA DE ALCANCE DETECTADO

- La cabecera «NO APLICADA A PRODUCCIÓN» del `.sql` de la 0543 se conserva a propósito (§6, punto 2): el ledger guarda el texto exacto.
- La spec 0634 sigue en `in-progress`, que es la norma para una spec fusionada. No se tocó.

## Impacto documental

- Cambia un handoff (`0634-audit-d1-flags-superadmin.md`, ítems 2 y 4 de FUERA DE ALCANCE). `aplicar-migraciones-prod.md` se siguió tal cual, sin cambios. Sin cambios en Obsidian ni en Graphify (retirados, SDD-0632).
