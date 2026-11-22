---
sdd: "0706"
title: "Studio: verificación en dos pasos (AAL2/TOTP) para las acciones sensibles"
status: approved
author: "Claude (Worker) para Dir_DTD"
created: 2026-11-22
updated: 2026-11-22
supersedes: null
superseded_by: null
related: ["0515", "0622", "0624", "0704"]
confidencialidad: interno
---

# SDD-0706 — Verificación en dos pasos del Studio (AAL2 con TOTP)

> Pedido de Sam (2026-11-21), textual, sobre la pantalla IA de la SDD-0704: «Pantalla IA: opción A, pedir la
> contraseña otra vez; y abre después la SDD de verificación en dos pasos».
>
> **Estado: aprobada, solo spec (Sam decidió D-1 a D-6 el 2026-11-22, §10).** No lleva código, ni migración, ni cambios en la configuración de Supabase Auth ni
> en producción. Las decisiones de Sam están en §10 (D-1 a D-6), cada una con opciones A/B, una recomendación y,
> cuando es visual, un boceto para dibujarlo. El repo es público: sin llaves, secretos TOTP, correos, IP ni montos.

**Etiquetas de evidencia:** **C** código o SQL leído · **D** documento · **I** inferencia · **NV** no verificado
(se mide en la fase 1, en un entorno de prueba, nunca en producción). Base: `main` `27d8b46d9`.

## 1. Qué existe hoy

| Hecho | Ev. |
|---|---|
| El Studio **no tiene** verificación en dos pasos: ninguna pantalla enrola un factor y ningún código llama a `auth.mfa.*` | C (búsqueda de `mfa`/`totp` en `app/` y `lib/`: sin llamadas a la API de MFA) |
| La barrera `public.ia_exigir_aal2_si(boolean)` acepta **AAL2** o una autenticación con método `password` en el claim `amr` del JWT con hora de **hace 5 minutos o menos**; falla cerrada ante `null`; devuelve `aal2`, `contrasena_reciente` o `no_hace_falta` para la auditoría | C `supabase/migrations/0570_ia_catalogo_y_costo.sql:355-389` |
| La barrera vive en **una sola función SQL**, y cada función que guarda frenos de IA la llama antes de aflojar | C `0570_ia_catalogo_y_costo.sql:416`, `:433` |
| El servidor consigue esa autenticación reciente con un cliente efímero (`persistSession: false`) que hace `signInWithPassword` y se cierra con `signOut({ scope: "local" })`. La contraseña nunca se guarda ni se registra. El comentario del archivo ya prevé que, con MFA, volver a iniciar la sesión del navegador «bajaría su nivel» | C `lib/db/password-confirmed.ts:1-17`, `:51-87` |
| El mismo cliente efímero lo usa «Ver PIN» de un operario (SDD-0515) con la misma regla de 5 minutos en la base | C `lib/db/password-confirmed.ts:1-3` · C `app/studio/(app)/operarios/actions.ts` |
| La SDD-0704 dice que cuando exista la verificación en dos pasos, «la misma barrera acepta AAL2 sin otro cambio» | D `docs/specs/0704-ia-pantalla-cadena-y-costo/spec.md` §15 |
| Roles del Studio: `admin`, `commercial`, `operations`, `accounting`, `warehouse`, `support`, `marketing`. Además existe el **superadministrador de plataforma** (`is_platform_admin()`), que no es un rol sino una marca aparte | C `lib/studio/user-types.ts:13-20` · C `lib/studio/rbac-guard.ts:170-174` |
| Los módulos de `SUPERADMIN_ONLY_MODULES` no se pueden conceder por persona: el guard exige `is_platform_admin()` | C `lib/studio/rbac-guard.ts:170-174` |
| Que el GoTrue instalado emita `aal` y `amr` con `totp` y su hora en el JWT, y que el TOTP esté habilitado en su configuración, es **NV** | NV |

**Consecuencia:** el enganche ya existe (una función, un claim). Lo que falta es todo lo de alrededor: enrolar,
pedir el código, recuperar y decidir a quién se le exige.

