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
- **PIPL (China):** `NO VERIFICABLE`. No consta en el repo dónde corren el runtime de la oficina ni el proveedor del modelo glm-5.3 (ver §4).

En este archivo, `0541` quiere decir `supabase/migrations/0541_oficina_cable_tablas.sql`.

## 1 · Resumen

| Estado | Cantidad |
|---|---|
| `CORRECTO` | 10 |
| `ENCONTRADO` | 3 |
| `NO VERIFICABLE` | 5 |

**Paso 3a (16/11/2026):** se suman el hallazgo 12 (el borrador del agente) y el 13 (los mensajes salen de la casa hacia los cerebros), y el 1 queda cerrado para lo que escribe el despachador.

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
| `office_borradores.texto` | Lo que REDACTÓ el agente para el cliente (hasta 4.000 caracteres), nunca el texto del cliente. Pasa antes la revisión automática de eval.md, que escala si trae datos personales | Que Sam lo revise antes de cualquier envío (D3; el envío es del Paso 3b) | **90 días**; después se borra la fila (`office_purgar_borradores_viejos`) | `0547` (office_borradores) |
| `office_borradores.motivo` | Por qué se escaló: un código del despachador o el motivo del agente, pasado por la regla del cable | Que Sam sepa qué revisar | **90 días** | `0547` |

No hay datos sensibles por columna: ni salud, ni biométricos, ni geolocalización. El riesgo estaba en los textos libres, que pueden copiar lo que dijo el cliente.

## 3 · Hallazgos

### `ENCONTRADO` 1 · La regla de escritura todavía no tiene quién la llame (media)

`exigirTextosDelCable` existe y tiene su prueba (`lib/studio/oficina/cable-textos.ts:115`).
- **Paso 2 (hecho):** el webhook escribe `event_inbox` solo a través de `escribirEnElCable` (`lib/studio/oficina/escritura.ts`), que llama a esa función antes de guardar. La fila lleva solo identificadores y referencias, y no existe otro camino de escritura a las tablas del cable en el código. Su prueba incluye el caso de rechazo: no se guarda, y el log da los códigos sin repetir el dato.
- **Paso 3a (hecho):** el despachador escribe `task_events` solo por `crearAlmacenDespachador().anotar` (`lib/studio/oficina/despachador-almacen.ts`), que pasa por `escribirEnElCable`; si la regla rechaza un resumen, el paso se guarda sin él. `office_tasks` la crea la base (`office_convertir_triaje`, 0547) con un título fijo, `asignado_a = agente:<perfil>` y `meta_datos` solo con el id y el tipo del evento. El motivo de un escalado pasa por la misma regla (`textoSeguro`). La prueba `lib/studio/__tests__/oficina-despachador.test.ts` vuelca todas las tablas del cable y los logs y exige que no aparezca el texto ni el teléfono del cliente.

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

- `office_borradores` (0547) guarda la respuesta redactada o el escalado. El texto del cliente vive solo en memoria durante la corrida (`chatwoot-lectura.ts`, `despachador.ts`) y no entra a ninguna tabla ni log.
- Antes de guardar una respuesta, `revisarRespuesta` (`eval-automatico.ts`) escala si trae un correo, un teléfono, una cédula, un RIF o una dirección (la regla del cable): el agente no repite datos personales.
- RLS sin policies; anon y authenticated sin privilegios; service_role solo lee e inserta. Se borra a los 90 días (D3), en la misma tarea diaria que vacía los resúmenes.

### `CORRECTO` 13 · Los mensajes salen de la casa hacia los cerebros (Paso 3a, 16/11/2026)

Para redactar, el despachador manda el texto de la conversación fuera del VPS DTD. Este es el viaje completo:

| Dónde | Qué llega | Cuánto tiempo | Evidencia |
|---|---|---|---|
| ERP (VPS DTD) | Lee de Chatwoot los últimos 20 mensajes (rol y texto, sin nombres ni contacto) | Solo en memoria, mientras dura la corrida (≤ 200 s) | `chatwoot-lectura.ts`, prueba «ninguna fila ni log» |
| Cable (túnel SSH ERP → oficina) | El mismo texto, cifrado por el túnel | Nada se guarda en el camino | runbook §8 |
| Hermes, perfil `soporte-chatwoot` (VPS Oficina) | El texto y la respuesta, como un turno del API server | **Hermes v0.23.1 guarda cada turno en su `state.db` y no se puede apagar.** El despachador borra la sesión de cada llamada al terminar (`DELETE /api/sessions/<id>`); si falla, la purga diaria de la oficina (`hermes-soporte-purga.timer`) borra toda sesión del API server de más de 24 h. **Máximo: 48 h.** Quedan además las marcas de idempotencia (7 días, sin el texto) y, hasta el próximo VACUUM, las páginas libres de SQLite | sección B del Paso 3a (`.agents/handoffs/2026-11-16-sdd-0626-paso3a-despachador.md`) |
| Proveedor del modelo: Z.AI (glm-5.3) y, de respaldo, DeepSeek (deepseek-chat) | El prompt completo de la llamada | Lo que diga cada proveedor: **no verificable** desde aquí (§4) | — |

- El agente no tiene memoria ni herramientas: no guarda nada por su cuenta (`memory.memory_enabled: false`, toolsets vacíos).
- Los logs de Hermes no registran el texto de los turnos del API server; se vuelve a comprobar en la prueba de staging (E).
- **Alcance hoy:** solo la cuenta 2 y la bandeja 11, de prueba, con texto inventado.

## 4 · No verificable

- **Los respaldos de la base.** Vaciar el resumen no llega a los dumps (`docs/runbooks/backup-restore-servidor.md`). Un resumen sigue en los respaldos mientras estos existan.
- **Los proveedores del modelo (Z.AI y DeepSeek):** qué guardan de cada llamada y por cuánto tiempo, y en qué país procesan. Las dos son empresas con sede en China, así que la PIPL (punto 9) probablemente aplica; no consta dónde procesan. El runtime de la oficina ya está medido (hallazgo 13).
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
