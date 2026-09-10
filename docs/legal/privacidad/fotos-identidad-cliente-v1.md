---
title: "Tratamiento de fotos de identidad de clientes"
version: "1.0-propuesta"
status: proposed
owner: "Sam (founder)"
created: 2026-09-04
review_due: 2026-10-04
scope: "Foto vigente e históricos reemplazados del bucket client-docs"
confidencialidad: interno
---

# Tratamiento de fotos de identidad de clientes v1.0

## 1. Naturaleza y estado

Esta directiva define el tratamiento organizacional propuesto para la foto de
cédula o RIF que usa el Portal del Cliente. No es un dictamen jurídico ni cambia
por sí sola la Política de Privacidad publicada. Entra en vigor solo cuando los
controles técnicos de la sección 7 estén aplicados y la redacción dirigida al
cliente haya sido validada profesionalmente.

La regla se apoya en la finalidad y temporalidad descritas por la CRBV y la Sala
Constitucional, y en minimización, información, consentimiento separado,
evaluación de impacto y supresión bajo PIPL cuando exista tratamiento en China.
Las fuentes de trabajo son
[`marco-legal-ve.md`](../../../.claude/skills/revisar-datos-ve/references/marco-legal-ve.md)
y
[`marco-legal-cn-pipl.md`](../../../.claude/skills/revisar-datos-ve/references/marco-legal-cn-pipl.md).

## 2. Finalidades permitidas

La foto vigente se usa únicamente para verificar que el documento corresponde
al cliente y para atender incidencias de identidad vinculadas al servicio. No se
usa para marketing, perfilado, entrenamiento de modelos, reconocimiento facial
ni decisiones automatizadas.

Una foto sustituida deja de ser documento operativo. Durante su ventana corta
de conservación solo puede usarse para investigar una sustitución impugnada,
fraude o incidente de seguridad. Queda fuera de la vista normal del Portal y del
Studio.

## 3. Retención y disposición

| Clase | Plazo propuesto | Disposición | Excepción |
|---|---|---|---|
| Foto vigente | Mientras la cuenta o relación de servicio esté activa y la verificación de identidad siga siendo necesaria | Al cerrar la relación, pasa a revisión de eliminación; no se conserva por inercia | Obligación identificada, reclamo, investigación, litigio u orden de autoridad |
| Foto histórica reemplazada | Máximo 30 días calendario desde el reemplazo | Purga física del objeto y retiro de su ruta recuperable; el ledger conserva solo evento, fecha, actor y resultado sin imagen ni ruta útil | Legal hold o incidente abierto, con responsable y fecha de revisión |
| Copia temporal o URL firmada | URL: máximo 60 segundos; no se persiste. Copia temporal: se elimina al terminar la tarea | Vencimiento o borrado inmediato | Ninguna ampliación silenciosa |
| Backup externo | No existe respaldo externo conectado verificado a la fecha de esta propuesta | Si se conecta, la copia vencida queda inaccesible y se elimina al vencer el ciclo contratado | Hold u orden aplicable |

Los 30 días son un máximo organizacional propuesto para resolver una
sustitución, no una afirmación de plazo legal. Si una fuente aplicable exige
conservar una foto concreta por más tiempo, debe registrarse la fuente, el
expediente, el responsable y la fecha de revisión. Sin esa evidencia, no se
extiende el plazo.

## 4. Solicitud de eliminación

1. La solicitud entra desde una sesión autenticada o por
   `info@dtdcargo.com`, asunto `Privacidad`.
2. Se verifica identidad sin pedir una nueva copia del documento salvo que no
   exista otro medio razonable.
3. Se registra alcance: foto vigente, todas las históricas, cuenta completa o
   una combinación; nunca se responde solo sobre el puntero de PostgreSQL.
4. SLA interno propuesto: acuse en 5 días hábiles y decisión en 20 días hábiles.
5. Si no existe excepción documentada, las históricas se purgan y la vigente se
   elimina o se reemplaza. Si la cuenta necesita verificación para continuar el
   servicio, se explica esa consecuencia antes de ejecutar.
6. Si existe hold u obligación identificada, el acceso queda bloqueado para uso
   ordinario; se informa categoría, motivo y próxima revisión, sin revelar datos
   de terceros ni controles de seguridad.
