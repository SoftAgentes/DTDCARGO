# Diseño correctivo aprobado — Corte A

| Control | Valor |
|---|---|
| SDD | [SDD-0166](spec.md) |
| Diseño | Catálogo aditivo + matriz exacta de revocación |
| Versión | 1.0 |
| Estado | aprobado; A1 aplicado y verificado, A2 ausente |
| Fecha | 2026-07-22 |
| Decisión | Sam (founder) + revisión técnica Codex |
| Evidencia | [Inventario repo/local/Cloud](inventario-corte-a-2026-07-21.md) |
| Migración creada | `0258_audit_entity_catalog.sql` (A1) |
| Revisión A1 | [REV-AUD-003](../../governance/reviews/aud-corte-a1.md) · aprobada |
| Aplicación A1 | [REV-AUD-004](../../governance/reviews/aud-corte-a1-aplicacion.md) · aplicada y verificada |

## 1. Veredicto

El diseño se aprueba porque elimina la lista regresiva de `entity_type` sin
reescribir historia, conserva compatibilidad con los writers actuales y define
un camino verificable hacia mínimo privilegio.

La aprobación separa dos responsabilidades normativas:

- **Corte A:** crear/poblar el catálogo, añadir y validar la FK, retirar el CHECK
  reemplazable y recuperar `rendition`;
- **Cortes B/C:** ejecutar la matriz de revocación por dependencias verificadas.

SDD-0166 exige cero cambios de permisos en Corte A. La matriz queda aprobada
como destino vinculante, pero ninguna revocación sobre `entity_audit_log` puede
entrar en las migraciones del Corte A.

## 2. Catálogo aprobado

### 2.1 Identidad y ubicación

La tabla se llamará `public.audit_entity_types`.

Se mantiene en `public` porque el proyecto no usa hoy un schema privado
versionado y crear uno ampliaría innecesariamente el corte. La tabla nace sin
privilegios para `PUBLIC`, `anon`, `authenticated` ni `service_role`, con RLS
habilitada y sin policies. Solo el owner de migraciones puede administrarla.

La ausencia de grants en el catálogo nuevo es parte de su creación segura; no
modifica los permisos de la tabla histórica.

### 2.2 Contrato de columnas

| Campo | Contrato |
|---|---|
| `entity_type` | `text`, PK; clave canónica lowercase `snake_case`. |
| `status` | `text`; `active` o `deprecated`. |
| `domain_code` | `text`; dominio de routing, no sensibilidad ni retención. |
| `contract_version` | entero positivo; inicia en 1. |
| `introduced_by_ref` | referencia documental/migración que introdujo el tipo. |
| `deprecated_at` | timestamp nullable; obligatorio solo al deprecar. |
| `created_at` | timestamp de creación con default de base. |

Reglas:

- `entity_type` no contiene espacios, mayúsculas ni etiquetas de UI;
- una fila con historia nunca se borra;
- deprecar cambia estado y fecha, no la clave;
- `domain_code` clasifica navegación/ownership y no sustituye la clasificación
  AUD-02 por evento;
- en Corte A, la FK valida existencia. El futuro writer del Corte B impedirá
  producir eventos nuevos con un tipo deprecado.

No se guardan labels traducidos en esta tabla. La presentación continúa siendo
responsabilidad del catálogo UI/versionado.

### 2.3 Unión inicial obligatoria

El catálogo se puebla con la unión de:

1. todos los `DISTINCT entity_type` existentes en Cloud;
2. todos los tipos permitidos por el CHECK efectivo;
3. todos los tipos emitidos por writers versionados;
4. `rendition`, recuperado desde 0123.

La unión mínima aprobada contiene 16 claves:

| Dominio | Tipos |
|---|---|
| `operations` | `shipment`, `dispatch_order`, `dispatch_order_package`, `warehouse_receipt_cn`, `warehouse_receipt_ve`, `consolidation` |
| `finance` | `invoice`, `journal_entry`, `account`, `payment_receipt`, `supplier_bill`, `supplier_payment`, `rendition` |
| `procurement` | `supplier`, `purchase_order` |
| `commercial` | `sales_order` |

La semilla es aditiva e idempotente: una clave existente se conserva y una
clave histórica desconocida entra como `legacy_unknown` para revisión; nunca se
elimina para hacer pasar la validación.

## 3. Sustitución segura del CHECK

La relación objetivo es:

```text
entity_audit_log.entity_type
              ↓ FK
audit_entity_types.entity_type
```

Contrato de la FK:

- nombre estable: `entity_audit_log_entity_type_fkey`;
- `ON UPDATE RESTRICT`;
- `ON DELETE RESTRICT`;
- se añade inicialmente `NOT VALID`;
- se valida después de poblar la unión completa;
- el CHECK actual solo se retira cuando la FK figura validada.

El índice existente `(entity_type, entity_id, occurred_at desc)` ya comienza por
la columna FK, por lo que no se crea otro índice redundante. La PK del catálogo
indexa la clave referenciada.

### 3.1 Secuencia de implementación futura

El diseño exige dos migraciones pequeñas, cuyos basenames se asignarán cuando el
founder autorice crear los archivos:

1. **A1 · catálogo y puente:** crear catálogo seguro, poblar unión, añadir FK
   `NOT VALID`; conservar el CHECK.
