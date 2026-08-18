# Handoff · SDD-0270 · El vínculo cliente ↔ contacto de Kommo — cierre 2026-08-18

> Todo lo de acá está **medido** contra producción o corriendo el gate. Donde
> hay un número, hay una consulta detrás. Donde no se pudo medir, lo dice.

**Rama:** `feat/sdd-0270-vinculo-cliente-contacto` · **Worktree:**
`DTD-worktrees/vinculo` · desde `origin/main@5c3aed29`.

Nació de un pedido de "dale con el bloque E". **El bloque E sigue siendo trabajo
de navegador del founder** — pero su Parte 2 estaba muerta antes de empezar, y
eso es lo que se atendió.

## Lo que quedó EN PRODUCCIÓN

| Commit | Qué |
|---|---|
| `10b5a961` | Migración 0383 + barrido + enrutador por clave exacta + escaneo del tope en el gate |
| `10bc44c8` | El resultado medido: no era un problema de vinculación, es de cobertura |

- **Migración `0383_clients_phone_last10_y_vinculo`** aplicada (OK del founder
  nombrándola). Verificada **contra el objeto**: columna `ALWAYS` generada,
  índice creado, función viva, 1 fila en el ledger con el basename exacto.
- **`kommo-webhook` desplegada: v7 → v8**, ACTIVE, `verify_jwt` sigue en
  `false`. Las otras 3 funciones, sin tocar (mismos hashes).
- **Barrido corrido**: 30 vinculados · **32 → 62** de 457.

## 1. El bug latente que apareció en el camino (lo más serio)

`loadPhoneUniverse` pedía `.limit(10000)` y **PostgREST corta en 1.000**. Con 457
clientes no truncaba — pero al pasar de mil, **el truncamiento se invierte**:

`decideRoute` exige **un único** candidato; dos clientes con el mismo teléfono es
*ambiguo* y no se toca, justamente para no estampar el Shipping Mark de otra
persona. Si el universo llega recortado, **el segundo candidato —el que vuelve
el cruce ambiguo— puede ser el que se cayó**, y entonces `hits.length === 1` da
match único: escribe el Mark del cliente equivocado.

🔴 **Ese sitio quedó fuera del barrido de los 105, y NO por olvido.** La regla de
ESLint cubre `lib/**` y `app/**`; `supabase/functions/**` está en el **ignore
global** de ESLint porque corre en Deno. **El punto ciego es estructural.** Era
el único `.limit` alto vivo en todo el repo, y estaba en la decisión más
delicada del CRM.

**Cerrado en dos capas:** el enrutador filtra por clave exacta
(`.in("phone_last10", claves)`), y el escaneo del tope vive ahora en
`scripts/check-edge-functions.mjs`, que sí es dueño de esa carpeta.

⭐ **Y el tope dejó de poder mentir:** si mil clientes compartieran una clave,
cualquier conteo ≥2 ya es ambiguo. **Truncar no puede convertir un ambiguo en un
único.** La propiedad de seguridad ya no depende de que la tabla sea chica.

⚠️ El escaneo corre **antes** de buscar Deno a propósito: leer archivos no lo
necesita, y colgarlo del camino de Deno lo volvería un chequeo que se omite en
silencio cada vez que no haya binario.

## 2. La guarda bidireccional, que es lo que no es obvio

`decideRoute` exige un único **cliente** por teléfono, porque en vivo se enruta
*desde* un contacto conocido. **Un barrido además elige contacto**, así que
necesita un único **contacto** por teléfono. Guardar una sola dirección deja el
bug vivo por la otra: dos contactos de Kommo con el mismo número harían que se
elija uno al azar.

Tercera guarda: un contacto ya vinculado a otro cliente no se reutiliza; y el
`UPDATE` nunca pisa un vínculo existente.

⛔ **El barrido nace en seco** (`p_aplicar` es `false`). Correrlo sin argumentos
informa y no escribe.

## 3. 🔴 El resultado que importa es NEGATIVO

**De los 62 clientes vinculados, CERO tienen saldo y CERO tienen carga en
tránsito.** El ERP tiene 2 con saldo y 6 con carga: los mismos de antes.
**Ninguno fue rescatado.**

