# AUD-02 v1.0 — Consulta, conservación, exportación y acceso a logs

| Control | Valor |
|---|---|
| Código | AUD-02 |
| Versión | 1.0 |
| Dueño | Sam (founder) |
| Estado | aprobada — adoptada en Producción |
| Aprobación | 2026-07-21 · Sam (founder) · defaults de REV-AUD-001 |
| Creado | 2026-07-21 |
| Depende de | [SGE-00](sge-00.md), [AUD-01](aud-01.md), [MP-01](mp-01.md) y [A11Y-01](a11y-01.md) |
| Base existente | [SDD-0123](../../specs/0123-audit-log/spec.md) |

## 1. Propósito

AUD-02 gobierna el uso posterior del evento: quién puede verlo, cómo se busca,
cuánto se conserva, qué puede exportarse y cómo se demuestra que el historial
no fue alterado.

## 2. Principios

1. Ver el módulo Administración no concede automáticamente acceso a payloads sensibles.
2. RLS/backend aplica el permiso; ocultar la sección no es control de acceso.
3. El log es append-only. Rectificar crea un evento nuevo.
4. La retención se decide por clase de evento y obligación, no por comodidad de almacenamiento.
5. Toda exportación es un evento auditable y minimiza datos.
6. Una búsqueda por `correlation_id` debe poder conectar feedback, mutación y jobs sin revelar otro tenant.
7. Un hold legal suspende cualquier purga programada del alcance afectado.
8. El payload es sensible por defecto: solo un schema allowlist puede exponer
   campos; una clave desconocida se oculta.
9. Un hash sin ancla confiable detecta cambios accidentales, pero no demuestra
   por sí solo que un administrador privilegiado no alteró el historial.

## 3. Permisos propuestos

| Permiso | Capacidad |
|---|---|
| `audit:view` | Ver metadatos y payload redacted del propio tenant. |
| `audit:view_sensitive` | Revelar campos sensibles permitidos con motivo, reautenticación y evento de acceso. |
| `audit:export` | Solicitar y descargar exportaciones autorizadas. |
| `audit:legal_hold_create` | Crear un hold; conservar es la operación segura. |
| `audit:legal_hold_release` | Retirar un hold con segundo aprobador y motivo. |
| `audit:retention_admin` | Configurar política dentro de límites aprobados; nunca borrar manualmente un evento individual. |

Default v1: solo `admin` puede recibir estas capacidades y ninguna se deriva
únicamente de poder abrir el módulo Administración. Los demás roles no reciben
acceso. Una ampliación exige cambio de RBAC revisado y prueba negativa.

Crear un hold requiere un admin. Liberarlo y exportar datos sensibles o un
alcance masivo requieren dos decisiones humanas distintas; si solo existe un
admin, la segunda decisión corresponde al founder y se registra como excepción
R3. Hasta implementar la capability específica, el default técnico es
**fail-closed y sin exportación/revelado sensible**.

## 4. Consulta

El viewer gobernado debe ofrecer filtros server-side por:

- rango de fecha/hora y zona horaria visible;
- entidad e ID/código visible;
- evento y resultado;
- actor y tipo de actor;
- módulo/superficie/source;
- `correlation_id`;
- existencia de motivo, archivo u override.

Usa paginación por cursor estable `(occurred_at, id)`, límites server-side y
estado vacío/error accesible. El cursor es opaco y validado por servidor; no
acepta tenant, rol ni payload confiados desde el cliente. Nunca descarga todo el
tenant para filtrar en el navegador.

Los filtros y el orden se aplican después de autorizar tenant/capability y antes
de serializar el payload. IDs/correlaciones sensibles usan coincidencia exacta,
límites y rate limit para evitar enumeración. La hora se almacena en UTC y se
muestra con la zona IANA visible del usuario.

Drill-down:

- muestra resumen antes que JSON;
- presenta before/after como diff legible;
- redacted por permiso;
- revela campos solo mediante allowlist versionada por `entity_type/event_type`;
- enlaza la entidad solo si el usuario conserva acceso a ella;
- no convierte actor desconocido en sistema: lo muestra como no resuelto.

La lista rutinaria no crea un evento por cada fila consultada. Sí se registran
la revelación sensible, exportación, cambio de retención y hold. Ese evento solo
contiene actor, alcance, motivo y resultado, nunca una copia de la PII leída; su
consulta ordinaria no dispara recursivamente otro evento de acceso.

## 5. Conservación

Cada clase declara:

| Clase | Ejemplos | Regla provisional |
|---|---|---|
| A · legal/financiera/seguridad | emisión, anulación, pago, permisos, exportaciones | Conservar sin purga hasta definir plazo legal verificable. |
| B · operativa sensible | cambios de estado, overrides, archivos, IA con efecto | Conservar según ciclo operativo + ventana de reclamo, todavía por definir. |
| C · diagnóstica | eventos técnicos sin PII ni efecto de negocio | Puede agregarse o purgarse con plazo aprobado y métricas conservadas. |

AUD-02 no inventa años de retención. El plazo debe registrar jurisdicción,
fundamento, fecha de aprobación, responsable y tratamiento al vencer.

Al vencer: anonimizar cuando cumpla el objetivo; purgar solo por job controlado,
con conteo, hash del lote, autorización y evento de purga separado. Un hold
legal gana sobre el calendario.

Default aprobable sin inventar plazos: **ninguna clase se purga automáticamente
hasta que exista un calendario de retención con fundamento legal/contractual**.
Los eventos de hold, liberación, exportación y purga son clase A/P4.

