# SDD-0587: `/privacidad` nombra al proveedor de gestión de clientes (handoff)

Rama `codex/0587-privacidad-proveedor-crm`, worktree `DTD-worktrees/0587-privacidad-proveedor-crm`, desde `main` en `1aafa150e`. Encargo del Director General, 2026-11-05. PR aparte, y se publica con la tanda D.

**Estado, 2026-11-05: listo en commit local. Sin subir y sin PR.** El orden del Director General es #338, #342 y después esta, para no gastar CI dos veces. Él avisa cuándo traer `main`. Hay preguntas abiertas con Sam, en «Lo que el texto no cubre»: si el texto cambia, vuelve con él. Detalle completo, con evidencia y `revisar-datos-ve`, en la sección de esta fecha de `docs/specs/0587-chatwoot-contrato-sistema-maestro/spec.md`.

## Autorización

Las dos, de Sam en el chat del Director General; las registra el Subdirector:

- Primero, «Sin nombrar a Kommo (Recommended)», de acuerdo con su decisión de julio de dejar a los proveedores en genérico.
- Con la medición de abajo, a «¿Apruebas este texto para /privacidad?»: «Apruebo este texto (Recommended)». **Sustituye al de la primera respuesta.**
- A «¿Autorizas leer en producción si el envío a Kommo escribe de verdad?»: «Sí, léelo». El Director General lo leyó a las 16:30Z, solo sí o no.

## Texto aprobado, literal

Si cambia una palabra, se le vuelve a preguntar:

- §4, Meta queda: «**Meta (WhatsApp e Instagram)**, que transporta los mensajes que nos envías y te enviamos por esos canales.»
- §4, punto nuevo: «**Proveedor de gestión de clientes**, que todavía usamos para llevar el seguimiento de clientes y atender parte de las conversaciones por WhatsApp e Instagram. Recibe tu nombre, tu correo, tu teléfono o usuario y esos mensajes. Si te atendemos como cliente o te preparamos un estimado, también puede recibir tu Shipping Mark, el valor del estimado y las notas de seguimiento. Estamos pasando esa atención a nuestro propio sistema, alojado en nuestro servidor.»
- §5, se agrega al primer párrafo: «Mientras terminamos ese cambio, lo que pasa por ese proveedor también se guarda en sus servidores y en los de quienes le prestan servicio, que pueden estar en Estados Unidos o en otros países.»

`UPDATED` lleva la fecha del día de publicar. Hoy ya dice «5 de noviembre de 2026», por la #374: si sale otro día, hay que moverla, junto con `privacidad-chat.test.ts` y `faq-seguimiento-coherente.test.tsx`.

## Lo medido

- **L3:** `dtd-cargo-functions-1`, `KOMMO_PUSH_DRY_RUN` definida y no vale `"false"`. **El alta web simula.**
- **`kommo_connections`:** 1 fila, `writeback_enabled=true`, `writeback_dry_run=false`. **Studio escribe de verdad.**
- **`contact_saldo_field_id` y `contact_transito_field_id`:** ninguno configurado. Lo leyó el Director General a las 18:15Z, solo sí o no, con «Sí, léelos (Recommended)» de Sam. Hoy el cron no marca saldo ni carga.
- **No se midió** si la cola tiene envíos ni qué había antes de la mudanza. L1, L2 y L4 siguen sin OK.
- **Kommo:** producto de QSOFT LLC, ley de California. Su política dice que puede guardar «anywhere in the world, including but not limited to, in the United States», en servidores propios, de filiales o de proveedores. No nombra centros de datos ni encontré DPA. Leído en `kommo.com/privacy/` y `kommo.com/terms/`.

## Lo que el texto no cubre

**Se lo dije al Director General el 2026-11-05. El texto no se tocó: es de Sam.**

1. **Saldo y carga en tránsito: cerrado hoy, y queda como condición.** `app/api/cron/kommo-contact-status/route.ts`, programado a diario en `infra/dtd-cargo/cron/crontab:10`, encola «Tiene saldo pendiente: Sí/No» y «Carga en tránsito: Sí/No» en el contacto de Kommo solo si `kommo_connections.contact_saldo_field_id` y `contact_transito_field_id` están llenos (`lib/studio/kommo-contact-status.ts:17` y `:215-216`). **Hoy ninguno lo está: el texto no cambia.** Llenarlos obliga a volver con Sam; está en el aviso del runbook.
2. **Tareas, etapa, responsable y etiquetas.** `kommo-writeback` también manda eso (`lib/studio/kommo-writeback.ts:23-29`). El texto dice «las notas de seguimiento». Las tareas son texto libre, como las notas. Lo leo como cubierto, y eso es inferencia mía. Se lo dice el Director General a Sam; si el texto cambia, vuelve con él.
3. **«Solo acceden a lo necesario y bajo obligación de confidencialidad»,** la entrada de §4, ahora abarca a este proveedor con el contrato en ❓. Es igual para los demás ❓ del inventario. El Director General lo anota para la revisión legal de Sam: no cambia nada ahora.

## Lo que se hizo

- `app/privacidad/page.tsx`: los tres textos y su comentario. La página no nombra a Kommo: lo fija la prueba renderizada.
- `app/__tests__/privacidad-chat.test.ts`: texto literal, cierre de cada bloque incluido.
- `app/__tests__/faq-seguimiento-coherente.test.tsx`: lo mismo sobre lo que lee la persona, ya renderizado.
- `docs/legal/privacidad/inventario-terceros.md`: la fila de Kommo.
- `docs/legal/privacidad/revision-0487-perfil-empresa-2026-09-19.md`: corrección fechada de `doc_kind`, sin reescribir la revisión.
- `docs/specs/0587-chatwoot-contrato-sistema-maestro/spec.md`: allowlist, L3 leída, §16.4 y su aceptación, y sección nueva.
- `docs/runbooks/deploy-kommo-push-client.md`: aviso en el paso 3, con OK del Director General.

## Lo que falta

- Lo que diga Sam del punto 2 de arriba, si cambia algo. Lo pasa el Director General.
- Traer `main` una sola vez, cuando él avise; correr otra vez las comprobaciones; publicar en otro comando, después de leerlas.
- PR aparte, con la tanda D. Al traer `main`, la fila de Kommo del inventario puede cruzarse con la de Discord si SDD-0606 entró antes; según el Director General, esta va primero.

## FUERA DE ALCANCE DETECTADO

- **Riesgo: si alguien pone `KOMMO_PUSH_DRY_RUN="false"`, Kommo empieza a recibir cédula o RIF y nivel de cliente, y este texto ya no alcanza.** Eso vuelve a Sam antes de cambiar ese valor. Lo mismo si alguien llena los campos de saldo o tránsito. Lo dicen el aviso del runbook y la spec, y lo de `KOMMO_PUSH_DRY_RUN` también el comentario de `app/privacidad/page.tsx`, pero nada falla si alguien los cambia. `infra/dtd-cargo/.env.example:356` queda sin el aviso: el Director General pidió no tocarlo, porque SDD-0606 también lo cambia.
- Según `mapa-de-borrado.md` §D, los plazos de §6 de la política, como anonimizar a los 12 meses, no se cumplen solos en Kommo. Se lo cuenta el Director General a Sam.
- `docs/legal/privacidad/registro-tratamiento.md` no lista a Kommo como destinatario del Shipping Mark ni del valor del estimado, y Studio se los escribe.
