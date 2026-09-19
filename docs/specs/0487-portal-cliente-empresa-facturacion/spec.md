---
sdd: "0487"
title: "Portal cliente — foto visible, empresa propia y «Facturar a nombre de», que el Studio usa al emitir"
status: in-progress
author: "Claude + founder"
created: 2026-09-18
updated: 2026-09-19
supersedes: null
superseded_by: null
related: ["0482", "0483", "0439", "0298", "0138", "0131", "0095", "0128"]
confidencialidad: interna
---

# SDD-0487 · El perfil del cliente: foto, datos, empresa y a nombre de quién se factura

Reserva de número y de migración (`0466`) hecha por el Director `dtdcargo-18`
sobre `cc15e48c` (commit `12d192d4`). La spec la escribe la sesión
`dtdcargo-74`, que heredó la tarea de `dtdcargo-63`.

## El pedido (Sam, 2026-09-18)

> El cliente edita su foto y su perfil él mismo. Un cliente que se registró como
> persona, con su cédula, más adelante quiere que le facturen a nombre de su
> empresa. Tiene que poder agregar la empresa desde su perfil: razón social, RIF
> y los datos de la empresa. Y elegir si le facturamos a nombre personal o a
> nombre de la empresa. Hoy el registro inicial pregunta si es persona o
> empresa, y después no hay forma de tener las dos. Su código de cliente
> (Shipping Mark) no cambia. El Studio usa esa preferencia al facturar.

También reportó: «Yo no logro cambiar la foto».

## Decisiones de Sam (2026-09-19, respuestas literales en AskUserQuestion)

| Pregunta | Respuesta | Descartó |
|---|---|---|
| «Foto de perfil: ¿qué ves cuando intentas cambiarla?» | «No encuentro dónde» | Elijo la foto y nada · Sale un error · Sube pero se ve rota |
| «¿Desde dónde lo intentaste?» | «PC con Windows» | iPhone · Android |
| «Empresa: ¿qué datos son obligatorios para agregarla?» | «Razón social + RIF (Recomendado)». La opción decía: «Domicilio fiscal, teléfono y correo de facturación quedan opcionales». | + domicilio fiscal · + domicilio y foto del RIF |
| «Un cliente que se registró como empresa, ¿puede facturar a nombre personal?» | «Sí, con su nombre y cédula (Recomendado)» | No, sólo a la empresa |
| «¿Agregar o cambiar la empresa gasta del cupo de 3 cambios del perfil?» | «Nada gasta». La opción decía: «La empresa queda fuera del cupo: se agrega y se corrige libremente». | Agregar no, corregir sí (recomendada) · Todo gasta |
| «Si el RIF de la empresa ya lo tiene otro cliente, ¿qué pasa?» | «Bloquear y avisar (Recomendado)». Igual que en la 0482: mensaje genérico, no se guarda, no gasta cupo y el asesor recibe el aviso con los dos Shipping Marks. | Permitir y avisar |
| «En el Studio, ¿el operador puede cambiar el titular de una factura puntual?» | «Sí, en el borrador». La opción decía: «El borrador trae la preferencia del cliente y el operador puede elegir personal o empresa antes de emitir. Queda auditado». | No, manda el cliente (recomendada) |

### Confirmaciones de Sam (2026-09-19)

Sam respondió «Apruebo el mockup; sí a los puntos 2 al 6». Los puntos eran:

| # | Punto | Queda así |
|---|---|---|
| 1 | Mockup | Aprobado tal como está en el enlace de abajo |
| 2 | RIF repetido | Nadie puede saltarse la unicidad. El asesor resuelve a mano: fusiona las fichas o corrige la que no corresponde. Que dos cuentas facturen a la misma empresa queda fuera de alcance. |
| 3 | Cuenta registrada como empresa | Cargar o corregir su nombre y su cédula tampoco gasta cupo |
| 4 | Datos de la empresa | Razón social y RIF obligatorios, y domicilio fiscal opcional. No se piden teléfono ni correo de facturación. |
| 5 | Botones nuevos | «Quitar foto» y «Quitar empresa». Las facturas emitidas conservan su copia. |
| 6 | Intentos bloqueados | Se borran a los 90 días |

