---
sdd: "0640"
title: "Revisar lote: la persona de operaciones revisa y aprueba cada consolidado en el Studio antes de cargarlo"
status: proposed
author: "Claude (Worker del Subdirector Portal) + Sam"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0016", "0085", "0101", "0267", "0491", "0543", "0622"]
confidencialidad: interno
---

# SDD-0640 — Revisar lote: revisión y aprobación de un consolidado en el Studio

> Antes de cargar un contenedor con el flujo de la SDD-0543, una persona de la oficina con permiso abre
> un enlace directo del Studio, revisa el consolidado (contenedores y, por cliente, sus remitentes, cajas,
> kg, CBM y notas), marca cada línea como «bien» o «corregir», contesta las preguntas abiertas y lo
> aprueba con su usuario. La aprobación queda auditada y la carga en producción la exige.

**Estado:** `proposed`. Decisiones de Sam resueltas el 2026-11-16 (§12.1). Etapa 1: **solo especificación y maqueta.** No hay código de producto, migraciones
ni cambios en producción. La implementación es otra tarea, que ordena el DG.

**Maqueta navegable** (archivo autocontenido, con datos inventados): `maqueta/revisar-lote.html`.

## 1. Pedido

- **2026-11-16.** Sam pidió que la persona de operaciones revise cada consolidado y lo apruebe antes de
  cargarlo. Para el contenedor 64 se usó una hoja HTML local, fuera del repo, con estas partes: contenedores,
  clientes del lote con filtros (todas, sin revisar, para corregir, con nota), preguntas abiertas,
  aprobación, una barra de progreso y un botón «copiar respuestas».
- Sam aprobó («Sí, así») construir la versión dentro del Studio, con enlace directo, como parte del
  proceso repetible por contenedor.

Esta spec convierte esa hoja en una pantalla del Studio y conecta su aprobación con la carga.

## 2. Contexto (lo que ya existe)

| Pieza | Dónde | Qué aporta |
|---|---|---|
| Generador del lote | `scripts/consolidados/` (SDD-0543) | Lee el packing list y el rastreo; agrupa por cliente (`Cliente`) y por Remitente (`Embarque`); produce `previa/simulacro/aplicar/verificar.sql`, `manifiesto.json`, `resumen.md` y `SHA256SUMS`. Sus `avisos[]` ya detectan filas sin Remitente, Remitentes corregidos, Remitentes sin número de embarque, embarques sin peso o sin CBM y precios mezclados. |
| Id del lote | `carga-consolidado:<N>:<sha8 del packing>` | Fija el packing exacto. Un OK para un lote no vale para otro. |
| Carga | `infra/ops/consolidados/aplicar-lote.sh` | Pasos de a uno, con evidencia. En producción exige `AUTORIZACION.txt` con el OK literal de Sam y el id completo del lote. |
| Runbook | `docs/runbooks/cargar-consolidados.md` | §1 generar, §2 prueba, §2b producción. |
| Contenedor | `consolidations` + `consolidation_items` + `sailings` | Lo que la carga crea; el Portal lo muestra (SDD-0101). |
| Huérfanos | `warehouse_receipts_cn` con `SIN-CODIGO-0640` (SDD-0016, SDD-0491) | La recepción sin Shipping Mark. En el lote, el equivalente es un paquete cuya marca no resuelve a un cliente. |
| Permisos | `lib/studio/rbac.ts` (SDD-0085), accesos por persona (SDD-0622, migr 0538) | `naviera` lo ven `operations` y `accounting`; `admin` todo; `support` solo lectura. |
| Auditoría | `append_audit_event` (migr 0267), `entity_audit_log` append-only | Evento por acción, sin borrar. |

**Lo que falta.** Hoy no hay manera de que alguien de la oficina revise el lote dentro del sistema ni de
que la carga sepa si alguien lo revisó. La hoja local del 64 no deja rastro, se copia por chat y no está
atada al id del lote: si el Excel cambia, la revisión vieja parece válida.

