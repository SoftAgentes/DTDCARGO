---
sdd: "0296"
title: "Voseo en copy que ve el usuario — y la etiqueta rioplatense que bajó del Norte"
status: in-progress
author: "founder"
created: 2026-08-25
updated: 2026-08-25
supersedes: null
superseded_by: null
related: ["0295"]
confidencialidad: interno
---

# DTD-0296 — El voseo que quedó vivo

> Salió de rebote: barriendo `transition: all` (SDD-0295) aparecieron formas
> rioplatenses en texto que ve el usuario. Regla del founder, dura y no
> negociable: **castellano venezolano neutro, tuteo, cero voseo.**

## Por qué había quedado vivo

Ya existen dos guardas —[`verify-gate.test.ts`](../../../lib/portal/verify-gate.test.ts)
y [`markbox-whatsapp.test.ts`](../../../lib/public/__tests__/markbox-whatsapp.test.ts)—
pero cada una vigila **su propia superficie** (el portal y el mensaje de
WhatsApp del Shipping Mark). Nada mira el Studio, el móvil ni los prompts.

## Medir esto con `grep` no funciona. Tres veces se equivocó

Este barrido se hizo primero con expresiones regulares sobre el archivo crudo y
**dio mal las tres veces**. Vale dejar escrito el porqué, porque el próximo
barrido va a caer en lo mismo.

### 1 · El `\n` escrito en el fuente es la letra `n`

El prompt de `llm-client-anthropic.ts` dice `…</untrusted_content>\n\nUsá las
tools…`. En el **archivo** ese `\n` son dos caracteres: barra y ene. O sea que
el carácter pegado a "Usá" es una **`n`**, y cualquier guarda de límite de
palabra (`\b`, `(?<!\w)`) la toma por letra y **rechaza la coincidencia**.

Un parser resuelve el escape y ve un salto de línea real. Un `grep`, no.

### 2 · Un comentario no es copy

`grep` no distingue `// tenés permiso` de `"Revisá la configuración"`. El
primer barrido devolvió **45** resultados: ~40 eran comentarios y mensajes de
error para desarrollador. Enterrado ahí, lo que sí importaba.

### 3 · Los enclíticos no estaban en la lista

`mandame`, `contame`, `devolveme`, `fijate` no terminan en `-á/-és`, así que
ninguna lista de terminaciones los agarra. **En tuteo llevan tilde**
(`mándame`, `cuéntame`, `fíjate`) porque quedan esdrújulas; en voseo son llanas
y van sin tilde. La grafía sola los separa — pero hay que nombrarlos uno por
uno.

### Lo que sí funciona

Recorrer el AST con el parser de TypeScript y mirar **solo** `StringLiteral`,
plantillas y `JsxText`. Sin comentarios, sin identificadores, sin escapes sin
resolver. Con lista explícita de formas (nunca detección morfológica: la regla
de enclíticos matchea inglés en masa — `create`, `update`, `template`).

Medición final: **5 apariciones en 4 archivos**, cero falsos positivos.

## Lo que se corrigió

### Voseo (5 apariciones · 4 archivos)

| Archivo | Antes | Ahora |
|---|---|---|
| `clientes/…/ClientDrawer.tsx` | «**Capturá** visitando al cliente» | «Captúrala visitando al cliente» |
| `mailing/actions.ts` | «**Revisá** la configuración.» | «Revisa la configuración.» |
| `agents/runtime/llm-client-anthropic.ts` | «**Usá** las tools… y **devolveme** el JSON» | «Usa las tools… y devuélveme el JSON» |
| `agents/runtime/llm-client-mock.ts` | «**mandame** el código del envío» | «mándame el código del envío» |

Los dos últimos son los caros:

- 🔴 **El prompt del agente induce la respuesta.** El modelo imita el registro
  de quien le habla, y su salida sí es pantalla. El copy se mira en cada
  `/ui-check`; los prompts no los mira nadie porque no son pantalla.
