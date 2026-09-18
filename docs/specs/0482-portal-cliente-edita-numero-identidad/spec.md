---
sdd: "0482"
title: "Portal cliente — editar nombre, cédula/RIF y teléfono al instante, dentro del cupo de 3 cambios"
status: in-progress
author: "Claude + founder"
created: 2026-09-18
updated: 2026-09-18
supersedes: null
superseded_by: null
related: ["0151", "0439", "0481", "0483", "0095", "0392"]
confidencialidad: interna
---

# SDD-0482 · El cliente edita sus datos al instante desde el Portal

El slug conserva el nombre de la reserva (`…-edita-numero-identidad`) aunque el
alcance creció a nombre y teléfono: renombrar la carpeta crearía dos carpetas
0482 entre la rama de reserva y esta (indicación de la coordinación).

## Decisiones de Sam (2026-09-18, respuestas literales)

Las registró la sesión `dtdcargo-63` con AskUserQuestion, después de que Sam
probara el Portal y viera que el número sólo se cambiaba por solicitud.

| Pregunta | Respuesta | Descartó |
|---|---|---|
| «Para el número de cédula o RIF, ¿cómo quieres que funcione en el Portal?» | «Editar directo, sin aprobación». La opción decía: «El cliente cambia el número él mismo, al momento, dentro de los 3 cambios». | Solicitud con aprobación; editar directo avisando al asesor |
| «Cuando el cliente cambia su número de cédula/RIF, ¿la verificación de identidad vuelve a pendiente?» | «No, se mantiene verificado» | «Sí, vuelve a pendiente» (recomendada) |
| «Si el número nuevo ya lo tiene otro cliente de DTD, ¿qué hacemos?» | «Bloquear y avisar al asesor (Recomendado)» | Bloquear sólo con mensaje |
| «¿El nombre y el teléfono también se editan directo, o siguen por solicitud con aprobación?» | «También directos» | Seguir por solicitud (recomendada) |

Además pidió, en texto libre, que el Studio muestre el historial de lo que el
cliente cambió, con el último valor como vigente. La coordinación lo separó en
[SDD-0483](../0483-studio-historial-cambios-cliente/spec.md) (lectura). Este SDD
**escribe** el historial desde el primer cambio.

## Contrato funcional

1. En «Datos de cuenta», «Editar mis datos» abre un formulario con nombre,
   cédula/RIF y teléfono prellenados. «Guardar cambios» pide confirmación: el
   guardado usa 1 de los N cambios disponibles y se aplica al instante.
2. **Un guardado = un cambio**, aunque toque varios campos. Sólo cuentan los
   campos que cambian de verdad: el documento se compara normalizado, así que
   cambiar `V12345678` por `V-12.345.678` no es un cambio ni gasta cupo.
3. El cupo es el mismo **compartido** de SDD-0439 (datos + reemplazos de foto,
   3 de por vida). Sin cupo, o con cupo ilegible, no se ofrece editar y se
   deriva a soporte; la RPC lo impone de nuevo con lock por cliente.
4. El documento se valida según el tipo de cliente, que no cambia: persona →
   cédula `V`/`E` con 6–9 dígitos o pasaporte `P`; empresa → RIF `V/E/J/G/P` con
   8 dígitos y verificador. Se guarda en su forma canónica (`V-12345678`,
   `J-12345678-9`). El teléfono se guarda en el formato canónico de 0353
   (`58` + 10 dígitos para Venezuela; los demás, sólo dígitos) y exige 7–15
   dígitos. El nombre, 2–120 caracteres.
5. **La verificación de identidad no se toca** (decisión de Sam). Riesgo
   registrado: la ficha puede quedar «verificada» contra un número que el asesor
   no revisó. El reemplazo de foto (0446) sí la sigue reiniciando.
