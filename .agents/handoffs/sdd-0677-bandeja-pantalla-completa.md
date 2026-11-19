# Handoff · SDD-0677 — Bandeja: pantalla completa y abrir Chatwoot sin error

- **Owner:** Worker (Claude), sesión hija del DG (`local_25e2dded-…`). Claim `worker-sdd-0677`.
- **Ruta:** `.claude/worktrees/focused-driscoll-4273ab`
- **Rama:** `claude/sdd-0677-bandeja-pantalla-completa`, con base en `main` `bab0dafcc`.
- **SDD:** [0677](../../docs/specs/0677-bandeja-pantalla-completa/spec.md). El DG asignó el número; la reserva está en el primer commit de la rama.
- **Permisos:** una PR a main. No fusiono. Sin migraciones, sin config de Chatwoot, sin tocar los archivos de la #686.

## Objetivo

El pedido de Sam: que la Bandeja sea compacta y se amplíe a toda la pantalla al abrirse, y saber por qué a veces da error al abrir Chatwoot y que se recupere sola.

## Hecho

- **Diagnóstico** en la spec §1, con archivo:línea:
  - H1, la más probable: las sesiones de Chatwoot se acumulan y sale el 409 con `MAX_USER_SESSIONS=5`;
  - H2: la marca `dtd_cw_sso` es vieja y la sesión del panel ya murió;
  - H3: Chatwoot se reinicia y el enlace se pidió una sola vez;
  - H4: el tope de rack-attack, como inferencia;
  - H5, descartada: el enlace de un solo uso reusado.

  Se descartaron las cabeceras, `www` y las cookies SameSite. Explica también por qué el arreglo anterior (E2-D12, E2-D48) no cubre estos casos.
- **Rediseño** en `BandejaClient.tsx`:
  - la capa a pantalla completa, con «Reducir» y Esc;
  - la preferencia se recuerda en el navegador;
  - el iframe no se vuelve a montar al cambiar de modo;
  - el foco va al título o al botón;
  - el fondo no se desplaza.
- **Recuperación:**
  - dos reintentos del enlace ante `service` (1,5 s y 4 s);
  - un vigilante de carga de 20 s;
  - el aviso `<Aviso>` «La bandeja no abrió» con «Abrir de nuevo»;
  - el freno: el tercer «Abrir de nuevo» en 5 minutos no pide otro SSO;
  - la línea de ayuda fija para lo que Studio no puede ver dentro del marco.
- Los textos en es-VE y zh-CN. Se quitaron las claves que ya no se usan: `state.error.*`, `action.retry` y `action.relogin`.
- Las pruebas en `BandejaClient.test.tsx`: 9 casos nuevos de pantalla completa y recuperación, y 2 casos existentes ajustados al texto nuevo.
- `/ui-check` (advisory): se corrigieron el token `--bg` por `--bg-base` y el contraste del «Abriendo…», de `--ink-mute` a `--ink-soft`. Los botones del sistema (`studio-btn-ghost`, `ActionButton`) y el aviso `<Aviso>` cumplen.

## Validación

| Comprobación | Estado |
|---|---|
| `node scripts/build-docs-index.mjs` | PASÓ (índice regenerado) |
| `node scripts/check-numbering.mjs` | PASÓ |
| `git diff --check` | PASÓ |
| `pnpm install --frozen-lockfile` (turno del DG) | PASÓ |
| vitest `app/studio/(app)/bandeja` (6 archivos) | PASÓ 94/94; BandejaClient 21/21 |
| Mutantes: sin reintento, sin freno, sin vigilante, sin bloqueo del desplazamiento, iframe que se vuelve a montar al cambiar de modo | 5/5 en rojo; el control inofensivo, en verde |
| vitest de contratos y guía (`app/studio/_components/__tests__`, `guia`, `Aviso`, `(app)/__tests__`, `crm/__tests__`, `lib/i18n`) | PASÓ 651/651 |
| `tsc --noEmit` | PASÓ (también después del ajuste de lint) |
| eslint de los 4 archivos | PASÓ, sin avisos |
| `pnpm verify` | NO EJECUTADO: el turno cubría install, vitest, tsc y eslint. Queda el CI de GitHub |
| Logs del VPS (DG) | Ningún contenedor se reinició (H3 improbable). Los logs no registran los 409 ni los 429: H1 y H2 quedan como hipótesis, con medición propuesta en la spec |

