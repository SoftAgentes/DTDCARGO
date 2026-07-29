---
sdd: "0166"
title: "Auditoría gobernada — corrección conjunta AUD-01 y AUD-02"
status: in-progress
author: "Sam (founder) + Codex"
created: 2026-07-21
updated: 2026-07-28
supersedes: null
superseded_by: null
related: ["0085", "0123", "0139", "0165"]
confidencialidad: interno
---

# DTD-0166 — Auditoría gobernada · AUD-01 + AUD-02

> **Spec correctiva en progreso.** Define cómo llevar
> `entity_audit_log` desde su viewer básico actual hasta los contratos
> aprobados [AUD-01](../../governance/policies/aud-01.md) y
> [AUD-02](../../governance/policies/aud-02.md). A1 y A2 fueron aplicados y
> verificados individualmente; con ellos queda completo el Corte A de catálogo.
> El diseño B0 fue aprobado por
> [REV-AUD-007](../../governance/reviews/aud-corte-b.md). B1 fue implementado y
> verificado localmente mediante `0267`; [REV-AUD-008](../../governance/reviews/aud-corte-b1.md)
> lo aprobó técnicamente y
> [REV-AUD-009](../../governance/reviews/aud-corte-b1-aplicacion.md) registra su
> aplicación y verificación en Cloud. Los Cortes C–E siguen sin implementar y
> [REV-AUD-010](../../governance/reviews/aud-tenant-fixtures.md) aprueba el
> diseño obligatorio del ciclo de vida tenant/fixtures. Su implementación
> local vive en [SDD-0172](../0172-tenant-fixtures-lifecycle/spec.md), todavía
> pendiente de Cloud y recorrido efímero antes del cierre global.

## 1. Propósito

El ERP ya registra eventos de múltiples dominios, pero el sistema actual no
garantiza conjuntamente:

- atomicidad entre una mutación sensible y su evento obligatorio;
- vocabulario extensible sin regresiones al ampliar `entity_type`;
- inmutabilidad frente a grants privilegiados;
- acceso por capability y redacción de payload;
- consulta server-side, correlación y actor veraz;
- exportación, hold y conservación gobernados.

SDD-0166 convierte las dos políticas aprobadas en un programa implementable por
cortes pequeños, verificables y reversibles. La implementación no puede
presentarse como un solo cambio de UI ni como una migración monolítica.

## 2. Estado actual comprobado

| Área | Evidencia actual | Riesgo |
|---|---|---|
| Lectura | `authenticated` tiene SELECT y RLS solo por tenant | Un rol no-admin puede intentar leer la tabla directamente aunque Administración sea admin-only. |
| Escritura | `service_role` tiene `all` y omite RLS | Un cliente privilegiado puede actualizar o borrar eventos si conserva grants. |
| Viewer | Últimos 100 eventos; filtros client-side por entidad/actor | No escala, no pagina y no permite buscar correlación/fecha de forma confiable. |
| Payload | JSON crudo expandible | No existe allowlist/redacción por evento; puede exponer datos innecesarios. |
| Actor | Tipo desconocido se convierte en `system` | Falsifica autoría y dificulta investigación. |
| Writers TS | Existen helpers directos y varios son best-effort | Una mutación crítica puede sobrevivir al fallo del log. |
| Writers SQL | RPCs operativas insertan dentro de su transacción | Son la base preferida, pero usan contratos heterogéneos. |
| Catálogo | Migraciones reemplazan un CHECK completo | `0241_estiba_por_zonas.sql` omitió `rendition`, agregado por `0123_rendiciones.sql`. |
| Contrato | `payload` transporta shapes por módulo | Faltan `before/after`, motivo, source, result, schema y correlación uniformes. |
| Ciclo posterior | No hay export, hold ni retención | AUD-02 está aprobada pero no implementada. |

El inventario estático es evidencia de alcance, no prueba de estado en Cloud. El
preflight de implementación debe comprobar objetos y grants reales mediante
acceso read-only antes de escribir cualquier migración.

## 3. Principios de arquitectura

1. **Deny by default:** tenant, rol y payload no se aceptan desde el cliente.
2. **Append-only real:** la aplicación normal inserta; no actualiza ni elimina.
3. **Atomicidad por dominio:** una función genérica de append no vuelve atómica
   una mutación realizada en otra petición.
4. **Historia veraz:** los eventos legacy no se backfillean con valores
   inventados; usan `legacy_unknown` o `null` cuando no existe evidencia.