## 2. Qué es y qué no es

- **AAL1** es entrar con contraseña. **AAL2** es entrar con contraseña **y** un segundo factor. Aquí el segundo
  factor es **TOTP** (el código de 6 dígitos que cambia cada 30 segundos y genera una app de autenticación en el
  teléfono). Es el factor que Supabase Auth ofrece sin costo adicional (**I**; **NV** el límite de factores por
  persona de la instalación).
- Es una **segunda capa para lo que mueve plata, permisos o llaves**, no un sustituto de la contraseña.
- **No incluye:** SMS (cuesta, depende de una operadora y se puede secuestrar el número), llaves físicas o passkeys
  (se evalúan después, §11), ni el Portal del cliente (otra superficie, otra spec).

## 3. Quién la necesita (inventario)

La regla de decisión: **si una cuenta robada, sola con su contraseña, puede mover dinero, cambiar quién puede qué o
aflojar un freno de gasto, esa cuenta necesita el segundo paso.** El inventario sale de los módulos y especificaciones
vigentes; cada fila se **vuelve a verificar contra el código** al implementar la fase que la toque (**I**).

| Quién | Acciones sensibles | Evidencia | Prioridad |
|---|---|---|---|
| **Superadministrador de plataforma** | Aflojar frenos de la pantalla IA (tope, tarifa, tipo de cobro), cargar o borrar llaves, módulos que solo él puede abrir | C `0570…sql:355-389` · D 0704 §8 | **Imprescindible** (fase 2) |
| **`admin`** | Dar o quitar permisos por persona y por rol (módulos y capacidades); administrar usuarios | D 0622 · D 0124 · D 0139 | Alta (fase 3) |
| **`accounting`** | Emitir y anular facturas, tesorería, conciliación bancaria, gastos | D 0350 · D 0352 · D 0624 | Alta (fase 3) |
| **`operations`** | Ver y restablecer el PIN de un operario (hoy pide contraseña reciente) | C `operarios/actions.ts` · D 0515 | Media (fase 3, opcional) |
| `commercial`, `warehouse`, `support`, `marketing` | Hoy ninguna acción de las tres de arriba (**I**: se confirma al implementar) | D 0085 | Opcional |

- Una persona con **dos roles o con permisos extra por persona** (0622) cae en la fila más exigente.
- La fase 4 podría exigirlo a todos los miembros del Studio; es la D-1 (§10).
- Las cuentas **de servicio** (cron, integraciones) no usan este mecanismo: se autentican con su llave y no tienen
  teléfono. Se mantienen fuera, y su alcance lo siguen limitando sus permisos propios.

## 4. El enrolamiento con TOTP de Supabase Auth

### 4.1 Cómo funciona (API de Supabase Auth, **NV** la versión instalada)

1. La persona, ya autenticada (AAL1), abre **Mi cuenta › Seguridad › Activar verificación en dos pasos**.
2. El servidor llama `auth.mfa.enroll({ factorType: "totp" })`. Supabase devuelve el identificador del factor, un
   **código QR** y la **clave en texto** (para teclearla si no se puede escanear). Ese factor queda **sin verificar**.
3. La persona la escanea con su app de autenticación y teclea el primer código de 6 dígitos.
4. El servidor llama `auth.mfa.challenge` y `auth.mfa.verify` con ese código. Si es válido, el factor queda
   **verificado** y la sesión sube a **AAL2**.
5. A partir de ahí, `auth.mfa.getAuthenticatorAssuranceLevel()` dice `nextLevel = aal2` y la persona puede subir de
   nivel con `challenge` + `verify` cuando una acción lo pida.

Detalles:

- **El secreto TOTP lo guarda Supabase Auth, no la aplicación.** El ERP nunca lo lee, lo copia, lo registra ni lo
  guarda; el QR y la clave se muestran **una vez**, en esa pantalla, y no se vuelven a pedir. Ningún log, auditoría o
  URL lleva el código ni la clave.
