---
sdd: "0546"
title: "Aplicar migraciones en la base del servidor propio: scripts probados y runbook"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-10-17
updated: 2026-10-17
supersedes: null
superseded_by: null
related: ["0505", "0506", "0540", "0541", "0543"]
confidencialidad: interno
---

# SDD-0546 — Aplicar migraciones en la base del servidor propio

> Aplicar una migración en producción, que desde el 2026-10-14 es el Supabase del
> VPS, pasa a ser un procedimiento del repositorio, con scripts probados y runbook.
> Hasta ahora eran scripts sueltos de la sesión del Director. Es condición de la
> Fase 4 del plan de retiro de Vercel y Supabase Cloud.

## Pedido

Sam al Director, literal, el 2026-10-17: «arranca la tarea de las migraciones del
VPS». El Director lo encargó a un Worker con commits, push de la rama y de la
reserva, y PR en borrador contra `main`. Quedaron fuera la fusión y el contacto
con el servidor o con cualquier base.

El plan `.agents/handoffs/plan-retiro-vercel-supabase-20261016.md` (:45, :55, :92)
pone como condición de la Fase 4 «`aplicar-migraciones-prod.md` reescrito y
fusionado». Lo mismo dice `docs/runbooks/servidor-contabo.md` §4 (:880-885).

## Contexto medido (origin/main `c2fabdcc`, 2026-10-17)

- **Producción es el servidor propio** desde el corte del 2026-10-14 a las 02:00Z
  (`servidor-contabo.md:704`): proyecto compose `dtd-cargo` en `/srv/dtd-cargo`,
  base en `dtd-cargo-db-1` y ledger `supabase_migrations.schema_migrations`.
- **El runbook vigente describe Supabase Cloud**: el conector y `apply_migration`
  sobre `xpfuzqombmjmxvprjgmi` (`aplicar-migraciones-prod.md` en `c2fabdcc`,
  :3-4 y :82-100).
- **Las aplicaciones en el VPS se hicieron por excepción explícita de Sam**
  (`.agents/handoffs/0506-bitacora-adjuntos-entidad.md:149-190` para la 0473)
  con scripts de la sesión Director fuera del repo:
  - `generar-apply.cjs`: envoltorio y verificación;
  - `armar-preflight.cjs`: lectura previa con el bloque `$preflight$`;
  - `aplicar-en-vps.sh`: ssh, psql y evidencia;
  - `aplicar-lote-239.sh`: lote;
  - `retirar-espera.cjs`: baseline y declaraciones.

  Última: la 0491 (commit `2bb0c817`: ledger `20261016081616`, md5 `22c72cb6…`,
  12.175 bytes). Esta sesión leyó esos scripts como referencia y no los ejecutó.
- **Lo que ya está en el repo:**
  - `infra/ops/lib/migracion.sh`, el envoltorio de la migración y su fila del
    ledger en una transacción;
  - `infra/ops/migrate/aplicar-migracion.sh` (SDD-0540), que rechaza `dtd-cargo`
    (:85) y deja producción para «otra PR» (:28-31);
  - `infra/ops/consolidados/aplicar-lote.sh` (SDD-0543), el estilo a seguir:
    `--confirm`, SHA256SUMS, salida BEGIN … COMMIT/ROLLBACK y evidencia sin datos.
- **La puerta de la publicación automática**: `infra/ops/web/publicar-web.sh:204-236`
  no publica si falta en el ledger una migración exigida.
  `infra/ops/web/publicable.mjs:70-99` exige **todas** las que están por encima del
  corte, también las esperas.
- **La deriva existe y está documentada:**
  - `next_receipt_code` difiere solo en espacios (`.agents/handoffs/0488-carrera-cobro-factura.md:233`);
  - `comment_entity_in_tenant` perdió sus comentarios en vivo (`0506-…md:54-56`);
  - `client_delivery_addresses_validate_client` también (`0453-aplicacion-prod-20260914.md:56`);
  - `validate_operario_pin_format` tiene otra lista de PIN débiles (`docs/specs/0515-pin-operarios-endurecer/spec.md:48`).

