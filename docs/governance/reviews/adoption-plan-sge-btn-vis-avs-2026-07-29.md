# Plan de adopción — SGE-00, BTN-01, VIS-01 y AVS-01

| Control | Valor |
|---|---|
| Revisión | REV-SGE-009 |
| Base | [REV-SGE-008](adoption-sge-btn-vis-avs-2026-07-29.md) |
| Fecha | 2026-07-29 |
| Resultado | plan aprobado técnicamente |
| Cambios de producto | ninguno |

## 1. Regla de clasificación

| Resultado | Uso |
|---|---|
| `cumplimiento` | Existe evidencia suficiente en el alcance exacto. |
| `no aplica` | La política o el conteo no demuestra una obligación en ese caso. |
| `excepción` | Existe una decisión formal con alcance, mitigación y vencimiento. |
| `no conformidad` | Falta contrato/evidencia obligatoria o existe una desviación comprobada. |

Un `<button>` nativo, un literal o una llamada legacy no se convierte
automáticamente en falla. Primero se identifica flujo, riesgo, semántica,
componente y evidencia. A la inversa, un conteo alto tampoco demuestra
cumplimiento.

## 2. Matriz por superficie y módulo

| Superficie | Módulo/flujo | Riesgo | Política | Evidencia | Clasificación | Decisión |
|---|---|---|---|---|---|---|
| Studio | primitivas `ToastProvider`/`ConfirmDialog` | R1–R3 transversal | AVS-01 | SDD-0165 `done`, tests y REV-SGE-008 | cumplimiento | conservar API canónica |
| Studio | confirmaciones nativas | R2/R3 | AVS-01 | cero llamadas reales; coincidencias documentales/de negocio | cumplimiento | mantener gate de regresión |
| Studio | consumidores de toast | R2/R3 | AVS-01 | 26 `toast.show()` y 261 legacy | no conformidad de adopción | migrar solo callers tocados por slices |
| Studio | `ActionButton` | R1–R3 | BTN-01 | 64 archivos | cumplimiento parcial por consumidor | verificar por flujo, no por import |
| Studio | 888 `<button>` en 265 archivos | variable | BTN-01 | conteo estático REV-SGE-008 | no aplica como veredicto | clasificar únicamente allowlists |
| Studio | `DocsPanel` | R1 | BTN-01 | excepción deliberada documentada | excepción | conservar hasta revisión del componente; no expandir |
| Studio | Usuarios/Admin: rol, scope, disable/enable, credenciales | R3 | SGE/BTN/AVS | acciones y D1 audit inventariados | no conformidad | Slice A primero |
| Studio | Facturación/Contabilidad/Tesorería/Cobranzas | R2/R3 | SGE/BTN/AVS | writers best-effort y acciones críticas inventariadas | no conformidad | Slice B después de D1 |
| Studio | Despacho/Operarios/Recepción logística | R3 | SGE/BTN/AVS | cinco RPCs audit legacy; sin matriz de acción | no conformidad | Slice C |
| Studio | tokens semánticos light/dark | transversal | VIS-01 | `tokens.css` y uso amplio de `var(--*)` | cumplimiento | preservar tokens canónicos |
| Studio | 448 hex y 65 `rgba()` fuera de tokens | variable | VIS-01 | conteo estático REV-SGE-008 | no aplica como veredicto global | clasificar por origen/rol antes de tocar |
| Studio | flujo visual autenticado light/dark/móvil | R2/R3 | VIS-01 | sin muestreo vigente por flujo | no conformidad de evidencia | Slice D visual acotado |
| Móvil PWA | `app/m/{cn,ve,erp}` | R2/R3 | SGE/BTN/VIS/AVS | REV-SGE-008 no produjo matriz | no conformidad de evidencia | un flujo crítico por región |
| Portal cliente | compras/facturas/prealertas | R2/R3 | SGE/BTN/VIS/AVS | fuera del barrido Studio original | no conformidad de evidencia | Slice E; no inferir desde Studio |
| Back CMS | publicación/edición | R2 | SGE/BTN/VIS/AVS | fuera del barrido original | no conformidad de evidencia | inventario read-only separado |
| Sitio público | contenido marketing estático | R1 | SGE-00 | SGE-00 gobierna ERP/salidas, no todo contenido público | no aplica | permanece bajo BRAND/SDD público |
| Sitio público | estimación/contacto/registro | R2 | SGE/BTN/AVS | efectos reales, no cubiertos por REV-SGE-008 | no conformidad de evidencia | SDD público separado si se abre |
| Correos/PDF/documentos | salidas del ERP | R2/R3 | SGE/VIS/AVS | no incluidos en el barrido | no conformidad de evidencia | no se tocan en estos slices |

## 3. Priorización R2/R3

1. **Slice A · acceso y configuración R3.** Usuarios, roles, scope,
   suspensión/reactivación, API keys, webhooks y grants.
