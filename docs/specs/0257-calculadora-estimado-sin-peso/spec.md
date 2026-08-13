---
sdd: 0257
title: La calculadora da precio sin el peso, y dice hasta cuándo vale
status: in-progress
author: Claude (ventana 2026-08-13)
created: 2026-08-13
updated: 2026-08-13
supersedes: null
superseded_by: null
related: [0061, 0164, 0237]
confidencialidad: interna
---

# SDD-0257 · La calculadora da precio sin el peso, y dice hasta cuándo vale

## Problema

El cliente escribe su CBM, se olvida del peso, y **la calculadora no muestra
nada**. No es un estado de "falta un dato": es un estado que se lee como roto.

Medido en el código:

| Dónde | Qué hace hoy |
|---|---|
| `components/CalculadoraForm.tsx:225` | `tieneCarga = cbmTotal > 0 && pesoKg > 0` |
| `components/CalculadoraForm.tsx:1222` | Panel: *"Ingresa tu CBM y peso para ver el estimado al instante."* |
| `components/CalculadoraForm.tsx:1388` | **Todo el CTA vive detrás de `tieneCarga`** → sin peso no hay desglose, ni nudge, ni botón de WhatsApp |
| `lib/calculadora.ts:687` | El motor devuelve `carga_invalida` si `pesoKg <= 0` |

Lo que lo vuelve cruel: **el contenedor sí se llena** (`ContainerFill` usa sólo
el CBM, `CalculadoraForm.tsx:541`). El cliente escribe 12 m³, ve la barra subir
al 18%, y del otro lado no aparece nada. No parece "me falta un dato", parece
que se trancó — y se va sin escribirle a nadie.

## Por qué se puede dar precio sin el peso

El peso toca el precio por **una sola vía**: el recargo por densidad — los kg
que pasan de `pesoIncluidoKg` (1.000 kg) por m³ se cobran a `recargoExcedenteKg`
($2/kg), `lib/calculadora.ts:769`. Además dispara dos derivaciones al asesor:
más de `pesoMaxContenedorKg` (27.000 kg) y el anti-monopolio "pesado **y**
denso" (`pesoMaxEnvioKg` 9.000 kg con densidad sobre el equilibrio del
contenedor, ~397 kg/m³).

O sea: sin peso el precio **se calcula completo**, y lo que sale es el **piso
real** — el precio exacto de cualquier carga que no sea densa, que es la
mayoría. No es un número inventado ni un promedio.

## El riesgo, y cómo se acota

Si el cliente asume que ese número es final y su carga es densa, el reclamo
llega después: 12 m³ con 18.000 kg suma **+$12.000** de excedente y el precio se
dobla.

Por eso el aviso **no puede ser decorativo**: tiene que decir **hasta cuántos kg
vale ese precio**. Ese techo sale del propio motor y es la pieza central de esta
spec — se llama `pesoMaxSinRecargo(cbm, params)` y devuelve el peso máximo que
cumple las dos condiciones a la vez:

1. **no suma recargo** → `peso ≤ cbm × pesoIncluidoKg` (topeado en
   `pesoMaxContenedorKg`), y
2. **sigue auto-cotizando** → no cae en el anti-monopolio, o sea no es
   simultáneamente `> pesoMaxEnvioKg` y más denso que el equilibrio.

```
techo = min(cbm × pesoIncluidoKg, pesoMaxContenedorKg)
si techo ≤ pesoMaxEnvioKg        → techo
si no                            → max(pesoMaxEnvioKg, min(techo, cbm × equilibrio))
```

Comprobado a mano: 5 m³ → 5.000 kg · 12 m³ → 9.000 kg (no 12.000: ahí ya
derivaría al asesor) · 30 m³ → 11.912 kg (no 27.000, por la misma razón).

Vive en el motor y no en la UI **a propósito**: es el mismo criterio de
`mensajeDestinoSinTarifa` — el copy que el motor puede contradecir se escribe
donde vive la regla.

