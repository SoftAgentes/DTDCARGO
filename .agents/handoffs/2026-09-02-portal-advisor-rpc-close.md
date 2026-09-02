# Cierre técnico · SDD-0338 asesor del Portal por principal

Fecha: 2026-09-02

Estado: CERRADO LOCALMENTE · MIGRACIÓN NO APLICADA

## Resultado

- `get_portal_advisor()` no recibe ids: deriva el cliente desde `auth.uid()`.
- La RPC exige vínculo Portal activo, cliente vigente y asesor activo en el
  mismo tenant.
- Sólo devuelve nombre, teléfono, avatar y cargo; no expone ids ni campos
  internos del perfil.
- Inicio y Soporte usan la sesión autenticada para esta lectura.
- El inventario de `service_role` en RSC del Portal bajó de 10 rutas / 19
  construcciones a 10 rutas / 18 construcciones.

## Evidencia

- Pruebas focales: 2 archivos / 6 pruebas.
- Suite completa: 513 archivos / 5.904 pruebas.
- Contratos SQL: 144, con rollback total.
- Rebuild: 400 migraciones; 382 desde cero + 18 sólo-ledger; aislamiento de
  219 tablas y 2 tenants.
- TypeScript, ESLint focal, `docs:check`, gobernanza, componentes y diff: OK.

## Gates preservados

- `0403_portal_advisor_por_principal.sql` NO fue aplicada a Cloud o Producción.
- No hubo push, integración a `main`, deploy, escritura de datos ni cambio de
  configuración alojada.
- El push de la rama completa conserva su autorización literal separada.
