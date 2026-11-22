# Handoff · SDD-0704 F1-A · Pantalla «IA»: costo de la Oficina, cuentas y tarifas

- Fecha: 2026-11-21 · Worker para Dir_DTD
- Rama: `claude/sdd-0704-f1-pantalla-ia` · Base: `origin/main` `3e983481f`
- Carril: revisión previa (migración, despachador, montos de costo, permisos).

## Hecho

- **§15 de la spec:** allowlist exacta de la fase 1 (F1-A 0570, F1-B 0571). Pantalla solo del superadmin (Dir_DTD);
  módulo `ia` por persona (0639 D-6) y Faro (0637 D-3) quedan para otra PR. Enmienda de la D-5 con el texto de Sam:
  «Pantalla IA: opción A, pedir la contraseña otra vez; y abre después la SDD de verificación en dos pasos».
- **Migración 0570** (sin aplicar):
  - `ia_catalogo_modelos`, sembrada y con el origen atado al proveedor;
  - `ia_cuentas` (tipo de cobro; plan fijo con tope de llamadas; una sola Oficina y nunca china);
  - `ia_modelos` (tarifa por modelo, con llave foránea al catálogo);
  - `ia_topes` (techo de 15 USD para la Oficina);
  - `task_events.tokens_entrada` y `tokens_salida`;
  - funciones de escritura solo para el superadmin, con motivo y auditoría con método;
  - barrera única `ia_exigir_aal2_si`: AAL2 o contraseña de menos de 5 minutos (`amr`).

  También: contrato `.test.sql` (13 puntos), desarme y espera en `migrations-baseline.json`.
- **Despachador:** lee `ia_costo_oficina` en cada tick. Usa el tope efectivo recortado al techo, la tarifa del modelo
  que respondió (`modelo_usado`, si no la más alta declarada, si no el `.env`) y el plan fijo (0 USD y pausa por
  llamadas), y escribe los tokens. Sin la 0570 vuelve al `.env` y avisa una vez; si la base falla, no corre nada. La
  ruta del cron no se tocó.
- **Pantalla `/studio/admin/ia`:** dos pestañas. «Gasto»: uso por modelo, tope, barra con aviso al 60 y al 80 %, y
  formulario del tope. «Cuentas y tarifas»: tipo de cobro, tope de llamadas y tarifa de cada modelo del catálogo. La
  tarjeta va en Administración › PRO. Para aflojar el freno la pantalla pide la contraseña, y el servidor reautentica.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| 0570 en PGlite (contrato, control rojo y 28 mutantes) | PASÓ 30/30 |
| `lib/studio/ia/__tests__`, despachador y costo | PASÓ |
| Regresión del cable (`oficina-paso3b`, `lib/studio/oficina/__tests__`, ruta del cron) | PASÓ 244/244 |
| Pantalla: `app/studio/(app)/admin/ia/__tests__` + `lib/studio/ia` | PASÓ 41/41 |
| `tsc --noEmit` | PASÓ (tras corregir un tipo) |
| eslint de lo tocado | PASÓ |
| `check-pending-migration-symbols` | PASÓ: 0 ROJO, 3 AMARILLO declarados |
| `page-gates-sensibles` | PASÓ tras darle gate propio a `admin/ia/page.tsx` (b86a13b2f) |
| `rbac-actions-guard` | PASÓ 507/507 con superficie 88, exactos 61 e inventario 502 (75f4557c1; §15 enmendada con OK de Dir_DTD) |
| `/ui-check` | OK con ajustes menores: corregido el doble envío; queda el espaciado en px fijos |

`pnpm verify` completo (local, Windows, 2026-11-21): exit 1, 16 de 17 pasos corrieron. Por paso:

| Paso | Resultado |
|---|---|
| harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols, sql-tests, build | PASÓ |
| test | FALLÓ: 2 propios (los dos de arriba, ya corregidos) y 4 ajenos por carga o tiempo (`infra/ops/tests/migraciones.test.mjs`, `scripts/__tests__/entorno-prueba-scripts.test.mjs`, `kpi-cifra-en-tinta-contract`, `correo-comprobacion`), más un worker de vitest que no arrancó (`GuiaMotor.test.tsx`) |
| schema-rebuild | FALLÓ, preexistente y ajeno: muere en `0552_registro_portal_por_link.sql:628` (`au.last_sign_in_at` no existe en el doble de `auth.users`), tras 519 migraciones y antes de la 0570. La rama no toca la 0552 ni `scripts/check-schema-rebuild.mjs`. Ningún workflow de GitHub corre este paso, así que no hay CI de `main` que citar; el último «Calidad continua» verde de `main` es el run 44974252762 (`1b35bab62`) |
| e2e | FALLÓ por entorno: 74 de los 76 fallos son de WebKit, que no está instalado en esta PC (`ms-playwright/webkit-2388`); los otros 2 son de `ficha-chat.spec.ts` en Chromium (sitio público, ajeno); 3 flaky en `auth.spec.ts`; 166 pasaron |
| migrations-applied | NO DISPONIBLE: el worktree no tiene `.env` (a propósito) |