- Un factor **sin verificar** que se abandona (cerró la pestaña) se borra en el siguiente intento de enrolar o por
  limpieza. La pantalla lo trata como «sin activar».
- Se permiten **hasta dos factores verificados** por persona (teléfono principal y uno de respaldo; ver §5). Un
  tercero se rechaza en el servidor. Que Supabase permita varios factores TOTP a la vez es **NV**.
- El enrolamiento y la verificación son **acciones de servidor** con límite de intentos (sobre el que ya pone
  Supabase, **NV** su valor) y deja un evento de auditoría con quién, cuándo y qué (`mfa_activado`,
  `mfa_desactivado`, `mfa_verificacion_fallida`), **nunca** el código.

### 4.2 Qué se le dice a la persona (copy, sin jerga)

- Título: «Protege tu cuenta con un segundo paso».
- Explicación corta: «Además de tu contraseña, te pediremos un código de 6 dígitos de una app de autenticación
  (Google Authenticator, Microsoft Authenticator, 1Password, Authy u otra) cuando hagas algo delicado, como cambiar
  permisos o aflojar un tope de gasto».
- Tras activar: «Listo. Guarda tu segundo dispositivo ahora: si pierdes el teléfono, otra persona tendrá que
  restablecerte el acceso».

## 5. Recuperación: qué pasa si alguien pierde el teléfono

Supabase Auth **no trae códigos de recuperación** para TOTP (**NV** en la versión instalada). Si se pierde el único
factor, la persona sigue entrando con contraseña (AAL1) pero **no puede subir a AAL2**, así que las acciones
sensibles se le cierran. El resto del Studio no se le cierra (§6, D-4).

### 5.1 Cuatro capas, de la más barata a la más pesada

1. **Segundo dispositivo desde el principio.** Se pide enrolar dos factores (teléfono principal y un respaldo, por
   ejemplo la tablet o el gestor de contraseñas de la oficina). Es la defensa más barata.
2. **Restablecimiento por otro superadministrador.** Pantalla **Administración › Seguridad › Restablecer segundo
   paso** (solo `is_platform_admin()`, con **su propio AAL2**): borra los factores de esa persona con la API de
   administración de Supabase Auth (`auth.admin.mfa.deleteFactor`, **NV**) y exige un **motivo** (4 a 200 caracteres,
   sin datos personales). La persona vuelve a enrolar. Queda en la auditoría: quién restableció a quién, cuándo y por
   qué. Nadie puede restablecerse a sí mismo.
3. **Si quien pierde el teléfono es el único superadministrador.** El restablecimiento lo hace una persona con acceso
   a la consola de Supabase, siguiendo un **runbook** que esta spec pide escribir en la fase 2
   (`docs/runbooks/segundo-paso-recuperacion.md`): verifica la identidad por un canal distinto (llamada de voz a un
   número ya conocido, sin pasos por chat), borra el factor y deja constancia. Mientras tanto, lo que exige AAL2 sigue
   cerrado. **Mitigación de diseño:** debe haber **al menos dos superadministradores con el segundo paso activo**;
   la pantalla lo avisa si hay uno solo.
4. **Códigos de respaldo propios** (diez códigos de un solo uso, guardados como hash). Es lo más cómodo para la
   persona, pero es una tabla, un flujo y una superficie de ataque nuevos. **No se propone en la v1**; es la D-3.

### 5.2 Lo que NO se hace

- **No** se salta el segundo paso «por un rato» con un enlace al correo: sería la puerta trasera que el factor quiere
  cerrar.
- **No** se pregunta «¿perdiste el teléfono?» con una vía automática en la misma pantalla de entrada.
- **No** se pide la contraseña de otra persona para restablecerla.

## 6. Cómo convive con la reautenticación de 5 minutos

Hoy el freno acepta **AAL2 o contraseña reciente**. Esta spec lo cambia por etapas, sin romper lo ya funcionando.

