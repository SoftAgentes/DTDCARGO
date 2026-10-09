# Revisión de datos personales · Traslado de Supabase Cloud al servidor propio en Contabo (SDD-0505)

- **Fecha:** 2026-10-09
- **Alcance:** el traslado de la base y del Storage de DTD Cargo desde Supabase Cloud (AWS `us-east-1`) a Supabase self-hosted en un Contabo Cloud VPS 8 (Contabo GmbH, datacenter US East / Carlstadt, Nueva Jersey, IP `217.216.54.70`), y los respaldos fuera del proveedor (Cloudflare R2 o Backblaze B2). Rama `codex/dockerizar-dtd-cargo-contabo`, HEAD `394fa0fe`, PR #194, leída en modo solo lectura. Las rutas `archivo:línea` se refieren a ese commit.
- **Fuera del alcance:** auditar de nuevo todo el sistema. El inventario general y los hallazgos de fondo (retención, borrado, POD, PIPL) ya están en `AUDITORIA-2026-07.md`, `registro-tratamiento.md` y `mapa-de-borrado.md`; aquí solo se evalúa lo que **cambia o se agrava** con el traslado.
- **Método:** skill `revisar-datos-ve` (inventario, los doce puntos y reporte), con tres revisiones en paralelo del repo y verificación propia de los hallazgos críticos. En producción solo se leyeron **metadatos y conteos** (tamaños, número de filas, ids de buckets, `pg_default_acl`), nunca filas de negocio. El panel de Contabo se consultó en modo lectura.
- **Para qué sirve:** es insumo técnico para que Sam decida, con su abogado, si autoriza exportar producción. **No es asesoría legal.**

## Resumen

| Estado | Cantidad |
|---|---|
| ENCONTRADO | 14 |
| CORRECTO | 6 |
| NO VERIFICABLE | 8 |

**Lectura corta:** el servidor está bien cerrado hacia afuera (TLS, base no expuesta, imagen sin datos), pero el **manejo de los datos durante y después del traslado** todavía no está a la altura: los respaldos saldrían sin cifrar, la clave raíz de Vault no se respalda, no hay acuerdo de tratamiento (DPA) con Contabo, la política publicada dice que los datos «se tratan en Venezuela» y el dump de producción no tiene un procedimiento de traslado y borrado escrito. Hay siete condiciones previas antes de exportar (al final).

## Medido en producción (2026-10-09, solo metadatos)

| Medida | Valor |
|---|---|
| Base | Postgres 17.6, 69 MB |
| Usuarios de `auth` | 297 |
| Objetos en Storage | 634, 445 MB |
| Buckets | **16**: `audit-exports`, `bitacora`, `brand-assets`, `bug-replays`, `claim-evidence`, `client-docs`, `client-facades`, `document-imports`, `documents`, `erp-attachments`, `expense-receipts`, `inspections`, `payment-proofs`, `prealerta-docs`, `receipt-photos`, `shipment-docs` |
| Secretos en `vault.secrets` | 2 |
| `dispatch_pods` (POD) | 0 filas, 0 selladas |
| `legal_acceptances` | 0 filas |
| Default privileges de `postgres` en `public` | tablas, secuencias y funciones solo para `postgres` y `service_role` |

`bug-replays` **no lo crea ninguna migración** (solo tiene policies en `supabase/migrations/0363_storage_bug_replays_restrictive.sql:37`) y `document-imports` sale de `0457`, que el repo marca como no aplicada (`supabase/migrations/0457_document_import_workspaces.sql:1`), pero el bucket **sí existe** en Cloud. El runbook habla de «15 buckets» (`docs/runbooks/servidor-contabo.md:356`): son 16.

## 1 · Inventario de lo que se mueve

El dump completo (`public`, `auth`, `storage`, más `vault` según `docs/runbooks/backup-restore-servidor.md:17`) traslada **todo** el inventario de `registro-tratamiento.md` y `AUDITORIA-2026-07.md`. Lo más sensible, por categoría:

| Categoría | Dónde (tabla.campo o bucket) | Evidencia |
|---|---|---|
| Documento de identidad | `clients.rif`, `clients.cedula_photo_path`, `persons.national_id`, `client_billing_identities.doc`, `nomina_employees.national_id`, `tms_drivers.cedula`, `dispatch_pods.received_doc`, `academy_enrollments.student_ci` | `0006_clients.sql:17` · `0091_portal_self_register.sql:24` · `0170_persons.sql:19` · `0466_client_billing_identity.sql:149-162` · `0160_nomina_employees.sql:26-39` · `0011_tms_schema.sql:42-53` · `0025_operario_roles_extend.sql:45-48` · `0144_academia.sql:155-157` |
| Fotos de documentos y de personas | buckets `client-docs` (cédula/RIF y avatar), `receipt-photos` (recepción en China, POD y firma), `documents` (carpeta KYC), `client-facades` (fachada de la vivienda), `inspections` | `lib/portal/client-photo.ts:72-108` · `app/m/ve/camionero/actions.ts:143-162,243-252` · `lib/studio/documents/types.ts:174` |
| Firma y receptor (tercero) | `dispatch_pods.signature_path`, `received_by`; copias en `shipments.pod_signed_by` y `entity_audit_log` | `0025_operario_roles_extend.sql:45-48` · `0009:13` · `0321:234` |
| Geolocalización | `clients.lat/lng`, `dispatch_pods.pod_lat/lng`, `tms_truck_locations`, `user_profiles.operating_lat/lng` | `0048_clients_geo.sql:13-14` · `0068_pod_partial_and_gps_addons.sql:20-23` · `0066_foundation_v3.sql:211-212` |
| Financiero | `nomina_employees.bank_*`, `salary_usd`; bucket `payment-proofs`; `payment_receipts.payer_*` | `0160_nomina_employees.sql:26-39` · `lib/portal/payment-proof.ts:96-102` · `0122_recibos_cobranza.sql:36-38` |
| Voz y video | bucket `bitacora`, `bitacora_meetings.transcript` | `0214_bitacora.sql:94-98,726-741` |
| Sesiones grabadas | bucket `bug-replays` (rrweb) | `lib/studio/bug-rrweb-capture.ts:1-8` |
| Red (IP, user-agent) | `legal_acceptances.ip`, `no_olvidar_access_log`, `public_track_log`, `auth.audit_log_entries`, `auth.sessions` | `0102_capa_legal.sql:98` · `0017_no_olvidar.sql:126-127` · `0059:26` |
| Terceros que no son usuarios | receptor del POD, contacto de emergencia del chofer, contactos de proveedores chinos, referidos, pagador tercero, leads de Kommo (2.942 contactos), candidatos rechazados | `0025:45-48` · `0011:53` · `0105:63-66` · `0098_fidelizacion_referidos.sql:52-55` · `0082:74,78` · `0180:80-90,102` |
| Secretos | `vault.secrets` (2): `kommo_cron_key` y la llave del No-Olvidar | `0084_kommo_cron_sync.sql:20-23` · `0017_no_olvidar.sql:503-508` |

Sin datos de salud ni de menores en columnas (búsqueda sin resultados en las migraciones).

## 2 · Hallazgos, por gravedad

### H1 · ENCONTRADO · crítico — Los respaldos saldrían sin cifrar

- **Qué:** el runbook manda cifrar cada dump con `age` y la clave pública de Sam (`docs/runbooks/backup-restore-servidor.md:17,44-46`), pero el script que lo hace sube el dump en claro: `pg_dump -Fc` → sha256 → `rclone copy` (`infra/ops/backup/pg-dump-to-s3.sh:5-12,141-142`). No existe `BACKUP_AGE_RECIPIENT` en ningún archivo de `infra/`, y `infra/ops/backup/restore.sh` no descifra nada. La plantilla (`infra/templates/proyecto/backup.sh`) repite el problema.
- **Por qué importa:** cada respaldo es la base completa (cédulas, fotos de identidad por referencia, cuentas bancarias de empleados, GPS) en un bucket de un tercero, legible por cualquiera con la credencial del bucket.
- **Norma:** SC 332/2001, principio de **seguridad y confidencialidad**. Riesgo penal si alguien la obtiene o la revela: Ley Especial contra los Delitos Informáticos, arts. 20 y 22.
- **Arreglo:** en `pg-dump-to-s3.sh`, exigir `BACKUP_AGE_RECIPIENT` (fallar si falta), cifrar el `.dump` y el `roles.sql` con `age -r` antes del `rclone copy`, borrar los claros locales y subir solo `.age`. En `restore.sh`, descifrar con la identidad que entra por variable o archivo y nunca vive en el servidor. Prueba del script con un dump de juguete: el objeto remoto no debe ser legible por `pg_restore --list` sin descifrar.

### H2 · ENCONTRADO · crítico — La clave raíz de Vault no se respalda, y el runbook la confunde