5. **Redacción antes de serializar:** el frontend nunca recibe un campo que no
   está autorizado a mostrar.
6. **Catálogo aditivo:** agregar una entidad no reescribe una lista completa ni
   puede retirar tipos históricos.
7. **Sin big bang:** cada dominio crítico migra con pruebas propias.
8. **Política antes que purga:** no se destruye ningún evento hasta aprobar el
   calendario legal correspondiente.

## 4. Alcance

### Incluye

- contrato evolutivo de `entity_audit_log`;
- catálogo extensible de entidades auditables;
- append-only, grants mínimos y funciones estrechas;
- capabilities admin-only de AUD-02;
- consulta redacted, server-side y paginada;
- normalización gradual de writers;
- atomicidad de mutaciones críticas por dominio;
- registro de acceso sensible;
- diseño de exportación, hold y retención;
- pruebas de tenant, roles, datos sensibles e integridad;
- plan de migraciones independientes y autorización de una en una.

### No incluye

- aplicar migraciones o cambiar la base real;
- leer filas de clientes o payloads de producción;
- asignar acceso a roles no-admin;
- definir plazos fiscales/legales sin fuente verificable;
- migrar todas las mutaciones del ERP en una sola entrega;
- almacenar secretos, archivos o blobs dentro del log;
- reemplazar observabilidad técnica/Sentry con auditoría de negocio;
- implementar el plugin PLG-01.

## 5. Modelo objetivo

### 5.1 Evento

`entity_audit_log` conserva las columnas existentes y añade de forma aditiva:

| Campo | Tipo conceptual | Regla |
|---|---|---|
| `correlation_id` | text nullable | Une UI, RPC, jobs, notificaciones y eventos relacionados. |
| `source` | text | Studio, móvil, RPC, job, webhook, integración o IA; legacy = `legacy_unknown`. |
| `result` | text | `succeeded`, `rejected`, `failed` o `legacy_unknown`. |
| `reason` | text nullable | Obligatorio para R3, rechazo, anulación, override y acceso sensible. |
| `before_data` | jsonb nullable | Snapshot/diff mínimo anterior, ya sanitizado. |
| `after_data` | jsonb nullable | Snapshot/diff mínimo posterior, ya sanitizado. |
| `schema_version` | integer | Versión del contrato de payload/evento. |
| `sensitivity` | text | `metadata`, `internal`, `sensitive`, `restricted` o `legacy_unknown`. |

`payload` permanece durante la transición. No se reescribe historia para
separar `before/after` cuando el significado original no puede demostrarse.

### 5.2 Catálogos

Una tabla de catálogo sustituye el CHECK reemplazable de `entity_type`:

- clave estable y única;
- estado activo/deprecado, nunca borrado si existe historia;
- clasificación y versión;
- inserciones aditivas mediante migración revisada;
- FK validada después de poblar automáticamente todos los tipos históricos
  presentes y la unión conocida del repositorio.

`event_type` adopta un registro machine-readable por dominio. La primera fase
puede mantener texto con validación del writer, pero no acepta etiquetas de UI
como vocabulario de evento.

### 5.3 Actor

El actor conserva `actor_type`/`actor_id`. Tipos permitidos incluyen usuario,
operario, sistema, agente e integración. La consulta resuelve un nombre solo si
el solicitante puede verlo. Un actor ausente se muestra **No resuelto**; nunca se
convierte silenciosamente en Sistema. No se modifica un evento histórico para
actualizar el nombre de una persona.

## 6. Fronteras de acceso

### 6.1 Tabla base

- retirar SELECT directo a `authenticated`;
- retirar UPDATE/DELETE directos a roles de aplicación, incluido
  `service_role` cuando la verificación local confirme el camino alternativo;
- retirar INSERT directo a clientes privilegiados después de migrar sus
  callers a una función append estrecha;
- conservar RLS como defensa adicional, no como único control;
- inventariar suscriptores Realtime; si no existen, retirar la tabla base de la
  publicación. Si existe una necesidad aprobada, sustituirla por un canal
  redacted que no emita payload sensible.

### 6.2 Consulta

Una vista/RPC segura:

- deriva tenant y rol desde la sesión;
- exige `audit:view` admin-only;
- recibe filtros permitidos, nunca tenant arbitrario;
- pagina con cursor opaco sobre `(occurred_at, id)`;
- aplica allowlist/redacción antes de devolver JSON;
- limita volumen/rate y usa coincidencia exacta para IDs/correlaciones;
- almacena UTC y devuelve zona IANA explícita para presentación.

