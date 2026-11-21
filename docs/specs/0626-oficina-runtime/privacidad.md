# SDD-0626 — Revisión de datos personales: las cuatro tablas del cable (§3.1, migración 0541)

Hecha el 2026-11-15 con [`revisar-datos-ve`](../../../.claude/skills/revisar-datos-ve/SKILL.md), sobre la rama `sdd/0626-paso1-revision`.

**Por qué:** lo pidió la revisión independiente de la #572, en su hallazgo 1 (severidad media): `titulo`, `meta_datos`, `actor` y `resumen` son texto libre, y en `task_events` quedan para siempre.

**El arreglo:** es la opción A que Sam aprobó el 15/11/2026 («A: regla + 90 días»). Está en §3.1 de la spec, en la 0541 y en `lib/studio/oficina/cable-textos.ts`.

**Alcance:**
- las cuatro tablas de la 0541;
- la regla con la que el Paso 2 va a escribir en ellas.

No es una auditoría del cable completo, ni de Chatwoot, ni del runtime de la oficina.

**No es asesoría legal y no afirma que el proyecto cumple.** Cada punto queda en uno de tres estados:
- `ENCONTRADO`: un problema que se ve en el código;
- `CORRECTO`: la implementación que lo resuelve, vista en el código;
- `NO VERIFICABLE`: no se puede comprobar leyendo el repositorio.

**Marco aplicable**, citado desde la skill y su [checklist](../../../.claude/skills/revisar-datos-ve/references/checklist-datos-ve.md), puntos 1, 2, 5 y 12:
- **Venezuela:**
  - la Constitución, arts. 28 (habeas data) y 60 (vida privada);
  - la SC 332/2001: finalidad, calidad y temporalidad;
  - la SC 759/2025: derecho al olvido.
- **PIPL (China):** `NO VERIFICABLE`. Desde el 2026-11-21 el runtime de la oficina usa Anthropic (claude-sonnet-5-5), sin proveedor chino en el pool (informe de Ofi_Hermes al DG); la PIPL deja de ser el motivo principal. No consta en el repo dónde corre el runtime de la oficina (ver §4).

En este archivo, `0541` quiere decir `supabase/migrations/0541_oficina_cable_tablas.sql`.

## 1 · Resumen

| Estado | Cantidad |
|---|---|
| `CORRECTO` | 12 |
| `ENCONTRADO` | 5 |
| `NO VERIFICABLE` | 7 |

**Paso 3a (16/11/2026):** se suman el hallazgo 12 (el borrador del agente) y el 13 (los mensajes salen de la casa hacia los cerebros), y el 1 queda cerrado para lo que escribe el despachador. La retención en la oficina (`state.db` de Hermes) se revisó aparte con la skill, a pedido del DG: hallazgos 14 a 18.

## 2 · Inventario

**De quién son los datos:**
- Los clientes y contactos que escriben por Chatwoot. Muchos no son usuarios del ERP (punto 12). Sus datos llegan a la oficina solo por referencia (`payload_ref`, `entidad_ref`).
- El personal que pausa o despausa la oficina: los administradores de plataforma.

**Quién más lo ve:**
- RLS está activa y no hay policies.
- anon y authenticated no tienen privilegios, ni de tabla ni de columna.
- Solo leen service_role (el despachador futuro) y el dueño de las migraciones.