## Alternativas

| Opción | A favor | En contra |
|---|---|---|
| A · Abrir `migrate/aplicar-migracion.sh` a producción | Un solo script | Cambia el contrato que la SDD-0540 prueba («rechaza `dtd-cargo`»). Su paquete no trae deriva ni preflight propio, y no tiene envoltorio remoto ni lote |
| **B · Carpeta `infra/ops/migraciones/`** con generador en node, ejecutor en bash y el mismo `lib/migracion.sh` | La deriva necesita leer SQL (cuerpos entre dólares, comentarios, cadenas), y eso es más seguro en node. El ejecutor del VPS queda en bash, donde no hay node. Deja intacta la SDD-0540 y comparte el envoltorio byte a byte (probado) | Dos scripts que aplican: el de prueba de la 0540 y este. Este también acepta `*-staging`, así que el ensayo puede usar el mismo paquete |
| C · `supabase migration up --db-url` (lo sugería `servidor-contabo.md:883`) | Herramienta estándar | Inferencia NO VERIFICADA contra la CLI 2.118.0: usa el prefijo del archivo como `version` y no conoce la convención de la casa (`name` = basename, `version` = hora real, `created_by`). No hace lectura previa, ni deriva, ni evidencia, y pide la URL con clave en el equipo que la corre |

**Elegida: B.**

## Diseño

### Flujo

1. `preparar.mjs`, en el checkout, desde el SHA de la cabeza de la PR, arma el
   paquete: `migracion.sql` (el blob exacto), `previa.sql`, `aplicar.sql`,
   `verificar.sql`, `IDENTIDAD.txt` y `SHA256SUMS`.
2. `aplicar-remoto.sh --paso previa`, desde el equipo del operador: comprueba en
   local, comprueba por sha256 que el servidor tenga los `aplicar.sh` y
   `migracion.sh` de este checkout, copia por scp y corre `aplicar.sh --paso previa`
   por ssh.
3. Con el OK nominal de Sam guardado en un archivo: `aplicar-remoto.sh` (paso
   `aplicar`). En el VPS, `aplicar.sh` repite la lectura previa, aplica y verifica.
4. El Director fusiona la PR con `--match-head-commit` segundos después.
5. `retirar-espera.mjs` en la rama de cierre.

### Guardas de `aplicar.sh` (ninguna toca docker)

- Proyecto de producción (`PROD_COMPOSE_PROJECT`, por defecto `dtd-cargo`) o
  `*-staging`; `--confirm` igual al proyecto.
- `--migracion` y `--md5` obligatorios; el paquete tiene que ser de esa migración
  y de ese proyecto.
- `SHA256SUMS` completo y correcto; md5 de `aplicar.sql` igual al pedido y al de
  `IDENTIDAD.txt`.
- `aplicar.sql` = `mig_envolver(migracion.sql)`: el servidor lo rehace y compara.
  `mig_revisar` sobre el blob.
- `previa.sql` y `verificar.sql` abren `begin transaction read only;`, cierran con
  `rollback;` y traen la marca de esa migración.
- `created_by` del destino: `servidor-propio:psql:SDD-NNNN` en producción y
  `…:prueba:SDD-NNNN` en prueba.
- En producción, `aplicar` exige `--autorizacion <archivo>` que **nombre el número**
  de la migración (como palabra: `09021` no nombra la `0902`).
- Un candado (`mkdir` atómico en `/run/lock`) para una aplicación a la vez.

### Lectura previa (`previa.sql`)

- Corre en `begin transaction read only`, con `lock_timeout` de 5 s y
  `statement_timeout` de 60 s.
- Mide el ledger (filas, última versión, si ya está), las sesiones que esperan
  locks y las transacciones largas.
- Frena si la migración ya está en el ledger.
- Mide la **deriva**: por cada función que la migración crea, el md5 de
  `prosrc` de cada sobrecarga viva contra los cuerpos que el repo le dio antes.
  Compara con el último cuerpo de cada firma, sin espacios y sin comentarios, y
  con los cuerpos reemplazados. Los estados y cuáles frenan están en el
  runbook §9. Frena con `raise exception` salvo `--acepta-deriva esquema.funcion`,
  que queda en `IDENTIDAD.txt`.