| Etapa | Qué acepta la barrera | Quién sube de nivel | Cambia SQL |
|---|---|---|---|
| **Hoy (0570)** | AAL2 **o** contraseña de hace ≤ 5 min | Nadie tiene AAL2: todos pasan por contraseña | — |
| **Fases 2 y 3** | AAL2 **o** contraseña de hace ≤ 5 min (igual) | Quien ya enroló pide su código; quien no, su contraseña | No |
| **Fase 4** (a decidir, D-5) | AAL2 **con código reciente** (`amr` con `totp` de hace ≤ N min) para quien tenga el segundo paso obligatorio; la contraseña sola deja de bastar para ellos | Todos los obligados | **Sí**: nueva migración que cambia la barrera, con OK nominal de Sam |

Puntos de diseño:

- **El cliente efímero de contraseña no sirve para subir a AAL2.** Su `signInWithPassword` entra en AAL1 en una
  sesión nueva; el comentario de `password-confirmed.ts` ya lo anticipa. El código TOTP se verifica sobre la **sesión
  real del navegador** (`challenge` + `verify`), que es la que emite el JWT con `aal2` y el `amr` de `totp`. Por eso
  el diálogo de la fase 2 es **otro**, no una variante del de la contraseña.
- **AAL2 dura lo que dure la sesión** (queda en el JWT al refrescarlo), así que «AAL2» solo no demuestra que quien
  está sentado ahora es quien tiene el teléfono. Por eso la fase 4 propone medir la **hora del `totp` en el `amr`**,
  igual que hoy se mide la del `password`, con la misma ventana de 5 minutos (D-5). La barrera ya sabe leer `amr`;
  solo cambia el método que busca.
- **La barrera se generaliza.** Hoy lleva el prefijo `ia_`. En la fase 4, una función genérica
  (`studio_exigir_segundo_paso_si(boolean)`) se vuelve la fuente, y `ia_exigir_aal2_si` la llama sin cambiar de firma,
  de modo que la IA, la facturación y los permisos usan **una sola regla**. Hasta entonces ninguna función nueva
  copia la lógica: llama a la existente.
- **La auditoría** ya guarda el método (`aal2`, `contrasena_reciente`, `no_hace_falta`). Se suma `aal2_reciente`
  y `aal2_antiguo` para distinguir en el rastro si el código era reciente.
- **Falla cerrada, siempre:** un `null`, un `amr` ilegible o una hora fuera de ventana exigen el segundo paso.
  Nunca al revés.

## 7. Cómo se ve (para que Dir_DTD lo dibuje)

Convenciones de marca: acción principal en azul de acción; estados con icono y texto, no solo color; cifras con coma
decimal; densidad compacta del Studio. La UI pasa por `/ui-check`.

### 7.1 Activar el segundo paso — D-6

```
 Mi cuenta › Seguridad
 ───────────────────────────────────────────────────────────────────────────────
  Verificación en dos pasos                                  ○ Sin activar
  Protege lo delicado: permisos, facturas y topes de gasto.
                                                         [ Activar ]  ← azul
 ───────────────────────────────────────────────────────────────────────────────
  Paso 1 de 3 · Escanea el código                       ┌────────────────┐
  Abre tu app de autenticación y escanea:               │   ▓▓ QR ▓▓     │
                                                         │   ▓▓▓▓▓▓▓▓     │
  ¿No puedes escanear? Teclea esta clave:                └────────────────┘
  [ XXXX XXXX XXXX XXXX ]  [ Copiar ]    (se muestra una sola vez)
  Paso 2 de 3 · Escribe el código de 6 dígitos          [ _ _ _ _ _ _ ]
                                                         [ Verificar ]  ← azul
  Paso 3 de 3 · Agrega un segundo dispositivo           [ Hacerlo ahora ]  [ Después ]
```

- **Opción A (recomendada): pantalla propia dentro de Mi cuenta**, con los tres pasos visibles en la misma hoja.
  Ventajas: es una ruta que se puede enlazar («actívalo aquí»), el QR no se pierde si se cierra una ventana y el
  formulario cabe en un teléfono.
