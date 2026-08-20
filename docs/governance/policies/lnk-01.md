# LNK-01 v1.0 — Enlaces y cambio de contexto

| Control | Valor |
|---|---|
| Código | LNK-01 |
| Estado | aprobada — adopción inicial en el sitio público |
| Aprobación | 2026-08-20 · Sam (founder) |
| Objetivo | Que consultar algo nunca le cueste al visitante el lugar donde estaba |
| Creado | 2026-08-20 |

## El problema que resuelve

Palabras del founder (2026-08-20): *"si no, pierdo dónde estaba y no sé cómo
regresarme"*. Salió del enlazado de jerga al glosario: se está leyendo una FAQ,
se toca "DDP" para ver qué significa, y la página que se estaba leyendo
desaparece.

## Contrato

1. **Un enlace de CONSULTA abre en pestaña nueva.** Es consulta cuando el
   destino resuelve una duda lateral y el visitante quiere seguir donde estaba:
   fichas del glosario, definiciones, documentos descargables, y todo destino
   fuera del dominio.
2. **Un enlace de NAVEGACIÓN abre en la misma pestaña.** Es navegación cuando el
   visitante decidió ir a otro lado: menú, pie de página, migas, CTAs, tarjetas
   de listado, paginación. Acá el botón Atrás del navegador es la respuesta
   correcta y esperada.
3. **Toda pestaña nueva se anuncia.** El nombre accesible del enlace dice que
   abre en una pestaña nueva. Si el texto visible no puede decirlo (una sigla de
   tres letras), va en el `aria-label`.
4. **Toda pestaña nueva lleva `rel="noopener"`.** Sin él, el destino puede
   manipular la página de origen por `window.opener`.
5. **En superficies de conversión, la duda se resuelve sin navegar cuando se
   pueda.** Un panel in-situ (patrón `CbmAyuda`) es mejor que cualquier enlace:
   no hay pestaña que administrar ni formulario que perder. El enlace al detalle
   completo queda para el final, y ése sí abre aparte.

## Por qué NO es "todos los enlaces en pestaña nueva"

La regla se pidió primero en su forma absoluta. Se acotó a *consulta* por dos
razones medibles, y conviene dejarlas escritas para no re-litigarlas:

- **Acumulación.** Con todos los enlaces abriendo pestaña, recorrer cinco
  páginas del sitio deja cinco pestañas abiertas. El problema que se quería
  evitar —perder el lugar— se cambia por otro peor: no encontrar nada entre
  diez pestañas idénticas.
- **Accesibilidad.** Abrir ventanas sin aviso es la falla que WCAG cubre en
  G200/G201. Desorienta a quien usa lector de pantalla, y en móvil el cambio de
  pestaña es casi invisible. Por eso el punto 3 no es opcional: si se abre
  aparte, se avisa.

## Evidencia

| Qué | Dónde |
|---|---|
| Implementación de referencia | [`components/TerminoGlosario.tsx`](../../../components/TerminoGlosario.tsx) |
| Contratos, validados por mutación | [`components/TerminoGlosario.test.tsx`](../../../components/TerminoGlosario.test.tsx) |
| El patrón in-situ del punto 5 | [`components/CbmAyuda.tsx`](../../../components/CbmAyuda.tsx) |

## Alcance actual

Adoptada en el enlazado de jerga del sitio público (glosario). **No barrida
todavía** sobre el resto de los enlaces de consulta: documentos descargables y
destinos externos siguen caso por caso. La adopción completa entra por su
propio SDD.