| Tabla.campo | Qué es | Finalidad | Retención | Evidencia |
|---|---|---|---|---|
| `office_tasks.titulo` | Texto libre de hasta 200 caracteres, sin datos personales por la regla de escritura | Describir el trabajo | Sin plazo: las tareas no se pierden (SGE-AG-01 §7) | `0541:126`, `:144` |
| `office_tasks.asignado_a` | Identificador `agente:`, `sistema:` o `persona:<uuid>` | A quién va la tarea | Sin plazo | `0541:130`, `:151` |
| `office_tasks.entidad_ref` | Referencia sin espacios, de hasta 300 caracteres | Señalar la entidad del ERP sin copiarla (R5) | Sin plazo | `0541:133`, `:154` |
| `office_tasks.meta_datos` | Objeto jsonb de hasta 8 KB con referencias e indicadores (ids, conteos y banderas), sin datos personales | Lo que el despachador necesita de la tarea | Sin plazo | `0541:135`, `:156` |
| `task_events.actor` | Identificador `agente:`, `sistema:` o `persona:<uuid>` | Quién hizo el paso | Para siempre (solo agregar) | `0541:170`, `:180` |
| `task_events.resumen` | Texto libre de hasta 1.000 caracteres, sin datos personales por la regla de escritura | Qué hizo el paso | **90 días**; después queda vacío | `0541:171`, `:182`, `:279`, `:384` |
| `event_inbox.clave_dedupe` | Texto sin espacios, de hasta 200 caracteres, único | Que un evento se procese una sola vez (AC-4) | Sin plazo | `0541:202`, `:216` |
| `event_inbox.payload_ref` | Referencia `origen:ruta` | Señalar el mensaje en Chatwoot sin copiarlo | Sin plazo | `0541:223` |
| `office_paused.cambiado_por` | uuid del administrador que cambió la bandera | Dejar registrada la autorización (SGE-AG-01 §7) | Para siempre (solo agregar) | `0541:236`, `:366` |
| `office_paused.motivo` | Texto del administrador, de hasta 500 caracteres | Por qué se pausó o despausó | Para siempre (solo agregar) | `0541:238` |
| `office_borradores.texto` | Lo que REDACTÓ el agente para el cliente (hasta 4.000 caracteres), nunca el texto del cliente. Pasa antes la revisión automática de eval.md, que escala si trae datos personales | Que Sam lo revise antes de cualquier envío (D3; el envío es del Paso 3b) | **90 días**; después se borra la fila (`office_purgar_borradores_viejos`) | `0548` (office_borradores) |
| `office_borradores.motivo` | Por qué se escaló: un código del despachador o el motivo del agente, pasado por la regla del cable | Que Sam sepa qué revisar | **90 días** | `0548` |

No hay datos sensibles por columna: ni salud, ni biométricos, ni geolocalización. El riesgo estaba en los textos libres, que pueden copiar lo que dijo el cliente.

## 3 · Hallazgos

### `ENCONTRADO` 1 · La regla de escritura todavía no tiene quién la llame (media)

`exigirTextosDelCable` existe y tiene su prueba (`lib/studio/oficina/cable-textos.ts:115`).
- **Paso 2 (hecho):** el webhook escribe `event_inbox` solo a través de `escribirEnElCable` (`lib/studio/oficina/escritura.ts`), que llama a esa función antes de guardar. La fila lleva solo identificadores y referencias, y no existe otro camino de escritura a las tablas del cable en el código. Su prueba incluye el caso de rechazo: no se guarda, y el log da los códigos sin repetir el dato.
- **Paso 3a (hecho):** el despachador escribe `task_events` solo por `crearAlmacenDespachador().anotar` (`lib/studio/oficina/despachador-almacen.ts`), que pasa por `escribirEnElCable`; si la regla rechaza un resumen, el paso se guarda sin él. `office_tasks` la crea la base (`office_convertir_triaje`, 0548) con un título fijo, `asignado_a = agente:<perfil>` y `meta_datos` solo con el id y el tipo del evento. El motivo de un escalado pasa por la misma regla (`textoSeguro`). La prueba `lib/studio/__tests__/oficina-despachador.test.ts` vuelca todas las tablas del cable y los logs y exige que no aparezca el texto ni el teléfono del cliente.

### `ENCONTRADO` 2 · La regla no ve todo (baja)

`tieneDatosPersonales` (`lib/news/autopublicar/control.ts:174`) no veía un móvil de China agrupado como «+86 138 1234 5678».
- **Lo que ya se agregó:** el cable le suma el teléfono con prefijo internacional (`detectorDelCable`, `cable-textos.ts:108`), con prueba y mutante.
- **Lo que sigue sin verse:**
  - un móvil chino escrito **sin** prefijo;
  - un nombre de persona suelto.

  Ninguna regla de texto los detecta sin dar falsos positivos.
- **La red:** si algo pasa, el resumen se vacía a los 90 días.

### `ENCONTRADO` 3 · La clave de dedupe podría armarse con un dato de contacto (baja)