Diagnóstico de los 6 clientes relevantes (los conjuntos se solapan):

| Motivo | Cuántos |
|---|---|
| Sin teléfono utilizable | 1 |
| **Teléfono que no existe entre los 3.228 contactos de Kommo** | **5** |
| Ambiguos | 0 |

⭐ **No es un problema de vinculación: es de cobertura.** Los clientes que deben
plata o tienen carga navegando **no están en Kommo** — nunca entraron por el CRM.
Ninguna heurística puede inventar un contacto que no existe.

**Para el bloque E:** crear los 2 campos de contacto sigue valiendo la pena (el
job les escribiría "No/No" a 62 contactos), pero **no va a hacer que el agente de
IA sepa quién debe plata**, que era el motivo de crearlos. Los 5 campos de lead
(Parte 1) y el reparto (Parte 3) no dependen de esto.

## 4. Cómo se validó

**Contrato SQL** `supabase/tests/0383_…test.sql` — 11 casos, carga la migración
real con `\i`. **6 de 6 mutaciones atrapadas.**

🔴 **Dos sobrevivieron en la primera vuelta, y eso corrigió el contrato.** Los
casos 4 y 4b **no aislaban** lo que decían medir: en su escenario había dos
clientes con el mismo teléfono, así que la guarda de *cliente único* ya bloqueaba
sola y las otras dos nunca se ejercitaban. Los casos 9 y 10 las aíslan.

El contrato destapó además **dos defectos reales de la migración** antes de que
tocara ninguna base: `min(uuid)` no existe en Postgres, y `on commit drop` sólo
dispara al COMMIT (dos llamadas en la misma transacción chocaban).

**El escaneo del tope** se validó igual: rojo al reintroducir un `.limit(5000)`,
verde al quitarlo. Su primera versión **se disparó con el comentario que explica
el bug** —ahí dice `.limit(10000)` en prosa—, así que ahora ignora comentarios:
un escaneo que no distingue código de prosa convierte en rojo a quien documenta.

**Gate:** verde completo sobre el SHA fusionado `b446cb18` — 13 de 13 pasos
medidos, e2e sin siquiera el aviso de WebKit. El SHA validado es el que se
pusheó.

## 5. Dos cosas de proceso que valen para la próxima

**Desplegar con la CLI, no con el MCP.** El MCP `deploy_edge_function` obliga a
re-transcribir 60 KB de fuente en la llamada, y un carácter mal rompe el enrutado
de leads en vivo. La CLI lee del disco:

```bash
npx --yes supabase@latest functions deploy kommo-webhook \
  --project-ref xpfuzqombmjmxvprjgmi --use-api --no-verify-jwt --workdir <ruta>
```

⚠️ **`--no-verify-jwt` no es opcional**: sin `config.toml` la CLI pondría
`verify_jwt: true` y **Kommo dejaría de poder llamar al webhook**. Mirá primero
la función viva con `list_edge_functions`. Y nunca `--prune`.

**Pushear no despliega las Edge Functions.** El arreglo del bloque D
(`paginateTwoPass` avisa cuando trunca) estaba en `main` desde el 17-ago sin
desplegar; se publicó de rebote acá porque es dependencia del webhook.
🔴 **`kommo-sync` sigue con el código viejo** — es la que poda el espejo, o sea
donde ese aviso más importa. Deploy pendiente.

## 6. Pendiente

- ⭐ **Decisión de negocio:** ¿la cartera del ERP sube al CRM, o Kommo sólo lleva
  prospectos? De eso depende que el hueco de cobertura se cierre alguna vez.
- **Desplegar `kommo-sync`** para que el aviso de lectura parcial entre en vigor.
- **Bloque E**, sin cambios: 7 campos en el navegador de Kommo + las dos
  decisiones sobre asesores reales. Ver
  [`docs/marketing/kommo-campos-y-cartera.md`](../../docs/marketing/kommo-campos-y-cartera.md).
- **8 ambiguos** (1 por cliente duplicado, 7 por contactos duplicados en Kommo):
  son dato sucio, y limpiarlos es trabajo humano — ninguna heurística puede
  resolverlos sin arriesgarse a estampar el Mark de otra persona.
