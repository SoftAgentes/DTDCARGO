---
sdd: "0302"
title: "El portal y el ERP móvil no refrescaban la sesión — el arreglo se escribió el 2-ago y quedó archivado"
status: in-progress
author: "founder"
created: 2026-08-26
updated: 2026-09-02
supersedes: null
superseded_by: null
related: ["0304"]
confidencialidad: interno
---

# DTD-0302 — El refresco que nunca aterrizó

> Sale de SDD-0304. Al descubrir que una poda entera quedó en una rama
> archivada, se revisaron los **32 commits** de esa rama que nunca llegaron a
> `main`. Uno arreglaba un bug de sesión — y sigue vivo.

## El bug

`proxy.ts` hace **dos** cosas, y sólo una es evidente:

1. **Redirige** `/studio` y `/back` sin sesión → visible, se prueba fácil.
2. **Refresca el access token en cookies** → invisible.

El punto 2 le hace falta a **toda** ruta que resuelva la sesión server-side,
tenga o no redirección. Pero el matcher decía sólo:

```ts
matcher: ["/studio/:path*", "/back/:path*"]
```

`/portal`, `/m/erp` y `/m/emp` autentican con **el mismo Supabase** y estaban
fuera. Al vencer el access token —1 h por defecto— la navegación server-side ve
la sesión muerta y echa al usuario **aunque su refresh token siga vivo**.

Es el bug que se reporta como «me saca solo» y que **no reproduce nadie**,
porque hay que esperar una hora. Y llega justo cuando 133 cuentas de portal
empiezan a usarse.

## Por qué estuvo tres semanas ahí

El arreglo se escribió el **2026-08-02** (`44b4f052`) y quedó en
`origin/archive/radiografia-erp-20260802` — la misma rama archivada de
SDD-0304.

## ⚠️ Y la lista de aquel commit ya estaba vencida

Cubría `/portal` y `/m/erp`. Hoy hay **más**:

| Ruta | Cómo autentica | ¿Al matcher? |
|---|---|---|
| `/portal` | `createClient()` server-side | ✅ |
| `/m/erp` (+ bitácora) | `auth.getUser()` server-side | ✅ |
| **`/m/emp`** | `auth.getUser()` server-side | ✅ **no existía en agosto** |
| **`/entrar`** | resuelve sesión y redirige a `/portal` | ✅ (ver abajo) |
| **`/registro`** | idem | ✅ (ver abajo) |
| `/m/cn` · `/m/ve` | **PIN**, no Supabase | ❌ fuera a propósito |

Mismo patrón que `FclCalculator` en SDD-0304: **una lista caduca**. Por eso el
alcance se midió contra el código de hoy, no se copió del commit.

### ⚖️ `/entrar` y `/registro`: entran, y cuestan

Son las puertas del portal y ya resuelven la sesión por su cuenta: si hay
usuario, redirigen a `/portal`. **Sin el refresco, quien entró ayer pulsa
«Entrar» y ve otra vez el formulario de login** en vez de su portal — cree que
lo sacaron. Con 133 cuentas por estrenar, eso es carga de soporte.

El costo es real y acotado: esas dos páginas **ya llaman a `getUser()`**, así
que el proxy agrega una segunda ida al servidor **en esas dos**. El resto del
sitio público sigue con cero overhead. Si el tráfico de `/registro` lo hace
pesar, se sacan de una línea del matcher.

**Ninguna de las cinco rutas nuevas recibe redirección**: los únicos bloques de
la función son `startsWith("/studio")` y `startsWith("/back")`, así que caen al
`return supabaseResponse` final — exactamente el refresco que les faltaba.

## 🔴 El contrato, y la mutación que lo salvó de ser decorado

`app/__tests__/proxy-matcher-contract.test.ts` escanea `app/`, encuentra las
pantallas que resuelven la sesión y exige que el matcher las cubra. Escanea en
vez de llevar una lista, justamente porque las listas caducan.

**La primera versión no servía.** Detectaba `auth.getUser()`, y al validarla por
mutación —quitando `/portal` del matcher— **siguió verde**: el layout del portal
no llama a `getUser()` directo, crea el cliente y delega en `getPortalClient()`.
El contrato no protegía el caso que lo motivó.

La señal correcta es **crear el cliente server-side de Supabase**: ese cliente
lleva la sesión y la RLS depende de ella, así que la ruta necesita el refresco
resuelva la identidad donde la resuelva.

Con el detector corregido, quitar **cualquiera** de `/portal`, `/m/emp` o
`/entrar` pone el contrato en rojo. Verificado una por una.

## Verificación

1. **4 tests** del contrato en verde.
2. **Mutación, tres veces**: quitando `/portal`, `/m/emp` y `/entrar` del
   matcher → rojo cada vez. Y la mutación que descubrió que el detector inicial
   era decorado.
3. Un test extra asegura que el escaneo **encuentra pantallas de verdad** — un
   escaneo que no encuentra nada pasa siempre.
4. Gate completo `node scripts/verify.mjs`.

## Lo que esta spec NO puede afirmar

**Que el refresco funcione en producción.** Probarlo exige una sesión real y
esperar a que venza el access token —una hora—, que es precisamente por lo que
el bug sobrevivió tanto. Lo que sí está medido es que las rutas afectadas ahora
**pasan por el proxy**, que es la condición que les faltaba.

Tampoco se abrió ninguna pantalla en un navegador.

## Reconciliación Codex · 2026-09-02

Implementación `8020e847` contenida en `origin/main@2a2e81bf`; `proxy.ts`
conserva el comportamiento existente. Se agregan 22 pruebas en
`app/__tests__/proxy-refresh.test.ts`, usando el matcher de Next instalado,
`NextRequest`/`NextResponse` y el proxy reales. Sólo la frontera Auth es
sintética: genera valores de cookie de prueba, no tokens ni sesiones reales.

Ocho rutas raíz/anidadas de los cinco prefijos comprueban cookies hacia
request/Server Components y respuesta/navegador, preservación de opciones y
cookies ajenas, y ausencia de redirección. Otras ocho comprueban la salida sin
sesión; seis rutas PIN/públicas siguen fuera del matcher. El lote de acceso
pasó 61 pruebas en cuatro archivos, incluidos los cuatro contratos originales.

**Se mantiene `in-progress`.** Esta ejecución prueba el puente, no la renovación
criptográfica ni el transporte de cookies en un navegador real. Sigue pendiente
la navegación con access token vencido y refresh válido en un entorno autorizado,
incluida la siguiente petición y las opciones de cookie del despliegue real.
No se leyó ni escribió una sesión alojada. Evidencia y límites:
`docs/audits/2026-09-02-codex-reconciliacion-acceso.md`.
