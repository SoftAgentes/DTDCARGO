# Cierre de jornada · 2026-09-21 · entrega a la sesión siguiente

Fecha: 2026-09-21 (UTC; Caracas −4). Owner: sesión «Director notificación a workers»
(Claude Opus 5, Director). Rama: `codex/cierre-jornada-20260921`, desde `origin/main` `6e3140b8`,
worktree creado con `node scripts/harness-worktree.mjs start cierre-jornada-20260921`.

Estado: **cierre autorizado por Sam** («quiero ya hacer un cierre por hoy … dejar todo listo para
empezar»). Este documento es el punto de entrada para quien retome, no un handoff de tarea.

---

## 1. Estado de `main` y de producción al cierre

| Qué | Valor | Cómo se comprobó |
|---|---|---|
| `main` | `6e3140b8040e89dba37b19748fbc97a47eb0bc66` | `git rev-parse origin/main` |
| Despliegue | **success** 17:21:06Z | estado del commit en GitHub |
| Sitio | `/` 200 · `/studio` 307 · `/portal` 307 | `curl` a los tres (307 = redirección de auth, es lo esperado) |
| Ledger de migraciones | 477 filas | `count(*)` sobre `supabase_migrations.schema_migrations` |

**Migración aplicada hoy: `0471_credito_referido_atomico`**, con OK nominal de Sam nombrando el
archivo. Ledger `20260921170338`, aplicada 17:03:38Z. Identidad probada en dos niveles: el md5 del
ledger es el del archivo **menos el salto de línea final** (`45696a7fae8fcc25b47315e829d81c3b`), y
el `md5(prosrc)` de cada función coincide con el cuerpo del archivo
(`8c32487e62bc23c16def30cc4e3c343b`, 4.455 chars; `256c1331a53ab794af184f8bb90a1ca4`, 3.344 chars).
Postflight leído del catálogo: las dos INVOKER, `search_path` vacío, owner `postgres`, EXECUTE sólo
para `authenticated`. Advisors medidos después de aplicar: ninguno nombra las dos funciones nuevas.

**Migrate-first respetado:** base 17:03:38Z → app 17:18:47Z. Quince minutos con las funciones
creadas y nadie llamándolas.

## 2. Qué entró a `main` en esta jornada

| PR | Fusionada (UTC) | Qué |
|---|---|---|
| #179 | 20 21:20Z | el paso 3 del guion de smokes dice cuántos reportes quedan en pantalla |
| #180 | 20 23:42Z | SDD-0497 — gates de RBAC en ocho server actions que no los tenían |
| #181 | 21 00:09Z | SDD-0498 — cinco puertas que se saltaban el fail-closed por `disabled_at` |
| #182 | 21 00:33Z | SDD-0495 — una reversión de crédito que falla deja de ser invisible |
| #183 | 21 00:56Z | el documento de contratos que miden comportamiento y no texto |
| #184 | 21 17:18Z | SDD-0496 — el crédito de referido se aplica y revierte en una transacción |

Conocimiento publicado desde `main` integrado: piloto semántico **16/16 CURRENT**, Archify 2.16.0
CURRENT, bóveda de Obsidian con 1.153 documentos, `knowledge:check` exit 0.

## 3. Qué queda abierto, y qué le falta exactamente a cada uno

**#186 · SDD-0499 — endurecer secretos y gates de API** (`claude/heuristic-benz-8851fb`, draft).
Cierra: el secreto de Telegram sale de la URL y pasa al header con comparación de tiempo constante;
gate de módulo en `shipments/[id]/events`; seis sitios de push donde se podía pisar la suscripción
de otro. 16 mutantes medidos, los 16 mueren. **Le falta sólo el veredicto de `pnpm verify` completo**,
que quedó corriendo al cierre. Si salió verde, sacar de draft y fusionar; si no, el veredicto está
en su handoff `sdd-0499-secretos-y-gates-api.md`.

**#185 · la 0471 sale de las esperas** (`codex/retirar-espera-0471`). Retira la espera ya aplicada
del `pendingBelowCutoff` y su declaración de símbolos; el gate pasa de «0 ROJO · 1 AMARILLO» a
«0 ROJO · 0 AMARILLO». Verificado por mí: cutoff 238 intacto, 0422 y 0423 enteras, y el `.sql` ni
aparece en el diff. **Le falta** un cambio pedido en revisión: el docblock afirma que la contención
es «la más probable» y **eso no está medido**; la jerarquía sirve, el fundamento no. Debe decir que
va primera por ser la que introdujo esa SDD y la que menos se sospecha.

**#114 · SDD-0390/0397 reportes de pago** (draft, de septiembre). **Depende de Sam**, no de código:
necesita el smoke del bloque 3 de `.agents/handoffs/smokes-app-l14-0454-0472-guion.md`. Ese smoke
destraba `0422` → `0423` → esta PR, en ese orden.

**Ramas publicadas de tareas que cerraron sin PR** (si las hay, ver §7). **Ramas viejas que NO son
de esta jornada y no deben integrarse sin revisión**: `codex/saneamiento-integral` (+158),
`codex/governance-final-100` (+20), `codex/portal-colors-reception-integration-20260906` (+7),
`codex/audit-hardening-20260801` (+5), `claude/jolly-proskuriakova-3da0aa` (+2). Son de julio y
agosto. `codex/sdd-reserve-0483-…` es un stub de reserva de número, no trabajo.

## 4. Seguridad: lo que está ABIERTO y CONFIRMADO

Verificado hoy, **no arreglado**, por decisión de alcance: hoy hay **un solo tenant**, así que los
tres son latentes. Dejan de serlo el día que exista un segundo.

