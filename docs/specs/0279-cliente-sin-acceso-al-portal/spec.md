---
sdd: "0279"
title: "El cliente que ya es cliente deja de pedir un enlace que nadie le manda"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-08-23
updated: 2026-08-23
supersedes: null
superseded_by: null
related: ["0094", "0253", "0276", "0278"]
confidencialidad: interno
---

# DTD-0279 — El cliente que ya es cliente deja de pedir un enlace que nadie le manda

> SDD-0278 dejó esto anotado como pendiente de decisión y **recomendó una salida
> que resultó estar equivocada**. Al medirla contra el código antes de
> construirla, mandar a esa gente a `/registro` no los saca del hueco: los mete
> en uno peor. Esta spec documenta la medición y toma el otro camino.

## 1. El problema

`/entrar` responde lo mismo exista o no la cuenta, a propósito, para que nadie
pueda averiguar qué correos son clientes (SDD-0094). El costo es que **quien es
cliente pero nunca fue invitado al portal** ve "te enviamos el enlace" y espera
para siempre.

Según la medición de SDD-0278 (2026-08-21, producción): de **477 clientes vivos,
359 no tienen ninguna fila de acceso**. ⚠️ Ese conteo **no se volvió a medir** al
escribir esta spec — el conector de Supabase no estaba autorizado en la sesión.
Se cita como venía, no como dato fresco.

## 2. Por qué `/registro` NO era la salida

Medido el 2026-08-23 **contra el código**, no recordado. Falla de dos maneras
distintas, y cuál te toca depende de si tu ficha tiene documento cargado:

| Caso | Qué pasa hoy |
|---|---|
| **Con RIF/cédula** | El alta choca con `clients_tenant_doc_unique` y responde *"Este documento ya tiene una cuenta … Entra con tu Shipping Mark"* → lo devuelve a `/entrar` → donde no le llega nada. **Bucle cerrado.** |
| **Sin documento** | Ese índice es **parcial** (`where rif is not null and btrim(rif) <> ''`), así que no lo cubre: el alta procede y le emite **un cliente nuevo con un Shipping Mark nuevo**. Sus envíos y facturas quedan colgando del markbox viejo. |

Evidencia: [`0095_clients_rif_unique.sql:35-38`](../../../supabase/migrations/0095_clients_rif_unique.sql)
(el `where` del índice) y [`app/registro/actions.ts:284`](../../../app/registro/actions.ts)
(el mensaje del 23505).

**No se midió** cuántos de los 359 caen en cada lado: eso sale de consultar
producción.

## 3. Qué cambia

Cuando `/entrar` no encuentra fila en `client_users`, ahora pregunta si esa
dirección es de un **cliente vivo del ERP**:

1. **Sí** → salen dos avisos. Al **cliente**, para que no siga esperando; al
   **equipo**, con el Shipping Mark, para que lo habilite por el flujo de
   invitación que ya existe y es LIVE. Un humano en el medio.
2. **No** → **no sale ningún correo**. Éste es el candado que impide usar
   `/entrar` para mandarle correo de DTD a un tercero cualquiera.

La pantalla es **idéntica en los tres casos** (con acceso, cliente sin acceso,
desconocido): el oráculo de enumeración sigue cerrado.

**Decisión del founder (2026-08-23):** enlace automático **no**. El email de
`clients` lo cargó el equipo —importaciones, planillas—, no lo confirmó el
titular; un tipeo entrega los envíos y las facturas de un cliente a un
desconocido.

## 4. Qué NO lleva el correo al cliente

Ni su nombre ni su Shipping Mark. Por lo mismo de arriba: si la dirección tiene
un tipeo y es de otra persona, un correo que dijera *"Hola Fulano, tu Shipping
Mark es DTD-1234"* le entrega a un extraño el nombre y el identificador. Genérico,
lo peor que pasa es que alguien reciba un aviso que no le tocaba.

El aviso **interno** sí los lleva: va a las casillas del equipo, y sin el
Shipping Mark nadie sabe a quién habilitar.

## 5. Lo que esta spec NO cierra

- **Los 359 siguen sin acceso hasta que alguien los habilite.** Esto abre el
  canal para el que lo pide; no hace una habilitación masiva.
- **El aviso interno no tiene deduplicación propia.** Se apoya en el cerrojo por
  email de SDD-0278 (5/h), así que un mismo cliente puede generar hasta 5 avisos
  en una hora.
- **La categoría `registro` de Telegram no se partió en dos.** Este aviso entra
  junto con los de alta nueva; su descripción en Ajustes se amplió para no
  prometer menos de lo que llega.

## 6. Evidencia

- Tests: `app/entrar/__tests__/actions.test.ts` — 17 casos (11 de SDD-0278 + 6
  nuevos). **Validados por mutación:** al quitar el filtro `deleted_at is null`
  cae el caso del cliente fusionado; al avisar sin comprobar que es cliente caen
  dos, incluido el del anti-spam.
- `sin-acceso.ts` se deja **sin doblar** en el test, para que la consulta que se
  mide sea la que de verdad corre.
- Gate: `node scripts/verify.mjs`.