## Revisión independiente de aee991191 (CHANGES_REQUESTED) y qué se hizo

1. **Freno persistente.** Las marcas ahora van en `localStorage` (`dtd.bandeja.sso`, solo horas en ms), dentro de un try/catch y con un respaldo en memoria. El tope es de 3 aperturas por SSO cada 5 minutos por navegador, sumando automáticas y manuales. Una apertura con `service` cuenta una vez. Con el tope lleno no se pide SSO, ni siquiera el automático.
2. **Ayuda solo después de un fallo** (error, vigilante, freno o una reapertura manual), nunca junto al aviso. El texto ahora es «una vez… si vuelve a pasar, avísale al equipo de sistemas». La spec dice que H1 no se resuelve hasta (a) y (c).
3. **`inert`** en los hermanos de cada ancestro, hasta el hijo de `body` sin incluirlo, para que los portales sigan vivos. No toca lo que ya tenía `inert`, se devuelve al reducir y, sin soporte, no hace nada (respaldo seguro).
4. **Pruebas nuevas:**
   - la ventana que vence a los 5 minutos exactos;
   - `service` que cuenta una vez;
   - el remonte con 1 marca;
   - el tope lleno al remontar;
   - el freno sin almacenamiento;
   - el `onLoad` que limpia el freno;
   - el `error` que desmonta el marco;
   - solo Escape reduce;
   - el foco que vuelve tras Esc;
   - `marcasVigentes`.

   Se quitó `vi.useRealTimers()` a mitad de prueba: el bloque de recuperación entero corre con relojes falsos.
5. **Menores:**
   - el estado inicial ahora es neutro (`pendiente`, oculto), sin destello;
   - el `onLoad` limpia el freno;
   - se quitó «se está reiniciando» de es-VE y zh-CN;
   - la spec cita por archivo y símbolo y trae la evidencia de `/ui-check`;
   - quedó escrito que con `error` el iframe se desmonta.

**Mutantes** (un script en el scratchpad que reescribe el componente y lo restaura): **23/23 en rojo**, y el control inofensivo en verde.
- Esc: cualquier tecla, sin chequear el diálogo y sin reducir.
- Foco: al botón y al título.
- Ventana: `<=`, sin vencimiento y aceptando futuras.
- Tope: `>`.
- Freno: sin persistencia, una reserva por intento y sin contar la automática.
- Sin reintento, sin vigilante y sin bloqueo del desplazamiento.
- El iframe que se vuelve a montar.
- Sin `inert` y sin devolverlo.
- La ayuda siempre y la ayuda junto al aviso.
- El `onLoad` que no limpia el freno, la hidratación en `true` y el error que deja el marco.

En la primera vuelta, el control salió en rojo por una carrera. La prueba de `denied` consultaba roles con la capa todavía oculta. Se corrigió esperando el modo, y la suite dio 3 de 3 en verde seguidas.

| Comprobación (turno corto del DG) | Estado |
|---|---|
| vitest de `BandejaClient.test.tsx` | PASÓ 32/32, tres corridas seguidas |
| vitest de la Bandeja, `_components/__tests__`, guía y `lib/i18n` | PASÓ 529/529 |
| `tsc --noEmit` | PASÓ |
| eslint de los 4 archivos | PASÓ, sin avisos |
| `docs:check` y `git diff --check` | PASÓ |
| `pnpm verify` | NO EJECUTADO: queda el CI |

## Re-revisión de f5fc4580e (CHANGES_REQUESTED) y qué se hizo

1. **BLOQUEANTE, `inert`.** Antes apagaba los toasts, el BugFAB y la guía, porque son hermanos del shell dentro de `div.studio-sys`, sin portal. Ahora solo quedan inertes las ramas `data-capa-fondo`: el menú y la barra en `(app)/layout.tsx` con `display: contents`, la cabecera del CRM en `bandeja/page.tsx` y lo del admin en `BandejaClient`. La prueba usa la estructura real y comprueba que el toast, el BugFAB y la guía no quedan inertes, ni al ampliar ni al reducir.
2. **Almacenamiento roto.** Si `setItem` o `getItem` falla, se marca `almacenamientoRoto` y desde ahí manda la memoria. Hay una prueba para cada uno por separado.
3. **Entre pestañas.** La reserva corre bajo `navigator.locks`, con respaldo sin exclusión, y el límite está documentado en la spec. Las marcas futuras cuentan; solo se descarta lo que está a más de una ventana en el futuro (spec D2.6).
4. `reiniciarFrenoEnMemoria()` corre en el `beforeEach`.

