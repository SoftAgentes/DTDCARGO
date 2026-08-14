---
sdd: "0258"
title: "Historial de Shipping Mark (renombrar sin perder nada) y sub-insignias por aliado"
status: draft
author: "Sam (founder) + Claude"
created: 2026-08-13
updated: 2026-08-13
supersedes: null
superseded_by: null
related: ["0042", "0051", "0054", "0093", "0116", "0159", "0240", "0246", "0250", "0255"]
confidencialidad: interno
---

# SDD-0258 — Historial de Shipping Mark y sub-insignias por aliado

> **Por qué existe este documento.** El 2026-08-13 se midió el costo real de
> renombrar un Shipping Mark. La medición tomó 26 agentes y produjo 72 hallazgos.
> Escribirla acá es más barato que volver a pagarla. **Nada de lo que sigue se
> asume: cada número tiene su consulta o su `archivo:línea`.**

## 1. Los dos pedidos del founder

**Pedido 1 — editar el Shipping Mark, con historial.** Un cliente puede cambiar
de código. El viejo **no se borra**: queda reservado para él, sigue resolviendo
si llega carga rotulada con él, y se muestra como historial en su ficha. Sólo uno
es el actual. Caso real: `ALEXANDRA CLEMENTE` arrastra `DTD-D000`, de la era de
los códigos de vendedor. Motivación de fondo: **pasar los ~351 clientes del
legado a códigos nuevos.**

**Pedido 2 — varias insignias por aliado.** `DC` (Dynasty Cargo) es la insignia
principal de Alexandra. Ella hizo alianzas con otras puerta a puerta suyas y
quiere darle a cada una su propia insignia, para los clientes de cada una.

## 2. Estado medido en producción (2026-08-13)

`project_ref xpfuzqombmjmxvprjgmi` · 446 clientes vivos · 1 tenant.

| Familia de Shipping Mark | Fichas |
|---|---|
| `DTD-<letra>NNN` — códigos de VENDEDOR del legado | 351 |
| `DTD-NNNN` — serie de la casa (máx. `DTD-9062`) | 75 |
| Forma libre: `ITS-01..04`, `AD-001`, `AD002`, `bncvcc` | 7 |
| Minúsculas `DTD-jNNN` (legado, mismo origen) | 13 |

Aliados: **1** (`DC` · Dynasty Cargo · raíz · activo) con **0 clientes colgando**.
Portal: 73 activos, **14 invitados sin estrenar** — Alexandra es uno de ellos.
Fusiones ya hechas: 2 (2026-08-12).

### 2.1 El caso Alexandra es el más barato posible

`DTD-D000` aparece en **2 filas de toda la base**: su ficha y 1 dirección de
entrega. Cero envíos, cero facturas, cero prealertas, cero cajas, cero QR.

Y los 351 del legado, en conjunto, tocan **una sola tabla** además de `clients`:
`client_delivery_addresses` (271 códigos). Cero envíos, cero facturas, cero cajas.

> **Consecuencia:** la migración masiva que quiere el founder es segura. Lo que
> NO es seguro es dejar el botón suelto para un cliente **con** historia.

## 3. El campo de tiro de un renombrado

### 3.1 Cuántas columnas — el número correcto es 33

Se dijeron tres números distintos en el camino (33, 34, 38). El correcto:

```
38  columnas cuyo nombre contiene markbox
-2  kommo_connections.markbox_field_id / markbox_contact_field_id → son bigint,
    guardan el ID del campo de Kommo, NO una marca
-2  vistas (supplier_scorecard_v, clients_phone_no_normalizable) → se recalculan
-1  clients.markbox → es el original, no una copia
────
33  COPIAS del Shipping Mark (31 text + 2 arrays), en 32 tablas
```

**Cero foreign keys por markbox.** `pg_constraint` con `markbox` devuelve 4 filas
y ninguna es `contype='f'`. No hay integridad referencial que frene ni avise.

### 3.2 Lo que rompe con error visible (2 cosas)

| Qué | Dónde |
|---|---|
| Reportar el pago de una factura anterior | trigger `payment_reports_validate_invoice` |
| Pedir un add-on sobre una prealerta en curso | trigger `prealerta_service_request_guard` |

### 3.3 Lo que rompe EN SILENCIO (el problema real)

**El portal del cliente se vacía.** 32 políticas RLS sobre 20 tablas comparan
`client_markbox = get_portal_client_markbox()` por igualdad de TEXTO, y esa
función lee el markbox **vivo**:

```sql
select c.markbox from client_users cu join clients c on c.id = cu.client_id
 where cu.auth_user_id = auth.uid() and cu.status = 'active' limit 1
```

El cliente sigue autenticado —la sesión cuelga de `client_id`— pero su llave de
lectura cambia bajo sus pies. Facturas, envíos, prealertas, proveedores,
direcciones, reclamos, cursos y diplomas desaparecen. **Sin un solo error.**

Además: ~90 puntos de código comparan el markbox por igualdad; el correlativo de
proveedores (`next_supplier_seq`) reinicia en 1; `accredit_referral_on_first_invoice`
deja de acreditar; la cola de avisos marca `no_destination` y descarta.