6. **Duplicado bloqueado.** Si el documento nuevo ya lo tiene otro cliente vivo
   del tenant, o si el teléfono nuevo coincide (últimos 10 dígitos) con el de
   otro cliente vivo, no se guarda nada ni se gasta cupo. El cliente ve un
   mensaje genérico que no confirma si el dato existe: «No pudimos guardar ese
   dato. Escríbenos por soporte y lo revisamos.» El asesor del cliente (o el
   equipo, si no hay asesor con Telegram) recibe un aviso con los dos Shipping
   Marks, sin el valor intentado.
7. **Anti-enumeración.** Cada bloqueo queda en un registro restringido. Con 5
   bloqueos en 24 horas, el cliente no puede cambiar documento ni teléfono
   durante esas 24 horas, sea el valor libre o no, para que la respuesta no
   sirva de oráculo. El nombre se sigue pudiendo cambiar.
8. **Solicitud pendiente del flujo viejo.** Si el cliente tiene una solicitud
   de SDD-0151 en revisión, el Portal la muestra y ofrece «Editar ahora». Al
   guardar, la solicitud pendiente se elimina en la misma transacción (su cupo
   se libera) y la edición directa la reemplaza. Así una aprobación posterior
   no puede pisar el dato nuevo con uno viejo. Las pendientes de clientes que
   no editan siguen en la cola del Studio y se aprueban o rechazan como hoy.
9. El Portal deja de crear solicitudes. Email y Shipping Mark siguen fuera.
10. Sam descartó el aviso al asesor por cada cambio: sólo se avisa en los
    bloqueos del punto 6.

## Historial (escritura)

Cada guardado inserta en `client_change_requests` una fila `source='client'`,
`status='approved'`, con `prev_*` = los tres valores vigentes antes del cambio y
`proposed_*` **sólo de los campos que cambiaron**, `submitted_by = auth.uid()`, `submitted_at = reviewed_at = now()`,
`reviewed_by = null` y `review_note = 'Cambio directo del cliente desde el
Portal (SDD-0482).'`. El trigger de 0445 la cuenta como `applied` con lock por
cliente y audita `client_profile_edit_applied` sin valores. Es el mismo registro
que ya muestra el Studio en «Historial de solicitudes». Este SDD sólo cambia la
etiqueta de esas filas: de «Aprobada» a «Editado por el cliente».

## Persistencia · migración `0462_portal_profile_direct_edit.sql`

- Tabla `client_profile_blocked_attempts` (id, tenant, cliente, actor, campo
  `document|phone`, cliente con el que chocó, fecha), **sin el valor
  intentado**. RLS activa, sin grants para `anon` ni `authenticated`;
  `service_role` sólo SELECT, para armar el aviso al asesor.
- RPC `portal_update_my_profile(p_name, p_doc, p_phone)` · `SECURITY DEFINER`,
  `search_path` vacío, EXECUTE sólo `authenticated`:
  1. cliente sólo por sesión (`auth.uid()` + `get_portal_client_id()`), ficha
     viva, `FOR UPDATE`;
  2. valida longitud y formato en SQL (defensa; la action normaliza antes);
  3. calcula qué cambió; nada → `outcome = 'no_changes'`, sin cupo;
  4. si toca documento o teléfono y hay 5 bloqueos en 24 h →
     `outcome = 'rate_limited'`, sin mirar duplicados;
  5. duplicado de documento (misma expresión que `clients_tenant_doc_unique`) o
     de teléfono (`phone_last10`) → inserta el intento y devuelve
     `outcome = 'blocked'`. **No lanza excepción**, para que el intento quede
     registrado;
  6. elimina la solicitud pendiente propia, si existe;
  7. inserta la fila `approved` (el trigger 0445 consume cupo o lanza
     `profile_edit_limit_reached`) y actualiza `clients` en la misma transacción;
  8. una carrera con el índice único (`23505`) se atrapa en un bloque interno:
     se deshace el cambio, se registra el intento y se devuelve `blocked`;
  9. devuelve `outcome = 'applied'` y `remaining_count`, nunca datos de otro
     cliente.
- Preflight: exige el trigger de 0445, el índice `clients_tenant_doc_unique`,
  la columna generada `phone_last10` y la ausencia de los objetos nuevos.

