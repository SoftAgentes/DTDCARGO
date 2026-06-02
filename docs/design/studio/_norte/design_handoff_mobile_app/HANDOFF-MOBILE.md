# DTD-Cargo · Handoff Móvil · el paquete completo del teléfono

> **Instructivo para Claude Code.** Describe **toda** la app de teléfono de DTD-Cargo:
> un solo APK, multi-tenant, multi-rol, con login único → detección de rol → ruteo al
> módulo correcto, sesión persistente y recuperación por admin.
>
> **Leé en este orden:** `CLAUDE.md` (guardrails de marca) → `HANDOFF.md` (arquitectura
> general del ERP) → **este archivo** (todo lo móvil) → `CHANGELOG.md` (bitácora) →
> `backend/README.md` + `backend/API-CONTRACT.md` (contrato real).
>
> **Spec visual de la sesión:** `Login y Sesión · Operario.html` (canvas con los 6
> estados: login, dispositivo vinculado, PIN, biometría, expirada, reset ERP).

---

## 🎯 Principio · un APK para todos

Una sola aplicación instalable. **El teléfono no decide nada por sí mismo** — el backend,
al validar el login, devuelve **quién es** el usuario (`tenant` + `role` + `permissions`),
y la app abre el área correspondiente.

```
Login único (usuario + contraseña)
        │
        ▼
 Backend valida → devuelve { tenant, role, permissions, tokens }
        │
        ▼
 La app rutea según role  ──►  módulo correcto
```

- **El usuario nunca elige "soy operario" en una pantalla.** Lo dice su credencial.
- **El `tenant` viaja en el token** → mismo APK, cada quien ve solo lo de su empresa.
- **La seguridad real vive en el backend.** La app "abre el área" por comodidad visual;
  cada dato/acción igual se pide con el token y el servidor verifica permiso. La app
  decide *qué muestra*; el servidor decide *qué deja hacer*.

---

## 🧭 Detección de rol → ruteo

Al recibir el perfil del login, la app rutea por `role`:

| `role` | Abre | Entrypoint actual (prototipo) |
|---|---|---|
| `operario` (CN, recepción) | App de recepción/inspección | `Operario CN.html` → `operario/app.jsx` |
| `almacenista` (VE, bodega) | App de bodega | `Almacenista VE.html` → `operario/almacenista.jsx` |
| `transportista` (chofer) | **Directo** a su ruta del día — ve si tiene carga asignada/autorizada y la confirma | `Transportista.html` → `operario/transportista.jsx` · `Operario VE.html` → `operario/ve.jsx` |
| **multi-rol** (mismo usuario es almacenista *y* transportista) | **Picker de modo** → entra al modo elegido | `Operario · App.html` (entry único: login → ruteo por rol → picker) |

### Caso especial · multi-rol (tenant DTDSTUDIO)
El mismo operario a veces es **almacenista** (Modo Bodega) y a veces **transportista**
(Modo Chofer). El perfil trae **2 roles habilitados** → la app muestra el picker
"¿Qué hacés hoy?" y al elegir entra al **home de trabajo de ese modo** (no a una pantalla
de cambio de modo). El **cambio de modo** vive en el menú ☰, no en el centro.

- **Modo Bodega** (= "Soy almacenista") → 2 acciones: **Recibir contenedor** + **Despachar camión**.
- **Modo Chofer** (= "Soy transportista") → **Rutas asignadas** (asignadas por almacén) + iniciar ruta.

> Terminología (decisión del usuario): se identifica como **almacenista** /
> **transportista**; los *nombres de modo* siguen siendo "Bodega" / "Chofer".

### Regla de ruteo para el transportista
El trabajo del chofer **no nace en su teléfono** — le llega **asignado desde la bodega**
(el almacenista arma el camión, asigna chofer y emite el pase QR). Por eso al loguearse
un `transportista` la app abre **directo su ruta/órdenes**, para que **confirme** la carga
y la recoja en la fecha/hora acordada.

