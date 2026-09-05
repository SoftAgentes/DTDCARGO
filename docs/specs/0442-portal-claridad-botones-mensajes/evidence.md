# Evidencia · SDD-0442

## Corte y alcance real

2026-09-05, base b8294664. Cinco componentes de presentación; ningún cambio
de persistencia, permisos, documentos del proveedor, reglas de subida o API.
La autorización corresponde a rama y PR. Entrega en borrador por validación
integrada pendiente; no declarar completado el portal global.

## Antes / después

| Hallazgo confirmado en base | Resultado del slice |
|---|---|
| Documentos 0/3 era botón y contador | Contador separado y Ver/Ocultar documentos con chevron, aria-expanded y aria-controls estable |
| Pendientes mostraban DownloadIcon | Pendiente textual, icono documental, cero descarga sin destino |
| Factura/foto no tienen URL en la prop de presencia | Recibido informa presencia; no se inventa enlace |
| Gestión documental era enlace pequeño | Variante btn-primary; mismo destino /compras/[code]/etiquetas |
| Prealerta usaba + como estado | DocIcon decorativo, sin sugerir creación |
| Filtros de envíos sin estado accesible | aria-pressed y subrayado del seleccionado; target de 48 px |
| Ayuda de proveedores precedía lista | Lista y alta antes de ayuda plegable nativa |
| Re-comprar y Cambiar ambiguos | Nueva compra con este proveedor y Cambiar proveedor, mismos destinos/handlers |
| Tarjeta sin URL se atenuaba completa | Enlace no disponible sin reducir opacidad de todo el texto |

[Antes, componente de b8294664](assets/before-desktop-light.png) ·
[Después claro](assets/desktop-light.png) · [Después oscuro](assets/desktop-dark.png) ·
[Móvil claro](assets/mobile-light.png) · [Móvil oscuro](assets/mobile-dark.png).
Son componentes reales con datos ficticios, CSS de producción y adaptadores
locales para next/link, next/image y acciones bloqueadas. No representan una
sesión autenticada ni certifican descargas, enlaces firmados o escrituras.

## Verificaciones

- 18/18 pruebas iniciales: desplegable con Enter/Space, foco, contador separado,
  pendientes, destino de packing, filtros y estado vacío; incluye regresiones
  existentes de NewPurchaseWizard.
- 384/384 pruebas, 39 archivos de app/portal y lib/portal.
- ESLint: salida 0 sobre los ocho archivos de código y pruebas. El intento
  que incluía docs/qa se detuvo por falta de progreso; docs/** está excluido
  por la configuración existente. No se modificó esa configuración.
- Tras el último énfasis de Nueva compra: 4/4 pruebas de los dos consumidores
  y repetición de las 12 combinaciones de navegador, sin desbordamiento.
- pnpm typecheck: salida 0.
- pnpm build: salida 0; 158 páginas estáticas generadas. Avisos por ausencia de
  NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en este worktree.
  Compilar no valida contenido remoto. No se copiaron credenciales.
- governance:check, components:check, docs:check, sdd:check: salida 0.
- check-rsc-boundary: 1586 módulos, cero cruces server→client de valores.
- git diff --check: sin errores.
- Gate proporcional: no se ejecutó pnpm verify completo, SQL, migraciones,
  Edge Functions ni E2E autenticados; no hay cambios en esos contratos.

## Navegador y contraste

Playwright + Edge local en 1440×1000 y 390×844, claro/oscuro. Mis envíos,
Documentos y Proveedores sin desbordamiento horizontal en las 12 combinaciones.
Ver/Ocultar documentos abre y cierra con teclado; foco solid y target 48 px.
Ayuda de proveedores abre con Enter. Sin errores JavaScript en el hub.
agent-browser no pudo conectar al daemon (Windows, os error 10060); se usó
Playwright como alternativa, sin alterar los controles del repositorio.

| Par medido de tokens reales | Claro | Oscuro |
|---|---:|---:|
| Texto sobre botón de gestión | 10.58:1 | 4.96:1 |
| Texto principal sobre card | 16.49:1 | 13.08:1 |
| Texto secundario sobre paper | 12.10:1 | 9.03:1 |

Archivo cargó en ambos tamaños. JetBrains Mono se verificó en escritorio;
la comprobación móvil fue inconsistente (false), por lo que las capturas
móviles no certifican la fuente mono final. No se fijaron anchos de columnas.

## UI-CHECK · revisión liviana antes del commit

- cumplimiento: botones/enlaces nativos; contador y pendientes informativos;
  tokens y variantes existentes, sin nuevos colores, fuentes ni componentes.
- cumplimiento: foco y expansión, selección visible sin depender solo del color,
  jerarquía del panel, recuperación del filtro vacío, destinos conservados.
- no aplica: loading de documentos locales (props síncronas); persistencia,
  auditoría de mutaciones, esquema y privacidad (no se capturan ni mueven datos).
- excepción: ninguna nueva excepción de marca.
- no conformidad de verificación: falta navegador autenticado de prueba,
  lector de pantalla y zoom 200%; fuente mono móvil por revalidar.

Veredicto: implementación revisable; PR en borrador hasta completar lo pendiente.
La rúbrica ui-check contiene referencias históricas de fuentes/Shipping Mark:
se aplicaron BRAND.md y AGENTS vigentes, sin propagar esas instrucciones antiguas.

## Dependencias y pendientes para coordinación

1. Probar con cuenta y documentos ficticios en backend de prueba: enlaces,
   descarga real, errores/cargas, registro y cambio de proveedor.
2. Repetir contraste tras integrar colores (SDD-0441). No se mezcló su trabajo.
3. Revalidar zoom, lector y fuentes móviles. Los componentes auxiliares de
   dirección/Copiar y captura de WeChat conservaron su funcionamiento y etiquetas;
   no se rediseñó el flujo de proveedores ni sus documentos.
4. Nueva compra admite énfasis primario y 48 px en Mis envíos y Proveedores;
   los otros consumidores conservan su default de 40 px. Registrar compra
   conserva su etiqueta y acción. Target touch global fuera de esas pantallas
   queda como revisión posterior del componente compartido.
5. El índice SDD compartido queda a la coordinación según el runbook multiventana.

## Reproducir sin producción

Desde este worktree, ejecutar `node docs/specs/0442-portal-claridad-botones-mensajes/qa/serve.mjs`.
En otra terminal ejecutar `node docs/specs/0442-portal-claridad-botones-mensajes/qa/check.mjs`.
Requiere Edge instalado y fuentes Google accesibles. Nunca ejecutar los formularios
para simular éxito: las acciones de la fixture fallan expresamente.
Para el antes, arrancar serve.mjs con QA_BASELINE=1 y QA_PORT=4313; lee el
componente desde git show b8294664, sin escribir el checkout.
