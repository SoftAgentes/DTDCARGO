---
sdd: "0561"
title: "Candado de las migraciones aplicadas: una migración en producción no se edita sin que falle una prueba"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-10-19
updated: 2026-10-19
supersedes: null
superseded_by: null
related: ["0118", "0238", "0541", "0546"]
confidencialidad: interno
---

# SDD-0561 — Candado de las migraciones aplicadas

> Desde esta SDD, `supabase/migrations.lock.json` fija la identidad del **archivo del
> repo** (sha256, md5 y bytes) de cada migración aplicada en producción. Si alguien
> edita, borra o renombra una, cae una prueba del harness que corre en el CI y en
> `pnpm verify`. Una migración nueva entra al candado cuando se aplica. Un cambio
> aceptado queda registrado como excepción con su motivo y su autorización; no se tapa
> en silencio. El ledger de producción guarda ese mismo texto solo en las entradas
> marcadas con `ledger`: 143 de 483 según el cruce del 2026-10-19 (§ Cruce con el ledger).

## Pedido

Sam, literal, el 2026-10-19: «trata de avanzar todos los pendientes… todas las tareas
que puedas avanzar». El Director se lo encargó a un Worker. Autorizó commits, el push
de la rama y de la reserva, y una PR en borrador. Quedaron fuera la fusión, producción,
el servidor y la edición de migraciones existentes.

El problema es el hallazgo **MIG-05** de la auditoría de Contabilidad
(`docs/audits/2026-10-18-contabilidad-anexo-hallazgos.md:1927-1931`): «Nada impide
editar una migración ya aplicada: el md5 solo está fijado en 5 archivos».

## Contexto medido (origin/main `3f3a52cc`, 2026-10-19)

- `supabase/migrations/` tiene **485** archivos `.sql`, todos con nombres de la forma
  `^[0-9]{4}[a-z]?_[a-z0-9_]+$`. Hay números repetidos (0057, 0058, 0243, 0247, 0277,
  0297, 0336, 0342, 0362, 0363, 0394), sufijos con letra (0020b, 0124b, 0261b) y
  huecos. La mayor es la 0491. `check-numbering.mjs` los da como choques históricos
  que no se renumeran.
- `migrations-baseline.json`: el corte es 238 y `pendingBelowCutoff` tiene **dos**
  esperas, `0422_payment_report_command_boundary` y
  `0423_payment_report_historical_identity`, sin aplicar.
- **Qué fijaba la identidad hasta hoy.** Solo unas pruebas sueltas tenían el md5 del
  archivo: la 0421 (`lib/portal/__tests__/payment-report-paid-invoice.migration.test.ts:147`),
  la 0475 (`lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts:432`), la 0491
  (`infra/ops/tests/migraciones.test.mjs`, el blob) y la 0473 y la 0474. No había ningún
  script ni workflow que detectara un cambio en un `.sql` ya aplicado.
- **Las puertas comparan nombres.** `infra/ops/web/publicar-web.sh` (`puerta_migraciones`,
  SDD-0541) lee `select name from supabase_migrations.schema_migrations` y compara
  nombres. `scripts/check-migrations-applied.mjs` hace lo mismo.
- **Las LEDGER_ONLY.** Hay 18 migraciones que solo reparan el ledger
  (`scripts/check-schema-rebuild.mjs`, `LEDGER_ONLY`): de la 0271 a la 0288, menos la
  0277, y la 0388. `.gitattributes` las guarda con `-text` porque sus bytes, CRLF
  incluido, forman parte del md5 anclado contra producción.
- **Fin de línea.** `supabase/migrations/*.sql -text`: git no convierte los saltos en
  ninguna dirección. Los bytes del archivo en disco son los del blob, también en
  Windows. Por eso el candado puede leer el disco sin consultar git.
- **El CI** (`.github/workflows/quality.yml`) hace un checkout superficial y no trae
  `origin/main`. Corre `pnpm test` y `pnpm harness:test`.

## Decisión

