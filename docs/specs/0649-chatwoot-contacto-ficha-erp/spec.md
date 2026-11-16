---
sdd: "0649"
title: "Shipping Mark y segmento del ERP en el contacto de Chatwoot"
status: draft
author: "Claude Worker (Sam)"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0582", "0585", "0586", "0587", "0590"]
confidencialidad: interno
---

# SDD-0649 — Shipping Mark y segmento del ERP en el contacto de Chatwoot

> **Borrador para decidir.** No hay código, migración ni cambio en Chatwoot. Las decisiones D1 a D5 esperan la respuesta de Sam.
> Etiquetas: **C** código leído · **D** documento del repo · **I** inferencia · **NV** sin verificar.

## 1. Pedido

Sam, 2026-11-16, en la sesión del Subdirector de Chatwoot. Primero preguntó cómo se comparten en vivo los contactos de Chatwoot y del ERP («si un cliente escribe con un número viejo que no existe en Chatwoot, pero está en contactos enlazado al ERP, va a sacar la información»). Se le explicó que el ERP ya se consulta en vivo y se le propuso esta pieza. Respondió: «Sí, ábrela».

Objetivo: que en el contacto de Chatwoot se vea, sin abrir la Ficha DTD, si la persona es **cliente**, **lead registrado** (tiene Shipping Mark) o **lead nuevo**, y cuál es su **Shipping Mark**. Sirve también para segmentar campañas por atributo.

## 2. Lo que ya existe (no se rehace)

| Hecho | Fuente | Etiqueta |
|---|---|---|
| El ERP es el maestro del cliente, del segmento y del Shipping Mark; Chatwoot, del contacto y de los mensajes. Studio no copia contactos | `docs/specs/0587-chatwoot-contrato-sistema-maestro/spec.md:66-69` | D |
| Con cada mensaje entrante del número de leads, Studio calcula el segmento **en el momento**, por los últimos 10 dígitos, sin guardar estado | `lib/studio/chatwoot/enrutar.ts:57-65`, `supabase/migrations/0505_chatwoot_segmento.sql:81-140` | C |
| Solo hay ficha si **exactamente una** ficha viva tiene ese teléfono; si no, es `lead_nuevo` | `0505_chatwoot_segmento.sql:100-109` | C |
| Ya pone una **etiqueta** de segmento en la conversación (`cliente`, `lead-registrado`, `lead-nuevo`) y la pasa a su equipo | `lib/studio/chatwoot/segmento.ts:12-16`, `enrutar.ts:72-89` | C |
| La Ficha DTD muestra el Shipping Mark dentro de la conversación, solo a agentes vinculados con sesión en Studio | `docs/runbooks/chatwoot-ficha-dtd.md` | D |
| `PATCH /contacts/:id` de Chatwoot **mezcla** `custom_attributes` con los que ya tiene: no borra los demás | Chatwoot v4.19.1, `contacts_controller.rb:185-200` | C |

**El hueco:** la etiqueta va en la **conversación**, no en el **contacto**. El Shipping Mark solo se ve en la Ficha DTD. En la vista Contactos, en el buscador o al armar una campaña no se ve nada del ERP.

## 3. Propuesta

1. **Dos atributos de contacto en Chatwoot** (Ajustes → Atributos personalizados → Contacto):
   - `dtd_segmento`, tipo lista: `cliente`, `lead_registrado`, `lead_nuevo`;
   - `dtd_shipping_mark`, tipo texto.

   Crearlos cambia la configuración de producción: **OK nominal de Sam** (D1).
2. **Una RPC nueva** (migración propia; la 0505 no se toca), `chatwoot_ficha_contacto(tenant, phone_last10)`, con la misma regla que la 0505. Devuelve `segmento` y `shipping_mark` (el `markbox` vigente de la ficha única, o `null`). `security definer`, `search_path` vacío, solo `service_role`, como las de la 0505.
3. **En `clasificarContacto`**, después de las etiquetas y el equipo: si el contacto existe y sus atributos difieren, un `PATCH` con los dos atributos. Si son iguales, no escribe.
   - Si falla, lanza: el evento queda «fallido» y lo retoma el reproceso de 2.3, como el resto del manejador.
   - La respuesta de redirección no se repite, porque ya tiene su reserva (`enrutar.ts:111` y siguientes).
