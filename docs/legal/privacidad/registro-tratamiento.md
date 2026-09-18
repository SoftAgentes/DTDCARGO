# Registro de actividades de tratamiento — DTD Cargo

> Documento vivo. Las filas vienen del inventario de
> [`AUDITORIA-2026-07.md`](AUDITORIA-2026-07.md) §2; las columnas **Finalidad**,
> **Base** y **Conservación** las decide un humano — la auditoría no las puede
> inventar.
>
> Cuando la abogada pregunte "¿qué datos tratan?", esto es lo que se le enseña.
> Se actualiza cada vez que se agrega un campo, una finalidad o un proveedor.

**Quien trata los datos:** INVERSIONES DTD SERVICES, C.A · RIF J-50648869-8
**Marca pública:** DTD Cargo
**Contacto para titulares:** info@dtdcargo.com (asunto "Privacidad")
**Representante en China (PIPL art. 53):** ⬜ pendiente de decidir
**Versión:** 1.4 · **Última actualización:** 2026-09-11

---

## 1 · Datos de clientes

| Tabla · campo | Qué es | Sensible | Obligatorio | Finalidad | Base | Conservación | Quién más lo ve |
|---|---|:-:|:-:|---|---|---|---|
| `clients.name` | Nombre o razón social | no | sí | Prestar el servicio | Contrato | ⬜ | Equipo VE y CN · Kommo |
| `clients.rif` | Cédula o RIF | no | sí | Identificación y nacionalización | Contrato + obligación legal | ⬜ | Equipo VE · aduana |
| `clients.email` | Correo | no | sí | Comunicación del servicio | Contrato | ⬜ | Resend · Kommo |
| `clients.phone` | Teléfono / WhatsApp | no | sí | Coordinación de entrega | Contrato | ⬜ | Equipo VE y CN · Kommo |
| `clients.address` | Dirección de entrega | no | no | Última milla | Contrato | ⬜ | Equipo VE · **Nominatim** ⚠️ |
| `clients.facade_photo_url` | **Foto de la fachada de la vivienda** | 🟠 | no | Encontrar la casa en la entrega | ⬜ **no declarada en la política** | ⬜ | Camionero |
| `clients.notes` | Texto libre | ⚠️ puede volverse sensible | no | ⬜ no evidente en el código | ⬜ | ⬜ | Equipo VE |
| `client_users.email` | Login del Portal | no | sí | Acceso al Portal | Contrato | ⬜ | Supabase Auth |
| `persons.national_id` | Cédula / RIF / pasaporte | no | sí | Identidad unificada | Contrato | ⬜ | Equipo VE |

## 2 · Datos capturados en la entrega ⚠️

**Ninguno de estos está declarado en `/privacidad`.** Ver hallazgo H-6.

| Tabla · campo | Qué es | Sensible | Finalidad | Base | Conservación | Quién lo captura |
|---|---|:-:|---|---|---|---|
| `dispatch_pods.received_by` | Nombre de quien recibe | no | Prueba de entrega | ⬜ | 🔴 **ninguna** | Camionero / almacenista |
| `dispatch_pods.received_doc` | Su documento de identidad | no | Prueba de entrega | ⬜ | 🔴 **ninguna** | ídem |
| `dispatch_pods.signature_path` | **Firma manuscrita** | 🔴 biométrico | Prueba de entrega | ⬜ | 🔴 **ninguna** | ídem |
| `dispatch_pods.photo_path` | Foto (mercancía y/o persona) | 🔴 si sale el rostro | Prueba de entrega | ⬜ | 🔴 **ninguna** | ídem |
| `dispatch_pods.pod_lat/lng` | **GPS del punto de entrega** | 🔴 geolocalización | Prueba de entrega | ⬜ | 🔴 **ninguna** | ídem |

## 3 · Datos de empleados y choferes

| Tabla · campo | Qué es | Sensible | Finalidad | Base | Conservación |
|---|---|:-:|---|---|---|
| `nomina_employees.*` | Nombre, nacimiento, banco, salario | no | Nómina | Obligación legal laboral | ⬜ |
| `nomina_employee_registrations.*` | + cédula y foto de **candidatos** | no | Alta de personal | ⬜ | 🔴 **indefinida por diseño**, incluso si se rechaza |
| `tms_drivers.cedula`, `address` | Identidad del chofer | no | Operación de flota | Contrato laboral | ⬜ |
| `tms_drivers.emergency_contact` | **Nombre y teléfono de un familiar** | no | Emergencias | 🔴 **el titular nunca consintió** | ⬜ |
| `tms_drivers.rating` | Calificación 0.0–5.0 | no | ⬜ no evidente | ⬜ | ⬜ |
| `tms_truck_locations.lat/lng` | **Rastreo del chofer** | 🔴 geolocalización | Seguimiento de flota | ⬜ | 🔴 **ninguna** |