`clave_dedupe` solo prohíbe los espacios (`0541:216`). La clave se arma con los ids de Chatwoot (conversación y mensaje), nunca con datos de contacto (§3.2).
- Por qué no se le aplica la regla de texto: los ids numéricos largos la harían dar falsos positivos.
- Dónde se revisó: en el PR del Paso 2. La clave del webhook es `chatwoot:conv:<id>:msg:<id>`, con los dos ids numéricos de Chatwoot, y además pasa por `exigirTextosDelCable`. Una prueba exige que ninguna fila guarde el texto, el nombre, el correo ni el teléfono de un mensaje de ejemplo.

### `CORRECTO` 4 · Quién y a quién, por identificador

`task_events.actor` y `office_tasks.asignado_a` solo aceptan `agente:<perfil>`, `sistema:<componente>` o `persona:<uuid>` (`0541:180`, `:151`).
- El contrato rechaza un nombre, un identificador sin prefijo, una `persona:` sin uuid y un correo.
- `cable-textos.ts:27` usa el mismo patrón, y una prueba compara los dos.

### `CORRECTO` 5 · El resumen se vacía a los 90 días

`office_vaciar_resumenes_viejos()` (`0541:384`) pone `resumen = null` en las filas de más de 90 días.
- El disparador solo deja pasar esa edición (`0541:279`): resumen → null, en filas de más de 90 días, con todas las demás columnas iguales.
- El contrato 2e lo prueba con su lado negativo: no se puede cambiar el resumen por otro texto, ni tocar otra columna al vaciar, ni vaciar una fila de menos de 90 días.
- Hay cinco mutantes de la excepción.

**Por qué 90 días:** es una red por si la redacción falla, por temporalidad (SC 332/2001). R5 le da ese plazo al replay, no a la bitácora.

### `CORRECTO` 6 · La regla de escritura existe y se prueba

`cable-textos.ts` rechaza correos, teléfonos de Venezuela e internacionales, cédulas, RIF y direcciones en `titulo`, `resumen` y `meta_datos`, a cualquier profundidad y también en las claves.
- No confunde un uuid ni un conteo con un teléfono.
- Su prueba tiene un mutante: el revisor sin detector deja pasar los casos de rechazo.

### `CORRECTO` 7 · El mensaje del cliente no entra a la bandeja

`payload_ref` solo acepta una referencia `origen:ruta` sin espacios (`0541:223`). Lo prueban los casos «mensaje completo» y «mensaje tras el origen» del contrato.

### `CORRECTO` 8 · Nadie de la API lee estas tablas

- RLS sin policies (`0541:411-414`).
- `revoke all` a public, anon, authenticated y service_role (`0541:416`).
- El postflight comprueba que anon y authenticated no tienen ningún privilegio de tabla ni de columna.

### `CORRECTO` 9 · La hora y la identidad las pone la base

service_role escribe por columna: nunca `id`, `creado_en` ni `ts` (`0541:423` y siguientes). Lo prueba el contrato 8. Eso sostiene el valor de la bitácora, porque AUD-01 §3 pide la hora del servidor.

### `CORRECTO` 10 · Quién pausó queda por identificador

`office_paused.cambiado_por` es el uuid de `auth.uid()`, no un nombre (`0541:236`, `:366`). Su finalidad está escrita en SGE-AG-01 §7: «Despausar exige autorización registrada».

### `CORRECTO` 11 · El puente de prueba lee el mensaje pero no lo guarda (Paso 2b, 16/11/2026)

- **Qué lee:** el puente (`infra/ops/cable-oficina/puente-prueba.mjs`) pide por la API de Chatwoot las conversaciones y los mensajes de la cuenta 2 y la bandeja 11, y la respuesta trae el contenido del mensaje (`content`) y el contacto (`sender`, `meta.sender`). Esos datos están **solo en memoria**, durante la vuelta.
- **Qué no hace con ellos:**
  - no los manda al ERP: `cuerpoMessageCreated` arma el cuerpo solo con ids, tipo, estado y etiquetas;
  - no los guarda: en disco solo queda el cursor, que es un número;
  - no los registra: en el log solo hay ids y códigos.