## 6. Exportación

- Formatos permitidos: CSV como copia de revisión y JSON/NDJSON como evidencia
  estructurada. CSV neutraliza fórmulas (`=`, `+`, `-`, `@`) y declara esa
  transformación en el manifiesto.
- La solicitud fija tenant, filtros, columnas, redacción, zona horaria y motivo.
- El archivo incluye manifiesto: rango, filtros, filas, versión de schema,
  redacciones, zona horaria, fecha, solicitante y hash SHA-256.
- El manifiesto se firma/sella desde servidor o se ancla fuera del mismo
  artefacto; hash y archivo juntos no prueban integridad frente al mismo actor.
- El artefacto vive en Storage privado bajo tenant, nunca como adjunto de email.
  La URL firmada dura máximo 15 minutos y el archivo temporal expira en máximo
  24 horas, salvo expediente/hold autorizado.
- Exportaciones grandes son jobs asíncronos con progreso y expiración.
- Generar, descargar, fallar y expirar una exportación produce eventos AUD-01.
- Nunca se exportan secretos ni payloads no autorizados por el rol.
- La descarga valida nuevamente tenant, permiso, aprobación y vigencia; conocer
  la URL no sustituye autorización.

## 7. Integridad y privacidad

- Revocar SELECT/UPDATE/DELETE directos sobre la tabla base a clientes. La
  consulta se expone mediante vista/RPC segura con redacción.
- Revocar UPDATE/DELETE y, cuando la arquitectura lo permita, INSERT directo a
  `service_role`; este rol omite RLS. La escritura normal usa una función
  append-only estrecha y la retención otra función separada y auditable.
- Separar escritor de eventos, lector y administrador de retención; revisar
  cada función `SECURITY DEFINER`, fijar `search_path` y limitar `EXECUTE`.
- Evaluar hash encadenado o sellado periódico para lotes de alto valor; no se
  exige criptografía decorativa sin un modelo de amenaza.
- Aplicar límites y alertas a consultas/exportaciones masivas.
- Registrar lecturas sensibles y evitar que ese registro contenga de nuevo la PII leída.
- El borrado de una persona no borra evidencia fiscal obligatoria; anonimiza lo
  permitido según MP-01 y la decisión legal correspondiente.

## 8. Estado productivo

| Capacidad | Estado actual |
|---|---|
| Consulta | RPC server-side con filtros, cursor estable, zona IANA y correlación. |
| RBAC fino | Admin-only dentro de funciones; tenant derivado de sesión. |
| Inmutabilidad | Writer append-only y función de retención separada; sin CRUD crudo de aplicación. |
| Retención/hold | Calendario v1.0, holds append-only y liberación con segundo actor. |
| Exportación | Solicitud y doble aprobación, salida redacted, bucket privado y TTL. |
| Expiración | Claim → borrado Storage → recibo; hold prevalece. |
| Purga | Solo lote sellado por dry-run/hash, segundo actor y revalidación; fiscal/legacy bloqueados. |
| Redacción | Allowlist cerrada; claves desconocidas y payload sensible no salen en exportación. |

La aplicación productiva de `0301`–`0304` verificó RLS en las ocho tablas,
cero CRUD crudo para `anon`/`authenticated`, funciones estrechas y revokes
explícitos. No se creó ni ejecutó ningún lote durante el cierre.

## 9. Decisiones normativas aprobadas para v1.0

| Decisión | Default aprobado |
|---|---|
| Acceso | Admin-only y capability explícita; fail-closed. |
| Payload | Sensible/redacted por defecto; allowlist versionada para revelar. |
| Exportación | Redacted por defecto; sensible/masiva con motivo y doble control. |
| Hold | Un admin crea; dos decisiones humanas liberan. |
| Retención | Sin purga automática hasta calendario legal aprobado. |
| Archivos exportados | Storage privado; URL ≤15 min; artefacto ≤24 h salvo hold/expediente. |
| Integridad | Append-only/grants estrechos obligatorios; sellado periódico después de modelo de amenaza. |

Quedan deliberadamente fuera de la aprobación y requieren asesoría/fuente
verificable: plazos legales por jurisdicción, campos sujetos a obligación de
anonimización y conservación de backups/copias. El default conservador anterior
permite aprobar la política sin inventar esos valores.

## 10. Criterios de aprobación aplicados

- aceptar o corregir los siete defaults de §9;
- confirmar que los plazos legales se delegan a un calendario controlado;
- aceptar que toda clave de payload desconocida queda redacted;
- aceptar la separación entre política aprobada e implementación no conforme;
- registrar decisión del founder y versión.

Los criterios fueron cerrados mediante REV-AUD-001 y la aprobación explícita
del founder el 2026-07-21. Los defaults de §9 son obligatorios hasta que una
versión posterior documente y apruebe un cambio. La aprobación no declara
conforme el visor, la tabla ni sus grants actuales.

## 11. Gate posterior de implementación

Un SDD separado debe:

- demostrar que RLS/grants/backend bloquean rol y tenant no autorizados;
- retirar acceso directo al payload y restringir `service_role`;
- implementar allowlists, paginación, zona horaria, correlación y rate limit;
- validar exportación redacted, CSV injection, manifiesto/sello y expiración;
- probar hold, purga, backup y fallo seguro sin borrar evidencia obligatoria;
- probar teclado, foco, tabla responsive, estados y descarga accesible;
- corregir primero la whitelist regresiva de `rendition` y escritores
  best-effort identificados por AUD-01.

Revisión aprobada: [REV-AUD-001](../reviews/aud-02.md).