**Datos de la empresa (confirmado, punto 4).** Sólo se pide lo que se usa, por
minimización: razón social y RIF, obligatorios, y domicilio fiscal, opcional,
que sale impreso en la factura.

## Diagnóstico de la foto (evidencia)

1. **Causa confirmada por Sam: no se encuentra.** El control es un botón de texto
   de 12,5 px («Cambiar foto» o «Subir foto de perfil») al lado de un círculo de
   56 px que no es clicable (`app/portal/(app)/perfil/AvatarEditor.tsx:28-86`).
   El área táctil queda por debajo de 24 px, bajo el mínimo de WCAG 2.5.8. El
   Norte dibuja otra cosa: un avatar de 92 px con un botón de cámara de 30 px
   (`docs/design/studio/_norte/portal/app.jsx:2584-2592`).
2. **Latente: fotos grandes.** La UI promete 8 MB (`lib/portal/client-photo.ts`,
   `PHOTO_MAX_BYTES`) y `bodySizeLimit` es 12 MB (`next.config.ts:200`). Pero
   Vercel corta el cuerpo de una función a 4,5 MB antes de que corra la action.
   El cliente vería la pantalla de error del Portal en vez de un mensaje. No lo
   reprodujo Sam: queda como riesgo documentado en el handoff de 0482.
3. **Latente: HEIC.** El `accept` incluye `image/heic` y el bucket lo admite. Una
   foto del iPhone se guarda en HEIC y sólo Safari la muestra. En Chrome o Edge,
   el círculo queda roto.
4. **Latente: EXIF.** Se guardan los bytes originales, con la ubicación GPS del
   teléfono si la trae (`lib/portal/client-photo.ts:119-121`).
5. **Servidor en orden** (catálogo de producción, 2026-09-19, sólo lectura):
   existe `get_portal_private_profile_context` (0405), `authenticated` puede
   ejecutarla, existe `clients.avatar_path` y el bucket `client-docs` acepta 8 MB
   y los cinco tipos de imagen.

## Hallazgo que esta SDD corrige: la RPC 0128 emite sin sello

`sales_order_claim_and_invoice`
(`supabase/migrations/0128_sales_order_invoicing_hardening.sql:330-345`) inserta
facturas con `status = 'emitida'` y no escribe `client_rif` ni `client_doc_kind`.
El sello de la SDD-0298 vive sólo en TypeScript (`documentoDelCliente`, en
`app/studio/(app)/facturacion/actions.ts:376-380` y `:547-550`); la 0392 sólo
agregó las columnas. Esta SDD lleva el sello a la base: un solo trigger para
todos los caminos de emisión.

## Contrato funcional · Portal (`/portal/perfil`)

Se diseña primero para el teléfono. Mockup:
<https://claude.ai/artifact/AZq49fnikwS6uA7hXzapf9>.

### Orden de la pantalla

1. Tu foto y tu código.
2. Datos personales.
3. Mi empresa.
4. Facturar a nombre de.
5. Direcciones de entrega.
6. Tu Shipping Mark para tus proveedores.

### Foto

1. El avatar mide 112 px en el teléfono y 128 px en escritorio. Lleva un botón de
   cámara de 44 × 44 px con `aria-label="Cambiar foto de perfil"`, y debajo un
   botón visible «Cambiar foto» de 48 px de alto. Los dos abren el selector de
   archivos.
2. El navegador decodifica la foto, la reduce a 1024 px en su lado mayor y la
   vuelve a codificar como JPEG. Eso descarta el EXIF y deja la foto por debajo
   de 1 MB. Mientras tanto se lee «Preparando tu foto…» (`role="status"`).
3. Si el navegador no puede leer la foto (por ejemplo, HEIC en Chrome para
   Windows), el mensaje dice: «No pudimos leer esa foto. Elige otra o conviértela
   a JPG.» (`role="alert"`). No se sube nada.
4. El servidor acepta para el avatar sólo `image/jpeg` de hasta 2 MB. Además
   quita los segmentos APP1 (EXIF y XMP) antes de subir, porque no confía en el
   navegador.
5. Con foto cargada aparece «Quitar foto», que borra el objeto y deja
   `avatar_path` en `null`. Pide confirmación en dos pasos.
6. La foto no gasta cupo. Tampoco cambia la foto de la cédula (SDD-0481).

### Datos personales