## 3. Alcance

**Dentro**

- Pantalla «Revisar lote» del Studio, con un enlace directo por lote.
- Un lote de revisión en estado propio, con sus líneas, preguntas, veredictos y aprobación.
- Subida del archivo de revisión que produce el generador (opción B de §4).
- Auditoría de cada veredicto, respuesta, aprobación y devolución.
- El cambio en `aplicar-lote.sh` y en el runbook para que la carga en producción exija la aprobación.
- Tratamiento de datos personales (§9).

**Fuera**

- Leer el Excel dentro del Studio (la «pantalla de importación» que la SDD-0543 dejó para una segunda fase).
- Montos: flete, base de factura y exceso de peso no se muestran en esta pantalla (decisión 3).
- Avisos a clientes. La revisión no dispara nada hacia el Portal.
- Cambiar el lote desde la pantalla. «Corregir» devuelve el lote; quien regenera es el DG con el generador.
- Lotes de prueba (`--entorno prueba`): pueden subirse para ensayar, pero la exigencia de aprobación aplica a
  producción (decisión 6).

## 4. De dónde salen los datos del lote

La revisión tiene que ocurrir **antes** de aplicar, o sea antes de que existan el contenedor y los envíos en
la base. Hoy el lote vive solo en la PC del DG.

| Opción | Cómo funciona | A favor | En contra |
|---|---|---|---|
| **A. Lote «borrador» en las tablas reales** | `aplicar.sql` crea el contenedor, los envíos y las facturas con un estado nuevo `borrador_revision`; la aprobación los pasa al estado normal. | Se revisa exactamente lo que se cargó. | Toca `consolidations`, `shipments`, `invoices` y todos sus lectores: el Portal, Tracking y Facturación tendrían que ignorar el estado nuevo. Un error filtra al cliente envíos no aprobados. Rompe la idempotencia y el preflight de la SDD-0543. |
| **B. Archivo de revisión subido (recomendada)** | El generador emite, junto al lote, `revision.json`: contenedores, clientes, líneas por Remitente con cajas, kg, CBM y notas, y las preguntas abiertas. **Sin SQL y sin montos.** El DG lo sube al Studio; queda en tablas propias de revisión, atado al id del lote y a la huella de `manifiesto.json`. | No toca las tablas de negocio; el Portal no puede ver nada; reutiliza el generador; la huella ata la aprobación a un lote exacto. | El archivo se sube a mano. Hay que mantener el formato de `revision.json` en el generador. |
| **C. Generar en el Studio** | El Studio lee el Excel y arma el lote. | Sin pasos manuales. | Mueve el generador entero al servidor, con los Excel y los nombres; es la segunda fase de la SDD-0543 y mucho más grande. |

**Recomendación: B** (decisión 1). El archivo de revisión es un derivado del mismo `agruparLote` que produce el
SQL, así que lo revisado y lo cargado salen del mismo cálculo. La huella SHA-256 de `manifiesto.json` se guarda
con la revisión, y la carga la compara (§7).

### 4.1 Formato de `revision.json` (propuesta)

```jsonc
{
  "formato": "revision-lote/1",
  "lote": "carga-consolidado:64:<sha8>",
  "manifiestoSha256": "<64 hex>",
  "entorno": "produccion",
  "modalidad": "ddp",
  "contenedores": [
    { "numero": 64, "etiqueta": "DTD#64", "contenedor": "<ISO 6346>", "precinto": "…", "naviera": "…",
      "puertoLlegada": "…", "fechaCarga": "2026-…", "etd": "2026-…", "eta": "2026-…" }
  ],
  "totales": { "clientes": 0, "embarques": 0, "cajas": 0, "pesoKg": 0, "cbm": 0 },
  "clientes": [
    { "clave": "DTD-…", "resuelve": true, "clienteId": "<uuid o null>",
      "etiqueta": "<nombre del cliente si resuelve; el del Excel si no>",
      "lineas": [
        { "ref": "<Remitente>", "filasExcel": [12, 13], "cajas": 0, "pesoKg": 0, "cbm": 0,
          "descripcion": "…", "notas": ["sin_identificar" | "falta_codigo_aliado" | "solo_prefijo" |
          "remitente_corregido" | "sin_peso" | "sin_cbm" | "precio_mezclado" | "precio_cero"] }
      ] }
  ],
  "preguntas": [ { "id": "p1", "origen": "generador", "texto": "…", "lineas": ["<ref>"] } ]
}
```

