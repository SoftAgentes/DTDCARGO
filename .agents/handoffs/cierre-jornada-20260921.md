# Cierre de jornada · 2026-09-21 · entrega a la sesión siguiente

Fecha: 2026-09-21 (UTC; Caracas −4). Owner: sesión «Director notificación a workers»
(Claude Opus 5, Director). Rama: `codex/cierre-jornada-20260921`, desde `origin/main`, worktree
creado con `node scripts/harness-worktree.mjs start cierre-jornada-20260921`.

Estado: **cierre autorizado por Sam** («termina de fusionar todas y cierra»). Este documento es el
punto de entrada para quien retome, no un handoff de tarea.

---

## 1. Estado de `main` y de producción

| Qué | Valor | Cómo se comprobó |
|---|---|---|
| Despliegue de `6e3140b8` | **success** 17:21:06Z | estado del commit en GitHub |
| Sitio | `/` 200 · `/studio` 307 · `/portal` 307 | `curl` a los tres (307 = redirección de auth) |
| Ledger de migraciones | 477 filas | `count(*)` sobre `supabase_migrations.schema_migrations` |

**Migración aplicada hoy: `0471_credito_referido_atomico`**, con OK nominal de Sam nombrando el
archivo. Ledger `20260921170338`, 17:03:38Z. Identidad probada en dos niveles: el md5 del ledger es
el del archivo **menos el salto de línea final** (`45696a7fae8fcc25b47315e829d81c3b`), y el
`md5(prosrc)` de cada función coincide con el cuerpo del archivo (`8c32487e…`, 4.455 chars;
`256c1331…`, 3.344 chars). Postflight leído del catálogo: las dos INVOKER, `search_path` vacío,
owner `postgres`, EXECUTE sólo para `authenticated`. Advisors posteriores: ninguno las nombra.

**Migrate-first respetado:** base 17:03:38Z → app 17:18:47Z.

**Pendiente de comprobar en la app:** la primera llamada real a las dos RPC. El event trigger
`pgrst_ddl_watch` existe y disparó, pero eso prueba el mecanismo de recarga de PostgREST, no su
efecto.

## 2. Qué entró en esta jornada

| PR | Qué |
|---|---|
| #179 | el paso 3 del guion de smokes dice cuántos reportes quedan en pantalla |
| #180 | SDD-0497 — gates de RBAC en ocho server actions que no los tenían |
| #181 | SDD-0498 — cinco puertas que se saltaban el fail-closed por `disabled_at` |
| #182 | SDD-0495 — una reversión de crédito que falla deja de ser invisible |
| #183 | el documento de contratos que miden comportamiento y no texto |
| #184 | SDD-0496 — el crédito de referido se aplica y revierte en una transacción |
| #185 | la 0471 sale de las esperas: gate de símbolos en «0 ROJO · 0 AMARILLO» |
| #188 | SDD-0501 — causa del desfase de encabezados del grafo, con su comprobación |
| #189 | SDD-0500 — el contrato de RBAC mide por acción sobre 73 archivos |
| #186 | SDD-0499 — secretos fuera de la URL y gates de API |

Conocimiento publicado desde `main`: piloto semántico **16/16**, Archify 2.16.0, bóveda con 1.153
documentos, `knowledge:check` exit 0. **Ese estado quedó viejo** con lo que entró después: hay que
volver a publicar (ver §6).

**GitHub Actions estuvo bloqueado por facturación entre las 18:39Z y las ~21:47Z**, lo que frenó el
cierre casi tres horas. La firma, por si vuelve: el job muere en **3-4 segundos con CERO pasos
ejecutados** y la causa está en las **anotaciones** del check, no en el log. Dos lecciones medidas
ese rato: **`status: queued` NO prueba que el bloqueo se haya levantado** —es el estado momentáneo
antes de que el control de facturación mate el job— y **el `statusCheckRollup` de la PR arrastra la
conclusión del intento anterior** mientras el nuevo arranca, así que un vigilante que lo lea reporta
el rojo viejo como si fuera del intento nuevo. Lo que sí distingue: **contar los pasos del job**.
Un job que corre de verdad registra pasos aunque falle; uno bloqueado registra cero. Y pagar la
deuda no restablece por sí solo el *spending limit* de Actions: son dos ajustes distintos.

## 3. Qué queda abierto

Sólo una PR, y no depende de código.

**#114 · SDD-0390/0397 reportes de pago** (draft, de septiembre). **Depende de Sam, no de código:**
necesita el smoke del bloque 3 de `.agents/handoffs/smokes-app-l14-0454-0472-guion.md`. Ese smoke
destraba `0422` → `0423` → esta PR, en ese orden.

**Ramas viejas que NO son de esta jornada y no se integran sin revisión:**
`codex/saneamiento-integral` (+158), `codex/governance-final-100` (+20),
`codex/portal-colors-reception-integration-20260906` (+7), `codex/audit-hardening-20260801` (+5),
`claude/jolly-proskuriakova-3da0aa` (+2). Son de julio y agosto.
`codex/sdd-reserve-0483-…` es un stub de reserva de número, no trabajo.