Revelar un campo sensible usa otra operación con `audit:view_sensitive`, motivo
y reautenticación. En la misma transacción genera un evento de acceso sin copiar
la PII revelada. Consultar ese evento no produce recursión infinita.

### 6.3 Funciones privilegiadas

Toda función `SECURITY DEFINER`:

- tiene `search_path` fijo y mínimo;
- no usa SQL dinámico con input sin validar;
- revoca EXECUTE a `public`, `anon` y `authenticated` salvo el contrato exacto;
- deriva identidad confiable o está limitada a un caller server-side;
- tiene pruebas de grant, tenant y abuso de argumentos.

## 7. Escritura y atomicidad

### 7.1 Writer común

`append_audit_event` normaliza y valida eventos de bajo riesgo o provenientes de
una transacción que ya contiene la mutación. Valida catálogo, actor, schema,
sensibilidad y campos prohibidos. No acepta `tenant_id` del formulario.

Usarlo después de otra petición **no cumple** atomicidad para una mutación
crítica.

### 7.2 Mutaciones críticas

Facturación, contabilidad, cobranzas, tesorería, permisos, anulación, reversión
y eliminación R3 migran a RPCs de dominio donde:

```text
validar tenant/rol/estado
          ↓
mutar negocio + insertar evento AUD-01
          ↓
commit único o rollback completo
```

Cada dominio se migra por separado. Una prueba fuerza el fallo del evento y
demuestra que la mutación no persiste.

### 7.3 Resultados fallidos

- un rechazo de negocio puede persistir `result=rejected` cuando la RPC devuelve
  un resultado estructurado y no ejecuta la mutación;
- una falla de infraestructura pertenece también a observabilidad y no debe
  falsificarse como evento durable si la transacción completa fue revertida;
- un evento `succeeded` solo existe después de satisfacer el contrato atómico.

## 8. Fases y cortes autorizables

### Corte A — Inventario y reparación de catálogo

- snapshot read-only de columnas, CHECK, policies, grants, funciones, índices y
  tipos distintos existentes;
- crear catálogo aditivo y poblarlo sin perder tipos históricos;
- retirar el CHECK reemplazable y validar la FK;
- incluir/regresar `rendition` mediante prueba;
- cero cambios en viewer o permisos en este corte.

### Corte B — Contrato aditivo y append-only

- añadir columnas de §5.1 con defaults honestos para legacy;
- añadir índices por correlación y filtros medidos;
- crear writer estrecho;
- revocar UPDATE/DELETE y probar que no se puede alterar historia;
- no retirar INSERT de `service_role` hasta migrar callers necesarios.

### Corte C — Consulta gobernada y RBAC

- añadir capabilities admin-only al código y frontera DB;
- crear RPC redacted/paginada y detalle sensible separado;
- crear primero un adaptador compatible que alimente la presentación vigente
  desde la RPC gobernada;
- retirar SELECT directo a `authenticated`;
- migrar el viewer a server-side sin JSON crudo;
- resolver actor sin falsificar `system`.

### Corte D — Atomicidad por dominio

Orden de riesgo recomendado:

1. permisos/usuarios y configuración sensible;
2. facturación y contabilidad;
3. cobranzas y tesorería;
4. rendiciones, compras y ventas;
5. logística R3 y archivos de evidencia;
6. resto de mutaciones obligatorias.

Cada dominio tiene SDD hijo o sección de ejecución, migración/pruebas propias y
rollback. No se cierra el corte por conteo de archivos migrados, sino por
cobertura de eventos obligatorios y prueba de fallo.

### Corte E — Exportación, hold y retención

- tablas/contratos de solicitudes de exportación, holds y calendario;
- bucket privado `audit-exports` solo cuando exista SDD de Storage;
- CSV neutralizado y JSON/NDJSON, manifiesto firmado/sellado y hash;
- URL ≤15 minutos y artefacto ≤24 horas salvo hold/expediente;
- hold impide purga por alcance;
- cero job de purga hasta aprobar plazo legal/jurisdicción.

Los cortes se autorizan y aplican individualmente. Crear este SDD no autoriza
ninguno.

## 9. Archivos previstos

