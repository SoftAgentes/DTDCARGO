# SDD-0587: `/privacidad` nombra al proveedor de gestión de clientes (handoff)

Rama `codex/0587-privacidad-proveedor-crm`, worktree `DTD-worktrees/0587-privacidad-proveedor-crm`, desde `main` en `1aafa150e`. Encargo del Director General, 2026-11-05. PR aparte, y se publica con la tanda D.

**Estado, 2026-11-05 14:12Z: pausa por reinicio de la PC.** Todavía no se ha tocado `app/privacidad/page.tsx`, ni hay PR. Después del reinicio no se arranca nada hasta que avise el Director General.

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

## Lo que falta

- Las tres comprobaciones.
- Código: `app/privacidad/page.tsx` (textos y `UPDATED`) y sus pruebas, `app/__tests__/privacidad-chat.test.ts` y `app/__tests__/faq-seguimiento-coherente.test.tsx`.
- Documentos: inventario de terceros, y spec de SDD-0587 con la aprobación.
- Publicar con `main` traído una sola vez, en otro comando, después de leer las pruebas.

## FUERA DE ALCANCE DETECTADO

- Según `mapa-de-borrado.md` §D, los plazos de §6 de la política, como anonimizar a los 12 meses, no se cumplen solos en Kommo. Se lo cuenta el Director General a Sam.