El portón es el CI de GitHub.

### Revisión de la #763 (CHANGES_REQUESTED sobre `213a19d62`)

- **B1:** cambiar el `uso` de una cuenta hacia la Oficina o desde ella ahora cuenta como aflojar y pide la barrera. Se
  cubre con el contrato 4 (sacar de la Oficina, mismo uso, meter una cuenta del ERP en plan fijo, con y sin AAL2, y
  sin evento cuando se rechaza) y con el mutante «cambiar el uso no afloja».
- **M1:** `ia_exigir_aal2_si(null)` falla cerrada (solo un `false` explícito pasa sin barrera). Contrato 13 y mutante.
- **M2:** la 0570 tiene postflight: tablas con RLS, sin escritura de `anon` ni `authenticated`, sin lectura de `anon`,
  columnas de tokens, y las 13 funciones con `search_path` vacío y sin EXECUTE de `anon`.
- **M3:** documentado en `actions.ts` por qué no se cierra la sesión anterior: `signOut({ scope: "others" })` cerraría
  también las sesiones del usuario en sus otros equipos.
- **M4:** `leerNumero` rechaza «1.000» sin coma (ambiguo) y sigue aceptando «0.125» y «1.000,00». Con su prueba.
- **M5:** los fixtures del entorno pasan a valores inventados (tope 6, tarifas 7 y 29).
- **M6 y M7:** esta tabla y el pendiente de staging, abajo.

## Pendiente de esta tarea

La #763 entró a `main` el 2026-11-22 (`a6c24cc36`). **La 0570 no está aplicada en ningún lado.** Antes de pedir el OK
hay que hacer la prueba de `amr` (paso 1 de la lista).

- F1-B (0571: cadena de A1 y A2, clasificador, pestaña «Funciones»): en curso en `claude/sdd-0704-f1b-cadena`; ver la sección F1-B al final.

### Lista para pedir el OK nominal de la 0570 (runbook `aplicar-migraciones-prod.md` §2 y §3)

1. **Prueba de `amr`, antes del OK (NV hoy).** No necesita la 0570. En el entorno de prueba que nombre Sam o Dir_DTD,
   con un superadmin de prueba: entrar con correo y contraseña, decodificar el JWT de acceso (sin pegar el token en
   ningún lado; basta leer los campos `aal` y `amr`) y ver que `amr` trae un objeto con `method: "password"` y
   `timestamp` en segundos de hace menos de un minuto. Repetirlo después de un refresh del token y anotar si el
   `timestamp` se conserva (debe ser la hora de la contraseña, no la del refresh). Si `amr` no trae eso, aflojar el
   freno queda bloqueado siempre (falla cerrado) y hay que volver a la D-5 con Sam antes de aplicar.
2. **Qué es.** `supabase/migrations/0570_ia_catalogo_y_costo.sql`, SDD-0704 F1-A, PR #763. Blob
   `118dd0022c776590cdb58a608a3fd7dac9e2b711` en `main`, md5 `c3fa477c15ac2d3516b77ebfb448a73d`, 40.193 bytes, sin
   CR. Estos valores se copian otra vez de `preparar.mjs --sha <cabeza>` antes de pedir el OK, nunca de aquí.
3. **Qué crea.**
   - Tablas nuevas, vacías salvo el catálogo: `ia_catalogo_modelos` (7 modelos sembrados), `ia_cuentas`, `ia_modelos`
     e `ia_topes`. Todas con RLS: solo el superadmin de su tenant las lee; nadie las escribe directo.
   - Dos columnas nuevas, con valor nulo, en `task_events`: `tokens_entrada` y `tokens_salida` (sin reescribir la
     tabla; no tocan filas existentes).
   - 13 funciones con `search_path` vacío: 5 de escritura de la pantalla (superadmin, motivo, barrera y auditoría),
     `ia_gasto_del_mes` para la pantalla, 3 del despachador (solo `service_role`) y 4 de apoyo y triggers.
   - El tipo `ia_config` en `audit_entity_types`.
   - Preflight y postflight propios; `lock_timeout` de 5 s.
