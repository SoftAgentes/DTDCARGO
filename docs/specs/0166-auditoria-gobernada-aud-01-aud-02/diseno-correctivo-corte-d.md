# Diseño correctivo del Corte D — atomicidad por dominio

| Control | Valor |
|---|---|
| SDD | [SDD-0166](spec.md) |
| Diseño | Corte D · D0 v1.0 |
| Base | [Inventario read-only](inventario-corte-d-2026-07-29.md) |
| Revisión | [REV-AUD-014](../../governance/reviews/aud-corte-d.md) |
| Estado | aprobado técnicamente; implementación no abierta |

## 1. Decisión

Corte D se ejecuta mediante un SDD hijo único con cinco fases internas. Cada
fase tiene migración, prueba de rollback por fallo del evento, cambio de
aplicación y cierre documental propios.

```text
acción server-side
  -> RPC de dominio
     -> valida sesión, tenant, capability, estado e idempotencia
     -> bloquea fila objetivo
     -> muta negocio
     -> append_audit_event
     -> devuelve resultado + correlation_id
  -> commit único o rollback completo
```

No se usa trigger genérico para esconder semántica de dominio y no se llama el
writer común desde una segunda petición.

## 2. Fases

### D1 · acceso y configuración

- inventario cerrado de permisos, roles, membresías y configuración sensible;
- eventos con before/after mínimo y motivo obligatorio;
- primera frontera atómica por ser el bloque de mayor riesgo;
- cambios de credenciales continúan fuera del payload.

### D2 · núcleo financiero

- facturación y contabilidad;
- cobranzas, tesorería, CxP y pagos;
- anulación/reversión siempre con motivo;
- pruebas de fallo del evento que demuestren rollback de saldo, estado y
  asiento.

### D3 · ciclo comercial

- rendiciones;
- órdenes de compra;
- órdenes de venta y asignaciones;
- conservar idempotencia y relaciones con factura/prealerta.

### D4 · logística R3

- normalizar cinco RPCs operativas ya atómicas;
- cambiar `search_path=public` por frontera fija mínima cuando sea compatible;
- usar `append_audit_event` dentro de la misma transacción;
- no reabrir SDD-0168 ni sus RPCs de comentarios.

### D5 · cobertura residual

- inventario de mutaciones obligatorias no cubiertas por los ocho helpers;
- archivos de evidencia, exportaciones y efectos externos;
- retirar el último INSERT directo de aplicación solo cuando el ledger esté
  vacío;
- revocar `INSERT service_role` al final, no antes.

## 3. Contrato común de RPC

Toda RPC nueva:

- deriva `auth.uid()` y una membresía activa; no recibe tenant del formulario;
- verifica capability de dominio y estado permitido;
- acepta `p_operation_id` para idempotencia cuando la operación pueda
  reintentarse;
- acepta o genera correlation ID validado;
- exige motivo de 8–500 caracteres para R3, rechazo, anulación, override y
  acceso;
- construye before/after con allowlist explícita;
- evita nombres, cuentas completas, tokens, secretos y blobs;
- llama `append_audit_event` antes de retornar;
- revoca EXECUTE a `PUBLIC`/`anon` y concede solo el rol necesario;
- fija `search_path=''`, timeouts y owner revisado;
- devuelve error estructurado sin convertir una falla en éxito.

## 4. Prueba obligatoria por operación

Cada mutación crítica incluye:

1. éxito con exactamente un evento;
2. tenant ajeno denegado;
3. rol/capability insuficiente denegado;
4. estado inválido rechazado sin mutación;
5. segundo `operation_id` idempotente;
6. fallo forzado del evento y rollback de la mutación;
7. before/after sin claves prohibidas;
8. motivo obligatorio donde aplique;
9. ACL y `search_path`;
10. rollback total del fixture.

PostgreSQL 15 y 17 son obligatorios para cada migración local.

## 5. Cambios de aplicación

Por fase se reemplazan las acciones directas por un adaptador fino a la RPC.
El helper best-effort y sus llamadas se eliminan en el mismo cambio que activa
la frontera atómica.

No se dejan dos writers para el mismo evento. El camino anterior se conserva
solo en dominios aún no migrados.

## 6. Ledger de cobertura

El SDD hijo mantiene una tabla por mutación:

| Campo | Regla |
|---|---|
| dominio/acción | nombre estable y archivo caller |
| clasificación | obligatoria / no aplica / excepción |
| evento | `entity_type.event_type` |
| frontera | RPC, trigger de dominio u outbox |
| actor/capability | origen confiable |
| before/after/reason | allowlist |
| prueba de fallo | evidencia de rollback |
| estado | inventariada, migrada, verificada |

Una fase no cierra por cantidad de archivos sino por filas obligatorias
verificadas.

## 7. Forward-fix

Las RPCs se corrigen hacia adelante. No se restaura best-effort para resolver
un defecto. Si una fase causa regresión:

- se deshabilita su entrada de aplicación;
- se conserva la transacción atómica;
- se corrige la RPC;
- no se reotorga mutación directa al log.

## 8. Numeración y allowlist del siguiente gate

El siguiente SDD disponible debe revalidarse contra `origin/main` y todos los
worktrees. El candidato actual es SDD-0174, sin reservarlo en D0.

La futura apertura del SDD hijo puede modificar únicamente:

1. un nuevo `docs/specs/NNNN-audit-atomicidad-dominios/spec.md`;
2. `docs/specs/README.md` generado;
3. `docs/architecture/module-sdd-map.md`;
4. este diseño;
5. SDD-0166;
6. una revisión y línea base nuevas;
7. `docs/governance/README.md`.

Implementar D1 exige una allowlist nueva de código/migración después del
inventario específico.

## 9. Gates

D0, aprobación del diseño, apertura del SDD hijo, D1–D5 locales, cada commit,
integración, cada migración Cloud y verificación de producción son gates
separados.

Un “avanza” general no autoriza aplicar una migración. Cloud requiere el
basename exacto y el runbook vigente.
