# Mapa de borrado — DTD Cargo

> **SDD-0191 · Slice B.** Todos los destinos de un dato personal y qué pasa con
> cada uno cuando el titular pide que lo borren.
>
> **Por qué existe:** `/privacidad` §8 ofrece *"eliminar tu cuenta y tus datos"*.
> Sin este mapa, cualquier botón que se construya vuelve a prometer lo que el
> sistema no hace — que es el hallazgo H-3 de la
> [auditoría](AUDITORIA-2026-07.md).
>
> **Prerrequisito de los Slices C y D.** No se construye el botón antes que el mapa.
>
> Derivado del esquema **real de producción** el 2026-07-31 (grafo de claves
> foráneas, `information_schema`, `storage.objects`), no de leer el código.
> Clasificación: **interno** — sin datos de clientes, solo estructura y conteos.

---

## 1 · La regla que gobierna este documento

Heredada de [SDD-0186](../../specs/0186-audit-retention-foundation/spec.md):
**no se inventan plazos legales.** Cada destino termina en una de cuatro
etiquetas:

| Etiqueta | Significa |
|---|---|
| 🟢 **BORRA** | Se elimina cuando el titular lo pide. Decidido |
| 🔵 **CONSERVA** | Se retiene por una obligación **identificada**, con su fuente y su plazo |
| 🟣 **ANONIMIZA** | Se rompe el vínculo con la persona y se conserva el resto |
| 🔴 **SIN FUNDAMENTO** | Nadie identificó todavía por qué se conserva ni por cuánto |

⚠️ **Dónde esta spec se aparta de SDD-0186, a propósito.** Para eventos de
auditoría, "no purgar hasta tener fundamento" es el estado preventivo correcto:
son evidencia de la propia empresa. Pero 🔴 sobre **datos de una persona que no
es cliente** —la foto de quien recibió un paquete, la cuenta bancaria de un
candidato rechazado— **no es un estado estable**: choca con el principio de
**temporalidad** de la sentencia SC 332/2001 y con el derecho al olvido de la
SC 759/2025. Esos casos se escalan, no se dejan correr.

---

## 2 · Qué identifica a una persona en este sistema

No hay un solo identificador, y esa es la raíz del problema:

| Identificador | Dónde nace | Alcance |
|---|---|---|
| `clients.id` (uuid) | Alta del cliente | Lo que las claves foráneas siguen |
| **`markbox`** (`DTD-0000`) | `next_markbox()` | **Texto libre copiado por todo el sistema, sin FK** |
| `rif` / `national_id` | Registro | Cédula o RIF |
| `client_name` | Denormalizado | El nombre real, copiado en 12 tablas |
| `email` · `phone` | Registro y formularios públicos | También en el espejo de Kommo |

**El markbox es el problema.** Es la identidad operativa —va en la caja, en la
etiqueta, en la factura— y viaja como **texto**, no como referencia. Ninguna
restricción de base de datos lo persigue.

---

## 3 · Los destinos

### A · Lo que la base borra sola (15 tablas)

Cuelgan de `clients` por clave foránea. Un `delete` del cliente las alcanza.

| Al borrar el cliente | Tablas |
|---|---|
| **CASCADE** (6) | `client_change_requests` · `client_delivery_addresses` · `client_notification_rules` · `client_users` · `conversations` · `conversation_monthly_digests` |
| **SET NULL** (9) | `bitacora_meetings` · `bitacora_tasks` · `client_claims` · `currency_conversions` · `inspection_reports` · `legal_acceptances` · `referrals` (×2) · `supplier_claim_offsets` |

> ⚠️ **`SET NULL` no es borrado.** La fila sobrevive; solo pierde el puntero. Y
> nueve de estas tablas **también guardan el `client_markbox` o el `client_name`
> como texto**, así que al quedar el `client_id` en `NULL` la persona sigue
> identificada — solo que ahora sin forma de encontrarla por FK. Es lo peor de
> los dos mundos.