### El candado

`supabase/migrations.lock.json`, con el formato exacto de `JSON.stringify(…, null, 2)`
y salto final:

```json
{
  "$doc": ["…"],
  "schemaVersion": 1,
  "selladas": {
    "0001_init_tenancy": { "sha256": "…", "md5": "…", "bytes": 3147 },
    "0491_freight_carriers_auditoria": {
      "sha256": "…", "md5": "…", "bytes": 12175,
      "ledger": { "fecha": "2026-10-19", "forma": "exacta" }
    }
  }
}
```

- La clave es el basename exacto, sin `.sql`. Es el mismo `name` que usa el ledger
  desde la 0239.
- El **sha256**, el **md5** y los **bytes** son los del **archivo del repo**. El md5 y
  los bytes se calculan igual que en `preparar.mjs` y `aplicar.sh` (SDD-0546). Que
  coincidan con la fila del ledger (`md5(array_to_string(statements, ''))` y su
  largo) es cierto **solo** en las entradas con `ledger`. En la era de Supabase Cloud
  el ledger guardó otro texto (partido, sin comentarios) o registró la migración con
  otro nombre (§ Cruce con el ledger). Sin `ledger`, la entrada igual sirve: fija el
  archivo del repo tal como estaba en main.
- `ledger` (opcional) = `{ fecha, forma }`: en esa fecha se comprobó que la fila del
  ledger de producción con ese nombre es el archivo sellado. La `forma` es `exacta`
  (md5 y bytes iguales) o una de las dos convenciones de Cloud que el runbook §7 manda
  probar: `sin-salto-final` o `con-crlf-final`. No se guarda ningún md5 del ledger. Es
  un campo aparte y no cambia la identidad sellada.
- La identidad de la raíz de cada entrada es la **sellada** y no se reescribe nunca.

### Qué conjunto entra hoy: 483 migraciones

Entran **todas las del repo hasta la 0491, menos las dos esperas**. Son 483 de 485.

| Grupo | Cuántas | Por qué entran o no |
|---|---|---|
| Número mayor a 238 y fuera de las esperas | 250 | La puerta de la publicación exige **cada una** en el ledger con su nombre exacto. El 2026-10-16 solo faltaban la 0422 y la 0423, y desde entonces se aceptaron a mano (MIG-08: `publicar-web.sh:303-334`). El Director contó **495 filas** en el ledger el 2026-10-18. Su cruce del 2026-10-19 lo confirma: **las 250 tienen fila con su nombre exacto**, y ni la 0422 ni la 0423 aparecen en el ledger |
| Número hasta 238 | 233 | El baseline las da por reconciliadas: «todo lo histórico YA está en prod», verificado por objeto. Algunas tienen otro `name` en el ledger y ~13 se aplicaron fuera de banda. Igual se congelan: editar una cambia lo que el repo dice de la base y lo que reconstruye `schema-rebuild` |
| LEDGER_ONLY (dentro de las anteriores) | 18 | Están aplicadas, porque su fila del ledger es su efecto. Se congelan igual que las demás, sin trato aparte. Sus bytes, CRLF incluido, ya los fija `.gitattributes`; el candado lo hace verificable |
| Esperas: 0422 y 0423 | 2 | **No entran.** No están aplicadas y todavía pueden corregirse antes del apply, por ejemplo en el preflight. Quedan marcadas aparte: la verificación las informa como «espera declarada» y entran al candado al aplicarse (§ Ciclo) |

La auditoría recomendaba sellar desde la 0239. El corte de 238 separa nombres libres
de nombres exactos en el **ledger**, no archivos que se puedan editar. Sellar también
las históricas no cuesta nada y cierra el mismo agujero.

### Cruce con el ledger (2026-10-19, medido por el Director)

El candado congela los archivos **tal como estaban en main el 2026-10-19**. El mismo
día **el Director** leyó el ledger de producción en `READ ONLY`, con la consulta de
solo catálogo del handoff: `name`, `md5(array_to_string(statements,''))` y su
`octet_length`, sin filas de negocio. Esta sesión no se conectó; trabajó sobre su
archivo, que queda fuera del repo. Hay 428 filas con nombre `NNNN_`.

