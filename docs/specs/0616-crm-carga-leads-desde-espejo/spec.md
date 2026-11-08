---
sdd: "0616"
title: "Carga de leads, etapas, tareas, asesores e IDs de Kommo al CRM propio (E6 del programa SDD-0582, paso 6.5)"
status: draft
author: "Claude Worker «E6 carga 6.5» (Sam)"
created: 2026-11-08
updated: 2026-11-08
supersedes: null
superseded_by: null
related: ["0582", "0587", "0590", "0614", "0586", "0043", "0288"]
confidencialidad: interno
---

# SDD-0616 — Carga de Kommo al CRM propio (E6, paso 6.5)

> ⛔ **Cargar en producción es una carga de datos: OK nominal de Sam** (fila 6.5), que pide el Director General.
> ⛔ **El seco contra producción lee filas de clientes del espejo**: también pide OK, y solo saca números.
>
> **Se prepara, no se carga.** Esta SDD trae el diseño, el cargador y sus pruebas con datos inventados.
> No toca producción, Kommo, Meta, el VPS ni Chatwoot, y no lee filas de ninguna base. **Cargar en producción
> pide el OK nominal de Sam** (fila 6.5 del checklist), y antes hay tres lecturas, cada una con su OK (§9).
> No lleva migración: el cargador no deja objetos en la base.

Programa: [SDD-0582](../0582-chatwoot-piloto/spec.md) · checklist: [fila 6.5](../0582-chatwoot-piloto/checklist.md) ·
contrato: [SDD-0587](../0587-chatwoot-contrato-sistema-maestro/spec.md) §3, §5 y §7 · patrón de E5:
[SDD-0590](../0590-kommo-historial-e5/spec.md) · 6.6: [SDD-0614](../0614-crm-reemplazos-kommo/spec.md) §2.8 y §3.

**Etiquetas de evidencia** (las del programa): **C** código leído en esta tarea, **D** documento, **T** medido en
la cuenta de DTD, **I** inferencia, **NV** no verificado. Las citas de código son de `main` en `3c14715ad`
(2026-11-08). No se leyó ninguna fila de ninguna base.

## 1. Punto de partida

| Qué ya está decidido | Dónde | Qué le pide a 6.5 |
|---|---|---|
| **D3 (a):** migrar al corte, **desde el espejo de Studio**, sin extracción nueva | SDD-0587 §7 y §8 | El cargador lee `kommo_*` en Supabase. **No llama a Kommo**: ni siquiera de lectura |
| **D4 (a):** leads abiertos con actividad en los últimos 180 días, más sus tareas abiertas | SDD-0587 §7.2 | Ganados (142), perdidos (143) y cerrados quedan solo en la exportación cifrada de 8.9 |
| **D5 (b):** ni notas ni etiquetas | SDD-0587 §8 | El cargador no lee `notes` ni etiquetas. No hay lectura de PII por API |
| Orden de carga: asesores → personas → tarjetas → tareas → mapeo | SDD-0587 §7.3 | §4 |
| Si ya hay tarjeta de Studio, gana su etapa | SDD-0587 §5.3 y §7.5 | §5 |
| Asesor solo por el mismo correo (E2-D10) | SDD-0587 §5.4 | §4, paso 1 |
| Idempotente por ID de Kommo en la tabla de mapeo | SDD-0587 §5.2 | `crm_ids_externos` de la 0506 |
| El mapeo y las columnas `kommo_*` se exportan cifrados y se borran en 8.9 a 8.11 | SDD-0587 §3 y §7.7 | Fuera de 6.5 |

**El modelo ya trae todo lo que la carga necesita** (0506, aplicada el 2026-11-04, **C**):
`crm_tarjetas.fuente` admite `kommo` (`0506_crm_modelo.sql:318-320`), `crm_historial_etapas.origen` y
`crm_tareas.origen` admiten `migracion` (`:463`, `:496`), y `crm_ids_externos` mapea lead, contacto, tarea y
usuario con PK por tenant, sistema, tipo e id (`:592-606`). La 0513 aporta `crm_ficha_por_telefono` y
`crm_asesor_activo` (`0513_crm_entrada_leads.sql:62`, `:80`). **No hace falta migración.**

