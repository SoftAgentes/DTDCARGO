# Cierre técnico · SDD-0339 Referidos del Portal por principal

Fecha: 2026-09-02

Estado: CERRADO LOCALMENTE · MIGRACIÓN NO APLICADA

## Resultado

- `get_portal_referral_program()` no recibe markbox, client id ni tenant id.
- La RPC deriva el cliente desde `auth.uid()` y falla cerrada para vínculos
  revocados o clientes eliminados.
- Facturación, configuración y referidos quedan limitados al mismo tenant y
  Shipping Mark del principal.
- La respuesta no incluye email, teléfono, notas, lead id ni ids de clientes.
- Referidos ya no construye `service_role`; el inventario bajó de 10 rutas / 18
  construcciones a 9 rutas / 17 construcciones.

## Evidencia

- Pruebas focales: 2 archivos / 7 pruebas.
- Suite completa: 513 archivos / 5.901 pruebas.
- Contratos SQL: 145, con rollback total.
- Rebuild: 401 migraciones; 383 desde cero + 18 sólo-ledger; aislamiento de
  219 tablas y 2 tenants.
- TypeScript, ESLint focal, `docs:check`, gobernanza, componentes y diff: OK.

## Cobertura preservada

- Los tests puros de Fidelización siguen cubriendo niveles y normalización USD.
- El contrato 0404 cubre USD, VES, CNY, estados no billable, ventana trailing-12m,
  fallback de configuración, tenant cruzado y minimización de campos.

## Gates preservados

- `0404_portal_referidos_por_principal.sql` NO fue aplicada a Cloud o Producción.
- No hubo push, integración a `main`, deploy, escritura de datos ni cambio de
  configuración alojada.
