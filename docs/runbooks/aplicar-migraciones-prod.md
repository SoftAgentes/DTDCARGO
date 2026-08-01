# Aplicar migraciones a prod · procedimiento y trampas

Cómo se aplica una migración de `supabase/migrations/` a la base real
(`xpfuzqombmjmxvprjgmi`), y por qué el gate ahora te grita si te la saltás.

> ⚠️ **Nunca es automático.** Aplicar una migración exige **OK explícito del
> founder NOMBRANDO la migración**. Un "ok" suelto, un "dale" o un "avanza" **no
> alcanzan** — y está bien que no alcancen: es la última barrera antes de tocar
> datos de clientes.

## Por qué existe este runbook

Dos veces se perdió una migración, y las dos veces por el mismo mecanismo: el
conocimiento vivía en un handoff que nadie releyó.

- **La 0228** (`suppliers_cn_extended_fields`) estuvo **dos rondas /GOLD**
  perdida. Su cabecera decía "esperando decisión del founder", el archivo llegó a
  `main`, nadie la aplicó, y la ronda siguiente construyó el scorecard (0236)
  encima. Reventó sola, tarde, con `column s.industry does not exist` — un error
  que no explicaba nada. El ledger de prod saltaba de 0227 a 0229 y nadie lo
  miraba.
- **La 0169** (`public_verify_throttle`) cayó en la MISMA trampa, con la MISMA
  frase en la cabecera ("NO aplicar a prod, lo hace la coordinación / founder"), y
  siguió perdida aun después de que la ronda 3 declarara "pila de migraciones en
  CERO". Mientras faltó, `isVerifyThrottled`
  ([lib/public/verify-throttle.ts](../../lib/public/verify-throttle.ts)) —que es
  **fail-open**— dejó `/verificar` sin throttle anti-enumeración, con códigos
  secuenciales y `student_name` (PII) expuesto. **Aplicada el 2026-07-16**; la
  consecuencia está cerrada.

Moraleja: **una nota en un handoff no es un mecanismo.** Por eso ahora hay un
paso del gate que lo verifica en cada corrida.

### La tercera vez fue distinta: el gate midió el árbol equivocado

El 2026-08-01 las **0317–0324** llegaron a `main` —y con ellas el código que
llama sus RPCs— sin que ninguna estuviera en prod. Ocho Server Actions del Studio
(Aduana, Reclamos, TMS, Almacén VE, Naviera, Inspecciones, Despacho, Financiero
China) quedaron reventando con `PGRST202`.

Acá el mecanismo **no** falló por silencio: nadie las metió en
`pendingBelowCutoff`, y el acta del cierre dejó escrito que "0317–0324 todavía no
existen en el ledger productivo". Falló por **dónde se mide**: el check lee
`supabase/migrations/` **del checkout**, y un árbol atrasado respecto de
`origin/main` no tiene esos archivos en disco → el gate sale verde **por
omisión**.

**Regla:** sincronizá con `origin/main` antes de leer el verde de
`migrations-applied`. Un verde sobre un árbol viejo no dice nada.

## El gate lo vigila: paso `migrations-applied`

`node scripts/verify.mjs` corre
[`scripts/check-migrations-applied.mjs`](../../scripts/check-migrations-applied.mjs),
que consulta el ledger real de prod y grita si un archivo del repo no está
aplicado.

- **Degrada, no rompe**: sin credenciales, sin red, o sin la RPC 0239 aplicada →
  **SKIP**, nunca rojo (mismo criterio que el paso e2e). En un worktree sin
  `.env.local` no corre — mismo pitfall conocido del e2e.
- Lee el ledger vía la RPC `applied_migration_names()` (migr **0239**). No usa la
  CLI de Supabase ni `DATABASE_URL` a propósito: la CLI exige un **PAT**, y
  guardar un PAT en el árbol del proyecto está **prohibido** (ver `AGENTS.md`).

### Cuando el gate sale rojo

```
[FAIL] 1 migración(es) NUEVA(s) en el repo que NO están en prod:
   🔴 0240_lo_que_sea
```

Tres salidas posibles, en este orden:

1. **Hay que aplicarla** → pedile el OK al founder nombrando la migración, y
   aplicala **de a UNA** (ver abajo).
2. **No se debe aplicar todavía** → agregala a `pendingBelowCutoff` en
   [`supabase/migrations-baseline.json`](../../supabase/migrations-baseline.json)
   **con el motivo y quién lo destraba**. Eso es lo que faltó con la 0228 y la
   0169: la espera existía, pero solo en la cabeza de alguien.
3. **Ya se aplicó una tanda** → subí `cutoff` al número más alto aplicado.

## Cómo aplicar (de a UNA, nunca en bundle)

**El MCP `supabase` local es read-only** — reconfirmado varias veces; intentar
`apply_migration` devuelve `Cannot apply migration in read-only mode`. Sirve para
leer y verificar, no para escribir.

> ⚠️ **Observado el 2026-07-30 (SDD-0191 Slice A):** el MCP de Supabase
> disponible en esa sesión **sí escribió** — `apply_migration` con
> `project_id: xpfuzqombmjmxvprjgmi` devolvió `{"success": true}` y la 0297
> quedó en el ledger. O la config de `read_only` cambió, o esa sesión estaba
> hablando con el conector de claude.ai y no con el local. **No asumas cuál
> tenés**: probá el sondeo del objeto primero (paso 1) y, si `apply_migration`
> funciona, ya sabés que no es read-only. Lo que NO cambia es la barrera de
> arriba: el OK del founder nombrando la migración.