- **Evidencia:**
  - `infra/ops/tests/cable-oficina-puente.test.mjs` exige que ni el cuerpo ni el log lleven el texto o el nombre del contacto, y tampoco el token ni el secreto;
  - en la prueba de staging del 16/11/2026 aparecieron **0 líneas** con el texto o el nombre en los logs del web y del puente (`/srv/ops/evidencias/cable-puente-prueba-20261116T012638Z.txt`, en el VPS).
- **Alcance:** solo la cuenta 2, de prueba. Los datos de la prueba son inventados: un contacto, una conversación y un mensaje, que siguen en Chatwoot con la retención de Chatwoot (§4).

### `CORRECTO` 12 · El borrador guarda lo que redactó el agente, no lo que escribió el cliente (Paso 3a)

- `office_borradores` (0548) guarda la respuesta redactada o el escalado. El texto del cliente vive solo en memoria durante la corrida (`chatwoot-lectura.ts`, `despachador.ts`) y no entra a ninguna tabla ni log.
- Antes de guardar una respuesta, `revisarRespuesta` (`eval-automatico.ts`) escala si trae un correo, un teléfono, una cédula, un RIF o una dirección (la regla del cable): el agente no repite datos personales.
- RLS sin policies; anon y authenticated sin privilegios; service_role solo lee e inserta. Se borra a los 90 días (D3), en la misma tarea diaria que vacía los resúmenes.

### `CORRECTO` 13 · Los mensajes salen de la casa hacia los cerebros (Paso 3a, 16/11/2026)

Para redactar, el despachador manda el texto de la conversación fuera del VPS DTD. Este es el viaje completo:

| Dónde | Qué llega | Cuánto tiempo | Evidencia |
|---|---|---|---|
| ERP (VPS DTD) | Lee de Chatwoot los últimos 20 mensajes (rol y texto, sin nombres ni contacto). **Desde SDD-0700 tapa en cada mensaje los correos, teléfonos, cédulas, RIF y direcciones** («[correo]», «[teléfono]», «[cédula]», «[RIF]», «[dirección]») antes de armar la llamada; si el detector todavía ve un dato, escala sin llamar | Solo en memoria, mientras dura la corrida (≤ 200 s) | `chatwoot-lectura.ts`, `tapar-datos.ts`, prueba «ninguna fila ni log» |
| Cable (túnel SSH ERP → oficina) | El mismo texto, cifrado por el túnel | Nada se guarda en el camino | runbook §8 |
| Hermes, perfil `soporte-chatwoot` (VPS Oficina) | El texto y la respuesta, como un turno del API server | **Hermes v0.23.1 guarda cada turno en su `state.db` y no se puede apagar.** El despachador borra la sesión de cada llamada al terminar (`DELETE /api/sessions/<id>`); si falla, la purga diaria de la oficina (`hermes-soporte-purga.timer`) borra toda sesión del API server de más de 24 h. **Máximo: 48 h.** Quedan además las marcas de idempotencia (7 días, sin el texto) y, hasta el próximo VACUUM, las páginas libres de SQLite | sección B del Paso 3a (`.agents/handoffs/2026-11-16-sdd-0626-paso3a-despachador.md`) |
| Proveedor del modelo: Anthropic (claude-sonnet-5-5), sin respaldo. Z.AI y DeepSeek salieron del pool y del `.env` el 2026-11-21 (Sam; informe de Ofi_Hermes al DG). Un respaldo OpenAI está en la SDD-0703 | El prompt de la llamada: instrucciones, guiones y los mensajes **con los datos personales tapados** desde SDD-0700 (antes llegaban completos) | Lo que diga cada proveedor: **no verificable** desde aquí (§4) | — |

- **Datos tapados antes del modelo (SDD-0700, 21/11/2026).** Es la primera parte del punto (a) acordado para la etapa 2.
  `tapar-datos.ts` usa la misma lista que el detector de la salida (`detectorDelCable`, `datos-personales.ts`), así que
  lo que se revisa en la respuesta es lo mismo que se tapa en la entrada. Esa lista es propia de la Oficina_Virtual
  (la de noticias no cambió) y cubre los móviles y los fijos de Venezuela, las cédulas y los RIF con o sin puntos, los
  correos y las direcciones con número. **No se tapan** los nombres de personas ni los textos que no encajan en ningún
  patrón (una dirección sin número, un teléfono escrito en palabras, un fijo sin el 0 o pegado a otro texto): siguen
  llegando al proveedor. Los números de guía no son datos personales y van tal cual. Quedan pendientes del punto (a): revisar a los proveedores y avisar al cliente.