- `resuelve` y `clienteId` salen de la previa de producción (la que ya se corre con OK de Sam). Sin previa, el
  generador deja `resuelve: null` y la pantalla muestra «sin comprobar».
- Las notas son códigos, no frases: la pantalla las traduce («Sin identificar», «Falta el código del aliado»,
  «Solo el prefijo»…). Así el archivo no lleva texto libre del Excel salvo la descripción y la etiqueta.
- Las preguntas del generador salen de los avisos que no tienen un código de nota (por ejemplo, «el total del
  Excel no cuadra») y de los clientes sin resolver. El DG puede agregar preguntas en la pantalla.
- Cambiar este formato es trabajo de `scripts/consolidados/`, que hoy tiene abierta la PR #559 (F2). Esa parte
  va en la fase 1, después de que la #559 se fusione (§11).

## 5. Modelo de datos y auditoría (fase 1; aquí solo se especifica)

Tres tablas nuevas, con `tenant_id` y RLS por tenant como el resto del Studio:

**`consolidation_reviews`** (una fila por lote subido)

| Columna | Tipo | Regla |
|---|---|---|
| `id` | uuid | pk |
| `tenant_id` | uuid | RLS |
| `lote_id` | text | `carga-consolidado:<N>:<sha8>`; único por tenant entre las vivas |
| `contenedor_numero` | int | para el enlace y la lista |
| `entorno` | text | `produccion` o `prueba` |
| `manifiesto_sha256` | text | 64 hex; lo compara la carga |
| `estado` | text | `en_revision` → `devuelto` / `aprobado` → `cargado`; `reemplazado` si sube una versión nueva |
| `contenido` | jsonb | el `revision.json` validado; lleva etiquetas de clientes (§9) |
| `subido_por`, `subido_en` | uuid, timestamptz | quien sube (rol `admin`) |
| `aprobado_por`, `aprobado_en`, `nota_aprobacion` | uuid, timestamptz, text | se llenan una sola vez |
| `devuelto_por`, `devuelto_en` | uuid, timestamptz | al devolver para corregir |
| `cargado_en` | timestamptz | lo marca la carga después de `verificar` PASÓ |
| `reemplaza_a` | uuid | la revisión anterior del mismo contenedor |
| `contenido_purgado_en` | timestamptz | retención (§9) |

**`consolidation_review_lines`** (una por Remitente)

`id`, `review_id`, `ref` (Remitente), `cliente_clave`, `orden`, `cajas`, `peso_kg`, `cbm`, `notas text[]`,
`veredicto` (`null` | `bien` | `corregir`), `comentario` (texto, obligatorio con `corregir`), `decidido_por`,
`decidido_en`.

**`consolidation_review_questions`**

`id`, `review_id`, `origen` (`generador` | `oficina`), `texto`, `lineas text[]`, `respuesta`, `respondido_por`,
`respondido_en`.

**Reglas que hace cumplir la base, no la pantalla**

1. Escritura solo por funciones `security definer` con `set search_path`, que comprueban rol y tenant:
   `subir_revision_lote`, `marcar_linea_revision`, `responder_pregunta_revision`, `aprobar_revision_lote`,
   `devolver_revision_lote`, `marcar_revision_cargada`. Sin `insert/update` directos para `authenticated`.
