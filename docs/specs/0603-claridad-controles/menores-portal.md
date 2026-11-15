# SDD-0603 · Pendientes menores del portal

Parte de [SDD-0603](spec.md) y de BD-037. Cierra las tres observaciones que dejaron las revisiones independientes del [tramo 3](tramo-3.md) (controles del portal) y del [tramo 4e](tramo-4e.md) (avisos del portal). Rama `claude/0603-m2-menores-portal-b3e5e3`, desde `origin/main` `651bdbd73`.

No cambia nada de lo que ve el cliente: ni la hoja, ni las pantallas, ni los textos. Cambian los dos contratos.

## Allowlist

- `app/portal/__tests__/claridad-portal-contract.test.ts`
- `app/portal/__tests__/avisos-portal-contract.test.ts`
- `app/portal/claridad.css` (autorizado, **no se tocó**: ver el pendiente 3)
- `docs/specs/0603-claridad-controles/menores-portal.md` (este documento)
- `.agents/handoffs/0603-m2-menores-portal.md`

## 1 · El contrato del tramo 3 leía los comentarios

La comprobación «cada `var()` existe en `globals.css` o en la propia hoja» sacaba los tokens usados y los declarados de la hoja **con** comentarios. Dos engaños posibles:

- Una línea `--x: …` escrita dentro de un comentario contaba como declaración: un `var(--x)` sin declarar pasaba.
- Un `var(--x)` citado en un comentario contaba como uso: rompía sin motivo.

Ahora es una función pura, `tokensSinDeclarar(css, globals)`, que quita los comentarios antes de mirar. Dos mutantes nuevos:

| Mutante | Qué hace | Con el arreglo | Sin el arreglo |
|---|---|---|---|
| M6 | Declara `--portal-fantasma` solo en un comentario y lo usa en una regla | lo reporta | no lo ve |
| M7 | Cita `var(--portal-que-no-existe)` solo en un comentario | no lo reporta | lo reporta (falso rojo) |

## 2 · El contrato de avisos no cubría `data-portal-theme="light"`

El portal tiene tres estados de tema, no dos: sin atributo (cuentas sin tema), `data-portal-theme="light"` (lo que deja el botón de tema al volver de oscuro) y `data-portal-theme="dark"`. El contrato solo medía el primero y el último.

Hoy el claro explícito resuelve los mismos colores que el claro sin atributo: `globals.css` no redefine ningún `--color-*` bajo `[data-portal-theme="light"]` ni bajo `[data-portal-theme]`, y `claridad.css` no tiene reglas de franja para esos selectores. El hueco era de vigilancia: una regla escrita para `[data-portal-theme]` a secas le aplica también al claro explícito, y el contrato no lo veía.

Cambios:

- Tercer tema, `claro-explicito`. Sus tokens salen de los bloques `[data-portal-theme="light"]` y `[data-portal-theme]` de `globals.css` y, si no los redefinen, de `@theme`.
- El icono y el fondo de cada tono se resuelven por tema mirando primero las reglas con el atributo que le aplica (`="light"` o `="dark"`, y luego `[data-portal-theme]`), después la del tono y después la común.
- El piso sube de 24 a 36 mediciones (12 por tema).
- `fallasDeHoja` acepta un `globals.css` distinto, para poder mutar los tokens.

| Mutante | Qué hace | Resultado |
|---|---|---|
| M9 | La excepción dorada del icono pasa de `[data-portal-theme="dark"]` a `[data-portal-theme]` | rompe solo en claro explícito (2,44:1); sin el tercer tema pasaba |
| M10 | Regla nueva bajo `[data-portal-theme="light"]` que pone el dorado en el icono | rompe solo en claro explícito |
| M11 | `globals.css` redefine `--color-grey-700` bajo `[data-portal-theme="light"]` | rompe el texto secundario solo en claro explícito |

Límite: entre dos reglas con atributo de tema de la misma especificidad, la cascada real elige la última del archivo; el contrato elige la del valor exacto (`="light"`) antes que la de atributo a secas. Hoy no hay ninguna de las dos.

## 3 · El borde de la franja en claro

**Medición.** La franja no tiene contorno (`border: 0`); lo que la revisión vio como borde es el canto del relleno contra la superficie donde cae.