- Corre el bloque `do $preflight$ … $preflight$;` de la migración, tal cual.
  `preparar.mjs` se niega si su código menciona escritura (`insert`, `update`,
  `delete`, `alter`, `create`, `drop`, `grant`, `revoke`, `truncate`, `copy`,
  `nextval`…). Medido el 2026-10-17: ninguno de los $preflight$ de nivel superior
  del repo lo hace.
- Termina con `select 'PREVIA <nombre> OK'` y `rollback;`.

### Verificación (`verificar.sql`)

Solo lectura. Exige:

- una fila con ese `name`;
- el md5 y los bytes de `statements` iguales al blob;
- `md5(prosrc)` de cada función creada (el último cuerpo de cada firma que no se
  borra después) igual al del archivo.

Reporta `prosecdef`, `proconfig` y `EXECUTE` de `anon` y `authenticated`.
Termina con `VERIFICACIÓN <nombre> OK`.

### psql y evidencia

- psql: `-X -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never`. Un error
  no copia el `DETAIL`, que puede traer valores de filas.
- Evidencia en `/srv/ops/evidencias/apply-NNNN-<proyecto>-<ts>/`, o en
  `previa-NNNN-…` para la previa sola. Lleva los scripts, `IDENTIDAD.txt`,
  `AUTORIZACION.txt`, las salidas, `registro.txt` y `SHA256SUMS`.

### Códigos

- 0 listo · 2 uso · 3 guarda · 4 integridad;
- 5 la previa falló: no se aplicó nada;
- 6 el apply falló: se deshizo;
- 7 se aplicó pero la verificación no coincide;
- 255 (solo el remoto) ssh cayó durante el apply.

### Lote

`aplicar-remoto.sh` acepta varios pares `--esperada`/`--paquete`. Cada migración
va en su transacción y con su evidencia. El lote para en la primera falla y no
copia las siguientes.

### Retiro de la espera

`retirar-espera.mjs` quita la entrada de `pendingBelowCutoff` y las declaraciones
de símbolos. Se niega si el JSON no tiene el formato de
`JSON.stringify(…, null, 2)`, porque reescribirlo produciría un diff de todo el
archivo. También lista las pruebas que nombran la migración junto con
`pendingBelowCutoff`. A diferencia del script del Director, no exige
`--sin-declaracion`: casi ninguna espera tiene declaración (hoy `degradations: []`)
y la salida dice cuántas quitó.

### Límites conocidos

- **Deriva por nombre, no por firma.** La clave de argumentos es aproximada (sin
  defaults ni nombres de tipo normalizados): dos versiones de una firma escritas
  distinto cuentan como dos y se aceptan las dos. Un `drop function` borra lo
  conocido de todas las sobrecargas de ese nombre.
- **SQL dinámico.** No se miran las funciones creadas dentro de `execute` o de
  cadenas entre dólares, como las de las migraciones de reparación del ledger
  0271-0288. Tampoco los preflights con otra etiqueta que `$preflight$`.
- **`igual sin comentarios` no frena.** Es lo que dejaba Cloud y no cambia el
  comportamiento. El preflight propio de la migración puede exigir el md5 exacto.
- **Lo que la verificación mira y lo que no.** Mira el ledger y los cuerpos de
  funciones. Tablas, policies y grants los cubre el postflight de la migración,
  si lo trae.
- **No hay simulacro con `rollback` en producción.** Tomaría los mismos locks y
  correría el DML. El ensayo es en prueba (SDD-0540).
- **Los `NOTICE` de la migración van a la evidencia tal cual.** Quien la escribe
  no imprime datos personales en ellos.

## Decisiones para Sam

1. **Autorización nominal por archivo.** `aplicar.sh` se niega en producción si el
   archivo con el OK literal no nombra el número de cada migración. Recomendado:
   sí, porque es la regla de siempre, ahora comprobada por el script.
2. **`igual sin comentarios` no frena.** Recomendado: sí. Si frenara, casi toda
   función de la era Cloud pediría una aceptación a mano, y un gate ruidoso se
   ignora.