- Opción B: un diálogo modal en tres pantallas. Más compacto, pero se pierde con un clic fuera y no se puede enlazar.

### 7.2 Pedir el código en el momento de la acción (reemplaza al diálogo de contraseña de 0704)

```
 ┌─ Confirma con tu segundo paso ───────────────────────────────────────┐
 │  Vas a subir el tope mensual de la Oficina de 4,00 a 6,00 USD.        │
 │  Escribe el código de 6 dígitos de tu app de autenticación.           │
 │  [ _ _ _ _ _ _ ]                                                      │
 │  ⓘ ¿Sin teléfono? Pide a otro superadministrador que te restablezca.  │
 │                                       [ Cancelar ]   [ Confirmar ]    │
 └───────────────────────────────────────────────────────────────────────┘
```

Estados con icono y texto: «Código incorrecto, te quedan N intentos» (error), «Demasiados intentos, espera 1 minuto»
(atención), «Confirmado» (éxito). La acción solo continúa si el servidor, no el botón, ve el AAL2 correcto.

### 7.3 Restablecer a otra persona (solo superadministrador)

Tabla de personas con el estado «Con segundo paso / Sin activar», botón **Restablecer** que abre una confirmación
con nombre, motivo obligatorio y aviso «Se cerrarán sus sesiones y tendrá que enrolar de nuevo».

## 8. Fases

| Fase | Qué entrega | Depende de | Producción |
|---|---|---|---|
| **0 · Esta spec** | Aprobación y respuesta a las seis decisiones (§10) | Sam | — |
| **1 · Medición** | En un Supabase de **prueba**, comprobar las **NV** de §1, §4 y §5: TOTP habilitado, claims `aal`/`amr`, hora del `totp`, límite de factores, `auth.admin.mfa.deleteFactor`, comportamiento de `signInWithPassword` y del refresco con un factor verificado. Evidencia en el handoff | Fase 0 | No toca producción |
| **2 · Superadministrador** | Pantalla de enrolamiento (§7.1), diálogo del código (§7.2) en la pantalla IA, restablecimiento (§7.3), runbook de recuperación (§5.1) y aviso de «solo un superadministrador activo». La barrera sigue aceptando AAL2 **o** contraseña reciente | Fase 1; **encender el TOTP en la configuración de Auth de producción**, si estuviera apagado: OK nominal de Sam | Sin migración |
| **3 · Roles sensibles** | Los mismos diálogos en permisos (`admin`), facturación y tesorería (`accounting`) y, si Sam lo decide, el PIN de operarios. Aviso dentro del Studio a quien aún no active el segundo paso, con fecha límite | Fase 2 | Sin migración |
| **4 · Obligatorio** | La barrera deja de aceptar la contraseña sola para los obligados (§6) y mide el `totp` reciente. Migración nueva: función genérica `studio_exigir_segundo_paso_si` y `ia_exigir_aal2_si` delegando en ella. Rollback: la migración anterior se puede reinstalar | Fase 3; D-2, D-4 y D-5 | **Migración con OK nominal de Sam** y el [runbook de producción](../../runbooks/aplicar-migraciones-prod.md) |
| **5 · Retiro de la contraseña reciente** | Se retira el camino de contraseña de la barrera para quienes la fase 4 obligó; `withPasswordConfirmedClient` queda solo para «Ver PIN» si la D-1 no lo cubrió | Fase 4 | Migración, OK nominal |

Cada fase de producto cierra con `pnpm verify`, `/ui-check` en la UI y las pruebas de §9. **Un worker por fase**, una
PR por fase; las fases 2 a 5 no se mezclan entre sí.

## 9. Pruebas previstas

- **Barrera (PGlite, `.test.sql`):**
  - con `aal2` y sin `amr`, la fase 2 acepta; la fase 4 **rechaza** si no hay `totp` reciente;
  - con `password` de hace más de 5 minutos, o con hora futura fuera de la tolerancia, rechaza;
  - un `amr` que no es arreglo, con elementos no objeto o con una hora mal formada, **rechaza**;
  - `null` en el parámetro exige el segundo paso (falla cerrada);
  - con la clave de servicio, el comportamiento es el mismo que con la sesión de la persona.
