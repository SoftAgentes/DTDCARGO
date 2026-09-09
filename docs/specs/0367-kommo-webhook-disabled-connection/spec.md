---
sdd: "0367"
title: "Webhook Kommo: respetar desactivación sin romper recuperación de error"
status: in-progress
author: "Codex"
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related: ["0043", "0244", "0288"]
confidencialidad: interno
---

# SDD-0367 — La desactivación de Kommo no se revierte por un webhook

## Objetivo y evidencia

Correctivo local del checklist de saneamiento, dentro de la tarea de seguridad
Kommo. Base: f761c278. `pnpm sdd:next` consultó 15 refs y asignó 0367;
sin reserva publicada, sin migración nueva y sin permiso de deploy.

El handler lee `kommo_connections.status`, pero procesa cualquier valor y al
terminar escribe `active`. Eso incluye `disabled`, estado permitido por 0082.
La propuesta inicial de bloquear todo lo distinto de active sería una regresión:
[SDD-0043](../0043-kommo-conexion/spec.md), Alcance B, exige recuperación de
`error` tras un webhook exitoso. Esta spec conserva ese contrato.

## Contrato verificable

1. Tras autenticar y resolver la conexión, sólo `active` o `error` admiten
   procesamiento. `disabled`, valores desconocidos o ausentes devuelven HTTP200
   con motivo genérico de omisión, antes de Vault, Kommo y mutaciones de negocio.
2. Un evento rechazado no cambia espejo, mensajes, outbox, sync_logs o conexión.
   No añade datos personales a la respuesta ni modifica el diagnóstico previo
   del parser. La falta de conexión y los errores de lookup conservan su contrato.
3. `active` sigue procesando entidades y mensajes. `error` sigue recuperándose
   a active tras éxito; no se agrega un reset manual obligatorio.
4. El update final sólo puede afectar la conexión y tenant resueltos si su estado
   ACTUAL sigue en active/error. Una desactivación durante el request gana:
   se conservan disabled y last_error, sin reactivar la integración.
5. No se promete cancelar retroactivamente un request ya admitido: sus efectos
   iniciados pueden terminar. El control de admisión y el de reactivación son
   dos límites explícitos; una cancelación distribuida requeriría otro diseño.
6. Auth por secret, parser, orden entidad→mensaje, lógica de router, ACL/RLS,
   retención, contratos con terceros y otras tres Edge Functions no se cambian.

## Diseño, estructura y allowlist exacta

Usar el patrón de guard/return del handler existente, sin refactor transversal,
helper compartido nuevo ni dependencia nueva. Guard antes de kommo_get_token;
predicado de estado/tenant en el update final. La función sigue registrada
mediante Deno.serve. No se ejecuta el handler contra un proyecto alojado.

Rutas propias autorizadas para este incremento:

- `supabase/functions/kommo-webhook/index.ts`
- `supabase/functions/_shared/__tests__/webhook-connection-state.test.ts`
- `docs/specs/0367-kommo-webhook-disabled-connection/spec.md`
- `docs/specs/README.md` (sólo generación canónica)
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Pruebas y comandos

Vitest ejecuta el handler real con fronteras externas simuladas y datos
sintéticos; los parsers y helpers puros se conservan reales. No basta buscar
un if por regex. Reproducir primero el fallo sobre la base intacta.

```powershell
pnpm.cmd test supabase/functions/_shared/__tests__/webhook-connection-state.test.ts --reporter=dot
pnpm.cmd test --reporter=dot
pnpm.cmd edge:check
pnpm.cmd docs:index
pnpm.cmd docs:check
pnpm.cmd sdd:check
pnpm.cmd governance:check
pnpm.cmd components:check
git diff --check
```

Cobertura: disabled/estado desconocido/null; active/error positivos; cambio
concurrente a disabled; autenticación negativa; lookup fallido; conexión/token
ausentes; procesamiento de entidades/mensajes. Deno comprueba las cuatro
entradas; un SKIP no se considera verde. No se cambia SQL, por lo que las
pruebas SQL anteriores no se presentan como una verificación nueva de esta pieza.