3. **Instalar en el VPS** `aplicar.sh` y `lib/migracion.sh` desde `main` después
   del merge (escritura en `/srv/ops`, sesión de Contabo o Director). Hace falta
   antes del primer uso.

## Fuera de alcance

- Conectarse al VPS o a una base, instalar los scripts y aplicar o leer nada.
- Fusionar.
- Cambiar `infra/ops/migrate/aplicar-migracion.sh` más allá de su texto de
  referencia, o la puerta de `publicar-web.sh`.
- Los runbooks de despliegues viejos que nombran `apply_migration`
  (`deploy-kommo-writeback.md`, `deploy-orden-venta-0072.md`, `deploy-kommo-push-client.md`)
  y las revisiones de `docs/governance/reviews/`: son registros fechados de
  aplicaciones a Cloud y no se reescriben. El runbook los clasifica como
  históricos.

## Gobernanza

Las políticas del registro son de UI y de la app; este cambio no toca pantallas
ni mutaciones: **no aplica**. Datos personales: los scripts leen solo el ledger y
el catálogo, y la evidencia no lleva filas. psql corre con `VERBOSITY terse`. No
hay captura, movimiento ni borrado de datos personales: `revisar-datos-ve`
**no aplica**.

## Aceptación

1. [x] `infra/ops/tests/prueba-migraciones-produccion.sh` con dobles: 63 PASÓ y
   0 FALLÓ.
2. [x] `--mutantes`: el control rojo cae contra scripts vacíos (44 FALLÓ) y
   mueren los 30 mutantes (0 vivos).
3. [x] `infra/ops/tests/migraciones.test.mjs` en Vitest, 27 de 27:
   - paridad byte a byte con `lib/migracion.sh`;
   - lectura previa, deriva, apply y verificación contra PGlite;
   - cuerpo extraído = `prosrc` en 123 funciones reales de 0400 en adelante;
   - md5 y bytes de la 0491 iguales a los del ledger de producción.

   Mueren los 11 mutantes del SQL generado (0 vivos), con el original restaurado
   en 27 de 27.
4. [x] `docs/runbooks/aplicar-migraciones-prod.md` reescrito para el servidor
   propio, con Cloud como histórico. Las referencias normativas al flujo viejo
   están actualizadas.
5. [x] `pnpm docs:check`, `pnpm sdd:check` y `git diff --check`; `pnpm verify` en
   el handoff.
6. [ ] Revisión del Director y merge, con el OK de Sam.
7. [ ] Instalación en el VPS (decisión 3) y primera aplicación real con este
   procedimiento, registrada en la SDD de esa migración.

## Allowlist de archivos

Nuevos:

- `infra/ops/migraciones/preparar.mjs`
- `infra/ops/migraciones/aplicar.sh`
- `infra/ops/migraciones/aplicar-remoto.sh`
- `infra/ops/migraciones/retirar-espera.mjs`
- `infra/ops/tests/prueba-migraciones-produccion.sh`
- `infra/ops/tests/migraciones.test.mjs`
- `docs/specs/0546-migraciones-servidor-propio/spec.md`
- `.agents/handoffs/0546-migraciones-servidor-propio.md`

Modificados:

- `docs/runbooks/aplicar-migraciones-prod.md`: reescrito.
- `docs/engineering/project-rules.md`: la viñeta de escrituras y una nota en el
  MCP de Supabase.
- `docs/runbooks/servidor-contabo.md` §4: la condición de la Fase 4.
- `docs/runbooks/entorno-prueba.md` §4: la línea sobre producción.
- `infra/ops/migrate/aplicar-migracion.sh`: solo el comentario y el mensaje que
  remiten a producción.
- `infra/ops/README.md`: la fila de `migraciones/`.
- `docs/specs/README.md`: el índice regenerado.

## Seguimiento

| Fecha | Qué | Evidencia |
|---|---|---|
| 2026-10-17 | Reserva y primera implementación del Worker; PR en borrador | handoff `0546-migraciones-servidor-propio.md` |
