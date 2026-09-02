---
sdd: "0299"
title: "Datos de la empresa: el error deja de ser mudo — y son DOS gates, no uno"
status: in-progress
author: "founder"
created: 2026-08-25
updated: 2026-09-02
supersedes: null
superseded_by: null
related: ["0298", "0297", "0120", "0273"]
confidencialidad: interno
---

# DTD-0299 — El error dice su causa

> Salió de una sesión de diagnóstico real: las cuentas bancarias de la empresa
> **no se guardaban** y la pantalla no decía por qué. Encontrar la causa costó
> leer la definición de una función de Postgres en producción.

## El síntoma

El founder cargó las cuentas bancarias en *Studio › Administración › Datos de la
empresa*. Medido después en producción:

| | |
|---|---|
| `company_bank_accounts` | **0 filas** — ninguna borrada, ninguna oculta |
| `audit_d1_operations` con `bank_account.save` | **ninguna, en toda la historia** |

Nada. Y la pantalla no había dicho nada útil.

## Por qué costó tanto encontrarlo

Se descartaron, en orden y midiendo cada una:

| Hipótesis | Cómo se descartó |
|---|---|
| Base de datos equivocada | `.env.local` apunta al mismo proyecto |
| Una rama de Supabase (preview) | sólo existe `main`, y **es** producción |
| RLS bloqueando | política correcta por tenant |
| La RPC no maneja el caso | sí lo maneja, e inserta bien |
| Pantalla no montada | montada en `admin/page.tsx:747` |
| El drawer se traga el error | lo muestra; sólo cierra con `state.ok` |
| Permiso del módulo | `canEditModule` deja pasar a `admin` en la 1ª línea |

Todo sano. La causa estaba en el único sitio que no se había mirado.

## 🔴 Son DOS gates, y no dicen lo mismo

```
1 · app   moduleEditDenial("admin") → canEditModule()
          admin pasa · acepta overrides por rol

2 · base  audit_d1_execute()
            └─ audit_d1_admin_tenant()
               exige user_tenants.role = 'admin' LITERAL
               si no → raise permission_denied (42501)
```

El segundo es **más estricto** que el primero y vive en Postgres, no en el
código de la app. Un rol `accounting`, o un usuario sin fila en `user_tenants`,
pasa el primero y muere en el segundo.

**Y muere en la primera línea de la RPC**, antes de insertar el registro de
auditoría. Como es una excepción, la transacción se revierte entera: no queda
la fila **ni** el rastro. Desde afuera es idéntico a "no pasó nada".

Medido el 2026-08-25: ninguna de las 4 cuentas con rol `admin` tenía sesión
activa ese día; sí la tenían 6 clientes del portal y una cuenta `accounting`.

## La cura: el error deja de ser mudo

El código tipado **ya existía**. `mapDatabaseError` convierte el `42501` en un
`D1OperationError("permission_denied")`… y los cinco `catch` de
`company-actions.ts` lo tiraban:

```ts
} catch {
  return { error: "No se pudo guardar la cuenta." };
}
```

Ahora cada uno extrae el código y lo traduce. `permission_denied` dice
literalmente que falta el rol de administrador y a quién pedírselo.

### Dónde vive el traductor, y por qué no en la action

En `lib/studio/company-types.ts`, como función pura `mensajeDeErrorD1(code,
generico)`.

- **No puede vivir en la action:** un archivo `"use server"` sólo exporta
  funciones async. Exportar una función síncrona rompe el **build** — y
  `typecheck` no lo ve.
- **Recibe el CÓDIGO, no el error:** `company-types.ts` no tiene ningún import y
  lo consumen componentes cliente. Importar el adaptador metería `node:crypto`
  en ese bundle.
- **El genérico lo pone cada action**, porque lo útil de ese texto es que nombre
  la acción concreta ("no se pudo guardar la oficina"), no el código.

Hermano del `mensajeDeError` de `usuarios/actions.ts` (SDD-0273), que arregló
este **mismo** bug en otro módulo. No se comparten a propósito: el valor de cada
mensaje está en nombrar su contexto.

## Lo que esta spec NO hace

- **No cambia los gates.** Que la base exija `admin` literal es una decisión de
  seguridad y se respeta. Lo que se arregla es que el rechazo **se explique**.
- **No unifica los dos gates.** Podrían divergir más y valdría revisarlo, pero
  tocar el guard de la app para que coincida con el de la base es un cambio de
  permisos, no de mensajes.
- **No carga las cuentas bancarias.** Los números de cuenta los escribe una
  persona en la pantalla.

## Verificación

1. `pnpm typecheck` limpio.
2. **5 tests** sobre `mensajeDeErrorD1`, incluida la regla de que **nunca**
   devuelve el código crudo (el bug de SDD-0273 en el otro módulo).
3. **Validado por mutación:** quitando la traducción de `permission_denied`, el
   test que vigila esa regla se pone en rojo y los otros 4 siguen verdes.
4. Los 5 `catch` pelados del archivo: **0 restantes**.
5. Gate completo `node scripts/verify.mjs`.

## Lo que esta spec NO puede afirmar

**Que el mensaje nuevo se vea en pantalla.** No se abrió el drawer en un
navegador. La cadena está probada por tipos y por la función pura; que el texto
llegue al usuario depende del `FormError` que ya existía en la línea 146 del
drawer y que no se tocó.

## Reconciliación Codex · 2026-09-02

Implementación `f23557dd` contenida en `origin/main@2a2e81bf`; action,
adaptador y traductor conservan el comportamiento existente. Se agregan 30
pruebas en `app/studio/(app)/admin/__tests__/company-actions.test.ts`: ejecutan
las cinco actions y el adaptador D1 reales con una frontera RPC sintética.
Comprueban rechazo de permisos, registro inexistente, error desconocido,
excepción no tipada, rechazo previo del módulo y éxito explícito. Los rechazos
no producen `ok` ni revalidan la página; los detalles internos no salen al estado.

El lote de acceso pasó 61 pruebas en cuatro archivos, incluidos los cinco
tests originales del traductor. No es una nueva reproducción del fallo
histórico ni una prueba del permiso en Postgres: la frontera RPC está simulada.

**Se mantiene `in-progress`.** Falta abrir el drawer en navegador, provocar un
rechazo controlado y comprobar mensaje visible, permanencia del formulario y
ausencia de falso éxito. No se cargaron cuentas ni se modificaron permisos.
La evidencia y los gates proporcionales viven en
`docs/audits/2026-09-02-codex-reconciliacion-acceso.md`.