## Gobernanza del alcance

Clasificación: control de estado de integración P1/R2; no purga, no UI nueva.
Registro maestro y políticas SGE-00, MP-01, BTN-01, AUD-01/AUD-02 consultados.

| Principio | Clasificación del alcance y evidencia de aceptación |
|---|---|
| SGE-00.01 | cumplimiento: disabled conserva el significado de desactivación. |
| SGE-00.02 | cumplimiento: no borra expedientes y preserva recuperación de error. |
| SGE-00.03 | cumplimiento: control backend P1/R2, sin operación destructiva nueva. |
| SGE-00.04 | no aplica a mutación nueva: el rechazo no muta; se conservan logs existentes, sin certificar el sistema de auditoría entero. |
| SGE-00.05 | cumplimiento: prueba negativa del estado bloqueado y filtro por tenant/id al finalizar. |
| SGE-00.06 | cumplimiento: guard antes de Vault y efectos; prueba negativa. |
| SGE-00.07 | cumplimiento: respuesta ignored explícita; no revive disabled en una carrera. |
| SGE-00.08 | no aplica: sin pasos de interfaz nuevos. |
| SGE-00.09 | cumplimiento: reutiliza guard y query filtrada existentes, sin primitiva. |
| SGE-00.10 | no aplica: no cambia interfaz visual ni teclado. |
| SGE-00.11 | cumplimiento: motivo fijo sin datos personales ni estado arbitrario. |
| SGE-00.12 | cumplimiento: no ejecuta acciones alojadas sin autorización nominal. |

MP-01: conserva conexión e historia, respeta desactivación P1. BTN-01: no aplica
a botones, ninguno cambiado. AUD-01/AUD-02: no se crea un canal nuevo de log,
exportación o captura; la prueba verifica ausencia de mutaciones al rechazar.
El rechazo HTTP no se presenta como un evento de auditoría durable.

## Privacidad: revisión técnica acotada

Método revisar-datos-ve, aplicado sólo al flujo afectado por el guard; no es una
auditoría nueva de toda la empresa. Marco documental del proyecto: Venezuela y
operación en China; alcance real de accesos y transferencias no verificado.
Referencias consultadas: checklist-datos-ve.md, marco-legal-ve.md y
marco-legal-cn-pipl.md de esa skill. No se interpreta la revisión como GO legal.

**Resumen de los doce puntos:** 1 ENCONTRADO, 2 CORRECTO y 9 NO VERIFICABLE,
siempre dentro de este delta. No se agregan campos, destinatarios, buckets ni
finalidades. El correctivo reduce procesamiento sobre disabled.

### Inventario del flujo existente

Abreviaturas: L = kommo_leads; C = kommo_contacts; H =
supabase/functions/kommo-webhook/index.ts; M =
supabase/functions/_shared/kommo-mapping.ts. NV = NO VERIFICABLE en esta revisión.
Los roles/personas efectivamente autorizados y la ubicación de proveedores
requieren evidencia operativa; la tabla sólo identifica destinos en el código.