## Decisión

**Opción 1 + la parte barata de la 4** (founder, 2026-08-13).

### 1 · "Desde $X" con el peso en estado pendiente, no en error

* El total muestra **`Desde $8.400`** con una píldora **"falta el peso"** en vez
  de `$8.400`.
* El campo Peso toma **borde wine** — el tono `info` que ya existe para el
  excedente, **no rojo**: no es un error, es un dato que falta.
* En el desglose aparece una **fila fantasma** "Excedente de peso" con `?` en
  vez de monto y el subtexto *"falta el peso de tu carga"*. Esa fila es la que
  enseña: el cliente ve que falta un renglón, sin que nada lo bloquee.
* Al escribir el peso, "Desde" pasa a "Total estimado" y la fila fantasma se
  llena o desaparece sola.
* **El CTA se habilita.** Ese es el punto de todo el cambio.

### 4 (barata) · El asesor recibe "sin indicar", no "0 kg"

`whatsappTextFromCotizacion` hoy escribiría `• Peso total: 0 kg`, que le miente
al asesor. Pasa a decir **`• Peso total: sin indicar`** más la línea de qué
significa el precio que el cliente está viendo. Sin modal ni paso extra: en
`/tarifas` el CTA va directo a wa.me (`directWhatsApp`) y montar un modal ahí es
trabajo que esta spec no compra.

### Lo que NO se hace

* **Presets de peso** (opción 2 del análisis): necesita que el founder dicte las
  densidades típicas por rubro. Queda para después.
* **Rango mín–máx con slider** (opción 3): descartada — un rango lee como
  incertidumbre y el número de arriba asusta.
* **Modal que pide el peso a la salida** (opción 4 completa): `/tarifas` no
  tiene modal hoy. Si algún día se monta, el campo entra ahí.

## Alcance

Un solo componente sirve las 4 superficies: `/tarifas` y `/tarifas/embed`, cada
una con sus 2 pestañas (puerta a puerta y consolidado). El cambio las cubre
todas. En consolidado aplica igual: su puerta de 1 m³ es de **volumen**, no de
peso.

No toca `/calculadora-terrestre` (último km) ni el FCL: son motores aparte.

## Cambios

### `lib/calculadora.ts`

1. `EnvioInput.pesoKg` pasa a `pesoKg?: number | null`. **`0`, `null` y
   `undefined` son todos "no indicado"** — el `DecimalInput` devuelve `0` cuando
   el cliente borra el campo, así que no hay forma de distinguirlos ni motivo
   para hacerlo.
2. El corte de `5.3` deja de exigir peso: `carga_invalida` queda **sólo para
   CBM ≤ 0**, con su mensaje ajustado.
3. `EnvioCotizacion` suma `sinPeso: boolean` y `pesoMaxSinRecargoKg: number` —
   la UI no re-deriva la regla.
4. `pesoMaxSinRecargo()` + `mensajeEstimadoSinPeso()` exportados.
5. `whatsappTextFromCotizacion` dice "sin indicar".

### `components/CalculadoraForm.tsx`

6. `tieneCarga` pasa a depender **sólo del CBM**.
7. `pesoWarning` gana la rama "sin peso" (tono `info`).
8. `ResultPanel`: sello "Desde", píldora, nota, fila fantasma, nudge propio.
9. Payload del `EstimadoModal`: `weightKg: null` en vez de `0`
   (`CalculadoraForm.tsx:642`).

## Verificación

* Tests nuevos en `__tests__/calculadora.test.ts`: cotiza sin peso, el techo es
  el correcto en los tres tramos (bajo el anti-monopolio, dentro, y sobre él),
  el recargo por densidad es 0, y **el precio sin peso es idéntico al de la
  misma carga con peso justo en el techo** (esa es la prueba de que "desde" no
  miente).
* `node scripts/verify.mjs` en verde.
* `/ui-check` antes del commit (regla del founder para cambio visual).
