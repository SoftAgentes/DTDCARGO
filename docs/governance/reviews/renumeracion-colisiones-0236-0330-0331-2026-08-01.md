# REV-SGE-049 · Renumeración de colisiones e integración de 0330 y 0331

| Control | Valor |
|---|---|
| Fecha | 2026-08-01 |
| Base Git | `origin/main@03aae813` |
| Rama | `feat/sdd-0236-transportistas` |
| Specs | SDD-0236 (ex-0231) · Motor F0 |
| Proyecto | `xpfuzqombmjmxvprjgmi` |
| Resultado | Dos colisiones resueltas · dos migraciones aplicadas · merge a `main` |

## Alcance de la renumeración

El barrido de colisiones sobre **todas** las ramas (locales y remotas) devolvió
cuatro de spec y once de migración. La mayoría **no son colisiones accionables**:

| Caso | Veredicto |
|---|---|
| SDD-0172 asistente nueva compra | Ya en `main` como **0173**; rama 286 commits atrás, con un commit "SOLO-PREVIEW". No se toca. |
| SDD-0184 audit-retention | Ya en `main` como **0186**; rama 164 atrás. No se toca. |
| SDD-0068 registro-correos-aviso | Ya en `main` como **0161**; ramas 519 y 553 atrás. No se toca. |
| Migraciones 0020, 0057, 0058, 0124, 0243, 0247, 0261, 0268, 0277, 0297 | Históricas y **aplicadas en Producción bajo ambos nombres**. Renombrar un archivo que ya está en el ledger rompería `migrations-applied`. No se tocan. |

Sólo dos eran colisiones vivas sobre trabajo sin integrar.

### 1. SDD-0231 duplicada

`0231-transportistas-y-tarifario` chocaba con `0231-almacen-ve-entrega-manual-gobernada`
(ya en `main`, migración 0321). Ambas specs se crearon el 2026-08-01 con **27
segundos de diferencia**, en ventanas que no se veían.

Renumerada a **SDD-0236** y migración **0330**. Se actualizaron front-matter,
título, cabecera de la migración, cabecera de la prueba contractual, comentarios
de tablas y funciones, y las referencias en `lib/studio/freight-carriers/`,
`carrier-actions.ts` y `TransportistasPanel.tsx`. Cero referencias a `0231` o
`0315` sobreviven en el conjunto renumerado.

### 2. Migración 0254 duplicada

`0254_seed_received_ve_rule` (Motor F0, rama de 446 commits atrás) chocaba con
`0254_fix_public_ocean_rate_casing`, **ya aplicada en Producción**. Renumerada a
**0331**.

Se verificó que **no estaba superada**: `main` ya dispara `received_ve` (fan-out
de SDD-0156 desde `warehouse-receipt-ve-queries.ts`), pero antes de esta
migración las reglas default en Producción eran `consolidated`, `eta_set` y cinco
`status:*` — ninguna `received_ve`. Ese fan-out era un no-op silencioso.

Los números se eligieron verificando **todas las ramas**, no sólo `origin/main`:
0325–0329 están tomadas por `codex/audit-hardening-20260801` y 0316 por
`codex/governance-final-100`.

## Orden de despliegue: migración ANTES que código

Ambas se aplicaron **antes** del merge, por decisión explícita y por la lección
de REV-SGE-048:

- **0330** — `app/studio/(app)/admin/page.tsx` llama `listFreightCarriers` y
  `listAllTariffs` al renderizar. Sin las tablas, `/studio/admin` falla al
  cargar.
- **0331** — el commit **retira** el mail `shipment_arrived`. Sin la regla
  sembrada, el arribo a Venezuela habría quedado sin ningún aviso al cliente. El
  modo de falla es peor que el de 0317–0324: no lanza error, **se calla**.

## Migraciones aplicadas

| Migración | SHA-256 del archivo |
|---|---|
| `0330_freight_carriers_tariffs` | `B8D8F6C2ED9D1348902AF902F33CFD56F6EDA08B6F5034908095B85D0EA76CE1` |
| `0331_seed_received_ve_rule` | `E4FF6118AF8D0E9CC9FA378A12DD6AF2317EA91A4A4ED9910D63CC12AD751557` |

## Postflight metadata-only

**0330** — RLS activa en `freight_carriers` y `carrier_tariffs`; ocho policies;
cuatro índices (incluidos los dos únicos parciales: un predeterminado por tenant
y una tarifa viva por ciudad); el FK compuesto
`carrier_tariffs_carrier_same_tenant` garantiza que una tarifa no pueda apuntar a
un transportista de otro tenant. `public_carrier_tariffs(uuid)` es ejecutable por
`anon`, y **`anon` no tiene SELECT sobre ninguna de las dos tablas**: el costo,
el nombre del transportista y su RIF quedan fuera del alcance público. Esa es la
propiedad de seguridad de la migración y tiene prueba contractual.

