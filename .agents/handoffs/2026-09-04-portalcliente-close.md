# Cierre en rama — SDD-0435 Portal cliente

Fecha: 2026-09-04
Estado: CERRADO EN RAMA
Rol de esta tarea: worker
Rama: `portalcliente`
Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\portalcliente`
Base verificada antes del commit: `origin/main` en `2a2e81bf554dbe7bd4f05170847e8f02e988d320` (0/0)
Commit funcional: `09f83a9e8595d189c424de2a37f4a83f5fe2c5d1`

## Alcance entregado

- El cliente puede solicitar cambios de nombre, documento y teléfono desde
  `/portal/perfil`.
- El cupo compartido se limita atómicamente a tres cambios efectivos de datos
  o reemplazos de foto de cédula durante la vida de la cuenta.
- La primera carga cuando no existe foto no consume cupo; rechazo o cancelación
  libera la reserva; una solicitud pendiente impide duplicados.
- Las direcciones permanecen fuera del cupo: se pueden agregar y editar siempre.
- Se añadieron contratos unitarios, de UI y SQL, además de la documentación
  SDD y de privacidad aplicable a las fotos históricas.

## Rutas propias

- `app/portal/(app)/perfil/`: controles de perfil, foto, direcciones, acciones y
  pruebas.
- `lib/portal/profile-edit-quota.ts` y su prueba.
- `supabase/migrations/0445_portal_profile_edit_limit.sql` y
  `supabase/tests/0445_portal_profile_edit_limit.test.sql`.
- `docs/specs/0435-portal-cliente-edicion-de-perfil/`, índice SDD y documentos
  de `docs/legal/privacidad/`.
- Este handoff.

## Evidencia local

- Vitest: 5.882/5.882 pruebas en 500 archivos; focalizadas: 15/15.
- SQL: 140/140 contratos; reconstrucción: 378 migraciones aplicables y 219
  tablas con aislamiento multi-tenant verde.
- TypeScript, lint (0 errores; 8 advertencias preexistentes), Edge Functions,
  documentación, numeración, componentes, gobernanza y build: verdes.
- `verify.mjs`: 14/15. Playwright ejecutó un pase completo con 135 aprobadas,
  18 omitidas por seed y 15 fallidas de login/proxy porque esta worktree no
  contiene `NEXT_PUBLIC_SUPABASE_URL` ni `NEXT_PUBLIC_SUPABASE_ANON_KEY`. El
  reintento reprodujo la misma condición y se interrumpió al quedar WebKit
  colgado durante el cierre.
- `migrations-applied` local se omitió por ausencia deliberada de credenciales;
  la migración se verificó directamente en Cloud durante esta tarea.

## Evidencia Cloud

- `0445_portal_profile_edit_limit` aplicada con autorización nombrada.
- Ledger Cloud: `20260904193612`.
- SHA-256 del archivo local:
  `5A256A83E1E8C056D7AAE7EA6A22D39607D60B8C329683C6EE2AEA9557EACD4B`.
- Backfill: cuatro solicitudes de cuatro clientes, sin clientes sobre el límite.
- RLS activa; ledger sin grants directos; RPC disponibles sólo a
  `authenticated`, con `SECURITY DEFINER` y `search_path` vacío.
- No se autorizó ni ejecutó deploy de aplicación.

## Gates que siguen abiertos

1. UAT autenticado obligatorio con una cuenta empresarial real expresamente
   aprobada. Hace falta identificar Shipping Mark/cuenta y autorizar la mutación
   porque una aprobación consume cupo permanente.
2. Revisión e integración del PR hacia `main`; esta tarea no fusiona su propia
   rama.
3. La política propuesta de fotos históricas no está activa hasta implementar
   gate regional, purga, flujo verificable de eliminación y revisión legal del
   tratamiento Venezuela↔China. La propuesta fija máximo 30 días para fotos
   sustituidas y cero acceso desde China mientras ese control no exista.

## Concurrencia preservada

- El checkout principal y las worktrees `codex-analytics-privacy`,
  `codex-saneamiento-integral` y `push-endpoint-hardening` pertenecen a otras
  tareas y no fueron modificados, fusionados ni limpiados.
- No se usó `stash`, `reset`, `restore`, `clean`, `pull`, `rebase` ni staging
  amplio.

## Publicación y siguiente responsable

El cierre publica `origin/portalcliente` y abre un único PR con base `main`; la
URL y el hash remoto se validan en el recibo final de la tarea. Para evitar que
un PR equivalga a autorización de deploy, este handoff queda como último commit
sólo documental. Al integrar, usar squash o asegurar que el commit resultante
toque código para que `vercel.json` no omita accidentalmente el deploy que se
autorice en otro gate.

Siguiente responsable: reviewer/integrador del PR; founder para designar y
autorizar la cuenta empresarial del UAT.
