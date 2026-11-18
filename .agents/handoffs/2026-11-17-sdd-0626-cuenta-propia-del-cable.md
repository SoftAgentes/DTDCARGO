# Handoff · SDD-0626 · La cuenta de Chatwoot propia del cable

**Pedido:** el Director General, 17/11/2026, opción (a). Antes de encender la etapa 1 en producción apareció un
bloqueo: el cable tomaba la cuenta de Chatwoot de `CHATWOOT_ACCOUNT_ID`, que en producción es la cuenta real del ERP,
y la bandeja de prueba vive en la cuenta de prueba. Con eso el cable no atendía ni enviaba nada, sin fuga, y ponerle la
cuenta de prueba a esa variable rompía la Bandeja del ERP. La opción (b), una bandeja de prueba dentro de la cuenta
real, se descartó porque mete la prueba donde están los clientes reales.

PR chica y aparte, desde `origin/main`: no va sobre la rama de la #652, que sigue en el tren. No lleva migración.

## Qué se hizo

- **`lib/studio/oficina/config.ts`:** `configWebhookOficina` lee la cuenta SOLO de `OFICINA_CHATWOOT_ACCOUNT_ID`, sin
  caída a `CHATWOOT_ACCOUNT_ID`. Ausente, vacía (`""`), con espacios o que no sea un entero positivo da `cuenta = null`.
  Así:
  - el webhook responde 503 «no_configurado» y no crea el cliente de la base;
  - el despachador (y su lectura de Chatwoot) y el envío reciben `chatwoot = null` y responden `sin_config`, sin crear
    el cliente de la base ni llamar a Chatwoot.
  Es la única lectura de la cuenta en el cable: el despachador, la lectura y el envío la toman de ahí.
- **Siguen todos los bloqueos de antes:** `otra_bandeja` (incluye otra cuenta), `forma_desconocida` y la anulación de la
  bandeja de prueba si coincide con una del ERP. La Bandeja del ERP no cambia: sigue con `CHATWOOT_ACCOUNT_ID`.
- **Comentarios** de `despachador-config.ts`, `envio.ts` y `webhook-chatwoot.ts`.
- **Pruebas nuevas:**
  - `lib/studio/oficina/__tests__/cuenta-cable.test.ts`:
    - (i) con solo la cuenta del ERP, las tres piezas quedan sin cuenta; con las dos, manda la del cable;
    - (ii) `""`, espacios, `0`, negativos, decimales, `1e3` y texto: nada configurado;
    - la anulación por bandeja del ERP sigue;
    - un barrido del código fuente de `lib/studio/oficina/`, `app/api/oficina/` y `app/api/cron/oficina-*`: falla si
      alguno nombra `CHATWOOT_ACCOUNT_ID` o importa `@/lib/studio/chatwoot/config`.
  - Las rutas de `oficina-envio` y `oficina-despachador`: sin la cuenta del cable (`undefined`, `""`, espacios, `0`,
    texto) y con la del ERP puesta, responden «sin_config» sin crear el cliente de la base, sin rpc y sin fetch.
  - La ruta del webhook:
    - (i) sin la cuenta del cable y con la del ERP: 503 y sin base;
    - (ii) los valores inválidos: 503 y sin base;
    - (iii) un aviso de la cuenta del ERP, con la bandeja correcta, se ignora («cuenta»);
    - control: el aviso de la cuenta del cable se guarda.
  - Las pruebas que ya existían pasan a `OFICINA_CHATWOOT_ACCOUNT_ID`.
- **Docs:**
  - `.env.example` (raíz e `infra/dtd-cargo/`) con la variable nueva, sin valores.
  - Runbook `oficina-cable.md`:
    - fila nueva en §8 y la variable en las tablas de §10 y §11;
    - **§12 nuevo, la lista para encender la etapa 1 en producción:** variables, valores, servicio, reactivación y nueva
      suspensión de la cuenta de prueba, rotación de los dos tokens al cerrar y vuelta atrás.
  - Spec 0626: la decisión, en §3, junto a los opcionales del DG. No se subió la versión de la spec, para no chocar con
    la v0.6 de la #652.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| `cuenta-cable.test.ts`, `paso3b-piezas`, las rutas de envío, despachador y webhook, y `oficina-webhook` (114 pruebas) | PASÓ |
| `oficina-despachador`, `oficina-paso3b` y el puente `cable-oficina-puente.test.mjs` (80 pruebas) | PASÓ |
| Control rojo: con la caída `?? env.CHATWOOT_ACCOUNT_ID` en `config.ts` caen 5 pruebas nuevas (i en las tres rutas, i en config y el barrido) | PASÓ (se volvió el archivo) |
| ESLint de los archivos tocados | PASÓ |
| docs:check | PASÓ |
| Contrato de los `.env.example` (`env-example-contract`, `infra-env-example`, `entorno-prueba-compose`; 23 pruebas) | PASÓ |
| Typecheck del proyecto entero | NO EJECUTADO en local (es pesado, sin turno de PC; lo corre el CI) |
| Suite amplia | NO EJECUTADO en local (sin turno de PC; la corre el CI) |
| Staging y producción | NO EJECUTADO: fuera de esta PR |
| Revisión de seguridad con Opus sobre f7c69cd7f | PASÓ, sin altas ni medias. Bajos corregidos: B1, B2 y B3 en el runbook §12 y B5 en la prueba del despachador; B4 (el barrido se puede burlar) queda como está, por decisión del DG |
| Prueba extra: con las dos variables, el cable ve la 2 y la Bandeja del ERP sigue en la 1 | PASÓ |

## Fuera de alcance detectado

- **Staging:** hay que definir `OFICINA_CHATWOOT_ACCOUNT_ID` (la cuenta de prueba) en el `.env` de staging antes de la
  próxima prueba ahí. Sin ella, el cable de staging queda apagado (503 / `sin_config`). Esta PR no toca staging.
- **`infra/ops/staging/verificar-aislamiento.sh`** revisa que `CHATWOOT_ACCOUNT_ID` de staging no sea la cuenta real,
  pero todavía no revisa `OFICINA_CHATWOOT_ACCOUNT_ID`. Queda FUERA DE ALCANCE (revisión de seguridad, B1): otra PR.
- **Que la cuenta del cable sea distinta de la del ERP en producción** no lo exige el código (staging usa la misma
  cuenta de prueba para las dos): es un paso a mano del runbook §12, por nombre y sin imprimir valores.
- **El puente de prueba** (`infra/ops/cable-oficina/puente-prueba.mjs`) tiene la cuenta 2 fija en el código, no la toma
  del entorno. No cambia con esto.
- **La #652 también toca el runbook y la spec.** Los cambios no se pisan (§12 va al final del runbook y la nota de la
  spec va en §3), pero quien fusione segundo trae main.

## Lo que falta (no es de esta PR)

1. La revisión de seguridad con Opus (la pide el DG) y la fusión por el portón del DG.
2. Publicar el web en producción con esta pieza y con la #652.
3. Encender la etapa 1 con la lista del runbook §12, con el OK nominal de Sam en la sesión del DG.
