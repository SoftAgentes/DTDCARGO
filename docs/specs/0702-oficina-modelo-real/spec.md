---
sdd: "0702"
title: "Oficina_Virtual: el modelo real de cada llamada"
status: proposed
author: "Claude (Worker) para el Director Ofi_Hermes"
created: 2026-11-21
updated: 2026-11-21
supersedes: null
superseded_by: null
related: ["0626"]
confidencialidad: interno
---

# SDD-0702 — Oficina_Virtual: el modelo real de cada llamada

> Hija de SDD-0626. En `task_events.modelo_usado` queda hoy «soporte-chatwoot», que es el nombre del agente y no
> el modelo. Para la revisión de privacidad de la etapa 2 hay que saber qué proveedor y qué modelo escribieron cada
> borrador: GLM (principal) o DeepSeek (respaldo de Hermes).

**Sin migración.** El dato cabe en `modelo_usado` (`text`, CHECK ≤ 100). No se tocó producción, ni la oficina, ni
staging.

## 1 · Qué pasa hoy

El cable (`lib/studio/oficina/runtime-cliente.ts`) llama a `POST /v1/chat/completions` con `model:
"soporte-chatwoot"`. Antes leía el modelo así: primero `runtime.provider`/`runtime.model`, y si no venían,
`cuerpo.model`.

Leí el código de Hermes **v0.23.1** (`NousResearch/hermes-agent`, etiqueta `v0.23.1`):

| Dónde | Qué devuelve |
|---|---|
| `gateway/platforms/api_server_openai_routes.py`, `_handle_chat_completions` (respuesta sin streaming, l. 1044-1049) | `model: model_name`, donde `model_name = body.get("model")`: **repite el alias que se pidió**. No trae bloque `runtime`. Los encabezados `X-Hermes-*` solo traen la sesión y el estado (completado, parcial, error). |
| `api_server.py`, `_turn_runtime_metadata` / `_finish_turn_result` | El modelo real (`agent.provider`, `agent.model`, que el fallback sobrescribe) solo se adjunta cuando hay ruta pedida o bloqueo de modelo. Sale en `/api/sessions/{id}/chat` y en `/v1/runs`, **no** en `/v1/chat/completions`. |
| `api_server.py`, `_handle_get_session` + `_session_response` (l. 2440-2450) | `GET /api/sessions/{id}` devuelve `session.model` (no devuelve `billing_provider`). |
| `hermes_state_usage.py`, l. 345-357 (`first_accounted_route`) | La fila de la sesión se crea con la ruta pedida. En la **primera llamada con consumo**, Hermes reescribe `model` y `billing_provider` con el modelo vivo: «si esa falla y el fallback responde, la primera llamada con consumo es la ruta que vale». |

La v0.23.3 tampoco agrega `runtime` a `/v1/chat/completions`.

Conclusión: el «soporte-chatwoot» de `modelo_usado` es el eco del alias. El modelo real **no viene en la
respuesta**, pero **sí queda en la sesión**, y el cable la borra al terminar (§3.4 de la 0626).

## 2 · La alternativa mínima (lo que hace esta PR)

1. **El alias deja de guardarse.** Si lo que llega es `soporte-chatwoot`, se toma como «no consta» (`null`), nunca
   como modelo. Si una versión futura de Hermes trae `runtime.provider/model` en la respuesta, se usa eso, como
   antes.
2. **Se lee de la sesión antes de borrarla.** `leerModeloDeSesion` hace `GET /api/sessions/<id>`, con el mismo
   token y un tope de 5 s. Toma **solo** `session.model`, y si viniera, `session.provider` o `billing_provider`.
   Lo hace justo después de la respuesta y antes del `DELETE` de siempre. Nunca lanza: si falla, queda `null`.
