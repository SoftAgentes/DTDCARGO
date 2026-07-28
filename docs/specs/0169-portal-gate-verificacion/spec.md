---
sdd: "0169"
title: "Portal — gate de verificación de identidad"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-07-28
updated: 2026-07-28
supersedes: null
superseded_by: null
related: ["0042", "0138", "0145", "0151"]
confidencialidad: interno
---

# SDD-0169 — Portal · gate de verificación de identidad

## 1. Decisión aprobada

Cerrar cuatro módulos del Portal del Cliente hasta que el cliente complete su
registro, tal como lo define el Norte de Cloud Design
(`_norte/portal/app.jsx` · `LOCKED_VIEWS` + `PortalVerifyGate`).

Módulos cerrados: **Documentos · Referidos · Academia · Soporte**.

Es la **Fase 7 del Revestido** (el portal interior), primera tanda. El founder
la eligió como arranque el 2026-07-28.

## 2. Problema

El portal ya sabía si el perfil estaba completo — `getProfileCompleteness()`
devuelve `{hasPhoto, hasAddress, complete}` desde SDD-0138 — pero ese dato solo
alimentaba **señalización pasiva**: la píldora "Falta completar datos" en la
topbar y el `ProfileIncompleteCard` del dashboard. Nada empujaba a verificar, y
nada dependía de haberlo hecho.

Consecuencia: clientes operando con cuentas sin cédula ni dirección — sin
identidad confirmada para emitir diplomas de Academia, repartir códigos de
referido, o entregar documentos de embarque.

## 3. Alcance

### 3.1 Lógica (pura, sin base de datos)

`lib/portal/verify-gate.ts` — **cero migraciones**. El dato ya existe; esto solo
lo convierte en regla:

| Símbolo | Rol |
|---|---|
| `LOCKED_MODULES` | Los 4 módulos. **Punto único** para abrir/cerrar uno. |
| `MODULE_LABELS` · `MODULE_GATE_COPY` | Etiqueta y copy por módulo (qué se pierde el cliente). |
| `isModuleLocked(module, profile)` | La regla. **Fail-open**: sin dato de perfil, abre. |
| `buildVerifySteps(profile)` | Los 3 chips del Norte (Datos básicos · Dirección · Verificación). |
| `otherModulesSentence` · `missingSentence` | Copy derivado, en español natural. |

Cubierto por `lib/portal/verify-gate.test.ts` (14 tests), incluido un test que
falla si entra **voseo** en el copy (regla del founder: tuteo VE).

### 3.2 Cierre real — servidor

Cada una de las 4 páginas resuelve el gate **antes** de consultar sus datos y
devuelve `<PortalVerifyGate/>` en lugar de su contenido. Un módulo cerrado no
consulta ni firma URLs de nada.

### 3.3 Señalización — barra lateral

`PortalSidebar` recibe `profileComplete` (ya viajaba hasta `PortalShell` para la
topbar) y pinta el candado del Norte: ícono ámbar `opacity .72` expandida,
insignia circular de 13px sobre el ícono colapsada, `title` con el motivo.

**El ítem sigue navegando.** Un botón muerto deja al cliente sin saber por qué
está cerrado; navegando, cae en el gate que se lo explica y le da el CTA.

### 3.4 Pantalla del gate

`app/portal/(app)/_components/PortalVerifyGate.tsx`, espejo del Norte: aro ámbar
con candado · título por módulo · copy · qué falta exactamente · los 3 chips ·
CTA a `/portal/perfil` · pie con los otros módulos que se abren igual.

**Añadido sobre el Norte:** una salida de contacto siempre visible (WhatsApp +
teléfono). Ver §5.

## 4. Contraste (BRAND §♿)

`--color-status-warning` mide 3.14:1 → **no se usa como texto** en ninguna pieza
nueva. Vive en íconos, aros y bordes (no-texto, umbral 3:1). Todo el texto va en
`--color-ink` / `text-grey-700`.

La insignia colapsada usa glifo `--portal-nav-solid` (navy en los dos temas)
sobre relleno ámbar. **No** se usó `--on-warning`: ese token solo está definido
dentro de `.pa-surface` en `app/globals.css:1410`, fuera de ahí no resuelve.

## 5. Riesgo asumido · Soporte

Cerrar **Soporte** es fiel al Norte pero es el módulo con más filo: un cliente
con una carga en curso podría quedarse sin canal por no haber subido la cédula.

Mitigación: la pantalla del gate muestra **siempre** WhatsApp y teléfono
directos, en cualquier módulo. Y `LOCKED_MODULES` es una lista de una línea — si
el founder decide que Soporte queda siempre abierto, se saca de ahí y no hay que
tocar nada más.

## 6. Fuera de alcance

- Migraciones (ninguna: el dato ya existe).
- El flujo de verificación en sí — sigue viviendo en `/portal/perfil` (SDD-0138/0145).
- Las otras brechas de la Fase 7: asistente de 3 pasos de Nueva compra, las 2
  etapas que faltan del ciclo, Seguimiento total por contenedor, estado de cuenta.

## 7. Verificación

- `node scripts/verify.mjs` verde.
- Manual: cuenta sin cédula → los 4 ítems con candado, las 4 rutas muestran el
  gate; al cargar cédula + dirección → candados fuera, módulos abiertos.
