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

## SEO — si se vuelve página propia (ej. `/cotizar/condiciones` o dentro de T&C)
- **Title:** `Condiciones de cotización | DTD Cargo`
- **Meta:** `Cómo funciona el precio estimado de tu importación China–Venezuela: cupo, fecha de salida, temporada y carga especial. Pide tu cotización en firme con DTD Cargo.`

## Origen
Adaptado del disclaimer de mercado del proveedor de rates (volatilidad, recargos de temporada,
tiempos de la naviera, sobrepeso, carga no estándar) → reescrito a la voz de DTD, **evergreen**
(sin eventos fechados) y **white-label**.
