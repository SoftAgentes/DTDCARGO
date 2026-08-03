# 04 · La web pública — qué enlace mandar
### DTD Cargo · documento para el equipo / CRM

> Para qué sirve: que mandes **el enlace correcto** en cada situación, sin buscarlo ni
> inventarlo. Todo cuelga de **dtdcargo.com**.

---

## 🎯 La chuleta — qué mandar según lo que pregunten

| Si el cliente… | Mándale | Enlace |
|---|---|---|
| Quiere saber **cuánto cuesta** | Calculadora de tarifas | `dtdcargo.com/tarifas` |
| Pregunta por **contenedor completo** | Calculadora FCL | `dtdcargo.com/fcl` |
| **Quiere empezar** | Registro (gratis, da el Shipping Mark) | `dtdcargo.com/registro` |
| Pregunta **dónde está su carga** | Portal | `dtdcargo.com/portal` |
| Pregunta **qué es el Shipping Mark** | Explicador | `dtdcargo.com/shipping-mark` |
| Tiene **dudas generales** | Preguntas frecuentes | `dtdcargo.com/faq` |
| Pregunta **qué hacen ustedes** | Servicios | `dtdcargo.com/servicios` |
| Pregunta **qué es el puerta a puerta** | Página del servicio | `dtdcargo.com/puerta-a-puerta` |
| No entiende un **término** (FOB, EXW, CIF…) | Glosario | `dtdcargo.com/glosario` |
| Quiere saber **quiénes somos** | Nosotros | `dtdcargo.com/nosotros` |
| Es **nuevo importando** | Guía completa | `dtdcargo.com/importar-de-china` |
| Quiere **hablar con alguien** | Contacto | `dtdcargo.com/contacto` |
| Pregunta **cómo empacar / llenar** | Guía de llenado | `dtdcargo.com/llenado` |
| Pregunta por la **pre-alerta** | Explicador | `dtdcargo.com/pre-alertas` |

---

## Enlaces viejos — tranquilo, siguen funcionando

Si ves un enlace viejo en un chat o en un anuncio, **no está roto**: redirige solo.

| Enlace viejo | Aterriza en |
|---|---|
| `/calculadora` · `/estimacion` · `/cotizar` | `/tarifas` |
| `/calculadora-fcl` · `/cotizador-flete` | `/fcl` |
| `/markbox` | `/shipping-mark` |
| `/track` | `/portal/login` |
| `/mi-cuenta` | `/portal` |
| **doortudoor.com** (dominio viejo, completo) | **dtdcargo.com** |

> ✅ **Manda siempre el nuevo.** Pero si el cliente llegó por uno viejo, todo bien.

---

## Las páginas, una por una

### Para vender

- **`/tarifas`** — la calculadora principal. El cliente mete las medidas de sus cajas y sale un
  estimado al instante. **Es la herramienta #1 de conversión.**
- **`/fcl`** — calculadora de contenedor completo.
- **`/calculadora-terrestre`** — transporte nacional dentro de Venezuela.
- **`/servicios`** — el catálogo completo.
- **`/puerta-a-puerta`** — la página del servicio estrella.
- **`/registro`** — alta de cliente. **Es real:** crea el cliente, le asigna el Shipping Mark
  y nos avisa. No es un formulario de mentira.

### Para explicar

- **`/faq`** — las preguntas frecuentes. Incluye la guía de cómo llenar Alibaba, 1688 y Taobao
  campo por campo.
- **`/glosario`** — términos de comercio exterior.
- **`/importar-de-china`** — la guía pilar para el que empieza de cero.
- **`/shipping-mark`** — qué es y para qué sirve.
- **`/pre-alertas`** — cómo y cuándo hacerla.
- **`/llenado`** — cómo empacar.

### Institucional

- **`/nosotros`** — quiénes somos.
- **`/contacto`** — formulario real (llega al equipo por correo).
- **`/noticias`** — el centro editorial. Nombre público: **Actualidad**.
- **`/academia`** — formación.
- **`/enlaces`** — el "link in bio" de Instagram: agrupa todos los enlaces en una sola URL con
  medición de origen.
- **`/brochure`** — el folleto.

### Legales

- **`/terminos`** · **`/privacidad`** · **`/cookies`**

### Privadas — no se mandan a un cliente cualquiera

- **`/portal`** — del cliente (necesita su acceso).
- **`/studio`** — el ERP interno del equipo.
- **`/marca`** — el centro de marca. **Lleva código de acceso.** Es el enlace que se le manda a
  diseño externo, no a clientes.
- **`/m`** — la app móvil de los operarios de bodega.

---

## Reglas de la web que no se rompen

1. **Nunca mandes un cliente a `doortudoor.com`.** Ese dominio existe solo para redirigir. El
   dominio vivo es **dtdcargo.com**.
2. **`/marca` no se comparte con clientes** — es material de marca, va a diseño y al equipo.
3. **El precio de la calculadora es un estimado**, siempre. Ver documento `01`.
4. **Si una página no está en esta lista, verifica antes de mandarla.** Un enlace roto en una
   conversación de venta cuesta.

---

*DTD Cargo · uso interno. Rutas verificadas contra `app/` y los redirects de `next.config.ts`.
Si mandas un enlace y da 404, avisa — se corrige acá.*
