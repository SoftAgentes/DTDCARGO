---
sdd: "0448"
title: "Replay del estado final de 0222/0223 en calculator_settings"
status: in-progress
author: "Codex"
created: 2026-09-09
updated: 2026-09-09
supersedes: null
superseded_by: null
related: ["0055", "0440"]
confidencialidad: interno
---

# SDD-0448 — Replay del estado final de 0222/0223 en calculator_settings

> Una migración idempotente que materializa en el ledger el estado que 0222 y
> 0223 dejaron en Producción fuera de banda, para que el schema se pueda
> reconstruir desde cero sin SQL ad hoc.

## Problema

`0222` y `0223` se aplicaron fuera de banda: Producción tiene su efecto, pero
ninguna fila del ledger las representa. Un branch o una reconstrucción creados
desde el repositorio conservan `calculator_settings.peso_max_kg` y nunca crean
`peso_max_envio_kg`, así que el entorno reconstruido diverge del contrato que el
producto declara vigente. `lib/public/rates-queries.ts` ya lee la columna nueva
con fallback, y los lectores de Studio la seleccionan directamente.

### Por qué esta spec existe y no basta SDD-0440

La migración nació dentro del esfuerzo de SDD-0440 y su cabecera todavía cita ese
número, pero **SDD-0440 se declara ajena al artefacto**:

- su sección de seguridad afirma literalmente que «no introduce una migración»;
- su allowlist exacta no incluye ni el `.sql` ni el `.test.sql`;
- pone «aplicar migraciones o modificar Supabase Producción» fuera de alcance;
- remite la migración a la unidad #29 («su migración/test y handoffs se revisan
  en la unidad #29»).

Además SDD-0440 viaja en la PR #28, que va **después** de la #29 en el orden de
integración acordado. Si #29 integrara primero sin esta spec, `main` quedaría con
una migración de producción y sin ninguna especificación que la cubra — el mismo
vacío documental que el repositorio cerró con la regla de allowlist exacta.

SDD-0448 es, por tanto, la spec normativa del artefacto. SDD-0440 queda como
contexto de origen y como consumidor: su preflight de seed exige
`peso_max_envio_kg`.

## Decisión

- La convergencia se logra con **DDL idempotente**, no con `UPDATE` de datos: en
  Producción no cambia valores; en un replay completa lo que el ledger no puede
  reconstruir. La reaplicación conserva los valores configurados.
- **Preflight que aborta antes de tocar nada**: falta de tablas, constraint
  homónimo que no sea `CHECK`, `peso_max_envio_kg` con tipo distinto de
  `numeric`, o filas con valor no positivo.
- **CHECK reconstruido de forma determinista.** Un nombre conocido no demuestra
  la expresión ni el estado validado: se retira sólo el constraint con el nombre
  canónico y se vuelve a crear como `peso_max_envio_kg > 0`, validando las filas
  existentes. Elimina el falso verde de `CHECK(true)` y de `NOT VALID`.
- **Postflight que exige el estado final**: `peso_max_kg` ausente,
  `peso_max_envio_kg` `numeric NOT NULL`, RPC existente, CHECK validado y
  `PUBLIC` sin `EXECUTE`.
- La RPC pública se retira antes de tocar la columna (su firma histórica depende
  de `peso_max_kg`) y se recrea con la firma de diez escalares, `STABLE`,
  `SECURITY DEFINER` y `search_path` fijo, con una ACL **más restrictiva** que la
  original: `revoke all ... from public` y `grant execute` sólo a `anon` y
  `authenticated`.

### Transacción única: mecanismo, no comentario

El archivo **no abre transacción propia**, igual que las otras 398 migraciones
del repositorio. El requisito de ejecutarlo en una sola transacción vive en la
entrada de `pendingBelowCutoff` de
[`supabase/migrations-baseline.json`](../../../supabase/migrations-baseline.json):
`scripts/check-migrations-applied.mjs` imprime esa entrada completa en cada
corrida del gate, y el operador está obligado a tocarla para poder aplicar la
migración. Deja de ser un comentario dentro del `.sql` y pasa a ser un registro
versionado que el gate publica y que el runbook obliga a leer.

Se evaluó la alternativa de envolver el archivo en `begin;`/`commit;` explícitos
y **se descartó con medición**. El contrato de `supabase/tests/` aplica el
artefacto real cinco veces dentro de una única transacción propia; un `commit`
dentro del archivo confirma esa transacción externa, destruye la tabla temporal
`constraint_probe` (`on commit drop`) antes de que las sondas la usen y convierte
el `rollback` final del fixture en una operación vacía. Medido el 2026-09-09
sobre `postgres:17`:

| Forma del artefacto | Resultado del contrato 0448 |
|---|---|
| Sin transacción propia (convención vigente) | psql exit 0; `replay_0223_fixture_rolled_back = t` |
| Con `begin;`/`commit;` dentro del archivo | `WARNING: there is already a transaction in progress`; `ERROR: relation "constraint_probe" does not exist`; psql exit 3; fixture confirmado en la base compartida del runner |

Adoptar la transacción explícita exigiría reescribir la estructura del contrato
que una revisión independiente reprodujo en rojo y en verde, es decir, debilitar
las aserciones que protegen el artefacto. Los dos ejecutores automáticos ya
aportan la transacción: `scripts/check-schema-rebuild.mjs` aplica cada migración
con `psql --single-transaction` («igual que Supabase», según su propia cabecera)
y `scripts/run-sql-tests.mjs` la ejecuta dentro de la transacción del contrato.
El riesgo residual es exclusivamente la aplicación manual en autocommit, y ése es
justamente el momento en que el operador lee la entrada del registro.

## Seguridad y datos

La RPC devuelve diez escalares de configuración: sin `tenant_id`, sin PII y con
filtro `tenant.slug = 'dtd'`. No captura, mueve ni borra datos personales. No se
leyeron filas de negocio ni credenciales de Producción para esta unidad.

`DROP FUNCTION` es `RESTRICT`: una vista dependiente aborta la migración en vez
de arrastrarla.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 | cumplimiento | Preflight y postflight abortan con mensaje propio; el contrato prueba rechazo real de negativo, cero y nulo, y que el CHECK queda validado. No hay verde sin protección. |
| MP-01 | excepción | La migración retira `peso_max_kg` **sin migrar valores y sin guarda previa**, a diferencia de `peso_max_envio_kg`, que sí tiene preflight de tipo y de valor no positivo. Se acepta porque en Producción la columna ya no existe (0222/0223 fuera de banda) y en un replay sólo contiene el default histórico. Queda declarada como condición de release, y sin rollback SQL demostrado. |
| Advisors Supabase 0028/0029 | excepción | Declarada por el propio artefacto en las líneas 114–115 del `.sql`: `public_calculator_config()` es la API anónima de la calculadora pública y devuelve sólo diez escalares, sin `tenant_id` ni PII. La auditoría [2026-07-31](../../audits/2026-07-31-seguridad-full-project.md) ya clasificó como deliberadas las `public_*` de la calculadora. La excepción se estrecha respecto del estado histórico: 0223 dejaba `PUBLIC` con `EXECUTE` por el default de creación y 0448 lo revoca, dejando sólo `anon` y `authenticated`. Vencimiento: revisar si la calculadora deja de ser anónima. |
| AUD-01 | no aplica | No agrega ni cambia eventos auditables de negocio. |
| AUD-02 | no aplica | No cambia consulta, conservación, exportación ni acceso a auditoría. |
| NUM-01, FRM-01, ERR-01, A11Y-01 | no aplica | La unidad no tiene superficie de UI. |

## Allowlist exacta

- `supabase/migrations/0448_restore_calculator_settings_0223_history.sql`
- `supabase/tests/0448_restore_calculator_settings_0223_history.test.sql`
- `supabase/migrations-baseline.json`
- `docs/specs/0448-replay-0223-calculator-settings/spec.md`
- `docs/specs/README.md` (generado)
- `.agents/handoffs/2026-09-05-restore-0223-history-close.md`
- `.agents/handoffs/pr29-replay-validation-20260906.md`
- `.agents/handoffs/pr29-publication-review-20260907.md`
- `.agents/handoffs/pr29-blockers-20260909.md`

## Criterios de aceptación

- [x] El replay desde un fixture anterior a 0222/0223 retira `peso_max_kg` y crea
      `peso_max_envio_kg numeric NOT NULL DEFAULT 9000`.
- [x] Una segunda aplicación conserva el valor configurado (7777) y no lo pisa.
- [x] El CHECK canónico queda **validado** y rechaza negativo, cero y nulo, tanto
      partiendo de `CHECK(true)` como de `NOT VALID`, y tras reaplicar.
- [x] Un constraint homónimo que no sea `CHECK` aborta el preflight sin retirar
      PK, UNIQUE ni FK.
- [x] `public_calculator_config()` conserva la firma de diez escalares, `STABLE`,
      `SECURITY DEFINER` y `search_path=public`, y se invoca realmente como `anon`.