3. **Se guarda en `modelo_usado`** del evento `modelo.respuesta`, como hasta ahora. Formato: `proveedor/modelo` si
   se sabe el proveedor; si no, el modelo solo (p. ej. `glm-5.3` o `deepseek-chat`). Solo se aceptan ids limpios
   (`[A-Za-z0-9._:@/+-]`, ≤ 100). Un texto con espacios o más largo queda `null`.

**Proveedor:** la API de la v0.23.1 no publica `billing_provider`, así que con la versión actual lo normal es que
quede el modelo solo. Para la oficina el modelo alcanza: `glm-*` sale por Z.AI y `deepseek-*` por DeepSeek. Si
Hermes empieza a publicarlo, se antepone solo.

**Privacidad:** la respuesta de `GET /api/sessions/<id>` trae también `preview` (un trozo de la conversación),
`title` y tokens. El cable no lee ni guarda nada de eso: lee el JSON en memoria y saca un solo campo. No se loguea
nada. No sale ningún dato nuevo hacia la oficina (es una lectura de la sesión que el cable mismo creó).

**Límite conocido:** Hermes guarda una sola ruta por sesión, la de la primera llamada con consumo. Si dentro de UN
turno la primera llamada al modelo sale bien con GLM y una llamada posterior del mismo turno salta a DeepSeek
(turnos con herramientas), la sesión sigue diciendo GLM. El perfil `soporte-chatwoot` responde en una sola llamada,
sin herramientas, así que en la práctica la fila coincide con quien escribió el borrador. Si eso cambia, hará falta
`/v1/runs` o el desglose por modelo de Hermes (`session_model_usage`), que la API de hoy no expone.

**Lo de antes no se recupera:** las sesiones de la #35 y la #36 ya se borraron (y la purga diaria pasó), así que
para esas dos corridas el modelo no consta. La fuente que queda es el registro del gateway de Hermes en la oficina
(el aviso del fallback), si todavía existe. Eso lo revisa el Director Ofi_Hermes; esta PR no lo toca.

### Por qué no otra cosa

- **Pasarse a `POST /api/sessions/{id}/chat`** (que sí trae `runtime`): cambia la forma de la llamada, el
  idempotency y el borrado, y el `runtime` solo viene completo cuando se pide una ruta, lo que puede fijar el modelo
  y apagar el fallback. Es demasiado para este dato.
- **Pedir `provider`/`model` en el cuerpo:** convierte el pedido en una ruta pedida. En `api_server.py` hay caminos
  en los que una ruta pedida que no se puede atender se rechaza en vez de caer al respaldo. Es justo lo que no
  queremos.
- **Una columna nueva:** no hace falta. `modelo_usado` ya existe, tiene el tope y el permiso de `insert`.

## 3 · Cambios

- `lib/studio/oficina/runtime-cliente.ts`: `ALIAS_DEL_AGENTE`, `idDeModelo`, `leerModeloDeSesion`; `llamarAgente`
  ya no devuelve el alias como modelo.
- `lib/studio/oficina/despachador.ts`: `DepsDespachador.modeloDeSesion?` (opcional). Se llama solo si la respuesta
  no trajo el modelo, después de la llamada y antes del `DELETE`. Un error queda en `null`.
- `app/api/cron/oficina-despachador/route.ts`: conecta `modeloDeSesion` con `leerModeloDeSesion`.

## 4 · Pruebas (CI)

- `lib/studio/oficina/__tests__/despachador-piezas.test.ts`:
  - la forma real de la respuesta de v0.23.1 (sin `runtime`, `model` = alias) da `null`;
  - ids del `runtime`: `zai` + `glm-5.3` da `zai/glm-5.3`; no se repite el proveedor; sin proveedor queda el modelo
    solo; con espacios o más de 100 caracteres, `null`;
  - `leerModeloDeSesion`: `GET /api/sessions/<id>` con el token; devuelve solo el modelo aunque la sesión traiga
    vista previa y título; antepone `billing_provider`; alias, `null`, texto sucio, 404, cuerpo que no es JSON y
    error de red dan `null`, sin lanzar.
