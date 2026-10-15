---
sdd: "0525"
title: "Modelos de Anthropic vacíos caen a su respaldo: acta, Escucha Activa y resumen mensual"
status: in-progress
author: "Claude"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0523", "0518", "0505", "0146", "0150", "0149"]
confidencialidad: interno
---

# SDD-0525 — Modelos de Anthropic vacíos caen a su respaldo

> Si `BITACORA_ACTA_MODEL`, `BITACORA_ESCUCHA_MODEL` o `CONVERSATION_DIGEST_MODEL`
> están definidas pero vacías, o tienen sólo espacios, se tratan igual que si no
> estuvieran definidas: se pasa a la siguiente de la cascada y, al final, a
> `claude-sonnet-4-6`. El valor elegido se usa recortado. Es el caso que la
> [0523](../0523-unsubscribe-secreto-vacio/spec.md) dejó aparte en su inventario
> porque estas variables no son secretos.

## Contexto

Docker Compose pasa `VAR=` como cadena vacía, no como `undefined`, y
`"" ?? respaldo` es `""`. En la base `a8d99acf` los tres sitios leían el modelo
con `??`:

| Sitio | Lectura en `a8d99acf` | Quién lo usa |
|---|---|---|
| `lib/studio/bitacora/extract.ts:263` | `BITACORA_ACTA_MODEL ?? DEFAULT_MODEL` | acta de Bitácora (`app/studio/(app)/bitacora/actions.ts:600` y `:878`) |
| `lib/studio/bitacora/escucha-extract.ts:110-112` | `BITACORA_ESCUCHA_MODEL ?? BITACORA_ACTA_MODEL ?? DEFAULT_MODEL` | Escucha Activa (`bitacora/actions.ts:808`) |
| `lib/studio/conversaciones/digest-extract.ts:26-29` | `CONVERSATION_DIGEST_MODEL ?? BITACORA_ACTA_MODEL ?? "claude-sonnet-4-6"`, leído al cargar el módulo | resumen mensual interno y para el cliente (`monthly-digest.ts:98` y `:111`); el `model` devuelto se guarda junto al resumen (`monthly-digest.ts:135`) |

Con la variable vacía, la llamada a Anthropic salía con `model: ""`, y con un
espacio al final, con un ID que no existe. Los tres sitios atrapan el error:
el acta y la Escucha Activa devuelven «Falló el análisis con IA: …» y «Falló la
Escucha Activa: …» a la acción de Bitácora, y el resumen mensual lo registra en
el log y salta la conversación (`monthly-digest.ts:99-106`). En la cascada, además, una
`BITACORA_ESCUCHA_MODEL` vacía tapaba una `BITACORA_ACTA_MODEL` bien puesta.

La plantilla del servidor propio (`infra/dtd-cargo/.env.example:126-128`) trae
las tres vacías, y el runbook (`docs/runbooks/servidor-contabo.md:589`) decía
«`BITACORA_ACTA_MODEL` (vacío = `claude-sonnet-4-6`)», lo que en `a8d99acf` era
falso. La #224 (`818cccf0`, fusionada mientras esta PR estaba abierta) corrigió
esa línea para decir que la vacía no cae al default y que se borra del `.env`, y
registró en el runbook (§3.6, 2026-10-15 05:36Z) que se borraron del `.env` del
servidor las líneas vacías que ningún compose interpola. Esta spec quita la
dependencia de ese borrado; la línea del runbook quedó unida en el merge (ver
Compatibilidad).
*No verificado aquí:* el `.env` vivo del servidor (no se leyó) y el código de
error exacto que devuelve la API con `model: ""` (no hay clave en este worktree
y no se gasta una llamada para medirlo).

## Decisión

Helper nuevo [`lib/runtime/server-setting.ts`](../../../lib/runtime/server-setting.ts):

```ts
export function firstConfiguredSetting(
  ...candidates: ReadonlyArray<string | null | undefined>
): string | null {
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed !== "") return trimmed;
  }
  return null;
}
```

- Vacía o con sólo espacios (incluye tabuladores y saltos de línea) cuenta como
  ausente y se pasa a la siguiente.
