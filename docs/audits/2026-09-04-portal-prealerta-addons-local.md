# Catálogo de servicios Portal · SDD-0402 / 0434 · evidencia local

Fecha: 2026-09-04

Alcance: consumidores locales, PostgreSQL desechable e inventario reconstruido

Fuera de alcance: Cloud, datos reales, push, `main`, despliegue y limpieza

## Hallazgos reproducidos

Tres consumidores del Portal ya derivaban `tenantId` mediante el principal
canónico, pero llamaban `listActivePrealertaAddons(supabase)` sin propagarlo:
Proveedores, Nueva compra y Etiquetas.

La rama Portal de `prealerta_addons read` usaba
`get_portal_client_tenant()`, que sólo leía `client_users.tenant_id`. Un vínculo
activo tenant A → cliente B pudo leer el catálogo de tenant A en el fixture.

## Correctivo preparado

- Los tres consumidores pasan `{ tenantId }` al query compartido.
- 0434 conserva la rama staff `get_user_tenant_id()` y sustituye sólo la rama
  Portal por una relación coherente entre `auth.uid()`, `client_users`, cliente
  vivo y tenant del catálogo.
- No cambia escritura, `service_role`, ACL, RLS, funciones, datos ni Storage.
- El preflight exige las tres policies exactas, sus roles y el texto histórico;
  el postflight rechaza cualquier residuo del helper anterior.

## Evidencia ejecutada

- RED aplicación: 3/3 callers sin tenant.
- RED SQL: vínculo incoherente leyó el único catálogo de tenant A.
- GREEN focal: 21/21 pruebas de consumidores y query compartido.
- Regresión Portal + Prealertas: 1.086/1.086 en 83 archivos.
- Suite unitaria global: 7.292/7.292 en 575 archivos, 387,21 s, sin
  reintentos ni exclusiones.
- GREEN SQL: principal coherente ve sólo su tenant; vínculo incoherente,
  revocado y cliente borrado ven cero; staff conserva lectura/escritura del
  tenant y `service_role` conserva las filas.
- SQL completo: 176/176 contratos.
- Rebuild: 431 migraciones, 413 desde cero, 18 sólo-ledger y aislamiento de 219
  tablas.

## Cierre del inventario de policies Portal

Sobre el esquema reconstruido con 0434 se inventariaron 42 policies: 32 ligan
directamente `client_users`, 6 usan el helper Club endurecido por 0424, 1 usa el
helper booleano Realtime de 0433, 1 administra `portal_access_links` sólo por
tenant de equipo y las 2 restantes son las policies internas de escritura y
`service_role` del propio catálogo. Ninguna expresión final referencia
`get_portal_client_id`, `get_portal_client_markbox` ni
`get_portal_client_tenant`.

Esto cierra la casilla original de auditar policies Portal que comparaban
Shipping Mark sin tenant. No certifica toda la integridad financiera, comandos,
transiciones ni RBAC interno del ERP.

## Estado y límites

- Local: **CORRECTO** para SDD-0402 y el inventario de policies Portal.
- Producción: **NO VERIFICABLE**; 0434 no se aplicó ni se consultó Cloud.
- Checklist original: 57/106 (53,8 %), porque se cerró una casilla existente.
- Quedan 34 migraciones preparadas 0401–0434 según el último ledger 0400.