**Mutantes:** 30/30 en rojo y el control en verde. Además de los 23 anteriores:
- futuras que no cuentan y futuras lejanas que cuentan;
- `setItem` roto que no pasa a memoria y `getItem` roto que no pasa a memoria;
- locks sin usar;
- `inert` que pisa lo que ya era inert;
- `inert` a todos los hermanos (la versión vieja).

**Choque anunciado:** la #686 también toca `lib/i18n/es-VE/bandeja.ts`, `zh-CN/bandeja.ts` y `docs/specs/README.md`. La que entre segunda va a tener un conflicto de texto. Se resuelve conservando las claves de las dos y regenerando el índice.

| Comprobación (turno corto) | Estado |
|---|---|
| vitest de `BandejaClient.test.tsx` | PASÓ 38/38 |
| vitest de la Bandeja, `_components/__tests__`, guía, `lib/i18n` y `(app)/__tests__` | PASÓ 566/566 |
| vitest de las pruebas que leen `layout.tsx` (CRM, rbac, oficina y flags) | PASÓ 172/172 y 139/139 |
| `tsc --noEmit` | PASÓ |
| eslint de `BandejaClient`, su prueba, `page.tsx` y `(app)/layout.tsx` | PASÓ, sin avisos |
| `pnpm verify` | NO EJECUTADO: queda el CI |

## Re-revisión del delta: APPROVED sobre 88080d521

Hay dos hallazgos bajos, que no bloquean y quedan para una PR de seguimiento:
1. **Una apertura cancelada mientras espera el candado ya gastó su marca.** Si la página se desmonta o se pide otra apertura con la reserva dentro de `navigator.locks`, la marca queda escrita aunque no se pida SSO. Efecto: el freno puede saltar un intento antes. Arreglo posible: reservar y pedir dentro de la misma corrida, o devolver la marca si `mia !== corrida.current`.
2. **Con el JSON de `localStorage` corrupto, toda la página pasa a memoria y el valor no se repara.** `JSON.parse` falla, la lectura marca `almacenamientoRoto` y ya no escribe. Efecto: el freno vale solo en esa pestaña hasta recargar, y el dato corrupto sigue ahí. Arreglo posible: separar «no se puede leer o escribir» de «valor inválido» y sobrescribir el valor inválido con `[]`.

**Integración:** entra al tren después de la cola del 64 (#684, #689 y #686). Cuando le toque, el DG avisa si hay que traer main. La #686 choca en `lib/i18n/*/bandeja.ts` y en el índice.

## Pendientes de esta tarea

1. La PR #690 está lista para que el DG lance la revisión independiente.
2. Smoke en el navegador: pantalla completa, Esc con el foco fuera del marco, y el nivel de capas con la guía (z 85, debajo de la guía 89/90).

## FUERA DE ALCANCE DETECTADO

- **H1 de raíz**, para que decidan Sam y el DG:
  - subir `MAX_USER_SESSIONS` en el VPS;
  - un botón «Cerrar mis otras sesiones y entrar», que cierra también la app móvil del agente;
  - que `DASHBOARD_SCRIPTS` avise `dtd:sin-sesion` o `dtd:demasiadas-sesiones` para reabrir solo.

  Las tres son puertas del VPS o necesitan el OK de Sam.
- **Medir H1 y H2** (spec §1, M1 a M4): M1 (sesiones por agente, solo números) es la primera.
- **H4:** medir `req.ip` de rack-attack detrás de Cloudflare (E2-I3).
- Los textos de color `--ink-mute` en párrafos de otras pantallas tienen el mismo problema de contraste. No se tocaron.

## Impacto documental

Spec nueva y el índice de specs regenerado. No cambia ningún runbook. Si se elige una opción de H1, va en `infra/chatwoot/README.md`.