2. `aprobar_revision_lote(review_id, manifiesto_sha256_esperado, nota)` exige: estado `en_revision`; todas las
   líneas con veredicto; ninguna en `corregir`; todas las preguntas respondidas; huella igual a la guardada;
   permiso de aprobar (§6). Si algo falta, devuelve el conteo de lo que falta, no un error genérico.
3. Una revisión `aprobado`, `cargado` o `reemplazado` es inmutable: un trigger rechaza cambios en sus líneas y
   preguntas.
4. Subir un lote del mismo contenedor con otro id pone la anterior en `reemplazado`. Los veredictos se copian
   por `ref` solo si la línea no cambió (mismas cajas, kg y CBM); las que cambiaron vuelven a «sin revisar».
5. Aprobar no es lo mismo que cargar. `cargado` lo marca solo la carga (§7).

**Auditoría.** Cada función llama a `append_audit_event` con `p_correlation_id = lote_id`, acción
(`revision_lote.subir`, `.marcar_linea`, `.responder`, `.aprobar`, `.devolver`, `.cargar`), actor = usuario del
Studio, y en el payload **solo** ids, `ref`, veredicto, conteos y huella. **Nunca** el comentario, la respuesta ni
etiquetas de clientes: el log es append-only y no se puede purgar (lección del §Datos personales de la SDD-0543).
El texto libre vive en las tablas de revisión, que sí tienen retención.

La pantalla muestra el historial de la revisión (quién marcó qué y cuándo) leyendo esos eventos.

## 6. Permiso (RBAC)

- **Ruta:** submódulo de Naviera & Consolidación, `/studio/naviera/lotes` (lista) y
  `/studio/naviera/lotes/<contenedor>-<sha8>` (enlace directo). Hereda el gate de vista de `naviera`
  (`operations`, `accounting`, `admin`; `support` solo lectura). No se crea un módulo nuevo en `modules.ts`.
- **Marcar líneas y responder:** quien pueda **editar** `naviera` (`canEditModule`): `operations`, `accounting`,
  `admin`. `support` ve sin editar.
- **Aprobar y devolver:** acción nueva `naviera.lote.aprobar`, concedida por defecto a `operations` y `admin`.
  Se puede sumar a una persona con un acceso adicional de la SDD-0622 (con motivo, vencimiento y auditoría).
  `accounting` no aprueba por defecto: revisa carga física, no dinero (decisión 2).
- **Subir el archivo:** solo `admin` (el DG o Sam). La persona de operaciones no sube archivos.
- **Separación de funciones:** quien sube el lote no puede aprobarlo (decisión 4). La base lo comprueba en
  `aprobar_revision_lote` (`subido_por <> auth.uid()`).
- Tests de la fase 2: `rbac-subroute-guard`, `rbac-actions-guard` y `rbac-view-guard` cubren la ruta y la acción.

## 7. Qué cambia en la carga (`aplicar-lote.sh` y runbook; fase 3)

> `infra/ops/consolidados/` tiene abierta la PR #559. Este cambio se hace después de que se fusione, en una PR
> propia. Esta etapa no toca esos archivos.

**Flujo nuevo por contenedor (producción):**

1. Generar el lote (`--entorno produccion`); ahora también sale `revision.json`.
2. `previa` con su OK (lectura; resuelve marcas). El generador vuelve a emitir `revision.json` con `resuelve`.
3. El DG sube `revision.json` al Studio y le manda el enlace directo a la persona de operaciones.
4. La persona revisa, marca, responde y **aprueba** (o devuelve; si devuelve, el DG regenera y vuelve al paso 1).
5. `AUTORIZACION.txt` con el OK nominal de Sam, como hoy (decisión 5).
6. `simulacro` → `aplicar` → `verificar`, de a uno.
7. Tras `verificar` PASÓ, el guion marca la revisión como `cargado`.