## 4. Seguridad: ABIERTO y CONFIRMADO

Verificado hoy, **no arreglado**, por decisión de alcance: hoy hay **un solo tenant**, así que los
tres son latentes. Dejan de serlo el día que exista un segundo.

- **D1 · `app/portal/(app)/estimados/actions.ts:64-69` (lee) y `:97-100` (muta).** Permite leer y
  mutar el estimado de un cliente de otro tenant que comparta Shipping Mark, porque el markbox es
  único por `(tenant_id, markbox)`. **La RLS no corta**: `createAdminClient()` es `service_role` y
  la bypasea. Y hay **fuga de PII por el canal de avisos** (`:113`): notifica a los administradores
  **del tenant de la fila** con el nombre y el markbox de quien llamó. Es el más grave.
- **D2 · `lib/portal/referral-invite.ts:81-87` y `:97-101`.** Oráculo de existencia de correos
  invitados y cupo diario compartido entre referidores de tenants distintos.
- **D3 · `lib/marca/access.ts:100-109`.** Los tres endpoints de marca firman URLs del bucket privado
  sobre el tenant **más antiguo**, no el de quien llama.

> Las tres citas **estuvieron mal todo el día** —decían `:80-87`, `:96-101` y `:100-110`— y
> circularon como «verificadas». No se vencieron porque `main` se moviera: **nacieron mal**, porque
> quien las midió leyó con `sed -n '70,110p'` y sumó el desplazamiento a mano, confirmando su
> aritmética en vez del archivo. `grep -n` imprime el número sin que nadie sume. En un hallazgo
> ABIERTO Y CONFIRMADO **la cita es el entregable**.

**Inventario, no lista de defectos:** 11 de las 18 rutas de `app/api/studio` con método mutante no
tienen gate de módulo. Varias son correctas así (push es autoservicio, `audit/export` autoriza en la
base, `bugs` está abierto al staff a propósito). La más parecida a la que se cerró hoy es
`studio/shipments/route.ts`. Extenderlo pide una spec propia — y el día que se escriba, las rutas
que #186 agregó pasan a estar medidas por un contrato que nadie corrió sobre ellas.

**Deuda nombrada del contrato de RBAC:** 24 entradas en DEUDA (acciones sin candado o con candado
artesanal) y `lib/studio/renditions/actions-helpers.ts:58`. Ninguna acción **nueva** puede nacer sin
candado: eso ya lo impide el contrato.

**No es un hueco, y conviene que quede dicho para que nadie lo «arregle» dos veces:**
`lib/http/studio-session.ts` relee `user_tenants` sin `.eq("user_id", …)` ni `.is("disabled_at",
null)`, que es lo que la SDD-0498 arregló en `rbac-guard.ts`. **La RLS corta las dos cosas** — la
policy de `user_tenants` para `authenticated` es `user_id = auth.uid() AND disabled_at IS NULL`,
leída de producción. Es redundancia perdida, no agujero.

## 5. Lo que depende de Sam

1. **El smoke del bloque 3** (L14, 5 pasos) → destraba `0422` → `0423` → #114. El pendiente más
   viejo.
2. **Probar una anulación de factura con crédito de referido.** Primera llamada real a las RPC
   nuevas y lo único que prueba que PostgREST recargó.
3. **Rotar `TELEGRAM_WEBHOOK_SECRET`** después de desplegar #186. El valor vivo viajó en URLs.
   Procedimiento en `docs/runbooks/setup-telegram-bot.md`. Hay una ventana ciega entre el deploy y
   el `setWebhook` nuevo en la que el endpoint responde 403; no se pierden updates porque Telegram
   reintenta.
4. **Dos decisiones de producto que quedaron esperándolo:** si el mapa de etapas de Kommo se cierra
   a admin (hoy `moduleEditDenial("kommo")` admite `commercial`, y cerrarlo le saca la pantalla a
   ese rol), y cuándo se vacían las 24 entradas de DEUDA.
5. **Cinco decisiones del pliego** siguen abiertas, más tres nuevas: capacidad de exportación
   masiva, `reward_usd` no congelado al aplicar, y el significado ambiguo del campo `status`.

## 6. Tareas del Director, pendientes

- **Reparar el desfase de encabezados del grafo** de `docs/engineering/project-rules.md` y
  `docs/runbooks/knowledge-graphify-obsidian.md`. Procedimiento comprobado, en el runbook: quitar la
  capa semántica del documento en `graphify-out/graph.json`, correr `graphify update .` y volver a
  inyectarla. **`--force` no sirve** (imprime «No code-graph topology changes detected»). Va después
  de integrar, porque las PRs de hoy mueven esas líneas. Hasta que se repare, `structural` sale
  PENDING con los dos nombrados: **ése es el rojo que se pidió que existiera.**
- **Volver a publicar la bóveda** desde `main` integrado: el piloto 16/16 de hoy quedó viejo.
- **Actualizar `docs/engineering/project-rules.md` L189-L318**, que todavía dice que el contrato del
  caso 1 «está encolado»: lo cerró #189.

## 7. Trampas medidas hoy que le ahorran horas a quien siga

