# AUD-02 v0.1 — Consulta, conservación, exportación y acceso a logs

| Control | Valor |
|---|---|
| Código | AUD-02 |
| Versión | 0.1 |
| Dueño | Sam (founder) |
| Estado | redactada — pendiente de aprobación |
| Creado | 2026-07-21 |
| Depende de | [AUD-01](aud-01.md), [MP-01](mp-01.md) y A11Y-01 |
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

## 3. Permisos propuestos

| Permiso | Capacidad |
|---|---|
| `audit:view` | Ver metadatos y payload redacted del propio tenant. |
| `audit:view_sensitive` | Ver campos sensibles permitidos con motivo y trazabilidad de lectura. |
| `audit:export` | Solicitar y descargar exportaciones autorizadas. |
| `audit:legal_hold` | Crear/retirar hold con doble control. |
| `audit:retention_admin` | Configurar política dentro de límites aprobados; nunca borrar manualmente un evento individual. |

Los roles que reciben cada permiso requieren decisión explícita. Mientras no se
apruebe, el default es **admin autorizado, mínimo privilegio y sin exportación**.

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
estado vacío/error accesible. Nunca descarga todo el tenant para filtrar en el
navegador.

Drill-down:

- muestra resumen antes que JSON;
- presenta before/after como diff legible;
- redacted por permiso;
- enlaza la entidad solo si el usuario conserva acceso a ella;
- no convierte actor desconocido en sistema: lo muestra como no resuelto.

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

## 6. Exportación

- Formatos permitidos: CSV para revisión tabular y JSON para evidencia íntegra.
- La solicitud fija tenant, filtros, columnas, redacción, zona horaria y motivo.
- El archivo incluye manifiesto: rango, filtros, filas, versión de schema, fecha,
  solicitante y hash SHA-256.
- Descarga mediante URL firmada, de corta duración y un solo tenant.
- Exportaciones grandes son jobs asíncronos con progreso y expiración.
- Generar, descargar, fallar y expirar una exportación produce eventos AUD-01.
- Nunca se exportan secretos ni payloads no autorizados por el rol.

## 7. Integridad y privacidad

- Revocar UPDATE/DELETE ordinario incluso a procesos que no sean el job formal
  de retención.
- Separar escritor de eventos, lector y administrador de retención.
- Evaluar hash encadenado o sellado periódico para lotes de alto valor; no se
  exige criptografía decorativa sin un modelo de amenaza.
- Aplicar límites y alertas a consultas/exportaciones masivas.
- Registrar lecturas sensibles y evitar que ese registro contenga de nuevo la PII leída.
- El borrado de una persona no borra evidencia fiscal obligatoria; anonimiza lo
  permitido según MP-01 y la decisión legal correspondiente.

## 8. Estado actual y brechas

| Capacidad | Estado actual |
|---|---|
| Consulta | Últimos 100; filtros client-side solo por entidad y actor. |
| Paginación/rango | No implementados. |
| Actor legible | UUID corto; sin resolución fiable a nombre/email. |
| Correlación | No consultable como campo de primer nivel. |
| RBAC fino | RLS por tenant; no se comprobó permiso por rol/payload sensible. |
| Inmutabilidad | Authenticated solo lee, pero `service_role all` puede modificar/borrar. |
| Retención/hold | Sin política implementada. |
| Exportación | Sin contrato ni implementación. |
| Redacción | Payload JSON sin esquema transversal de minimización. |

## 9. Decisiones reservadas

Requieren aprobación del founder y, cuando aplique, asesoría legal:

1. roles asignados a los cinco permisos;
2. plazos por clases A/B/C y jurisdicción;
3. qué campos son sensibles y quién puede desredactarlos;
4. necesidad de doble aprobación para exportaciones/hold;
5. expiración y ubicación de archivos exportados;
6. modelo de integridad: append-only reforzado, sellado o hash encadenado.

## 10. Criterios para aprobar AUD-02

- resolver las seis decisiones reservadas;
- demostrar que RLS/backend bloquea un usuario sin permiso;
- definir retención y hold sin borrar evidencia obligatoria;
- validar exportación redacted y auditar su descarga;
- probar paginación, zona horaria, correlación y aislamiento por tenant;
- crear un SDD de implementación separado antes de tocar schema o producción.