4. **Orden.** La PR ya está fusionada, así que no es migrate-first. El código en producción tolera que falte: el
   despachador sigue con el `.env` (avisa una vez «falta la 0570») y la pantalla «IA» muestra que falta la migración.
   Aplicarla no cambia nada del despachador hasta que alguien guarde una configuración en la pantalla. Lo único que
   cambia solo es que el despachador empieza a escribir los tokens de cada llamada.
5. **Lectura previa** (`aplicar-remoto.sh … --paso previa`): solo lee el ledger, los locks y el preflight. Va con la
   ruta de su evidencia en el pedido.
6. **Cómo se vuelve atrás.**
   - Si falla antes del COMMIT, no queda nada (una sola transacción).
   - Para deshacerla después: `supabase/desarmes/0570_desarme.sql`, que no tiene número. Se copia a
     `supabase/migrations/` con el siguiente número libre y va con su PR y su propio OK nominal. Se pierden la
     configuración de la pantalla y los tokens por llamada; quedan el costo de cada llamada, el modelo usado y la
     auditoría. El despachador vuelve al `.env`. Está ensayado en el contrato 12.
7. **Qué ve Sam después (smoke, como superadmin; nadie más ve la pantalla):**
   - `/studio/admin/ia`, pestaña «Gasto»: gasto del mes por modelo (vacío al principio), el tope de la Oficina con
     origen «entorno» y la barra de uso.
   - Pestaña «Cuentas y tarifas»: vacía. Al crear la cuenta de la Oficina y su primera tarifa, la pantalla pide la
     contraseña (es aflojar: el previo es el `.env`).
   - Bajar el tope no pide contraseña; subirlo, sí.
   - En `/studio/admin/oficina-virtual` nada cambia (su tope sigue saliendo del `.env`; ver FUERA DE ALCANCE).

## FUERA DE ALCANCE DETECTADO

- `app/studio/(app)/admin/oficina-virtual/vista/page.tsx:84` muestra el tope del entorno; con la 0570 puede no coincidir
  con el de la pantalla.
- El Studio no tiene verificación en dos pasos: la SDD la abre Dir_DTD (decisión de Sam).
- El espaciado de la pantalla usa px fijos, como la de la Oficina; pasarlo a `var(--s-*)` es una tanda visual aparte.

---

## F1-B · Cadena de hasta tres modelos para A1 y A2