- 🔴 **El mock no es solo de pruebas.**
  [`llm-client-factory.ts:24`](../../../lib/studio/agents/runtime/llm-client-factory.ts)
  elige `!forceMock && hasKey ? "anthropic" : "mock"` — **sin API key cae al
  mock en producción**. Ese texto puede leerlo un cliente el día que la llave
  falte o expire.

### «Cerca tuyo» → «Cerca de ti» (10 sitios · 5 archivos)

Posesivo usado como adverbio: rioplatense; en Venezuela es «cerca de ti». No es
voseo, así que ninguna lista de formas verbales lo agarra — apareció leyendo.

Es el **nombre de una función**, referenciado en 10 lugares (1 etiqueta de
botón, 2 textos de ayuda visibles, 7 comentarios). Se renombraron los 10: dejar
los comentarios apuntando a una etiqueta que ya no existe es peor que no tocar
nada.

## ⚠️ Esto crea una divergencia contra el Norte, a propósito

**«Cerca tuyo» no lo inventó nadie acá: bajó del Norte.** El mockup de Cloud
Design lo trae así en
[`_norte/mobile/app.jsx:526`](../../design/studio/_norte/mobile/app.jsx) y en su
`CHANGELOG.md`.

El material del Norte **no se edita desde acá** — llega por NORTE-SYNC. Así que
a partir de este commit el código y el Norte dicen cosas distintas, y `/radar`
lo va a reportar como drift. **Es intencional**, y queda anotado acá para que no
se lea como un descuido:

- El Norte es autoridad de **diseño**; la regla de castellano venezolano es del
  founder y pesa más sobre el copy.
- **Pendiente aguas arriba:** pedirle a Cloud Design que corrija la etiqueta en
  el próximo NORTE-SYNC. Hasta que baje, la divergencia se mantiene.

## Lo que NO trae: el gate

**No se agregó el test que barre todas las superficies**, aunque acá está
escrito y midiendo. Esa decisión ya se tomó y es del founder, no mía: una lista
de palabras puede dar falsos positivos, y un test inestable en el gate
compartido afecta a las 15-20 ventanas que trabajan en paralelo.

Lo que cambió desde entonces es la **evidencia**, y por eso vale volver a
preguntarlo:

- La detección va por **AST**, no por texto plano — no puede confundir un
  comentario, un identificador ni un escape con copy.
- Corrida sobre `app/`, `components/` y `lib/` completos: **5 hallazgos, 0
  falsos positivos.**
- Con dos archivos en lista de permitidos, los que nombran las formas para
  prohibirlas o probarlas.

El detector **sí queda en el repo**, como script suelto:

```bash
node scripts/buscar-voseo.mjs
```

Se corre a mano y sale 1 si encuentra algo, listo para un hook el día que se
decida. **Sin gate, esto vuelve** — es la tercera vez que se barre voseo y la
tercera que quedaron sitios vivos.

## Verificación

1. Re-medición con el detector AST: **0 apariciones**.
2. `grep -rn "Cerca tuyo"` sobre `app/`, `components/`, `lib/`: **0**.
3. Ningún test depende de los textos cambiados (se buscó en `e2e/` y en los
   `__tests__/`).
4. **El detector se validó por mutación**, con el caso más difícil: se volvió a
   meter el voseo en el prompt (el del salto escrito como escape, el que
   engaña al grep) y
   `buscar-voseo.mjs` salió en rojo con 2 apariciones y exit 1. En la misma
   corrida, un `grep -cP '(?<!\w)Usá(?!\w)'` sobre ese archivo devolvió **0**.
   La trampa del escape queda medida, no argumentada.
5. Gate completo `node scripts/verify.mjs`.

## Lo que esta spec NO puede afirmar

- **Que no quede voseo fuera de la lista.** La detección es por lista explícita:
  cubre lo que nombra. Una forma que nadie anotó sigue invisible — es el límite
  del método, no un descuido de esta corrida.
- **Que las pantallas se vean bien.** Nada se abrió en un navegador.