| Tabla.campo | Qué es / finalidad observada | Base de licitud | Retención | Quién más lo ve / evidencia |
|---|---|---|---|---|
| L.id | ID CRM, sincronización/vínculo | NV | NV | Kommo y espejo Supabase; M:45 |
| L.name | Nombre de oportunidad, espejo CRM | NV | NV | Kommo y Supabase; M:46 |
| L.price | Importe asociado a oportunidad | NV | NV | Kommo y Supabase; M:49 |
| L.responsible_user_id | ID del responsable CRM | NV | NV | Kommo y Supabase; M:50 |
| L.kommo_created_at | Alta de la oportunidad | NV | NV | Kommo y Supabase; M:51 |
| L.kommo_updated_at | Control de sincronización | NV | NV | Kommo y Supabase; M:52 |
| L.closed_at | Cierre de oportunidad | NV | NV | Kommo y Supabase; M:53 |
| L.custom_fields | Array abierto; finalidad de cada campo no evidente | NV | NV | Kommo y Supabase; M:54 |
| C.id | ID de contacto, sincronización/vínculo | NV | NV | Kommo y Supabase; M:104 |
| C.name | Nombre del contacto | NV | NV | Kommo y Supabase; M:105 |
| C.responsible_user_id | ID del responsable CRM | NV | NV | Kommo y Supabase; M:106 |
| C.kommo_created_at | Alta del contacto | NV | NV | Kommo y Supabase; M:107 |
| C.kommo_updated_at | Control de sincronización | NV | NV | Kommo y Supabase; M:108 |
| C.custom_fields | Array abierto; finalidad de cada campo no evidente | NV | NV | Kommo y Supabase; M:109 |
| C.email | Correo extraído del campo CRM EMAIL | NV | NV | Kommo y Supabase; M:110 |
| C.phone | Teléfono extraído del campo CRM PHONE | NV | NV | Kommo y Supabase; M:111 |
| C.phone_last10 | Clave derivada de cruce telefónico | NV | NV | Supabase; migración0363_kommo_contacts_telefono.sql:42 |
| clients.id | Identidad interna del cliente | NV | NV | Router; H:122 |
| clients.markbox | Shipping Mark, vinculación y retorno al CRM | NV | NV | Supabase, outbox, Kommo; H:122 y H:206 |
| clients.kommo_contact_id | Vínculo de cliente con contacto | NV | NV | Router; H:122 |
| clients.phone | Cruce telefónico del cliente | NV | NV | Router; H:122 |
| L.last_inbound_at | Fecha de último mensaje entrante | NV | NV | Supabase mediante RPC; H:487 |
| L.last_outbound_at | Fecha de último mensaje saliente | NV | NV | Supabase mediante RPC; H:487 |
| L.last_message_origin | Canal del mensaje | NV | NV | Supabase mediante RPC; H:487 |

El esquema fuente está en 0082_kommo_mirror_schema.sql; correo/teléfono en
0363_kommo_contacts_telefono.sql y fechas/canal en0391_kommo_leads_ultimo_mensaje.sql.
No hay formulario ni bucket nuevo. El flujo une estos campos a tenant e IDs;
no se presupone que un contacto tenga cuenta de usuario. El contenido real de
custom_fields, incluidos posibles datos sensibles, no se leyó.

### Hallazgos y límites de los doce puntos

| Punto | Estado | Evidencia y límite |
|---|---|---|
| 1. Inventario | ENCONTRADO | M:54 y M:109 copian arrays abiertos; categorías/finalidad de cada campo no evidentes. Residuo heredado: clasificar campos autorizados antes de diseñar minimización, sin borrado masivo. |
| 2. Minimización | CORRECTO | H:423 corta antes de Vault y mutaciones; test:201 prueba estados rechazados. Sólo esta reducción, no todo el espejo. |
| 3. Consentimiento | NO VERIFICABLE | H:427 usa una credencial de integración, no evidencia consentimiento del titular. No se revisaron expedientes ni contratos. |
| 4. Derechos reales | NO VERIFICABLE | H:326 implementa recepción de eventos, no un flujo de solicitudes; no se auditó otro módulo. |
| 5. Borrado efectivo | NO VERIFICABLE | H:259 conserva el delete del espejo; no demuestra purga en logs, backups, colas o terceros. Test:211 sólo prueba que disabled no elimina. |
| 6. Solicitudes trazables | NO VERIFICABLE | H:458 conserva sync_logs técnicos, no demuestra registro de solicitudes de personas. |
| 7. Política pública | NO VERIFICABLE | H:326 no contiene aceptación ni texto público; no se revalida una política desde este handler. |
| 8. Terceros | NO VERIFICABLE | H:293/H:302 y H:427 muestran Kommo/Supabase; contratos, ubicación y usuarios reales no inspeccionados. |
| 9. Transferencias | NO VERIFICABLE | H:435 construye endpoint Kommo; no acredita ubicación efectiva, aviso ni mecanismo jurídico. |
| 10. Automatización | NO VERIFICABLE | H:176 conserva decideRoute; explicación/revisión humana fuera del delta. No se crea una decisión nueva sobre personas. |
| 11. Aceptación electrónica | CORRECTO | H:424 sólo responde ignored; no crea firma, aceptación ni afirmación de valor probatorio. No evalúa contratos existentes. |
| 12. Titulares sin cuenta | NO VERIFICABLE | M:104 identifica contactos CRM sin exigir user_id; no se comprobó el aviso recibido por personas reales. |

