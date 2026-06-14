# Cambio para Norte · Hero web `www.dtdcargo.com` — Ciclo del Cliente (reemplaza el "360°")

Este paquete contiene **solo** el cambio del hero web, listo para que Claude Code lo aplique en
producción (Norte). Nada más.

## Qué hay acá

| Archivo | Para qué |
|---|---|
| `HANDOFF-NORTE-ciclo-cliente-2026-06-13.md` | **Las instrucciones completas** (qué quitar, qué poner, tokens, geometría, layout, checklist). Empezá por acá. |
| `Hero Web · Ciclo DTD.html` | **Referencia viva** del diseño aprobado. Abrilo en el navegador para ver el resultado exacto a replicar (HTML+CSS listos para portar al componente del repo). |
| `erp/tokens.css` | Tokens de marca que usa el hero (colores/fuentes). En Norte ya existen; usá los del repo. Incluido solo para que la referencia renderice sola. |

## El cambio, en una línea

Quitar el badge **"360° PUERTA A PUERTA"** del hero y reemplazarlo por el **Ciclo del Cliente**:
cinta en bucle, **fondo blanco**, contenedor viajando por la cinta, 4 pasos
**Cotiza → Compra *(prealerta)* → Recibimos → Entregamos** y centro
**"Con Confianza / de China a tu puerta"**. **Sin** contenedor de fondo (decisión final).

## Cómo usarlo (Claude Code)

1. Leé el `.md` completo — tiene la spec exacta (paleta, geometría del bucle, animaciones, layout responsivo, accesibilidad y checklist de aceptación).
2. Tomá el HTML/CSS de `Hero Web · Ciclo DTD.html` como fuente fiel y portalo al componente del repo (sin Tailwind/CSS-in-JS; estilos con tokens, igual que el resto).
3. Usá los tokens y assets que ya existen en Norte (no dupliques `tokens.css`).
4. Verificá contra el checklist del `.md` y registrá en la bitácora: "Hero rediseñado · Ciclo del Cliente reemplaza 360° · v3.7".

> Fuente de verdad de la marca = el proyecto de diseño. Ante conflicto con algo viejo de Norte,
> gana esto.