## Lectores del dato

| Lector | Comportamiento con el cambio |
|---|---|
| Facturas y PDF | Congelan `client_rif`/`client_doc_kind` al emitir (0392): las emitidas no cambian. El `client_name` de la factura lo escribe el asesor, no sale de la ficha. **Hueco preexistente:** la RPC de 0128 (`sales_order_claim_and_invoice`) emite sin congelar el documento, y esas facturas caen al documento vigente en el Libro de Ventas. Queda para SDD-0487, que toca la facturación. |
| **Libro de Ventas** | Hoy lee `clients.rif` en vivo y reescribiría los períodos abiertos. **Se corrige**: usa `invoices.client_rif` congelado y sólo cae a `clients.rif` si la factura es anterior a 0392. Los libros cerrados ya estaban congelados (0165). |
| Documentos de aduana | Emitidos con el dato de su momento; no se regeneran. |
| Kommo | El documento sólo se envía en el alta (`kommo-push-client`). El teléfono es la segunda llave del router: el vínculo por `kommo_contact_id` no cambia, y el bloqueo de teléfonos de otro cliente evita que alguien adopte el número ajeno. Riesgo residual: un teléfono de un contacto de Kommo que no es cliente (ver Datos personales). |
| Acceso al Portal | Es por enlace al correo; el teléfono no da acceso. |
| WhatsApp de avisos | Usa `clients.phone`; el formato canónico evita el bug de 0353. |
| Registro/dedupe | Lee los datos vigentes: un cliente nuevo con el documento viejo ya no choca. Es el comportamiento esperado. |
| Verificación CNE/SENIAT | Lee en vivo; queda «verificado» por decisión de Sam (punto 5). |
| `persons.national_id` (Academia) | No se sincroniza (tampoco lo hace hoy la aprobación). Fuera de alcance. |

## Datos personales · revisión VE/CN (`revisar-datos-ve`)

| Estado | Evidencia |
|---|---|
| ENCONTRADO | Nombre, documento y teléfono son datos personales; el documento es identificador fiscal y de identidad (`supabase/migrations/0006_clients.sql`, `0095_clients_rif_unique.sql:35-37`). |
| ENCONTRADO | Sin aprobación, una sesión comprometida del Portal puede cambiar identidad y teléfono hasta 3 veces. Mitigación: cupo vitalicio, historial con valor anterior, actor y fecha, y verificación registrada. Decisión de Sam. |
| ENCONTRADO | La verificación queda «verificada» aunque cambie el número (decisión de Sam, punto 5). |
| CORRECTO (diseño) | El bloqueo por duplicado no revela el dato: mensaje genérico, límite de 5 en 24 h que corta también los valores libres, aviso al asesor y registro sin el valor intentado. |
| CORRECTO (diseño) | La RPC resuelve el cliente por sesión, no por parámetro, y no devuelve datos de otro cliente aunque se la llame directo por PostgREST. |
| ENCONTRADO | Kommo: un cliente sin `kommo_contact_id` que ponga el teléfono de un contacto de Kommo que no es cliente podría recibir sus tratos por el cruce por teléfono. Se reduce con el historial y el cupo; el bloqueo contra contactos de Kommo queda como seguimiento. |
| ENCONTRADO | `client_change_requests` guarda valores anteriores y nuevos (PII) sin plazo, igual que hoy con las solicitudes. |
| NO VERIFICABLE | Fundamento legal por categoría y política de retención del historial: validación humana. |

Esta revisión técnica no constituye asesoría legal.

## Gobernanza

| Política | Clasificación | Aplicación |
|---|---|---|
| SGE-00 | cumplimiento | Reglas en servidor/DB; la UI informa costo, estado y siguiente paso. |
| MP-01 | cumplimiento | El valor anterior se conserva en el historial; no hay hard-delete de datos. La solicitud pendiente reemplazada se elimina como hoy lo hace «Cancelar» (P0 técnico, sin valor probatorio). |
| AUD-01 / AUD-02 | cumplimiento | Trigger 0445 audita cada cambio sin PII; los bloqueos quedan en su registro. |
| FRM-01 / ERR-01 / LOD-01 | cumplimiento | Errores por campo, mensaje de formulario y estado «Guardando…». |
| BTN-01 / A11Y-01 | cumplimiento | Confirmación de 2 pasos, nombres accesibles, foco. |