**El patrón de E5 que se copia** (SDD-0590, `infra/ops/kommo-historial/`): solo lectura en Kommo, ensayo con
la imagen real y datos inventados en Actions, modo seco que cuenta lo mismo que la carga, salida de solo
conteos, mutantes, y cada paso con datos reales con su OK. Lo que cambia: aquí no hay staging ni archivos,
porque la fuente y el destino viven en la misma base. **Los datos no salen del servidor de la base.**

## 2. La fuente: el espejo (**C**)

| Tabla | Migración | Columnas que lee |
|---|---|---|
| `kommo_leads` | 0082, 0391 | `id`, `status_id`, `responsible_user_id`, `kommo_created_at`, `kommo_updated_at`, `closed_at`, `last_inbound_at`, `last_outbound_at`, `last_message_origin` |
| `kommo_lead_contacts` | 0362 | `lead_id`, `contact_id`, `is_main` |
| `kommo_contacts` | 0082, 0363 | `id`, `name`, `phone_last10` (generada) |
| `kommo_tasks` | 0390 | `id`, `entity_type`, `entity_id`, `responsible_user_id`, `text`, `complete_till`, `is_completed` |
| `kommo_users` | 0139 | `id`, `email` |
| `clients` | 0108, 0342 | `id`, `kommo_lead_id`, `kommo_contact_id`, `deleted_at`, y el teléfono por `crm_ficha_por_telefono` |
| `auth.users`, `user_tenants` | — | Correo y si el usuario sigue activo en el tenant |

No lee `kommo_contacts.phone` ni `email`, los `custom_fields` ni `kommo_unsorted`: los no clasificados no son
leads (0343) y la fuente detallada sale de `last_message_origin`.

## 3. Alcance y mapa de etapas

Un lead entra si **todas** se cumplen, en este orden (cada descarte tiene su conteo):

1. No es ganado (142) ni perdido (143), y `closed_at` es nulo → si no, `leads_cerrados`.
2. Se creó antes del corte → si no, `leads_despues_del_corte`.
3. Su actividad, la mayor de `kommo_updated_at`, `last_inbound_at`, `last_outbound_at` y `kommo_created_at`,
   cae en los 180 días anteriores al corte → si no, `leads_fuera_de_ventana`.
4. Su etapa está en el mapa → si no, `leads_etapa_desconocida`. No se adivina.

| Kommo (embudo «Ventas DTD», 14036567) | `status_id` | Etapa del tablero Leads (SDD-0587 §4.3) |
|---|---|---|
| Incoming leads | 108343827 | `nuevo` |
| Contacto inicial | 108343831 | `contactado` |
| Recontacto | 108343835 | `registrado_recontacto` (se ve como «Recontacto», SDD-0614 §2.9) |
| Estimado enviado | 108343839 | `estimado_enviado` |
| Negociación | 109855104 | `negociacion` |

Ids leídos de la API el 2026-08-06 (`docs/runbooks/kommo-consolidacion-embudo-unico.md:84-92`, **D**). La
etapa 6, «Aceptado, esperando carga», no tiene par abierto en Kommo: allí aceptar es «Logrado con éxito», que
es cerrado. **I:** si el embudo cambió después de agosto, el conteo `leads_etapa_desconocida` lo muestra en el
seco y se ajusta el mapa antes de cargar.

## 4. Qué hace el cargador

`supabase/cargas/crm-kommo/carga.sql` define `pg_temp.crm_carga_kommo(tenant, corte, días)`, que muere con la
sesión. `correr.sh` la llama dentro de una transacción y termina en `rollback` (seco) o `commit` (cargar). Un
candado de sesión por tenant impide dos cargas a la vez.

