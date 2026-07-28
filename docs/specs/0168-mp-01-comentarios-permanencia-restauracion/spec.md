---
sdd: "0168"
title: "MP-01 Slice 1 — Permanencia y restauración de comentarios internos"
status: approved
author: "Codex"
created: 2026-07-22
updated: 2026-07-28
supersedes: null
superseded_by: null
related: ["0045", "0123", "0165", "0166"]
confidencialidad: interno
---

# SDD-0168 — MP-01 Slice 1: permanencia y restauración de comentarios internos

> **Estado de control:** aprobado documentalmente el 2026-07-22. El
> [diseño técnico v1.0](diseno-tecnico.md) fue aprobado técnicamente por
> [REV-MP-002](../../governance/reviews/mp-01-comments-design.md). DB-1 fue
> aplicado en Cloud y APP fue validada en un Preview aislado el 2026-07-23,
> según [REV-MP-003](../../governance/reviews/mp-01-comments-implementation.md).
> DB-2 fue implementado, aplicado en Cloud y verificado el 2026-07-28 según
> [REV-MP-004](../../governance/reviews/mp-01-comments-db2.md). La APP fue
> revalidada después de DB-2 en un Preview aislado según
> [REV-MP-005](../../governance/reviews/mp-01-comments-preview-e2e.md). Otra
> ventana integró hasta `b92116d4` en `main` mediante `67b1a46b` y activó el
> despliegue automático de Producción. El correctivo final fue publicado en su
> rama y pasó CI; integración, validación funcional de Producción y los ACL
> históricos conservan gates propios.

## 1. Propósito

Adoptar [MP-01 v1.1](../../governance/policies/mp-01.md) por primera vez sobre
una entidad pequeña y reversible: los comentarios internos creados por
[SDD-0045](../0045-comentarios-menciones/spec.md).

El slice convierte el `deleted_at` actual en un contrato P2 verificable:

- eliminar un comentario propio es P2/R1 y ofrece **Deshacer** durante 10
  segundos;
- moderar el comentario de otra persona es P2/R2 y declara la consecuencia;
- restaurar valida actor, tenant, permiso, ventana, estado y relaciones;
- comentario, menciones y reacciones conservan identidad y contenido;
- eliminar y restaurar producen eventos AUD-01 atómicos;
- vencer una ventana de restauración nunca autoriza purga.

## 2. Evidencia y comportamiento actual

| Área | Evidencia actual | Consecuencia |
|---|---|---|
| Entidad | `public.comments` tiene `deleted_at`; `comment_mentions` y `comment_reactions` referencian el mismo `comment_id` | Existe la base de P2 y las relaciones sobreviven mientras no haya hard-delete. |
| Acción | `deleteComment()` ejecuta un `UPDATE deleted_at = now()` | Hay soft-delete, pero no estado transaccional gobernado ni restauración. |
| UI | `CommentItem` muestra **Eliminar** solo al autor y ejecuta de inmediato | No existe diálogo, aviso persistente ni **Deshacer**. |
| Lectura del hilo | `listComments()` filtra `deleted_at is null` | El comentario desaparece del hilo tras refrescar. |
| Menciones | La bandeja omite menciones cuyo comentario está eliminado, pero conserva la fila y su `read_at` | Una restauración puede recuperar la mención sin recrearla ni reenviar notificaciones. |
| Badge | `countUnreadMentions()` cuenta filas sin unir el estado del comentario | Puede quedar un conteo no visible mientras el comentario está eliminado. |
| Integridad | `comments_freeze_immutable` congela tenant, entidad, autor, padre y fecha; body, `edited_at` y `deleted_at` siguen mutables | La identidad ya se preserva, pero el acceso directo todavía permite transiciones sin el contrato nuevo. |
| RLS | El autor o un admin pueden actualizar; `authenticated` no puede hacer hard-delete; `service_role` conserva acceso total | La autorización actual es más amplia que una acción gobernada y no expresa capabilities de restauración/moderación. |
| Auditoría | No hay evento por eliminar/restaurar y `comment` todavía no está en el catálogo AUD | A2 ya fue aplicado y verificó el catálogo extensible; el alta aditiva de `comment` y la atomicidad del dominio conservan gates propios. |
| Pruebas | Existen pruebas de actions, queries y workflow de comentarios | Cubren el soft-delete actual, no ventanas, restauración, atomicidad ni carreras. |