- **El valor elegido se devuelve recortado.** Un ID de modelo no lleva espacios;
  uno pegado con un espacio al final no nombra ningún modelo. Es lo contrario de
  `firstConfiguredSecret` de la 0523, que devuelve el secreto tal cual porque
  recortarlo cambiaría la clave. Por eso son dos funciones y no una con opción.
- Sin ninguno, `null`, y cada sitio pone su default con `??`, que ahora sólo ve
  `string | null`.
- Recibe valores y no nombres, igual que el de la 0523, para que cada sitio siga
  escribiendo `process.env.X` literal y se encuentre con un grep.

### Por qué no se reutiliza `server-secret.ts`

Cuando se escribió esta spec, la PR #225 (SDD-0523) estaba abierta y
`lib/runtime/server-secret.ts` no estaba en `main`; depender de ella habría
apilado esta PR. La #225 se integró después (`7075883e`) y esta rama la trajo por
merge sin conflictos: el índice `docs/specs/README.md` lo resolvió el driver.
La razón de fondo no cambia: su regla de no recortar no sirve aquí. Ahora
`lib/runtime/` tiene los dos helpers, cada uno con su regla.

`lib/runtime/app-env.ts:48-51` ya tiene un `nonEmpty` privado con la misma regla
(recorta y devuelve `null` si queda vacío). No se exporta ni se toca: es parte
del detector de entorno y cambiarlo no es de este encargo.

### Sitios corregidos

| Sitio | Antes | Después |
|---|---|---|
| `extract.ts` | `BITACORA_ACTA_MODEL ?? DEFAULT_MODEL` | `firstConfiguredSetting(BITACORA_ACTA_MODEL) ?? DEFAULT_MODEL` |
| `escucha-extract.ts` | `BITACORA_ESCUCHA_MODEL ?? BITACORA_ACTA_MODEL ?? DEFAULT_MODEL` | `firstConfiguredSetting(BITACORA_ESCUCHA_MODEL, BITACORA_ACTA_MODEL) ?? DEFAULT_MODEL` |
| `digest-extract.ts` | `CONVERSATION_DIGEST_MODEL ?? BITACORA_ACTA_MODEL ?? "claude-sonnet-4-6"` | `firstConfiguredSetting(CONVERSATION_DIGEST_MODEL, BITACORA_ACTA_MODEL) ?? "claude-sonnet-4-6"` |

El orden de la cascada y los defaults no cambian. El digest sigue leyendo el
modelo al cargar el módulo; pasarlo a cada llamada sería otro cambio de conducta
y no hace falta para esto.

### Compatibilidad

- Variable sin definir: nada cambia.
- Variable definida sin espacios: nada cambia.
- Variable vacía o con sólo espacios: antes fallaba la llamada; ahora usa el
  siguiente de la cascada o `claude-sonnet-4-6`.
- Variable con espacios en los bordes: antes fallaba la llamada; ahora usa el
  valor recortado. El `model` que guarda el resumen mensual también sale recortado.
- Operación del servidor: el arreglo sólo existe en una imagen construida con
  esta spec. Por eso el runbook (`servidor-contabo.md:589`) dice las dos cosas:
  desde la 0525 la línea vacía cae al default; con una imagen anterior no, y si
  no hay modelo elegido la línea se borra del `.env` igual que las demás vacías.

## Fuera de alcance

Otras lecturas de modelo en el repo, sin el patrón `??`:

- `DOCUMENT_IMPORT_MODEL` (`lib/studio/document-import/anthropic.ts:37`): con
  `""`, `!model` lo trata como no configurado y la lectura asistida se apaga con
  `configuration_missing`, que es lo esperado. Con sólo espacios pasaría como
  modelo y la llamada fallaría. No tiene default al que caer.
- `CF_WHISPER_MODEL` (`lib/studio/bitacora/transcribe.ts:60`): usa `||`, así que
  `""` ya cae al default. Con sólo espacios no. Es Cloudflare, no Anthropic.

Quedan anotados en el handoff.

## Aceptación

- [x] `BITACORA_ACTA_MODEL` vacía o con sólo espacios: el acta pide `claude-sonnet-4-6`.
- [x] `BITACORA_ESCUCHA_MODEL` vacía o con sólo espacios: la Escucha Activa usa
  `BITACORA_ACTA_MODEL` si está configurada, y si no, `claude-sonnet-4-6`.
