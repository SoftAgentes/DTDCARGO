---
sdd: "0277"
title: "El replay de un branch efímero deja de morir en la 0355"
status: done
author: "Sam (founder) + Claude Code"
created: 2026-08-21
updated: 2026-08-21
supersedes: null
superseded_by: null
related: ["0118", "0168", "0172", "0250", "0252"]
confidencialidad: interno
---

# DTD-0277 — El replay de un branch efímero deja de morir en la 0355

> Un branch desechable de Supabase no termina de replayar las migraciones y
> muere en la 0355. Mientras eso siga así, los **18 tests e2e Tier 3 del Studio
> salen `skipped` en cada corrida del gate**: cobertura apagada, no ausente.

## 1. Contexto — qué se midió

Medido el **2026-08-21** creando un branch real (`project_ref`
`fmltjdwwsyxavswsgcut`, ya destruido con `delete_branch`):

| Hecho | Valor |
|---|---|
| Última migración aplicada | `0354_studio_access_tokens` (version `20260807163407`) |
| Punto de muerte | `0355_superadmin_llaves_del_sistema.sql` |
| Sin aplicar | 30 de 384 |
| `status` del branch | `MIGRATIONS_FAILED` |

⚠️ **Se mira `status`, no `preview_project_status`.** Ese último decía
`ACTIVE_HEALTHY` con el replay roto. Un branch "sano" con el replay caído es
exactamente el estado que el runbook prohíbe usar.

**No es el bloqueo anterior.** El punto de muerte histórico era
`seed_team_invitation_template`, y quedó resuelto por las reparaciones 0271 y
0280–0288. Éste es un punto de muerte **nuevo**.

## 2. Causa — probada leyendo el código, no inferida

La cadena es corta y cada eslabón está en un archivo del repo:

1. **`0058_platform_admins.sql`** siembra el primer platform admin con un uuid
   fijo (`83c98d22-…`), y la columna tiene FK a `auth.users(id)`.
2. **`0273_skip_platform_admin_bootstrap_history.sql`** —a su vez reparada por
   la **0282**— **borró ese bootstrap del PAYLOAD DEL LEDGER**, para que el
   replay no reventara con `23503` contra un `auth.users` vacío. Su reemplazo lo
   dice literal: *"el bootstrap de datos se omite intencionalmente"*.
3. **Un branch replaya el LEDGER, no los archivos del repo.** Prueba: si
   corriera los archivos, la 0058 habría muerto con `23503` mucho antes de la
   0355; el replay medido llegó hasta la 0354.
4. Entonces en un branch **`platform_admins` queda VACÍA — que es justo lo que
   la 0273 buscaba.**
5. Pero la **0355 abre con un preflight que EXIGE que no esté vacía** y aborta:

   ```sql
   if not exists (select 1 from public.platform_admins) then
     raise exception '0355 abortado: platform_admins está VACÍA. …';
   end if;
   ```

**El arreglo tiene que cubrir DOS migraciones, no una.** La
`0356_superadmin_legal_renditions_gate.sql` trae el mismo gate palabra por
palabra. Parchear sólo la 0355 movería la muerte una migración más adelante —
otro branch quemado para descubrirlo.

### Por qué el gate de reconstrucción no podía cazarlo

`scripts/check-schema-rebuild.mjs` corre los **archivos del repo** sobre un
Postgres limpio, y ahí `supabase/tests/_supabase-platform-stubs.sql` **siembra
el uuid `83c98d22-…` en `auth.users`** (línea 163). Con ese usuario presente el
bootstrap de la 0058 entra, `platform_admins` **no** queda vacía y el preflight
de la 0355 pasa.

> **Los dos caminos ejecutan SQL distinto para la misma migración.** El gate de
> reconstrucción es estructuralmente ciego a cualquier rotura que introduzca una
> reparación sólo-ledger, porque nunca ejecuta los payloads parcheados. No es un
> bug del gate: es su alcance. Conviene tenerlo escrito.

## 3. Alcance

**Entra:** bajar el `raise exception` de ese gate a `raise notice` en las **dos**
entradas del ledger (0355 y 0356). Nada más del payload se toca.

**No entra, a propósito:**

- **Sembrar un platform admin.** En un branch no hay a quién dárselas
  (`auth.users` nace vacío) y `platform_admins` sólo la escribe `service_role`.
  La consecuencia es acotada: en un entorno efímero nadie es superadmin, así que
  feature flags, Legal y Rendiciones quedan sin escritor. **Ninguno de los 4
  specs Tier 3 toca esas superficies** — verificado por grep sobre
  `comments-lifecycle`, `gastos-expense-void`, `global-search` y
  `nomina-settlement-void`. Si algún día hace falta, el lugar es
  `scripts/seed-e2e.ts` (corre con `service_role`), no una migración.
