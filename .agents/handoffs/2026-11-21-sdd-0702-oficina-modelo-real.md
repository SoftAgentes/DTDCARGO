# Handoff · SDD-0702 (hija de SDD-0626) · El modelo real de cada llamada de la Oficina_Virtual

**Pedido:** el Director Ofi_Hermes, 21/11/2026. Es para la revisión de privacidad de la etapa 2: saber qué modelo
escribió cada borrador. Hoy `task_events.modelo_usado` dice «soporte-chatwoot», y no se sabe si la #35 y la #36
salieron por el modelo principal o por el de respaldo.

Rama `sdd/0626-modelo-real` desde `origin/main` (`f67daa778`). **Sin migración.** No se tocó producción, ni la
oficina, ni staging.

## Hallazgo

En Hermes v0.23.1, `/v1/chat/completions` sin streaming devuelve `model` = el alias pedido (`soporte-chatwoot`) y
no trae `runtime` (`api_server_openai_routes.py`, l. 1044-1049). Eso es lo que se estaba guardando. El modelo real
queda en la fila de la sesión: `GET /api/sessions/<id>` devuelve `session.model`. Hermes la reescribe con el modelo
de la primera llamada con consumo, que tras un fallback es el de respaldo (`hermes_state_usage.py`, l. 345-357). El
cable borraba esa sesión sin leerla. Detalle y fuentes: spec §1.

## Qué se hizo

- `lib/studio/oficina/runtime-cliente.ts`:
  - el alias ya no cuenta como modelo (queda `null`);
  - `leerModeloDeSesion`: `GET /api/sessions/<id>`, saca solo `model` (y el proveedor, si viniera); tope de 5 s;
    nunca lanza;
  - `idDeModelo` solo acepta ids limpios, de 100 caracteres como máximo.
- `lib/studio/oficina/despachador.ts`: `modeloDeSesion?` opcional en las dependencias. Se usa solo si la respuesta
  no trajo el modelo, después de la llamada y **antes** del `DELETE` de la sesión.
- `app/api/cron/oficina-despachador/route.ts`: lo conecta.
- Pruebas nuevas en `lib/studio/oficina/__tests__/despachador-piezas.test.ts` y
  `lib/studio/__tests__/oficina-despachador.test.ts` (spec §4).
- Spec: `docs/specs/0702-oficina-modelo-real/spec.md`, con el plan de prueba en staging (§5: M1 normal, M2 respaldo
  forzado, M3 los dos proveedores cortados → `runtime:*` y tarjeta a Sam).

## Verificación

- `npx vitest run` sobre `despachador-piezas`, `oficina-despachador` y `oficina-paso3b`: 70 pruebas en verde.
- `tsc --noEmit`: sin errores en lo tocado.
- No corrí la suite completa (queda para el CI).

## Nota D-2 (21/11/2026)

Por la regla D-2 de Sam, ningún dato real de un cliente pasa por un proveedor chino, y el proveedor lo elige Sam.
La spec quedó neutral respecto al proveedor, a pedido del Director DTD. Según el Director Ofi_Hermes, la etapa 1
solo usó texto inventado, la Oficina_Virtual está en pausa y queda anulada la etapa 2 con los proveedores que se
habían pensado. El código no elige proveedor: guarda el que respondió.

## Pendiente

- **La prueba en staging (§5) NO se ejecutó.** Antes hay que avisar al Director Ofi_Hermes: él toca el perfil de
  staging, y hay que abrir el túnel temporal con su OK.
- El formato con proveedor (`proveedor/modelo`) solo aparece si Hermes lo publica. Con la v0.23.1 lo normal es el
  modelo solo.
- La #35 y la #36 no se pueden recuperar desde el ERP: las sesiones ya se borraron. La única fuente posible es el
  log del gateway en la oficina.
- Límite: si un turno mezcla modelos (primera llamada con el principal y otra posterior con el de respaldo), la sesión dice el principal.
  Con el perfil de hoy (una llamada, sin herramientas) no pasa.
- Merge: lo hace el Director DTD.