**0331** — una regla default `received_ve` por tenant, con
`email / event / offset 0 / visible_in_portal / activa`. Idempotente por el
índice parcial `client_notif_rules_default_uniq`.

`node scripts/check-migrations-applied.mjs`: **321 archivos · 330 en el ledger ·
OK**, con 0017 y 0257 como esperas declaradas.

## Gates ejecutados sobre la rama

`docs:check`, `typecheck`, `lint`, Vitest (**372 archivos, 4484 pruebas**),
`schema-rebuild` (**321 migraciones, 304 aplicadas desde cero, 17 sólo-ledger,
aislamiento multi-tenant sobre 219 tablas y dos tenants reales**),
`governance:check` (27 políticas) y `components:check` (CMP-01) — todos verdes.
El contrato SQL nuevo `0330_freight_carriers_tariffs.test.sql` pasa.

## Los siete contratos en rojo: RESUELTO — era el working tree, no el repo

Durante este trabajo `node scripts/run-sql-tests.mjs` dejaba **siete contratos en
rojo** (`0261_audit_entity_catalog_validate` y `0271`–`0276`, reparaciones de
ledger de SDD-0118) con errores `SDD-0118 … drift` / `postcondición falló`. Se
registró primero como no conformidad de `main`. **Ese registro era incorrecto y
queda anulado por esta sección.**

**El repo siempre estuvo bien. El working tree de la máquina estaba viejo.**

Diagnóstico, medido:

1. El fixture del test siembra `supabase_migrations.schema_migrations` con el
   texto histórico embebido; la migración valida su `md5`. Un byte distinto y
   hay drift.
2. Con el archivo **en disco**, el fixture de `0271` producía
   `0e781225e7f3a2201530f45d385bc74f`. La migración esperaba
   `e087ed48b2838aca3d1ba061ed7a6ab6`.
3. Con el **blob de git** del mismo archivo, el fixture produce
   `e087ed48b2838aca3d1ba061ed7a6ab6` — **coincide**.
4. Producción confirma que la migración es la correcta: la fila
   `20260526213130 seed_team_invitation_template` tiene `statements[2]` con
   `md5 = e087ed48b2838aca3d1ba061ed7a6ab6`, sin CR, 1854 bytes.
5. Causa: el blob de `0271_repair_branch_replay_history.test.sql` tiene **0 CR**
   y el archivo en disco tenía **258**. Sobrevivía de antes del `-text` que
   introdujo `0bdc23bd` (30-jul), que además sólo restauró 0281, 0287 y 0288 —
   los demás nunca se re-extrajeron. **190 archivos** de
   `supabase/{migrations,tests}` estaban así.
6. `git status` los daba **limpios** (caché de stat), de modo que nada delataba
   la desincronización.

Reparación — sin tocar código ni Producción:

```bash
rm -f supabase/migrations/*.sql supabase/tests/*.sql
git checkout -- supabase/migrations/ supabase/tests/
```

Resultado: 0 archivos desincronizados y **59/59 contratos verdes, rollback
total**.

Esto también explica la supuesta discrepancia con REV-SGE-046: su "58/58 verde"
era correcto — corrió sobre un checkout fresco. No hubo evidencia falsa.

⭐ **Lección, hermana de la de REV-SGE-048.** Aquel gate se callaba porque medía
un checkout atrasado; éste gritaba porque medía un working tree desincronizado.
En los dos casos la herramienta no estaba mirando el repo. Ante un rojo de
`sql-tests` en migraciones históricas que nadie tocó, **antes de dudar del
contrato, comprobá que el disco coincide con el blob.**

## Retiro de las ramas fuente

Con el trabajo ya integrado y renumerado en `main`, las dos ramas de origen sólo
aportaban ruido: cualquier barrido futuro de colisiones volvería a reportar
SDD-0231 y la migración 0254, con riesgo de que otra sesión intentara mergearlas
de nuevo. Se retiran con autorización del founder, tras verificar archivo por
archivo que su contenido está en `main` bajo la numeración nueva.

**SHA de reconstrucción — con esto se recuperan enteras si hiciera falta:**

| Rama retirada | SHA del commit | Dónde vive ahora su contenido |
|---|---|---|
| `feat/sdd-0231-transportistas` | `167c6eee2c56d89f3333f69457680ae6764f4c7d` | SDD-0236 · migración `0330` |
| `feat/motor-f0-arribo` | `eea0947bff2556f2f13158e8d548aa8c26749e1b` | migración `0331` |

Reconstrucción: `git branch <nombre> <sha>`. Los objetos siguen en el repositorio
mientras no corra un `gc` agresivo; el contenido equivalente está en `main` en
todo caso.

El worktree `DTD-worktrees/sdd-0225-registro`, que tenía tomada
`feat/sdd-0231-transportistas`, se dejó en su sitio con `HEAD` desacoplado — no
se eliminó ninguna carpeta de trabajo del founder.