- **Cuenta registrada como persona:** nombre, cédula y teléfono (edición directa
  de la 0482, dentro del cupo), más el correo en lectura. Sin cambios de
  comportamiento.
- **Cuenta registrada como empresa:** el bloque muestra «Tus datos personales» con
  nombre y cédula de quien opera la cuenta. Si faltan, ofrece «Agregar mis datos
  personales». No gastan cupo (punto 3).

### Mi empresa

- **Sin empresa:** «¿Importas para tu negocio?», la explicación y el botón
  «Agregar empresa». Reemplaza el enlace a WhatsApp de hoy.
- **Agregar o editar** (pantalla completa en el teléfono):
  - razón social, obligatoria, de 2 a 200 caracteres;
  - RIF, obligatorio: letra V, E, J, G o P, 8 dígitos y dígito final (el mismo `RIF_REGEX` del registro y de la 0462). Se acepta
    con o sin guiones y se guarda canónico, `J-12345678-9`;
  - domicilio fiscal, opcional, hasta 300 caracteres;
  - la casilla «Facturar a nombre de esta empresa», marcada por defecto al
    agregarla por primera vez.
- **Quitar empresa:** confirmación en dos pasos. Si la preferencia era la
  empresa, vuelve a la persona. Las facturas emitidas conservan su copia.
- **No gasta cupo** (decisión de Sam).
- **RIF de otra ficha** (en `clients.rif` o en la empresa de otro cliente del
  tenant): no se guarda. Aparece el mensaje genérico de la 0482, «No pudimos
  guardar ese dato. Escríbenos por soporte y lo revisamos». Se registra el
  intento sin el valor (`field = 'company_rif'`) y se avisa al asesor con los
  dos Shipping Marks. Cuenta para el límite de 5 bloqueos en 24 h de la 0462:
  al pasarlo, se rechaza cualquier cambio de documento, teléfono o RIF de
  empresa.

### Facturar a nombre de

- Radios en tarjetas con `fieldset` y `legend`. Cada opción muestra el nombre y el
  documento que saldrán en la factura.
- La opción que no tiene identidad cargada queda deshabilitada y dice qué falta:
  «Primero agrega tu empresa» o «Agrega tu nombre y tu cédula».
- Cambiarla no gasta cupo y se guarda al elegir. El resultado se anuncia con
  `role="status"`.
- Texto fijo: «Aplica a tus próximas facturas. Las que ya emitimos no cambian».

## Contrato funcional · Studio

1. **Ficha del cliente** (`clientes/[markbox]`): muestra en lectura la empresa y
   la preferencia. El Studio no edita la empresa del cliente en esta SDD.
2. **Borrador de factura:** un bloque «Titular de la factura» con las dos
   opciones, si existen. La marcada por defecto es la preferencia del cliente.
   Queda una vista previa «Así sale en la factura». Si el operador elige
   distinto, se guarda `invoices.bill_to_kind` y, al emitir, se registra un
   evento de auditoría con el tipo elegido, la preferencia vigente, el actor y
   la hora, sin PII.
3. **Emisión:** se congela el titular elegido. Van `client_name`, `client_rif` y
   `client_doc_kind` (0392) y la columna nueva `client_fiscal_address`. Aplica
   a todos los caminos de emisión: `createInvoice` con emisión inmediata,
   `emitInvoice` y la RPC 0128 `sales_order_claim_and_invoice`, que hoy emite
   sin congelar el documento (fuera de alcance detectado en 0482).
   Cuando el Shipping Mark resuelve a un cliente, el nombre que el operador
   escribió en el borrador se reemplaza al emitir por el del titular. Hoy el
   nombre sale del formulario y el RIF del cliente, y pueden no coincidir; con
   esto, nombre y documento salen de la misma identidad. Si el Shipping Mark no
   resuelve a ningún cliente, la factura se emite como hoy: con el nombre
   escrito y sin documento.
