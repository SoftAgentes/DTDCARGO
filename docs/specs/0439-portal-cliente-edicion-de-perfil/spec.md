---
sdd: "0439"
title: "Portal cliente — edición controlada y contención de fotos de identidad"
status: in-progress
author: "Codex + founder"
created: 2026-09-04
updated: 2026-09-06
supersedes: null
superseded_by: null
related: ["0138", "0145", "0151", "0186", "0191", "0268"]
confidencialidad: interna
---

# SDD-0439 · Edición controlada del perfil del cliente

## Pedido y lectura del contrato

El cliente puede corregir sus datos y reemplazar la foto de su cédula/RIF desde
`/portal/perfil` hasta **tres veces**. Sus direcciones de entrega no consumen ese
cupo: puede agregar nuevas y editar las existentes siempre.

La implementación conserva la aprobación humana introducida por SDD-0151. Un
cambio de nombre, cédula/RIF o teléfono se propone en el portal y cuenta como
efectivo sólo cuando el asesor lo aprueba. La solicitud pendiente reserva un
cupo para impedir carreras; si el cliente la cancela o el asesor la rechaza, el
cupo vuelve a quedar disponible.

### Decisiones explícitas

- El límite es **compartido** entre cambios de datos aprobados y reemplazos de
  la foto de identidad.
- La primera carga de una foto faltante completa el expediente y no consume
  cupo; cada reemplazo posterior sí consume uno.
- Email, Shipping Mark y avatar cosmético permanecen fuera de esta edición.
- La migración histórica 0445 conserva la foto de identidad reemplazada y su
  ruta en un ledger restringido. Como todavía no existen purga gobernada, hold
  y control regional, 0447 bloquea nuevos reemplazos de forma fail-closed.
- Los tres cambios son un límite de negocio de por vida. No existe bypass en la
  UI ni escritura directa a `clients` desde el portal.

## Estado encontrado

| Capacidad | Estado antes de este SDD |
|---|---|
| Proponer nombre, documento y teléfono | Ya existe con aprobación del asesor, sin límite acumulado. |
| Reemplazar foto de cédula/RIF | El backend lo permite, pero la UI sólo muestra “Ver” cuando ya existe; además borra la foto anterior. |
| Agregar, predeterminar y eliminar direcciones | Ya existe. |
| Editar una dirección | La server action existe, pero no hay botón ni formulario que la invoque. |

## Contrato funcional

1. El portal muestra `N de 3 cambios disponibles` junto al editor de datos y a
   la foto de identidad.
2. Enviar una solicitud pendiente reserva un cupo atómicamente en PostgreSQL.
3. Aprobarla convierte la reserva en cambio aplicado; rechazarla o cancelarla la
   libera.
4. Reemplazar una foto existente permanece deshabilitado en UI y base de datos
   hasta demostrar purga, hold y control regional. El cliente conserva un
   enlace a soporte para tramitar la corrección.
5. Cuando no queda cupo, servidor y UI bloquean nuevas solicitudes de datos con
   un mensaje que conduce a soporte.
6. La primera foto, si falta, se puede cargar incluso con cupo agotado porque no
   es un reemplazo.
7. Cada dirección muestra “Editar”; el formulario sale prellenado, valida los
   mismos campos que el alta y guarda por la action/RLS ya existentes.
8. Agregar y editar direcciones nunca consultan ni alteran el cupo de perfil.

## Persistencia y seguridad

La migración histórica 0445 crea `client_profile_edits`, un ledger sin grants directos
para `anon`, `authenticated` ni `service_role`. Su trigger `SECURITY DEFINER`
serializa por fila de `clients`, de modo que dos solicitudes simultáneas no
pueden superar el límite. El portal sólo recibe totales agregados mediante una
RPC estrecha.

La sustitución de foto usa otra RPC `SECURITY DEFINER` que:

- resuelve el cliente exclusivamente con `auth.uid()` y
  `get_portal_client_id()`;
- valida que el objeto exista en el bucket privado `client-docs` y dentro del
  prefijo del cliente;
- registra la ruta anterior y la nueva sólo en el ledger restringido;
- actualiza `clients.cedula_photo_path` y consume el cupo en una transacción;
- escribe auditoría canónica sin copiar nombre, documento, teléfono ni rutas al
  payload de auditoría.