| Resultado | Cuántas | Qué es |
|---|---|---|
| Coinciden exactas (md5 y bytes) | 95 | Se aplicaron guardando el archivo entero, de la `0026_welcome_email_template_seed` a la `0491_freight_carriers_auditoria`. Marcadas `ledger: exacta` |
| Coinciden sin el salto final | 28 | La fila es el archivo sin su `\n` final, la convención de Cloud que cita el runbook §7 (la 0471 entre ellas). Marcadas `sin-salto-final` |
| Coinciden con un CRLF agregado al final | 20 | La fila es el archivo seguido de `\r\n`. Marcadas `con-crlf-final` |
| Distintas | 277 | La era Cloud guardó en `statements` otro texto, partido o sin comentarios. Según el Director no es deriva del repo: es formato del ledger. Una, la `0211_revoke_authenticated_rpc_sweep`, tiene `statements` nulo. La `0351_operario_rpc_exige_rol` difiere en 1 byte y no corresponde a ninguna de las dos variantes |
| Selladas sin fila con ese nombre | 63 | Todas ≤ 0238, por ejemplo `0001_init_tenancy`, `0002_shipments` y `0008_warehouses_cn`. El ledger viejo las registró con otros nombres o versiones |
| Filas del ledger sin archivo en el repo | 8 | Ver § Fuera de alcance |

El Director informó 95 coincidencias y 325 distintas. Las variantes de fin de texto
las calculó el Worker sobre ese archivo, aplicando la regla del runbook §7 («calcula
las dos variantes antes de declarar una diferencia»). De las 49 que difieren en ±3 bytes, 48
son el mismo archivo. Total marcadas: **143**, con `node scripts/migrations-lock.mjs
ledger <filas.json> --fecha 2026-10-19`. La marca no cambió ninguna identidad
sellada: la verificación contra `HEAD` (`HISTORIA`) y el ancla siguen en verde.

### La verificación

`scripts/migrations-lock.mjs` (sin argumentos o con `verificar`) devuelve código 1 si
encuentra alguno de estos errores:

| Error | Cuándo |
|---|---|
| `FORMATO` | El texto no es el canónico, las claves no están ordenadas, falta un campo o está mal formado, hay claves desconocidas o una excepción incompleta |
| `FALTA` | Una migración sellada no existe: se **borró o se renombró** |
| `CAMBIADA` | Su archivo no tiene la identidad sellada ni la de su última excepción. Cambiar un solo byte basta, también un CRLF por LF |
| `ESPERA` | Está sellada y además figura en `pendingBelowCutoff` |
| `SIN_SELLO` | Un archivo sin sellar que no es espera, con número menor o igual al de la mayor sellada. Es una migración nueva con número viejo: el corte de 238 y la puerta de la publicación no la verían nunca. Un renombre produce `FALTA` y `SIN_SELLO` |
| `HISTORIA` | Comparado con el candado del punto de partida (el merge-base de HEAD con `origin/main`), una identidad sellada cambió o desapareció, o una excepción se borró o se reescribió |

Además informa, sin fallar, las esperas y las migraciones nuevas sin sellar (número
mayor al de la mayor sellada). Una PR con una migración nueva sigue verde.

**La historia sin git.** El CI no tiene `origin/main`, así que ahí `HISTORIA` dice «no
comparada». Para que el conjunto inicial no dependa de eso, la prueba trae un **ancla**:
el sha256 de las líneas `nombre sha256 md5 bytes` de las 483 entradas creadas hoy
(`10d5eb20…`) y su cantidad. Borrar una entrada de ese conjunto o reescribir su sello
cambia el ancla y la prueba falla también en el CI. Las excepciones y los sellos
nuevos no la tocan. El ancla no se actualiza para conseguir verde.

### Dónde corre

