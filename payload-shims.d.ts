/**
 * Type shims para artefactos auto-generados de Payload CMS.
 * Estos archivos no tienen `.d.ts` companion, así que declaramos sus tipos acá
 * para que TypeScript no tire TS7016 al importarlos desde el admin layout/pages.
 *
 * El wildcard `*importMap.js` matchea cualquier ruta que termine en importMap.js
 * (Payload puede regenerarlo en varias ubicaciones según la versión).
 */

declare module "*importMap.js" {
  /**
   * Map de componentes/views custom del admin de Payload.
   * Payload lo regenera al ejecutar `payload generate:importmap`.
   * Tipo intencionalmente laxo (`Record<string, unknown>`) — solo lo consume
   * `<RootLayout>` y `handleServerFunctions` internamente.
   */
  export const importMap: Record<string, unknown>;
}