1. **Asesores.** Cada usuario de Kommo con correo se mapea al usuario de Studio con el mismo correo, sin
   mayúsculas ni espacios, **solo si hay exactamente uno y está activo en el tenant**. Si no, queda sin par.
2. **Leads**, del más reciente al más viejo. Para cada uno en alcance:
   1. Si ya está mapeado, solo se miran sus tareas nuevas (paso 3).
   2. **La persona:** su contacto principal (`is_main`, y si no, el de id menor). **La ficha:** la viva con
      `kommo_lead_id` = el lead; si no, la única viva con `kommo_contact_id` = el contacto; si no, la única viva
      con su teléfono (`crm_ficha_por_telefono`). Una ficha borrada no cuenta.
   3. **La tarjeta:** la del contacto ya mapeado; si no, la de la ficha; si no hay ficha, la **única** tarjeta
      viva sin ficha con esos 10 dígitos. Con dos o más, `leads_ambiguos`: no se carga.
   4. **Si hay tarjeta**, gana su etapa (§5). Solo se le completa el asesor si no tiene y se sube la última
      actividad si la de Kommo es más nueva.
   5. **Si no hay**, se crea con `fuente = 'kommo'`, `fuente_detalle` = el canal del último mensaje, la etapa
      del mapa, el asesor mapeado y la actividad. Nombre visible y últimos 10 dígitos **solo sin ficha** (D6).
      Sin ficha ni teléfono no hay cómo ubicarla (check de la 0506): `leads_sin_ubicador`. Deja una fila de
      historial con `origen = 'migracion'`.
   6. **Mapeo:** el lead y su contacto apuntan a la tarjeta. Un segundo lead de la misma persona apunta a la
      misma (`leads_misma_persona`); por el orden, la etapa la fijó el más reciente.
3. **Tareas abiertas del lead** que todavía no se migraron: texto recortado a 1.000 caracteres (vacío →
   «Tarea de Kommo»), vencimiento (un `complete_till` más de 20 años después del corte es el vencimiento en
   milisegundos de la 0390, que significa «nunca vence»: queda nulo) y el asignado mapeado si sigue activo.
   No se migran las completadas ni las de contactos.
4. **Comprobación:** ningún mapeo de lead o contacto queda sin tarjeta del tenant. Si no, la transacción aborta.

**Salida:** solo pares `clave=valor` con conteos (las claves están en el contrato). Nunca ids de fichas, nombres,
teléfonos, correos ni textos.

## 5. Conflictos (SDD-0587 §5.3)

| Caso | Regla |
|---|---|
| La persona ya tiene tarjeta de Studio (Chatwoot, `/registro`, portal o manual) | **Gana la tarjeta**: no cambia etapa, fuente ni atribución. Se completa el asesor vacío (D-6.5-1) |
| Dos leads abiertos de la misma persona | Una tarjeta; etapa del lead con actividad más reciente; tareas de los dos |
| Teléfono que cruza con dos o más fichas | Sin ficha, como E2-D19; la tarjeta queda sin ligar |
| Teléfono que cruza con dos o más tarjetas sin ficha | No se carga; queda en `leads_ambiguos` para revisar a mano |
| La ficha ligada al lead está borrada | No cuenta; se busca por contacto y teléfono |
| Asesor de Kommo sin par o desactivado | Tarjeta sin asesor |
| Una escritura crea la tarjeta de esa ficha en medio de la carga | `on conflict do nothing` y gana la otra |

## 6. Idempotencia y modo seco

- **Idempotente por `crm_ids_externos`.** Correrla dos veces con el mismo corte no cambia nada (el contrato
  compara una huella de las cuatro tablas). Una tarea nueva en un lead ya migrado entra en la corrida
  siguiente, y solo ella.
