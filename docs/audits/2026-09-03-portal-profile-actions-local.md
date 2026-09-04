---
title: Acciones de Perfil Portal por principal y tenant
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
review-by: 2026-09-10
confidencialidad: interno
---

# SDD0384 · acciones de Perfil Portal

## Estado

Correctivo local verificado. No hay migración en este slice y no se tocó
Cloud, Storage/DB reales, push, `main`, despliegue ni limpieza. La numeración
0384 se confirmó contra 15 refs actualizadas.

## Reproducción causal

Una prueba que ejecuta las cuatro acciones reales con DB, Storage, avisos y
caché sintéticos produjo RED: 9 fallos y 3 controles aprobados. El helper legado
devolvió cliente B para una membresía activa tenant A → cliente B; cédula y
avatar leyeron/actualizaron B y usaron paths B, el alta insertó/notificó B y la
cancelación borró por B. El fallo de Auth también fue ignorado. La reproducción
está en `app/portal/(app)/perfil/profile-actions-scope.test.ts:237`.

El estado inconsistente se inyectó administrativamente. No demuestra que una
cuenta Portal pueda crearlo. No se usaron filas, cuentas, archivos ni servicios
reales.

## Delta

- Las cuatro acciones resuelven primero `getPortalClientPrincipal()` y recuperan
  fallos de construcción/sesión antes de crear el cliente admin
  (`actions.ts:41`, `avatar-actions.ts:26`).
- Las lecturas y updates de `clients` fijan tenant, id y `deleted_at is null`
  (`actions.ts:76`, `actions.ts:99`, `avatar-actions.ts:61` y
  `avatar-actions.ts:80`).
- La solicitud abierta, insert y cancelación fijan tenant, cliente,
  `source='client'` y estado (`actions.ts:176`, `actions.ts:244` y
  `actions.ts:316`).
- Validación de archivos antes de elevar, paths privados, rollback del objeto
  nuevo, borrado best-effort del reemplazado, aviso y revalidación se conservan.

## Revisión focal de datos personales

Esta revisión técnica no es asesoría legal y no afirma cumplimiento.

| Dato | Finalidad observable en código | Base/retención | Acceso observable |
|---|---|---|---|
| Foto de cédula/RIF y `cedula_photo_path` | Verificación de identidad del cliente | NO VERIFICABLE | Portal sube vía servidor; equipo del tenant lee; bucket privado |
| Avatar y `avatar_path` | Foto cosmética de perfil | NO VERIFICABLE | Portal reemplaza vía servidor; mismo bucket privado |
| Nombre, documento y teléfono propuestos/previos | Corrección mediada y traza de la solicitud | NO VERIFICABLE | Cliente origen y equipo autorizado del tenant |

- `CORRECTO` — minimización del delta: no agrega campos, categorías, terceros,
  logs ni destinos; limita el acceso privilegiado al principal coherente. La
  evidencia está en los scopes citados y en las regresiones de líneas 264–321.
- `CORRECTO` — controles estáticos de archivos: `client-docs` se declara privado,
  con 8 MB y MIME permitidos en
  `supabase/migrations/0091_portal_self_register.sql:30-41`; las policies están
  en líneas 46–69. La comprobación alojada actual sigue separada.
- `CORRECTO` — separación semántica: la finalidad del avatar está documentada en
  `supabase/migrations/0199_clients_avatar.sql:21-24`; las solicitudes limitan
  los campos de identidad y documentan su finalidad en
  `supabase/migrations/0220_client_change_requests.sql:22-58`.
- `NO VERIFICABLE` — retención y borrado efectivo en Storage, backups, logs,
  cachés y terceros. El rollback sintético se prueba en
  `profile-actions-scope.test.ts:312`; no equivale a una búsqueda real del dato.
- `NO VERIFICABLE` — base jurídica, aviso/consentimiento separado, evaluación de
  impacto PIPL, transferencia transfronteriza y acceso del equipo en China. La
  operación declarada incluye China, pero este slice no inspecciona contratos,
  paneles ni datos reales. Referencias internas: CRBV arts. 28/60, LECDI
  arts. 20–22 y PIPL arts. 6, 28–30, 51 y 55–56.

## Verificación local

- RED causal: 9 fallos esperados / 3 controles aprobados.
- GREEN focal: 13/13; conjunto Perfil: 53/53 en siete archivos.
- TypeScript, ESLint focal y `git diff --check`: aprobados.
- Suite completa: 7.200/7.200 en 558 archivos, 418,56 s, sin reintento.
- Docs/índice de 376 specs, numeración, gobernanza y componentes: aprobados.
- No se repitieron contratos SQL/rebuild porque este slice no cambia SQL.

## Límites

- SDD0382/0430 sigue siendo un release independiente; SDD0384 no añade SQL.
- Producción y la eliminación física de PII siguen `NO VERIFICABLE`.
- El checklist original continúa 56/106; este correctivo no crea una casilla.