**Cambios en `aplicar-lote.sh` (solo `--proyecto dtd-cargo`):**

- `simulacro` y `aplicar` consultan, con psql y de solo lectura, la revisión del lote:
  `estado = 'aprobado'` y `manifiesto_sha256` igual al `sha256sum` local de `manifiesto.json`. Si no hay
  aprobación, o la huella no coincide, se niegan con código 3 sin tocar la base.
- Escriben en la evidencia `APROBACION.txt` con `review_id`, `aprobado_en`, el **id** y el rol del usuario que
  aprobó (no su nombre ni su correo) y la huella.
- `aplicar.sql` repite la comprobación dentro de la transacción (un `do $aprobacion$` en el preflight): un psql
  directo, sin el guion, también aborta. Eso es un cambio del generador y viaja con el `revision.json` (fase 1).
- Después de `verificar` PASÓ, llaman a `marcar_revision_cargada(lote_id)`; si falla, el paso sigue PASÓ pero el
  guion lo dice en la salida y en la evidencia, para marcarla a mano.
- `previa` no exige aprobación: la revisión necesita su resultado.
- Pruebas nuevas en `infra/ops/tests/prueba-aplicar-lote.sh`: sin aprobación, aprobación de otra huella,
  revisión devuelta o reemplazada, y aprobación correcta.

**Runbook `cargar-consolidados.md`:** un §1b «Revisión en el Studio» entre generar y subir, y en el §2b la
aprobación como requisito previo al OK de Sam, con el enlace en el mensaje con el que se pide el OK.

## 8. Pantalla

Modelo: la hoja del 2026-11-16. La maqueta (`maqueta/revisar-lote.html`) la muestra con datos inventados.

- **Cabecera:** contenedor, estado de la revisión, id corto del lote, quién lo subió y cuándo, y la barra de
  progreso («31 de 58 líneas revisadas · 2 preguntas abiertas»). La barra cuenta líneas con veredicto más
  preguntas respondidas (PRG-01: progreso real, no decorativo).
- **Contenedores:** una tarjeta por contenedor con número ISO, precinto, naviera, puerto de llegada, fecha de
  carga, ETD y ETA; totales de clientes, embarques, cajas, kg y CBM.
- **Clientes del lote:** una tabla agrupada por cliente. Por cliente: Shipping Mark (JetBrains Mono), etiqueta,
  cuántos remitentes; por línea: Remitente, cajas, kg, CBM, notas como etiquetas con texto e icono (nunca solo
  color), y los botones «Bien» y «Corregir». «Corregir» abre un campo de texto obligatorio.
  - **Filtros:** Todas · Sin revisar · Para corregir · Con nota, con su conteo. Una búsqueda por Shipping Mark o
    Remitente.
  - **Teclado:** se puede recorrer y marcar sin mouse (A11Y-01).
- **Preguntas abiertas:** cada una con su texto, las líneas a las que se refiere (enlaces dentro de la página) y
  un campo de respuesta.
- **Aprobación:** resumen de lo que falta («faltan 3 líneas y 1 pregunta»), nota opcional y el botón
  «Aprobar lote» con el usuario que aprueba. Deshabilitado mientras falte algo, con el motivo a la vista. Si hay
  líneas en «corregir», el botón principal es «Devolver para corregir». Confirmación con el id corto del lote.
- **Copiar respuestas:** copia al portapapeles un texto con el id del lote, las líneas en «corregir» con su
  comentario y las respuestas. Solo Remitentes y Shipping Marks, sin etiquetas de cliente (§9).
- **Después de aprobar:** la página queda en solo lectura con «Aprobado por <usuario> el <fecha>» y el historial.