- El agente no tiene memoria ni herramientas: no guarda nada por su cuenta (`memory.memory_enabled: false`, toolsets vacíos).
- Los logs de Hermes no registran el texto de los turnos del API server; se vuelve a comprobar en la prueba de staging (E).
- **Alcance hoy:** solo la cuenta 2 y la bandeja 11, de prueba, con texto inventado.

### Revisión de la retención en la oficina: el `state.db` de Hermes (Paso 3a, 16/11/2026)

Pedido del DG: pasar por [`revisar-datos-ve`](../../../.claude/skills/revisar-datos-ve/SKILL.md) que la oficina guarde los
mensajes hasta 48 h. Se revisó contra la checklist, puntos 1, 2, 5 y 10. La evidencia del servidor está fuera del
repositorio: lo que solo se ve allí queda `NO VERIFICABLE` desde aquí, aunque se haya mirado en el VPS.

**Inventario (punto 1):**

| Dónde | Qué es | Finalidad | Retención | Quién más lo ve |
|---|---|---|---|---|
| `state.db` del perfil `soporte-chatwoot` (tablas de sesiones y mensajes de Hermes) | El texto de la conversación que manda el ERP (rol y texto de los últimos 20 mensajes del cliente), las instrucciones, los guiones y la respuesta del agente | Ninguna propia: Hermes guarda cada turno del API server para continuar sesiones, y en v0.23.1 no se puede apagar | Segundos: el despachador borra la sesión al terminar. Si falla, ≤ 48 h por la purga diaria. Ver 16 | Solo `agentes-soporte` (archivo 600, home 700) y root |
| Admisiones de Hermes (tombstones de idempotencia) | La respuesta del agente asociada a la llave `<run>:<intento>` | Que un reintento exacto no vuelva a correr el modelo | 7 días tras el borrado de la sesión, hasta una pasada de limpieza. Ver 17 | Igual |
| Páginas libres y WAL de SQLite | Restos de bytes de las filas borradas | Ninguna | Hasta que SQLite reutilice la página o haya un VACUUM. Ver 16 | Igual |

**Finalidad (punto 2).** El despachador no necesita que la oficina recuerde nada: cada llamada lleva todo lo necesario
(`lib/studio/oficina/despachador.ts`, el `usuario` de `ejecutarCorrida`). Por eso lo que guarda Hermes no tiene
finalidad propia, y el criterio es borrarlo cuanto antes (SC 332/2001, temporalidad).

#### `CORRECTO` 14 · El despachador borra la sesión de cada llamada

- Cada llamada usa su propia sesión: `lib/studio/oficina/despachador.ts:162` y la cabecera en `lib/studio/oficina/runtime-cliente.ts:59`.
- Se borra en un `finally`, haya salido bien o mal: `despachador.ts:170`, `runtime-cliente.ts:99` y `:103` (`DELETE /api/sessions/<id>`).
- En Hermes, `delete_session` borra la sesión y sus mensajes (`hermes_state_sessions.py`, v0.23.1, en el VPS).
- La prueba `lib/studio/__tests__/oficina-despachador.test.ts:418` exige un borrado por llamada.
- **Solo se verificó con una sesión vacía** (crear → DELETE 200 → GET 404, 16/11/2026). Falta el paso 3 de la skill con un turno real (ver 18).

#### `CORRECTO` 15 · La versión de las instrucciones queda con cada llamada (punto 10)

El agente decide si responde o escala, y con qué prioridad. Cada llamada anota en `task_events` el modelo que la
sirvió, el costo y la versión de los guiones (`despachador.ts:177`). El borrador queda para que Sam lo revise antes de
cualquier envío: ninguna decisión sale sin una persona.

#### `ENCONTRADO` 16 · «48 h» vale para las filas, no para los bytes del archivo (media)

- **Qué:** SQLite no sobrescribe al borrar (sin `secure_delete`). Los bytes de una sesión borrada quedan en páginas
  libres (y un rato en el WAL) hasta que se reutilicen o haya un `VACUUM`.