La restauración real disponible hoy es **manual a nivel de dato**: limpiar
`deleted_at` haría reaparecer el mismo registro y conservaría relaciones. No
existe una operación autorizada, auditable ni accesible desde la aplicación;
por eso el estado actual no puede prometer restauración al usuario.

## 3. Alcance de entidad

### 3.1 Incluye

- `public.comments` usados como colaboración interna del equipo.
- Consumidores actuales del hilo: comentarios de `shipment` y
  `bitacora_task`; el contrato es reutilizable por los demás `entity_type`
  admitidos cuando tengan un consumidor real y su clasificación siga siendo
  colaboración P2.
- Relaciones existentes `comment_mentions` y `comment_reactions`, solo para
  garantizar su conservación, ocultamiento coherente y reaparición.
- Eliminación lógica propia, moderación administrativa, deshacer inmediato,
  restauración ordinaria y restauración excepcional dentro de las ventanas
  aprobadas por MP-D2.
- Trazabilidad AUD-01 de las transiciones de permanencia.

### 3.2 Regla de elegibilidad y frontera P2/P4

`public.comments`, tal como lo define SDD-0045, es un canal de colaboración
interna no autoritativo y se clasifica P2. Los consumidores actuales
(`shipment` y `bitacora_task`) no pueden usar un comentario como único registro
de una decisión, aceptación, instrucción legal/contable, evidencia, hold,
reclamo o investigación; esos efectos deben vivir en la entidad o evento P3/P4
correspondiente. El `entity_type` del padre no cambia por sí solo esta regla.

Un consumidor futuro que necesite convertir un comentario en evidencia o
decisión deberá aprobar antes otro SDD, introducir una señal P4 explícita y
retirar para esa fila las acciones P2. Hasta entonces ningún consumidor puede
atribuir valor autoritativo a `public.comments`. Si el contexto padre ya expone
un hold o protección conocida, la acción P2 falla cerrada. SDD-0168 no crea el
flujo de promoción a P4.

## 4. Modelo de estados

Los estados son derivados de `deleted_at`, la hora del servidor y el contexto
de la transición; no son un calendario de retención.

| Estado conceptual | Condición | Visibilidad ordinaria | Transición permitida |
|---|---|---|---|
| `active` | `deleted_at is null` | Visible en hilo y bandeja de menciones | Eliminar propio o moderar, si cumple elegibilidad. |
| `deleted_undoable` | Eliminado hace 0–10 s | Oculto; relaciones conservadas | **Deshacer** por quien ejecutó la eliminación, si conserva permiso y nada cambió. |
| `deleted_restorable` | Eliminado hace más de 10 s y hasta 30 días | Oculto; visible solo en recuperación autorizada | Restauración ordinaria con `restore_comments`. |
| `deleted_exceptional` | Eliminado hace 31–90 días | Oculto; visible solo a admin autorizado | Restauración excepcional con motivo obligatorio. |
| `retained_not_ordinary_restorable` | Eliminado hace más de 90 días | Oculto | Sin botón de restauración ordinaria; solo procedimiento futuro documentado. |

Reglas invariantes:

1. todas las ventanas se calculan con hora de servidor;
2. la expiración de 30 o 90 días no cambia la retención ni habilita `DELETE`;
3. una transición repetida es idempotente y no crea eventos `succeeded`
   duplicados;
4. restaurar no edita body, autor, padre, entidad, fecha, menciones, reacciones
   ni estado de lectura;
5. ningún identificador se reutiliza.

## 5. Contrato de acciones gobernadas