Gobernanza aplicable (se clasifica en la fase 2): SGE-00, BTN-01 (un primario por estado), FRM-01 (comentario
obligatorio con error asociado), PRG-01, LOD-01, ERR-01, A11Y-01, AUD-01, AUD-02 y MP-01 (la revisión no se borra
desde la pantalla). UI sustancial pasa por `/ui-check` y por `BRAND.md` (tokens del Studio, Sora + Nunito Sans,
JetBrains Mono para códigos, atención en dorado con texto `--ink`, error en `--danger` localizado).

**`/ui-check` de la maqueta (2026-11-16).** OK con ajustes menores. Se corrigió la columna Remitente: medía
137 px y un Remitente largo de aliado mide 164 px en JetBrains Mono 13 px; ahora ocupa el 24 % y no parte la
línea. Quedan para la fase 2: el diálogo de confirmación del Studio en vez de `window.confirm` (BTN-01), una
insignia de estado del sistema en vez de la franja izquierda de la fila, tokens (`--ink-side-strong`, escala
tipográfica, `var(--s-*)`) en vez de valores literales, y medir el ancho con el Remitente más largo que produzca
el generador.

## 9. Datos personales (revisar-datos-ve)

Inventario técnico, no asesoría legal. Estados según la skill: `CORRECTO` / `ENCONTRADO` / `NO VERIFICABLE`.
Como esta etapa no tiene código, todo lo que sigue es **diseño a verificar** en las fases 1-3.

| Dato | Qué es | Finalidad | Dónde vive | Retención propuesta | Quién lo ve |
|---|---|---|---|---|---|
| Shipping Mark (`cliente_clave`) | Código del cliente | Identificar la carga | `consolidation_review_lines`, `contenido` | Mientras la revisión exista | Oficina con vista de Naviera |
| Etiqueta del cliente | Nombre del cliente de `clients` si resuelve; el texto del Excel si no | Que la persona reconozca al cliente | `contenido` (jsonb) | Se purga del `contenido` a los 30 días de `cargado` (decisión 7) | Igual |
| Descripción de mercancía | Texto del Excel | Revisar qué va en cada embarque | `contenido` | Igual que la etiqueta | Igual |
| Comentarios y respuestas | Texto libre de la oficina | Explicar la corrección | líneas y preguntas | Igual que la etiqueta | Igual |
| Usuario que revisa y aprueba | uuid del usuario del Studio | Auditoría de quién y cuándo | tablas y `entity_audit_log` | Permanente (log append-only) | Admin y auditoría |

- **Minimización.** Sin teléfonos, correos, direcciones, RIF ni montos. La etiqueta del Excel aparece solo cuando
  la marca no resuelve; si resuelve, se usa el nombre que ya está en `clients`.
- **Fuera del log.** El payload de auditoría lleva ids, `ref`, veredictos, conteos y huellas; nunca texto libre
  ni etiquetas (§5). Riesgo conocido de la SDD-0543: un `ref` de la forma `XX-NN-<texto>` puede traer texto de un
  nombre. La condición previa a producción de la SDD-0543 (normalizar o mapear esas marcas antes de cargar)
  aplica igual aquí: la revisión es el lugar donde la persona de operaciones lo marca como «corregir».
- **Repositorio público.** Ni `revision.json`, ni la hoja local del 64, ni capturas con datos reales entran a
  Git. La maqueta usa marcas y nombres inventados (`DTD-Z901`, «Cliente de ejemplo 1»).
- **Transporte.** El archivo viaja de la PC del DG al Studio por HTTPS con sesión; no se manda por chat. «Copiar
  respuestas» no incluye etiquetas.
- **Borrado.** La purga del `contenido` (decisión 7) deja las líneas con códigos y conteos, y vacía etiquetas,
  descripciones, comentarios y respuestas. Corre como tarea con evidencia de conteo; el borrado permanente de
  filas lo corre Sam (regla vigente).