## 4 · Los 12 buckets

| Bucket | Qué guarda | Sensible | Conservación | Comportamiento observado |
|---|---|:-:|---|:-:|
| `client-docs` | Foto del documento de identidad del cliente | 🔴 | Propuesta: vigente mientras sea necesaria; histórica máx. 30 días desde reemplazo | `0445` conserva históricos; `0447` (aplicada) contenía nuevos reemplazos; SDD-0481/`0461` (pendiente) los habilita dentro del cupo de 3 y conserva hasta 3 versiones sustituidas por cliente. Purga a 30 días, gate VE y borrado integral siguen sin implementar. Ver [`fotos-identidad-cliente-v1.md`](fotos-identidad-cliente-v1.md) |
| `client-facades` | Foto de la vivienda | 🟠 | ⬜ | reemplazos físicos; borrado integral NO VERIFICABLE |
| `receipt-photos` | Recepción CN + **POD y firmas** | 🔴 | ⬜ | Gastos móvil elimina objetos; otros flujos difieren |
| `payment-proofs` | Comprobantes con datos bancarios | 🟠 | ⬜ | borrado integral NO VERIFICABLE |
| `bitacora` | **Audio y video de reuniones** | 🔴 voz | ⬜ | soft-delete seguido de eliminación física |
| `documents` | Documentación operativa y financiera | 🟠 | ⬜ | soft-delete seguido de eliminación física |
| `inspections`, `claim-evidence`, `shipment-docs` | Evidencia operativa | 🟠 | ⬜ | varios flujos eliminan físicamente después de soft-delete |
| `prealerta-docs` | Facturas, packing, fotos y capturas de proveedor | 🟠 | ⬜ | borrado integral NO VERIFICABLE |
| `expense-receipts` | Recibos de Gastos | 🟠 | ⬜ | Studio conserva; móvil elimina: comportamiento contradictorio |
| `bug-replays` | Replays técnicos comprimidos | ⚠️ puede contener datos | ⬜ | creación/policies no trazadas en migraciones; NO VERIFICABLE |

✅ Los 12 observados en Producción son `public = false`.

El borrado de una fila PostgreSQL no elimina automáticamente el objeto de
Storage. Sin embargo, varias acciones de aplicación sí llaman
`Storage.remove()` después de marcar la fila, por lo que hoy no existe una
semántica uniforme ni una restauración garantizada. SDD-0224 propone separar
borrado lógico, restauración y purga física gobernada.

## 4.1 · Cola local de adjuntos

Las colas móviles de fotos y POD guardan base64 en `localStorage`. La cola POD
incluye nombre, documento, firma, fotografía y GPS. Hoy no existe separación por
tenant/usuario, cifrado local ni garantía contra descarte por cuota.

Estado: **ENCONTRADO** en `app/m/_lib/{photo-queue,pod-queue}.ts`. SDD-0224 ya
implementa una cola IndexedDB separada por tenant/usuario únicamente para el
piloto web de Gastos. Las colas móviles descritas aquí siguen sin migrarse y
quedan fuera de ese piloto.

## 4.2 · Telemetría y anti-abuso añadidos por SDD-0235

| Destino | Dato | Minimización | Retención | Estado de rollout |
|---|---|---|---|---|
| `operario_pin_attempts` | huella SHA-256 de tenant + región + IP | no conserva IP cruda ni PIN | 48 h en cron | **CORRECTO en Cloud: migration 0325 aplicada y ACL verificadas; código compatible incluido en el rollout autorizado** |
| `public_track_log.ip` | huella SHA-256 del origen desde `0326`; las filas previas pueden conservar IP cruda | deja de guardar IP cruda en filas nuevas; sin backfill | **ninguna**: no hay cron ni DELETE (corregido por SDD-0455; antes decía «48 h en cron») | **ENCONTRADO en migration 0326; Cloud NO VERIFICABLE** |
| `portal_registro_throttle.ip` (`portal-login:`) | huella SHA-256 de IP | separada por namespace; no email | 48 h en cron | **ENCONTRADO en código local; Producción NO VERIFICABLE** |
| rrweb | DOM de últimos 15 s | inputs y texto enmascarados; flag off por defecto | ⬜ | **ENCONTRADO en código local; Producción NO VERIFICABLE** |

Estas huellas siguen siendo identificadores técnicos y se conservan solo para
anti-abuso. No se reutilizan para marketing, perfilado ni decisiones sobre la
persona.

## 4.3 · Anti-abuso de `/verificar` (SDD-0455)

| Destino | Dato | Minimización | Retención | Estado de rollout |
|---|---|---|---|---|
| `public_verify_throttle.ip` | IP en claro de quien consulta `/verificar` (QR de cajas y diplomas), con `created_at` | solo se cuenta dentro de la ventana de 30 min; fuera de ella no tiene uso | purga técnica de filas con más de 60 min; el cron corre una vez al día, así que una fila dura hasta unas 25 h | **CORRECTO en código** (`app/api/cron/purge-throttle/route.ts:36,78-82`); Producción NO VERIFICABLE hasta desplegar y ver la primera corrida |

