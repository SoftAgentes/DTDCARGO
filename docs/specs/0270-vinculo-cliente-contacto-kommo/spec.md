---
sdd: 0270
title: El vínculo cliente ↔ contacto de Kommo deja de depender del azar
status: in-progress
author: Claude (ventana 2026-08-18)
created: 2026-08-18
updated: 2026-08-18
supersedes: null
superseded_by: null
related: [0043, 0058, 0244, 0256]
confidencialidad: interna
---

# SDD-0270 · El vínculo cliente ↔ contacto de Kommo deja de depender del azar

## Problema

El SDD-0256 (Fase 5, bloque B4) construyó el job que le escribe a Kommo el
estado comercial del cliente —*tiene saldo pendiente*, *carga en tránsito*— para
que el agente de IA escale a un humano en vez de responder a ciegas.

**Ese job hoy no le escribe nada a nadie.** Medido el 2026-08-14: de 447
clientes vivos, **32 tienen `kommo_contact_id`** (7,2%), y de esos 32 **ninguno**
tiene saldo ni carga. Los 2 clientes con saldo y los 6 con carga navegando **no
están vinculados a ningún contacto**.

La causa no es un bug: es que **el vínculo sólo se establece de forma
reactiva.** `kommo-webhook` cruza por teléfono cuando entra un lead nuevo y
auto-sana *ese* cliente. Los 447 clientes y los 3.161 contactos que ya existían
**nunca se cruzaron entre sí**. Los 32 vinculados son los que casualmente
escribieron desde que el auto-sanado existe.

Mientras eso siga así, la Parte 2 del bloque E —crear los 2 campos de contacto
en Kommo— no sirve de nada: los campos quedarían vacíos.

### 🔴 Y hay un segundo problema, más serio, en el mismo camino

`loadPhoneUniverse` (`kommo-webhook/index.ts`) se traía **la tabla entera** de
clientes con `.limit(10000)` para cruzar en memoria. **PostgREST corta en
1.000.** Con 447 clientes hoy no trunca — pero al pasar de mil, el truncamiento
**se invierte de la peor forma posible**:

`decideRoute` exige **un único** candidato para aceptar el cruce; dos clientes
con el mismo teléfono es *ambiguo* y no se toca, precisamente para no estampar
el Shipping Mark de otra persona. Si el universo llega recortado, **el segundo
candidato —el que vuelve el cruce ambiguo— puede ser justo el que se cayó**, y
entonces `hits.length === 1` da match único. El enrutador escribiría el Shipping
Mark del cliente equivocado, que es exactamente lo que ese código dice evitar.

Ese sitio quedó **fuera del barrido de los 105** (SDD del tope de 1.000 filas):
la regla de ESLint cubre `lib/**` y `app/**`, y `supabase/functions/**` está en
el **ignore global** de ESLint porque corre en Deno. **El punto ciego es
estructural, no un olvido.** Era el único `.limit` alto vivo en todo el repo, y
estaba justo en la decisión más delicada del CRM.

## Solución

### 1. `clients.phone_last10` — columna GENERADA

Gemela exacta de `kommo_contacts.phone_last10` (migración 0363) y de
`phoneKey()` (`_shared/kommo-router.ts`): últimos 10 dígitos, **NULL si hay
menos de 10**. Un número incompleto no se cruza.

Generada y no escrita: **no puede driftear**. Hoy `clients` sólo tiene un
*índice* sobre la expresión, y un índice no se puede filtrar desde PostgREST —
por eso el enrutador traía la tabla entera.

### 2. El enrutador filtra por clave exacta

`loadPhoneUniverse` → `loadClientesPorClaves(claves)`, con `.in("phone_last10",
claves)`. El universo deja de existir.

⭐ **Y el tope deja de poder mentir:** si mil clientes compartieran una clave,
cualquier conteo ≥2 ya es ambiguo. **Truncar no puede convertir un ambiguo en un
único.** La propiedad de seguridad ya no depende de que la tabla sea chica.

### 3. `kommo_vincular_clientes_por_telefono()` — el barrido

Aplica **una vez** el mismo criterio que el enrutador aplica en vivo.