- Fecha: 2026-11-22 · Worker para Dir_DTD
- Rama: `claude/sdd-0704-f1b-cadena` · Base: `origin/main` `a6c24cc36` (con la F1-A, #763)
- Carril: revisión previa (migración, permisos, integración con Anthropic).

### Hecho

- **Migración 0571** (sin aplicar):
  - `ia_cadenas`: tenant, función, puesto de 1 a 3, proveedor y modelo, con cuenta opcional.
    - Llave foránea al catálogo de la 0570.
    - Un modelo no se repite dentro de la misma cadena.
    - **D-2:** un disparador copia `datos_clientes` desde la lista fija de funciones con datos, y un CHECK impide usar
      un proveedor chino con datos de clientes. Vale en los tres puestos, aunque se escriba directo a la tabla.
    - Si el puesto nombra una cuenta, esa cuenta tiene que tener el mismo proveedor y ser del mismo tenant.
  - `ia_eventos`: una fila por intento.
    - Guarda el resultado (`ok` o la clase), el status, el código y los tokens.
    - Nunca guarda texto. Solo se agregan filas.
  - `ia_guardar_cadena`: solo el superadmin, con motivo y auditoría con el antes y el después. Solo A1 y A2. No pide
    la barrera, porque cambiar la cadena no afloja el freno (§8).
  - `ia_cadena_de` e `ia_registrar_evento`: para A1, que corre con la sesión de quien redacta. Solo trabajan con el
    tenant de esa sesión y solo con A1.
  - A2 corre en el cron con la clave de servicio. Con los grants mínimos lee la cadena y agrega eventos, sin cambiar
    ni borrar nada.
  - Incluye preflight, postflight, desarme, el contrato `.test.sql` de 8 puntos y la espera en la línea de base.
- **Clasificador** `lib/studio/ia/clasificar-error.ts` (0638 §5.1):
  - Es puro y sigue la precedencia código → status → texto.
  - Trae el catálogo de señales de los cuatro proveedores, que sigue **NV** porque se tomó de la documentación de
    cada uno.
  - Nunca devuelve el cuerpo ni el texto.
  - Lee los errores del SDK de Anthropic por su forma, sin importar el SDK.
- **Cadena** `lib/studio/ia/cadena.ts`:
  - Cada llamada nueva empieza por el 1.º. Salta solo con `proveedor_caido`, `falta_de_pago`, `cuenta_suspendida` o
    `llave_invalida`.
  - Con otra clase relanza el error original, para que la función siga su salida manual de siempre.
  - Si el último puesto también falla, relanza el último error.
  - Leer la cadena o anotar un intento nunca rompe la función: sin la 0571, vale `MODELO_POR_DEFECTO`.
  - El techo de 3 puestos está en el código y en la base.
- **A1** (`noticias-web/actions.ts`): se quitó el `MODEL` fijo. Las 8 llamadas pasan por `crearMensaje`, que recorre
  la cadena con la sesión del usuario.
- **A2** (`lib/news/ceo-brief.ts`): se quitó el `MODEL` fijo. La llamada recorre la cadena con la clave de servicio y,
  si falla, mantiene el brief de respaldo solo con números. La ruta del cron no se tocó.
- **Pestaña «Funciones»** (ahora la primera):
  - A1 y A2 con su 1.º (obligatorio), 2.º y 3.º. Solo ofrece modelos de Anthropic, que es la llave que existe hoy.
  - Muestra la marca de datos en texto y el último salto.
  - Pide motivo. La acción vuelve a validar la D-2 y el orden, y la base lo corta una tercera vez.

### Comprobaciones

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` | PASÓ |
| eslint de lo tocado | PASÓ |
| `check-pending-migration-symbols` | PASÓ: 0 ROJO, 5 AMARILLO declarados (2 de la 0571) |
| 0571 en PGlite (contrato, control rojo y 26 mutantes) | PASÓ 28/28 (tras quitar el prefijo `pg_catalog` del `unnest` de dos arreglos y sumar los menores de la revisión) |
| `lib/studio/ia/__tests__`, `admin/ia/__tests__` y `rbac-actions-guard` (503) | PASÓ 609 |
| Contrato SQL en Postgres 17 con Docker | NO EJECUTADO (lo corre el CI, «Contratos SQL») |
| `/ui-check` de la pestaña | OK con ajustes menores: sin hex, rgba, vino ni voseo. El `gap` 10 pasó a 12 (escala de 4). Quedan los px fijos, como en las otras pestañas. Sin decisión visual nueva |

`pnpm verify` completo (local, Windows, 2026-11-22): exit 1. Por paso:

| Paso | Resultado |
|---|---|
| harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols (0 ROJO), sql-tests, build | PASÓ |
| test | FALLÓ, ajeno y por carga. Primera vuelta: solo los dos timeouts de 600 s de siempre (`entorno-prueba-scripts`, `infra/ops/tests/migraciones`). En el reintento fallaron además `oficina-paso3b`, `PermissionsSection`, `MobileErpClient.fechas-caracas` y `register-error-summary`; corridos aparte pasan 68/68 |
| schema-rebuild | FALLÓ, preexistente y ajeno: muere en la 0552 (`au.last_sign_in_at`), antes de la 0570 y la 0571 |
| e2e | FALLÓ por entorno: los fallos son de WebKit, que no está instalado en esta PC; 166 pasaron |
| migrations-applied | NO DISPONIBLE: el worktree no tiene `.env` |

El portón es el CI de GitHub.

### Pendiente de esta tarea

- La revisión previa de la PR (la lanza Dir_DTD).
- Aplicar la 0571 en producción, después de la 0570, con el OK nominal de Sam.
- **NV:** los códigos y textos de saldo y suspensión de cada proveedor (catálogo del clasificador).
- **Reintentos del SDK dentro de la cadena** (nota de la revisión de la #772): el cliente de Anthropic reintenta por su
  cuenta 2 veces los 5xx, 529 y 429 de cada puesto, así que una caída completa puede sumar hasta 9 llamadas. No lo
  cambié: poner `maxRetries: 0` también quita el reintento del 429 que hoy tienen A1 y A2, y la spec dice que el
  límite de uso se reintenta donde la función ya reintenta (§4.1). Queda para decidirlo con su prueba.
- **Usuario con varias membresías activas** (nota de la re-revisión de la #772). `tenantAdminGate` lee `user_tenants`
  con `limit(1)` y sin orden (`rbac-guard.ts`), así que puede dejar pasar a noticias a quien sea admin en una de sus
  membresías. En cambio, `get_user_tenant_id()` (0453) devuelve null cuando hay más de una activa. Para esa persona,
  `ia_cadena_de` falla y A1 usa el modelo por defecto, e `ia_registrar_evento` falla con `ia:sin_tenant` y no anota.
  La cadena se lo traga sin romper la función. Falla cerrado: nunca lee ni escribe otro tenant. Resolverlo es decidir
  la membresía principal en `rbac-guard`, fuera de esta SDD.
- **Revisión de la #772** (APPROVED con tres menores, ya corregidos):
  - `ia_registrar_evento` exige `is_tenant_admin()`, el mismo permiso del gate de noticias. Tiene contrato 6 y
    mutante.
  - La lista fija del disparador queda atada a `MARCA_DE_LA_FUNCION` con una prueba en `cadena.test.ts`. El contrato
    4 recorre las seis funciones con datos en los tres puestos y con los dos proveedores chinos. Hay un mutante por
    cada función que se quite de la lista.
  - «Último salto» cuenta solo los saltos reales. Para eso `ia_eventos` tiene la columna `salto`, con un CHECK que la
    ata a las clases que saltan, y se lee con una consulta por función.

### Lo que no está: en qué fase lo pone la spec

| Falta | Dónde lo pone la spec | Qué se hizo |
|---|---|---|
| Confirmación con el antes y el después al guardar la cadena | §2.3, boceto de «Funciones»: **F1** | **Recorte de la F1-B.** Hoy se pide el motivo y la auditoría guarda el antes y el después (contrato 3). La confirmación es UI pura dentro de `admin/ia/` y puede ir en una PR corta del carril rápido |
| Contador de saltos del día en la tarjeta «IA» de Administración | §4.4, «mientras la 0638 no exista»: **F1** | **Recorte de la F1-B:** la tarjeta vive en `app/studio/(app)/admin/page.tsx`, que no está en la allowlist de la F1-B. El salto se ve en «Último salto» de la pestaña |
| Purga de `ia_eventos` a los 90 días | 0638 §5.3; la 0704 no la pone en ninguna fase | **Fase posterior:** necesita un cron, que no está en la allowlist. Por ahora la tabla crece unas pocas filas por llamada de A1 y A2 |
| Costo de A1 y A2 | §7 y §11: en la F1 el costo es el de la Oficina; la auto-pausa por función es de la **fase 3** | **Fase posterior.** `ia_eventos` ya guarda los tokens de cada intento |

- Otra nota: el comentario de cabecera de `noticias-web/actions.ts` todavía nombra `claude-sonnet-4-6`. Solo se tocó
  el `MODEL` y su uso, como pide la allowlist.

### FUERA DE ALCANCE DETECTADO

- `app/studio/(app)/admin/oficina-virtual/vista/page.tsx:84` sigue mostrando el tope del entorno (viene de la F1-A).
- La fila editable de la Oficina es la fase 1b y depende de Ofi_Hermes (§6.3).

### Menores de la re-revisión de la #772 (rama `claude/sdd-0704-f1b-menores`)

- El doble de `admin/ia/__tests__/funciones.test.ts` ahora filtra de verdad (`in`, `eq`, `neq`, `order`, `limit`) y
  anota el `limit` de cada consulta. Cinco mutantes sobre `funciones.ts`: quitar el filtro de salto, el de función,
  el orden, el `limit(1)`, y el orden al revés. Los cinco tienen que caer.
- **La 0571 no se toca** (Dir_DTD, 2026-11-22: Sam aprobó aplicar la 0570 y la 0571 con la versión de `main`, y una
  migración aplicada queda sellada por su md5). Quedan aquí como notas, sin cambiar el archivo:
  - `ia_registrar_evento` exige `public.is_tenant_admin()`, que nace en la **0386** (`0386_telegram_rutas_de_alerta.sql`,
    comentario «SDD-0271»). La etiqueta «(0271)» del preflight de la 0571 nombra la SDD, no la migración.
  - `ia_eventos.salto` es true solo cuando la cadena pasó al puesto siguiente; el CHECK `ia_eventos_salto_valido` lo
    ata a las clases que saltan, así que un 429 o la falla del último puesto nunca cuentan.
  - La cabecera de la 0571 y su entrada en `migrations-baseline.json` no mencionan esas dos cosas. La línea de base la
    cambia `retirar-espera.mjs` en la PR de la aplicación.
- Una prueba ata `CLASES_QUE_SALTAN` al CHECK `ia_eventos_salto_valido`, y otra ata `CLASES` al CHECK de
  `resultado`.
- La nota de varias membresías está arriba; la de `maxRetries` sigue pendiente, también arriba.
