---
sdd: "0384"
title: Acciones de Perfil Portal por principal y tenant
status: in-progress
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0138", "0151", "0382"]
confidencialidad: interno
---

# SDD0384 · acciones de Perfil Portal por principal y tenant

## Evidencia y autoridad

La numeración 0384 se comprobó contra 15 refs después de `git fetch origin` y
bb320c32. Una reproducción independiente de las cuatro Server Actions reales
confirmó que `uploadCedulaPhotoAction`, `updateAvatarAction`,
`submitDataChangeRequestAction` y `cancelDataChangeRequestAction` todavía
derivan el cliente sólo de `get_portal_client_id()`. Un vínculo sintético activo
con tenant A y cliente B alcanza las lecturas, uploads, updates, insert, aviso y
delete del cliente B. El estado inconsistente se inyectó administrativamente;
no demuestra que un usuario pueda crearlo.

No se usan datos o servicios reales. Este slice no autoriza migraciones, Cloud,
push, `main`, despliegue ni limpieza.

## Contrato acotado

- Resolver las cuatro acciones mediante `getPortalClientPrincipal()` y cortar
  antes de construir `service_role` si la sesión, vínculo, cliente o coherencia
  tenant/cliente no son verificables.
- Mantener validación de archivos antes de elevar privilegios.
- Aplicar tenant, cliente vivo e id exacto a cada lectura/update de `clients`.
- Aplicar tenant, cliente, `source='client'` y estado a las lecturas/escrituras
  de `client_change_requests`; persistir `source` de forma explícita.
- Conservar paths privados, límites de archivo, rollback del objeto nuevo,
  borrado best-effort del objeto reemplazado, avisos y revalidaciones.
- No modificar helpers genéricos del Studio, RLS, esquema, UI o contratos de
  almacenamiento.

## Datos personales · revisión focal

- Datos ya tratados: foto de cédula/RIF, avatar, nombre, documento y teléfono.
- Finalidad observable: verificación/perfil y solicitud mediada de corrección.
- El delta no añade campos, proveedores, destinos, logs ni retención; reduce el
  alcance privilegiado al principal Portal coherente.
- La retención real en Storage, backups, logs y terceros no puede verificarse
  sin infraestructura autorizada. No se afirma cumplimiento legal.
- Referencias internas: CRBV arts. 28 y 60; LECDI arts. 20–22; si el tratamiento
  ocurre en China, PIPL arts. 6, 28–30, 51 y 55–56.

## Allowlist exacta

- `app/portal/(app)/perfil/actions.ts`.
- `app/portal/(app)/perfil/avatar-actions.ts`.
- `app/portal/(app)/perfil/profile-actions-scope.test.ts`.
- Esta spec, `docs/specs/README.md` generado y auditoría local del slice.
- Checklist de arranque y handoff del saneamiento.

## Aceptación

- [x] RED persistente reproduce las cuatro operaciones con vínculo incoherente.
- [x] Sin principal coherente hay cero admin, uploads, DML, avisos o caché.
- [x] Flujos válidos fijan tenant, cliente vivo, id y origen en cada frontera.
- [x] Validación, rollback, borrado reemplazado y mensajes se preservan.
- [x] Gates focales y suite proporcional quedan aprobados.
- [x] Revisión focal de datos separa evidencia local de lo no verificable.
- [x] Checklist histórico queda veraz sin inflar 56/106.

Gobernanza: no conformidad de aislamiento confirmada. El correctivo sólo será
`CORRECTO` tras GREEN y evidencia de archivo/línea; producción seguirá `NO
VERIFICABLE`. No hay cambio visual.