**El conector `claude.ai Supabase` NO es read-only**: `apply_migration` con
`project_id: xpfuzqombmjmxvprjgmi` funciona. Requiere OK explícito del founder
nombrando la migración (un "ok" suelto no pasa el clasificador de permisos, y
está bien que no pase).

> **De a una, jamás en bundle.** Así se cazó la 0228: la 0236 falló sola y el
> error señaló la dependencia faltante. Un bundle atómico de las 5 habría
> rebotado TODO con un error que no explicaba nada.

**Aplicala con el basename EXACTO del archivo como `name`.** Es la regla hacia
adelante y es lo que el check espera (`0240_lo_que_sea.sql` → name
`0240_lo_que_sea`). Ver abajo por qué importa.

## Trampas verificadas (no las re-descubras)

### El `name` del ledger es TEXTO LIBRE — no es identidad

Lo tipea quien aplica, y en 233 migraciones históricas divergió de mil formas:

| Archivo en el repo | `name` en prod |
|---|---|
| `0001_init_tenancy.sql` | `init_tenancy` |
| `0067_warehouse_receipts_ve.sql` | `warehouse_receipts_ve_sprint_e` |
| `0106_conversaciones.sql` | `sdd0056_conversaciones_fase1` |
| `0085_portal_invoices_rls.sql` | *(ninguno — aplicada fuera de banda)* |

Medido el 2026-07-16: **168** coinciden con el basename, **44** viven bajo otro
nombre, y **~13** se aplicaron fuera de banda (su efecto está en prod pero no
dejaron fila propia). Por eso el check usa una **línea de corte** en vez de un
cruce 1:1: reconciliar el pasado son 62 casos de ruido, y **un gate ruidoso se
ignora** — que es exactamente cómo murió la 0228.

### Verificá contra el OBJETO, no contra el nombre

Para saber si una migración está aplicada de verdad, sondeá lo que crea:

```sql
select to_regclass('public.mi_tabla') is not null as aplicada;
-- columnas:
select exists(select 1 from information_schema.columns
              where table_schema='public' and table_name='t' and column_name='c');
-- policies:
select exists(select 1 from pg_policies where policyname='mi policy');
```

Cuidado con las sondas flojas: `create or replace function` compartida entre dos
migraciones no distingue cuál corrió, y un `add column` no está en la tabla que
sugiere el nombre del archivo (la 0068 dice "pod" pero toca `dispatch_pods`, no
`warehouse_receipts_ve`).

### Los huecos de numeración en disco son NORMALES

Faltan `0061-0065`, `0089`, `0099`, `0111`, `0112` y está bien: son números que
nunca se usaron. **El check NO busca huecos en disco** — el hueco de la 0228 no
estaba en disco, estaba en prod. No "arregles" esto.

### `service_role` no llega al ledger

`supabase_migrations` no le da USAGE a `service_role` (verificado:
`has_schema_privilege` → false) y PostgREST solo expone `public`. De ahí la RPC
`applied_migration_names()` (migr 0239): security definer, solo lectura, solo
service_role, sin devolver `statements`/`rollback` (son el SQL crudo).

### Otras, de rondas anteriores

- **Un backfill puede ser peor que ninguno.** El de la 0238 escribía una fecha
  inventada e indistinguible de una real, y se pisaba a sí mismo
  (`referrals_touch` fuerza `updated_at = now()`). Sin él: fail-closed y
  reversible.
- **Verificá los TIPOS contra prod, no contra el fixture.** `issued_at` es `date`
  ("2026-07-01"); `accredited_at` es `timestamptz` ("…T00:00:00+00:00"). Compararlos
  como strings da `true` donde esperabas `false`.
- **Calificá las extensiones** (`extensions.gen_random_*`) y poné `search_path` en
  toda función security definer.
- **Revoke explícito en toda RPC nueva** (regla que dejaron las migr 0209-0211).

## Estado al 2026-07-16 (cierre de la ronda /GOLD 4)

- Ledger de prod: **245 filas** (244 nombres únicos — hay un duplicado histórico,
  `fix_studio_accept_invitation_ambiguous`, aplicado dos veces).
- `cutoff` del baseline: **238**, y **ahí se queda** (ver el baseline: subirlo solo
  relajaría la vigilancia).
- ✅ **`0169_public_verify_throttle` APLICADA** con OK del founder. Verificado
  contra prod: tabla + índice + RLS activa sin policies + `anon`/`authenticated`
  sin SELECT + `service_role` con INSERT. `/verificar` ya tiene su throttle.
- ✅ **`0239_applied_migrations_rpc` APLICADA**. Verificado: security definer, owner
  `postgres`, `search_path` sellado en vacío, `stable`, `anon`/`authenticated` sin
  EXECUTE. **El paso del gate está VIVO** (dejó de ser SKIP).
- ⏸ **`0017_no_olvidar`** — única espera declarada. SDD-0025 gated por review
  criptográfico externo; correcto que no esté. Su código es inerte: el `page.tsx`
  es un `EmptyState` "Próximamente" que no toca la DB.

**Barrido de la clase de bug (16-jul):** se cruzó todo el código contra prod —
205 tablas de `.from()` y 75 RPCs de `.rpc()`. Fuera de `no_olvidar_*` (gated), no
falta nada. De los 8 throttles, 7 usan `portal_registro_throttle` (existe); el
único roto era el de la 0169. ⚠️ Ojo con el método: un grep de `.from("literal")`
**no habría encontrado la 0169** — los throttles usan `.from(CONSTANTE)`. Hay que
resolver las constantes y las RPCs, o el barrido da un falso "todo limpio".