| Superficie | Archivos o familias previstos |
|---|---|
| DB | nuevas migraciones numeradas al implementar; una por corte, nunca bundle |
| Query/types | `lib/studio/audit/` o evolución compatible de `audit-{types,queries}.ts` |
| RBAC | `lib/studio/rbac.ts`, guards y pruebas |
| UI | `app/studio/(app)/admin/_components/AuditLogSection.tsx` y componentes dedicados |
| Writers | helpers y acciones de cada dominio; RPCs SQL existentes |
| Tests DB | pgTAP/SQL para grants, tenant, append-only, catálogo y atomicidad |
| Tests app | Vitest + Playwright del viewer, filtros, detalle y exportación |
| Docs | SDD-0166, mapa módulo↔SDD, AUD-01/AUD-02 e índice de gobernanza |

Los basenames de migración se asignan al iniciar cada corte para evitar colisión
con otras ventanas. El archivo debe quedar en el ledger de pendientes hasta su
autorización y aplicación individual.

## 10. Migración de datos

- no modificar `occurred_at`, actor, payload ni resultado histórico inferido;
- poblar catálogos desde la unión de valores del código y tipos distintos de la
  tabla antes de validar FK;
- usar `legacy_unknown` para source/result cuando no exista evidencia;
- dejar `before_data`, `after_data`, `reason` y `correlation_id` en null para
  historia que no los contenía;
- medir filas, tipos y nulls antes/después sin imprimir payloads;
- no mover blobs ni copiar eventos a archivos locales.

## 11. Seguridad y privacidad

- deny-by-default para payload desconocido;
- secretos, tokens, credenciales, cuentas completas y blobs nunca entran al log;
- PII se minimiza, referencia o pseudonimiza;
- consultas/exportaciones sensibles se auditan y rate-limit;
- alertar por exportaciones masivas, fallos repetidos y ausencia súbita de
  eventos esperados;
- ninguna URL firmada se trata como autorización;
- el manifiesto y el archivo no se almacenan juntos como única prueba de
  integridad;
- backups y réplicas entran al calendario de retención antes de habilitar purga.

## 12. Accesibilidad y experiencia

El viewer implementado debe cumplir SGE-00, A11Y-01, TBL-01, BUS-01, LOD-01 y
ERR-01:

- filtros con nombre, teclado y estado persistente en URL cuando sea seguro;
- tabla legible y alternativa móvil sin ocultar campos críticos;
- foco restaurado al cerrar detalle;
- carga, vacío, error, sin resultados y fin de paginación explícitos;
- before/after como diff semántico, no solo color;
- zona horaria visible;
- exportación muestra alcance, redacción, aprobación y expiración antes de
  confirmar.

## 13. Pruebas de aceptación

### Base de datos

- usuario no-admin del tenant no puede consultar tabla/RPC;
- admin consulta solo su tenant con payload redacted;
- tenant ajeno falla aunque se manipulen filtros/cursor;
- campo no registrado en allowlist no sale por red ni export;
- `service_role` no puede UPDATE/DELETE después del corte correspondiente;
- tipo histórico `rendition` y todos los valores existentes validan catálogo;
- un tipo nuevo se añade sin reemplazar los anteriores;
- el writer rechaza entidad, actor, schema o dato prohibido inválidos;
- forzar fallo de log en RPC crítica revierte la mutación;
- revelar sensible produce exactamente un evento sin duplicar PII;
- hold bloquea purga y liberar hold exige dos decisiones.

### Aplicación

- filtros server-side, cursor estable y deep link autorizado;
- actor desconocido aparece como No resuelto;
- payload redacted no existe en props/HTML/response;
- UTC/zona IANA producen fecha inequívoca;
- CSV neutraliza fórmulas y manifiesta la transformación;
- expiración y revocación impiden descargar;
- teclado, foco, zoom 200 %, móvil y lector de pantalla pasan el flujo crítico.

### Regresión

- dominios todavía no migrados siguen insertando sin perder eventos;
- Realtime/consumidores existentes no se rompen silenciosamente;
- búsquedas de inserts directos disminuyen según el ledger por dominio;
- typecheck, lint, unit, pgTAP/SQL, build y pruebas e2e puntuales en verde;
- `pnpm docs:check` y mapa módulo↔SDD actualizados.

## 14. Gates antes de implementar

1. SDD-0166 aprobado explícitamente.
2. Inventario read-only actual de local y Cloud, sin leer payload/PII.
3. Diseño de migración revisado por DB/seguridad.
4. Backup verificable y dry-run local para cada migración.
5. Nombre exacto de una migración autorizado por el founder antes de aplicar.
6. Advisor de seguridad y performance después de cada cambio DB.
7. Evidencia de rollback/forward-fix y sondeo del objeto, no solo ledger.

