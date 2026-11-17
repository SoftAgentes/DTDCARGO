---
sdd: "0651"
title: "Fusión de clientes v2: campo por campo, con saldos y chats"
status: proposed
author: "Claude Worker (Sam)"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0246", "0341", "0358", "0361", "0367", "0492", "0504", "0650"]
confidencialidad: interno
---

# SDD-0651 — Fusión de clientes v2: campo por campo, con saldos y chats

> Amplía la [SDD-0246](../0246-fusion-cliente-duplicado/spec.md). Hoy la fusión decide sola qué dato queda. La v2 enseña las dos fichas lado a lado, deja elegir campo por campo, avisa de lo que mueve y junta también los contactos de Chatwoot.
> **Estado:** `proposed`. Solo spec. La implementación la asigna el Director General **después de la F2 de la [SDD-0650](../0650-ficha-360-cliente/spec.md)**, o junto con ella, porque mueve su lista de uniones chat ↔ ficha. Si necesita migración, el número lo da el DG.
> Etiquetas: **C** código leído · **D** documento del repo · **I** inferencia · **NV** sin verificar.

## 1. Pedido

Sam, 2026-11-16, al revisar la propuesta de la ficha 360°: hay clientes repetidos con dos códigos distintos, o que se volvieron a registrar en la web después de escribir mal la cédula. Pidió una fusión como la de QuickBooks que elija qué dejar de cada ficha, y revisar qué tiene que arrastrar en la lógica contable, en la administrativa y en la de los chats.

## 2. Lo que hay (SDD-0246, migraciones 0341, 0358 y 0361)

| Hecho | Fuente | Etiqueta |
|---|---|---|
| Gana la ficha vieja, por su código. La nueva rellena solo los campos vacíos; no se elige campo por campo | `supabase/migrations/0361_merge_clients_conserva_kommo_contact.sql` (§5.7) | C |
| El código de la ficha absorbida queda como alias: la fila se conserva con `merged_into_client_id` y `resolve_markbox` sigue la cadena | SDD-0246 §3.3 | D |
| Mueve el acceso al portal, las direcciones, las conversaciones del portal, los reclamos, las reglas de aviso, las solicitudes de cambio, tareas, reuniones, inspecciones y referidos | 0361 §5.1 a §5.5 | C |
| No mueve, a propósito, las aceptaciones legales ni la verificación de identidad | 0361 §5.5 y §5.7 | C |
| Facturas y pagos guardan el código con que se emitieron y no se reescriben. El saldo sigue la cadena de fusiones | SDD-0246 §3.1, migración 0492 | D/C |
| La fusión exige permiso de edición de clientes | `app/studio/(app)/clientes/merge-actions.ts`, 0358 | C |
| No hay vista previa de lo que se mueve ni forma de deshacer | `merge-actions.ts` | C |

### Huecos por medir (NV)

- **I / NV:** `merge_clients` no se redefinió después de la 0361. Las tablas creadas después no aparecen en la función: `client_markbox_history` (0367), `client_billing_identities` (0466), `chatwoot_conversations` (0504), `crm_tarjetas` (0506) y `documents` (0097, DMS de la ficha). Hay que **medir con una prueba de base efímera**, ficha por ficha, qué queda colgando de la absorbida después de fusionar. Ninguna de esas tablas se nombra en la 0361; en algunas, la lectura ya sigue la cadena de fusiones (el segmento de la 0505 y el saldo de la 0492), así que no todo hueco es un dato perdido.
- **C:** la ficha no seguía la fusión en la lista de envíos (lo arregla la 0650 F1), ni en cotizaciones ni en reportes de pago (0650 F3 y F4).

## 3. Lo que hacen otros (investigación del 2026-11-16)

