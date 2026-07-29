# AUD-01 v1.0 — Auditoría de mutaciones

| Control | Valor |
|---|---|
| Código | AUD-01 |
| Versión | 1.0 |
| Dueño | Sam (founder) |
| Estado | aprobada — implementación parcial/no conforme |
| Creado | 2026-07-21 |
| Depende de | [SGE-00](sge-00.md) y [MP-01](mp-01.md) |
| Base existente | [SDD-0123](../../specs/0123-audit-log/spec.md) · `entity_audit_log` |

## 1. Ley central

Una mutación sensible y su evento obligatorio de auditoría son una sola
operación. Si el evento no puede persistirse, la mutación crítica debe fallar
de forma segura. Registrar después dentro de un `try/catch` que ignora el error
no cumple AUD-01.

## 2. Eventos obligatorios

Se auditan, como mínimo:

- crear, emitir, aprobar, rechazar y cambios de estado significativos;
- eliminar, archivar, restaurar, cancelar, anular y revertir;
- movimientos financieros, ajustes, conciliaciones y cambios de período;
- cambios de permisos, roles, acceso, configuración sensible y credenciales;
- exportaciones, consultas sensibles y descargas masivas;
- acciones de IA que produzcan efectos externos o mutaciones;
- overrides de reglas legales, contables o de negocio;
- sustitución o eliminación de archivos que sean evidencia.

Lecturas rutinarias no se auditan por defecto. Lecturas de PII, secretos,
expedientes o exportaciones se rigen por AUD-02.

## 3. Contrato mínimo del evento

| Campo | Regla |
|---|---|
| `id` | Identificador inmutable del evento. |
| `tenant_id` | Obligatorio y validado en la misma frontera de la mutación. |
| `entity_type` / `entity_id` | Entidad afectada; vocabulario canónico y extensible sin reescribir listas manuales regresivas. |
| `event_type` | Verbo estable en pasado o evento de dominio, no texto libre de UI. |
| `actor_type` / `actor_id` | Usuario, operario, sistema o agente; nunca convertir actor desconocido en “system” silenciosamente. |
| `before` / `after` | Snapshot mínimo o diff suficiente para reconstruir la decisión; excluye secretos. |
| `reason` | Obligatorio para R3, rechazo, anulación, override y cambios de acceso. |
| `occurred_at` | Hora del servidor; no depende del reloj del cliente. |
| `correlation_id` | Une UI, mutación, jobs, notificaciones y eventos relacionados. |
| `source` | Superficie y operación: Studio, móvil, RPC, job, webhook o IA. |
| `related_files` | IDs/rutas lógicas de evidencia; nunca URL pública permanente ni blob en el payload. |
| `result` | `succeeded`, `rejected` o `failed`, con código estable de causa cuando aplique. |

`payload` puede transportar estos campos durante una migración compatible, pero
el contrato no permite claves arbitrarias distintas por cada módulo.

## 4. Atomicidad permitida

| Patrón | Uso |
|---|---|
| RPC/transacción de base de datos | Preferido cuando mutación y evento viven en Postgres. |
| Trigger de dominio | Válido para transiciones simples y uniformes; debe capturar actor/contexto confiable. |
| Outbox en la misma transacción | Válido cuando el evento debe propagarse; el outbox durable nace junto con la mutación. |
| Compensación explícita | Solo cuando el sistema externo impide atomicidad; se registra estado pendiente/fallido y existe reconciliación. |

No cumplen para eventos obligatorios:

- `mutar → intentar insert de log → console.error`;
- confiar en que el toast representa el evento;
- escribir el log solo desde el cliente;
- permitir que el caller omita auditoría por no conocer el `entity_type`;
- borrar o editar el evento original para corregirlo.

## 5. Antes, después y datos sensibles

- Se registra únicamente lo necesario para explicar la decisión.
- Contraseñas, tokens, secretos, contenido cifrado, números completos de cuenta
  y archivos no entran en el payload.
- PII se minimiza y se representa por identificador cuando sea suficiente.
- Una corrección crea un evento nuevo que referencia el anterior.
- Los valores grandes usan hash, versión o puntero con acceso controlado.

## 6. Eliminación y archivos

Para P2/P3/R3 el evento incluye:

- clasificación MP-01;
- estado anterior y posterior;
- consecuencia declarada;
- motivo;
- posibilidad y plazo de recuperación;
- IDs de archivos afectados y su tratamiento;
- evento compensatorio/restauración, si ocurre.

El log no “va a un archivo” del filesystem. Los binarios viven en Storage; el
evento conserva referencias lógicas y metadatos autorizados.

## 7. Evidencia actual del ERP

La base existente aporta:

- `entity_audit_log` con tenant, entidad, actor, evento, payload y fecha;
- RLS de lectura por tenant y escritura mediante `service_role`/RPC;
- índices por entidad y tenant/fecha;
- viewer read-only de los últimos 100 eventos;
- escritores para operación, facturación, contabilidad, cobranzas, tesorería,
  compras, ventas y rendiciones.

Brechas comprobadas:

1. múltiples helpers declaran “best-effort” y no bloquean la mutación;
2. `before`, `after`, `reason`, `correlation_id`, `source` y `result` no tienen
   contrato uniforme;
3. la migración `0241_estiba_por_zonas.sql` redefine la whitelist sin
   `rendition`, revirtiendo la ampliación de `0123_rendiciones.sql`;
4. el viewer solo humaniza seis tipos de entidad y convierte actores no
   reconocidos en `system`;
5. `service_role all` permite update/delete y la tabla no es inmutable a nivel
   de base de datos;
6. la cobertura de auditoría es menor que el universo de mutaciones sensibles.

Estos son hallazgos documentales. Corregirlos requiere un SDD y migraciones
separadas; AUD-01 no autoriza modificar producción.

## 8. Criterios de conformidad

- 100 % de mutaciones obligatorias tienen evento de dominio estable;
- una prueba fuerza fallo del log y demuestra rollback/fallo seguro;
- tenant y actor se obtienen de contexto confiable, no del formulario;
- before/after y motivo cumplen el contrato sin secretos;
- la lista de entidades no pierde valores al ampliarse;
- restauración/reversión enlaza el evento original;
- el toast puede referenciar `correlation_id`, pero no escribir el evento;
- AUD-02 controla quién consulta, retiene y exporta.