| Canto | Claro | Oscuro |
|---|---|---|
| Franja (`--color-grey-100`) contra el papel (`--color-paper`) | 1,09:1 | 1,41:1 |
| Franja contra la tarjeta (`--color-white`) | 1,14:1 | 1,14:1 |
| Franja de atención (dorado al 14 %) contra el papel | 1,23:1 | 1,77:1 |
| Franja de atención contra la tarjeta | 1,29:1 | 1,44:1 |

La observación es cierta: el canto casi no se ve, en los dos temas.

**Alternativas con tokens que ya existen** (relleno más marcado, sin contorno):

| Relleno | Canto contra el papel (claro / oscuro) | Texto secundario sobre el relleno (claro / oscuro) |
|---|---|---|
| `--color-grey-200` | 1,19 / 1,60 | 10,14 / 5,63 |
| `--color-grey-300` | 1,65 / 2,18 | 7,35 / 4,14 (bajo AA) |
| `--color-grey-500` | 5,11 / 5,97 | 2,37 / 1,51 (ilegible) |

Ningún relleno neutro llega a 3:1 de canto sin tumbar el texto. La única forma de dar 3:1 al borde es un contorno (`--color-grey-500`), y eso es justo lo que BD-037 le quita a lo que avisa: el contorno queda reservado para lo que se oprime.

**Decisión: se deja como está.** `app/portal/claridad.css` no se toca.

- El canto del relleno no es un control ni lleva información: es agrupación. WCAG 1.4.11 pide 3:1 a los componentes de interfaz y a los gráficos necesarios para entender el contenido, no al fondo de un bloque de texto.
- Lo que hace de aviso es el icono (forma distinta por tono) y el texto. Los dos se leen aunque el relleno no se distinguiera, y eso queda vigilado: el contrato ahora mide icono y texto también contra el papel y la tarjeta, en los tres temas (`fallasSinFranja`).

| Sobre la superficie, sin relleno | Claro (papel / tarjeta) | Oscuro (papel / tarjeta) | Mínimo |
|---|---|---|---|
| Texto (`--color-ink`) | 15,80 / 16,49 | 16,12 / 13,08 | 4,5 |
| Texto secundario (`--color-grey-700`) | 12,10 / 12,63 | 9,03 / 7,33 | 4,5 |
| Icono de info y de atención en claro (`--color-ink`) | 15,80 / 16,49 | 16,12 / 13,08 (info) | 3 |
| Icono de atención en oscuro (`--color-status-warning`) | no aplica | 7,89 / 6,41 | 3 |
| Icono de éxito (`--color-status-success`) | 4,15 / 4,33 | 5,75 / 4,67 | 3 |
| Icono de error (`--color-status-danger`) | 5,19 / 5,42 | 8,29 / 6,73 | 3 |

| Mutante | Qué hace | Resultado |
|---|---|---|
| M12 | La franja pasa a bloque de tinta con texto claro: se lee sobre su relleno, pero depende de él | `fallasSinFranja` lo reporta (1,00:1 sobre la tarjeta) |

Si Sam quiere que el bloque se note más en pantalla, la palanca que respeta BD-037 es el relleno (`--color-grey-200`, 1,19:1 en claro), no un contorno. Es una decisión de diseño aparte y no hace falta para cumplir AA.

## Aceptación

- `tokensSinDeclarar` ignora comentarios; M6 y M7 lo prueban en los dos sentidos.
- El contrato de avisos mide 36 pares en tres temas; M9, M10 y M11 rompen solo en el claro explícito.
- Icono y texto de la franja pasan AA contra el papel y la tarjeta en los tres temas; M12 lo prueba.
- Ningún mutante anterior deja de morir (M1 a M5 del tramo 3, M1 a M8 del 4e).
- `app/portal/claridad.css`, `app/globals.css`, componentes y textos: sin cambios.

## Límites

- jsdom no calcula estilos: se mide sobre tokens y reglas, no sobre píxeles.
- El contrato del tramo 3 sigue midiendo dos temas (claro sin atributo y oscuro); el encargo pedía el claro explícito en el de avisos.
- Otras comprobaciones del contrato del tramo 3 que buscan una regla por su selector (`regla`, `desde`) leen la hoja con comentarios. Un comentario tendría que empezar una línea con el selector exacto seguido de ` {` para confundirlas; no era parte de la observación.