2. **Slice B · decisiones financieras R2/R3.** Emitir, aprobar, anular,
   conciliar y registrar pago en un único flujo por módulo.
3. **Slice C · logística R3.** Estiba/desestiba, despacho y evidencia, empezando
   por una RPC ya atómica.
4. **Slice D · VIS-01 autenticado.** Las mismas pantallas de A–C en light,
   dark, móvil y zoom, con inventario de literales solo en la allowlist.
5. **Slice E · superficies no Studio.** Un flujo crítico de móvil y uno de
   portal; Back y sitio público conservan SDD separados.

No se abre un slice posterior por cerrar documentación del anterior. Cada uno
requiere SDD, allowlist, pruebas, revisión y aprobación propios.

## 4. Slices pequeños propuestos

| Slice | SDD propio futuro | Resultado verificable | Límite |
|---|---|---|---|
| A1 | Acciones gobernadas de usuarios R3 | disable/enable/rol/scope con BTN+AVS+SGE | solo `/studio/usuarios` |
| A2 | Credenciales e integraciones admin | create/revoke API key y webhook | solo integración API |
| B1 | Factura: emitir/anular | dos decisiones R2/R3 | un drawer y sus actions |
| B2 | Tesorería: registrar/revertir pago | feedback durable y motivo | una entidad |
| C1 | Operación logística: estibar/desestibar | matriz de acción y confirmación | una RPC existente |
| D1 | VIS de A1/B1/C1 | light/dark/móvil/200 %, tokens y contraste | solo pantallas ya tocadas |
| E1 | Móvil: una mutación crítica | paridad funcional y accesible | una ruta `app/m/` |
| E2 | Portal: una decisión de compra/factura | estados verdaderos y recuperación | una ruta portal |

Los correlativos se asignan al abrir cada SDD, tras revalidar `origin/main`.

## 5. Allowlists futuras

### A1 · usuarios

- `app/studio/(app)/usuarios/actions.ts`
- consumidores directos de esas cuatro acciones bajo
  `app/studio/(app)/usuarios/`
- `app/studio/_components/ui/ActionButton.tsx` solo si una prueba demuestra una
  brecha de la primitiva; no para cambios cosméticos
- pruebas unitarias/E2E nuevas con basename del SDD
- spec, gate SGE y revisión del SDD

### A2 · integraciones

- `app/studio/(app)/admin/api-integration-actions.ts`
- componentes de la sección API/webhooks bajo `app/studio/(app)/admin/`
- pruebas nuevas de doble ejecución, secreto one-shot, revocación y error
- spec, gate SGE y revisión del SDD

### B1/B2 · financiero

- un solo archivo `actions.ts` de la entidad elegida;
- un solo componente de decisión y sus tests;
- adapter/RPC audit de esa operación si su SDD lo autoriza;
- cero reemplazo transversal en `facturacion`, `contabilidad`, `tesoreria` o
  `cobranzas`.

### C1 · logística

- una de las cinco RPCs operativas inventariadas;
- su único caller server-side y componente de confirmación;
- prueba de tenant/capability/fallo/rollback;
- cero barrido de todas las rutas operario.

### D1 · visual

- únicamente TS/TSX/CSS ya incluidos por A1, B1 y C1;
- `app/studio/tokens.css` solo para añadir un rol semántico aprobado;
- registro de cada literal como `token`, `asset/dato`, `excepción` o
  `no conformidad`;
- evidencia light/dark/móvil/zoom; cero reemplazo global.

### E1/E2 · otras superficies

- una ruta móvil o portal por SDD;
- componentes y tests alcanzables desde esa ruta;
- nada de correo, PDF, Back o sitio público en el mismo slice.

## 6. Controles anti-barrido

- no migrar las 261 llamadas toast legacy por búsqueda/reemplazo;
- no sustituir los 888 botones ni los 265 archivos que contienen `<button>`;
- no reemplazar los 448 hex o 65 `rgba()` sin clasificación;
- no convertir `ActionButton` en obligación cuando un botón nativo semántico es
  correcto;
- no tocar un consumidor R1 para aumentar el conteo de adopción;
- no compartir un SDD entre superficies o módulos sin una transacción/flujo
  realmente común.

## 7. Criterios de cierre por slice

- matriz SGE-00 completa con evidencia por principio;
- contrato BTN-01 para cada acción modificada;
- AVS-01 solo anuncia éxito después del resultado durable;
- VIS-01 revisada cuando cambie presentación;
- teclado, foco, móvil, dark, zoom 200 % y movimiento reducido aplicables;
- prueba de doble ejecución, error y recuperación;
- conteo antes/después limitado a la allowlist;
- cero regresión fuera del slice;
- commit, Cloud y Vercel como gates separados.

## 8. Aprobación técnica

Se aprueba el orden y las allowlists como plan ejecutable. No se aprueba ningún
SDD de implementación ni se autoriza modificar producto, Cloud o Vercel.