7. El cierre exige buscar y disponer el objeto actual, cada ruta histórica,
   copias temporales y copias de proveedor. No se afirma `eliminado` mientras
   alguno de esos destinos sea `NO VERIFICABLE`.
8. El recibo final conserva identificador de solicitud, conteos, fechas,
   resultado y motivo; nunca conserva la foto ni una URL firmada.

## 5. Tratamiento Venezuela-China

La regla ordinaria es **cero acceso y cero transferencia de fotos de identidad
al equipo de China**, incluidas las versiones históricas. La operación de Yiwu
usa Shipping Mark y datos de la mercancía, sin nombre, documento, dirección,
teléfono ni foto de identidad.

Una excepción requiere, antes del primer acceso:

- necesidad operacional documentada y datos mínimos;
- aviso específico al titular y consentimiento separado cuando PIPL lo exija;
- evaluación de impacto previa y conservación de su informe por al menos tres
  años;
- mecanismo transfronterizo aplicable bajo PIPL arts. 38-40;
- personas, duración, sistema y revocación definidos;
- registro de acceso y eliminación al terminar la finalidad.

No existe hoy un flujo de consentimiento separado para esta transferencia. Por
eso no se habilita una excepción por conveniencia operativa.

El almacenamiento actual en Supabase, región `us-east-1`, constituye además un
alojamiento fuera de Venezuela que debe declararse y evaluarse por separado; no
se debe describir públicamente como tratamiento localizado solo en Venezuela.

## 6. Estado comprobado al 2026-09-04

| Estado | Evidencia |
|---|---|
| CORRECTO | `client-docs` es privado y la foto vigente se entrega mediante URL firmada de 60 segundos (`supabase/migrations/0091_portal_self_register.sql:29-41`; `app/studio/(app)/clientes/[markbox]/page.tsx:206-213`; `app/portal/(app)/perfil/page.tsx`). |
| CORRECTO | La migración 0445 preserva el objeto sustituido y restringe las rutas históricas al ledger sin grants directos (`supabase/migrations/0445_portal_profile_edit_limit.sql:41-118,389-397`). |
| CORRECTO | La migración 0447 y el guard del Portal bloquean nuevos reemplazos antes de mover el puntero; una primera carga sigue disponible. El rollback de Storage comprueba `{ error }` y no anuncia éxito si falla. |
| ENCONTRADO | La policy de Storage permite leer y borrar `client-docs` a cualquier miembro autenticado del tenant, sin condición de región (`supabase/migrations/0091_portal_self_register.sql:52-68`). |
| ENCONTRADO | El módulo Clientes admite `operations` y la ficha firma la foto sin gate regional (`lib/studio/rbac.ts:90`; `app/studio/(app)/clientes/[markbox]/page.tsx:206-213`). |
| ENCONTRADO | No hay worker que purgue históricos a 30 días ni flujo integral de solicitud; hoy conservar el objeto es indefinido. |
| NO VERIFICABLE | La contención 0447 no está activa en Cloud hasta que exista autorización nominal, aplicación individual y verificación posterior. |
| NO VERIFICABLE | Contratos, base aplicable por categoría, holds reales y eliminación en backups/proveedores requieren evidencia humana y del proveedor. |

## 7. Controles que activan esta directiva

1. Restringir lectura, firma y borrado de `client-docs` a personal VE con
   capacidad explícita; el chequeo debe existir en servidor y base de datos.
2. Sacar las versiones históricas de la policy ordinaria de listado/lectura.
3. Al reemplazar, invalidar la verificación anterior y exigir revisión de la
   nueva foto. La migración funcional 0446 lo implementa por separado; falta su
   merge, aplicación nominal y verificación Cloud.
4. Implementar purga fail-closed a 30 días, con `dry-run`, holds, manifiesto sin
   PII y recibo auditable.
5. Implementar el inventario end-to-end de solicitudes y verificarlo con una
   cuenta autorizada antes de prometer eliminación completa.
6. Corregir la Política de Privacidad pública solo después de validación legal y
   de comprobar que estos controles están activos.

Hasta cerrar 1, 2, 4 y 5, la migración 0447 mantiene el reemplazo self-service
deshabilitado. Esta contención evita ampliar el inventario de históricos, pero
no equivale a purga, legal hold, borrado integral ni control regional.

---

*Revisión técnica bajo estados ENCONTRADO, CORRECTO y NO VERIFICABLE. No afirma
cumplimiento legal.*