4. **Facturas emitidas:** el titular no se puede cambiar. Un trigger de base
   rechaza cambios de esas cuatro columnas y de `bill_to_kind` cuando
   `OLD.status` no es `borrador`. Nada más queda congelado: los escritores
   posteriores a la emisión siguen igual, y el contrato los recorre uno por uno.
   Son los recibos (0122), la confirmación de reportes (0195/0359), los comandos
   de reporte (0421 y 0464), la anulación (`void_invoice_with_audit_reason`,
   0294), el vencimiento, el renombre de Shipping Mark (0367 y 0371, sobre
   `client_markbox`) y Cobranzas (0467). Para la 0467 el contrato ejecuta las
   mismas escrituras que hacen sus RPC, según las líneas que confirmó el Worker
   de la SDD-0488 (`0467_cobro_factura_atomico.sql:239-240`, `:319-320` y
   `:389`): UPDATE de `paid_amount`, `status` y `last_payment_at`, y `parcial`
   → `emitida` al anular. La factura sellada no se vuelve a sellar y el titular
   no cambia; el mutante que quita la inmutabilidad lo detecta. Las RPC reales no
   corren en este contrato: el preflight de la 0467 exige el cuerpo de
   producción de `get_user_tenant_id` y el fixture de 0421 trae un stub. La
   interoperabilidad real va como seguimiento (Fuera de alcance).
5. **PDF y Libro de Ventas:** imprimen lo congelado. El PDF suma la línea del
   domicilio fiscal si existe.

## Persistencia · migración `0466_client_billing_identity.sql`

Nombre tentativo, que se fija al escribirla.

- **`public.client_billing_identities`:** la identidad **secundaria** del
  cliente, la del tipo opuesto a `clients.doc_kind`.
  - Columnas: `id`, `tenant_id`, `client_id`, `kind` (`persona` o `empresa`),
    `legal_name`, `doc`, `fiscal_address`, `is_billing_default`, `created_at`,
    `updated_at`, `updated_by`.
  - Unicidad: `unique (client_id, kind)` y un índice único parcial sobre
    `(tenant_id, upper(regexp_replace(doc, '[^A-Za-z0-9]', '', 'g')))`, la misma
    normalización que `clients_tenant_doc_unique` (0095).
  - RLS activa, sin grants API. La leen el Studio (staff del tenant, sólo roles
    VE) y el Portal por RPC de sesión.
- **Unicidad cruzada con `clients.rif`:**
  - la RPC del Portal toma un `pg_advisory_xact_lock` por `(tenant, doc
    normalizado)` y comprueba las dos tablas;
  - un trigger en `clients` (BEFORE INSERT OR UPDATE OF `rif`) rechaza, con
    `unique_violation`, un documento que ya sea identidad secundaria de **otro**
    cliente.
  - Así quedan cubiertos el registro, la 0462 y el Studio sin tocarlos.
- **Preferencia sin tocar `clients`:** la columna
  `client_billing_identities.is_billing_default` (`true` = facturar a la
  identidad secundaria). Sin fila o en `false`, se factura a la del documento
  principal. Así se evita un `ALTER TABLE clients`.
- **`invoices`:** `bill_to_kind` (elección del borrador, `null` = preferencia) y
  `client_fiscal_address` (congelado).
- **Trigger en `invoices`:** SECURITY DEFINER con `search_path` vacío, BEFORE
  INSERT OR UPDATE.
  - Sella sólo en `INSERT` con `status = 'emitida'` o en `UPDATE` con
    `OLD.status = 'borrador'` y `NEW.status = 'emitida'`. Nunca vuelve a
    sellar: la anulación de un recibo de Cobranzas (0467) devuelve `parcial` a
    `emitida` sin pasar por `borrador`.
  - Resuelve el cliente vivo por `(tenant_id, client_markbox)`. Si no hay
    cliente, deja lo que trae la fila, como hoy (`documentoDelCliente`), y no
    falla.
  - Elige el tipo: `bill_to_kind`, si no la preferencia (`is_billing_default`),
    si no `doc_kind`.
  - Si el tipo resuelto es el del documento principal, usa `clients`; si no, la
    identidad secundaria.
  - Congela las cuatro columnas.
  - Si `OLD.status` no es `borrador`, rechaza cambios de esas cuatro columnas y
    de `bill_to_kind`. Nada más.
- **RPCs de Portal** (SECURITY DEFINER, cliente por sesión, EXECUTE sólo
  `authenticated`):
  - `portal_upsert_my_billing_identity(p_kind, p_name, p_doc, p_fiscal_address,
    p_set_default)`;
  - `portal_delete_my_billing_identity(p_kind)`;
  - `portal_set_my_billing_kind(p_kind)`, que mueve `is_billing_default`.
  - Devuelven `outcome` (`applied`, `no_changes`, `blocked`, `rate_limited`),
    nunca datos de otro cliente.