- **El seco es la misma función** en una transacción que se deshace: cuenta exactamente lo que la carga haría,
  con los datos de ese momento. El contrato lo corre dentro de un savepoint y prueba que no deja nada.
- **Límite conocido:** anonimizar una tarjeta borra sus mapeos (`0506_crm_modelo.sql:781`). Repetir la carga con
  el mismo corte después de una anonimización podría volver a crearla. No es un uso previsto: la carga es una
  vez, al corte, y anonimizar pide 12 meses sin actividad (**I**).

## 7. Datos personales (revisar-datos-ve)

Estados de la skill: **ENCONTRADO**, **CORRECTO** o **NO VERIFICABLE**. Esto no es asesoría legal.

| Dato | De dónde a dónde | Quién lo ve |
|---|---|---|
| Nombre visible y últimos 10 dígitos | `kommo_contacts` → `crm_tarjetas`, solo sin ficha | Admin y comercial (RLS de la 0506) |
| Texto de las tareas abiertas | `kommo_tasks.text` → `crm_tareas.texto` | Igual |
| Asesor | `kommo_users.email` = `auth.users.email`, solo para mapear; el correo no se copia | — |
| IDs de Kommo | → `crm_ids_externos`, solo `service_role` | Nadie desde la app |

| # | Punto | Estado | Comentario |
|---|---|---|---|
| 1 | Inventario | CORRECTO | Tabla de arriba; la prueba estática fija que solo escribe en cuatro tablas `crm_*` |
| 2 | Minimización | CORRECTO | Con ficha no copia nombre ni teléfono (check de la 0506 y aserción); no copia notas ni etiquetas (D5 b), correo ni teléfono completo |
| 3 | Consentimiento | NO VERIFICABLE | Es el mismo dato que ya guarda el espejo con la misma finalidad; la base de licitud la decide Sam con su asesor |
| 4 | Derechos | CORRECTO / NO VERIFICABLE | La tarjeta cargada entra a «Anonimizar ahora» y a la retención de la 6.6 (SDD-0614 §2.7), que no están en main |
| 5 | Borrado | CORRECTO | Al anonimizar se borran sus tareas y mapeos (0506); el espejo se borra en 8.9 a 8.11 |
| 6 | Trazabilidad | CORRECTO | `origen = 'migracion'` en historial y tareas; el acta guarda conteos |
| 7 | Política pública | CORRECTO | `/privacidad` ya dice el plazo de 12 meses sin actividad (`app/privacidad/page.tsx:375`); la carga no agrega datos que el espejo no tenga. Que el texto cubra al lead que venía de Kommo es **I** |
| 8 | Terceros | CORRECTO | No envía nada a nadie: ni Kommo, ni Chatwoot, ni Meta (prueba estática: sin `net.`, `http`, `dblink`, `pg_notify` ni `copy`) |
| 9 | Transferencia internacional | No aplica | Todo queda en la misma base |
| 10 | Decisiones automatizadas | CORRECTO | Solo elige etapa y tablero; no niega servicio |
| 11 | Aceptación electrónica | No aplica | — |
| 12 | Titulares que no son usuarios | CORRECTO | El lead sin ficha: lo mínimo de D6 |

**D-6.5-3** pregunta si el texto libre de las tareas se copia o se reemplaza por uno fijo.

## 8. Pruebas

| Comprobación | Dónde |
|---|---|
| Contrato con la 0503 a la 0506 y la 0513 reales, espejo con datos inventados y el cargador real: seco, carga, segunda corrida, tarea nueva y preflight | `supabase/tests/crm_carga_kommo.test.sql`, en Postgres 17 por `sql-tests.yml` en Actions |
| El mismo contrato en PGlite, control rojo, 17 mutantes y la prueba estática | `lib/studio/__tests__/crm-carga-kommo.migration.test.ts`, en Vitest |