- **Dónde:** en v0.23.1, Hermes solo hace `VACUUM` después de su propia poda, y solo con más del 25 % de páginas libres
  y cada 30 días (`hermes_state_maintenance.py` y `hermes_state_common.py:302`, en el VPS). El `DELETE` por la API no
  lo dispara. `hermes sessions optimize` no corre con el gateway vivo, salvo con `--force`, que Hermes advierte que
  puede dejar a los agentes sin responder.
- **Por qué importa:** quien copie el archivo `state.db` (root, un respaldo del VPS) podría recuperar restos más allá de
  las 48 h. Las filas en sí, no.
- **Norma:** SC 332/2001 (temporalidad) y SC 759/2025 (derecho al olvido); CRBV art. 28 (destrucción).
- **Arreglo propuesto (lo decide Sam):**
  - **A:** una ventana semanal de mantenimiento en la oficina: parar `hermes-gateway-soporte-chatwoot`, correr
    `hermes sessions optimize` como `agentes-soporte` y arrancarlo. Unos segundos sin agente; con el despachador
    encendido, la corrida de ese momento escala por `runtime:red`.
  - **B:** aceptar el resto, sabiendo que el texto es de la bandeja de prueba e inventado hasta la etapa 2.
- **Decisión de Sam (16/11/2026, «Sí a todo»):** **B** mientras solo haya datos de prueba. **A es OBLIGATORIA antes
  de la etapa 2** (clientes reales): la compactación semanal tiene que estar instalada y probada antes de ese paso.
- **Paso 3b (16/11/2026): A instalada y probada.** `hermes-soporte-compactar.timer`, domingos 05:10 UTC (runbook §11).
  La primera corrida dejó 0 páginas libres y el WAL vacío, y los restos de la marca de la prueba E en `state.db`
  pasaron de 1 a 0. Entre dos compactaciones los bytes pueden quedar hasta 7 días; con el borrado de la sesión al
  momento, las filas siguen sin pasar de segundos.

#### `ENCONTRADO` 17 · Hermes conserva la respuesta del agente 7 días tras el borrado (baja)

- **Qué:** después de `DELETE /api/sessions/<id>`, Hermes guarda las admisiones como tombstones durante 7 días, y hasta
  la siguiente pasada de limpieza. Un reintento exacto con la misma `Idempotency-Key` recibe la respuesta original
  (`website/docs/user-guide/features/api-server.md`, «Idempotency keys», en el VPS).
- **Qué no:** el texto del cliente, que entra en la identidad de la admisión y no es la respuesta. Que no se guarde
  textual es `NO VERIFICABLE` sin leer el almacén de admisiones (sí consta en el ledger de `/v1/runs`, que solo
  guarda huellas: `api_server_run_idempotency.py:60`, en el VPS).
- **Por qué es baja:** la respuesta del agente es el mismo texto que el borrador, que se guarda 90 días por decisión de
  Sam (D3), y la revisión de eval.md escala si trae datos personales.
- **Arreglo, si se quiere:** quitar la `Idempotency-Key` (`runtime-cliente.ts`). Se pierde la protección contra una
  llamada doble al modelo cuando la red corta a mitad. No se recomienda.

#### `CORRECTO` / `NO VERIFICABLE` · Lo que vive en el servidor de la oficina

Visto en el VPS el 16/11/2026, pero fuera del repositorio:
- el timer `hermes-soporte-purga`;
- `sessions.auto_prune: true` y `retention_days: 1`;
- `memory.memory_enabled: false`;
- `updates.pre_update_backup: "off"`: la copia rápida que `hermes update` hace de `state.db` sería un escondite más (punto 5, respaldos);
- el home 700.

Los detalles están en `docs/runbooks/oficina-cable.md` §2 y §10, y la reversión en
`/srv/oficina/backups/paso3a-agente-20261116T041544Z/REVERTIR.txt`.

#### `NO VERIFICABLE` 18 · El borrado no se probó con un valor rastreable (paso 3 de la skill)

Se propone para la prueba de staging (E), con el OK de Sam:
1. Una conversación inventada con una marca única.
2. Una corrida del despachador.
3. Buscar la marca en `state.db`, `-wal`, `response_store.db`, `runs_idempotency.db`, `logs/` y `cache/` del perfil:
   - justo después de la corrida;
   - después de la purga diaria.

