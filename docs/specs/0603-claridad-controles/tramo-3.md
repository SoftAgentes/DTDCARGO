# SDD-0603 · Tramo 3 · Portal del cliente

Parte de [SDD-0603](spec.md) y de BD-037. Aplica la regla al portal del cliente: lo que se oprime lleva relleno o contorno de tinta y sombra; lo que avisa es una franja plana; lo que solo se lee es texto, sin cajón. La web pública no cambia: toda la hoja vive bajo `.portal-sys`.

Rama `claude/0603-t3-portal`, desde `origin/main` `11f90a32e`. Prototipo de referencia, solo leído: `codex/rediseno-studio-prueba`, `app/portal/claridad.css`. De ese prototipo no se adoptan los `!important`, los selectores sobre el estilo en línea ni los cambios de tokens del tema oscuro (`--color-grey-500`, tinta de la barra lateral).

## Allowlist

- `app/portal/claridad.css` (nuevo)
- `app/portal/layout.tsx` (solo importa `claridad.css`)
- `app/portal/_components/PortalFormField.tsx`
- `app/portal/_components/PortalHubTabs.tsx`
- `app/portal/__tests__/claridad-portal-contract.test.ts` (nuevo)
- `docs/specs/0603-claridad-controles/tramo-3.md` (este documento)
- `.agents/handoffs/0603-t3-portal.md`

Sin cambios en `app/globals.css`, páginas del portal, rutas, datos, acciones de servidor ni `/privacidad`. Sin textos visibles nuevos. Sin migraciones ni dependencias.

## Qué cambia

| Pieza | Antes | Después |
|---|---|---|
| `.btn-ghost` | Transparente, borde `--color-grey-300`: 1,72:1 (claro) y 1,77:1 (oscuro) contra la tarjeta | Superficie `--color-white`, contorno de 1,5 px en `--color-ink`: 16,49:1 y 13,08:1; sombra de nivel 1 que sube al pasar el cursor; verbo en 700 |
| Campos de `main` | Muchos sin borde (`border-0` sobre `bg-grey-100`) o con `--color-grey-200` (1,25:1) | Contorno de 1 px en `--color-grey-500`: 5,33:1 y 4,85:1 contra la tarjeta; 4,68:1 y 4,24:1 contra su relleno gris |
| Campo de archivo (`FileField`) | Borde `--color-grey-200`; el anillo de foco nunca se veía porque el input iba después del label y `peer-*` solo mira hermanos anteriores | Contorno `--color-grey-500`; el input va antes del label y el foco de teclado se ve |
| Sub-pestañas del hub (`PortalHubTabs`) | Subrayado vino bajo la activa, el resto en gris; scroll horizontal escondido | Control con partes: la activa rellena de `--color-ink` con texto `--color-white` (16,49:1 y 13,08:1), 40 px de alto, envuelven en pantallas angostas |
| Filtros (`button[aria-pressed]` en `main`, salvo `.btn`) | Elegido en blanco con sombra y conteo vino | Elegido relleno de tinta, conteo heredado del texto |
| Estados (`.badge-status`) | Píldora con fondo y borde | Texto con icono, sin fondo, borde ni relleno |
| Avisos con cajón (`role="alert"` o `role="status"` con clase `border`) | Cajón con borde y a veces sombra | Franja plana en `--color-grey-100`, sin contorno ni sombra |
| Enlaces de texto en `main` | Solo color | Subrayados (1 px, separación de 3 px) |

**Semántica de selección.** Las sub-pestañas son enlaces de navegación, no un `tablist`: la activa se anuncia con `aria-current="page"`, que es el atributo correcto para un enlace; `aria-selected` solo vale en `role="tab"`/`option`. Los filtros ya usaban `aria-pressed`. En los dos casos la seleccionada se distingue por relleno entero y peso, no solo por color.

**Sombras.** El portal no tiene `--shadow-*` en `.portal-sys` (viven en otras superficies). La hoja declara dos tokens de forma, `--portal-ctl-shadow-xs` y `--portal-ctl-shadow-md`, que mezclan `--portal-nav-solid` (navy en los dos temas) con transparente. Ningún color nuevo.

## Aceptación

- Todo selector de `claridad.css` empieza por `.portal-sys`; sin `!important`, sin `[style…]`, sin colores literales; cada `var()` existe en `globals.css` o en la propia hoja.
- Contornos de controles ≥3:1 y texto ≥4,5:1, en claro y en oscuro, medidos por `claridad-portal-contract.test.ts` sobre las reglas reales (piso: 14 pares por tema).
- El secundario reposa en sombra de nivel 1, sube al pasar el cursor y baja al oprimir.
- Estado sin fondo, borde, relleno ni radio; aviso con cajón sin contorno ni sombra; enlaces de texto subrayados.
- Nada oprimible nuevo bajo 32 px (sub-pestaña: 40 px; los filtros ya miden 48 px).
- Foco visible en sub-pestañas y en el campo de archivo.
- Cinco mutantes rompen el contrato: contorno del secundario en `--color-grey-300`, contorno de campo en `--color-grey-200`, texto vino en el filtro elegido, estado con fondo, selector fuera de `.portal-sys` o color literal.

## Gate VIS-01

| Punto | Clasificación |
|---|---|
| Presupuesto de énfasis | Cumple: el primario vino no cambia y sigue siendo el único relleno vino. |
| Acción dominante | Cumple: no cambia la cantidad de primarios. |
| Semántica de color | **Excepción aprobada por Sam** (BD-037): selección en tinta, no en vino. |
| Contraste | Cumple: medido y vigilado por contrato en los dos temas. |
| Tokens | Cumple: ningún color nuevo; dos tokens de forma de sombra. |
| Estados sin color | Cumple: el estado conserva texto e icono; la selección cambia relleno y peso. |
| Light/dark | Cumple en contrato. Recorrido visual en los dos temas pendiente en imagen de prueba, como en los tramos 1 y 2. |
| Móvil | Mejora: las sub-pestañas envuelven en vez de esconderse con scroll. Sin medir pantalla por pantalla. |
| Movimiento reducido | Cumple: solo cambian color y sombra; sin `transform` nuevo. |

## Límites y pendientes

- **Avisos con estilo en línea.** Los que pintan su borde completo en línea (página de error del portal) o su fondo de estado en línea conservan ese fondo o borde: la hoja no mira el estilo en línea. Los resuelve el tramo 4 (componente único de avisos).
- **`PrealertaStatusBadge`** pinta su píldora en línea: sigue como píldora. Pasarlo a texto con icono pide tocar ese componente, fuera de esta allowlist.
- **Etiquetas de campo** (`FieldLabel`, mayúsculas en `--color-grey-500`, 5,33:1) no cambian: ya cumplen AA; el prototipo las cambiaba, pero no son parte de la regla.
- **Primario en oscuro.** El vino del portal oscuro (`--color-wine` #c24450) mide 3,00:1 contra la tarjeta (#16264a), justo en el mínimo de un control; el borde propio de la enmienda de elevación del Studio no se trae aquí. Queda para una decisión aparte.
- **Selectores amplios.** Campos, filtros, enlaces y avisos se eligen por elemento y atributo dentro de `main`. Un caso que no encaje (un enlace que es tarjeta sin clase `border`/`rounded`/`bg-`) se ve en la imagen de prueba antes de fusionar.