- **Qué:** `docs/runbooks/backup-restore-servidor.md:128` dice que `VAULT_ENC_KEY` «descifra `vault.secrets`». Es falso: `VAULT_ENC_KEY` es del servicio Supavisor (`infra/dtd-cargo/compose.supabase.yml:553`, igual que el compose oficial). La clave raíz de pgsodium/Vault vive en el volumen `db-config` (`infra/dtd-cargo/compose.supabase.yml:482-483`), que ningún respaldo incluye.
- **Consecuencias:** (1) los **2 secretos** que hoy están en el Vault de Cloud viajan cifrados con la clave raíz de **Cloud**, así que el Vault nuevo no podrá leerlos: Kommo deja de sincronizar y la llave del No-Olvidar queda ilegible (y con ella las contraseñas guardadas ahí); (2) si se pierde el disco del VPS, se pierde la clave raíz y todo lo que se cifre en el Vault nuevo.
- **Norma:** SC 332/2001 (seguridad; también **exactitud**: un dato ilegible es un dato perdido).
- **Arreglo:** (a) decidir si se obtiene la clave raíz del proyecto de Cloud (vía soporte o dashboard de Supabase) o si se **recrean** los 2 secretos en el VPS: `kommo_cron_key` es regenerable; la llave del No-Olvidar exige exportar antes las entradas en claro de forma controlada o aceptar que se pierden; (b) respaldar `pgsodium_root.key` cifrada con `age`, fuera del servidor, junto con el `.env`; (c) corregir `backup-restore-servidor.md:112-115,128-129`.

### H3 · ENCONTRADO · alto — No hay acuerdo de tratamiento de datos con Contabo, y los nuevos terceros no están inventariados

- **Qué:** el panel de Contabo (*DPA*, consultado el 2026-10-09) dice textualmente que la cuenta no tiene ningún DPA para sus suscripciones, y que el acuerdo es obligatorio si se procesan datos personales con sus servicios. Ofrece generarlo en línea. `docs/legal/privacidad/inventario-terceros.md:22-34` no lista a **Contabo**, **Backblaze**, **Tailscale** ni a Cloudflare como **R2/proxy** (solo como Workers AI, :27). Para R2, el DPA ya figuraba como no verificado (`docs/legal/privacidad/cloudflare-r2-adjuntos-expediente-contractual.md:42-47`).
- **Por qué importa:** en Venezuela no existe la figura legal del encargado; el contrato es lo único que delimita quién responde si un tercero obtiene o revela los datos (Ley Especial contra los Delitos Informáticos, arts. 20-22). Además, la política promete que los proveedores trabajan «bajo obligación de confidencialidad» (`app/privacidad/page.tsx:221-222`): sin contrato, esa frase no tiene respaldo.
- **Arreglo:** que Sam genere y revise con su abogado el DPA de Contabo en el panel (*DPA → Crear nuevo Acuerdo de Procesamiento de Datos*) **antes** de exportar; agregar a `inventario-terceros.md` las filas de Contabo (alojamiento de toda la base y del Storage, EE. UU.), el proveedor de respaldos elegido (R2 o B2, con región) y Tailscale (metadatos de administradores); llenar `references/plantillas/evaluacion-proveedores.md` para cada uno.

### H4 · ENCONTRADO · alto — La política publicada no describe dónde están los datos

- **Qué:** `app/privacidad/page.tsx:262-264` dice «Tus datos identificatorios —nombre, documento, dirección y teléfono— se tratan en Venezuela». Ya es falso hoy (Supabase está en `us-east-1`, `inventario-terceros.md:24`; hallazgo previo H3 de `revision-0473-cotizador-2026-09-18.md:49-52`) y lo seguirá siendo con Contabo en Nueva Jersey. Además: no menciona respaldos fuera del servidor; «accesibles solo con tu sesión» (`app/privacidad/page.tsx:312-313`) no cubre que el operador lee los respaldos; «Eliminar tu cuenta y tus datos» (`:330-331`) no menciona que los respaldos conservan copias durante su retención.
- **Norma:** SC 332/2001, **autonomía**: el consentimiento solo es informado si la política dice la verdad. Lo publicado obliga por haberlo publicado (responsabilidad civil). La política promete avisar si el cambio es importante (`app/privacidad/page.tsx:366-368`).
- **Arreglo:** antes del corte (Fase 3), reescribir §5 para decir que los datos se alojan en servidores en **Estados Unidos** operados por un proveedor de infraestructura, con respaldos cifrados en otro proveedor; ajustar §6 (los respaldos conservan copias hasta X días tras una supresión) y §7; mover `UPDATED` (`:23`) y avisar a los clientes. La redacción la revisa el abogado.

### H5 · ENCONTRADO · alto — El dump de producción no tiene un procedimiento seguro de traslado y borrado

- **Qué:** el runbook genera `roles.sql`, `schema.sql` y `data.sql` **en texto plano** en la laptop, en la carpeta en que esté parado (`docs/runbooks/servidor-contabo.md:336-339`). No dice en qué carpeta: el `.gitignore` raíz no excluye `*.sql` (`.gitignore:51-53`), así que un dump dentro del repo podría terminar en un commit. Dice «viaja por scp» (`:304`) pero el bloque no trae el `scp`. Ordena borrarlo «del disco local» (`:29,304`) sin comando ni verificación, y no dice nada de la copia que queda en el VPS. El dump final de la Fase 3 (`:422-423`) repite todo. **No minimiza:** `--data-only` completo, sin excluir tablas de log (`mail_logs`, `sync_logs`, `public_track_log`, `no_olvidar_access_log`, `operario_pin_attempts`, `entity_audit_log`, `auth.audit_log_entries`).
- **Norma:** SC 332/2001 (**seguridad**; **finalidad y temporalidad**: lo que no se necesita en destino no viaja).
- **Arreglo:** escribir el procedimiento: carpeta de trabajo fuera del repo; `age -r` sobre cada archivo apenas sale de `pg_dump`; `scp` del `.age` al VPS; restaurar desde ahí; `shred`/borrado verificado en laptop y VPS con evidencia en el handoff; decidir qué tablas de log se excluyen con `--exclude-table-data`. Para Storage, claves S3 **temporales** y revocadas al terminar, y `rclone` corriendo en el VPS para que las fotos no pasen por la laptop.