- **D1 · `app/portal/(app)/estimados/actions.ts:64-69` (lee) y `:97-100` (muta).** Permite leer y
  mutar el estimado de un cliente de otro tenant que comparta Shipping Mark, porque el markbox es
  único por `(tenant_id, markbox)`. **La RLS no corta**: `createAdminClient()` es `service_role` y
  la bypasea. Y hay **fuga de PII por el canal de avisos** (`:113`): notifica a los administradores
  **del tenant de la fila** con el nombre y el markbox de quien llamó. Es el más grave de los tres.
- **D2 · `lib/portal/referral-invite.ts:80-87` y `:96-101`.** Oráculo de existencia de correos
  invitados y cupo diario compartido entre referidores de tenants distintos.
- **D3 · `lib/marca/access.ts:100-110`.** Los tres endpoints de marca firman URLs del bucket privado
  sobre el tenant **más antiguo**, no el de quien llama.

Ninguno lleva prueba: no se puede armar el caso infeliz sin fabricar un segundo tenant. La ubicación
está medida hoy y el análisis está en `sdd-0499-secretos-y-gates-api.md`.

**Inventario, no lista de defectos:** 11 de las 18 rutas de `app/api/studio` con método mutante no
tienen gate de módulo. Varias son correctas así (push es autoservicio, `audit/export` autoriza en la
base, `bugs` está abierto al staff a propósito). La que más se parece a la que se arregló hoy es
`studio/shipments/route.ts` (el POST de creación). Extenderlo pide una spec propia.

## 5. Lo que depende de Sam

1. **El smoke del bloque 3** (L14, 5 pasos) → destraba `0422` → `0423` → #114. Es el pendiente más
   viejo.
2. **Probar una anulación de factura con crédito de referido**, ahora que la 0471 está viva. Es la
   primera llamada real a las RPC nuevas y lo único que prueba que PostgREST recargó su caché de
   esquema. El event trigger `pgrst_ddl_watch` existe y disparó, pero eso prueba el mecanismo, no el
   efecto.
3. **Rotar `TELEGRAM_WEBHOOK_SECRET`** después de desplegar #186. El valor vivo viajó en URLs.
   Procedimiento en `docs/runbooks/setup-telegram-bot.md`. Hay una ventana ciega entre el deploy y
   el `setWebhook` nuevo en la que el endpoint responde 403; no se pierden updates porque Telegram
   reintenta.
4. **Cinco decisiones del pliego** que siguen abiertas, más tres que aparecieron: capacidad de
   exportación masiva, `reward_usd` no congelado al aplicar, y el significado ambiguo del campo
   `status`.

## 6. Trampas medidas hoy que le ahorran horas a quien siga

- **`jq` no existe como binario en esta máquina.** Sólo el embebido de `gh` (`--jq`). Un
  `... | jq -r '...'` falla, deja la variable **vacía sin romper el script**, y un vigilante armado
  así late «sigo vivo» sin medir nada. Pasó hoy: un centinela de CI nunca detectó el verde.
- **`gh pr checks` sale con código ≠ 0** mientras haya checks pendientes (medido: `exit 8`).
  Para un bucle va `gh pr view --json statusCheckRollup`, que sale 0.
- **El ledger guarda el archivo menos el salto de línea final.** El md5 crudo no coincide y parece
  discrepancia. Y `length(prosrc)` cuenta **caracteres**, no bytes: con acentos y rayas, 23.416
  bytes son 22.138 caracteres.
- **El md5 del ledger y el del `prosrc` no son intercambiables.** El primero prueba qué se envió; el
  segundo, qué quedó vivo. Sólo el segundo permite decir «lo desplegado es el archivo».
- **`structural: CURRENT` de `knowledge:status` no comprueba que el mapa coincida con el documento.**
  Hoy el grafo coloca «Proceso UI/UX» de `project-rules.md` en L189, donde el archivo tiene otra
  sección: 131 líneas de desfase, y dos secciones nuevas sin nodo. Sobrevivió a dos `graphify update`,
  al recibo semántico y al re-clustering. Hay una tarea abierta para eso.
- **El CI corre 14 de los 17 pasos de `verify`.** No corre `e2e`, `sql-tests`, `schema-rebuild` ni
  `migrations-applied`. «CI verde» no es «producto cerrado»; elegir el cierre por el diff.
- **Dos numeraciones comparten el espacio de cuatro dígitos**: la de migraciones y la de specs. Un
  `grep 0471` trae `docs/runbooks/knowledge-graphify-obsidian.md:3` («SDD: 0471»), que **no** es la
  migración.
- **Una cabecera de migración ya aplicada no se corrige nunca.** El ledger guardó ese texto exacto;
  editarlo rompe la identidad por md5. El estado vive en el ledger y en el baseline.

## 7. Cómo se trabaja acá

No está duplicado en este documento a propósito. Leer, en este orden: [AGENTS.md](../../AGENTS.md),
el [runbook Director/Worker](../../docs/runbooks/codex-engineering.md) y, antes de producto,
[las reglas técnicas y de dominio](../../docs/engineering/project-rules.md) — en particular su
sección «Contratos que miden el comportamiento, no el texto», que es la lección más cara de esta
jornada: **ocho instrumentos distintos dieron verde sin medir lo que parecía que medían**, y tres
fueron del Director.

Lo mínimo que no se negocia: una tarea, una rama, un worktree, una sesión escritora; nunca trabajar
en `main` ni en el checkout principal; el Worker no fusiona; una corrida pesada a la vez; y aplicar
una migración exige OK nominal de Sam **nombrando el archivo**, con el
[runbook de producción](../../docs/runbooks/aplicar-migraciones-prod.md). Fusionar una PR no
autoriza aplicarla.
