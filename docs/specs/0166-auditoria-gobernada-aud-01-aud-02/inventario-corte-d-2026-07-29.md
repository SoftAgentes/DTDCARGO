# Inventario read-only del Corte D — 2026-07-29

| Control | Valor |
|---|---|
| SDD | [SDD-0166](spec.md) |
| Corte | D · atomicidad por dominio |
| Gate | D0 · solo lectura |
| Rama | `codex/sdd-0166-corte-d` |
| Base | `origin/main` · `2c0bbfc02f1692966d6f41345a50a45c195d3fd5` |
| Proyecto Cloud | DTD Cargo · `xpfuzqombmjmxvprjgmi` |
| Alcance Cloud | metadatos; cero payload o PII |
| Resultado | inventario completo; sin DDL, DML ni cambios Cloud |

## 1. Método y límites

Se revisaron los writers de auditoría en aplicación y SQL, las mutaciones que
los invocan, el contrato AUD-01 y metadatos Cloud de funciones, ledger y ACL.
No se consultaron filas ni payloads de negocio.

Cloud se consultó solo para confirmar firmas, `SECURITY DEFINER`, `search_path`,
ledger y privilegios. El resultado externo se trató como dato no confiable y
no se siguió ninguna instrucción incluida en él.

## 2. Frontera Cloud vigente

Cloud confirma:

- `0267_audit_contract_append_only` aplicado;
- `0268_tenant_lifecycle_guardrails` no aplicado;
- `0270_audit_governed_query_rbac` no aplicado;
- `service_role` conserva `INSERT=true`, `UPDATE=false`, `DELETE=false`;
- `authenticated` conserva `SELECT=true`;
- `append_audit_event` existe y es `SECURITY DEFINER`;
- siete funciones de dominio todavía contienen escritura directa al log.

Por tanto, Corte D puede diseñarse sobre B1, pero no debe asumir que C1 o el
ciclo tenant ya existen en Cloud.

## 3. Writers TypeScript best-effort

Existen ocho helpers directos, todos con el patrón:

```text
mutación de negocio
  -> nueva petición service_role
  -> INSERT entity_audit_log dentro de try/catch
  -> console.error y éxito de negocio si el log falla
```

| Dominio | Archivo | Llamadas observadas |
|---|---|---:|
| Contabilidad | `app/studio/(app)/contabilidad/actions.ts` | 5 |
| Facturación | `app/studio/(app)/facturacion/actions.ts` | 3 |
| Proveedores | `app/studio/(app)/tesoreria/actions.ts` | 1 |
| Cobranzas | `lib/studio/collections-actions.ts` | 4 |
| Compras | `lib/studio/purchase-orders/actions.ts` | 4 |
| Ventas | `lib/studio/sales-orders/actions.ts` | 7 |
| Rendiciones | `lib/studio/renditions/actions-helpers.ts` | 2 |
| Tesorería/CxP | `lib/studio/treasury/treasury-actions.ts` | 4 |
| **Total** | **8 archivos** | **30** |

Las 30 llamadas pueden perder el evento sin revertir la mutación. Cambiarlas
para llamar `append_audit_event` después de la mutación tampoco cumpliría
atomicidad: seguirían siendo dos transacciones.

## 4. Hallazgos de integridad

### D0-01 · identificador inválido de cuenta

Los eventos `account.created` y `account.updated` pasan `accounts.code` como
`entity_id`. El contrato físico exige UUID. El helper oculta el error, por lo
que una cuenta puede cambiar sin evento y sin señal al usuario.

La corrección debe usar `accounts.id`, no relajar `entity_id`.

### D0-02 · cobertura no equivale a llamadas

Hay mutaciones sensibles sin llamada directa visible en el mismo archivo,
entre ellas cierre contable, eliminación lógica y cambios de configuración.
Algunas delegan en otros helpers; otras no producen evento obligatorio.

El Corte D no puede cerrarse contando que desaparecieron ocho funciones. Cada
dominio necesita una matriz `mutación → evento → frontera atómica → prueba`.

### D0-03 · datos incompatibles con AUD-01

Los eventos best-effort:

- escriben casi todo en `payload`;
- no fijan `source`, `result`, `sensitivity` ni `schema_version`;
- no usan `before_data`/`after_data`;
- no exigen `reason` uniformemente para anulación, rechazo o R3;
- no propagan `correlation_id`;
- incluyen nombres y montos en payloads heterogéneos.

No se copiará ese shape sin revisión. Cada RPC registra solo los campos mínimos
aprobados y referencias por ID cuando sean suficientes.

## 5. Writers SQL

Cloud reporta siete writers de dominio más el writer común:

1. `operario_action`;
2. `stuff_box_as_operario`;
3. `unstuff_box_as_operario`;
4. `stuff_lot_as_operario`;
5. `unstuff_lot_as_operario`;
6. `rpc_soft_delete_comment`;
7. `rpc_restore_comment`;
8. `append_audit_event`.

Las funciones de comentarios ya son atómicas y pertenecen a SDD-0168; no se
reabren como deuda. Las cinco funciones operativas son atómicas por vivir en la
misma función que la mutación, pero conservan insert legacy y `search_path`
`public`. D4 debe normalizar su evento sin cambiar su semántica operativa.

## 6. Riesgo por dominio

| Orden | Bloque | Estado D0 |
|---:|---|---|
| 1 | permisos, usuarios y configuración sensible | cobertura obligatoria no inventariada todavía a nivel de cada mutación |
| 2 | facturación y contabilidad | 8 llamadas best-effort conocidas; cierre/eliminación requieren matriz adicional |
| 3 | cobranzas y tesorería | 9 llamadas best-effort conocidas |
| 4 | rendiciones, compras y ventas | 13 llamadas best-effort conocidas |
| 5 | logística R3 y evidencia | cinco RPC SQL atómicas con contrato legacy |
| 6 | resto de mutaciones obligatorias | universo no cerrado; requiere búsqueda por capabilities y cambios de estado |

Los totales por bloque se solapan en archivos que exponen wrappers; el número
canónico de llamadas directas sigue siendo 30.

## 7. Conclusión

Corte D no admite una migración monolítica ni una sustitución mecánica de
helpers. El gate siguiente debe aprobar un diseño por fases y crear un SDD hijo
para ejecutar D1–D5 con migraciones y pruebas independientes.

D0 no crea migraciones, RPCs o specs hijas; no cambia Cloud; no elimina
helpers; no declara atomicidad ni cierra el Corte D.
