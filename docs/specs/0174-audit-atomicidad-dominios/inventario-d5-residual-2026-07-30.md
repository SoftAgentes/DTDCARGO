# Inventario D5 — cobertura residual y retiro del writer

| Control | Valor |
|---|---|
| Gate | D5 |
| Acciones trasladadas desde D1 | 21 |
| Preferencias personales | 2 · no aplica auditoría de contenido |
| Writers TypeScript directos restantes | 0 |
| Resultado | cobertura local completa; `service_role INSERT` revocado |

## Ledger residual

| Superficie | Frontera | Clasificación |
|---|---|---|
| calculador y ciudades | trigger D5 | cumplimiento |
| calendario operativo | trigger D5 | cumplimiento |
| historial FX | trigger D5 | cumplimiento |
| contacto de cliente | trigger D5 con flags, sin PII | cumplimiento |
| acceso de portal | trigger `client_users` + workflow externo | cumplimiento |
| enlaces Auth y correos | intención → efecto → éxito/fallo | cumplimiento |
| addons de recepción | trigger D5 | cumplimiento |
| rutas y ciudades | trigger D5 | cumplimiento |
| perfil/preferencias personales | no persiste valor en audit | no aplica |

Las preferencias siguen protegidas por RLS y sus tablas de negocio. Auditarlas
copiando valores personales aumentaría exposición sin aportar evidencia de
control; por eso sólo se auditan cambios de acceso o canal, ya cubiertos por D1.

## Retiro

El barrido de `app/` y `lib/` no encuentra INSERT directo a
`entity_audit_log`. D2/D3 usan triggers, D4 enruta el legado SQL al writer y D1
/ D5 usan funciones contractuales. Por tanto, `0293` revoca finalmente
`INSERT` a `service_role`.