Se sigue [`docs/runbooks/aplicar-migraciones-prod.md`](../../runbooks/aplicar-migraciones-prod.md).
Un “avanza” general nunca autoriza aplicar migraciones de este SDD.

## 15. Rollback y forward-fix

- Corte A: conservar catálogo y reintroducir temporalmente el CHECK solo si su
  unión contiene todos los tipos existentes; nunca retirar valores históricos.
- Corte B: columnas aditivas permanecen; un fallo se corrige hacia adelante. No
  se reabre UPDATE/DELETE como rollback ordinario.
- Corte C: feature flag permite volver a la presentación anterior únicamente
  sobre el adaptador de la RPC gobernada; nunca reotorga SELECT crudo.
- Corte D: cada dominio mantiene camino anterior solo hasta verificar atomicidad;
  no se mezclan ambos writers para el mismo evento.
- Corte E: deshabilitar jobs/exportación es preferible a purgar artefactos sin
  comprobar hold y retención.

Todo rollback que reduzca seguridad requiere excepción SGE con responsable,
mitigación y vencimiento.

## 16. Observabilidad y evidencia de cierre

- métricas de eventos por dominio/result/source, sin payload;
- alerta si un dominio crítico deja de producir eventos;
- alerta por acceso sensible/exportación/hold anómalos;
- correlation id desde UI hasta mutación/job cuando aplique;
- inventario antes/después de grants, policies, funciones y writers;
- receipts de tests, migración, advisor y revisión visual;
- matriz AUD-01/AUD-02 con `cumple/no aplica/excepción/no cumple`.

## 17. Criterio de cierre del SDD

SDD-0166 solo pasa a `done` cuando:

- los cortes A–E están implementados o un alcance posterior aprobado los separa
  en SDD hijos con trazabilidad;
- cero mutaciones críticas conocidas usan best-effort;
- la tabla base no expone payload ni mutación directa a roles de aplicación;
- consulta, exportación, hold y retención cumplen los defaults AUD-02;
- la cobertura obligatoria AUD-01 está inventariada por dominio;
- producción fue verificada sin leer ni publicar PII;
- el índice de gobernanza distingue aprobado, implementado y verificado.

## 18. Aprobación

El founder aprobó SDD-0166 el 2026-07-21, sin excepciones. La aprobación valida
la arquitectura, los cinco cortes, los criterios de aceptación y los gates de
seguridad aquí definidos.

La autorización posterior permitió inventariar Corte A y redactar/revisar A1.
[REV-AUD-003](../../governance/reviews/aud-corte-a1.md) lo aprobó técnicamente y
[REV-AUD-004](../../governance/reviews/aud-corte-a1-aplicacion.md) registra su
aplicación y verificación individual en Cloud.

La autorización independiente posterior permitió redactar y revisar A2 de
forma local. [REV-AUD-005](../../governance/reviews/aud-corte-a2.md) aprobó
`0261_audit_entity_catalog_validate.sql` para aplicación individual y
[REV-AUD-006](../../governance/reviews/aud-corte-a2-aplicacion.md) registra su
aplicación y verificación en Cloud. Cada futuro corte, aplicación y archivo
conserva un gate independiente por basename exacto.

El 2026-07-28 se completó el inventario metadata-only de B0.
[REV-AUD-007](../../governance/reviews/aud-corte-b.md) aprobó la versión 1.0
del [diseño correctivo del Corte B](diseno-correctivo-corte-b.md), con una
excepción transitoria explícita para el `ON DELETE CASCADE` de la FK de tenant.
Una autorización posterior abrió únicamente B1 local.
[REV-AUD-008](../../governance/reviews/aud-corte-b1.md) registra
`0267_audit_contract_append_only.sql`, su prueba contractual verde en
PostgreSQL 15/17 y su aprobación técnica para una futura aplicación
individual. La migración fue integrada en
`dcbc259354d83c895fff96615e9f14eedf5a9f59` y
[REV-AUD-009](../../governance/reviews/aud-corte-b1-aplicacion.md) registra su
aplicación y verificación en Cloud bajo el basename exacto. La FK de tenant
conserva `ON DELETE CASCADE` como excepción transitoria: el ciclo de vida
tenant/fixtures fue diseñado y aprobado en
[REV-AUD-010](../../governance/reviews/aud-tenant-fixtures.md), pero su
implementación local se separó en
[SDD-0172](../0172-tenant-fixtures-lifecycle/spec.md). `0268` y el recorrido
efímero permanecen pendientes. Los Cortes C–E conservan gates separados.