A diferencia de las huellas de §4.2, esta IP se guarda en claro: el throttle
cuenta por su texto exacto (`lib/public/verify-throttle.ts`). Base de licitud y
aviso: ⬜.

## 5 · Titulares que no son usuarios

| Quién | Qué se le captura | ¿Se le avisa? | ¿Cómo ejerce sus derechos? |
|---|---|:-:|---|
| Quien recibe una entrega | nombre, documento, firma, foto, GPS | ❌ | ⬜ ninguna vía |
| Contacto de emergencia del chofer | nombre y teléfono | ❌ | ⬜ ninguna vía |
| Contacto del proveedor CN | nombre y contacto | ❌ | ⬜ ninguna vía |
| Referido | contacto que da un cliente | ✅ parcial (`/privacidad` §1) | ⬜ |
| Pagador tercero | nombre y relación | ❌ (solo Acuerdo cl. 7.4) | ⬜ |
| Quien escanea un QR en `/verificar` (almacén, destinatario) | IP y hora de la consulta (§4.3) | ⚠️ solo la política general: el pie de `/verificar` enlaza `/privacidad`, que menciona la IP «para prevenir usos indebidos» | ⬜ |

## 6 · A dónde van

Detalle completo en [`inventario-terceros.md`](inventario-terceros.md).

Los que faltan resolver: **Nominatim** (dirección del cliente, sin contrato) ·
**Cloudflare Workers AI** (audio de reuniones) · **Supabase** (región Cloud
`us-east-1`, verificada 2026-09-04; contratos y retención del proveedor
NO VERIFICABLES) · **equipo de Yiwu** (PIPL, sin gate regional ni
consentimiento separado) ·
**respaldo externo de adjuntos** (proveedor, región, contrato, retención y
transferencia `NO VERIFICABLE`; no está conectado).

## 7 · Decisiones automatizadas

| Decisión | Qué usa | Efecto | Versión registrada | ¿Se informa? | Revisión humana |
|---|---|---|:-:|:-:|---|
| Verificación de identidad (`name-match.ts`) | nombre vs. CNE/SENIAT | veredicto `ok`/`mismatch` | ❌ | ❌ | ⬜ no declarada |
| `tms_drivers.rating` | desempeño | calificación 0–5 | ❌ | ❌ | ⬜ |

> `dispatch-scoring.ts` puntúa **paquetes**, no personas. No entra acá.

## 8 · Evidencia de aceptación

| Documento | Versión | ¿Sella el texto? | ¿Inmutable en la base? | Append-only | Escalón |
|---|---|:-:|:-:|:-:|---|
| Acuerdo de Servicios | v3.0 | ❌ solo la referencia | ❌ | ✅ trigger | **art. 17** |
| Política de Privacidad | v1.0 borrador | ❌ no está en `legal_docs` | ❌ | ❌ | — |
| Política de Cookies | v1.0 borrador | ❌ | ❌ | ❌ | — |
| POD (`dispatch_pods`) | — | ❌ | ❌ | ❌ | **art. 17** |

## 9 · Medidas de seguridad

- **Control de acceso:** RLS por tenant (SDD-0085), con tests contractuales SQL.
- **Buckets:** los 11 privados; acceso por signed URL.
- **Cifrado en tránsito:** HTTPS; headers en `next.config.ts`.
- **Cifrado en reposo:** ⬜ NO VERIFICABLE — depende de la configuración de Supabase.
- **Seudonimización:** solo `consent_ip_hash` en `newsletter_subscribers`.
- **Registro de accesos:** `entity_audit_log`, `no_olvidar_access_log`.
- **Prueba de restauración de respaldos:** ⬜ ¿cuándo fue la última vez de verdad?
- **Gate de adjuntos:** código local exige AV, Object Lock y restore verificados;
  proveedor, ejecución y evidencia productiva siguen **NO VERIFICABLES**.

## 10 · Solicitudes recibidas

| Fecha | Titular | Derecho | Acuse | Respuesta | Resultado |
|---|---|---|---|---|---|
| | | acceso · conocer uso y finalidad · actualización · rectificación · destrucción · confidencialidad | | | |

**Venezuela no fija plazo legal.** El que DTD publique se vuelve exigible por
haberlo publicado.

- **Plazo de acuse publicado:** ⬜ (propuesta: 5 días hábiles)
- **Plazo de respuesta publicado:** ⬜ (propuesta: 20 días hábiles)
- Hoy `/privacidad` §8 dice *"un plazo razonable"* — no significa nada y no se
  puede auditar.

---

*⬜ = pendiente de decisión humana. Plantilla de apoyo, no un documento legal.*