| Acción | Actor y condición | MP-01 | Fricción | Consecuencia visible | Recuperación |
|---|---|---|---|---|---|
| Eliminar comentario propio | Autor activo con permiso vigente sobre el contexto y comentario elegible | P2 | R1 | Se oculta del hilo y de Menciones; no borra relaciones | **Deshacer** 10 s; después, restauración autorizada. |
| Moderar comentario ajeno | Admin con `moderate_comments`; comentario elegible | P2 | R2 | Se oculta para todo el tenant; conserva historia | `ConfirmDialog` con autor/consecuencia y motivo de moderación; restaurable. |
| Deshacer | Mismo actor que eliminó, dentro de 10 s, con permiso vigente y estado sin cambios | P2 | R1 | El mismo comentario reaparece en su posición lógica | No requiere diálogo; fallo deja el registro oculto y explica la causa. |
| Restaurar 0–30 días | Admin o responsable con `restore_comments` y permiso de edición del contexto | P2 | R2 | Vuelve a ser visible; menciones recuperan su estado previo | Confirmación con consecuencia; sin recrear efectos. |
| Restaurar 31–90 días | Admin con `restore_comments` | P2 | R3 | Recuperación excepcional del mismo registro | Motivo obligatorio, confirmación explícita y evento AUD-01. |

### 5.1 Capabilities propuestas

Los nombres técnicos quedan definidos aquí para una futura implementación; no
se agregan a `lib/studio/rbac.ts` durante la redacción:

- `moderate_comments`: eliminar lógicamente el comentario de otra persona;
- `restore_comments`: consultar comentarios eliminados y ejecutar restauración
  ordinaria o excepcional según rol y ventana.

El default inicial de ambas capabilities es admin-only. Una ampliación a roles
de dominio requiere decisión explícita y pruebas; `admin` nunca evita las
validaciones de tenant, elegibilidad, estado o ventana. La capability no
reemplaza el permiso de acceso/edición sobre el registro padre.

### 5.2 Precondiciones del servidor

Toda transición debe validar en una única frontera confiable:

- identidad del actor y tenant derivados de sesión, no del formulario;
- pertenencia del comentario y de su entidad padre al tenant;
- estado actual y elegibilidad P2;
- autoría o capability aplicable;
- permiso vigente sobre el contexto comentado;
- ventana calculada por base de datos;
- ausencia de cambio concurrente y de un hold/protección que el contexto padre
  ya exponga;
- motivo cuando la moderación o la restauración excepcional lo exijan.

## 6. Restauración real y relaciones

Restaurar significa actualizar el mismo registro, no crear una copia. Debe
demostrarse que se conservan:

- `comments.id`, `tenant_id`, `entity_type`, `entity_id`, `entity_code`,
  `author_id`, `parent_id`, `body`, `edited_at` y `created_at`;
- IDs y contenido de todas las `comment_mentions`, incluido `read_at`;
- IDs y contenido de todas las `comment_reactions`;
- orden cronológico del hilo;
- referencia al evento de eliminación mediante `correlation_id`.

Eliminar oculta las menciones y excluye sus filas del conteo de no leídas. Al
restaurar, una mención vuelve con el mismo `read_at`: si ya fue leída no revive
como nueva; si estaba sin leer vuelve a contarse. No se reenvían email, push ni
notificaciones in-app, porque la restauración no vuelve a crear el comentario.

## 7. Auditoría

Eliminar y restaurar son mutaciones obligatorias de AUD-01 y deben persistir en
la misma transacción que el cambio de `deleted_at`. Si el evento no puede
persistirse, la transición completa falla.

### 7.1 Vocabulario

| Campo | Contrato |
|---|---|
| `entity_type` | `comment`, agregado al catálogo aditivo solo después del gate aplicable de SDD-0166. |
| `event_type` | `comment_soft_deleted` o `comment_restored`. |
| `actor_type/id` | Actor real derivado de sesión; nunca `system` por defecto. |
| `before/after` | Solo `deleted_at`, clase P2, ventana y modalidad propia/moderación/undo/ordinaria/excepcional. |
| `reason` | Motivo de moderación o restauración excepcional; `null` para eliminar propio, deshacer y restauración ordinaria. |
| `correlation_id` | Une eliminación con feedback y eventual restauración. |
| `source/result` | Superficie Studio y resultado estable conforme a SDD-0166. |