### H6 · ENCONTRADO · medio-alto — El staging se quedaría con PII real de forma permanente

- **Qué:** la Fase 2 restaura la copia completa de producción en `/srv/dtd-cargo-staging` (`docs/runbooks/servidor-contabo.md:308-343`) y el restore mensual de prueba también va a staging (`docs/runbooks/backup-restore-servidor.md:89-104`). Nada lo anonimiza ni lo destruye. Los restores dejan además dumps en claro sin borrar (`backup-restore-servidor.md:96-104`; `infra/ops/README.md:97-111`).
- **Norma:** SC 332/2001 (**temporalidad** y **finalidad**: una copia de ensayo no tiene finalidad pasado el ensayo).
- **Arreglo:** staging efímero: se levanta para el ensayo y se destruye (volúmenes incluidos) al cerrarlo, con evidencia; el restore mensual corre en un contenedor desechable que se borra al terminar; si hace falta un staging permanente, que sea con datos anonimizados.

### H7 · ENCONTRADO · medio — Retención de respaldos contradictoria y sin camino para la supresión

- **Qué:** el script retiene 30 días en el bucket y 7 en local (`infra/ops/backup/pg-dump-to-s3.sh:42-43`); el runbook pide 30 diarios + 12 semanales + 12 mensuales, o sea copias de hasta un año (`docs/runbooks/backup-restore-servidor.md:50`). Ninguno dice qué pasa cuando un titular pide la destrucción de sus datos (CRBV art. 28) y la fila ya está en respaldos. La credencial de subida es la misma que borra (`pg-dump-to-s3.sh:172-174`), contra lo que pide el runbook (`backup-restore-servidor.md:60-63`).
- **Norma:** CRBV art. 28 (destrucción) · SC 759/2025 (derecho al olvido) · SC 332/2001 (temporalidad).
- **Arreglo:** fijar **una** retención (recomendación técnica: 30 días, que es lo implementado) y escribirla en la política; documentar que una supresión se ejecuta en la base viva y desaparece de los respaldos al cumplirse esa retención; separar la credencial de borrado (regla de ciclo de vida del bucket) de la de subida.

### H8 · ENCONTRADO · medio — Acceso administrativo más abierto de lo que pide el runbook

- **Qué:** el runbook pide usuario `deploy` y `PermitRootLogin no`, y el puerto 22 solo desde una IP conocida (`docs/runbooks/servidor-contabo.md:116-122,136-138`). En el servidor real: root entra con llave (`PermitRootLogin prohibit-password`), no existe `deploy` y el 22 está abierto a cualquier origen en ufw y en el firewall del panel (`.agents/handoffs/0505-dockerizar-dtd-cargo-contabo.md:62-63,86`). Mitigan: solo llave, fail2ban y la auditoría de accesos del 2026-10-09 (sin intrusiones). **La llave `~/.ssh/contabo` se generó sin passphrase** (la generó el agente con `-N ""`): quien copie ese archivo de la laptop entra como root.
- **Norma:** SC 332/2001 (**seguridad y confidencialidad**: acceso restringido).
- **Arreglo:** ponerle passphrase a la llave (`ssh-keygen -p -f ~/.ssh/contabo`); crear `deploy` con sudo y pasar a `PermitRootLogin no`; cerrar el 22 al público cuando exista Tailscale; activar 2FA en la cuenta de Contabo.

### H9 · ENCONTRADO · medio — Superficies expuestas de más

- **Qué:** el endpoint S3 de Storage (`/storage/v1/s3`), que da acceso total a los buckets saltando RLS, queda público por Traefik (`infra/dtd-cargo/compose.supabase.yml:146`), protegido solo por una clave estática (`:352-353`). Uptime Kuma se publica sin `tailscale-only@file` (`infra/ops/uptime-kuma/compose.yml:27-33`), contra `servidor-contabo.md:162`. Los routers de la web y del gateway no aplican `security-headers@file` (`infra/dtd-cargo/compose.yml:84`; `compose.supabase.yml:146-153`).
- **Arreglo:** sacar `/storage/v1/s3` del router público (o restringirlo con `tailscale-only@file`); Uptime Kuma detrás de Tailscale; `security-headers@file` en el router del gateway.