- **Editar los archivos 0355/0356 del repo.** No serviría —un branch no los
  ejecuta— y encima reescribiría migraciones ya aplicadas en producción.

## 4. Diseño — `0388_replay_gate_platform_admins_history.sql`

Migración **sólo-ledger**: toca `supabase_migrations.schema_migrations` y nada
más. Registrada en `LEDGER_ONLY` de `check-schema-rebuild.mjs`, que verifica la
exención **por huella del schema**, no leyendo el texto.

### 🔴 El archivo del repo NO es lo que hay en prod — y por poco cuesta el arreglo

Medido contra el ledger real el 2026-08-21, **antes** de aplicar nada:

| Entrada | `version` | El gate coincide con el archivo del repo |
|---|---|---|
| `0355_superadmin_llaves_del_sistema` | `20260807192547` | ❌ **no** |
| `0356_superadmin_legal_renditions_gate` | `20260808005744` | ✅ sí |

Lo aplicado en la 0355 guarda el mensaje **recortado** —`'0355 abortado:
platform_admins está VACÍA.'`, 8275 caracteres de payload— mientras el archivo
del repo trae la versión larga (*"Aplicarla dejaría las llaves sin dueño…"*).
Anclar en la frase completa del archivo habría hecho **abortar la 0388 por "0
entradas"** en el momento de aplicarla.

Por eso el ancla es el **prefijo común a las dos redacciones** —
`raise exception '0355 abortado:`— y encima es **ASCII puro**: ningún acento ni
em-dash puede desalinearla. Verificado sobre las **395 entradas** del ledger:
cada ancla aparece en **exactamente 1**, y 0 están ya parcheadas.

> Lección repetible: **el repo dice qué DEBERÍA estar aplicado, no qué HAY.**
> Cualquier reparación de ledger que se ancle en el texto del archivo está
> apostando a que nadie editó el .sql después de aplicarlo.

### Se aparta del patrón 0271–0288 en una cosa, y es a propósito

Aquellas anclan `version` + `name` + `md5` y pegan el payload completo. Eso
obligó a **reparar cada reparación** (0273→0282, 0280–0286→0287→0288): el
payload de la propia reparación es lo que un replay vuelve a ejecutar, y con
anclas rígidas no se reconoce a sí mismo ya aplicado.

Ésta **se autolocaliza por contenido y es idempotente por construcción**:

- acepta las dos formas —sin parchear y ya parcheada— y exige que haya
  **exactamente una** entrada candidata; con 0 o con 2 **aborta**;
- el `UPDATE` queda **no-op** cuando ya está parcheada, y la postcondición se
  cumple igual → **un replay futuro la corre sin necesitar una 0389 que la
  repare**;
- se excluye a sí misma de la búsqueda con una marca en su propio payload
  (`0388-ledger-gate-marca`) — sin eso, los literales que lleva dentro harían
  que se encontrara a sí misma en el ledger;
- **el anti-drift no se pierde**: se prueba por **ida y vuelta** —
  `replace(después, nuevo, viejo) = antes` — que nada fuera del gate cambió.
  Eso es más fuerte que un md5 del payload entero, porque señala *qué* se movió.

## 5. Verificación

| Qué | Cómo | Resultado |
|---|---|---|
| Contrato SQL | `node scripts/run-sql-tests.mjs` | ✅ 114/114, incluida `0388_…test.sql` |
| Reconstrucción desde cero | `node scripts/check-schema-rebuild.mjs` | ✅ 367 aplicadas + **18** sólo-ledger; la huella confirma que la 0388 **no toca** tablas, funciones ni policies |
| Gate completo | `node scripts/verify.mjs` | ✅ exit 0 (`migrations-applied` salió **SKIP**: worktree sin `.env.local`) |
| Precondición contra el ledger REAL | `execute_sql` de sólo lectura sobre prod | ✅ cada ancla en **1** de 395 entradas, 0 ya parcheadas |
| ¿El test mide de verdad? | **mutación del artefacto** | ✅ ver abajo |

El fixture del test usa **las dos redacciones que existen de verdad**: la 0355
con el mensaje recortado de producción y la 0356 con el largo. Si el ancla
volviera a la frase completa del archivo, el test se pone rojo.

### El test se validó mutando la migración, no leyéndola

- **Reemplazo que no reemplaza** (`replace(s, viejo, viejo)`) → **ROJO**:
  `postcondición fallida para la 0355 … (sin parchear=1, ya parcheadas=0)`.
- **Guards silenciados** (preflight y postcondición) → **ROJO**:
  `faltando la entrada de la 0356, la migración tenía que abortar entera; en
  cambio alcanzó a parchear la 0355`.
- Anotado por honestidad: silenciar **sólo** el preflight sale **verde**, porque
  la postcondición lo caza igual. Son dos guards independientes; el caso 1 del
  test es redundante con el caso 4, no inútil.

