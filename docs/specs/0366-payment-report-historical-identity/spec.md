---
sdd: "0366"
title: Renombrar Shipping Mark conservando reportes sobre facturas archivadas
status: in-progress
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related: ["0134", "0258", "0364", "0365"]
confidencialidad: interno
---

# SDD-0366 — Identidad histórica de reportes de pago

> **Nota de importación — 2026-09-12.** Esta spec se importa desde la PR #21 con su contenido
> original, `status: in-progress` incluido. Su migración `0423_payment_report_historical_identity`
> está **PENDIENTE DE APLICAR** y declarada en `supabase/migrations-baseline.json`; se aplica al
> final de L14, después de 0421 y 0422, porque su preflight exige la expansión y la restricción. Es
> SQL-only: no trae código app/lib. No se importaron `docs/audits/2026-09-02-codex-release-preflight.md`
> (el enlace «Evidencia y preflight parcial» no resuelve en `main`), el checklist ni los handoffs
> `2026-09-02-*`; esa evidencia sigue en la rama de origen. Registro en
> `.agents/handoffs/c-l14-portal-comandos-recibos.md`.

## Objetivo y evidencia de origen

Corregir el bloqueo de `rename_client_markbox` cuando un cliente tiene reportes
existentes sobre facturas archivadas, conservando el expediente completo.
No permitir crear, confirmar, cancelar ni modificar un pago sobre un padre
archivado. Es una reparación de la promesa de SDD-0258, no su cierre completo.

Base: `f649bdbc`. El contrato0422 ejecutó los cuerpos reales0371/0195 y demostró
SQLSTATE23514 antes y después de la restricción: el trigger exige una factura
viva incluso cuando sólo cambia la copia del Shipping Mark. El rename entero
se revierte; no hay pérdida parcial ni efectos alojados. El mismo cambio sobre
factura viva funciona. `sdd:next` volvió a consultar15 refs:0366/0423 libres,
sin reserva ni push. El remoto y las migraciones históricas no se modifican.

## Contrato de aceptación

1. El rename autorizado de cliente vivo conserva sus reportes existentes,
   incluidos confirmados/rechazados/cancelados/soft-deleted, sobre facturas
   archivadas no-borrador. Sólo sincroniza `client_markbox` y la marca técnica
   `updated_at`: IDs, tenant, factura, snapshot fiscal, monto, moneda, método,
   fecha, estado, motivos, nota y comprobante permanecen idénticos.
2. La excepción histórica exige la misma factura/tenant/snapshot y un cliente
   vivo/no-fusionado cuyo código actual sea el nuevo. El código viejo consta
   en `client_markbox_history` de ese mismo cliente, retirado por el actor de
   sesión. Éste conserva membresía activa admin/commercial/operations del
   mismo tenant y un motivo humano de4–500 caracteres en el historial.
   Ningún GUC, `current_user=postgres` ni prefijo de texto autoriza el cambio.
3. La sincronización histórica genera `payment_report_markbox_updated` mediante
   `append_audit_event`: entidad payment_report, actor/tenant de sesión,
   source rpc, resultado succeeded, motivo, antes/después mínimos y correlación
   con el ID de historial. No incluye monto, nota, comprobante ni datos del
   pagador. Un fallo de auditoría revierte TODO el rename, incluido alias,
   cliente, facturas, reportes y eventos. No se editan recibos ni eventos previos.

## Alcance de implementación

Una migración nueva reemplaza únicamente `payment_reports_validate_invoice`.
No se toca el cuerpo0371 ni se agrega otro comando de renombrado. El camino
ordinario de validación sigue exigiendo padre vivo no-borrador y coherencia;
la excepción exige UPDATE y comparación de la fila completa excluyendo sólo
los dos campos permitidos. Una columna nueva futura queda protegida por defecto.
Se conservan ACL/RLS0422 y el trigger original; no se habilita DML a la API.

El preflight verifica dependencias, función/trigger vigentes y permisos. Drift
inesperado aborta la transacción. La función conserva SECURITY DEFINER para
validar filas bajo RLS; usa search_path vacío y nombres calificados. El motivo
de auditoría se toma del historial validado, se sella frente al GUC anterior y
se restaura después. No se agregan tablas, índices, columnas ni dependencias.

