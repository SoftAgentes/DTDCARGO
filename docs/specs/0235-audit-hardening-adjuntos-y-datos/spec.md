---
sdd: "0235"
title: "Cierre de auditoría de seguridad, datos y adjuntos"
status: approved
author: "Sam (founder) + Codex"
created: 2026-08-01
updated: 2026-08-01
supersedes: null
superseded_by: null
related: ["0224"]
confidencialidad: interno
---

# SDD-0235 · Cierre de auditoría de seguridad, datos y adjuntos

## Aprobación y alcance

Sam autorizó el 2026-08-01 avanzar sin nuevas preguntas con el trabajo pendiente
de las auditorías `AUDIT-2026-07-31.md` y
`AUDITORIA-capa-datos-rls-storage.md`. Esta aprobación cubre cambios locales,
pruebas y commits atómicos dentro de la allowlist cerrada.

No sustituye los gates que requieren un recurso externo inexistente o una
acción irreversible: cada migration de Supabase Cloud se aplica únicamente con
autorización que nombre su basename exacto; contratar/configurar proveedor de
Object Lock o antivirus requiere una cuenta y credenciales reales; publicar a
`main` requiere la orden `cerrar` según el runbook vigente.

## Objetivo

Cerrar los hallazgos verificables sin rediseñar el ERP ni relajar controles:

1. vincular el PIN de operario a tenant y región, limitar intentos y no guardar
   IP en claro;
2. reducir y limitar el RPC público de tracking;
3. retirar grants públicos de funciones internas, reforzar el avance del
   camionero y corregir el alcance tenant de `user_profiles`;
4. exigir sesión y permisos en acciones y APIs internas;
5. eliminar enumeración de cuentas en el acceso al portal;
6. serializar JSON-LD sin permitir cierre de etiqueta `script`;
7. dejar la captura rrweb apagada por defecto y exigir habilitación explícita;
8. impedir que el piloto de adjuntos se declare listo sin antivirus, Object
   Lock y restore byte-idéntico demostrados;
9. documentar el runbook de respaldo/restauración y los gates externos;
10. añadir pruebas de regresión antes de cualquier rollout.

## Decisiones

- Los cambios SQL serán aditivos o reemplazarán policies/funciones mediante
  migration forward; no habrá `DROP TABLE`, truncados ni borrado de objetos.
- El login móvil resolverá el tenant operativo del servidor y lo entregará al
  RPC junto con la región. Si el despliegue deja de ser mono-tenant, el login
  falla cerrado hasta introducir una selección de tenant gobernada.
- El límite del PIN usa una huella SHA-256 derivada de la IP por el servidor;
  no persiste la IP cruda ni la expone al cliente.
- El RPC público de tracking conserva la forma de respuesta necesaria, pero no
  devuelve nombre de firmante ni notas libres y limita por origen y código.
- Las funciones de sincronización invocadas por triggers no tendrán `EXECUTE`
  para `PUBLIC`, `anon` ni `authenticated`.
- Un camionero solo avanza la orden que le fue asignada; supervisor conserva el
  bypass operativo explícito.
- `user_profiles` permite la fila propia o perfiles de usuarios con membresía
  activa en un tenant compartido.
- El acceso mágico del portal responde de forma indistinguible para correos
  válidos, inexistentes, bloqueados o con proveedor temporalmente indisponible.
- rrweb no se inicia automáticamente en producción. Una habilitación futura
  requiere aviso visible, decisión de retención y validación de privacidad.
- El estado `protegido` de un adjunto exige evidencia de scanner limpio,
  checksum externo, Object Lock y restore verificado; una configuración o
  variable declarativa no basta.

## Orden de salida

1. documentación, allowlist y tests de regresión;
2. migrations locales y código de aplicación;
3. typecheck, lint, unitarios, SQL, build y verificación canónica;
4. revisión de datos personales con estados `ENCONTRADO`, `CORRECTO` o
   `NO VERIFICABLE`;
5. commits atómicos selectivos;
6. preflight y aplicación Cloud, de una migration por vez, solo con gate
   nominal;
7. proveedor externo, scanner y restore drill con evidencia real;
8. publicación únicamente al recibir `cerrar`.

## Allowlist cerrada

### Documentación

- `docs/specs/0235-audit-hardening-adjuntos-y-datos/spec.md`
- `docs/specs/0235-audit-hardening-adjuntos-y-datos/allowlist.md`
- `docs/runbooks/adjuntos-backup-antivirus-restore.md`
- `docs/legal/privacidad/registro-tratamiento.md`
- `docs/legal/privacidad/mapa-de-borrado.md`
- `docs/legal/privacidad/evaluacion-proveedor-respaldo-externo.md`

