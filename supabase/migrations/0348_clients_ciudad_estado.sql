-- ─────────────────────────────────────────────────────────────
-- 0348 · Ciudad y estado del cliente, capturados EN EL REGISTRO.
--
-- POR QUÉ. El alta express pide identidad + contacto y nada más: el cliente
-- queda registrado sin que sepamos a qué ciudad hay que entregarle. La dirección
-- se difiere a "Completa tu perfil" (Portal › Mi perfil › Direcciones), que es
-- justo donde un cliente se trancó el 2026-08-05 — y donde estuvo roto 34 días
-- por el hueco `city_slug` (ver 0347). Preguntar la ciudad al registrarse da el
-- dato de entrega desde el minuto cero y le quita un trámite al cliente.
-- Aprobado por el founder (SDD-0225 punto 3): "Aquí es donde vamos a entregar tu
-- mercancía."
--
-- POR QUÉ COLUMNAS NUEVAS Y NO `address`. `clients.address` es UN texto plano de
-- dirección completa que se llena en el perfil (composeAddress lo arma con calle
-- + barrio + ciudad + CP). Ciudad y estado son campos ESTRUCTURADOS que se
-- filtran y agrupan (rutas de despacho, zonas de entrega, tarifario terrestre por
-- city_slug). Meterlos dentro del texto libre los haría inútiles para eso.
--
-- FUENTE DEL DATO: `ve_locality_catalog` (24 estados · 98 ciudades · IPOSTEL), que
-- ya tiene `grant select to anon` y trae `state_name` junto a `city` — por eso el
-- estado se autocompleta solo al elegir la ciudad, sin que el cliente lo escriba
-- (el 2026-08-05 un cliente tecleó "Carabo" a mano en el portal). Cuando la
-- ciudad NO está en el catálogo, el registro deja escribirla libre y el estado
-- queda como lo tecleó: por eso ambas columnas son TEXTO y no FK — un FK
-- rechazaría al cliente de un pueblo que no está en la lista, y perder el lead es
-- peor que guardar un texto sin normalizar.
--
-- AMBAS NULLABLE: las 432 filas existentes se registraron sin estos datos y
-- siguen válidas. Null = "no lo sabemos todavía", no "no tiene".
--
-- ✅ APLICADA A PROD el 2026-08-05 con OK del founder nombrándola, ANTES de que
-- el código viajara: el insert del alta ya escribe estas dos columnas, así que
-- publicar primero el código habría tumbado el registro entero. Verificada
-- contra el objeto: ambas columnas existen, las 432 filas siguen intactas y la
-- fila quedó en el ledger como `0348_clients_ciudad_estado`.
-- ─────────────────────────────────────────────────────────────

alter table public.clients
  add column if not exists city  text,
  add column if not exists state text;

comment on column public.clients.city is
  'Ciudad de entrega declarada en el registro. Del catálogo ve_locality_catalog cuando existe; texto libre si el cliente eligió "Mi ciudad no aparece". Null = alta anterior a 0348.';

comment on column public.clients.state is
  'Estado (VE) de la ciudad de entrega. Se autocompleta desde ve_locality_catalog al elegir la ciudad; editable sólo cuando la ciudad es texto libre. Null = alta anterior a 0348.';