### H10 · ENCONTRADO · medio — Logs con datos personales sin finalidad ni retención declaradas

- **Qué:** el access log de Traefik guarda IP y ruta completa con query (`infra/ops/traefik/compose.yml:32-33`), lo que incluye tokens como `token_hash` del magic link. Su retención la fija el tamaño (10 MB × 3, `:25-29`), no una política. fail2ban y `auth.log` guardan IPs sin retención declarada.
- **Norma:** SC 332/2001 (finalidad y temporalidad).
- **Arreglo:** declarar la finalidad (seguridad) y la retención (p. ej. 14 días) en `registro-tratamiento.md`; filtrar del access log los parámetros de query sensibles (Traefik `accesslog.fields.names` / headers) o no registrar el query.

### H11 · ENCONTRADO · medio — La copia del Storage tiene huecos

- **Qué:** el runbook no dice dónde corre `rclone` ni con qué credenciales (`docs/runbooks/servidor-contabo.md:358-365`); el staging se levanta sin el overlay S3, así que el backend queda en `file` (`infra/dtd-cargo/compose.supabase.yml:345,354-355`) y los objetos quedan en el disco del VPS fuera de todo respaldo; y se habla de 15 buckets cuando en Cloud hay **16** (incluido `bug-replays`, que ninguna migración crea).
- **Arreglo:** listar los 16 buckets en el runbook y crear `bug-replays` en el destino antes de copiar; decidir si Storage vive en R2 desde el día uno (recomendado por `backup-restore-servidor.md:18`) o en disco con respaldo propio; comparar conteos por bucket (Cloud vs destino) como prueba del ensayo.

### H12 · ENCONTRADO · bajo — El retiro de Cloud y Vercel no destruye ni verifica

- **Qué:** la Fase 4 pausa Supabase Cloud y lo borra 30 días después, pero no fija qué pasa con sus respaldos/PITR ni cómo se verifica el borrado (`docs/runbooks/servidor-contabo.md:475-477`). Vercel solo se pausa (`:478-481`): siguen allí las variables con todos los secretos de producción y los logs con IPs.
- **Norma:** SC 332/2001 (temporalidad) · CRBV art. 28 (destrucción).
- **Arreglo:** al cerrar la Fase 4, borrar el proyecto de Supabase con evidencia, eliminar las variables de entorno de Vercel y luego el proyecto, y rotar todos los secretos que vivieron allí.

### H13 · ENCONTRADO (preexistente) · alto si aplica PIPL — Cambia el receptor extranjero de datos tratados en China

- **Qué:** el equipo de Yiwu trata datos en China (Shipping Mark, contactos de proveedores chinos, fotos de recepción, operarios con nombre en chino: `app/m/cn/nueva/actions.ts:70-96`, `0105:63-66`, `0020_operario_pins.sql:28-30`). Hoy esos datos salen de China hacia Supabase/AWS en EE. UU. sin el mecanismo del art. 38 ni consentimiento separado (`fotos-identidad-cliente-v1.md:95`; `inventario-terceros.md:34`). El traslado **cambia el receptor extranjero** (de Supabase/AWS a Contabo GmbH, y a R2/B2 para respaldos).
- **Norma:** PIPL arts. 38-39: hay que informar **nombre y contacto del receptor extranjero** y obtener consentimiento separado; art. 21: contrato con quien trata por encargo.
- **Arreglo:** no bloquea el traslado técnico, pero el día que se resuelva el mecanismo PIPL tiene que nombrar a Contabo (y al proveedor de respaldos), no a Supabase. Actualizar `pipl-*.md` y `registro-tratamiento.md:14` (representante en China pendiente).

### H14 · ENCONTRADO · bajo — Documentos internos desactualizados por el traslado

- **Qué:** `registro-tratamiento.md:135-140,165` (Supabase us-east-1; cifrado en reposo «depende de Supabase»), `mapa-de-borrado.md:204` (Supabase/Vercel) y `inventario-terceros.md:24-25,33` quedan describiendo el sistema viejo.
- **Arreglo:** actualizarlos en la misma PR que cierre la Fase 3, con la fecha del corte.

## 3 · Lo que está bien

