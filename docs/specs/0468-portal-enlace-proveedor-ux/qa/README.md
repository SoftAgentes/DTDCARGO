# Revisión local del flujo proveedor · SDD0468 etapa2

Desde la raíz del worktree, sin .env ni credenciales:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
node docs/specs/0468-portal-enlace-proveedor-ux/qa/serve.mjs
```

Abrir http://127.0.0.1:4316/docs/specs/0468-portal-enlace-proveedor-ux/qa/index.html.

Usa los mismos componentes que la página real. Los únicos POST son funciones locales inyectadas: se validan datos con validatePackingListInput y se devuelve folio PL-DEMO-0468/versión en memoria; archivos devuelven cantidad simulada. No se persisten archivos ni documentos en ningún servidor. Los borradores sí usan localStorage con token local-fixture-only-0468, igual que el comportamiento real.

Controles: Cliente/Proveedor; escritorio/375/390 (iframe con viewport propio); claro/oscuro; éxito/parcial/sin conexión/503. La simulación se cambia por URL y recarga: borra selección de archivos como una recarga real, conserva borrador local. El enlace copiado /p/local-fixture-only-0468 redirige exclusivamente al proveedor ficticio. El servidor loopback bloquea otras rutas backend; el QR se resuelve al dominio local. No se incorpora una ruta fixture al árbol app/Next, ni se cambia la CSP productiva.

El Excel de esta preview es la plantilla pública de muestra; el enlace real conserva su GET prellenado. Las etiquetas son ficticias y no sirven en operación. Fuentes públicas Archivo/Noto Sans SC/JetBrains Mono vía Google Fonts; si esa red no está disponible, documentar fallback en la revisión.

Baseline de comparación con los componentes originales de main30a9f890:

```powershell
$env:QA_BASELINE='1'
$env:QA_PORT='4317'
node docs/specs/0468-portal-enlace-proveedor-ux/qa/serve.mjs
```

La bandera solo pertenece a ese proceso. Vite lee los cuatro módulos originales por git show, sin escribir sobre el trabajo. El backend permanece bloqueado también en baseline.

Casos de aceptación: caja simple; líder5x10 a2,3kg/caja,0.5CBM + producto mismo grupo8 a4 =5cajas/58unidades/132/15kg/2.5CBM; eliminar grupo no reasigna hijos; cambiar idioma/pasos y volver de Excel; restaura tras recarga; storage bloqueado muestra alerta visible; guardar/restaurar no hace POST; carga parcial/recibo desconocido no anuncia completo; quitar archivo no borra incertidumbre; enviar muestra folio/versión; corregir o restaurar después vuelve a edición; errores abren paso y enfocan; preview read-only conserva precio0.004; impresión conserva todas las filas del DOM completo.

Las pruebas Vitest mockean impresión y transporte; no certifican PDF paginado, impresión física, revisión humana de chino ni WeChat real. La revisión visible del Director usa navegador con fixture, no producción.