**Decisión:** 🔴 SIN FUNDAMENTO en bloque. Ver §4.
Excepción decidida: `legal_acceptances` → 🔵 **CONSERVA** (es la prueba de la
aceptación; la tabla es append-only por diseño y borrarla destruiría la defensa
legal de la operación).

### B · Lo que la base NO borra — 40 tablas 🔴

Llevan el identificador del cliente **sin ninguna clave foránea**. Una cascada
no las toca. Ninguna.

**Con el `client_name` denormalizado** (el nombre real, no solo el código):
`consolidation_items` · `dispatch_order_packages` · `invoices` ·
`payment_receipts` · `qr_print_orders` · `quotes` · `sales_orders` ·
`shipments` · `warehouse_boxes` · `warehouse_receipt_ve_boxes` ·
`warehouse_receipts_cn`

**Solo con el markbox:**
`academy_diplomas` · `academy_enrollments` · `academy_lesson_progress` ·
`client_claim_evidence` · `client_notification_schedule` · `club_members` ·
`packing_list_submissions` · `payment_reports` · `prealerta_documents` ·
`prealerta_service_requests` · `prealertas` · `purchase_orders` ·
`shipment_documents` · `supplier_claims` · `supplier_order_signals` ·
`suppliers_cn` · `dispatch_rules` (en arreglos `vip_markboxes` /
`whitelist_markboxes`)

**Con cédula o RIF, de otras personas:** `nomina_employees` ·
`nomina_employee_registrations` · `nomina_contractors` · `persons` ·
`tms_drivers` · `customs_agents` · `fiscal_book_entries` · `tax_withholdings`

**Decisión:** 🔴 SIN FUNDAMENTO. Varias son claramente 🔵 CONSERVA por obligación
fiscal (`invoices`, `fiscal_book_entries`, `tax_withholdings`, `payment_receipts`)
— pero **con qué plazo lo dice la abogada**, no nosotros.

### C · Storage — 12 buckets

Prod tiene **12**, no los 11 que decía la auditoría: `bug-replays` no aparecía
en ninguna migración. *(Corregido acá.)*

`bitacora` · `bug-replays` · `claim-evidence` · `client-docs` ·
`client-facades` · `documents` · `expense-receipts` · `inspections` ·
`payment-proofs` · `prealerta-docs` · `receipt-photos` · `shipment-docs`

🔴 **Una eliminación de fila en PostgreSQL no borra por sí sola un objeto de
Storage.** Sin embargo, la aplicación no tiene una conducta uniforme:

- Hub Documentos, Tracking, Inspecciones, Reclamos y Bitácora marcan la fila y
  después llaman `Storage.remove()`;
- Gastos Studio conserva el recibo al hacer soft-delete;
- Gastos móvil marca la fila y elimina el objeto;
- los jobs de huérfanos borran objetos sin referencia bajo gates propios.

Por tanto, hoy existen simultáneamente archivos que sobreviven a su fila y filas
que parecen recuperables pero perdieron el binario. Ninguno de los dos extremos
demuestra un ciclo de borrado y restauración gobernado.

⚠️ **Y la ruta misma es un dato personal:** **25 de 38 objetos** llevan el
markbox en el nombre del archivo. Listar un bucket revela quién tiene documentos,
aunque no se abra ninguno.

Los que más pesan: `client-docs` (documentos de identidad) · `client-facades`
(foto de la vivienda) · `payment-proofs` (datos bancarios) · `bitacora`
(audio y video de reuniones) · `receipt-photos` (fotos y firmas de entrega).

### D · El espejo de Kommo — 🔴 el hallazgo más serio del mapa

| Tabla | Filas |
|---|---|
| `kommo_contacts` | **2 942** |
| `kommo_leads` | **2 874** |