- **China (PIPL).** El packing list se produce en el almacén de Yiwu y llega a Venezuela por el Excel; esa
  transferencia ya ocurre hoy y no la crea esta spec. Si la etiqueta corresponde a una persona natural en China
  (un proveedor o remitente), la transferencia transfronteriza y su base legal son `NO VERIFICABLE` desde el
  repo: hay que mirarlo con la persona responsable de cumplimiento. La pantalla no agrega datos nuevos de China.
- **Venezuela (CRBV art. 28 y 60).** El cliente puede pedir acceso y supresión; la purga a plazo y la ausencia
  de etiquetas en el log facilitan responderle. Que exista un aviso de privacidad que cubra este tratamiento es
  `NO VERIFICABLE` en esta etapa.

## 10. Criterios de aceptación

**Etapa 1 (esta PR)**

1. Spec con las secciones pedidas y «Decisiones para Sam».
2. Maqueta estática con datos inventados, sin nombres ni códigos reales, revisada con `/ui-check`.
3. `pnpm docs:check` y `pnpm sdd:check` PASÓ.

**Fases siguientes (se verifican en sus PRs)**

4. Una revisión subida con un `revision.json` válido se ve en el enlace directo; uno inválido se rechaza con el
   motivo y no deja filas.
5. `aprobar_revision_lote` se niega (con el conteo) si falta una línea, si hay una en «corregir», si falta una
   respuesta, si la huella no coincide, si quien aprueba no tiene `naviera.lote.aprobar` o si es quien la subió.
   Pruebas en PGlite (`.test.sql`) más las de RBAC.
6. Una revisión aprobada no acepta cambios (trigger), y una nueva versión la pasa a `reemplazado` copiando solo
   los veredictos de líneas sin cambios.
7. Cada acción deja un evento con `correlation_id = lote_id` y un payload sin texto libre ni etiquetas (prueba que
   busca el comentario en el log y no lo encuentra).
8. `aplicar-lote.sh` en producción se niega en `simulacro` y `aplicar` sin aprobación, con otra huella, con la
   revisión devuelta o reemplazada; con aprobación correcta pasa y deja `APROBACION.txt`. `aplicar.sql` aborta
   en el preflight sin aprobación aunque se corra con psql directo.
9. Tras `verificar` PASÓ, la revisión queda `cargado`.
10. La purga del `contenido` vacía etiquetas, descripciones, comentarios y respuestas, con evidencia de conteo.
11. `pnpm verify` PASÓ en cada fase de producto.

## 11. Fases

| Fase | Qué | Depende de | Toca |
|---|---|---|---|
| 0 | Esta spec y la maqueta | — | `docs/specs/0640-revisar-lote-studio/` |
| 1 | Migración (tablas, RLS, funciones, trigger, auditoría) y `revision.json` + guarda de aprobación en `aplicar.sql` desde el generador | Aprobación de la spec; **#559 fusionada** | `supabase/migrations/`, `scripts/consolidados/`, pruebas |
| 2 | Pantalla del Studio (lista, enlace directo, subida, revisión, aprobación) detrás de un flag apagado | Fase 1 aplicada en prueba | `app/studio/(app)/naviera/lotes/`, `lib/studio/`, RBAC |
| 3 | `aplicar-lote.sh` y runbook exigen la aprobación | Fase 1 | `infra/ops/consolidados/`, `infra/ops/tests/`, `docs/runbooks/cargar-consolidados.md` |
| 4 | Primer contenedor real revisado en el Studio; retiro de la hoja local | Fases 1-3 en producción, con OK de Sam | — |

La allowlist exacta de cada fase se fija en su PR. La migración se aplica en producción solo con el OK nominal
de Sam y el runbook `aplicar-migraciones-prod.md`.

**El 64 no espera a esto.** Se revisa con la hoja local de hoy y se carga con el flujo vigente. Esta spec rige
desde el primer contenedor que llegue después de la fase 3.

## 12. Decisiones para Sam