### 3.4 🔴 Renombrar puede FILTRAR DATOS entre clientes

Este es el hallazgo grave y no es un enlace roto, es un incidente.

- `clients_tenant_id_markbox_key` es UNIQUE `(tenant_id, markbox)` **sin filtro de
  `deleted_at`** — por eso una ficha fusionada retiene su código y nunca se
  reemite (migr `0341`:14-18).
- Pero `next_markbox` y `next_markbox_service` hacen `max()+1` sobre las filas
  **vivas**. Un renombrado **no deja ninguna fila** ocupando el valor viejo.

> Si se renombra al cliente que tiene el número más alto de su familia, el
> contador **retrocede** y el próximo cliente nuevo recibe exactamente el código
> liberado — y hereda las filas huérfanas del anterior. Por las 32 políticas del
> portal, **ve su historia**.

### 3.5 🔴 La aceptación legal es una trampa por los dos lados

- Si el renombrado **reescribe** `legal_acceptances.client_markbox` →
  `rowHashVerified` (`lib/studio/legal/queries.ts:307`) recomputa distinto y la
  aceptación se descarta como forjada.
- Si **no** lo reescribe → `hasValidAcceptanceForMarkbox` (`:493`) filtra con el
  código nuevo y no encuentra nada.

Por los dos caminos el cliente pierde su aceptación, y con
`LEGAL_GATE_HARD_BLOCK=true` no se le puede facturar. La tabla es **append-only
por trigger** (`legal_acceptances_immutable_trg`), así que "arreglarlo con un
UPDATE" ni siquiera es posible: revienta antes.

Hoy hay **0 aceptaciones en producción**. Es el momento barato para decidirlo.

### 3.6 Lo que queda obsoleto y NO se puede reparar con SQL

| Dónde | Estado | Nota |
|---|---|---|
| Kommo | El código viaja en el NOMBRE del lead (`${nombre} · ${markbox}`) y en 2 campos custom | No existe op de renombrado en `kommo-writeback`. Deuda hoy: 1 lead |
| Correos ya enviados | 73 de 334 llevan el código dentro | **Nunca se reescriben** — es el registro de lo que se envió |
| Etiquetas y mensajes a Yiwu | El proveedor ya rotuló | Sólo se cubre con período de gracia |
| Storage `client-docs` | 35 de 35 objetos cuelgan de una carpeta con el markbox | No rompe el acceso (la ruta está guardada), pero la carpeta miente |
| `comments.entity_code` | Snapshot **inmutable por trigger** (`0090`:39,231) | La bandeja de menciones no se recompone nunca |

### 3.7 Lo que le da IGUAL (para no gastar esfuerzo ahí)

`/track` (busca por `shipments.code`) · los enlaces de acceso al portal y al
Studio (van por `client_id`/`user_id`) · el CRM y el móvil (leen el markbox
**vivo**, no un snapshot) · las 2 vistas · las políticas de Storage (ninguna
menciona markbox).

**El patrón a copiar:** donde el sistema usó un id opaco, el renombrado no duele.

## 4. Por qué el alias NO alcanza

`resolve_markbox` sigue `merged_into_client_id` hasta 10 saltos y ya existe. Pero
resuelve **la mitad del problema**:

| | Alias | Backfill |
|---|---|---|
| El código **viejo** encuentra al cliente (caja rotulada, QR impreso) | ✅ | ❌ |
| El sistema, preguntando con el código **nuevo**, encuentra las filas viejas | ❌ | ✅ |

El portal pregunta con el **nuevo**. Por eso hacen falta **las dos mitades**.

Y hay dos trampas más:

1. `resolve_markbox` funciona porque la fusión **deja una fila** con el código
   viejo. Un `update` no deja ninguna → devuelve vacío.
2. El truco de la ficha-tumba está **prohibido por trigger** justo para este caso:
   `clients_guard_no_merge_aliado` (migr `0362`:399-432) rechaza fusionar un
   aliado — y Alexandra **es** aliada.
3. `resolve_markbox` está cableada en **1 de 74 lugares** (sólo la recepción de
   Yiwu). Y `/verificar` filtra `deleted_at is null`, así que ni siquiera rescata
   las fusiones: **esa promesa de la 0341 ya está incumplida hoy.**

## 5. Diseño propuesto — `rename_client_markbox()`

Una RPC `security definer`, atómica, con la forma de `merge_clients` (que es el
único patrón multi-tabla del repo que reasigna un cliente):

1. `assert_studio_role()` **de primero** — sin permiso ni se puede sondear qué
   códigos existen usando el error como oráculo.
2. `assert_tenant_match()` + lock determinista por id.
3. **Escribir el par (viejo, nuevo) ANTES de tocar nada.** Ningún trigger audita
   hoy el cambio; sin esto el rollback es imposible.
4. **Backfill de las 33 copias en la misma transacción**, enumeradas a mano (los
   2 arrays necesitan `array_replace`, no `=`).
5. **Quemar el código viejo** para que el correlativo no lo reemita (§3.4).
6. **`legal_acceptances` NO se toca** — decisión explícita (§3.5). El gate pasa a
   resolver por `client_id`.