La migración 0447 agrega un trigger previo sobre el ledger: una primera carga no
crea una fila `identity_photo` y sigue disponible, pero un reemplazo intenta
crear esa fila y se rechaza dentro de la misma transacción antes de mover el
puntero. El Portal repite el guard antes del upload para evitar crear objetos
que dependan de rollback. Si una carrera o fallo ocurre después de subir, la
action distingue rechazo SQL explícito de respuesta incierta. Ante error vuelve
a resolver el cliente de sesión y lee únicamente el puntero/tenant/prefijo y
estado retirado de esa cuenta. Si confirma el mismo objeto conserva la carga;
si no puede reconciliar conserva y deriva a soporte sin anunciar éxito. Un
puntero vacío tras pérdida de respuesta no prueba rollback: el commit puede
seguir en vuelo. Sólo un rechazo SQL exacto conocido con respuesta HTTP 4xx,
identidad/tenant/prefijo estables y puntero distinto habilita retirar el objeto
nuevo de esta invocación. Se comprueba `Storage.remove()` y también su excepción;
no se anuncia éxito si la compensación falla. No se repite la RPC de escritura.

Las solicitudes históricas aprobadas por el cliente se contabilizan. Los
reemplazos de foto anteriores a 0445 no pueden reconstruirse con certeza y no se
inventan. 0445 no se renumera ni se reescribe porque ya fue aplicada; este SDD
fue renumerado desde 0435 a 0439 para resolver la colisión con otra rama.

## Datos personales · revisión VE/CN

| Estado | Evidencia |
|---|---|
| ENCONTRADO | Nombre, documento, teléfono, foto de identidad y direcciones son datos personales; la foto/documento exige acceso restringido y trazabilidad. |
| CORRECTO | Storage privado, URL firmada de 60 segundos, validación server-side, aislamiento por sesión/RLS, ledger no expuesto y auditoría sin valores PII. |
| CORRECTO | La rectificación de datos existe, pero mantiene aprobación humana para identidad documentada. |
| CORRECTO | 0447 y la UI contienen nuevos reemplazos: no crean otra versión histórica mientras falten los controles de disposición y acceso. |
| ENCONTRADO | La directiva propuesta `docs/legal/privacidad/fotos-identidad-cliente-v1.md` fija históricos por máximo 30 días, borrado integral solicitado y cero acceso China, pero aún no está activa. |
| ENCONTRADO | La policy vigente de `client-docs` no distingue VE de CN y no existe purga; la contención no se presenta como implementación de esos controles. |
| NO VERIFICABLE | Fundamento por categoría, holds reales, contratos y eliminación en copias de proveedor requieren validación humana/profesional. |

Esta revisión técnica no constituye asesoría legal.

## Gobernanza

| Política | Clasificación | Aplicación |
|---|---|---|
| SGE-00 | cumplimiento | El límite vive en servidor/DB; se informa estado y siguiente paso. |
| AUD-01 / AUD-02 | cumplimiento | Reserva, aplicación y liberación dejan eventos estructurados sin PII; el reemplazo contenido no deja éxito falso. |
| FRM-01 / ERR-01 / LOD-01 | cumplimiento | Labels persistentes, errores próximos al campo y estados pendientes. |
| UPL-01 | cumplimiento | Tipo, tamaño, propósito y privacidad se explican; un reemplazo bloqueado no inicia upload. |
| A11Y-01 / BTN-01 | cumplimiento | Controles con nombre accesible, foco y área táctil mínima. |
| MP-01 | no conformidad contenida | Falta disposición gobernada de históricos; 0447 impide ampliar el inventario hasta cerrar ese control. |

## Allowlist exacta

- `docs/specs/0439-portal-cliente-edicion-de-perfil/spec.md`
- `docs/specs/README.md` (generado)
- `docs/legal/privacidad/fotos-identidad-cliente-v1.md`
- `docs/legal/privacidad/revision-0445-2026-09-04.md`
- `docs/legal/privacidad/README.md`
- `docs/legal/privacidad/registro-tratamiento.md`
- `docs/legal/privacidad/mapa-de-borrado.md`
- `docs/legal/privacidad/inventario-terceros.md`
- `.agents/handoffs/2026-09-04-portalcliente-close.md`
- `supabase/migrations/0445_portal_profile_edit_limit.sql`
- `supabase/tests/0445_portal_profile_edit_limit.test.sql`
- `supabase/migrations/0447_identity_photo_replacement_privacy_gate.sql`
- `supabase/tests/0447_identity_photo_replacement_privacy_gate.test.sql`
- `lib/portal/profile-edit-quota.ts`
- `lib/portal/__tests__/profile-edit-quota.test.ts`
- `app/portal/(app)/perfil/page.tsx`
- `app/portal/(app)/perfil/actions.ts`
- `app/portal/(app)/perfil/DataChangeEditor.tsx`
- `app/portal/(app)/perfil/CedulaPhotoRow.tsx`
- `app/portal/(app)/perfil/PortalAddresses.tsx`
- `app/portal/(app)/perfil/PortalAddresses.test.tsx`
- `app/portal/(app)/perfil/ProfileEditControls.test.tsx`
- `app/portal/(app)/perfil/IdentityPhotoAction.test.ts`
- `.agents/handoffs/pr27-identity-photo-uncertain-response-20260906.md`