Hay casi **siete veces más personas en el espejo del CRM que en la tabla de
clientes** (428). Y **1 547 contactos llevan teléfono o correo dentro de
`custom_fields`**, no solo un nombre.

> **Corrección a la primera versión de este documento (2026-07-31).** Acá se
> había escrito que el espejo era peso muerto —"leads que nunca contrataron, sin
> base para conservar"— y se sugería purgarlo. **Eso estaba mal y borrar habría
> roto cosas.** El espejo se usa: alimenta los KPIs del dashboard
> (`dashboard-kpi-queries.ts:213`), la analítica comercial (`kommo-analytics.ts`),
> la conversión de contacto a cliente (`kommo-convert.ts`) y las campañas de
> recuperación (`kommo-recovery.ts`). Además, Kommo es el sistema de origen: lo
> que se borrara localmente **volvería en el siguiente sync**.

**El problema real es otro, y es peor.**

🔴 **El sync nunca borra.** `supabase/functions/kommo-sync/sync.ts` sólo hace
`upsert` (línea 42, `ignoreDuplicates: false`): no hay ni un `delete` ni una
reconciliación de lo que desapareció del origen. Es un trinquete de una sola
dirección.

**Consecuencia:** si una persona pide a DTD que la borren y se la elimina en
Kommo, **la copia local sobrevive para siempre**. El espejo le gana en duración
al sistema del que es espejo — que es exactamente lo contrario de lo que un
espejo debería hacer. Hoy no hay ningún camino por el que un borrado en Kommo
llegue a esta base.

**Y la antigüedad no ayuda:** el contacto más viejo es del **23-08-2023**;
**2 322 de 2 942 (79 %) tienen más de un año** y 282 más de dos.

⚠️ **Además, operativo, no legal:** el último sync fue el **2026-07-17**. El
`pg_cron` diario dejó de correr hace dos semanas, así que los KPIs comerciales
del dashboard están congelados en esa fecha. Eso no es un problema de datos
personales, pero se encontró acá y conviene mirarlo.

### E · Colas, logs y auditoría

| Destino | Filas | Estado |
|---|---|---|
| `entity_audit_log` | 3 | 🔵 CONSERVA — gobernado por SDD-0186; 0 filas con markbox hoy |
| `mail_logs` | 215 | 🔴 lleva destinatarios |
| `public_track_log` | — | 🔴 IP de quien consulta un envío |
| `operario_pin_attempts` | — | 🟢 BORRA — huella anti-abuso; purga técnica a 48 h |
| `outbox_push_events` | 0 | 🟢 BORRA — transitoria por diseño |
| `kommo_writeback_outbox` | — | 🔴 payloads con datos del cliente |
| `sync_logs` · `user_role_audit` | — | 🔴 sin revisar |

### F · Fuera de la base

| Tercero | Qué tiene | Quién lo borra |
|---|---|---|
| **Kommo** | Contactos y leads (el original del espejo) | 🔴 API, hoy sin usar |
| **Resend** | Correos enviados con nombre y dirección | 🔴 retención no verificada |
| **Cloudflare Workers AI** | Audio de reuniones procesado | 🔴 política no leída |
| **Anthropic / OpenRouter** | Contenido de conversaciones | 🔴 política no leída |
| **Google (GA4)** | Sin PII — verificado | 🟢 no aplica |
| **Nominatim** | Integración retirada el 2026-09-02; solicitudes históricas | 🔴 retención externa no verificable |
| **CNE / SENIAT · consulta de identidad** | Integración retirada el 2026-09-02; consultas históricas | 🔴 retención externa no verificable |
| **Supabase / Vercel** | Todo / logs de request | 🔴 retención no verificada |

---

## 4 · Lo que bloquea, y quién lo destraba