`scripts/tests/migrations-lock.node.mjs` es una prueba del harness (`node:test`).
`run-harness.mjs` la descubre sola. Corre en el paso «Harness Director Worker» del CI
(`pnpm harness:test`) y en el paso `harness` de `pnpm verify`. **No se agrega ningún
paso nuevo** a `verify` ni al workflow.

### Ciclo de vida

1. **Migración nueva.** La PR la trae con su espera en `pendingBelowCutoff`, como ya
   pide el runbook. La verificación la informa como espera.
2. **Aplicación.** Pasa por SDD-0546, sin cambios.
3. **Cierre.** `infra/ops/migraciones/retirar-espera.mjs <NNNN_nombre> --md5 <md5 del
   ledger>` retira la espera y **sella** la migración. Antes de escribir comprueba que el
   md5 del archivo sea el aplicado: el `blob_md5` de `IDENTIDAD.txt` en la evidencia,
   que la verificación del apply comparó con el ledger. Si no coincide, sale con 3 y
   **no escribe nada**. Así se cierra la ventana entre el merge y el cierre: lo que se
   sella es lo que corrió. Por eso la entrada nace con `ledger: { fecha, forma:
   "exacta" }`: el servidor propio guarda el archivo entero (runbook §7).
4. **Sin espera que retirar.** `node scripts/migrations-lock.mjs sellar <NNNN_nombre>
   --md5 <md5>`. Se niega si todavía es espera, si ya está sellada o si el md5 no
   coincide. También marca `ledger` exacta.
5. **Una medición nueva del ledger.** `node scripts/migrations-lock.mjs ledger
   <filas.json> --fecha AAAA-MM-DD`. Toma el volcado `[{ name, md5, bytes }]` de la
   consulta de solo lectura, que queda fuera del repo. Marca las exactas y las dos
   variantes, informa distintas, sin fila y solo en ledger, y no copia ningún md5. Se
   niega si el volcado contradice una marca anterior (sin fila o distinta), si repite
   un nombre o si una fila está mal formada. Las variantes se calculan solo si el
   archivo sigue siendo el sellado (sin excepciones vigentes).
6. **Excepción.** Sirve, por ejemplo, para un comentario corregido con decisión
   explícita: `node scripts/migrations-lock.mjs excepcion <nombre> --motivo "…"
   --autorizacion "…" [--fecha AAAA-MM-DD]`. Agrega a la entrada un registro con fecha,
   motivo, autorización (quién lo aceptó y dónde) y la identidad nueva. La raíz
   conserva la identidad sellada; si la entrada tiene `ledger`, esa sigue siendo la de
   su fila del ledger. Las excepciones solo se agregan y quedan en el diff de la PR.
   **No** habilitan editar migraciones: §8 del runbook lo sigue prohibiendo. Registran
   una salida autorizada.
7. **`crear --hasta NNNN`** se usó una sola vez, en esta SDD. Si el candado existe se
   niega: no hay comando para regenerarlo entero.

### Alternativas descartadas

- **Que la puerta del servidor compare los md5.** Habría que cambiar
  `publicar-web.sh`, que corre en el VPS, e instalarlo allí. Queda como propuesta
  (§ Fuera de alcance).
- **Una prueba de Vitest.** Las pruebas del harness son las de los scripts del repo,
  no dependen de jsdom y permiten mutantes con TAP.
- **Driver de merge para el candado.** Dos cierres en paralelo chocan al final del
  objeto `selladas`. Los cierres ya los serializa el Director. El conflicto se resuelve
  tomando el candado de main y volviendo a correr `sellar`. Agregarlo al driver
  `dtd-generated-records` cambiaría una política de la ADR 0002.
- **Una guarda en `preparar.mjs` para migraciones ya selladas.** Sería redundante: la
  lectura previa ya se niega si la migración está en el ledger.

## Criterios de aceptación

