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

`pnpm verify` completo (local, Windows, 2026-11-21): exit 1, 16 de 17 pasos corrieron. Por paso:

| Paso | Resultado |
|---|---|
| harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols, sql-tests, build | PASÓ |
| test | FALLÓ: 2 propios (los dos de arriba, ya corregidos) y 4 ajenos por carga o tiempo (`infra/ops/tests/migraciones.test.mjs`, `scripts/__tests__/entorno-prueba-scripts.test.mjs`, `kpi-cifra-en-tinta-contract`, `correo-comprobacion`), más un worker de vitest que no arrancó (`GuiaMotor.test.tsx`) |
| schema-rebuild | FALLÓ, preexistente y ajeno: muere en `0552_registro_portal_por_link.sql:628` (`au.last_sign_in_at` no existe en el doble de `auth.users`), tras 519 migraciones y antes de la 0570. La rama no toca la 0552 ni `scripts/check-schema-rebuild.mjs`. Ningún workflow de GitHub corre este paso, así que no hay CI de `main` que citar; el último «Calidad continua» verde de `main` es el run 44974252762 (`1b35bab62`) |
| e2e | FALLÓ por entorno: 74 de los 76 fallos son de WebKit, que no está instalado en esta PC (`ms-playwright/webkit-2388`); los otros 2 son de `ficha-chat.spec.ts` en Chromium (sitio público, ajeno); 3 flaky en `auth.spec.ts`; 166 pasaron |
| migrations-applied | NO DISPONIBLE: el worktree no tiene `.env` (a propósito) |

El portón es el CI de GitHub.
| `/ui-check` | OK con ajustes menores: corregido el doble envío; queda el espaciado en px fijos |

## Pendiente de esta tarea

- Aplicar la 0570 en producción: OK nominal de Sam y runbook.
- Probar en staging que el GoTrue instalado pone `amr` con método `password` y su hora (NV). Sin eso, aflojar el freno
  queda bloqueado (falla cerrado).
- F1-B (0571: cadena de A1 y A2, clasificador, pestaña «Funciones»): sale después de que la F1-A esté en `main`.

## FUERA DE ALCANCE DETECTADO

- `app/studio/(app)/admin/oficina-virtual/vista/page.tsx:84` muestra el tope del entorno; con la 0570 puede no coincidir
  con el de la pantalla.
- El Studio no tiene verificación en dos pasos: la SDD la abre Dir_DTD (decisión de Sam).
- El espaciado de la pantalla usa px fijos, como la de la Oficina; pasarlo a `var(--s-*)` es una tanda visual aparte.