- **`jq` no existe como binario en esta máquina.** Sólo el embebido de `gh` (`--jq`). Mordió
  **cuatro veces**: la tubería falla, el error se va por stderr (o lo traga un `2>/dev/null`), la
  variable queda vacía y la capa de arriba lee ese vacío como un dato del sujeto medido. Un monitor
  llegó a reportar «gh no devolvió JSON» con el JSON a la vista.
- **El exit code de una cadena es el del último comando.** Mordió **cuatro veces**: `| tail`,
  `| tee`, y un `; date` al final. Capturá `$?` en su propia línea, inmediatamente.
- **El merge que GitHub calcula para el CI (`refs/pull/N/merge`) no usa el driver
  `dtd-generated-records`.** El caso **no conflictivo** es peor que el conflictivo porque no avisa:
  fusiona limpio y deja `docs/specs/README.md` con el conteo mal. Lo atrapa `docs:check` en el CI.
  Al traer `main` con el driver localmente, el índice queda bien solo.
- **El ruleset exige rama al día.** `BEHIND` bloquea aunque el check esté verde y no haya conflicto.
  Cada merge obliga al resto de la fila a traer `main` y volver a medir.
- **El ledger guarda el archivo menos el salto de línea final**, y `length(prosrc)` cuenta
  caracteres, no bytes. El md5 del ledger y el del `prosrc` responden preguntas distintas: el
  primero, qué se envió; el segundo, qué quedó vivo.
- **`verify` tiene 17 pasos y el CI corre 14.** No corre `e2e`, `sql-tests`, `schema-rebuild` ni
  `migrations-applied`. «CI verde» no es «producto cerrado»; el cierre se elige por el diff.
- **`scripts/tests/verify-watchdog.node.mjs:248` falla bajo carga en Windows y pasa con la máquina
  libre.** `isProcessAlive` usa `process.kill(pid,0)`, que no tira mientras vive el handle, y su
  chequeo de zombie lee `/proc/<pid>/stat`, que sólo existe en Linux. No es de tu diff.
- **Un `build` rojo en frío desde Windows puede ser la red.** 18 errores de `next/font/google` que
  no se reprodujeron en tres builds en frío verdes (CI, Vercel y un control local aislado).
- **Dos numeraciones comparten el espacio de cuatro dígitos**: migraciones y specs. Un `grep 0471`
  trae `docs/runbooks/knowledge-graphify-obsidian.md:3` («SDD: 0471»), que **no** es la migración.
- **Una cabecera de migración ya aplicada no se corrige nunca.** El ledger guardó ese texto exacto.

## 8. La lección de la jornada

**Ocho instrumentos distintos dieron un resultado sin medir lo que parecía que medían**, y tres
fueron del Director. Ordenados por lo difícil que es notarlos: el **mudo** (no emite), el
**ruidoso** (late «sigo vivo» sin medir), el que **trae su explicación ya hecha** («expiró» se lee
como «el CI está lento»), el **«no sé» disfrazado de veredicto** (`mergeable: UNKNOWN` no es «no se
puede»), y el que **mide bien el objeto equivocado** — un verde de CI de un SHA anterior se lee
idéntico al del commit que se fusiona, y ése no se delata nunca.

La raíz es una sola, y la dijo mejor quien la encontró en su propio método: **el instrumento
confirma la construcción de quien mide, no el hecho**. Leer con `sed` y sumar el desplazamiento a
mano confirma la aritmética, no el archivo. Contar por carpeta cuando la pregunta era «rutas que
toqué» confirma el recorte. Buscar `post("/api/` confirma el patrón que escribiste, no el contenido.
En ese último caso la conclusión resultó correcta, y su autor lo dijo así: **«que la conclusión
sobreviviera fue suerte, no método»**.

Las ocho se resolvieron igual, y ninguna mejorando el instrumento: **yendo a leer el estado
directo.** Antes de creerle a una medición propia: *si el hecho fuera el contrario, ¿este
instrumento me lo mostraría, o me devolvería lo que ya supuse al construirlo?*

Y la contracara, que también apareció hoy: un Worker razonó bien por qué su candado no podía romper
ningún flujo legítimo —y **pidió correr `e2e` igual**. Su frase: «es un argumento, no una corrida».
Un argumento cubre el espacio de fallas que imaginaste; una corrida cubre el que existe.

## 9. Cómo se trabaja acá

No está duplicado acá a propósito. Leer, en orden: [AGENTS.md](../../AGENTS.md), el
[runbook Director/Worker](../../docs/runbooks/codex-engineering.md) y, antes de producto,
[las reglas técnicas y de dominio](../../docs/engineering/project-rules.md) — en particular
«Contratos que miden el comportamiento, no el texto».

Lo mínimo que no se negocia: una tarea, una rama, un worktree, una sesión escritora; nunca trabajar
en `main` ni en el checkout principal; el Worker no fusiona; una corrida pesada a la vez; y aplicar
una migración exige OK nominal de Sam **nombrando el archivo**, con el
[runbook de producción](../../docs/runbooks/aplicar-migraciones-prod.md). Fusionar una PR no
autoriza aplicarla.