- **Servidor (Vitest con doble de Supabase Auth):**
  - enrolar no devuelve nunca el secreto fuera de la respuesta única; el código no llega a un log, a la auditoría ni
    a la URL;
  - un tercer factor se rechaza; un factor sin verificar no cuenta como activado;
  - restablecer exige superadministrador con AAL2, motivo válido y que no sea la misma persona;
  - quien tiene el segundo paso obligatorio y no lo ha activado ve el aviso y no puede completar la acción.
- **Mutantes:** quitar la comprobación de la hora, aceptar `aal1`, o permitir restablecerse a sí mismo **debe hacer
  fallar** al menos una prueba.
- **Interfaz (Playwright, solo contra el entorno local):** el flujo de §7.1 y §7.2 con un generador TOTP de prueba;
  el código se teclea con teclado y con pegar; el foco vuelve al campo tras un error.
- **Sin secretos ni PII** en fixtures: claves TOTP de prueba generadas en el momento, nunca una real.
- **Fase 1:** la evidencia de las NV con texto inventado y un usuario de prueba; nada contra producción.

## 10. Decisiones para Sam

Sam decide viendo: cada decisión con boceto está dibujada arriba (§7); Dir_DTD la dibuja antes de pedir respuesta.

**Decididas por Sam (2026-11-22), textual, por el chat de Dir_DTD:** «Dos pasos 1 quien: A superadmin admin contabilidad · Dos pasos 2 cuando: A gradual · Dos pasos 3 recuperar: A otro superadmin · Dos pasos 4 momento: A en la accion · Dos pasos 5 contrasena: A solo codigo · Dos pasos 6 pantalla: A pantalla propia»

Resultado: **A en las seis.** Se conservan las alternativas y los bocetos como registro. La fase 1 (medición) y las
siguientes se asignan aparte, una por Worker.

### D-1 · ¿A quién se le exige el segundo paso? — DECIDIDA: A

- **A (recomendada): superadministrador, `admin` y `accounting`.** Son los roles con acciones que mueven plata,
  permisos o llaves (§3). `operations` queda opcional hasta ver el PIN.
- B: solo el superadministrador. Menos fricción, pero un `admin` o un contador con la contraseña robada seguiría
  pudiendo cambiar permisos o facturar.
- (C: todos los miembros del Studio. Es la fase 4 completa; mucha fricción para operarios y almacén que usan el
  Studio desde un puesto compartido.)

```
 A · Recomendada                           B · Solo superadmin
 Superadmin  ● obligatorio                 Superadmin  ● obligatorio
 admin       ● obligatorio                 admin       ○ opcional
 accounting  ● obligatorio                 accounting  ○ opcional
 operations  ○ opcional                    operations  ○ opcional
 resto       ○ opcional                    resto       ○ opcional
```

### D-2 · ¿Cuándo se vuelve obligatorio? — DECIDIDA: A

- **A (recomendada): gradual.** Fase 3: avisa dentro del Studio durante 14 días; fase 4: desde esa fecha, sin segundo
  paso no se hacen las acciones sensibles (lo demás sigue funcionando).
- B: inmediato, el día que se publique la fase 4.

```
 A · Gradual                                B · Inmediato
 día 1   aviso «activa tu segundo paso»      día 1   se corta lo sensible
 día 14  se corta lo sensible                        a quien no activó
```

### D-3 · ¿Cómo se recupera una cuenta con el teléfono perdido? — DECIDIDA: A

- **A (recomendada): segundo dispositivo + restablecimiento por otro superadministrador + runbook de la consola**
  (§5.1, capas 1-3). Nada nuevo que guardar.
- B: además, **diez códigos de respaldo de un solo uso**, guardados como hash. Cómodo para la persona, pero suma una
  tabla, un flujo y una superficie que cuidar; se haría como su propia SDD si Sam la quiere.