- **QuickBooks Online:** fusiona renombrando un cliente igual que el otro. Las transacciones pasan al que queda. Es permanente y se bloquea con subclientes o proyectos ([Intuit](https://quickbooks.intuit.com/learn-support/en-us/help-article/manage-customers/merge-duplicate-customers-quickbooks-online/L6s6B3PQd_US_en_US)).
- **HubSpot:** gana el primario, se puede elegir valor por valor, y guarda la lista de los ids absorbidos. Exige un permiso propio y no se deshace ([HubSpot](https://knowledge.hubspot.com/records/merge-records)).
- **Salesforce y Zoho:** campo por campo, con un máximo de 3 registros (extractos de búsqueda; la página de ayuda de Salesforce no se pudo leer).
- **Intercom:** vista previa con lo que se adopta, se descarta o se combina, conteos de lo que se reasigna y motivos de bloqueo ([Intercom](https://developers.intercom.com/docs/references/preview/rest-api/api.intercom.io/contacts/previewmergecontact)).
- **Chatwoot:** `POST /api/v1/accounts/{id}/actions/contact_merge` mueve conversaciones, etiquetas y atributos al contacto base. Es irreversible, y la documentación no dice qué pasa con teléfono y correo cuando los dos tienen valor ([Chatwoot](https://developers.chatwoot.com/api-reference/contacts/merge-contacts)).
- Ninguna de las fuentes leídas ofrece deshacer real. La práctica es vista previa más registro.

## 4. Decisiones de Sam (2026-11-16, literales)

Las personas van por su función: el repo es público.

| ID | Pregunta | Respuesta literal | Queda |
|---|---|---|---|
| M1 | ¿Campo por campo o automático? | «Yo prefiero que sea automático: que escoja cuál plantilla quiere dejar y a cuál le dice sí o no. Por ejemplo, le salen las dos versiones (anterior y nueva), entonces escoge: • Dirección: la de la derecha. • Nombre: la de la izquierda, o escribirlo para renovar un solo nombre.» | Las dos fichas lado a lado, con un selector por campo (izquierda, derecha o, en el nombre, escribir uno nuevo). La regla de hoy, gana la vieja y la nueva rellena huecos, queda como **valor por defecto** del selector |
| Saldos | ¿Qué pasa con el dinero? | «Saldos intocables: si hay dos saldos, hacer un merge de ambos y explicarlo en el estado de cuenta.» | Facturas y pagos no se reescriben. El saldo de la ficha que queda suma los dos, y el estado de cuenta marca qué viene de la ficha fusionada y con qué código |
| M2 | ¿Quién puede fusionar? | «b» | Admin, [caja] y [atención y CRM], con permiso por persona (SDD-0635). Ya no basta con editar clientes |
| M3 | ¿Chatwoot también? | «Si eso fuera a llegar, sí sería bueno que se fusionen los contactos de Chatwoot con nombres diferentes y que se identifique que fue una fusión.» | Se fusionan los contactos de Chatwoot (`contact_merge`), aunque tengan nombres distintos, con una nota y la etiqueta «fusionado desde DTD-xxxx». La pantalla avisa que en Chatwoot no se deshace |

## 5. Diseño

1. **Pantalla lado a lado** en Clientes › Duplicados, con las dos fichas y un selector por campo (M1). Solo los campos con valores distintos piden elegir; los iguales se muestran una vez.
2. **Vista previa con conteos** antes de confirmar: envíos, facturas, pagos, recibos de China, cotizaciones, conversaciones (del portal y de Chatwoot), documentos y direcciones que pasan a la ficha que queda.
3. **Frenos que piden confirmación reforzada:**
   - dos documentos distintos y válidos;
   - dos identidades de facturación;
   - dos accesos al portal: se elige con qué correo entra el cliente, en vez de revocar uno sin preguntar como hoy (0361 §5.1).
4. **Completar lo que no se mueve hoy**, según la medida de §2: historial de códigos, identidad de facturación, documentos, tarjetas del CRM, conversaciones de Chatwoot y la lista de uniones de la 0650 F2.
5. **Chatwoot (M3)**, después del commit de la base. Si `contact_merge` falla, la fusión del ERP queda hecha y la ficha avisa que falta juntar los contactos, con un botón para reintentar. No se envuelven las dos cosas en una transacción, porque Chatwoot está fuera de la base.
6. **Registro de cada fusión:** quién la hizo, qué eligió en cada campo y cuántas filas movió, en la auditoría (`entity_audit_log`). La ficha absorbida y su código siguen como alias, como hoy.
7. **Estado de cuenta:** cada factura de la ficha absorbida lleva el código con que se emitió y «de la ficha fusionada DTD-xxxx».
8. **Sin deshacer**, igual que en todas las referencias. La vista previa y los frenos cumplen ese papel.

## 6. Datos personales (`revisar-datos-ve`)

- La fusión copia datos personales de una ficha a otra de la misma persona; el riesgo es fusionar a **dos personas distintas**. Los frenos de §5.3 y la vista previa existen por eso.
- Los datos de la ficha absorbida se conservan en su fila borrada, como hoy. La fusión no es un borrado. El derecho de supresión de la persona sigue el camino de borrado de la 0455 sobre las dos fichas: NV hasta escribir la prueba.
- Fusionar en Chatwoot mueve conversaciones con texto. Queda en el servidor propio, sin terceros.
- Esto no es asesoría legal.

## 7. Aceptación (para la implementación)

- [ ] Prueba de base efímera que mide, tabla por tabla, qué queda colgando de la ficha absorbida (§2, NV). Primero con la `merge_clients` de hoy, para fijar el hueco, y después con la v2.
- [ ] Selector por campo, con la regla de hoy como valor por defecto.
- [ ] Vista previa con conteos iguales a lo que después mueve la fusión.
- [ ] Frenos de §5.3.
- [ ] Solo Admin y las personas con el permiso de M2 pueden fusionar, también por RPC.
- [ ] Contactos de Chatwoot fusionados y marcados; si falla, aviso y reintento.
- [ ] El estado de cuenta explica las facturas de la ficha fusionada.
- [ ] Registro en la auditoría.
- [ ] CI en verde.

## 8. Fuera de alcance

- Detección automática de duplicados nueva. La de la 0246 (`client_duplicate_candidates`) se conserva.
- Fusionar más de dos fichas a la vez.
- Deshacer una fusión.
