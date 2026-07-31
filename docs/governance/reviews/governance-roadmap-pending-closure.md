# Cierre local de Gobernanza 6

| Control | Valor |
|---|---|
| Revisión | REV-SGE-023 |
| Fecha | 2026-07-31 |
| Rama | `codex/governance-roadmap-integration` |
| Worktree | separado del checkout de `main` |
| Resultado | integración y pendientes locales cerrados; publicación y gates externos separados |

## 1. Auditoría candidata

REV-SGE-022 conserva la clasificación individual de los 19 commits de
`codex/governance-roadmap-batch`:

| Clasificación | Cantidad | Resultado |
|---|---:|---|
| integrar | 5 | evidencia y código válidos entraron sin cambio semántico |
| adaptar | 13 | se conservaron aportes válidos y se corrigieron correlativos, claims o contratos |
| reemplazar | 1 | el merge mecánico candidato se sustituyó por integración desde `origin/main` |
| rechazar | 0 | ningún commit completo fue descartado; las partes no conformes no se integraron como cumplimiento |

No se reimplementó el roadmap desde cero ni se ejecutó un barrido masivo.
NUM-01 v1.1, SDD-0185 done, `NumericInput` y los cuatro componentes CMP-01
permanecen intactos.

## 2. Matriz final

| Bloque | Integrado y validado | Estado externo |
|---|---|---|
| Corte C1 | `0270` y consulta RBAC gobernada | aplicado individualmente en Producción |
| D1 | workflow durable intención → Auth → confirmación/compensación | `0289` aplicado individualmente |
| D2 | atomicidad PostgreSQL + motivos humanos en cinco anulaciones | `0290` aplicado; `0294` sólo local |
| D3 | atomicidad PostgreSQL + motivos humanos en cancelaciones OC/OV | `0291` aplicado; `0295` sólo local |
| D4 | bridge R3 + cinco RPC con path vacío | `0292` aplicado; `0296` sólo local |
| D5 | idempotencia, lease, reintento, reconciliación y retiro del writer | `0293` aplicado individualmente |
| Corte E1 | ausencia de fuente registrada de forma fail-closed | E2–E5 bloqueados |
| VIS-02 | V2 email, V3 PDF y V4 visual local; UI china en Noto Sans SC | Gmail, Outlook y Apple Mail sin evidencia controlada |
| PLG-01 | fuente repo con 27 políticas, cuatro componentes y forward-tests positivos/negativos | caché cargada desactualizada; escritura, MCP, app, hooks, credenciales y marketplace remoto prohibidos |
| Adopción | slices R2/R3 acotados con SDD y allowlist | sin barrido legacy ni slice artificial |

La consulta metadata-only final del ledger de Producción termina en
`0293_audit_d5_residual_and_writer_retirement`. `0294`, `0295` y `0296`
requieren autorización nominal individual y no fueron aplicadas.

## 3. Evidencia ejecutada

- `pnpm verify`: verde; `migrations-applied` fue el único paso omitido porque el
  worktree no contiene `SUPABASE_SERVICE_ROLE_KEY`;
- ledger de Producción verificado aparte, metadata-only, hasta `0293`;
- SQL: 35/35 contratos en PostgreSQL 17 con rollback total;
- D4 adicional: PostgreSQL 15 y 17 verdes;
- schema rebuild: 292 migraciones procesadas, 275 aplicadas y 17 sólo-ledger;
- aislamiento multi-tenant: 219 tablas y dos tenants reales;
- typecheck: verde;
- lint completo: cero errores y 172 warnings legacy;
- Vitest: 328 archivos y 4240 pruebas;
- E2E: 19 aplicables verdes y 3 omitidos por fixture autenticado;
- build: verde, 152 páginas generadas;
- `docs:check`, `components:check`, `governance:check` y
  `git diff --check`: verdes;
- CMP-01: cuatro fuentes; cápsula: 27 políticas aprobadas.

## 4. Gates que no se falsearon

- no se publicó ni hizo push; la rama queda 14 commits adelante y cero detrás
  de `origin/main`;
- no se aplicaron `0294`–`0296`;
- no se modificó Vercel ni se desplegó;
- no se limpiaron ramas o worktrees;
- la búsqueda metadata-only en Drive no encontró una fuente legal/contractual
  aprobada para E2–E5;
- Gmail y Outlook no tienen conectores instalados en esta ventana, Chrome no
  tiene la extensión requerida y Apple Mail necesita un cliente Apple real;
- el plugin cargado desde caché reporta `policy-registry.json` desactualizado;
  el repositorio sigue siendo la fuente normativa y no se alteró la caché;
- el retiro opcional de `gov6-vis-local` quedó bloqueado por política local y
  no se forzó una vía alternativa.

La publicación permanece condicionada al literal `cerrar`.