**Resultado en la PC** (2026-11-08, con turno del Subdirector, `--maxWorkers=1`): **PASÓ, 20 de 20**, en 27 s.
El contrato da verde, el control rojo cae y caen los 17 mutantes. Cinco caen en una aserción vecina de la que
los nombra, y la prueba lo dice: pisar la etapa cae en «el lead más reciente fija la etapa»; el orden invertido,
en el conteo por etapa; repetir tareas, en la PK de `crm_ids_externos`; la ficha borrada, en el conteo del seco;
y pisar el asesor, en el conteo de asesores. Dos mutantes sobrevivían a la primera versión del contrato: un
ganado sin `closed_at` y una tarjeta que ya tenía dueño. Los dos casos se sumaron al contrato.
**En Actions** corre «Contratos SQL» en la PR: no se corrió Docker en la PC.

**Ensayo.** El ensayo con datos inventados es este contrato. Corre en una base efímera que se deshace con
`rollback`, en Actions, como el cargador de E5.

El ensayo con datos reales es otra cosa: va en una copia efímera de la base, con su OK (§9, paso 2).

**Que no se confunda con una migración:** el candado (`migrations-lock.mjs`), el gate de símbolos
(`check-pending-migration-symbols.mjs`), la numeración y el ledger leen solo `supabase/migrations/`. Por eso
`supabase/cargas/` queda fuera, como `supabase/desarmes/`. «Contratos SQL» sí levanta
`crm_carga_kommo.test.sql`, y eso es a propósito: es un contrato, con el mismo preludio y el mismo `rollback` que
los demás. `sql-tests.yml` se dispara también con `supabase/cargas/**`.

## 9. Procedimiento al corte (E8), cada paso con su OK

1. **L1, solo conteos en producción** (SDD-0587 §8, «Lecturas vivas propuestas»): leads por etapa y por
   antigüedad de la actividad, para confirmar D4 y el mapa. OK de Sam: es lectura de producción.
2. **Ensayo en una copia efímera** de la base, en el VPS: restaurar el respaldo, correr `seco`, `cargar` y otra
   vez `cargar`, guardar solo los conteos y destruir la copia. OK de Sam: la copia tiene PII. Muestra revisada
   con Sam, como 5.6.
3. ⛔ **Seco en producción**, justo antes de cargar: `correr.sh seco`. Lee filas de clientes: pide OK, y la salida son solo conteos.
4. ⛔ **Carga**: `correr.sh cargar --confirmo-ok-de-sam`. **OK nominal de Sam.** Antes, el respaldo de la base.
5. **Acta**: conteos por etapa y objeto antes y después (SDD-0587 §7.6), sin ids ni nombres.

El corte lo fija el instante de 8.2. La extracción final del espejo (8.5) va antes que el paso 3.

## 10. Coordinación

| Con | Qué | Estado |
|---|---|---|
| **10.5**, PR 1c (`crm_tarjeta_ubicar_o_crear`, E10-D30) | La pieza única para ubicar o crear la tarjeta es por ficha y teléfono, para eventos de uno en uno. El cargador ubica primero por el mapeo y por el espejo, que esa pieza no conoce, y no la llama. Cuando esté en main se revisa si su camino por ficha puede reemplazar el insert del paso 2.5 sin cambiar las reglas de §5 | La 1c no está en main (`git grep` en `supabase/`: 0) |
| **6.6**, migración A (SDD-0614 §3) | El trigger de auditoría de `crm_tarjetas` registraría cada tarjeta creada como `system`, sin PII. Las columnas `ultimo_entrante_at` y `ultima_respuesta_at` se podrían llenar desde `last_inbound_at` y `last_outbound_at` (D-6.5-4) | Sin escribir |
| **6.6**, migración B (R9, `phone_full`) | Si se aplica antes de la carga, el cargador podría guardar el teléfono completo de la tarjeta sin ficha para Recuperación (D-6.5-5) | Sin escribir |
| **No se tocan** | `TarjetaFichaDrawer`, `CrmTableroKanban`, `tarjeta-actions`, `crm-ficha`, `lib/studio/chatwoot/portal*` y `app/studio/(app)/conversaciones/**` | — |