La prueba usa datos sintéticos y fronteras I/O simuladas: no se creó ni borró
ningún registro alojado. Faltan, fuera de este cambio, evidencia operativa de
consentimiento, retención, accesos, transferencias y contratos. Redacción legal y
base de licitud corresponden a revisión jurídica, no a este correctivo.
La revisión independiente técnica no reemplaza una segunda auditoría de
privacidad por otro modelo/profesional. **Esto no es asesoría legal.**

## Plan de ejecución y cierre

Primero prueba RED independiente; después guard y update condicionado; luego
GREEN, suite unitaria, Deno y revisión independiente; finalmente evidencia,
checklist y commit selectivo. Sólo entonces solicitar publicación de la rama.

Fuera de autorización: push del lote rechazado, integración main, deploy Edge,
configuración Kommo/secret, lectura de negocio, migraciones y llamadas de prueba
al endpoint alojado. No se ejecuta ni siquiera dry-run remoto.

### Evidencia ejecutada · cierre local

- RED independiente sobre index.ts intacto: 9 fallos causales,16 controles
  aprobados. Demuestra procesamiento de disabled y reactivación concurrente.
- GREEN del handler real:25/25; parser, mapping y router reales, I/O simulada.
  El primer intento en sandbox no llegó a los tests por acceso al enlace de
  Vite; con acceso al almacén pnpm pasó, sin reinstalar dependencias.
- Suite completa: **6.441 tests / 538 archivos**, exit0,109,13 s.
  Conserva avisos de act(), navegación jsdom y logs de escenarios simulados;
  no hubo casos fallidos ni se ocultaron avisos.
- Deno:4/4 entradas compilan, sin SKIP, usando --no-lock y
  --node-modules-dir=none. No ejecuta handlers ni conecta al proyecto alojado.
- TypeScript del test, fuera del alcance de Deno: tsc --noEmit --target es2022
  --module esnext --moduleResolution bundler --esModuleInterop --skipLibCheck
  supabase/functions/_shared/__tests__/webhook-connection-state.test.ts, exit0.
- docs:check, sdd:check (359 specs/420 migraciones), governance:check
  (28 políticas) y components:check (5 fuentes) aprobados; diff --check limpio.
- Revisión independiente read-only: APROBADO sin bloqueantes; confirmó guard,
  contrato error→active, predicado final y modelo de carrera de la prueba.
- Sin cambios SQL/Next/UI: no se repitieron SQL, build o E2E de aplicación;
  no se presenta este cierre como pnpm verify completo ni smoke alojado.

Estado: implementación local verificada; status permanece in-progress porque
faltan publicación, autorización nominal de Edge y smoke. La comparación previa
con webhook alojado v14 era sobre f761c278; este delta todavía NO está alojado.
El checklist permanece49/103: avance parcial de una casilla existente.
El rediseño de autenticación del webhook sigue abierto y no se cuenta como
terminado por este guard. Release requiere GO específico para kommo-webhook,
comparación del código publicado y smoke nominal separado.