El payload no copia el body, menciones, email, nombre completo ni otra PII. Usa
IDs y metadatos mínimos. La retención de estos eventos permanece P4 y se rige
por AUD-02; SDD-0168 no habilita su purga.

### 7.2 Estado de la dependencia A2

El Corte A1 creó `audit_entity_types` y el Corte A2 validó su FK y retiró el
CHECK legacy. [REV-AUD-006](../../governance/reviews/aud-corte-a2-aplicacion.md)
registra la aplicación y verificación individual de A2. SDD-0168 no reabre ni
reemplaza ese CHECK, tampoco agrega `comment` por sí mismo: el futuro cambio de
dominio debe registrarlo de forma aditiva. El Corte D de atomicidad conserva
revisión y autorización propias.

## 8. Cambios que exigiría una implementación futura

El contrato ejecutable, la frontera de confianza, datos, RPCs, rollout
`DB-1 → APP → DB-2`, pruebas y forward-fix están fijados en
[DT-SDD-0168 v1.0](diseno-tecnico.md). Esta sección resume el impacto; no crea
una migración ni autoriza cambios.

### Base de datos

- Registrar de forma confiable quién ejecutó la eliminación para validar
  **Deshacer**; no inventar ese actor para filas legacy.
- Exponer transiciones estrechas y transaccionales de soft-delete/restauración
  que validen tenant, estado, ventana y actor, y escriban AUD-01 atómicamente.
- Impedir que un `UPDATE` directo altere `deleted_at` fuera de esas
  transiciones, incluidos clientes privilegiados según el gate aplicable.
- Agregar `comment` de forma aditiva al catálogo AUD, sin reconstruir listas
  regresivas.
- Mantener las FK y no añadir `ON DELETE` ni rutina de purga.

La migración exacta, su número, rollback y aplicación Cloud se redactan y
autorizan en un gate separado.

### Aplicación

- `app/studio/(app)/_actions/comments.ts`: reemplazar el update directo por las
  transiciones gobernadas y exponer restauración.
- `lib/studio/comments/`: tipos de estado, queries de recuperación y conteo de
  menciones coherente con `deleted_at`.
- `CommentsThread.tsx` y `CommentItem.tsx`: feedback R1 con **Deshacer**, diálogo
  R2 para moderación/restauración y recuperación local autorizada.
- `lib/studio/rbac.ts` y pruebas: capabilities solo tras autorización RBAC.
- Pruebas unitarias, contractuales, de base de datos y de interacción.

La recuperación autorizada se presenta dentro del hilo; este slice no crea una
papelera global ni un nuevo módulo.

## 9. Experiencia y estados de interfaz

### 9.1 Eliminar propio — P2/R1

1. **Eliminar** actúa sin diálogo previo.
2. La UI espera confirmación durable del servidor antes de anunciar éxito.
3. El comentario desaparece y un aviso conforme a SDD-0165 muestra
   **Comentario eliminado · Deshacer** durante 10 segundos.
4. El aviso no pausa el reloj si se pierde foco y no promete éxito de la
   restauración antes de la respuesta del servidor.
5. Si **Deshacer** falla por permiso, tiempo o carrera, el aviso explica la
   causa y deja acceso a la recuperación autorizada cuando corresponda.

### 9.2 Moderación y restauración

- Moderar otro comentario usa `ConfirmDialog`, identifica al autor y explica
  que el contenido se ocultará para el equipo sin borrarse; solicita motivo.
- La sección colapsada **Comentarios eliminados** solo existe para quien tenga
  `restore_comments`; no expone contenido a roles que no podían verlo.
- Restauración ordinaria confirma que el comentario y sus menciones volverán a
  ser visibles sin reenviar notificaciones.
- Restauración excepcional muestra ventana vencida, exige motivo y usa R3.
- Después de 90 días no se muestra un botón de restauración; se informa que se
  requiere un procedimiento documentado.

Teclado, foco, lector de pantalla, móvil/touch y movimiento reducido forman
parte del gate UI. El orden y jerarquía de acciones deben cumplir BTN-01.

