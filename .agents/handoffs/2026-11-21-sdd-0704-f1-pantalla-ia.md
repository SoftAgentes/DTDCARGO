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

- F1-B (0571: cadena de A1 y A2, clasificador, pestaña «Funciones»): en curso en `claude/sdd-0704-f1b-cadena`.

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