La UI existente ya pide nuevo código y dispone del campo motivo. Para este
caso histórico, un motivo vacío debe devolver un error recuperable; no se
rediseña el formulario ni se alteran los otros casos del rename. La lectura
del historial sigue por los mismos IDs, ACL y relaciones Portal actuales.

## Allowlist exacta

- `supabase/migrations/0423_payment_report_historical_identity.sql`.
- `supabase/tests/0423_payment_report_historical_identity.test.sql`.
- `supabase/tests/0423_payment_report_historical_identity_cloud.test.sql`.
- Esta spec y `docs/specs/README.md` generado con `docs:index`.
- `docs/audits/2026-09-02-codex-arranque-checklist.md`.
- `docs/audits/2026-09-02-codex-release-preflight.md`.
- `.agents/handoffs/2026-09-02-payment-report-historical-identity-close.md`.
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`.

No editar0195/0367/0371/0421/0422 ni sus tests, la UI, Storage, secretos,
configuración, producción, ramas archive o el checkout principal. Si la prueba
exige otra ruta, ampliar contrato y allowlist antes de editarla.

## Plan y verificación

- [x] Reproducción independiente en PostgreSQL sintético: rename real falla
  con23514, el caso vivo sirve de control y las escrituras financieras quedan
  rechazadas. No usar una simulación del trigger o del comando.
- [x] Preparar la migración con excepción estrecha, auditoría atómica y
  pre/postflight sin alterar datos durante su aplicación.
- [x] GREEN con casos de identidad/tenant/rol/historial/motivo, todos los
  campos financieros conservados, eventos mínimos y fallo del destino de
  auditoría. Derivas y rollback de catálogo/filas comprobados.
- [x] Ejecutar suite SQL completa, rebuild completo, advisors locales y gates
  de docs/numeración/gobernanza/componentes; revisión independiente y commit
  selectivo. No atribuir el build/Vitest anterior a este incremento SQL.
- [ ] Publicar sólo con autorización exacta y verificar CI del SHA publicado.
- [ ] Aplicar0423 sólo con GO nominal, después de0421/0422 y consumidores
  verificados; smoke autorizado de renombrado/historial y rechazo financiero.

Comandos del repo (desde el worktree propio):

```text
node scripts/run-sql-tests.mjs
node scripts/check-schema-rebuild.mjs
node scripts/build-docs-index.mjs
node scripts/build-docs-index.mjs --check
node scripts/check-numbering.mjs
node scripts/build-governance-capsule.mjs --check
node scripts/validate-component-registry.mjs
```

La prueba focal usa psql con ON_ERROR_STOP en un contenedor PostgreSQL17
exclusivo; el detalle reproducible y las salidas se registran en el handoff.
Advisors sólo con URL127.0.0.1 del contenedor propio, nunca `--linked`.
Antes de los scripts canónicos se comprueba que sus contenedores deterministas
no existan; sólo se retiran recursos propios verificados por ID/etiqueta.

## Riesgo, privacidad y autoridad

Metadato operativo del expediente financiero: conservación P3/P4, riesgo R3
acotado al cambio de identidad; sin nuevo movimiento, saldo, asiento o purga.
La confirmación existente identifica código antiguo/nuevo y consecuencia;
la validación del backend añade motivo para el caso histórico. No se afirma
que el resto de SDD-0258 ya cumpla toda la gobernanza vigente.

Inventario acotado: `payment_reports.client_markbox` identifica el expediente;
`client_markbox_history` conserva alias/actor/motivo/fecha; el evento nuevo
conserva IDs, cambio de código y motivo. Los campos financieros y paths se
leen sólo para validar igualdad y no se copian al evento. No hay nuevos
destinatarios ni datos reales. Base de licitud, retención, residencia, backups,
consentimientos y contenido sensible del motivo no se verifican localmente.
La revisión advisory de datos usará CORRECTO/ENCONTRADO/NO VERIFICABLE con
rutas y líneas; no constituye asesoría legal ni certificación.

Gate SGE-00 y AUD/MP: la matriz inferior separa la reparación SQL de las
brechas legacy de SDD-0258; no declara conforme su UI completa.
Cloud, integración, deploy, datos y limpieza conservan gates independientes.
No se reintenta el push rechazado ni se interpreta la continuidad como GO.

## Contrato de acción y matriz SGE-00

Acción interna `payment_report.sync_historical_markbox`, invocada únicamente
como parte del rename existente: sincroniza identidad, no registra un pago.
Clasificación P3/R3 del expediente y P4 de su evidencia. Roles permitidos:
admin/commercial/operations activos del mismo tenant. Precondiciones: cliente
vivo/no fusionado, factura no-borrador del mismo cliente/tenant, alias anterior
del mismo actor, motivo de 4–500 caracteres y resto de la fila inmutable.
Recuperación: corregir el requisito y reintentar el rename completo; no hay
Deshacer ni restauración financiera. Auditoría obligatoria
`payment_report_markbox_updated`, correlacionada con el ID del alias.

No nace un botón: se conserva el submit principal `Cambiar` / `Cambiando…`
del formulario existente y su navegación a la ficha nueva tras éxito. Error:
el action devuelve el mensaje del servidor sin redirigir. Referencias leídas:
`app/studio/(app)/clientes/_components/ShippingMarkChip.tsx:179` y
`app/studio/(app)/clientes/actions.ts:921`. No se usa su lectura estática como
prueba de accesibilidad, conservación del formulario o comportamiento offline.

En la matriz, `M` = `supabase/migrations/0423_payment_report_historical_identity.sql`
y `T` = `supabase/tests/0423_payment_report_historical_identity.test.sql`.
Las referencias de línea de esta matriz corresponden al correctivo original
`5797920a`; el addendum de preflight inferior documenta el incremento posterior.
`cumplimiento` equivale a `cumple` sólo en el alcance SQL especificado.

| Principio | Clasificación | Evidencia y límite |
|---|---|---|
| SGE-00.01 · Predecible | cumplimiento | M:87–98 sólo sincroniza identidad; T:537–548 rechaza altas y movimientos sobre archivo. |
| SGE-00.02 · Sin pérdida silenciosa | cumplimiento | T:404–430 prueba fallo real de auditoría en segunda fila y rollback integral; T:453–518 conserva filas, recibos, eventos y Storage. No certifica cierre del popup legacy. |
| SGE-00.03 · Riesgo/fricción | cumplimiento | P3/P4 y R3 explícitos; M:100–126 exige rol y motivo. El formulario ya muestra consecuencia y confirmación; no se añade una pantalla. |
| SGE-00.04 · Auditoría | cumplimiento | M:131–151 genera un evento mínimo por reporte; UUID nulo o error aborta toda la transacción. T:404–430 y T:453–518. |
| SGE-00.05 · Permisos/tenant/estado | cumplimiento | M:72–126 y T:296–399; membresía única, alias y cliente coherentes. ACL0422 permanece cerrada. |
| SGE-00.06 · Prevención/recuperación | cumplimiento | M:7–57 rechaza drift antes de reemplazar función; motivo inválido devuelve22023 recuperable. T:191–242 y T:357–365. |
| SGE-00.07 · Estado verdadero | cumplimiento | No captura ni oculta fallos SQL; la operación es atómica. T:404–430 fuerza excepción y retorno nulo. Espera/reconexión de la UI siguen fuera de esta prueba. |
| SGE-00.08 · Frecuencia | cumplimiento | No agrega pasos ni campos; convierte en obligatorio el motivo ya existente sólo para el expediente histórico R3. |
| SGE-00.09 · Reutilización | cumplimiento | Reusa rename0371 y append_audit_event; no crea primitiva ni endpoint ni consumidor deprecated. |
| SGE-00.10 · Accesibilidad equivalente | no aplica | No se edita interfaz ni interacción. No se certifica teclado/foco/zoom de ShippingMarkChip ni se cierra SDD-0258. |
| SGE-00.11 · Lenguaje | cumplimiento | M:88/96/122/127/145 explica estado, conservación y recuperación; action:941/978 entrega errores existentes al formulario. |
| SGE-00.12 · Autoridad humana | cumplimiento | Actor humano derivado de sesión, permiso y motivo; ninguna IA ejecuta el rename. Aplicación alojada requiere GO nominal. |

MP-01: no purga, no sobrescribe comprobantes, no reutiliza alias. AUD-01:
mutación y evento en una transacción, probados fallando el destino real.
AUD-02: evento restricted, mismas ACL y writer; no se agrega lector, export,
retención o revelación sensible. Los avisos de Advisors son del fixture/legado,
no una autorización para modificar sus policies dentro de esta spec.

## Resultado técnico local

### Compatibilidad del preflight con el cuerpo alojado de 0195

La consulta de catálogo en transacción READ ONLY encontró la función de 0195
con owner, SECURITY DEFINER, search_path y trigger esperados, pero un cuerpo
sin los comentarios y el formato del archivo local. Huellas prosrc distintas:
`89444225ab2212c58a331ea279ca0c5a` (repo, LF) y
`cb17928a9d5beea435eddf06ea2087bc` (Cloud, LF). La comparación del cuerpo
completo confirma las mismas condiciones y operaciones; no se leyeron filas.

El ajuste admite sólo esas dos huellas exactas, conservando todos los demás
guards. No normaliza SQL arbitrario ni acepta cualquier variante equivalente.
Se exige RED del preflight vigente contra el cuerpo Cloud exacto, GREEN de
ambas variantes y rechazo de derivas. El contrato de identidad, la auditoría,
las ACL y la función que se instala no cambian. No se edita la migración 0195
ya aplicada ni se ejecuta DDL alojado. Resultados nuevos en el acta de preflight.

Resultado del addendum: RED causal del guard; GREEN con323 aserciones y18
derivas por variante; wrapper sin fuga de parámetro, rollback íntegro;
165 contratos SQL y rebuild420 aprobados. Revisión independiente sin
bloqueantes. [Evidencia y preflight parcial](../../audits/2026-09-02-codex-release-preflight.md).

La evidencia original siguiente corresponde al commit `5797920a`:

- RED independiente con `apply_fix=false`:23514 causal en rename0371,
  rollback integral comprobado; no un fallo de preparación.
- GREEN: 323 aserciones, incluidas 18 derivas del preflight; cinco estados
  históricos, roles/motivos/aliases y cambios de payload rechazados.
- `fixture_only=true`:2 tenants sintéticos, sin aliases/eventos nuevos de
  rename; segunda carga rechazada porque la base dejó de estar vacía.
- Suite canónica:164 contratos SQL, exit0 y rollback total.
- Reconstrucción de esta misma migración:420 archivos (402 schema +18
  sólo-ledger),219 tablas y2 tenants sintéticos, exit0.
- Advisors CLI2.108.0 en localhost:5 WARN (4 rendimiento de policies heredadas
  y1 search_path de touch_updated_at del fixture); ninguno en el validador
  modificado. Primera conexión sin sslmode falló; la URL local con
  `sslmode=disable`, como el harness del repo, funcionó. Contenedores retirados.
- Revisión independiente de implementación y matriz de pruebas: aprobada,
  sin hallazgos bloqueantes. Evidencia de gobernanza y privacidad en esta spec
  y en `.agents/handoffs/2026-09-02-payment-report-historical-identity-close.md`.
- Docs y numeración aprobadas (358 specs / 420 migraciones); cápsula de
  gobernanza vigente (28 políticas), CMP válido (5 fuentes), diff sin errores.

Estado `in-progress` conservado: falta publicación autorizada, CI del nuevo
SHA, aplicación nominal y smoke alojado. El resultado no cierra SDD-0258.

## Fuentes y límites

- [Triggers PostgreSQL17](https://www.postgresql.org/docs/17/plpgsql-trigger.html).
- [Funciones Supabase](https://supabase.com/docs/guides/database/functions).
- [Changelog de exposición API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

Changelog consultado: no se instala ni actualiza Supabase. La numeración del
repo prevalece sobre el generador timestamp de la CLI. Esta migración no crea
una tabla o endpoint expuesto ni cambia las decisiones contables de SDD-0134.
