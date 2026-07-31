---
title: "Calendario de retención de auditoría"
version: "1.0"
status: approved
owner: "Sam (founder)"
approved: 2026-07-31
effective: 2026-07-31
review_due: 2027-07-31
scope: "entity_audit_log y artefactos temporales de auditoría"
confidencialidad: interno
---

# Calendario de retención de auditoría v1.0

## 1. Aprobación y naturaleza

Sam, founder de DTD Cargo, autorizó expresamente el 2026-07-31 identificar,
aprobar e implementar la fuente de retención necesaria para el Corte E de
AUD-02. Esta directiva registra esa decisión humana y entra en vigor en la misma
fecha.

Es una directiva organizacional de conservación y minimización. No se presenta
como dictamen jurídico, no publica una versión nueva del Acuerdo de Servicios y
no sustituye la validación profesional de los documentos legales dirigidos a
clientes. Si una obligación legal, una orden de autoridad o un contrato vigente
exige conservar por más tiempo, prevalece la obligación más larga. Un legal hold
activo siempre prevalece.

## 2. Fuentes verificables

| Fuente | Jurisdicción y alcance | Regla incorporada |
|---|---|---|
| Código Orgánico Tributario, Gaceta Oficial Extraordinaria N.º 6.507, arts. 55, 56, 59, 60–62 y 155.3 | Venezuela · soportes de hechos imponibles y obligaciones tributarias | Conservar mientras el tributo no esté prescrito. El término ordinario es 6 años, puede ser 10 años y puede interrumpirse o suspenderse. |
| Personal Information Protection Law, arts. 17 y 19 | China · información personal tratada en China | Informar categorías y períodos; conservar por el tiempo mínimo necesario para la finalidad, salvo regla legal distinta. |
| AUD-02 v1.0 | Técnica · artefactos de exportación y acceso | URL firmada máximo 15 minutos; artefacto temporal máximo 24 horas; el vencimiento del artefacto nunca elimina el evento fuente. |
| Aprobación del founder registrada en esta directiva | Organizacional · eventos no fiscales del ERP | Minimización escalonada y plazos internos definidos en §3. |

Fuentes primarias consultadas:

- Código Orgánico Tributario:
  https://www.cebm.gob.ve/wp-content/uploads/2025/07/LEY-DEL-CODIGO-ORGANICO-TRIBUTARIO.pdf
- PIPL, traducción institucional publicada por la Fiscalía Popular Suprema de
  China:
  https://en.spp.gov.cn/2021-12/29/c_948419.htm
- Política técnica aprobada:
  [`AUD-02`](../governance/policies/aud-02.md)

## 3. Calendario aprobado

| Clase | Alcance | Plazo y comienzo | Tratamiento al vencer | Excepciones | Responsable |
|---|---|---|---|---|---|
| `fiscal` | Eventos del dominio `finance` y cualquier evento expresamente vinculado a factura, pago, asiento, retención o hecho imponible | Mínimo 10 años desde el 1 de enero siguiente al hecho imponible o firmeza aplicable. Después exige confirmación humana documentada de que no existe interrupción, suspensión, actuación abierta ni obligación especial. | Elegible para lote controlado; nunca purga automática por mero paso del tiempo. | Hold, fiscalización, litigio, investigación, contrato u orden de autoridad. | Finanzas + asesoría fiscal |
| `operational` | Dominios `operations`, `commercial` y `procurement` sin vínculo fiscal | 5 años desde `occurred_at`. La finalidad es defensa de la operación, investigación de incidentes y trazabilidad de decisiones. | Purga controlada del evento y sus payloads, con manifiesto de lote sin datos personales. | Hold, reclamo, litigio, investigación, vínculo fiscal o clasificación dudosa. | Operaciones + founder |
| `security` | Acceso, cuenta, configuración, roles, integraciones, IA y eventos de seguridad | 2 años desde `occurred_at`, por investigación de incidentes y control de acceso. | Purga controlada del evento y sus payloads, con manifiesto de lote sin datos personales. | Hold, incidente abierto, investigación o vínculo fiscal. | Seguridad + founder |
| `legacy_unknown` | Dominio, finalidad o jurisdicción no clasificados | Sin vencimiento ejecutable. | Clasificar antes de calcular; no purgar. | Siempre fail-closed. | Owner del dominio |
| `audit_export` | Archivo temporal CSV/JSON/NDJSON y manifiesto de una exportación | Máximo 24 horas desde su generación. | Borrar el objeto; conservar recibo técnico de expiración. | Expediente o hold que identifique expresamente el artefacto. | Ingeniería |
| `signed_url` | URL de descarga de exportación | Máximo 15 minutos desde emisión. | Dejar vencer; no persistir URL ni token. | Ninguna ampliación silenciosa. | Ingeniería |
| `backup_replica` | Copias administradas por proveedor | Según ciclo contratado del proveedor, sin restaurar datos ya vencidos al plano activo. | Envejecimiento del backup; documentar restauraciones excepcionales. | Hold u orden de autoridad aplicable. | Infraestructura |

Los plazos organizacionales son máximos ordinarios. Cuando el evento contiene
información personal de una persona en China, el owner debe poder demostrar que
la finalidad continúa durante ese plazo; si termina antes y no existe excepción,
se aplica el vencimiento más corto.

## 4. Reglas de ejecución

1. E2 crea y libera holds de forma append-only; liberar exige dos decisiones
   humanas distintas.
2. E3 exporta solo campos allowlisted, neutraliza fórmulas CSV y sella conteo y
   hash en un manifiesto separado.
3. E4 elimina únicamente objetos temporales vencidos. Nunca elimina eventos.
4. E5 empieza siempre en `dry-run`, revalida clase y hold por evento y requiere
   aprobación nominal del lote antes de borrar.
5. `fiscal` y `legacy_unknown` no pueden recibir aprobación automática.
6. La ruta de Storage es `tenant_id/request_id/archivo`; el bucket es privado.
7. Los recibos de lote no contienen payload, nombre, correo, documento, IP ni
   otro identificador personal.

## 5. Revisión y cambio

Revisión ordinaria: 2027-07-31. También se revisa cuando cambie una fuente,
jurisdicción, contrato, proveedor de backups o categoría de evento. Todo cambio
crea una versión nueva; no se reescribe retroactivamente la regla que justificó
un lote ya ejecutado.