```
ALMACENISTA                         TRANSPORTISTA
arma camión ──asigna ruta──►   ve la ruta/orden asignada
asigna chofer + QR              la confirma → la recoge
```

---

## 🔐 Autenticación y sesión · "grabá la sesión, nunca la contraseña"

**Spec visual:** `Login y Sesión · Operario.html`.

Separar tres conceptos que parecen uno:

| Concepto | Qué es | ¿Se guarda en el teléfono? |
|---|---|---|
| **Cuenta** | El usuario existe en el backend | No aplica — vive en el servidor |
| **Sesión** | "Este teléfono ya está autenticado" | **Sí** — esto es lo que persiste |
| **Contraseña** | El secreto que se escribió | **Nunca** |

### Modelo de tokens
1. **Primer ingreso:** usuario + contraseña → backend valida y devuelve **dos tokens**:
   - **access token** (corto, minutos) — abre cada pantalla/llamada.
   - **refresh token** (largo, semanas/meses) — guardado en **almacenamiento seguro**
     del dispositivo (Keychain / Keystore), nunca en `localStorage` plano en producción.
2. **Cada apertura:** la app **renueva la sesión en silencio** con el refresh token.
   El usuario no vuelve a escribir nada → entra directo a su módulo según rol.
3. **Solo re-pide contraseña** si el refresh token venció (mucho tiempo sin entrar) o si
   el admin lo revocó.

### Desbloqueo diario · PIN + biometría
Las apps ya usan **PIN de 4 dígitos** — es el patrón correcto:
- **Día 1 (alta del dispositivo):** usuario + contraseña → se crea la sesión larga →
  el operario **crea un PIN** y opcionalmente activa **huella / Face ID**.
- **Uso diario:** **PIN o biometría** desbloquea la sesión ya guardada. Rápido, funciona
  sin señal, sin tipear contraseñas largas con guantes en el muelle.
- **El PIN no es la contraseña** — es la llave local para reabrir la sesión. Tras N
  intentos fallidos se borra la sesión local y hay que re-login con contraseña.

### Estados a implementar (los 6 del canvas)
1. **Primer ingreso** — usuario + contraseña + toggle **"Recordar este dispositivo"** (ON).
2. **Dispositivo vinculado** — confirma equipo, crea PIN, ofrece biometría.
3. **Desbloqueo diario · PIN** — "Sesión activa · sin contraseña".
4. **Desbloqueo biométrico** — prompt de huella con fallback a PIN.
5. **Sesión expirada** (p. ej. 90 días sin actividad) — re-login una vez; datos intactos.
6. **Reset desde ERP** (admin) — ver abajo.

### Por qué NO grabar la contraseña
- Una contraseña guardada en el equipo, cualquiera que tome el teléfono la tiene.
- Un **token se revoca** desde el ERP sin que el usuario cambie nada.
- Regla de oro: el teléfono **nunca debe poder leer** la contraseña, solo demostrar que
  alguna vez la supo.

### Recuperación de acceso · por admin (no por email)
Los operarios suelen **no tener correo corporativo** → la recuperación self-service por
email **no sirve** para ellos.
- **Operarios:** reset **desde el ERP** (módulo Operarios PWA): el admin genera un
  **PIN temporal** (vence en 24 h); el operario entra con él y crea el suyo. Cero correos.
- **Clientes del Portal** (sí tienen email/teléfono): recuperación self-service por email/SMS.

---

## 🖥 Control desde el ERP · módulo "Operarios PWA"

`erp/modules/operarios-pwa.jsx` (`window.ModuleOperariosPWA`) — centro de control de las
apps de campo. Tabs: **Directorio + estado · Apps PWA · Actividad · Gestión de acceso**.

Acciones de acceso por operario (sección "Gestión de acceso"):
- **Resetear PIN** → genera PIN temporal (24 h).
- **Forzar re-login** → invalida la sesión; el operario re-loguea con contraseña.
- **Revocar acceso** → mata el refresh token del dispositivo (equipo perdido/robado).

Muestra por operario: nombre, dispositivo, app/versión, sitio, estado
(`online·ruta·offline·fuera`), batería, último sync, scans, tareas pendientes.