⛔ **Nace en seco.** `p_aplicar` es `false` por default: correrla sin argumentos
informa y no escribe. Es deliberado — toca datos de clientes reales.

**La guarda es bidireccional, y ahí está todo el asunto.** `decideRoute` exige
un único **cliente** por teléfono, porque en vivo se enruta *desde* un contacto
conocido. Un barrido además **elige contacto**, así que necesita un único
**contacto** por teléfono. Guardar una sola dirección deja el bug vivo por la
otra: dos contactos de Kommo con el mismo número harían que se elija uno al
azar. Tercera guarda: un contacto ya vinculado a otro cliente no se reutiliza, y
el `UPDATE` nunca pisa un vínculo existente.

### 4. El escaneo del tope, en el paso que sí es dueño de esa carpeta

`scripts/check-edge-functions.mjs` gana un escaneo de `.limit(N>1000)` sobre
`supabase/functions/**`. Corre **antes** de buscar Deno a propósito: leer
archivos no lo necesita, y colgarlo del camino de Deno lo volvería un chequeo
que se omite en silencio cada vez que no haya binario.

## Verificación

**Contrato SQL** `supabase/tests/0383_…test.sql` — 11 casos, carga la migración
real con `\i`. **6 de 6 mutaciones atrapadas.**

Dos mutaciones sobrevivieron en la primera vuelta y eso corrigió el contrato:
los casos 4 y 4b **no aislaban** lo que decían medir. En su escenario había dos
clientes con el mismo teléfono, así que la guarda de *cliente único* ya
bloqueaba sola y las otras dos nunca se ejercitaban. Los casos 9 y 10 las
aíslan: un contacto ya usado con **un solo** cliente candidato, y un cliente ya
vinculado cuyo teléfono matchea limpio con **otro** contacto.

| Mutación | La atrapa |
|---|---|
| Se quita la guarda de un solo contacto | CASO 6 |
| Se quita la guarda de un solo cliente | CASO 5 |
| Se reutiliza un contacto ya vinculado | CASO 9 |
| El barrido deja de nacer en seco | CASO 2a |
| La columna generada deja de exigir 10 dígitos | CASO 1c |
| El `UPDATE` deja de proteger un vínculo existente | CASO 10 |

El contrato también destapó **dos defectos reales de la migración** antes de que
llegara a ninguna base: `min(uuid)` no existe en Postgres, y `on commit drop`
sólo dispara al COMMIT (dos llamadas en la misma transacción chocaban).

**El escaneo del tope** se validó igual: rojo al reintroducir un `.limit(5000)`,
verde al quitarlo. Su primera versión se disparó con **el comentario que explica
el bug** —ahí dice `.limit(10000)` en prosa—, así que ahora ignora comentarios:
un escaneo que no distingue código de prosa convierte en rojo a quien documenta.

## Pendiente del founder

⛔ **La migración NO se aplicó.** Escribir `clients.kommo_contact_id` en
producción necesita OK nombrando el archivo, por
[`docs/runbooks/aplicar-migraciones-prod.md`](../../runbooks/aplicar-migraciones-prod.md).

**El orden recomendado, y por qué:**

1. Aplicar `0383_clients_phone_last10_y_vinculo.sql` — sólo agrega la columna,
   el índice y la función. **No vincula nada todavía.**
2. Correr **en seco** y leer el informe:
   ```sql
   select public.kommo_vincular_clientes_por_telefono('<tenant_id>');
   ```
   Devuelve `candidatos`, `vinculables`, `ambiguo_varios_clientes`,
   `ambiguo_varios_contactos` y `sin_clave_telefono`. **Nadie sabe todavía
   cuántos son** — este documento no lo estima porque no se pudo medir contra
   producción desde esta ventana.
3. Con el número a la vista, decidir si se aplica:
   ```sql
   select public.kommo_vincular_clientes_por_telefono('<tenant_id>', true);
   ```

⚠️ **Los `ambiguo_*` no son un error: son trabajo humano.** Cada uno es dato
sucio —dos clientes con el mismo teléfono, o dos contactos duplicados en
Kommo— y ninguna heurística puede resolverlos sin arriesgarse a estampar el
Mark de otra persona.
