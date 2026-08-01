---
sdd: "0225"
title: "Registro público: el correo se valida y los errores dicen dónde están"
status: done
author: "Sam (founder) + Claude Code"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0061", "0082", "0131"]
confidencialidad: interno
---

# SDD-0225 · Registro público: el correo se valida y los errores dicen dónde están

## Decisión

El formulario público de registro valida el formato del correo **en el
navegador**, con la misma función que ya usa el servidor, y los errores que
devuelve el servidor se muestran **en el paso donde está la persona**, nombrando
el campo que falló y ofreciendo un camino de vuelta a ese campo.

No es una mejora: es corregir una **no conformidad** contra tres políticas de
gobernanza ya aprobadas (FRM-01, ERR-01, A11Y-01), y es el primer slice de
adopción de FRM-01 y ERR-01 fuera del Studio.

## Por qué

Caso real del 31-jul-2026. Un visitante llegó al **paso 4 de 5** con el correo
`adggs`, con los tres pasos anteriores marcados en verde, y el botón "Crear
cuenta y generar tu Shipping Mark" habilitado. Al apretarlo, el servidor lo
rechazó y en pantalla apareció una línea roja sin nombre de campo y sin
indicación de a qué paso volver.

Dos fallos encadenados:

1. **El navegador no validaba el formato.** `lib/portal/register-types.ts`
   validaba bien server-side, pero su `EMAIL_REGEX` **no estaba exportada**, así
   que `RegisterForm.tsx` había terminado con su propia comprobación:
   `errEmail = tried && !data.email.trim()` — solo "no vacío". El `type="email"`
   del input tampoco ayudaba: la navegación entre pasos es estado de React, no
   submit nativo, así que el navegador nunca llegaba a validar.

2. **El mensaje se pintaba donde nadie lo veía.** `state.fieldErrors.email` se
   le pasaba a `StepIdentidad`, que es el **paso 1**. Quien aprieta el botón está
   en el **paso 4**. `StepConfirmar` solo recibía el error genérico.

## Clasificación de gobernanza

| Política | Cláusula | Antes | Después |
|---|---|---|---|
| FRM-01 | "La primera validación de formato ocurre al salir o al enviar" | no conformidad | cumplimiento |
| FRM-01 | "El primer error bloqueante recibe foco y existe resumen cuando hay varios" | no conformidad | cumplimiento |
| FRM-01 | "Un estado positivo se anuncia sólo cuando confirma información útil… no como check verde ornamental" | no conformidad | cumplimiento |
| ERR-01 | Nivel campo: "debajo del campo + relación accesible" | no conformidad | cumplimiento |
| ERR-01 | Nivel formulario: "resumen en cabecera + campos marcados" | no conformidad | cumplimiento |
| ERR-01 | "El error aparece cerca de su causa" | no conformidad | cumplimiento |
| ERR-01 | "El mensaje responde qué ocurrió, qué se conservó y qué puede hacer la persona" | no conformidad | cumplimiento |
| A11Y-01 §9 | "Errores se identifican, describen y reciben foco/resumen cuando bloquean" | no conformidad | cumplimiento |
| A11Y-01 §7 | "Movimiento reducido conserva estado y significado" | no conformidad | cumplimiento |

## Qué cambia

**Fuente única del formato.** `EMAIL_REGEX` deja de ser privada y se expone como
`isValidEmail()`, con el porqué escrito encima. El formulario la importa; no hay
una segunda copia que se pueda desincronizar.

**Vacío y mal escrito son errores distintos.** "Campo obligatorio" no le sirve a
quien ya escribió algo. El mensaje nuevo es concreto: *"Ese correo no parece
válido. Revisa que tenga @ y el dominio, como cperez@empresa.com."*

**Resumen de errores en Confirmar.** Bloque con `role="alert"` que lista cada
campo con su nombre humano (`Correo`, no `email`), el mensaje del servidor y un
botón **Corregir** que devuelve al paso donde vive el campo y le da el foco.
Sirve para los seis campos, no solo el correo. Incluye la frase que ERR-01 exige
y faltaba: *"No perdiste nada de lo que escribiste."*

**Accesibilidad que no estaba.** `aria-describedby` atando cada mensaje a su
input, `aria-invalid` en los campos con error, e `inputMode`/`autoComplete`
correctos (FRM-01 los pide explícito para móvil).

**Robustez.** `scrollIntoView` iba sin guarda y **reventaba dentro del efecto**
donde no existe esa función (jsdom, webviews viejos), tumbando el componente.
Ahora es opcional y respeta `prefers-reduced-motion`.

## Allowlist

```
lib/portal/register-types.ts                              (isValidEmail exportada)
app/registro/RegisterForm.tsx                             (validación + resumen + a11y)
app/registro/__tests__/register-email-format.test.tsx     (nuevo)
app/registro/__tests__/register-error-summary.test.tsx    (nuevo)
docs/specs/0225-registro-validacion-y-errores/spec.md     (nuevo)
```

Fuera de alcance: el backend del registro queda **intacto** — mismos campos, misma
server action, mismo honeypot, mismo chequeo de duplicados. Cero migraciones, cero
cambios en Supabase.

## Verificación

- `pnpm typecheck` · `pnpm lint` (0 errores, **0 warnings**) · `pnpm test` →
  **4368 tests en 350 archivos**, todos verdes. 9 tests nuevos.
- **Prueba de mutación, obligatoria en este repo:**
  - Devolver `step0Valid` a `!!data.email.trim()` → **4 tests en rojo**.
  - Desconectar el resumen (`fieldErrors={[]}`) → **3 tests en rojo**.
  - Cada archivo de test lleva escrito arriba cómo reproducir su mutación.

## Deuda que queda anotada, no resuelta acá

1. **El registro no captura estado ni ciudad.** `actions.ts` escribe
   `city: null, state: null` y las columnas ya existen en `clients`. Capturarlas
   —con el estado autocompletándose desde la ciudad, y un "Mi ciudad no aparece
   aquí" que abra texto libre sujeto a aprobación— es el slice siguiente. No
   necesita migración.
2. **Dos catálogos de Venezuela en paralelo:** `lib/data/venezuela-catalog.ts`
   (código, 24 estados + municipios + parroquias + barrios, con helpers, portado
   explícitamente para el "CityPicker para registro cliente" y **nunca
   conectado**) y `ve_locality_catalog` (base, 99 filas). Hay que decidir cuál
   manda antes de construir encima.
3. **El formulario de dirección del portal** tiene el mismo patrón de error
   genérico y su campo Estado es texto libre. Le toca la misma adopción.
