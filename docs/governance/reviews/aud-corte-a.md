# Revisión del diseño correctivo del Corte A

| Control | Valor |
|---|---|
| Revisión | REV-AUD-002 |
| SDD | [SDD-0166](../../specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md) |
| Diseño | [Catálogo aditivo + matriz de revocación](../../specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-a.md) |
| Fecha | 2026-07-22 |
| Resultado técnico | aprobado |
| Estado | diseño aprobado; no implementado |
| Decisión | Instrucción explícita de Sam (founder) + revisión técnica Codex |

## 1. Veredicto

Se aprueba la versión 1.0 sin bloqueantes técnicos. El diseño conserva historia,
evita otra whitelist regresiva, usa la FK e índices existentes de forma segura y
define mínimo privilegio sin cortar dependencias antes de migrarlas.

## 2. Condiciones que hicieron aprobable el diseño

1. Corte A no cambia permisos de `entity_audit_log`.
2. Catálogo y validación se dividen en A1/A2, aplicables por separado.
3. La unión incluye Cloud, CHECK, writers y `rendition`.
4. La FK se añade `NOT VALID` y el CHECK se retira solo después de validar.
5. El catálogo es global, sin labels UI ni acceso para roles de aplicación.
6. El índice actual por `entity_type` evita duplicación.
7. La matriz distingue dependencia temporal de destino final.
8. `service_role` pierde mutabilidad en B1 y el INSERT solo después de migrar
   callers; `authenticated` pierde SELECT en C después del adaptador.
9. El drift de ACL de 0241 se corrige hacia adelante, sin editar historia.
10. No existe autorización implícita para crear o aplicar migraciones.

## 3. Contraste con el snapshot Cloud

El preflight metadata-only del 2026-07-22 confirmó que el estado no cambió:

- catálogo `audit_entity_types` ausente;
- CHECK de 15 tipos sin `rendition`;
- `anon` con TRUNCATE/TRIGGER/REFERENCES/MAINTAIN;
- `authenticated` con esos privilegios + SELECT;
- `service_role` con SELECT/INSERT/UPDATE/DELETE/TRUNCATE y auxiliares.

La matriz parte, por tanto, del ACL efectivo y no de una inferencia documental.

## 4. Compatibilidad

| Dependencia | Protección aprobada |
|---|---|
| Cinco writers SQL | Conservan EXECUTE a `service_role`. |
| Ocho writers TypeScript | Conservan INSERT hasta migración comprobada. |
| Viewer actual | Conserva SELECT `authenticated` hasta Gate C. |
| Realtime | Permanece hasta inventario final de consumidores en C. |
| Historia existente | Unión + FK validada; cero reescritura de payload. |

## 5. Decisión registrada

REV-AUD-002 aprueba el diseño. El founder autorizó después redactar únicamente
A1 y se creó `0258_audit_entity_catalog.sql`, todavía sin aplicación Cloud. A2 y
la matriz ACL conservan autorizaciones separadas. Aplicar A1 exige el runbook y
el basename exacto.