```
 A · Recomendada                           B · Con códigos de respaldo
 «Perdí el teléfono»                        «Perdí el teléfono»
  → otro superadmin restablece               → uso uno de mis 10 códigos
  → enrolo de nuevo                          → enrolo de nuevo
                                             (y debo guardar los 10 códigos)
```

### D-4 · ¿Cuándo se pide el código? — DECIDIDA: A

- **A (recomendada): solo en la acción sensible.** Se entra con contraseña como hoy; el código se pide al aflojar un
  tope, cambiar permisos o emitir una factura (§7.2).
- B: en cada inicio de sesión, además de en la acción. Más seguro contra una cuenta robada y más molesto en un uso
  diario con varios dispositivos.

```
 A · En la acción                            B · Al entrar y en la acción
 Entrar ─ contraseña ─▶ Studio               Entrar ─ contraseña ─ código ─▶ Studio
 Acción delicada ─ código ─▶ hecho           Acción delicada ─ código ─▶ hecho
```

### D-5 · ¿Qué pasa con la contraseña de 5 minutos cuando el segundo paso sea obligatorio? — DECIDIDA: A

- **A (recomendada): se retira para los obligados** (fase 4-5): solo vale un código `totp` de hace 5 minutos o menos.
  Es lo que hace a la barrera «de dos pasos» de verdad.
- B: se mantiene como alternativa permanente. Es más cómodo, pero quien tenga la contraseña sigue pudiendo aflojar
  los frenos y el segundo paso solo serviría de adorno.

```
 A · Solo código reciente                     B · Código o contraseña reciente
 aflojar tope → código de 6 dígitos           aflojar tope → código  o  contraseña
```

### D-6 · ¿Cómo se ve el enrolamiento? (boceto en §7.1) — DECIDIDA: A

- **A (recomendada): pantalla propia en Mi cuenta › Seguridad**, tres pasos visibles.
- B: diálogo modal en tres pantallas.

## 11. Riesgos y fuera de alcance

- **Bloqueo del único superadministrador:** mitigado por el segundo dispositivo, los dos superadministradores y el
  runbook de la consola (§5.1). Es el riesgo más serio de esta spec.
- **Ya existe la contraseña reciente:** para quien no se ha enrolado nada cambia hasta la fase 4; no hay corte
  sorpresivo.
- **Las NV pueden cambiar el diseño** (por ejemplo, un solo factor por persona o un `amr` distinto): por eso la
  fase 1 mide antes de construir, y el handoff de esa fase corrige esta spec si hace falta.
- **Reloj del teléfono desfasado:** el TOTP depende de la hora. El mensaje de error del código incorrecto sugiere
  revisar la hora automática del teléfono.
- **Se evalúan después, no aquí:** passkeys o llaves físicas (WebAuthn), restricción por dispositivo de confianza, y
  el segundo paso en el Portal del cliente.
- **Fuera de alcance:** código, migraciones y producción en esta etapa; el cambio de la configuración de Auth de
  producción (fase 2, con OK de Sam); las cuentas de servicio; cualquier reemplazo de la contraseña.

## 12. Archivos de esta tarea

Solo documentación: `docs/specs/0706-studio-verificacion-dos-pasos/spec.md`, el índice `docs/specs/README.md` (lo
regenera `pnpm docs:index`) y el handoff `.agents/handoffs/2026-11-22-sdd-0706-spec-dos-pasos.md`.

Allowlist prevista para la **fase 2** (a confirmar con una enmienda cuando se asigne): `lib/studio/mfa/*` (servidor
y pruebas), `app/studio/(app)/cuenta/seguridad/*`, `app/studio/(app)/admin/seguridad/*`, el diálogo en
`app/studio/(app)/admin/ia/_components/*`, `docs/runbooks/segundo-paso-recuperacion.md` y `lib/db/password-confirmed.ts`
(solo el comentario). La fase 4 suma una migración numerada por Dir_DTD.
