---
sdd: "0649"
title: "Shipping Mark y segmento del ERP en el contacto de Chatwoot"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-16
updated: 2026-11-17
supersedes: null
superseded_by: null
related: ["0582", "0585", "0586", "0587", "0590"]
confidencialidad: interno
---

# SDD-0649 — Shipping Mark y segmento del ERP en el contacto de Chatwoot

> **D1 a D5 resueltas por Sam el 2026-11-16:** «Sí, como recomiendas». D4 tenía una recomendación condicional: queda **(b)** mientras no haya medida de cuántas fichas se borran (ver §5). Implementado en la PR #622, sin migración; nada aplicado ni encendido en producción.
>
> **Antecedente revisado (2026-11-16, a pedido de Sam).** En la sesión del Director General, en las demás sesiones y en el repo no hay una aprobación ni un diseño previo de atributos del ERP en el contacto de Chatwoot. Lo parecido que existe es de **Kommo**: la SDD-0244 escribe el Shipping Mark en un campo permanente del contacto de Kommo, configurable en CRM › Dirección («Shipping Mark en el contacto», `app/studio/(app)/crm/_components/DireccionTab.tsx:585-597`). Esa pieza se retira con Kommo en E8; esta es su equivalente en Chatwoot.
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
2. **Sin migración** (cambio técnico del 2026-11-16 respecto del borrador, que proponía una RPC nueva). El segmento sale de la RPC de la 0505, que ya existe. El Shipping Mark se lee con el cliente de servicio que ya usa el procesador de eventos: solo la columna `markbox` de `clients`, filtrando por tenant, `phone_last10` y `deleted_at` nulo, con `limit 2`. Si no hay exactamente una ficha, no se copia ningún código, igual que la regla de la 0505. Así no hace falta una migración nueva ni su puerta en producción.
3. **Un manejador propio, `marcarContactoErp`**, después de `clasificarContacto` y `entrarLead` en `MANEJADORES`. No va dentro de `clasificarContacto`, porque ese solo corre en la bandeja de leads y D5 pide también la de clientes. Corre con cada mensaje entrante, solo en las dos bandejas de WhatsApp y solo con `CHATWOOT_ATRIBUTOS_CONTACTO=1`. Esa variable se carga después de crear los atributos. Lee los atributos del contacto y, si difieren, hace un `PATCH` con los dos. Si son iguales, no escribe.
   - Si falla, lanza: el evento queda «fallido» y lo retoma el reproceso de 2.3, como los demás manejadores.
   - La respuesta de redirección no se repite, porque tiene su propia reserva (`enrutar.ts:111` y siguientes).
4. **Si la persona deja de tener ficha única** (teléfono repetido o ficha borrada): `dtd_segmento = lead_nuevo` y `dtd_shipping_mark` vacío. Así no queda un Shipping Mark viejo pegado a otra persona.
5. **Sin relleno masivo al inicio** (D3): los atributos se llenan cuando la persona vuelve a escribir. El Archivo Kommo queda sin atributos salvo que Sam pida el relleno.

## 4. Datos personales (`revisar-datos-ve`)