Si la marca sobrevive como fila, el borrado no borra (`ENCONTRADO`). Si sobrevive solo como bytes sueltos del archivo, es el 16.

### Revisión del Paso 3b (16/11/2026): la revisión de Sam y el envío

#### `CORRECTO` 19 · La revisión guarda la decisión, no el texto (D2)

- `office_revisiones` (0549) guarda el veredicto, las 5 casillas, el motivo, el revisor (`auth.uid()`, un identificador)
  y la hora. Del borrador guarda solo su huella sha256: cuando el borrador se purga a los 90 días (D3), la revisión
  queda para el conteo sin el texto.
- **El motivo es texto libre de Sam y se guarda para siempre** (solo se agregan filas). Por eso la acción de la página
  lo rechaza si trae un correo, un teléfono, una cédula, un RIF o una dirección (la regla del cable,
  `app/studio/(app)/admin/oficina/actions.ts`), y la página lo pide «sin datos personales».
- RLS sin policies; anon y authenticated no leen la tabla; la página la usa solo por funciones que exigen
  `is_platform_admin()`. El aviso de Discord lleva el número de pendientes y el enlace, nunca el texto (`MinimalAlert`).

#### `CORRECTO` 20 · Lo que sale hacia el cliente lo aprobó Sam, y una sola vez

- Solo el ERP envía, solo lo aprobado y solo a la bandeja de prueba (`lib/studio/oficina/envio.ts`). No se aprueba un
  envío con las casillas de datos inventados o datos personales sin marcar (la base lo impide).
- El texto que sale es el mismo que Sam vio: la huella se compara en el ERP y otra vez en la base antes de reservar.
- `office_envios` no guarda el texto: el mensaje enviado vive en Chatwoot, con la retención de Chatwoot (§4).
- **Dinero:** una conversación de dinero se escala sin llamar al agente, así que su texto ni sale hacia el proveedor
  del modelo (`tema-dinero.ts`).
- **Sesiones abortadas:** se vuelven a borrar en la oficina cada tick durante 15 min (`office_sesiones_por_borrar`, solo
  el id). Lo que dice el hallazgo 14 vale ahora también para las llamadas cortadas a mitad.

## 4 · No verificable

- **Los respaldos de la base.** Vaciar el resumen no llega a los dumps (`docs/runbooks/backup-restore-servidor.md`). Un resumen sigue en los respaldos mientras estos existan.
- **El proveedor del modelo (Anthropic; OpenAI si se suma, SDD-0703):** qué guarda de cada llamada y por cuánto tiempo, y en qué país procesa. Desde el 2026-11-21 ya no hay proveedores con sede en China en el pool. El runtime de la oficina ya está medido (hallazgo 13).
- **Chatwoot:** guarda la conversación completa. Su retención es la de Chatwoot, no la de estas tablas.
- **Producción:**
  - que el dueño de las tablas sea `postgres` y que service_role tenga BYPASSRLS. La revisión de la #572 lo infiere y no lo mide;
  - que la tarea programada `/api/cron/oficina-vaciado` esté de verdad en el contenedor `cron` del servidor, encendida (`OFICINA_VACIADO_ACTIVO`) y llamando a `office_vaciar_resumenes_viejos()` todos los días (Paso 2: nace apagada).
- **Base real:** no se corrió la verificación del paso 3 de la skill (crear un valor rastreable, vaciarlo y buscarlo). El contrato corre en PGlite y en un Postgres 17 desechable.

## 5 · Fuera de alcance

- **Necesita abogado:**
  - la base de licitud para que un agente de IA atienda las conversaciones de Chatwoot;
  - el aviso al cliente de que lo atiende un agente;
  - la política pública de tratamiento.
- **Antes de la etapa 2 de AC-1 (clientes reales):** una revisión propia del envío de conversaciones al proveedor del modelo, por transferencia internacional y terceros (puntos 8 y 9).

---

Esto no es asesoría legal: es un inventario técnico con evidencia y una lista de preguntas. Conviene una segunda opinión de otro modelo; la revisión independiente de la #572 fue la primera.
