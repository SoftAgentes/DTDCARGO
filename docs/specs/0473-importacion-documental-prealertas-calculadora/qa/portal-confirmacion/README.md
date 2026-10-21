# Recorrido local de cliente a proveedor · SDD-0473

Demo con identidades y documentos exclusivamente ficticios. No lee `.env`, no usa Supabase remoto
ni credenciales, no llama a Anthropic. Solo escucha en `127.0.0.1`.

Desde este worktree:

```powershell
pnpm install --frozen-lockfile
pnpm exec tsx docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/vite.config.ts
```

Abre `http://127.0.0.1:4320/docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/index.html`.

1. Descarga el ejemplo sin peso; impórtalo en el portal del cliente.
2. Revisa la propuesta: 100 pcs, 10 cajas, USD 350, CBM 0.6 y peso pendiente. Aplícala.
3. Abre el enlace del proveedor desde la barra de demo; cambia idioma si lo necesitas.
4. En Productos y cajas completa el peso bruto TOTAL de 120 kg. Guarda o revisa directamente.
5. Confirma el despacho desde Revisar y confirmar. Imprime las diez etiquetas y el documento.
6. Vuelve al cliente: consulta la misma revisión. Abre dos pestañas para probar conflicto CAS.

El lector de XLSX/CSV, el editor, el servicio `saveWorkspace`, el exportador y `getDocumentLabels`
son los módulos reales. PostgreSQL embebido PGlite ejecuta las funciones originales 0147/0148,
0244/0449 y la migración 0457: persistencia entre pestañas, CAS, comandos idempotentes, historial,
submission y códigos físicos se ejecutan en SQL real. Las tablas previas al dominio son DDL
mínimas sintéticas. Los códigos son emitidos por esas funciones SQL sobre la base efímera.

La adaptación HTTP y las identidades están simuladas de forma explícita. Los archivos se guardan
en memoria local; no hay Storage firmado, auth remota, cron, cuota de producción ni precisión PDF
real acreditados. Los PDF que requieren IA fallan de forma visible; no producen datos inventados.
La base vive durante el proceso; reiniciar demo o detenerlo borra únicamente ese estado sintético.

## Actualizar la interfaz sin reiniciar PostgreSQL

Si se está revisando un despacho ya confirmado, conserva el proceso 4320. En otra terminal:

```powershell
$env:QA_PORT = '4321'
$env:QA_BACKEND_ORIGIN = 'http://127.0.0.1:4320'
pnpm exec tsx docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/vite.config.ts
```

Abre `http://127.0.0.1:4321/docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/index.html`.
4321 sirve la interfaz actual y envía `/api` y `/qa` al mismo PostgreSQL que sigue vivo en 4320.
El proxy solo admite un origen HTTP loopback. Los enlaces `/p/{token}` y las rutas de compra,
documento y etiquetas abren los componentes reales de esta fixture; no simulan una sesión autenticada.
«Ver etiquetas» consulta los códigos sin abrir impresión; «Imprimir etiquetas» revalida la revisión.

Esta evidencia no autoriza activar producción. Chino operativo y WeChat real siguen pendientes.