## Allowlist exacta

- `docs/specs/0482-portal-cliente-edita-numero-identidad/spec.md`
- `docs/specs/README.md` (generado)
- `docs/specs/0481-portal-cliente-reemplazo-foto-identidad/spec.md` (cierre `done`)
- `.agents/handoffs/2026-09-18-portal-cliente-reemplazo-foto-identidad.md` (cierre)
- `docs/specs/0439-portal-cliente-edicion-de-perfil/spec.md` y `docs/legal/privacidad/fotos-identidad-cliente-v1.md` (textos de 0446/0447 ya aplicadas; commit aparte a pedido de la coordinación)
- `.agents/handoffs/2026-09-18-portal-cliente-edita-datos-directo.md`
- `supabase/migrations/0462_portal_profile_direct_edit.sql`
- `supabase/tests/0462_portal_profile_direct_edit.test.sql`
- `supabase/migrations-baseline.json`
- `supabase/pending-migration-symbol-declarations.json`
- `lib/portal/__tests__/profile-direct-edit.migration.test.ts`
- `lib/portal/profile-direct-edit.ts`
- `lib/portal/__tests__/profile-direct-edit.test.ts`
- `lib/studio/change-request-notify.ts`
- `lib/studio/fiscal/queries.ts`
- `lib/studio/fiscal/__tests__/queries.test.ts`
- `lib/studio/__tests__/profile-edit-blocked-notify.test.ts`
- `app/portal/(app)/perfil/actions.ts`
- `app/portal/(app)/perfil/DataChangeEditor.tsx`
- `app/portal/(app)/perfil/ProfileEditControls.test.tsx`
- `app/portal/(app)/perfil/DataChangeAction.test.ts`
- `app/studio/(app)/clientes/_components/ChangeRequestHistory.tsx`
- `app/studio/(app)/clientes/_components/ChangeRequestHistory.test.tsx`
- `docs/legal/privacidad/registro-tratamiento.md`

## Verificación exigida

- Contrato SQL 0462 (PGlite en Vitest + `.test.sql` para `verify` con Docker):
  - cupo compartido y lock;
  - `no_changes` sin cupo;
  - bloqueo por documento y por teléfono sin cupo y con intento registrado;
  - límite de 5 en 24 h, que corta también valores libres;
  - carrera `23505`;
  - reemplazo de la solicitud pendiente;
  - verificación intacta;
  - fila de historial correcta;
  - grants;
  - aislamiento entre clientes;
  - control rojo y preflight.
- Pruebas de la action (normalización, mensajes, aviso al asesor sólo en
  bloqueos) y de la UI (confirmación, sin cupo, solicitud pendiente, errores).
- Libro de Ventas con factura congelada y cliente que cambió de RIF.
- Mutantes sobre los guards nuevos.
- `pnpm verify` y gates rápidos.

## Release

Migrate-first: `0462` se aplica con OK nominal de Sam **aparte**, por la sesión
coordinadora, antes de integrar la PR. Con el código viejo, la migración es
invisible (el Portal sigue creando solicitudes). Después se integra la PR y
Sam hace el smoke:

1. Editar el teléfono y ver que se aplica al instante y baja el cupo.
2. Intentar el documento de otro cliente de prueba y ver el mensaje genérico,
   el aviso al asesor y el cupo intacto.
3. Ver en el Studio la fila «Editado por el cliente» con el antes y el después.

## Fuera de alcance

- Panel de historial ampliado con fotos anteriores e intentos bloqueados
  (SDD-0483).
- Sincronizar `persons.national_id`; bloqueo contra contactos de Kommo que no
  son clientes; política de retención del historial.
- Email y Shipping Mark.