> Consistencia: `op-005` (Yusneidy) se rotula **"Almacenista"** en el directorio
> (antes "Bodeguera"); unificado 2026-06-01. La app de almacén figura como "Almacenista"
> (archivo `Almacenista VE.html` sin cambio).

---

## 📦 Apps y flujos que ya existen (prototipo)

Todas son React in-HTML (sin build), montan sobre `erp/tokens.css` + `erp/icons.jsx`.

| App | HTML | Lógica | Qué hace |
|---|---|---|---|
| **Operario CN** | `Operario CN.html` | `operario/app.jsx` | Recepción/inspección en Yiwu: login (ES/中文) → escaneo o manual → fotos → identificar → datos (HS/CBM/peso) → confirmar. Despacho incluido. |
| **Operario VE** | `Operario VE.html` | `operario/ve.jsx` *(IIFE)* | Chofer/entrega: rutas asignadas → cargar camión sellado → confirmar → ruta GPS → docs → firma → POD. |
| **Almacenista VE** | `Almacenista VE.html` | `operario/almacenista.jsx` | Almacén Valencia: **recibir contenedor** (lista → escaneo de cajas) + **despachar camión** (camión → chofer → items → pase QR). |
| **Despacho · Vista 3** | `Despacho · Vista 3.html` | `operario/almacenista-despacho.jsx` *(IIFE)* | Variante avanzada de despacho con cola por ruta y paradas Maracay→Caracas. |
| **Transportista** | `Transportista.html` | `operario/transportista.jsx` *(IIFE)* | Ruta activa con GPS, foto de fachada, llegada y POD por parada, alerta de ubicación. |
| **Operario · App** | `Operario · App.html` | reusa `almacenista.jsx` + `ve.jsx` | **APK único** (reemplaza a Operario Multi): login usuario+contraseña → auth mock → ruteo por rol → multi-rol abre picker → Modo Bodega / Chofer, con sesión persistente (PIN). |
| **Mobile ERP** | `Mobile ERP.html` | `mobile/app.jsx` | **No es para operarios** — vista móvil del usuario ERP (Admin/Comercial): tracking, clientes cerca, gastos rápidos. |
| **Portal Cliente Mobile** | `Portal Cliente Mobile.html` | `portal/app.jsx` | Portal del **cliente** en móvil (MARKBOX, embarques, estado de cuenta). |

### Reuso de flujos (seam ya construido)
Para que el launcher multi-rol reuse pantallas sin re-login ni rediseño, las apps exponen
sus sub-flujos:
- `operario/almacenista.jsx` → `window.AlmacenistaFlows = { ReceptionFlow, DispatchFlow }`
- `operario/ve.jsx` *(IIFE)* → `window.OperarioVEFlows = { DeliveryFlow }`

**Regla de scope (importante):** los scripts Babel **comparten scope global**. Todo `.jsx`
que se co-cargue con otro va envuelto en **IIFE** y solo escapa su `window.X`, para que los
helpers homónimos (`Steps`, `Login`, `MobileHeader`, `Home`…) no se pisen.

---

## 📡 Offline-first y sync (crítico para campo)

Operarios trabajan en **muelle y ruta, con señal intermitente**. El paquete del teléfono
debe asumir offline como estado normal:
- **Sesión y PIN funcionan sin red** (la sesión ya está guardada localmente).
- **Cola de acciones offline:** escaneos, fotos, POD, firmas se guardan localmente y se
  **sincronizan cuando vuelve la señal** (el indicador "último sync" del ERP refleja esto).
- **Datos del día precargados:** rutas asignadas, contenedores por recibir, camiones por
  armar se bajan al entrar y quedan disponibles offline.
- **Conflictos:** el servidor es la verdad; al sincronizar, resolver por timestamp y avisar
  si una tarea ya fue cerrada por otro.

> En el prototipo todo persiste en `localStorage` (mock). En producto real = cola de
> outbox + sync contra el seam `window.DTDApi`.

---