## 10. Tratamiento de filas legacy

- No se backfillea `deleted_by` ni un evento histórico sin evidencia.
- Una fila eliminada antes de implementar este SDD no puede usar **Deshacer**.
- Puede evaluarse para restauración ordinaria/excepcional usando su
  `deleted_at`, siempre por actor autorizado y dejando el nuevo evento.
- Si `deleted_at` es nulo o inconsistente, el sistema falla cerrado y no
  inventa una fecha.
- No se consulta producción ni se reclasifican filas durante la fase
  documental.

## 11. Criterios de aceptación

### Permanencia y relaciones

- [ ] Eliminar propio cambia únicamente el estado de permanencia y ofrece
      **Deshacer** durante 10 segundos sin diálogo previo.
- [ ] Cero rutas visibles o server-side de hard-delete/purga de comentarios.
- [ ] Una prueba elimina y restaura el mismo comentario y demuestra igualdad de
      identidad, body, autor, padre, entidad, fechas, menciones, `read_at`,
      reacciones y orden.
- [ ] Eliminar oculta la mención del inbox y del badge; restaurar recupera su
      estado anterior sin duplicar ni reenviar notificaciones.
- [ ] El vencimiento de 30/90 días no borra ni vuelve elegible para purga.

### Permisos y aislamiento

- [ ] Autor, admin, rol sin capability, usuario deshabilitado y tenant ajeno se
      prueban por separado.
- [ ] **Deshacer** solo funciona para el actor de la eliminación dentro de la
      ventana y con permiso vigente.
- [ ] `moderate_comments` y `restore_comments` son admin-only por default y el
      backend revalida el permiso sobre la entidad padre.
- [ ] Un contexto padre con hold/protección conocida falla cerrado y los
      consumidores actuales no dependen del comentario como evidencia P4.
- [ ] Un update directo no puede saltarse las transiciones gobernadas.

### Auditoría y carreras

- [ ] `comment_soft_deleted` y `comment_restored` usan `entity_type=comment`,
      actor real, tenant, before/after mínimo, ventana y correlación.
- [ ] El payload no contiene body, menciones, nombres, emails ni secretos.
- [ ] Una prueba fuerza el fallo del evento y demuestra rollback completo de la
      mutación.
- [ ] Doble click, reintento, pestañas concurrentes y restauración simultánea
      producen un solo estado y eventos no duplicados.
- [ ] Filas legacy nunca reciben actor ni evento histórico inventado.

### UI y accesibilidad

- [ ] R1, R2 y R3 presentan la fricción definida, sin anunciar éxito temprano.
- [ ] El aviso de **Deshacer** es operable por teclado y lector de pantalla y no
      desplaza el foco de forma destructiva.
- [ ] La recuperación funciona en desktop y móvil y conserva foco al cerrar
      diálogos.
- [ ] Estados idle, hover/focus, disabled, pending, error, success y expirado
      están cubiertos.
- [ ] El cambio visual pasa `/ui-check` antes de commit.

### Gates técnicos

- [x] SDD-0168 fue aprobado documentalmente el 2026-07-22, sin autorizar
      implementación.
- [x] A2 fue aplicado y verificado individualmente, con evidencia en
      REV-AUD-006.
- [x] El diseño técnico del corte de atomicidad aplicable fue aprobado en
      REV-MP-002, sin declarar completo el Corte D global.
- [x] Gate APP implementado y verificado localmente el 2026-07-23: RPCs de
      delete/undo/restore, capabilities admin-only, recuperación por entidad,
      badge coherente y deadline absoluto; sin tocar ACL históricos.
- [x] DB-1 (`0262_comments_lifecycle_contract`) fue autorizado por basename,
      aplicado en Cloud y verificado por ledger y postcondiciones metadata-only.
- [x] APP fue revalidada después de DB-2 en Preview aislado con seed controlado
      y recorrido autenticado crear/eliminar/deshacer/eliminar/restaurar según
      REV-MP-005.