| # | Criterio | Estado |
|---|---|---|
| 1 | Existe `supabase/migrations.lock.json` con las 483 migraciones decididas, generado por el script desde main `3f3a52cc` | Cumplido |
| 2 | Una prueba falla si cambia, se borra o se renombra una migración sellada | Cumplido. Control rojo en disco y en memoria |
| 3 | Las esperas no se sellan y quedan marcadas aparte; una sellada no puede volver a ser espera | Cumplido |
| 4 | Una migración nueva entra al candado al aplicarse, con el md5 aplicado comprobado (`retirar-espera.mjs`) | Cumplido |
| 5 | Las excepciones son explícitas, con motivo y autorización, solo se agregan y conservan la identidad sellada | Cumplido |
| 6 | El runbook de aplicar migraciones describe el sello y la excepción | Cumplido |
| 7 | Mutantes del verificador: todos mueren | Cumplido: 62 de 62 |
| 8 | El candado se compara contra el ledger de producción | Cumplido el 2026-10-19: lectura `READ ONLY` del Director. 143 de 483 coinciden (95 exactas y 48 con una variante de fin de texto) y quedan marcadas `ledger`; 277 distintas por el formato de Cloud; 63 sin fila. Detalle en § Cruce con el ledger |

## Evidencia

- `node --test scripts/tests/migrations-lock.node.mjs`: **22/22** en verde.
- `vitest run infra/ops/tests/migraciones.test.mjs -t retirar-espera`: 7/7.
- **Control rojo en disco.** Se cambió un byte de
  `0464_reporte_pago_factura_pagada.sql` (sha256 `42792803…` → `6915d99b…`, los mismos
  22.209 bytes). La prueba cayó (2 rojas, exit 1) y la CLI dio `[FALLÓ] CAMBIADA
  0464_reporte_pago_factura_pagada` con exit 1. El archivo se restauró con `git
  checkout` y volvió a `42792803…`.
- **Mutantes** (corredor fuera del repo, TAP): 58 del verificador y 4 de
  `retirar-espera.mjs`; los 62 mueren. Ninguno muere por error de carga: el que más
  pruebas tumba deja 15 de 22 en rojo. Uno sobrevivió en la primera vuelta (las
  variantes calculadas sobre un archivo cambiado). La fixture no lo distinguía; se
  corrigió con una fila igual a una variante del archivo cambiado.
- **Cruce con el ledger**: § Cruce con el ledger. Antes de la medición, 55 de los 483
  md5 sellados ya aparecían en handoffs, specs, pruebas o commits del repo, y ninguna
  mención los contradecía.

## Pendientes

Ninguno de esta SDD para fusionar. Quedan para investigar, sin bloquear el candado:
la `0351_operario_rpc_exige_rol`, que difiere del ledger en 1 byte sin corresponder a
ninguna variante, y la `0211_revoke_authenticated_rpc_sweep`, con `statements` nulo.

## Fuera de alcance

- Las **8 filas del ledger sin archivo en el repo**, todas históricas (≤ 0110):
  `0006b_clients_seed_align`, `0020_operario_pins_fix_search_path`,
  `0020b_grant_service_role_for_pwa`, `0020c_operario_receipt_inline_correlative`,
  `0020e_operario_receipt_drop_and_recreate`, `0042_bug_replays_storage_bucket`,
  `0059b_fix_public_track_rpc_ambiguous` y `0110_financiero_china`. El repo tiene otros
  archivos con esos números (`0006_clients`, `0020_operario_pins`,
  `0020b_operario_pins_post_apply_fixes`, `0042_feature_flags`,
  `0059_public_track_rpc`, `0110_calculator_settings_container_limits`). Hay que
  investigar si fueron aplicaciones fuera de banda o si les falta el archivo.

- Que `publicar-web.sh` compare también el md5 del ledger con el candado. Hoy compara
  solo nombres.
- Traer al CI el commit base de la PR, para que `HISTORIA` también compare allí.
- MIG-03 (cabeceras engañosas): con el candado, corregirlas exige una excepción por
  archivo. La decisión es de Sam y del Director.