- [x] `PUBLIC` queda sin `EXECUTE`; `anon` y `authenticated` conservan el suyo.
- [x] El contrato SQL completo pasa: 140/140 en `postgres:17` desechable.
- [x] La reconstrucción del schema desde cero pasa con el archivo incluido.
- [x] Numeración sin colisión: `0448` libre en refs, PRs y worktrees.
- [x] La migración está registrada como pendiente de release con motivo, requisito
      de transacción única y quién la destraba.
- [ ] Aplicación nominal a Producción con autorización explícita de Sam. **No
      pertenece a esta PR**: se cierra por el runbook, después de integrar.

### Evidencia del contrato SQL

Reproducida el 2026-09-09 en este árbol, sobre artefactos byte-idénticos a los
que revisó la sesión independiente:

- `supabase/migrations/0448_restore_calculator_settings_0223_history.sql` →
  SHA-256 `146d82978778894db6362af3ac49e385bba56282e0ac3ddc4b2c3e23c3941ae8`.
- `supabase/tests/0448_restore_calculator_settings_0223_history.test.sql` →
  SHA-256 `dce9471f282fb811af26d1ad761bf3ab9179045c82aaf064927e8cf4b246e38a`.

El contrato es rojo sobre el SQL anterior a `1e31b9a3` (`homonimo_debil:
negative=false, zero=false` y `not_valid: validated=false`) y verde sobre el
actual, sin cambiar sus expectativas.

## Condiciones de release

Ninguna de estas condiciones se satisface integrando la PR: todas son previas a
aplicar `0448` a una base real, y viven también en la entrada de
`pendingBelowCutoff`.

1. **Transacción única obligatoria.** Ejecutar el archivo completo de una sola
   vez, por ejemplo `psql --single-transaction -v ON_ERROR_STOP=1 -f <archivo>`.
   En autocommit, un fallo tardío —el `SET NOT NULL` de la línea 66 es el caso
   medido— deja la RPC anónima de la calculadora pública **eliminada** y la
   columna vieja **ya destruida**, sin vuelta atrás. Nunca por el SQL Editor en
   autocommit ni por fragmentos sueltos.
2. **`peso_max_kg` se borra sin migrar valores y sin guarda previa.** No hay
   preflight que la proteja, a diferencia de su columna hermana. Si el entorno de
   destino conserva un valor propio ahí, se pierde: `peso_max_envio_kg` nace con
   el default 9000. Verificar el contenido antes de aplicar.
3. **La RPC se borra y se recrea: pierde propietario y permisos personalizados.**
   El owner pasa a ser el ejecutor y los `GRANT` añadidos a mano desaparecen
   (medido: `probe_owner` → `postgres`; `probe_consumer` sin su grant).
   Inventariar owner, ACL, comentario y dependencias antes, y reponerlos después
   si aplica.
4. **El CHECK se reconstruye siempre.** Una expresión personalizada que reutilice
   el nombre `calculator_settings_peso_max_envio_kg_check` se sustituye por
   `peso_max_envio_kg > 0` sin aviso. Inventariar personalizaciones antes.
5. **Locks y ventana.** Los `ALTER TABLE` toman locks; planificar la ventana y
   comprobar las postcondiciones al terminar.
6. **Sin rollback SQL genérico.** Revertir archivos no recupera el contenido de
   `peso_max_kg`. Una incidencia exige forward fix, no reversión.
7. **Autorización nominal.** El runbook exige OK explícito de Sam nombrando
   `0448_restore_calculator_settings_0223_history`. Fusionar la PR y aplicar a
   Producción son autorizaciones distintas.
8. **Al aplicarla, sacarla de `pendingBelowCutoff`.** No subir `cutoff` para
   taparla.

## Fuera de alcance

- aplicar `0448` a Producción, a un branch o a cualquier otra base;
- fusionar la PR #29 o la #28;
- reescribir, renumerar o reinterpretar `0222` y `0223`;
- cambiar precios, límites o comportamiento de la calculadora;
- llevar el contrato SQL a CI (propuesta registrada en el handoff, sin implementar).

## Estado

Artefacto y contrato completos y verificados localmente. Una revisión
independiente levantó un Postgres desechable, reprodujo rojo y verde y confirmó
la idempotencia con cinco aplicaciones seguidas. Los checks alojados de la PR
**no** cubren esta migración: el flujo de CI no corre contratos SQL ni
reconstrucción de schema, y sin Docker la suite local degrada a omitido.

Pendiente: integración autorizada de la PR #29 y, por separado, autorización
nominal para aplicar la migración conforme al
[runbook](../../runbooks/aplicar-migraciones-prod.md).