7. Devolver `jsonb` con bloque `needs_review`, como `merge_clients`.
8. Encolar el `patch_lead`/`patch_contact` de Kommo como parte del renombrado.

**La técnica precedente es la migr `0256`** (rename del enum `shipment_service`),
que documenta el barrido uno por uno de cada clase de objeto dependiente — no la
`0353`, que sólo guardó una columna de respaldo.

**La action debe entrar por `client_id`, no por markbox.** Hoy
`updateClientAction` (`clientes/actions.ts:265`) usa como llave justo el valor que
habría que cambiar, y hay 12 actions más con la misma firma.

**Y hay que cerrar un hueco propio:** `clients_guard_markbox_aliado` valida el
formato de la cadena sólo `if tg_op = 'INSERT'` (`0362`:303). En UPDATE no
comprueba nada.

## 6. Sub-insignias — funciona HOY, sin tocar la base

El modelo jerárquico ya está construido y **medido**: ni `next_markbox_aliado` ni
`aliado_prefix_chain` mencionan `client_id`.

```
DC-FA-1232   ← guardado: el Studio sabe que cuelga de Alexandra
   FA-1232   ← impreso: el cliente de FA no sabe de quién cuelga
```

**El camino que ya funciona:** se le abre ficha de cliente a la otra puerta a
puerta, se entra a su ficha y se usa *Convertir en aliado* con *Cuelga de: DC*.
Cuesta un número de la casa por sub-aliado, que es inofensivo — Alexandra misma
es `DTD-D000`.

### 6.1 🔴 La trampa: NO le pongas el correo de Alexandra a esa ficha

`client_users` no tiene índice único por email, y `portal_bind_session`
(`0080`:167-169, viva en prod **sin `order by`**) resuelve el amarre con `limit 1`
entre las filas `invited` que comparten correo.

**Alexandra está en `invited` y nunca ha entrado.** Una ficha con su correo puede
capturar su primer ingreso al portal y meterla en la ficha equivocada.

### 6.2 Lo que se descartó, y por qué

| Idea | Veredicto |
|---|---|
| Varias insignias sobre la MISMA ficha | Bloqueado por `aliados_client_uq`. Además degeneraría el `Map` de `ClientsClient.tsx:260`, que se quedaría con la insignia alfabéticamente última en vez de la principal |
| `client_id` nullable (insignia sin ficha) | Posible (el UNIQUE es NULLS DISTINCT) pero cuesta migración + superficie nueva en el Studio + 9 puntos de código. No hace falta hoy |
| Tabla hija `aliado_prefixes` | Rompe `aliado_prefix_chain` y `next_markbox_aliado` |

## 7. 🔴 Deudas descubiertas de paso (no son de este SDD, pero están vivas)

1. **La tarifa del aliado es decorativa.** `invoices` no tiene `client_id` ni
   `aliado_id` — guarda `client_markbox`/`client_name` como texto más
   `shipment_id`. `rates` no tiene dónde colgar una tarifa de aliado. El
   `billing_model` es una etiqueta de pantalla.
2. **`/verificar` no reconoce la forma impresa.** Para un cliente de sub-aliado,
   `FA-1232` no existe en la base (ahí está `DC-FA-1232`). El QR funciona porque
   lleva la forma guardada; **tecleado a mano da "No reconocemos este Shipping
   Mark"**. Introducido por SDD-0255. Hoy 0 afectados; muerde al primero.
3. **`referralShareCode` está roto para aliados.** `"REF-" + markbox.replace(/^DTD-/, "")`
   (`fidelizacion/types.ts:162`) con `DC-FA-1232` da `REF-DC-FA-1232`, y la vuelta
   arma `DTD-DC-FA-1232`, que no existe.
4. **`countClientesPorAliado` es código muerto** — cero consumidores.

## 8. Criterios de aceptación

- [ ] Renombrar un cliente **no** cambia lo que ve en su portal.
- [ ] El código viejo sigue resolviendo (`/verificar`, recepción Yiwu, búsqueda).
- [ ] El código viejo **nunca** se reemite: se prueba renombrando al del máximo y
      verificando que el siguiente alta **no** recibe el liberado.
- [ ] La ficha muestra el historial de códigos, con cuál es el actual.
- [ ] `merge_clients` y `rename_client_markbox` conviven sin pisarse.
- [ ] Cada contrato SQL se valida **con mutación**: se rompe la protección a
      propósito y el test debe ponerse **rojo**. Verde con la protección rota =
      decorado, no se mergea.

## 9. Lección de método (para el próximo barrido)

El barrido original mandó a verificar **8 de 22** hallazgos dudosos por un
`slice(0, 8)` en el script, y reportó "completado" igual. De los 8: 3 confirmados,
5 imprecisos. Al levantar el tope, los 14 restantes dieron **3 refutaciones
completas** — y las tres estaban en el frente de las sub-insignias, o sea justo
en lo que se iba a construir.

**Regla:** un tope de cobertura que no se imprime en el resultado convierte una
medición parcial en un informe que parece completo. Si se acota, se dice — y se
dice **en el resultado**, no en el código.