- `lib/studio/__tests__/oficina-despachador.test.ts` (PGlite con las migraciones reales):
  - sin modelo en la respuesta, la lectura de la sesión va **antes** del borrado y queda en `modelo_usado`;
  - si la lectura devuelve `null`, lanza o no está conectada, queda `null` (nunca «soporte-chatwoot»);
  - si la respuesta ya trae el modelo, no se consulta la sesión.

Corrí: `despachador-piezas`, `oficina-despachador` y `oficina-paso3b` (70 pruebas, en verde) y `tsc --noEmit` sin
errores en lo tocado. La suite completa la corre el CI.

## 5 · Plan de prueba en staging (NO ejecutado)

> **No se ejecuta sin avisar antes al Director Ofi_Hermes.** Tocar la configuración del perfil en la oficina es suyo.
> Staging no llega al túnel de la oficina: hay que abrirlo de forma temporal con su OK, como en el Paso 3a. En
> producción no se toca nada.

Precondiciones:

- Esta PR desplegada en staging.
- Oficina despausada solo en staging.
- Bandeja de prueba (11) con 3 conversaciones de prueba sin dinero.
- Una ventana anotada de inicio a fin (UTC).
- Perfil `soporte-chatwoot` de staging con `fallback_model` a DeepSeek, igual que en producción.
- Se anota el md5 de su `config.yaml` antes de empezar, para devolverlo igual.

**Prueba M1 · camino normal (GLM):**

1. Un mensaje de prueba en la bandeja 11. Esperar el tick del despachador.
2. Esperado:
   - `modelo.respuesta` con `modelo_usado` = `glm-5.3` (o `zai/glm-5.3`);
   - borrador en «aprobación»;
   - la sesión `cable-<run>-1` borrada (`GET /api/sessions/<id>` da 404).

**Prueba M2 · forzar el respaldo una vez:**

1. En el perfil de staging, dejar el principal sin servicio de forma reversible. Lo preferido: apuntar el modelo
   principal a uno que no existe en el mismo proveedor. Si no, la llave de Z.AI de ese perfil por una inválida.
   Nunca se escribe una llave en chat ni en Git. Reiniciar ese gateway.
2. Un mensaje de prueba. Esperar el tick.
3. Esperado:
   - `modelo_usado` = `deepseek-chat` (o `deepseek/deepseek-chat`);
   - en el log del gateway, el aviso del fallback;
   - borrador en «aprobación»; no sale nada.
4. Devolver la configuración (comparar el md5) y reiniciar. Repetir M1 para ver GLM de nuevo.

**Prueba M3 · los dos proveedores cortados:**

1. Principal y respaldo sin servicio (los dos modelos inexistentes, o las dos llaves inválidas). Reiniciar el
   gateway.
2. Un mensaje de prueba. Esperar el tick.
3. Esperado:
   - Hermes responde 502 `agent_incomplete`;
   - el despachador escala con motivo `runtime:http_502` (o `runtime:red` / `runtime:json` si cae de otra forma);
   - la tarea pasa a escalada con la prioridad de la tarea;
   - el aviso «hay N pendientes» llega al Discord de prueba, y la tarjeta le aparece a Sam en la página de
     aprobación de staging;
   - no hay borrador ni envío, y no hay evento `modelo.respuesta` (no hubo respuesta);
   - la sesión, borrada.
4. Devolver la configuración (md5), reiniciar y repetir M1.

**Al cerrar:**

- pausar la oficina en staging;
- cerrar el túnel temporal;
- confirmar que no quedan sesiones `cable-*` en la oficina de staging;
- anotar en el handoff las horas, los `run_id` y los valores de `modelo_usado`, sin textos de clientes.

## 6 · Qué NO es

- No cambia el fallback ni la cadena de modelos (eso es la Fase B de la 0626).
- No agrega columnas ni migraciones.
- No recupera el modelo de corridas viejas.
- No toca producción.