- [x] DB-2 (`0265_comments_lifecycle_hardening`) fue implementado, revisado y
      validado localmente según REV-MP-004.
- [x] DB-2 fue autorizado por basename exacto, aplicado de a una en Cloud como
      versión `20260728220034` y verificado con preflight, postcondiciones y
      advisors.
- [x] El historial hasta `b92116d4` fue integrado por otra ventana mediante
      `67b1a46b` y Vercel lo desplegó automáticamente a Producción.
- [x] El correctivo final `592226e9` y la evidencia `1f831b63` fueron
      publicados en `codex/sdd-0168-db1-local`; Vercel y GitHub reportaron
      `success`.
- [ ] Integración del correctivo final y validación funcional de Producción
      reciben gates individuales.

## 12. Fuera de alcance

- hard-delete, purga, retención automática, cron, job o reutilización de IDs;
- Storage, archivos o adjuntos de comentarios;
- facturas emitidas, pagos asentados, auditoría P4, cierre de tenant y
  solicitudes relacionadas con PII;
- comentarios del portal del cliente o canales externos;
- restaurar body editado, borrar menciones/reacciones o reenviar
  notificaciones;
- papelera global, búsqueda histórica o exportación de comentarios eliminados;
- promoción/hold de comentarios P4 y procedimiento de recuperación después de
  90 días;
- cambios generales de AUD-02, grants o viewer fuera de los gates reservados;
- aplicación a Supabase Cloud o producción.

## 13. Riesgos y mitigaciones

| Riesgo | Mitigación obligatoria |
|---|---|
| Prometer R1 sin restauración real | Prueba relacional end-to-end y rollback por fallo de auditoría. |
| Ocultar evidencia o una decisión | `public.comments` es no autoritativo; un uso P4 exige señal y SDD previos; holds conocidos fallan cerrado. |
| Restauración por actor o tenant incorrecto | Identidad server-side, capability y prueba cruzada de tenant. |
| Badge fantasma de menciones | Conteo condicionado al comentario activo y prueba de ida/vuelta. |
| Reenviar efectos al restaurar | Reusar filas existentes; cero fan-out de notificación. |
| CHECK AUD regresivo | A2 retiró la whitelist; no reconstruirla desde este dominio. |
| Historia legacy inventada | Actor desconocido permanece no resuelto; solo se audita la transición nueva. |
| `service_role` salta el contrato | Funciones/grants estrechos bajo el corte AUD autorizado; prueba de abuso. |

## 14. Secuencia de gates reservados

1. **Aprobación documental cerrada el 2026-07-22:** SDD-0168 fija alcance y
   contrato sin autorizar implementación.
2. **A2 cerrado el 2026-07-22:** FK validada y CHECK legacy retirado; el Corte D
   de atomicidad y cualquier cambio de grants permanecen independientes.
3. **Diseño técnico cerrado el 2026-07-22:** DT-SDD-0168 v1.0 aprobado por
   REV-MP-002, sin autorizar ejecución.
4. **Implementación local cerrada:** DB-1, APP y DB-2 tienen pruebas de DB,
   actions, UI, accesibilidad y fallo seguro.
5. **Revisar el gate SGE/MP/AUD/BTN/AVS** con evidencia.
6. **Autorizar por nombre** cada migración Cloud; después verificar producción.
7. **Autorizar commit y push** de forma separada.

Ningún gate de esta secuencia habilita purga. Una futura disposición de datos
requiere otro SDD y el calendario de retención aplicable.

## 15. Decisión registrada

La revisión documental del 2026-07-22 concluyó **aprobado**, sin excepciones.
El ajuste de revisión fijó una frontera determinista: `public.comments` es
colaboración interna P2 y no puede ser la fuente autoritativa de evidencia o
decisiones P4.

La autorización posterior permitió completar
[DT-SDD-0168 v1.0](diseno-tecnico.md). REV-MP-002 lo aprueba técnicamente para
implementación local por gates, pero no autoriza modificar código, base de
datos, RBAC, Vercel o Cloud. El próximo gate es DB-1 local y debe conservar
revisión y autorización separadas.