1. **¿De dónde salen los datos para revisar?** A: lote borrador en las tablas reales; B: archivo de revisión
   que produce el generador y se sube al Studio; C: leer el Excel en el Studio.
   **Recomiendo B:** no toca lo que ve el cliente, reutiliza el generador y ata la aprobación a la huella exacta
   del lote.
2. **¿Quién aprueba?** **Recomiendo** el rol `operations` (y `admin`), más cualquier persona a la que se le dé el
   acceso adicional «aprobar lote» con la SDD-0622. `accounting` revisa y comenta, pero no aprueba por defecto.
3. **¿La pantalla muestra montos (flete, base de factura)?** **Recomiendo que no:** la persona revisa carga física
   (cajas, kg, CBM, marcas). Los montos siguen en el `resumen.md` que revisa el DG, y `operations` no ve dinero
   según el RBAC vigente.
4. **¿Quien sube el lote puede aprobarlo?** **Recomiendo que no** (cuatro ojos): el DG sube, la persona de
   operaciones aprueba. Si tú subes un lote, lo aprueba otra persona.
5. **¿La aprobación de operaciones reemplaza tu OK nominal para cargar en producción?** **Recomiendo que no por
   ahora:** se suman. Operaciones aprueba el contenido; tú autorizas la escritura en producción. Revisarlo después
   de tres contenedores sin incidentes.
6. **¿La exigencia aplica también a prueba?** **Recomiendo que no:** en prueba la aprobación es opcional para
   poder ensayar; en producción es obligatoria.
7. **¿Cuánto tiempo se guardan los nombres y textos de la revisión?** **Recomiendo 30 días** después de cargado
   el lote; luego se purgan etiquetas, descripciones, comentarios y respuestas, y quedan códigos, conteos y la
   auditoría.
8. **¿«Corregir» bloquea la aprobación?** **Recomiendo que sí:** una línea en «corregir» obliga a devolver el lote
   y regenerarlo. Si la corrección no cambia el lote (por ejemplo, «avisarle al cliente»), la persona la marca
   «bien» con un comentario.
9. **¿Dónde vive la pantalla?** **Recomiendo** dentro de Naviera & Consolidación (`/studio/naviera/lotes/...`),
   sin módulo nuevo en el menú, con el enlace directo que el DG manda por lote.

### 12.1 Resolución (2026-11-16)

Sam aprobó las nueve decisiones tal como se recomendaron. Su respuesta literal, el 2026-11-16, se la dio al
Subdirector Portal del cliente en esa sesión, y el Subdirector la transmitió a este Worker: «Sí, las 9».

| # | Decisión | Resolución |
|---|---|---|
| 1 | Origen de los datos | **B:** `revision.json` que emite el generador y se sube al Studio, atado a la huella del lote. |
| 2 | Quién aprueba | `operations` y `admin`, más el acceso por persona «aprobar lote» (SDD-0622). `accounting` revisa y comenta, pero no aprueba por defecto. |
| 3 | Montos en la pantalla | **No.** Solo carga física: cajas, kg, CBM y marcas. |
| 4 | Quien sube, ¿aprueba? | **No** (cuatro ojos). La base lo comprueba. |
| 5 | ¿La aprobación reemplaza el OK nominal de Sam? | **No:** se suman. Se revisa después de tres contenedores sin incidentes. |
| 6 | ¿Exigencia en prueba? | **No:** opcional en prueba, obligatoria en producción. |
| 7 | Retención | **30 días** después de `cargado`; luego se purgan etiquetas, descripciones, comentarios y respuestas. |
| 8 | ¿«Corregir» bloquea? | **Sí:** el lote se devuelve y se regenera. |
| 9 | Dónde vive | Dentro de Naviera & Consolidación (`/studio/naviera/lotes/...`), sin módulo nuevo en el menú y con enlace directo. |

La aprobación de las decisiones no arranca la implementación. La fase 1 es otra tarea, la ordena el DG y sigue
esperando a que se fusione la #559.
