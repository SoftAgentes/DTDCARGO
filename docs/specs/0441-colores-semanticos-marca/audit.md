# SDD-0441 · Evidencia y revisión de marca

Fecha: 2026-09-05. Base revisada: `origin/main` `b8294664`.
Implementación aislada: rama `codex/brand-semantic-colors`.

## Matriz de significado

| Estado | Significado | Tratamiento | Ejemplo |
| --- | --- | --- | --- |
| Información | Paso operativo normal | Tinta navy/neutra, icono informativo | En tránsito, en aduana, en camino |
| Pendiente | Aún no completado; sin evidencia de incumplimiento | Tinta neutra, reloj o información | Pago parcial, invitación pendiente |
| Atención | Condición que exige revisar o consultar | Icono/borde dorado y explicación neutra | Peso que requiere asesor, mantenimiento |
| Éxito | Resultado confirmado | Check verde y texto neutro | Entregado, recibido, pago confirmado |
| Error | Fallo real | Icono/borde rojo y cuerpo neutro | No se pudo guardar, factura vencida |
| Marca | Identidad o acción | Vino | CTA de marca; nunca aviso genérico |

## Superficies y alcance

| Superficie | Evidencia | Clasificación |
| --- | --- | --- |
| Web | Calculadora compartida DDP/LCL, terrestre, DecimalInput, destino y embed: recargos y límites mantienen fórmulas y derivación; aviso con role=status y aria-describedby | cumplimiento |
| Portal | Badges de envío, factura y prealerta con iconos; perfil pendiente neutro; mapeo compartido de envíos | cumplimiento en componentes; pantallas autenticadas completas no verificadas |
| Studio | Badge/ErrorAlert/Toast, tracking, errores de tarifas y funciones de tono de dominios del allowlist | cumplimiento en componentes y contratos de presentación |
| Móvil | Reutiliza tonos Studio; recibo conserva importes y signo de deducciones; avisos push/KPI sin falsa alarma | cumplimiento por inspección del diff; recorrido autenticado no verificado |
| Back | Error de login mantiene borde de error y usa cuerpo neutro sobre fondo navy | cumplimiento por inspección; no se provocó un fallo real de autenticación |
| Norte | Política, decisiones, changelog, handoff, tokens, Badge y datos de ejemplo | cumplimiento local |
| Book distribuido | Runtime apunta a v5.0; copia local Norte v4.6. No hay fuente v5.0 completa verificada para regenerarlo | excepción: publicación del book y sistema navegable queda pendiente del coordinador/diseño |
| Base de datos y permisos | Sin cambios de contratos, validaciones, precios ni transiciones | no aplica |
| Metodología/arnés | Tarea separada solicitada por Sam | no aplica |

FCL ya presenta falta de estimado y fallo de cálculo con explicación e icono neutros;
no se alteraron sus consultas ni mensajes. En terrestre se neutraliza la nota CBM
y se asocian los avisos de peso/volumen al campo con icono dorado.

Los colores de severidad, vencimientos, fallos reales y categorías no se reemplazaron
por una búsqueda global. `Alerta` conserva su nombre y semántica de excepción.
No se afirma una auditoría visual de las 56 pantallas completas ni de datos reales.
Los mapas de tono modificados se enumeran exactamente en allowlist.txt.

## Coordinación

Se comunicó el alcance visual a la tarea de claridad del Portal. No se tocaron
PortalAlertasHub, DocumentsClient, SuppliersClient ni SupplierPicker.
Prealertas: sólo badge y tonos en_camino/consolidada; sin compras, proveedores,
permisos, subida de archivos ni packing list. Sin dependencia del PR de metodología.
La reserva SDD-0441 está en el commit `9792422f`.

## Evidencia visual local

- [Antes/después de calculadora](assets/calculator-before-after.png): comparación del componente original en b8294664 con SDD-0441, CBM 1 / peso 30000. Comparte estilos locales; no es una captura histórica de producción.
- [Calculadora final, móvil oscuro](assets/calculator-dark-mobile.png): ruta real /tarifas/embed?theme=dark, datos ficticios.
- [Estados claro escritorio](assets/light-desktop.png) · [oscuro escritorio](assets/dark-desktop.png).
- [Estados claro móvil](assets/light-mobile.png) · [oscuro móvil](assets/dark-mobile.png).

Los estados se montaron en una ruta temporal con los componentes reales y datos
ficticios. Las rutas temporales, copia del componente original y configuración
local de Playwright fueron retiradas antes del commit. Los controles de desarrollo
visibles en las capturas son del servidor local, no forman parte del producto.
No se enviaron mensajes ni se ejecutaron acciones reales para generar ejemplos.

