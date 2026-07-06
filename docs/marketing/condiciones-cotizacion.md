# Condiciones de cotización — copy para web + correo

> **Qué es:** la "letra chica" del precio estimado que damos online o por correo. Deja claro
> que la cotización es **referencial** (no en firme) y de qué depende el precio final. Acompaña
> al precio del cotizador/calculadora y al correo de cotización.
>
> **Estado (2026-06-17):** copy listo (pulido por `/redactor`). **Pendiente: cablearlo** cuando
> se defina el cotizador online (hoy el sistema aún no existe). Calza con la integración de rates
> (los precios serán **indicativos** — ver memoria `project_searates_api_integration`) y con el
> asterisco de **"Pagas al llegar\*"** (ver memoria `feedback_terminologia_ddp`).

## Reglas de marca aplicadas
- Español venezolano neutro, **tuteo**, cero voseo.
- **NUNCA la palabra "responsabilidad"** (dispara seguros/liability) → "lo define la naviera". Ver memoria `feedback_evitar_palabra_responsabilidad`.
- **White-label:** no nombrar al proveedor de rates ni a las navieras.
- Lenguaje simple, sin jerga (nada de GRI/FAK/BL/ETD al cliente).

## A) Web — bajo el precio en la calculadora (~285 caracteres)
```
💡 Precio estimado, para que te orientes. El monto final se confirma al reservar y
puede variar según el cupo, la fecha de salida, la temporada y tu tipo de carga.
Los tiempos de tránsito los define la naviera. ¿Lo quieres en firme? Escríbenos y un
asesor te lo cierra.
```

## B) Correo de cotización / página de "Condiciones"
```
Sobre tu cotización

Este es un precio estimado para orientarte; todavía no es una cotización en firme.
El monto final se confirma al reservar y puede ajustarse por:

• Cupo y fecha de salida. La tarifa aplica para la fecha de embarque estimada. El
  espacio puede ser limitado y el mercado cambia rápido: mientras antes reserves, mejor.

• Temporada. En temporada alta pueden sumarse recargos que no están incluidos hasta
  que la naviera los confirma.

• Tiempos de tránsito. Son estimados; los define la naviera según su itinerario y no
  son una fecha garantizada.

• Peso y tipo de carga. Las cargas muy pesadas pueden tener recargo. La mercancía
  especial —peligrosa, perecedera, líquida, con baterías o sobredimensionada— se
  cotiza aparte.

• Otros cargos. Pagos fuera de plazo, cambios de documentos, almacenaje o demoras se
  cobran según las tarifas del operador.

Para una cotización en firme y a la medida de tu carga, escríbenos por WhatsApp
+58 412 166 8021 o a info@dtdcargo.com. Te confirmamos precio, cupo y fecha.

Con DTD, pagas al llegar.*
```

## C) FAQ del cliente — peso y tamaño (SIN números)

> **Regla:** cero cifras. Así, si cambiamos los topes internos, **no hay que tocar la FAQ** —
> y no le regalamos números a la competencia. Los límites reales viven en la calculadora y en
> el manual de vendedores (interno), nunca acá.

**¿El precio incluye el peso o solo el volumen?**
Cobramos por volumen (metros cúbicos) e incluimos un **margen de peso generoso por cada m³**.
La gran mayoría de las cargas entra sin ningún recargo.

**¿Hay un límite de peso?**
Cada envío trae incluido un margen de peso amplio. Solo si tu carga es **excepcionalmente
densa** (mucho peso en poco volumen), un asesor te la cotiza a medida para darte la mejor opción.

**¿Y si mi carga es muy pesada o muy grande?**
La calculadora te da un estimado al instante. Si tu envío supera lo habitual en peso o tamaño,
te conecta con un asesor —a veces te conviene más un contenedor completo (FCL).

**¿El estimado de la calculadora es el precio final?**
Es un **estimado**. La tarifa final la confirma un asesor con el **peso y el volumen reales**
de tu carga.

**¿Por qué me pueden ajustar la tarifa al llegar?**
Porque el estimado se basa en lo que declaras. Al recibir tu carga la pesamos y medimos; si
coincide, no cambia nada. Así el precio es justo para todos.

## SEO — si se vuelve página propia (ej. `/cotizar/condiciones` o dentro de T&C)
- **Title:** `Condiciones de cotización | DTD Cargo`
- **Meta:** `Cómo funciona el precio estimado de tu importación China–Venezuela: cupo, fecha de salida, temporada y carga especial. Pide tu cotización en firme con DTD Cargo.`

## Origen
Adaptado del disclaimer de mercado del proveedor de rates (volatilidad, recargos de temporada,
tiempos de la naviera, sobrepeso, carga no estándar) → reescrito a la voz de DTD, **evergreen**
(sin eventos fechados) y **white-label**.
