# Cierre del roadmap autorizado de gobernanza

| Control | Valor |
|---|---|
| Revisión | REV-SGE-022 |
| Fecha | 2026-07-30 |
| Alcance | D1–D5, Cortes C/E, adopción R2/R3, VIS-02 V2–V4 y PLG-01 P6–P8 |
| Resultado | integración local reconciliada; efectos externos en gates propios |

## Auditoría de los 19 commits candidatos

| # | Commit candidato | Clasificación | Evidencia de decisión |
|---:|---|---|---|
| 1 | `7cbb237a` · D1 | adaptar | se conservó el flujo intención → Auth → confirmación/compensación y se corrigió la reconciliación durable |
| 2 | `dd4b86ff` · payload D1 | integrar | el ajuste tipado no colisionó con NUM-01 ni con el cierre vigente |
| 3 | `5f8ffd73` · D2 | adaptar | se conservó la transacción PostgreSQL y se registró la no conformidad de motivo humano legacy |
| 4 | `fe45694f` · D3 | adaptar | mismo criterio de atomicidad local y motivo legacy que D2 |
| 5 | `5aa81d20` · fuentes D2/D3 | integrar | alinea los eventos con AUD-01 sin afirmar conformidad inexistente |
| 6 | `0e8d993c` · D4 | adaptar | se normalizó el bridge; cinco RPC legacy quedaron declaradas como no conformidad de `search_path` |
| 7 | `26197922` · D5 | adaptar | se añadieron clave estable, lease, reintento, reconciliación y retiro del writer directo |
| 8 | `ffeb987d` · Corte C1 | adaptar | se reutilizó el contrato local de `0270`; el snapshot Cloud quedó sólo como evidencia histórica |
| 9 | `5d4fd8bb` · Corte E1 | adaptar | se renumeró a SDD-0186 y se mantuvo E2–E5 fail-closed |
| 10 | `75cd31aa` · VIS V2 | integrar | email formal `zh-CN` conserva Noto Serif SC sin cambiar la UI |
| 11 | `cacbf767` · VIS V3 | integrar | el packing list usa la excepción sólo en impresión formal |
| 12 | `a921e697` · VIS V4 | adaptar | se regeneró evidencia local sin afirmar clientes de correo externos |
| 13 | `c388d3e6` · estado VIS | adaptar | se actualizó al resultado local comprobado |
| 14 | `43019f8a` · gates VIS | adaptar | Gmail, Outlook y Apple Mail permanecen externos |
| 15 | `4361c2fe` · inventario VIS | adaptar | se reconcilió contra la línea base vigente |
| 16 | `6a0a9b8d` · PLG P6–P8 | adaptar | se regeneró sobre 27 políticas y cuatro componentes, repo/team y read-only |
| 17 | `9dfaaeb2` · merge de `origin/main` | reemplazar | no se integró el merge mecánico; se partió de `origin/main` y se resolvió cada colisión por evidencia |
| 18 | `c04d9b10` · tests VIS/E2E | integrar | los estabilizadores pasaron en la suite canónica |
| 19 | `444a7d3f` · cierre candidato | adaptar | se sustituyeron correlativos colisionados y evidencia anterior por REV-SGE-022/LB-SGE-095 |

## Resultado por bloque

| Bloque | Resultado comprobado | Estado externo |
|---|---|---|
| AUD D1 | 24 acciones de acceso/configuración usan intención durable, claim, efecto Auth y confirmación/compensación | `0289_audit_d1_access_configuration` no aplicado |
| AUD D2 | siete mutaciones financieras comparten transacción con su evento; motivo humano legacy no conforme | `0290_audit_d2_financial_domain` no aplicado |
| AUD D3 | cuatro mutaciones comerciales comparten transacción con su evento; motivo humano legacy no conforme | `0291_audit_d3_commercial_cycle` no aplicado |
| AUD D4 | bridge R3 normalizado; cinco RPC legacy conservan `pg_catalog, public` como no conformidad | `0292_audit_d4_logistics_r3` no aplicado |
| AUD D5 | efectos externos con clave reutilizable, lease, reintento y reconciliación; writer directo retirado | `0293_audit_d5_residual_and_writer_retirement` no aplicado |
| Corte C1 | migración y contrato SQL revalidados; snapshot de Producción conservado sólo como evidencia histórica | `0270_audit_governed_query_rbac` no aplicado |
| Corte E1 | ausencia de fuente legal/contractual registrada por SDD-0186 de forma fail-closed | E2–E5 no se abren sin fuente aprobada |
| Adopción R2/R3 | se conservaron los slices existentes; no se abrió ni ejecutó un barrido transversal | migración legacy continúa incremental con SDD y allowlist propios |
| VIS-02 | V2 email, V3 documento formal y V4 visual local cerrados; UI china conserva Noto Sans SC | falta evidencia controlada en Gmail, Outlook y Apple Mail |
| PLG-01 | 0.1.2 repo/team, read-only, 27 políticas y 4 componentes; forward-tests positivos y negativos verdes | MCP, app, hooks, credenciales, escritura y marketplace remoto permanecen fuera de alcance |

La atomicidad declarada para D2–D5 es por mutación PostgreSQL y su evento, no
una transacción ACID transversal entre llamadas independientes. D1 tampoco
declara atomicidad ACID entre PostgreSQL y Supabase Auth: usa un workflow durable
con idempotencia, compensación y reconciliación.

## Evidencia ejecutada

- `pnpm verify`: todo verde; `migrations-applied` fue omitido sin credenciales
  de Producción y no se presentó como verificación Cloud;
- SQL: 32/32 contratos tanto en PostgreSQL 15 como en PostgreSQL 17 efímeros,
  con rollback total;
- schema rebuild: 289 migraciones procesadas, 272 aplicadas y 17 sólo-ledger;
- typecheck: verde;
- lint completo: cero errores y 172 warnings preexistentes;
- Vitest completo: 327 archivos y 4.233 pruebas verdes;
- E2E aplicable: 19 verdes y 3 omitidos por requerir seed autenticado; se usó
  URL local cerrada y clave pública sintética, sin secreto ni conexión Cloud;
- build: verde, TypeScript incluido y 152 páginas generadas;
- adapters AUD y contratos VIS/PLG: gates puntuales verdes;
- `docs:check`, `components:check` y `governance:check`: verdes;
- CMP-01: cuatro fuentes, agregado reproducible y cero rutas rotas;
- cápsula: 27 políticas aprobadas y vigente;
- VIS-02: PDF chino extraíble y PNG local sin tofu, recortes ni superposición;
- `git diff --check`: verde.

La primera corrida E2E sin variables públicas falló sólo al construir el
cliente Supabase en cuatro casos. La repetición con valores locales sintéticos
revalidó esos casos y la corrida canónica completa cerró 19/19 aplicables.

## Cierre y frontera

El núcleo de gobernanza queda reconciliado localmente. Todo trabajo nuevo de
Codex, Claude Code o Cloud Design debe entrar por:

1. `docs/governance/AGENT-BRIEF.md` y la cápsula vigente;
2. un SDD cuando cambie comportamiento o contrato;
3. una allowlist exacta y proporcional;
4. evidencia clasificada como `cumplimiento`, `no aplica`, `excepción` o
   `no conformidad`;
5. `pnpm verify` antes de cierre.

No hubo escritura en Producción, lectura de negocio/PII, Vercel, despliegue ni
limpieza de worktrees. La publicación de esta rama queda separada hasta recibir
el literal `cerrar`.