- **Purga a 90 días (punto 6):** `service_role` recibe DELETE sobre
  `client_profile_blocked_attempts`, y `app/api/cron/purge-throttle/route.ts`
  borra al final las filas con más de 90 días.
- **Auditoría del override:** el trigger de emisión llama a
  `append_audit_event` con la entidad `invoice` y el evento
  `invoice_bill_to_override`. Guarda sólo el tipo elegido y la preferencia,
  sin PII. `audit_d2_invoices` (0290) sigue igual.
- **Reuso de 0462:** `client_profile_blocked_attempts` acepta `field =
  'company_rif'` y `'personal_doc'`, y el límite de 5 en 24 h cubre los tres
  campos.
- **Locks** (se miden en PGlite antes de publicar, como en la 0462):
  - las FK nuevas toman SHARE ROW EXCLUSIVE sobre `tenants`, `clients` y
    `auth.users`;
  - los triggers nuevos, sobre `clients` e `invoices`;
  - todo hasta el COMMIT, con `lock_timeout 5s`.
- **Migrate-first estricto, con gate de símbolos** (elección aprobada por la
  coordinación). La 0466 se aplica antes de integrar. Las RPC y la tabla nuevas
  se declaran en `supabase/pending-migration-symbol-declarations.json`, con la
  degradación de cada sitio: sin 0466, el Portal oculta «Mi empresa» y
  «Facturar a nombre de», y las actions devuelven «No está disponible ahora».
  El TypeScript deja de sellar en esta misma PR. Desplegado sin 0466, emitiría
  sin sello, como hoy la RPC 0128: por eso el orden no es opcional, y lo dicen
  la espera del baseline y el Release.

## Lectores del dato

- **Portal:** el perfil y la factura del cliente (`lib/portal/portal-queries.ts:305`,
  que ya lee lo congelado).
- **Studio:** la ficha del cliente, el borrador, la emisión, el PDF
  (`lib/studio/pdf/factura-pdf.tsx`) y el Libro de Ventas
  (`lib/studio/fiscal/queries.ts`, que desde 0482 lee lo congelado).
- **No lo leen:** Kommo (`supabase/functions/kommo-push-client/index.ts:158` sigue
  enviando sólo `rif` y `doc_kind` del cliente) ni los módulos CN.

## Datos personales · revisión VE/CN (`revisar-datos-ve`)

Reporte completo:
[`docs/legal/privacidad/revision-0487-perfil-empresa-2026-09-19.md`](../../legal/privacidad/revision-0487-perfil-empresa-2026-09-19.md).
Lo que esta SDD resuelve:

- **H1:** EXIF fuera de la foto de perfil.
- **H2:** «Quitar foto».
- **H3:** la foto en el registro de tratamiento y en el mapa de borrado.
- **H4:** una línea sobre datos de facturación en `/privacidad`, con el texto
  aprobado por Sam.
- **Requisitos:** fuera de Kommo, fuera de CN y la auditoría del override sin
  PII.

- **H7:** el cron diario de purga borra los intentos bloqueados con más de 90 días (punto 6).

## Gobernanza

- Cambios de comportamiento en el Studio (borrador, emisión, ficha): allowlist
  exacta según `docs/governance/AGENT-BRIEF.md`. Se fija al implementar y se
  copia abajo.
- La UI sustancial del Portal pasa por `/ui-check`.
- Marca: tokens del Portal, Sora/Nunito (BD-035) y JetBrains Mono para RIF,
  cédula y Shipping Mark. Sin colores nuevos. Estados según la política del
  2026-09-05.

## Allowlist exacta