**La mayoría del mapa está en 🔴 y no es por descuido: falta un insumo que no es
técnico.** La decisión 6 del [brief a la abogada](#) es exactamente esta: por
cada categoría —facturas, comprobantes de pago, documentos de identidad,
expedientes de aduana, legajos de personal— el plazo de conservación y la norma
que lo manda.

Sin esa lista no se puede pasar ninguna fila de 🔴 a 🔵, y **no se inventa**.

---

## 5 · Lo que sí se puede decidir sin esperar

Cuatro cosas no dependen de la abogada y conviene resolverlas ya:

1. ⭐ **Que el sync de Kommo reconcilie borrados.** Hoy sólo hace `upsert`, así
   que un contacto eliminado en Kommo sobrevive acá indefinidamente. **No es
   purgar el espejo** —se usa, y volvería en el siguiente sync—: es que el
   espejo deje de sobrevivirle al original. Sin esto, ningún borrado que DTD
   ejecute en su CRM llega a esta base, y la promesa de `/privacidad` no se puede
   cumplir aunque todo lo demás esté resuelto.
2. **La disposición decidida tiene que alcanzar Storage sin destruir evidencia
   antes de tiempo.** Cuando la categoría sea 🟢 BORRA y no exista retención,
   referencia, respaldo pendiente ni legal hold, una purga gobernada debe
   eliminar todas sus versiones y copias aplicables. Un soft-delete interactivo
   no debe borrar físicamente el objeto. Para 🔵 CONSERVA, el objeto permanece
   protegido y fuera de la vista normal hasta vencer la obligación.
3. **`SET NULL` + markbox en texto es el peor patrón** de los que hay: deja a la
   persona identificada y sin forma de encontrarla. Donde se conserve por
   obligación, conviene 🟣 **ANONIMIZAR** de verdad — vaciar `client_name` y
   markbox— en vez de anular el puntero.
4. **Nada de esto se construye como "botón de borrar"** hasta que el mapa esté
   cerrado. Mientras tanto, las solicitudes se atienden a mano y se registran en
   `client_change_requests` (Slice D).

---

## 6 · Cómo se verifica que esto es cierto

Un mapa en un documento es una hipótesis. La comprobación real —sembrar un valor
único, ejercer el borrado y buscarlo en los 217 sitios— está descrita en §6 de la
[auditoría](AUDITORIA-2026-07.md) y **sigue sin correrse**: exige escritura en la
base y autorización nombrada del founder.

Hasta que se corra, este documento dice **dónde habría que buscar**, no qué
sobrevive.

## 7 · Norte documental para adjuntos

[SDD-0224](../../specs/0224-adjuntos-seguros-reanudables/spec.md) está `approved`
y ya implementa el plano común de versionado, borrado lógico, restore, retención,
legal hold y purga fail-closed, junto con el bucket privado `erp-attachments` y
las migrations `0306`–`0314`. El piloto de Gastos permanece apagado en
Producción: no hay proveedor externo, antivirus ni restore drill reales
verificados, por lo que ningún adjunto puede declarar estado `protegido`.

## 8 · Rollout Cloud SDD-0235

La migration `0325` está **CORRECTA en Cloud**: crea la huella anti-abuso del PIN
sin IP cruda, limita el RPC por tenant/región y fue verificada contra objetos,
ACL y ledger. El hotfix autorizado incorpora el código compatible y la purga
técnica a 48 horas.

Las migrations `0326`–`0329` y su código consumidor siguen fuera de Producción;
requieren autorización nominal, aplicación y validación por separado.

El respaldo inmutable conservará versiones aunque el origen sea elegible para
borrado. Esto no es una excepción silenciosa: la disposición física debe esperar
el vencimiento aplicable o legal hold y quedar registrada. Sin decisión de
retención, contrato y procedimiento de terminación del proveedor, el borrado de
la copia externa sigue **NO VERIFICABLE**.

---

*Documento vivo. Se actualiza cuando llegue la respuesta de la abogada y cada vez
que aparezca una tabla, un bucket o un proveedor nuevo. No es asesoría legal.*
