# Cierre técnico · SDD-0341 Perfil privado por principal

Fecha: 2026-09-02

Estado: CERRADO LOCALMENTE · MIGRACIÓN NO APLICADA

## Resultado

- `get_portal_private_profile_context()` no recibe ids ni paths.
- La RPC deriva cliente y tenant desde `auth.uid()` y devuelve sólo sus Shipping
  Marks retirados y los paths de sus dos fotos.
- El módulo `server-only` es el único consumidor de paths y la página recibe
  exclusivamente códigos y URLs firmadas.
- Sin fotos no se construye `service_role`; un fallo de Storage no emite URLs.
- Perfil salió del inventario RSC: bajó de 8 rutas / 16 construcciones a 7 / 14.

## Evidencia

- Pruebas focales: 2 archivos / 7 pruebas.
- Suite completa: 515 archivos / 5.910 pruebas.
- Contratos SQL: 146, con rollback total.
- Rebuild: 402 migraciones; 384 desde cero + 18 sólo-ledger; aislamiento de
  219 tablas y 2 tenants.
- TypeScript, ESLint focal, `docs:check`, gobernanza, componentes y diff: OK.

## Gates preservados

- `0405_portal_perfil_privado_por_principal.sql` NO fue aplicada a Cloud o
  Producción.
- No se subieron, modificaron o borraron fotos ni Shipping Marks.
- No hubo push, integración a `main` o deploy.