Cambios de comportamiento del **Studio** (`docs/governance/AGENT-BRIEF.md`):
- `app/studio/(app)/facturacion/actions.ts`: deja de sellar en TypeScript, recibe `bill_to_kind` sólo con el selector en pantalla y suma `lookupInvoiceBillingOptions`.
- `app/studio/(app)/facturacion/_components/InvoiceDrawer.tsx` y `InvoiceTitularPicker.tsx` (nuevo): el titular del borrador.
- `app/studio/(app)/facturacion/[code]/pdf/route.ts` y `lib/studio/pdf/factura-pdf.tsx`: el domicilio fiscal sellado en el PDF.
- `app/studio/(app)/clientes/[markbox]/page.tsx` y `_components/ClientBillingCard.tsx` (nuevo): la empresa y la preferencia en la ficha, en lectura.
- `lib/studio/invoice-billing.ts` (nuevo) y `lib/studio/invoice-client-doc.ts`: sale `documentoDelCliente` y entra `domicilioFiscalSellado`.
- `lib/studio/change-request-notify.ts`: el aviso de bloqueo suma `company_rif` y `personal_doc`.

**Portal:**
- `app/portal/(app)/perfil/`: `page.tsx`, `AvatarEditor.tsx`, `avatar-actions.ts`, `billing-actions.ts`, `BillingIdentityCard.tsx`, `BillingKindSelector.tsx`, `empresa/page.tsx` y `empresa/BillingIdentityForm.tsx`.
- `app/portal/(app)/facturas/[code]/pdf/route.ts`.
- `lib/portal/`: `avatar-image.ts`, `jpeg-metadata.ts`, `billing-identity.ts`, `billing-profile-context.ts` y `client-photo.ts`.

**Cron:** `app/api/cron/purge-throttle/route.ts`.

**Público:** `app/privacidad/page.tsx`, en un commit aparte (`8c5c6c6a`). Sam aprobó el texto el 2026-09-19: «Apruebo el texto de privacidad».

**Base:** `supabase/migrations/0466_client_billing_identity.sql`, `supabase/tests/0466_client_billing_identity.test.sql`, `supabase/migrations-baseline.json` (la espera) y `supabase/pending-migration-symbol-declarations.json` (dos grupos).

**Docs:** esta spec, `docs/specs/README.md` y `docs/legal/privacidad/` (`revision-0487-…`, `registro-tratamiento.md`, `mapa-de-borrado.md`, `README.md`).

**Pruebas:**
- `lib/portal/__tests__/{avatar-image,jpeg-metadata,billing-identity,billing-identity.migration}.test.ts`;
- `app/portal/(app)/perfil/{AvatarAction,BillingAction}.test.ts` y `BillingControls.test.tsx`, más el mock nuevo en `page.private-context.test.tsx`;
- `lib/studio/__tests__/invoice-billing.test.ts` y `app/api/cron/purge-throttle/__tests__/route.test.ts`.

## Verificación (worktree, 2026-09-19)

| Comprobación | Resultado |
|---|---|
| Contrato SQL de 0466 en PGlite: cadena real 0421 → 0464 → 0392 → 0445 → 0462 → 0466 | PASÓ: 45 aserciones |
| Control rojo sin 0466 · preflight sin la entidad client de 0293 | PASÓ: fallan como deben |
| Mutantes SQL: inmutabilidad, RIF congelado, sello en UPDATE, elección del borrador, unicidad cruzada, conflicto con clients.rif, límite 5/24 h, rol de lectura y auditoría sin documento | 9/9 muertos |
| Escritores sobre facturas selladas: `resolve_payment_report` (0421+0464), `void_invoice_with_audit_reason` (0294), recibos (0122), parcial → emitida con las mismas escrituras de las RPC de la 0467 (líneas 239-240, 319-320 y 389), vencimiento, `due_date` y renombre de Shipping Mark | PASÓ |
| Locks en PostgreSQL 17 (Docker) | Medidos en la cabecera: DDL de 20-31 ms; peor caso de 5 s con una lectura larga abierta |
| Vitest del Portal (perfil, `lib/portal`), Studio (facturación, clientes, fiscal), cron y copia legal | PASÓ |
| Mutantes TypeScript con control verde previo | 10/10 muertos |
| typecheck · ESLint focal · rsc-boundary · pending-migration-symbols (0 rojos, 2 amarillos declarados) · docs:check · sdd:check | PASÓ |
| `/ui-check` | OK con ajustes menores; aplicados en `fix(portal): SDD-0487 — ajustes de /ui-check` |
| `pnpm verify` completo | Sobre `732eb65b` (2026-09-19, turno de dtdcargo-18), exit 1. PASÓ: harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols, sql-tests (207 en postgres:17, incluido el contrato de 0466), schema-rebuild, e2e (168 pasaron, 18 omitidas) y build. FALLÓ `test`: invoice-read-boundary era real (el inventario de lecturas de facturas, corregido en `e4f4f6b1`), y PackingListProductsStep y ClientDrawer.confirm-delete son intermitentes conocidas. Aisladas, con la CPU al 1 %: PASÓ 9/9, 9/9 y 3/3. NO EJECUTADO: migrations-applied (SKIP, el worktree no tiene credenciales). |
| Prueba visual en el teléfono y en escritorio | NO DISPONIBLE: requiere sesión del Portal y la 0466 aplicada; va en el smoke de Sam |