- [x] `CONVERSATION_DIGEST_MODEL` vacía o con sólo espacios: los dos resúmenes
  mensuales usan `BITACORA_ACTA_MODEL` si está configurada, y si no,
  `claude-sonnet-4-6`; el `model` devuelto es el mismo que se pidió.
- [x] Definidas: se usa su valor, recortado; en la cascada gana la primera.
- [x] Sin definir: el default de siempre.
- [x] Control rojo contra `a8d99acf` y mutantes muertos.
- [x] El runbook y el `.env.example` de la raíz dicen lo que hace el código.

## Allowlist

- `lib/runtime/server-setting.ts` (nuevo) y `lib/runtime/__tests__/server-setting.test.ts`.
- `lib/studio/bitacora/extract.ts`, `lib/studio/bitacora/escucha-extract.ts` y
  `lib/studio/bitacora/__tests__/modelo-vacio.test.ts`.
- `lib/studio/conversaciones/digest-extract.ts` y
  `lib/studio/conversaciones/__tests__/digest-modelo-vacio.test.ts`.
- `docs/runbooks/servidor-contabo.md` (una línea) y `.env.example` (comentario).
- `docs/specs/0525-modelos-anthropic-vacios/spec.md` y `docs/specs/README.md` (índice regenerado).
- `.agents/handoffs/0525-modelos-anthropic-vacios.md`.

## Evidencia

- **Pruebas nuevas:** 40 casos en 3 archivos, en verde. Cada caso de los
  extractores importa el módulo de nuevo después de fijar el entorno y dobla el
  SDK de Anthropic: se mira el `model` que llega a `messages.create` y, en el
  digest, también el `model` devuelto. Suites vecinas (`lib/runtime`,
  `lib/studio/bitacora`, `lib/studio/conversaciones`): 26 archivos, 415 casos,
  en verde.
- **Control rojo** (las pruebas de los tres sitios contra el código de
  `a8d99acf`): **18 fallan y 14 pasan**. Fallan justo los casos con la variable
  vacía, con sólo espacios o con espacios alrededor; pasan los de variable
  definida sin espacios o sin definir. Por ejemplo, el acta con
  `BITACORA_ACTA_MODEL=""` pedía `model: ""`, y la Escucha Activa con
  `BITACORA_ESCUCHA_MODEL=""` y `BITACORA_ACTA_MODEL=claude-acta` pedía `""`
  en vez de `claude-acta`.
- **Mutantes** (10, todos sobre líneas del diff; control verde 40/40; cada uno
  cuenta como muerto sólo si la salida trae la línea `Tests` con fallos):
  helper sin `trim` al decidir (10 fallan), helper que devuelve sin recortar
  (5), helper que corta en el primer `undefined` (4), helper que devuelve `""`
  en vez de `null` (16), acta con `??` (3), Escucha sin respaldo al acta (3) o
  con el orden invertido (2), digest sin respaldo al acta (6) o con el orden
  invertido (4), digest con otro default (6). **Los 10 mueren.**

## Registro de integración (2026-10-15)

- **PR:** #226 (`claude/nostalgic-grothendieck-e4f689`). Cabeza `6e75451e` fusionada con `--match-head-commit`; merge `f3651f24` a las 11:35:29Z.
- **CI:** «Calidad continua» PASÓ sobre esa cabeza (run 38726650430), con la suite y el build. `pnpm verify` local: NO EJECUTADO (una corrida pesada a la vez; el CI corre la suite completa).
- **Deploy:** el status de Vercel del merge dice «Deployment has completed» (11:37:00Z). El ID del deployment y el alias quedan NO VERIFICADOS: el conector de Vercel responde 403.
- **Docs:** el parche de la sesión dueña («spec y handoff con la #225 ya en main») entró en este cierre, y la cabecera de `infra/dtd-cargo/.env.example` dejó de nombrar los modelos como lecturas que no caen al respaldo.
- **Smoke:** NO APLICA uno de pantalla (sin cambio visible; los modelos vacíos caen a su respaldo).
- **Estado:** integrada.