## 6. Aplicación y validación — HECHAS (2026-08-21)

### Aplicada a producción

OK del founder nombrando la migración; aplicada **de a una** con `name` =
basename exacto. Quedó como `20260821171956 ·
0388_replay_gate_platform_admins_history`.

**Medido por efecto, no por el `{"success": true}`:**

| Entrada | Antes | Después |
|---|---|---|
| `20260807192547 · 0355` | `raise exception '0355 abortado:` · 8275 car. | `raise notice '0355 abortado:` · **8272** car. |
| `20260808005744 · 0356` | `raise exception '0356 abortado:` | `raise notice '0356 abortado:` |

El largo bajó **exactamente 3 caracteres** — los que separan `exception` de
`notice`. Es la prueba aritmética de que nada más del payload se movió.

### Branch de validación — el replay llega al final

`sdd0277-verifica-replay` · `project_ref` `tmhvzeuzlfgxmpjgjdqp` · branch_id
`e9668752-7bf0-4359-bb16-67c1b16af11d`.

| Medición | Resultado |
|---|---|
| `status` | `FUNCTIONS_DEPLOYED` (pasó de largo las migraciones) |
| Entradas en el ledger del branch | **396** — el historial completo |
| Última entrada | `0388_replay_gate_platform_admins_history` |
| `platform_admins` | **0 filas** — vacía, como se predijo |
| ¿Corrió igual la 0355? | ✅ existe la policy `feature_flags_platform_admin_update` |
| ¿Corrió igual la 0356? | ✅ existe `legal_docs write by platform admin` |
| ¿Llegaron las 30 que morían? | ✅ `studio_role_module_overrides` (0357), `portal_access_links` (0360), `price_books` (0382), `telegram_alert_routes` (0386) y el CHECK con `studio.email_change` de la **0387**, que es la última |
| Tablas en `public` | 247 |

**No había un tercer punto de muerte.** Se descartó empíricamente: el replay
llegó a la 0387.

⭐ **Y la propiedad anti-split-history se probó sola, en condiciones reales.** El
replay del branch **ejecutó la 0388 sobre su propio ledger ya parcheado** —
último eslabón del historial— y pasó sin error: encontró las dos entradas en
forma `notice`, el `UPDATE` quedó no-op y la postcondición se cumplió. Eso es
exactamente lo que las 0282/0287/0288 tuvieron que arreglar a posteriori en la
familia 0271–0288. Acá no hace falta una 0389.

Estado del ledger de prod tras aplicar (396 entradas): `0355` y `0356` con
**0 sin parchear / 1 parcheada** cada una, y la fila de la propia 0388 —que
lleva los dos literales dentro— correctamente excluida por su marca.

> ⚠️ No se leyó `status = MIGRATIONS_PASSED` y se dio por bueno: se abrió el
> ledger del branch y se comprobó **el efecto de la última migración**. El campo
> de estado ya mintió una vez en este mismo problema (`preview_project_status`
> decía `ACTIVE_HEALTHY` con el replay caído).

### Teardown — los tres criterios del runbook

1. `delete_branch` devolvió éxito para `e9668752-7bf0-4359-bb16-67c1b16af11d` ✅
2. `list_branches` ya no devuelve ese `branch_id` ni `tmhvzeuzlfgxmpjgjdqp` ✅
3. La rama `main` quedó intacta ✅

```text
project_ref=tmhvzeuzlfgxmpjgjdqp
production=false
replay=success
seed=no ejecutado (falta la service_role, ver §7)
e2e=no ejecutado
database_cleanup_performed=false
teardown=terminal
```

**Nunca se aplicó SQL ad hoc a un branch** — el runbook lo prohíbe.

## 7. Lo que sigue faltando — la pieza manual (no la resuelve este SDD)

**El replay está sano, pero los 18 tests Tier 3 todavía no corrieron.** Falta un
branch nuevo (~2,5 min, ya probado que funciona) y, sobre todo, la pieza de
abajo, que sólo puede poner el founder.


El conector de Supabase sólo expone `get_publishable_keys` (anon). **No hay
herramienta que devuelva la `service_role`**, y el seed exige
`E2E_SUPABASE_SERVICE_ROLE_KEY`. El founder tiene que ponerla a mano en
`.env.local` desde el dashboard del branch, junto con el resto de las variables
que lista el runbook (`E2E_SUPABASE_PROJECT_REF`, `E2E_SUPABASE_URL`,
`E2E_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STUDIO_E2E_PASSWORD`,
`E2E_ENVIRONMENT_KIND=ephemeral`, `E2E_EPHEMERAL_PROJECT_REF`).

Y la regla de siempre: **un PAT o una service_role de un proyecto no se guarda
dentro del árbol del repo** — ni en `.env.local` de un worktree, ni en
`.mcp.json`, ni en un temporal.