4. **Si la persona deja de tener ficha única** (teléfono repetido o ficha borrada): `dtd_segmento = lead_nuevo` y `dtd_shipping_mark` vacío. Así no queda un Shipping Mark viejo pegado a otra persona.
5. **Sin relleno masivo al inicio** (D3): los atributos se llenan cuando la persona vuelve a escribir. El Archivo Kommo queda sin atributos salvo que Sam pida el relleno.

## 4. Datos personales (`revisar-datos-ve`)

| Punto | Estado | Evidencia o arreglo |
|---|---|---|
| Inventario | Nuevo flujo Studio → Chatwoot: segmento y Shipping Mark. Ni nombre, ni teléfono, ni documento, ni saldo | §3 |
| Finalidad | Atender y enrutar a quien ya escribió; segmentar avisos. La segmentación de marketing queda sujeta al consentimiento de la SDD que lo diseñe | NO VERIFICABLE hasta que exista el registro de consentimiento |
| Minimización | **D2:** solo el Shipping Mark vigente, no el historial de códigos ni los fusionados | D2 |
| Quién lo ve | Todo usuario de Chatwoot que vea el contacto. Hoy son 4 administradores; un Agente lo vería en sus bandejas | NV: roles medidos por conteo pendiente |
| Borrado | Al borrar o anonimizar la ficha, el atributo se limpia la próxima vez que escriba. **D4** decide si además hace falta una limpieza activa | D4 |
| Logs | Solo códigos de error, como el resto del manejador | `enrutar.ts:29` |

## 5. Decisiones para Sam

| ID | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| D1 | ¿Crear los dos atributos en el Chatwoot de producción? | (a) Sí, con OK nominal · (b) No | (a) |
| D2 | ¿Qué código se copia? | (a) Solo el vigente · (b) Vigente e historial | (a) |
| D3 | ¿Rellenar los contactos que ya existen? | (a) No: se llenan cuando escriben · (b) Relleno único con script en el VPS y OK | (a) |
| D4 | Al borrar o anonimizar una ficha, ¿limpiar el atributo en el momento? | (a) Sí, con un manejador del borrado · (b) No: se corrige al próximo mensaje | (a), si el borrado es frecuente; si no, (b) |
| D5 | ¿También en la bandeja de Clientes, no solo en la de leads? | (a) Sí, en las dos bandejas de WhatsApp · (b) Solo leads | (a): el cliente escribe sobre todo al número de clientes |

**Dependencias:** la 0505 aplicada y la configuración de E10 cargada (`chatwootRouterConfig`, `lib/studio/chatwoot/config.ts:109-121`). Hoy la redirección solo opera en la bandeja de leads, y el número de leads sigue en Kommo hasta 4.5 / E8 (`docs/specs/0582-chatwoot-piloto/spec.md:150`). Con D5 = (a), la pieza sirve desde ya en la bandeja de Clientes. NV: estado actual de la 0505 y de la configuración en producción.

## 6. Plan

| Paso | Qué | Dónde |
|---|---|---|
| 1 | Migración con `chatwoot_ficha_contacto` y su contrato en PGlite (`.test.sql`) | `supabase/migrations/`, pruebas |
| 2 | `actualizarAtributosContacto` en el cliente HTTP y reglas puras de qué escribir | `lib/studio/chatwoot/router-api.ts`, `segmento.ts` |
| 3 | El paso nuevo en el manejador (y en la bandeja de Clientes, si D5 = a) | `lib/studio/chatwoot/enrutar.ts` y sus pruebas, con mutantes |
| 4 | Runbook: crear los atributos, comprobar y retirar | `docs/runbooks/chatwoot-bandeja.md` o uno propio |
| 5 | Puertas: migración en producción, atributos en Chatwoot y despliegue, cada una con OK nominal | Director General |

Estimado: 1 a 1,5 días de Worker, sin contar las puertas (I).

## 7. Aceptación

- [ ] Con ficha única de cliente, el contacto queda con `dtd_segmento = cliente` y su Shipping Mark.
- [ ] Con Shipping Mark y sin carga, `lead_registrado` y su código.
- [ ] Sin ficha, con dos fichas o sin teléfono: `lead_nuevo` y sin código; un código anterior se borra.
- [ ] Si los atributos ya están bien, no hay `PATCH`.
- [ ] No borra otros `custom_attributes` del contacto.
- [ ] Un fallo del `PATCH` deja el evento fallido sin repetir la redirección.
- [ ] Logs sin teléfono, código ni nombre.
- [ ] `pnpm verify` y CI en verde.