| # | Qué | Evidencia |
|---|---|---|
| C1 | TLS público con Let's Encrypt, HSTS y redirección; Traefik pisa `X-Real-Ip`/`X-Forwarded-For` (prueba de spoof superada) | `infra/ops/traefik/compose.yml:41-56`; `.agents/handoffs/0505-dockerizar-dtd-cargo-contabo.md` § TLS de punta a punta |
| C2 | Postgres nunca expuesto: sin `ports:` y red `internal: true` | `infra/dtd-cargo/compose.yml:22-23,140-141`; `compose.supabase.yml:517-518` |
| C3 | La imagen Docker no lleva datos ni secretos: `.dockerignore` excluye `.env*`, `docs`, `supabase`, `infra`, `private`; el runner solo copia standalone, static y public | `.dockerignore:7-14,70-75,81-99`; `Dockerfile:102-104` |
| C4 | Servidor endurecido: SSH solo con llave, ufw 22/80/443, fail2ban, firewall del panel con solo 22/80/443; auditoría de accesos sin intrusiones el 2026-10-09 | `.agents/handoffs/0505-dockerizar-dtd-cargo-contabo.md` § Fase 1 en el VPS |
| C5 | El traslado no rompe evidencia existente: 0 POD sellados y 0 aceptaciones legales en producción. A futuro: el sello del POD incluye el `eTag` del objeto (`0300_pod_seal.sql:51-54`), así que cualquier copia de Storage posterior a la primera entrega sellada debe verificar `dispatch_pod_hash_valid()` antes y después | conteo de producción 2026-10-09 |
| C6 | La inmutabilidad de los documentos legales viaja con el dump: `body_sha256` sellado en el servidor y prohibición de editar o borrar lo publicado | `0297_legal_docs_body_hash.sql:36-37,85,102-103,120-122` |

## 4 · No verificable

| # | Qué falta mirar | Dónde |
|---|---|---|
| N1 | Si el disco de la laptop de Sam está cifrado (BitLocker): ahí se generaría el dump | Configuración de Windows |
| N2 | Contenido del DPA de Contabo (subencargados, notificación de brechas, borrado al terminar, cláusulas para EE. UU.). **Leído el 2026-10-09 (§5.1):** los cuatro puntos están cubiertos; el anexo 1 hay que corregirlo (personas afectadas) y la revisión legal sigue siendo del abogado | ~~Panel de Contabo~~ PDF en la carpeta de descargas de Sam |
| N3 | Si `supabase db dump` incluye los datos de `vault` y de `cron`. **Respondido el 2026-10-09 (§5.1): no los incluye, ni el ledger `supabase_migrations`** | ~~Ensayo de la Fase 2~~ ensayo con Cloud falso, CLI 2.118.0 |
| N4 | Si Supabase entrega la clave raíz de pgsodium del proyecto de Cloud | Soporte o dashboard de Supabase |
| N5 | Si Cloudflare R2 o Backblaze aceptan el pago desde Venezuela y en qué región quedan los datos | Checkout del proveedor |
| N6 | Qué hace Contabo con los discos dados de baja y con los snapshots (30 días); sin LUKS, contienen la base en claro | DPA / documentación de Contabo |
| N7 | Si la cuenta de Contabo tiene 2FA activado | Panel de Contabo → Cuenta |
| N8 | Si las sesiones de staging o de producción con PII se podrían ver desde el equipo de China (la policy de `client-docs` no filtra por región: `0091:53`) | Preexistente; prueba con un usuario de región `cn` |

## 5 · Condiciones previas para autorizar la exportación de producción

Exportar producción (Fase 2) es la primera vez que los datos reales salen de Supabase. Antes de dar el OK, propongo que se cumplan estas siete condiciones. Las marcadas **(Sam)** son de Sam o de su abogado; las demás las puede dejar listas el Worker en la PR #194 y quedan verificadas antes de pedir el OK.

1. **(Sam)** DPA con Contabo generado y revisado (H3).
2. Respaldo **cifrado** con `age` implementado y probado en `pg-dump-to-s3.sh` y `restore.sh` (H1).
3. Plan para los 2 secretos de Vault y respaldo cifrado de la clave raíz del VPS; runbook corregido (H2).
4. Procedimiento escrito y verificable del dump: carpeta fuera del repo, `age` al salir de `pg_dump`, `scp`, exclusión de tablas de log, borrado verificado en laptop y VPS, claves S3 temporales revocadas y `rclone` desde el VPS (H5, H11).
5. Staging **efímero**: se destruye al cerrar el ensayo, con evidencia (H6).
6. **(Sam)** Passphrase en la llave `~/.ssh/contabo` y 2FA en la cuenta de Contabo (H8, N7).
7. **(Sam)** Decisión sobre la retención de respaldos (H7) y sobre si la política se corrige **antes** del ensayo o antes del corte (H4). Recomendación técnica: antes del corte, porque la frase ya es falsa hoy y el ensayo no cambia a quién se le promete qué.

### 5.1 Seguimiento del Worker (2026-10-09, decisión de Sam: «sí, arranca con tus cuatro condiciones»)

Las cuatro condiciones del Worker (2, 3, 4 y 5) quedan implementadas en la PR #194 y probadas en el VPS con datos sintéticos y contenedores desechables: `infra/ops/tests/prueba-traslado-y-respaldos.sh`, **53 PASÓ · 0 FALLÓ**. Detalle y cifras en `.agents/handoffs/0505-dockerizar-dtd-cargo-contabo.md` § Cuatro condiciones.