2. **A2 · validación y sustitución:** validar FK; comprobar cero huérfanos;
   retirar el CHECK; probar `rendition` y rechazo de tipo desconocido.

Cada archivo se revisa y aplica individualmente por basename exacto. A1 puede
quedar aplicada sin obligar A2 si la validación detecta drift. Las transacciones
serán cortas, con `lock_timeout`/`statement_timeout` acotados y sin llamadas
externas.

## 4. Matriz exacta de privilegios

### 4.1 Tabla histórica

`—` significa ningún privilegio directo sobre `entity_audit_log`.

| Rol | Cloud actual | Fin Corte A | Gate B1 | Gate B2/D | Gate C final |
|---|---|---|---|---|---|
| `PUBLIC` | — | — | — | — | — |
| `anon` | `TRUNCATE, TRIGGER, REFERENCES, MAINTAIN` | sin cambio | — | — | — |
| `authenticated` | `SELECT, TRUNCATE, TRIGGER, REFERENCES, MAINTAIN` | sin cambio | `SELECT` | `SELECT` | — |
| `service_role` | `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES, MAINTAIN` | sin cambio | `INSERT` | —, después de migrar todos los inserts directos | — |
| `postgres`/owner | todos | todos | todos | todos | todos |

Interpretación obligatoria:

- B1 revoca todo a `anon`;
- B1 conserva temporalmente solo SELECT a `authenticated` porque el viewer
  actual depende de la tabla base;
- B1 conserva temporalmente solo INSERT a `service_role` porque existen ocho
  writers TypeScript directos;
- B2/D revoca INSERT a `service_role` únicamente después de migrar cada caller
  a un writer/RPC aprobado y pasar pruebas de fallo;
- C revoca SELECT a `authenticated` únicamente después de desplegar el adaptador
  de consulta gobernada.

No se considera RLS sustituto de estas revocaciones. `TRUNCATE` y
`service_role` pueden operar fuera de la protección esperada por policies.

### 4.2 Funciones

Las cinco funciones actuales mantienen este contrato:

| Función | EXECUTE permitido | Otros roles |
|---|---|---|
| `operario_action` | `service_role`, owner | revocado |
| `stuff_box_as_operario` | `service_role`, owner | revocado |
| `unstuff_box_as_operario` | `service_role`, owner | revocado |
| `stuff_lot_as_operario` | `service_role`, owner | revocado |
| `unstuff_lot_as_operario` | `service_role`, owner | revocado |

El futuro forward-fix de ACL debe declarar explícitamente este contrato para las
cinco firmas. No se modifica una migración ya aplicada. Así se elimina el drift
de 0241 sin cambiar el comportamiento Cloud hoy efectivo.

### 4.3 Realtime

La publicación de `entity_audit_log` no cambia en Corte A. El repo no contiene
un subscriber de aplicación identificado, pero la retirada de
`supabase_realtime` pertenece al Gate C y exige una comprobación final de
consumidores externos.

## 5. Pruebas obligatorias del diseño

### Catálogo y FK

- la unión contiene los 15 tipos actuales, `rendition` y todo tipo histórico;
- la FK existe y pasa de `NOT VALID` a validada;
- el CHECK regresivo desaparece solo después de validar la FK;
- `rendition` se acepta dentro de una prueba transaccional con rollback;
- un tipo desconocido se rechaza;
- borrar una clave con historia se rechaza;
- deprecar conserva historia;
- no se crea un índice duplicado sobre `entity_type`.

### ACL

- Corte A demuestra que los permisos de `entity_audit_log` no cambiaron;
- B1 prueba la matriz con `has_table_privilege` para cada rol/privilegio;
- UPDATE, DELETE y TRUNCATE fallan para roles de aplicación después de B1;
- los cinco writers SQL continúan operando por EXECUTE;
- cada writer TypeScript migrado deja de necesitar INSERT directo;
- C prueba que `authenticated` ya no puede SELECT la tabla base.

### Operación

- inventario metadata-only antes/después de cada aplicación;
- prueba de huérfanos antes de validar la FK;
- `git diff --check`, `pnpm docs:check` y gates de migración del repo;
- advisors de seguridad después de cada cambio Cloud autorizado;
- rollback transaccional de pruebas sin dejar filas sintéticas.

## 6. Rollback y forward-fix

- si A1 falla, no se toca el CHECK ni permisos existentes;
- si A2 no valida, se conserva catálogo + FK no validada y se corrige la unión;
- después de validar, no se restaura una whitelist manual como rollback;
- una clave equivocada se depreca, no se borra si tiene historia;
- una revocación que rompa un caller se corrige restaurando solo el privilegio
  mínimo temporal y registrando la excepción; nunca `GRANT ALL`.

## 7. Límites de esta aprobación

La autorización posterior del founder permitió redactar y luego aplicar
individualmente `0258_audit_entity_catalog.sql`. REV-AUD-003 lo aprobó y
REV-AUD-004 verificó su aplicación en Cloud. A1 no cambió código ni revocó
privilegios de `entity_audit_log`. Esto no autoriza redactar/aplicar A2/B/C;
cada archivo futuro y su aplicación conservan gates separados.