### Aplicación

- `lib/auth/operario-session.ts`
- `app/m/cn/login/actions.ts`
- `app/m/ve/login/actions.ts`
- `app/studio/(app)/_actions/deployActions.ts`
- `app/studio/(app)/ve/actions.ts`
- `app/api/studio/shipments/[id]/route.ts`
- `app/api/studio/kpis/route.ts`
- `app/api/studio/conversaciones/[id]/route.ts`
- `app/portal/(auth)/login/actions.ts`
- `lib/public/json-ld.ts`
- `app/noticias/[slug]/_components/NewsArticleJsonLd.tsx`
- `app/noticias/[slug]/_components/FaqPageJsonLd.tsx`
- `app/studio/_components/bug-reporter/BugTechCaptureProvider.tsx`
- `lib/studio/bug-rrweb-capture.ts`
- `lib/studio/attachments/pilot-gate.ts`
- `app/api/cron/purge-throttle/route.ts`
- `.env.example`

### Base de datos

- `supabase/migrations/0325_operario_pin_login_hardening.sql`
- `supabase/migrations/0326_public_tracking_privacy_throttle.sql`
- `supabase/migrations/0327_internal_function_grants.sql`
- `supabase/migrations/0328_camionero_dispatch_assignment.sql`
- `supabase/migrations/0329_user_profiles_tenant_scope.sql`

### Pruebas

- `lib/auth/__tests__/operario-session.test.ts`
- `app/studio/(app)/_actions/__tests__/deployActions.test.ts`
- `app/studio/(app)/ve/__tests__/actions-auth.test.ts`
- `app/api/studio/__tests__/route-auth.test.ts`
- `app/portal/(auth)/login/__tests__/actions.test.ts`
- `lib/public/__tests__/json-ld.test.ts`
- `lib/studio/__tests__/bug-rrweb-capture.test.ts`
- `lib/studio/rbac-actions-guard.test.ts`
- `lib/studio/attachments/__tests__/pilot-gate.test.ts`
- `app/api/cron/purge-throttle/__tests__/route.test.ts`
- `supabase/tests/0325_operario_pin_login_hardening.test.sql`
- `supabase/tests/0326_public_tracking_privacy_throttle.test.sql`
- `supabase/tests/0327_internal_function_grants.test.sql`
- `supabase/tests/0328_camionero_dispatch_assignment.test.sql`
- `supabase/tests/0329_user_profiles_tenant_scope.test.sql`

`docs/specs/README.md` es generado y se regenerará al integrar; no se modifica
en este carril porque otra ventana mantiene ownership activo sobre ese archivo.

## Exclusiones explícitas

- `package.json`, `pnpm-lock.yaml`, `scripts/verify.mjs`, `AGENTS.md` y
  `docs/specs/README.md`, actualmente bajo ownership de otros carriles;
- cambios visuales, textos legales definitivos o captura de nuevas categorías;
- lectura de PII productiva;
- aplicación Cloud, Vercel, Object Lock, antivirus o push sin su gate real.

## Criterios de aceptación

- Los tests nuevos fallan con el comportamiento vulnerable y pasan con el fix.
- No existe login móvil cross-region ni cross-tenant en el despliegue actual.
- El PIN queda bloqueado temporalmente ante abuso sin almacenar IP en claro.
- Tracking público no expone POD, notas libres ni permite inserción directa del
  log; el throttle y su purga tienen tests.
- Las APIs internas responden `401` sin sesión y las mutaciones sensibles
  validan permiso de módulo.
- No se puede distinguir por la respuesta del portal si una cuenta existe.
- JSON-LD convierte `<` a `\\u003c`.
- rrweb permanece inactivo si el flag explícito no está habilitado.
- El piloto de adjuntos permanece `off` hasta demostrar AV, respaldo inmutable
  y restore con checksum idéntico.
- `pnpm typecheck`, `pnpm lint`, pruebas unitarias y SQL, `pnpm build` y
  `node scripts/verify.mjs` quedan verdes o con bloqueo externo documentado.

## Rollback

- apagar flags y workers;
- revertir código mediante commit inverso selectivo;
- corregir SQL con migration forward, nunca restaurar grants o policies
  vulnerables;
- conservar logs, estados de cuarentena, outboxes y objetos;
- no borrar evidencia ni relajar fail-closed como mecanismo de recuperación.