## 🔌 Backend que pide el paquete móvil

> El seam ya existe: `window.DTDApi` / `window.DTDAuth` (`erp/api/client.jsx`), `mode:'mock'|'rest'`.
> **No cambiar la firma del seam** al portar. Detalle del contrato en `backend/API-CONTRACT.md`.

| Capacidad | Endpoint conceptual | Devuelve / hace |
|---|---|---|
| Login | `POST /auth/login` | `{ tenant, role, permissions, accessToken, refreshToken, user }` |
| Renovar sesión | `POST /auth/refresh` | nuevo `accessToken` (silencioso al abrir) |
| Cerrar / revocar | `POST /auth/logout`, `POST /auth/revoke` | mata refresh token del dispositivo |
| Reset por admin | `POST /operarios/{id}/reset-pin` | PIN temporal 24 h |
| Rutas del chofer | `GET /routes?assignee=me&day=today` | órdenes asignadas + estado |
| Confirmar carga | `POST /routes/{id}/confirm` | el chofer acepta la ruta |
| Recibir contenedor | `GET/POST /receptions` | lista + escaneo de cajas |
| Despachar camión | `POST /dispatches` | armar camión, asignar chofer, pase QR |
| POD / entrega | `POST /deliveries/{id}/pod` | firma + foto + recibido por |
| Sync offline | `POST /sync/batch` | drena la cola de outbox |

Cada llamada va con `Authorization: Bearer <accessToken>`; el backend **verifica
`tenant` + `permissions`** en cada una (la app no es la frontera de seguridad).

---

## 🎨 Marca y stack (no re-derivar)

- **Tokens:** `erp/tokens.css` (light + dark). Color, tipografía, spacing, radios, sombras.
  Cero hex inventados — `var(--*)` siempre.
- **Tipografía:** sistema → **Nunito Sans** (`--f-sans`) + **Sora** (`--f-display`);
  códigos → **JetBrains Mono** (`--f-mono`); chino → Noto Sans SC. Branding/logo →
  Archivo / Archivo Black. Ninguna otra.
- **Logo:** 4 variantes oficiales (`assets/dtdcargo-isologo-*.png`). Sobre navy usar
  **`-reverse`** (nunca `filter: invert` sobre el isólogo). Ver `BRAND-MIGRATION-2026-05.md`.
- **Íconos:** `window.Icon` (`erp/icons.jsx`) — nunca emoji decorativo en UI de producto.
- **Componentes:** `window.ERPUI` primero; inventar solo con `/* TODO: brand-review */`.
- **Códigos (mono):** MARKBOX `DTD-XXXX` (cara al cliente) / Shipping Mark 唛头 (cara al
  proveedor CN, mismo valor), containers `DTDU-XXXXXX`, rutas `R-2026-XXXX`.
- **Tono:** castellano rioplatense/venezolano neutro, voseo, verbos directos en CTAs
  ("Confirmar ruta", "Recibir contenedor"). Sin emoji ni exclamaciones múltiples en UI.

---

## ✅ Orden sugerido de implementación

1. **Auth real** (`/auth/login` + `/auth/refresh` + almacenamiento seguro de tokens) →
   reemplaza los logins independientes de cada app por el **login único + ruteo por rol**.
2. **Ruteo por rol** centralizado (operario / almacenista / transportista / multi-rol).
3. **Sesión persistente + PIN/biometría** (los 6 estados del canvas).
4. **Offline-first**: cola de outbox + precarga del día + sync contra `window.DTDApi`.
5. **Cablear los flujos existentes** a endpoints reales (recepción, despacho, rutas, POD).
6. **Gestión de acceso desde el ERP** (reset PIN / forzar re-login / revocar).
7. **Empaquetado**: PWA instalable o wrapper (Capacitor/TWA) — un solo build para todos
   los tenants.

> Regla transversal: **no rehacer lo existente.** Verificá contra `CHANGELOG.md`; si hay
> duda, preguntá. Avisá antes de violar una regla de marca (formato `BRAND-CHECK` en `CLAUDE.md`).