## 11. Decisiones

| # | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| D-6.5-1 | Tarjeta que ya existe | (a) Completar solo el asesor vacío y la última actividad · (b) no tocarla | **(a)**: no pisa nada y el lead de Kommo trae dueño |
| D-6.5-2 | Persona sin ficha que ya escribió por Chatwoot | (a) Ligar por los 10 dígitos si hay exactamente una tarjeta sin ficha con ellos · (b) solo por ficha, aunque quede duplicada | **(a)**: una tarjeta por persona (SDD-0587 §4.1); `crm_buscar_tarjeta` (0513) no cruza por teléfono a las tarjetas con contacto, y por eso el cargador lo hace aparte |
| D-6.5-3 | Texto de las tareas | (a) Copiarlo, recortado · (b) un texto fijo y el vencimiento | **(a)**: D4 incluye las tareas abiertas y sin el texto no sirven; ya viven en la misma base |
| D-6.5-4 | Con la migración A aplicada, ¿llenar `ultimo_entrante_at` y `ultima_respuesta_at`? | (a) Sí, desde `last_inbound_at` y `last_outbound_at` · (b) no | **(a)**, si la A va antes: «Sin atender» funciona desde el primer día. Pide un cambio del cargador cuando la A exista |
| D-6.5-5 | Con la B aplicada, ¿guardar el teléfono completo del lead sin ficha? | (a) Sí, desde `kommo_contacts.phone` · (b) no | **(a)**, por D-6.6-8 = b; con la B y sus textos publicados |
| D-6.5-6 | Ventana | (a) 180 días antes del corte (D4) · (b) otra, según L1 | **(a)** hasta ver L1 |

## 12. Allowlist exacta

| Archivo | Qué |
|---|---|
| `docs/specs/0616-crm-carga-leads-desde-espejo/spec.md` | Esta SDD |
| `supabase/cargas/crm-kommo/carga.sql` | El cargador |
| `supabase/cargas/crm-kommo/correr.sh` | El lanzador, seco o cargar |
| `supabase/cargas/crm-kommo/README.md` | Cómo se usa |
| `supabase/tests/crm_carga_kommo.test.sql` | El contrato |
| `lib/studio/__tests__/crm-carga-kommo.migration.test.ts` | PGlite, control rojo, mutantes y estática |
| `.github/workflows/sql-tests.yml` | Dispara «Contratos SQL» también con `supabase/cargas/**` |
| `.agents/handoffs/0616-crm-carga-leads-desde-espejo.md` | Handoff |

## 13. Aceptación de 6.5

- [ ] Diseño aceptado por el Director General, con D-6.5-1 a D-6.5-6.
- [x] Contrato verde en PGlite, con el control rojo y los 17 mutantes (§8).
- [ ] Contrato verde en Postgres 17, en «Contratos SQL» de la PR.
- [ ] L1, ensayo en copia, seco y carga en producción, cada uno con su OK (§9).
- [ ] Acta con conteos antes y después.

## 14. Fuera de alcance detectado

- `docs/runbooks/kommo-salesbots-inventario.md` dice que «500 KG por CBM es FALSO». Para el material que va al
  cliente la regla son 500 kg/m³ y los 1.000 de la calculadora son una excepción temporal. Pasa a la 6.7 y a la
  base de 7.4.
- Fusionar dos tarjetas de la misma persona sigue fuera (SDD-0614 §12). La carga no lo resuelve: deja los
  ambiguos contados.

## 15. Seguimiento

- **2026-11-08:** el Director General reservó el número 0616, con el stub `c764cf399`, y confirmó que va sin migración. SDD, cargador y pruebas en borrador. No se cargó nada, no se leyó producción y no hay migración.