### Corrección aislada · respuesta perdida (2026-09-06)

Base PR27 `82fc49ff`; SDD permanece in-progress. Se conserva el bloqueo0447,
cuota y primera carga. RED sobre actions base: 14 fallos/7 aprobados incluyendo
commit con respuesta perdida que dejaba puntero sin objeto. GREEN inicial:
21/21 con SDK Supabase real 2.106.1, helper upload real y transporte offline.
El test simula commit y respuesta por separado; no demuestra comportamiento
de una base real ni aplica migraciones. Reconciliación fallida, fila retirada,
tenant/prefijo/cuenta cambiados, puntero concurrente y commit posterior a lectura
nula conservan el archivo. Cleanup fallido comunica soporte sin éxito falso.
Final: 27/27 (24 identidad + 3 cuota), TypeScript, ESLint focal, docs:check,
governance:check y components:check PASÓ. Código d7717861 enviado a revisión
independiente, favorable con 14 escenarios propios SDK/offline y sin nuevos
bloqueos; detalle y límites en handoff. Falta validación combinada coordinada
por Director. Sin push, build/verify masivo ni Cloud.

## Fuera de alcance

- Cambio de email o de Shipping Mark.
- Edición directa sin aprobación del asesor.
- Edición del avatar cosmético dentro del cupo.
- Desplegar o publicar el código.
- Crear o modificar datos reales de clientes.

## Verificación exigida

- Pruebas unitarias del cálculo/mapeo del cupo.
- Pruebas de UI para bloqueo, reemplazo de foto y edición prellenada de dirección.
- Contrato SQL desechable: límite atómico, liberación por rechazo/cancelación,
  primera foto gratis, reemplazo contenido, ACL/RPC y aislamiento.
- `pnpm docs:check`, `pnpm typecheck`, `pnpm lint`, pruebas focalizadas,
  `pnpm governance:check`, `pnpm components:check` y `node scripts/verify.mjs`.

### Resultado local

- 17/17 pruebas focalizadas pasaron; la suite Vitest completa pasó con 5.884
  pruebas en 501 archivos.
- 141/141 contratos SQL pasaron y el esquema se reconstruyó desde cero con las
  379 migraciones aplicables; aislamiento multi-tenant: verde.
- Lint (0 errores), TypeScript, Edge Functions, documentación, numeración,
  componentes, gobernanza y build de producción: verdes.
- La verificación integral terminó 14/15: Playwright global quedó rojo porque el
  worktree no contiene `NEXT_PUBLIC_SUPABASE_URL` ni
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`; 135 E2E públicos pasaron, 18 dependientes de
  seed quedaron omitidos y 15 de login/proxy fallaron por ese entorno. El
  reintento automático reprodujo el fallo y se detuvo al quedar WebKit colgado
  durante el cierre. `migrations-applied` también quedó omitido por falta
  deliberada de credenciales Cloud.

### Resultado Cloud

- `0445_portal_profile_edit_limit` aplicada el 2026-09-04 con ledger
  `20260904193612` y SHA-256 local
  `5A256A83E1E8C056D7AAE7EA6A22D39607D60B8C329683C6EE2AEA9557EACD4B`.
- Backfill: 4 solicitudes de 4 clientes; cero clientes quedaron sobre el límite.
- RLS activa, sin grants directos al ledger; las dos RPC quedan ejecutables solo
  por `authenticated`, con `SECURITY DEFINER` y `search_path` vacío.
- `0447_identity_photo_replacement_privacy_gate` no está aplicada a Cloud: este
  documento no presenta la contención como activa en Producción.
- UAT autenticado permanece pendiente: el código del Portal no se despliega
  hasta `cerrar` y falta identificar la cuenta empresarial y las mutaciones
  aprobadas.