## Verificación exigida

1. Contrato SQL de 0466 en PGlite:
   - la cadena real hasta 0462 → 0466;
   - un control rojo sin 0466;
   - mutantes de: unicidad cruzada en los dos sentidos, congelado al emitir por
     las tres vías (incluida la RPC 0128), inmutabilidad del titular emitido,
     RPC por sesión y límite de bloqueos.
2. Vitest:
   - las actions del Portal (empresa, preferencia, foto y quitar foto);
   - el procesamiento de imagen, con controles rojos (HEIC ilegible → mensaje y
     cero subidas; EXIF removido);
   - el editor y los radios accesibles;
   - el borrador y la emisión en el Studio;
   - el PDF con el domicilio.
3. Mutantes TypeScript con control verde previo.
4. `pnpm verify` completo, con turno del Director.
5. Prueba visual en el teléfono (390 px) y en escritorio (1280 px), con `/ui-check`.

## Release

**`0466` aplicada a producción** por la sesión coordinadora (dtdcargo-18), con el OK nominal de Sam. Ledger `20260919030533 0466_client_billing_identity`, aplicada a las 03:05:33Z del 2026-09-19. La identidad coincide con el blob `33caa919` (md5 `5d2416b1095de7ab0695e98c87abe9c4`, 30024 bytes). Sale de `pendingBelowCutoff` y de las declaraciones de símbolos. La cabecera del `.sql` no se toca: el ledger guarda su texto exacto.

Evidencia de la aplicación (la reportó dtdcargo-18; el Worker no tocó producción):

- **OK nominal de Sam:** «Autorizo 0466_client_billing_identity (Recomendado)». Se aplicó por el
  conector con `apply_migration` y el nombre exacto `0466_client_billing_identity`. Antes de aplicar,
  la transcripción se comparó con `cmp` contra el blob `33caa919`.
- **Ledger:** una sentencia; `md5(array_to_string(statements,''))` = `5d2416b1095de7ab0695e98c87abe9c4`,
  30024 bytes, idéntico al blob.
- **Preflight en producción** (sólo catálogo, antes de aplicar):
  - pasaron todas las condiciones del `DO`;
  - el CHECK de la 0462 estaba en `document`/`phone`;
  - las dos entidades de auditoría estaban activas;
  - los objetos nuevos no existían;
  - a las 03:04:16Z había 0 sesiones activas, 0 transacciones abiertas y 0 locks en `invoices`,
    `clients`, `client_profile_blocked_attempts` y `tenants`.