## Contraste medido

Medición de estilos calculados en Chrome, con composición de fondos sólidos.
[Procedimiento JS](assets/measure-contrast.txt). No se extrapola este cálculo a
fondos con gradientes ni a todas las pantallas.

| Componente/estado | Texto claro | Icono claro | Texto oscuro | Icono oscuro |
| --- | ---: | ---: | ---: | ---: |
| Studio información/pendiente | 13.90 | 13.90 | 13.15 | 13.15 |
| Studio atención | 16.49 | 3.14 | 13.08 | 7.15 |
| Studio éxito | 13.90 | 3.65 | 13.15 | 7.75 |
| Studio error | 13.90 | 5.55 | 13.15 | 6.77 |
| Portal información/parcial | 14.11 | 14.11 | 14.15 | 14.15 |
| Portal entregado | 14.11 | 3.71 | 14.15 | 5.05 |
| Portal alerta | 14.11 | 4.64 | 14.15 | 7.28 |

Se corrigieron los hallazgos iniciales: icono dorado de Studio sobre tinte neutro
(2.65:1) ahora usa superficie sólida; texto neutro atenuado (4.49:1) ahora usa tinta
principal. Calculadora mantiene blanco fijo sobre navy, incluso al invertir tema;
el CTA de WhatsApp usa navy fijo sobre verde. Los iconos son redundantes al texto.
En móvil se midió viewport=390 y scrollWidth=390; placeholders resuelven al token
blanco al 75%, sin heredar la tinta oscura del tema.

## UI-CHECK (lectura del diff y navegador)

Rúbrica: .claude/commands/ui-check.md, BRAND.md y Norte.
- Marca: tokens existentes y aliases semánticos; identidad, logo y fuentes intactos.
- Componentes: icono SVG compartido, reutilización de Badge y errores canónicos.
- Jerarquía: cuerpo neutro y señal localizada; sin nuevas columnas de ancho fijo.
- Estados: se conservan focus/hover/disabled; peso pendiente no se marca inválido.
- Accesibilidad: mensaje asociado al campo, icono más texto, muestras AA medidas;
  móvil y escritorio, claro/oscuro verificados en calculadora y galería de estados.
- Copy: tuteo, recargo explicado sin falsa alarma; etapas de negocio intactas.
Veredicto: apto para revisión del PR. Límite de cobertura: pantallas privadas completas
requieren validación del coordinador con una sesión de prueba.

## Verificación

- 334 pruebas unitarias dirigidas, 14 archivos: pasaron (incluye calculadora,
  tonos compartidos y dominios afectados).
- Playwright sobre Chrome del sistema: 8 casos pasaron, escritorio/móvil y
  claro/oscuro; recargo, límite, asociación accesible, corrección, texto y CTA; incluye la calculadora terrestre.
- Typecheck y lint dirigidos: pasaron durante implementación; revisión final abajo.
- Lint final de los archivos de implementación: 0 errores; el único aviso informa
  que e2e está excluido por la configuración existente.
- 70 tests adicionales de transporte terrestre, conversaciones y facturas: pasaron.
- Gobernanza: 28 políticas aprobadas, cápsula vigente. Componentes: 5 fuentes válidas.
- Índice SDD regenerado; numeración sin colisión nueva.
- Primera corrida canónica interrumpida por contención con el número automático de
  trabajadores: aparecieron dos expectativas del color antiguo (conversación
  abierta y factura parcial), corregidas conforme a BRAND, y un timeout en registro.
  La repetición usa `VITEST_MAX_WORKERS=2`, opción nativa de Vitest; no se redujo
  cobertura ni se cambiaron tiempos máximos, exclusiones o controles.
- Corrida completa con dos trabajadores: 503 archivos, 6188 tests; 6187 pasaron
  y uno aún esperaba warning para consolidando. Esa expectativa se actualizó a info
  y los 6 tests de ese archivo pasaron. El gate está ejecutando su repetición
  automática con la corrección; resultado final pendiente en este borrador.

## Entrega y límites

PR a main sin integración ni despliegue. Worktree y rama se conservan.
La inspección remota de main devolvió Branch not protected y rulesets vacíos;
el aislamiento local no impide un push remoto y no se cambiaron protecciones.
El checkout principal conserva sus modificaciones anteriores. No se copiaron
credenciales ni se leyeron filas de negocio. La ruta pública local usa las tarifas
fallback del código al no tener configuración Supabase en este worktree.
