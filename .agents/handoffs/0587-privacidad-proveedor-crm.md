# SDD-0587: `/privacidad` nombra al proveedor de gestión de clientes (handoff)

Rama `codex/0587-privacidad-proveedor-crm`, worktree `DTD-worktrees/0587-privacidad-proveedor-crm`, desde `main` en `1aafa150e`. Encargo del Director General, 2026-11-05. PR aparte, y se publica con la tanda D.

**Estado, 2026-11-05 16:15Z: en espera del Director General, que vuelve con Sam.** Todavía no se ha tocado `app/privacidad/page.tsx`, ni hay PR: la comprobación 3 no cuadra con el texto y la lectura L3 pide OK de Sam. Ver «Resultado de las comprobaciones».

## Autorización

Sam, en el chat del Director General; lo registra el Subdirector: «Sin nombrar a Kommo (Recommended)», de acuerdo con su decisión de julio de dejar a los proveedores en genérico.

Texto aprobado, literal. Si cambia una palabra, se le vuelve a preguntar:

- §4, Meta queda: «**Meta (WhatsApp e Instagram)**, que transporta los mensajes que nos envías y te enviamos por esos canales.»
- §4, punto nuevo: «**Proveedor de gestión de clientes**, que todavía usamos para llevar el seguimiento de clientes y atender parte de las conversaciones por WhatsApp e Instagram. Recibe tu nombre, tu correo, tu teléfono o usuario y esos mensajes. Estamos pasando esa atención a nuestro propio sistema, alojado en nuestro servidor.»
- §5, se agrega al primer párrafo: «Mientras terminamos ese cambio, los datos de contacto y las conversaciones que pasan por ese proveedor también se guardan en sus servidores, fuera de Venezuela.»
- `UPDATED`: la fecha del día de publicar.

Prueba del texto literal con mutantes, cuando la memoria lo permita, y la aprobación citada en la spec.

## Comprobaciones antes de abrir la PR

Sin leer datos de clientes. **Si alguna contradice el texto, no se cambia: se le dice al Director General, que vuelve con Sam.**

1. **Que Kommo guarda fuera de Venezuela, según sus términos publicados.** Sin empezar. Llenar país y contrato en la fila de Kommo de `docs/legal/privacidad/inventario-terceros.md` (línea 40, hoy ❓ y ❓), o dejar ❓ si no se puede.
2. **Si el alta web sigue empujando a Kommo en producción.** A medias. Leído en el código: `app/registro/actions.ts:467-472` invoca `kommo-push-client` salvo que `altaWebSinKommo()` lo corte, con `CRM_ALTA_WEB_SIN_KOMMO`. Falta medir en producción `KOMMO_PUSH_DRY_RUN` en el servicio de funciones y el estado del interruptor. Solo nombres y estado, nunca valores secretos.
3. **Si la lista de datos se queda corta.** A medias, y **puede contradecir el texto:** `supabase/functions/kommo-push-client/index.ts:158` lee `name, email, phone, rif, markbox, doc_kind, tier`, y `docs/legal/privacidad/revision-0487-perfil-empresa-2026-09-19.md:100` dice que Kommo recibe `rif` y `doc_kind`. El texto aprobado dice «tu nombre, tu correo, tu teléfono o usuario y esos mensajes». Falta leer qué campos escribe de verdad y si en producción corre en seco (punto 2). No avisado todavía como contradicción: se le dice al Director General con esa medición.

## Resultado de las comprobaciones

Medido el 2026-11-05 a las 16:06Z, sin leer datos de clientes.

**1. Dónde guarda Kommo: compatible con el texto, sin ser literal.**
- Kommo es producto de QSOFT LLC. Sus términos se rigen por la ley de California. Leído en `kommo.com/privacy/` y `kommo.com/terms/`.
- Su política dice que puede guardar los datos «anywhere in the world, including but not limited to, in the United States», en sus servidores, en los de sus filiales o en los de sus proveedores, y en países distintos del de las personas.
- No nombra centros de datos ni a Venezuela. «Fuera de Venezuela» es lo que se deduce de eso, no lo que dice.
- «En sus servidores» se queda algo corto, porque también pueden ser de filiales o proveedores.
- Inventario: país «EE. UU. (QSOFT LLC, ley de California); guarda en cualquier país». Contrato sigue en ❓: no se leyó ningún DPA.

**2. Si el alta web sigue empujando a Kommo: sin cerrar.**
- `CRM_ALTA_WEB_SIN_KOMMO` no está definida en `dtd-cargo-web-1` ni en `/srv/dtd-cargo/.env`, así que `app/registro/actions.ts:469` invoca `kommo-push-client` en cada alta.
- La función solo escribe si `KOMMO_PUSH_DRY_RUN` vale `"false"`. **Ese valor en producción no se leyó: es la lectura L3 y la spec pide OK de Sam** (`docs/specs/0587-chatwoot-contrato-sistema-maestro/spec.md:254`, «solo sí o no»). Solo se comprobó que la línea existe en `.env`.
- Error declarado: el primer comando eligió por `head -1` el contenedor `dtd-cargo-staging-functions-1`, y dio vacía en prueba. Ese dato es de prueba y no dice nada de producción.

**3. Si la lista se queda corta: sí, si L3 da `"false"`.** Por el código (`supabase/functions/_shared/kommo-outbound.ts:114-154`):
- Contacto: nombre, teléfono y correo.
- Lead: nombre más Shipping Mark, y, si esos campos existen en la cuenta de Kommo, **Shipping Mark, cédula o RIF y nivel de cliente**.
- `doc_kind` se lee y no se envía: `revision-0487-perfil-empresa-2026-09-19.md:100` queda inexacta en ese punto.
- `kommo-writeback` manda además notas, tareas, etapa, precio y Shipping Mark, si `kommo_connections.writeback_enabled` y `writeback_dry_run` lo permiten. Esa fila no se leyó.

## Lo que falta

- La respuesta de Sam, por el Director General, a la lectura L3 y al texto.
- Código: `app/privacidad/page.tsx` (textos y `UPDATED`) y sus pruebas, `app/__tests__/privacidad-chat.test.ts` y `app/__tests__/faq-seguimiento-coherente.test.tsx`.
- Documentos: inventario de terceros, y spec de SDD-0587 con la aprobación.
- Publicar con `main` traído una sola vez, en otro comando, después de leer las pruebas.

## FUERA DE ALCANCE DETECTADO

- Según `mapa-de-borrado.md` §D, los plazos de §6 de la política, como anonimizar a los 12 meses, no se cumplen solos en Kommo. Se lo cuenta el Director General a Sam.