- **Postflight de catálogo:**
  - **`client_billing_identities`:**
    - RLS encendida y sin forzar; owner `postgres`.
    - ACL: `authenticated` y `service_role` sólo con SELECT; `anon` sin privilegios; nadie tiene
      INSERT, UPDATE ni DELETE.
    - Policy `client_billing_identities_studio_select`: SELECT para `authenticated`, con
      `tenant = get_user_tenant_id()` y rol accounting, admin o commercial.
    - Índices: `pkey`, `one_per_client` y `tenant_doc_unique (tenant_id, billing_doc_norm(doc))`.
      Tiene 9 constraints.
  - **Triggers:** `clients_doc_not_billing_identity_elsewhere` (BEFORE INSERT OR UPDATE OF rif,
    deleted_at ON clients) e `invoices_seal_billing_titular` (BEFORE INSERT OR UPDATE ON invoices).
    Los dos con `tgenabled = O`.
  - **`invoices`:**
    - `bill_to_kind` y `client_fiscal_address` son `text`, nullable, sin default y con comentario;
    - el CHECK `invoices_bill_to_kind_valido` quedó validado.
  - **`md5(prosrc)`:** los 7 coinciden con el archivo:
    - `billing_doc_norm` `4f62f68b…` (IMMUTABLE, INVOKER);
    - `clients_doc_not_billing_identity_elsewhere` `590409c6…`;
    - `invoices_seal_billing_titular` `fa7ef245…`;
    - `portal_get_my_billing_profile` `4b6b5cda…` (STABLE);
    - `portal_upsert_my_billing_identity` `99b7ad71…`;
    - `portal_delete_my_billing_identity` `aadf7350…`;
    - `portal_set_my_billing_kind` `8df08e2e…`.
  - **Seguridad de las funciones:**
    - todas con `search_path=""` y owner `postgres`; las otras 6 son DEFINER;
    - las 4 RPC tienen EXECUTE sólo para `authenticated`;
    - los 2 triggers no tienen EXECUTE para `anon`, `authenticated` ni `service_role`;
    - `billing_doc_norm` conserva el EXECUTE de PUBLIC por default. Es una observación que no
      bloquea: la función es pura y no lee datos (ver Fuera de alcance).
  - **`client_profile_blocked_attempts`:**
    - el CHECK queda en `document`/`phone`/`company_rif`/`personal_doc`;
    - `service_role` tiene DELETE; `anon` y `authenticated` no.
- **Advisors:**
  - **Seguridad:** `authenticated_security_definer_function_executable` pasa de 179 a 183, y los 4
    nuevos son exactamente las 4 RPC del Portal. Nada más aparece ni desaparece: `anon` sigue en 22 y
    `rls_enabled_no_policy` en 30.
  - **Rendimiento:** hay 1 nuevo atribuible a la 0466, `unindexed_foreign_keys` en
    `client_billing_identities_updated_by_fkey` (INFO). Va como seguimiento en Fuera de alcance.

1. ~~OK nominal de Sam para `0466` y aplicación en baja actividad, antes de
   integrar la PR~~: hecho el 2026-09-19 (arriba). El orden no era opcional (ver
   Persistencia). Hasta el merge, producción corre la 0466 con el código
   anterior:
   - ese código sella en TypeScript y no manda `bill_to_kind`, así que el trigger
     vuelve a sellar encima con la preferencia del cliente;
   - sólo escribe el titular en borrador o al emitir (en `main`,
     `facturacion/actions.ts` corta si el estado no es borrador), así que la
     inmutabilidad no lo frena.
2. Merge a `main`, que despliega a producción.
3. Smoke de Sam:
   - cambiar la foto desde la PC y quitarla;
   - agregar una empresa de prueba y elegir «a nombre de mi empresa»;
   - en el Studio, emitir un borrador de ese cliente y ver el titular en el PDF;
   - intentar el RIF de otra ficha de prueba: mensaje genérico y aviso al asesor.

## Fuera de alcance

- El historial ampliado en el Studio (SDD-0483).
- La foto de perfil en el encabezado del Portal.
- EXIF en la foto de la cédula (`lib/portal/client-photo.ts:77-79`).
- El registro de empresa que guarda el contacto en `notes`
  (`app/registro/actions.ts:270-275`).
- El borrado de cliente que no alcanza Storage (0455).
- La verificación del RIF contra SENIAT.
- Dos cuentas que facturan a la misma empresa.
- **Seguimiento:** interoperabilidad real de la 0466 y la 0467 aplicadas en
  cadena, con las tres RPC de Cobranzas sobre facturas selladas. `schema-rebuild`
  ya prueba que las dos se aplican en orden; falta el comportamiento. El Director
  lo asigna al Worker de las carreras.
- **Seguimiento (advisor de rendimiento, INFO):** la FK
  `client_billing_identities_updated_by_fkey` no tiene índice. Hoy la tabla
  tiene como mucho una fila por cliente y `updated_by` sólo se usa al borrar un
  usuario de `auth.users`. Lleva su propia migración si el Director la prioriza.
- **Observación del postflight:** `billing_doc_norm(text)` conserva el EXECUTE
  de PUBLIC que Postgres da por default. Es pura (IMMUTABLE, INVOKER) y no lee
  datos, así que no expone nada. Si se quiere el mismo criterio que las RPC, el
  `revoke` va en una migración nueva: la 0466 ya está aplicada y no se edita.