| Condición | Estado | Evidencia |
|---|---|---|
| 2 · Respaldo cifrado (H1) | CORRECTO | `infra/ops/backup/pg-dump-to-s3.sh`: claros solo en `/dev/shm`, `age` obligatorio (rechaza sin destinatarios, con archivo vacío o con una clave privada), al remoto solo `.age`; `restore.sh` compara sha256 y descifra en memoria. Medido: `pg_restore` no lee el `.dump.age`; un `kill` durante la subida corta en 1 s sin dejar claros ni contenedores. |
| 3 · Raíz de Vault y runbook (H2) | CORRECTO | `config-backup.sh` respalda `.env` + `pgsodium_root.key` cifrados; `restore-test.sh --config` descifra Vault (1 de 1) y, como control, sin la raíz no (0 de 1). `backup-restore-servidor.md` §4 corregido (`VAULT_ENC_KEY` es de Supavisor). Los 2 secretos de Cloud se recrean con `migrate/vault-set-secret.sh`. |
| 4 · Procedimiento del dump (H5, H11) | CORRECTO en el ensayo con un Cloud falso; el ensayo con producción es el que lo valida | `migrate/import-from-cloud.sh` en el VPS: nada pasa por la laptop, dump en `/dev/shm`, credenciales con `read -s`, tablas de log fuera, verificación por conteos y evidencia sin datos personales, aviso para revocar la clave S3 temporal. Ya no aplica el `scp` desde la laptop que pedía el arreglo original: el dump nunca sale del VPS. |
| 5 · Staging efímero (H6) | CORRECTO | `staging/destroy-staging.sh` con guardas y comprobación de cero restos; el restore mensual pasa a un contenedor desechable en memoria (`restore-test.sh`, ~25 s). |

**El ensayo encontró tres huecos del procedimiento oficial** (`supabase db dump` + `psql`), todos cerrados en el script y en `servidor-contabo.md` §2.2:

- **N3 respondido:** el dump **no** trae los datos de `vault.secrets` ni los jobs de `cron.job`, y tampoco el esquema `supabase_migrations` (el ledger). El ledger va con `pg_dump` aparte, los jobs se recrean (inactivos en staging) y los secretos se escriben con `vault-set-secret.sh`.
- **Permisos abiertos por el restore (ENCONTRADO y corregido):** restaurando como `supabase_admin`, la imagen aplica sus default privileges abiertos y `pg_dump` no los revoca: una tabla con solo `SELECT` de `authenticated` en el origen quedó con `INSERT/UPDATE/DELETE/TRUNCATE` para `anon` y `authenticated`. Era exactamente el riesgo de exposición que la guarda del runbook buscaba. Ahora el script iguala los permisos de `public` a los de Cloud y lo comprueba por huella (control rojo sin la igualación: `DELETE` presente; con ella: huella idéntica).
- Queda **NO VERIFICADO** el mismo mecanismo en un DR real sobre la base `postgres` de un stack nuevo (`backup-restore-servidor.md` §3, pendiente antes del primer DR).

Las condiciones 1, 6 y 7 siguen siendo de Sam.

**Condición 1 · DPA:** Sam lo **generó en el panel de Contabo el 2026-10-09** («listo, ya generé el DPA en Contabo»; el documento dice concluido el 9 de octubre de 2026, 19:26 UTC+1, por el portal y sin firma). Contabo ya figura en `inventario-terceros.md`. El texto es un contrato y no va a Git; Sam lo tiene en su carpeta de descargas.

**Lectura del DPA (2026-10-09, a pedido de Sam; 65 páginas en inglés y alemán, prevalece el alemán, §13.3).** Responde N2 así:

| Punto | Estado | Qué dice (sección del DPA) |
|---|---|---|
| Subencargados | CORRECTO | Anexo 3: uno solo, **Contabo Inc.** (St. Louis, Missouri), opera el centro de datos de Carlstadt. Cambios: aviso por escrito y 4 semanas para objetar; el silencio cuenta como aprobación; sin acuerdo, derecho especial de rescisión (§6.1-6.3). Contabo responde por las faltas del subencargado como propias (§6.4). |
| Brechas | CORRECTO, sin plazo fijo | Aviso «sin demora indebida» con contenido mínimo (naturaleza, categorías y número aproximado de personas y registros, consecuencias, medidas), apoyo, análisis de causa y registro de brechas (§8.1-8.4). No fija horas: pregunta para el abogado. |
| Borrado al terminar | CORRECTO | Al terminar o cuando se pida, borrado completo e irrevocable, **incluidas copias de respaldo** (§10.1); guardan 10 años solo la documentación de cumplimiento (§10.3). Discos defectuosos se destruyen; los de contratos terminados se sobrescriben varias veces (Anexo 2 §1.3.4). Responde en parte N6; los snapshots no se mencionan. |
| EE. UU. | CORRECTO con límites | Elegir una ubicación fuera de la UE vale como consentimiento a la transferencia (§2.4-2.5). Incluye cláusulas tipo de la UE, módulo 3 (Contabo GmbH → Contabo Inc.), ley y tribunales de Alemania y autoridad de control de Baviera. Si una autoridad de fuera de la UE pide datos, Contabo avisa de inmediato salvo prohibición legal (§3.1). |
| Acceso de Contabo | ENCONTRADO (esperado) | El DPA dice que el acceso de Contabo a los datos «no se puede excluir» (§1.2). Para un VPS, la seguridad de los datos guardados y transmitidos, el cifrado en tránsito, la separación y **los respaldos** son responsabilidad exclusiva del cliente (Anexo 2 §1.3.2, §1.4.2, §2.1.2, §3.1.3). Es coherente con el plan: TLS, respaldos cifrados con `age` y la base sin puertos publicados. El disco del VPS no está cifrado (sin LUKS), así que lo que Contabo pueda ver en reposo depende de este contrato. |

**ENCONTRADO en el anexo 1 (lo llenó la cuenta al generar el DPA y se corrige en el portal, §2.2 y §12.4):**

- **Personas afectadas: solo «Users» marcado.** DTD trata además datos de clientes, destinatarios de envíos, empleados y operarios, proveedores (incluidos los chinos), prospectos de Kommo y contactos de terceros. El DPA limita el tratamiento a las categorías del anexo 1 (§2.2), así que hoy **no las cubre**. Arreglo: marcar al menos *Customers*, *Employees*, *Suppliers*, *Business Partners*, *Service Providers*, *Interested Parties* y, en «Other Data Subjects», «destinatarios de envíos».
- **Categorías de datos: las 24 marcadas**, más «Other data» con un texto suelto que no describe nada. Ninguna categoría especial marcada. Arreglo: dejar las que DTD trata de verdad (con el inventario de §1 de esta revisión) y reemplazar el texto de «Other data» por una descripción real (p. ej., fotos de documentos de identidad, comprobantes de pago, audio de reuniones). Si las fotos de documentos de identidad cuentan como dato biométrico lo decide el abogado.
- **Partes:** el DPA está a nombre del titular de la cuenta de Contabo, no de «DTD Cargo». Que el abogado confirme que ese es el responsable correcto de los datos de DTD.

**Corrección del anexo 1 (2026-10-09, Sam lo recreó en el portal; el panel muestra el nuevo como concluido a las 21:45 UTC+1 y reemplaza al anterior, §13.5).** Verificado sobre el PDF nuevo:

- **Personas afectadas: CORRECTO.** Las 23 categorías marcadas, así que el hueco de cobertura queda cerrado. «Other Data Subjects» quedó vacío; los destinatarios de envíos no figuran con su nombre (detalle menor).
- **Categorías de datos:** las 24 marcadas. «Other data» quedó cortado en «Fotos de indent»: el campo admite unos 15 caracteres.
- **Categorías especiales: ENCONTRADO (menor).** Quedaron marcadas *Biometric*, *Religious or Philosophical Beliefs*, *Labor Organization Membership* y *Assessment of Personality, Abilities, Performance or Behavior*. DTD no trata creencias, afiliación sindical ni evaluaciones de personalidad: declararlas es inexacto, aunque no abre ningún acceso. Biométricos: lo decide el abogado (fotos de documentos de identidad).

**Segunda corrección (2026-10-09, versión vigente concluida a las 21:50 UTC+1), verificada sobre el PDF:**

- **Categorías especiales: CORRECTO.** Solo queda *Biometric*, a confirmar por el abogado; creencias, afiliación sindical y evaluación de personalidad, desmarcadas.
- Personas afectadas: las 23 siguen marcadas. Categorías de datos: las 24.
- «Other data» quedó vacío y sin marcar. Las fotos de documentos de identidad entran en *Image Files*, que está marcada.

## 6 · Fuera de alcance (para el abogado)

- La redacción de la política de privacidad y del aviso a los clientes por el cambio de alojamiento (H4).
- El DPA con Contabo y con el proveedor de respaldos, y si hace falta un contrato adicional para transferencias a EE. UU.
- El mecanismo PIPL para los datos tratados en China (H13) y la designación del representante (art. 53).
- Plazos de conservación por obligación legal (tributaria, laboral, aduanera) que limitan la supresión.

---

**Segunda opinión:** conviene que otro modelo audite este mismo alcance sobre el mismo commit; un modelo no encuentra sus propios puntos ciegos.

*Esta revisión no es asesoría legal. Es un inventario técnico y una lista de preguntas para que Sam decida con su abogado.*