| Punto | Estado | Evidencia o arreglo |
|---|---|---|
| Inventario | Nuevo flujo Studio → Chatwoot: segmento y Shipping Mark. Ni nombre, ni teléfono, ni documento, ni saldo | §3 |
| Finalidad | Atender y enrutar a quien ya escribió; segmentar avisos. La segmentación de marketing queda sujeta al consentimiento de la SDD que lo diseñe | NO VERIFICABLE hasta que exista el registro de consentimiento |
| Minimización | **D2:** solo el Shipping Mark vigente, no el historial de códigos ni los fusionados | D2 |
| Quién lo ve | **Todo usuario de la cuenta, también un Agente sin bandejas.** Hoy son 4 Administradores | **Medido** el 2026-11-17 contra Chatwoot 4.19.1 efímero (PR #647, `contacto-erp.poc.test.ts`, A1 y A2). Un Agente que no es miembro de ninguna bandeja ve el contacto y sus `custom_attributes` por id y por el buscador. En la prueba editó el Shipping Mark; el segmento usa el mismo `PATCH`, pero no se midió por separado. No puede crear definiciones (401); borrarlas no se midió. En `GET contacts/:id/conversations`, el único endpoint medido, no ve la conversación de una bandeja ajena (admin 1, agente 0). Lectura de código (C, no medida): `contact_policy.rb` y `Conversations::PermissionFilterService`. **Condición:** antes de pasar a alguien a rol Agente, Sam acepta que vea el segmento y el Shipping Mark de todos los contactos y que pueda editarlos. Si los edita, Studio los corrige con el siguiente mensaje entrante |
| Borrado | Al borrar o anonimizar la ficha, el atributo se limpia la próxima vez que escriba. **D4** decide si además hace falta una limpieza activa | D4 |
| Logs | Solo códigos de error, como el resto del manejador | `enrutar.ts:29` |

## 5. Decisiones (resueltas el 2026-11-16)

D1 (a), D2 (a), D3 (a), D4 (b) y D5 (a). D4 queda en (b) porque la condición de la recomendación («si el borrado es frecuente») no está medida; si un conteo la cumple, se pasa a (a) en esta misma SDD.

| ID | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| D1 | ¿Crear los dos atributos en el Chatwoot de producción? | (a) Sí, con OK nominal · (b) No | (a) |
| D2 | ¿Qué código se copia? | (a) Solo el vigente · (b) Vigente e historial | (a) |
| D3 | ¿Rellenar los contactos que ya existen? | (a) No: se llenan cuando escriben · (b) Relleno único con script en el VPS y OK | (a) |
| D4 | Al borrar o anonimizar una ficha, ¿limpiar el atributo en el momento? | (a) Sí, con un manejador del borrado · (b) No: se corrige al próximo mensaje | (a), si el borrado es frecuente; si no, (b) |
| D5 | ¿También en la bandeja de Clientes, no solo en la de leads? | (a) Sí, en las dos bandejas de WhatsApp · (b) Solo leads | (a): el cliente escribe sobre todo al número de clientes |

**Dependencias:** la 0505 aplicada (ya no figura como espera en `supabase/migrations-baseline.json`; I: aplicada) y la configuración de E10 cargada (`chatwootRouterConfig`, `lib/studio/chatwoot/config.ts:109-121`). Hoy la redirección solo opera en la bandeja de leads, y el número de leads sigue en Kommo hasta 4.5 / E8 (`docs/specs/0582-chatwoot-piloto/spec.md:150`). Con D5 = (a), la pieza sirve desde ya en la bandeja de Clientes. NV: estado actual de la 0505 y de la configuración en producción.

## 6. Plan y lista exacta de archivos

| Paso | Qué | Archivos |
|---|---|---|
| 1 | Reglas puras: qué escribir y qué código se muestra | `lib/studio/chatwoot/contacto-erp.ts` (nuevo) |
| 2 | Leer y escribir los atributos del contacto (`GET` y `PATCH /contacts/{id}`) | `lib/studio/chatwoot/router-api.ts` |
| 3 | El interruptor `CHATWOOT_ATRIBUTOS_CONTACTO` | `lib/studio/chatwoot/config.ts`, `.env.example`, `infra/dtd-cargo/.env.example` |
| 4 | El manejador y su lugar en la lista | `lib/studio/chatwoot/contacto-erp-manejador.ts` (nuevo), `lib/studio/chatwoot/webhook-procesar.ts` |
| 5 | Pruebas | `lib/studio/chatwoot/__tests__/contacto-erp.test.ts` (nuevo); `lib/studio/chatwoot/__tests__/aviso-unico-por-evento.test.ts` (la lista de nombres de los manejadores) |
| 6 | Runbook: crear los atributos, encender, comprobar y apagar | `docs/runbooks/chatwoot-bandeja.md` |
| 7 | Puertas: despliegue, atributos en Chatwoot y la variable, cada una con OK nominal | Director General |
| 8 | Smoke previo al encendido (2026-11-17, OK de Sam por el Director General: «Sí, mídelo»): `GET`/`PATCH` de `custom_attributes` y qué ve un Agente, contra un Chatwoot 4.19.1 efímero, sin producción | `lib/studio/chatwoot/__tests__/contacto-erp.poc.test.ts` (nuevo); `infra/chatwoot/pruebas/portal/sonda-portal-poc.rb` (un agente sin bandejas) y `prueba-portal-poc.sh`; `.github/workflows/chatwoot-portal-poc.yml` (la ruta de la prueba) |

No hay migración. Fuera de esta lista no se toca nada.

## 7. Aceptación

Cada punto tiene su prueba en `contacto-erp.test.ts`; el estado lo da el CI de la PR.

- [ ] Con ficha única de cliente, el contacto queda con `dtd_segmento = cliente` y su Shipping Mark, con el filtro de la 0505 (tenant, `phone_last10`, `deleted_at` nulo).
- [ ] Con Shipping Mark y sin carga, `lead_registrado` y su código.
- [ ] Sin ficha, con dos fichas o sin teléfono: `lead_nuevo` y sin código; un código anterior se borra.
- [ ] Si los atributos ya están bien, no hay `PATCH`.
- [ ] Solo escribe sus dos atributos; Chatwoot conserva los demás (lo hace su `PATCH`, C).
- [ ] También en la bandeja de clientes; en otras bandejas, nada.
- [ ] Apagado si la variable no vale exactamente `1`.
- [ ] Un fallo de la regla, de la ficha, de la lectura o del `PATCH` lanza sin escribir.
- [ ] Errores sin teléfono, código ni nombre.
- [ ] CI de la PR en verde. `pnpm verify` local no se corre sin turno del Director General.
