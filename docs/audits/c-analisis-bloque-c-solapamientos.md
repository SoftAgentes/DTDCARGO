---
title: Mapa de solapamientos del bloque C de PR 21
owner: Worker c-analisis-bloque-c
status: completed
date: 2026-09-10
confidencialidad: interno
---

# Mapa de los 178 solapamientos

Dueño: sesión Worker propietaria de `c-analisis-bloque-c`. Estado: clasificación de lectura terminada, sin resolución ni extracción. Este anexo acompaña el [análisis de lotes](c-analisis-bloque-c.md).

## Dictamen

**Los 178 paths solapados no son 178 conflictos de contenido.** Son la intersección de paths cambiados desde la base común: 120 ya tienen exactamente el mismo blob en ambas puntas; un path conserva íntegro en main el cambio de #21; 18 tienen fusión textual limpia con contenido pendiente de #21; 38 tienen colisiones textuales o altas diferentes sobre el mismo path y uno es eliminación frente a modificación.

La medición permite separar igualdad, antigüedad demostrable y cambio pendiente. **Que Git combine un archivo sin conflicto no demuestra compatibilidad semántica**, ni confirma que su SQL, sus importaciones o sus consumidores estén presentes. Los ejemplos de `portal-queries.ts` y `verify.mjs` muestran esa diferencia. Tampoco se convierte un conflicto de documentación histórica en un conflicto funcional del bloque C.

## Identidad y método

- Base común: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
- Main asignado para la tarea: `e325cb4deb7d11375aa2dbca348496177d1e4350`.
- #21, solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7` (`refs/dtd/pr/21`).
- Git utilizado: `2.55.0.windows.5`.
- Rama escritora verificada: `codex/c-analisis-bloque-c`; guard PASÓ.
- La ref local `main` observada apuntaba a `710a8e0695f416700d75e7bc42e8e5cb889751e8`. No se adoptó como base. Su intersección también suma 178, pero no implica blobs ni contenidos iguales a e325cb4d.
- `git diff --name-status --no-renames -z BASE PUNTA` define el inventario por path; la base común se comprobó con `git merge-base`.
- `git ls-tree -r -z PUNTA` entrega los IDs de blob. Para paths modificados presentes en las tres puntas se ejecutó `git merge-file --object-id --stdout --diff3 MAIN_BLOB BASE_BLOB PR21_BLOB`. El resultado se mantuvo en memoria. `--stdout` evita guardar un blob resultante.
- Igualdad de bytes del resultado con una punta distingue subsunción de combinación nueva. Altas distintas en ambos lados se clasifican AA; borrado en main frente a modificación #21 se clasifica DM. El método no sigue renombres y no pretende sustituir un merge de árboles/compilación.
- No se hizo checkout, restore, cherry-pick, merge, actualización de refs ni escritura de archivos de #21. Solo se escribe este análisis original.

Salida agregada medida:

```text
git merge-base e325cb4d refs/dtd/pr/21
2a2e81bf554dbe7bd4f05170847e8f02e988d320

mainChanges=505
prChanges=804
overlap=178
identico=120
pr-subsumida-main=1
fusion-textual-limpia=17
main-subsumida-pr=1
conflicto-textual=26
add-add=12
delete-modify=1
currentMainOverlap=178
newOverlapPaths=[]
```

| Código | Cantidad | Qué está demostrado | Consecuencia para el plan |
|---|---:|---|---|
| I | 120 | Blob final idéntico en e325cb4d y ea9952a4 | Ya presente; no volver a extraer. |
| O | 1 | Merge de tres vías exit 0 y bytes idénticos a main | #21 quedó vieja en ese path; main conserva su cambio. |
| A | 17 | Merge exit 0, resultado distinto de ambas puntas | Deltas combinables textualmente; revisar dependencias/semántica antes de un futuro lote. |
| N | 1 | Merge exit 0 y bytes idénticos a #21 | Hay cambio nuevo de #21 sobre el contenido main; no confundir con O. |
| C | 26 | Merge devuelve uno o más hunks en conflicto | Colisión textual real; la nota distingue cambio funcional de historia/protocolo obsoleto. |
| AA | 12 | Path inexistente en base y blobs distintos en ambas puntas | Alta sobre alta: comparar contenido; varias diferencias son evidencia posterior de main. |
| DM | 1 | main borró el path que #21 modificó | No resucitar la suite antigua por escoger #21. |
| **Total** | **178** | **Clasificación exhaustiva por path** | **Sin resolver ninguna colisión.** |

## Ejemplos que cambian una decisión

### Ya presente o desfase de #21

1. `supabase/migrations/0416_portal_shipments_tenant_boundary.sql` tiene blob `b0c022ebd48d52b28a719fde9d0958c6c9ec3fc9` en ambas puntas. Lo mismo ocurre con 0428 y 0435–0444; la condición ya presente no significa que las 32 pendientes estén aplicadas.
2. `components/DestinoCombobox.tsx`: merge de tres vías exit 0, resultado idéntico a main. Diff main→#21 en líneas 287, 378 y 395 solo revierte tokens de color. El arreglo de foco de #21 ya está contenido en main; no hay un segundo arreglo que extraer.
3. `docs/audits/2026-09-03-portal-quotes-local.md` y `docs/specs/0380-portal-quotes-principal-tenant/spec.md` son AA desde la base común, pero su diferencia corresponde al aviso de evidencia histórica y al apéndice de extracción de 2026-09-06 agregado en main. Llamarlos dos conflictos funcionales de cotizaciones inflaría el riesgo.
4. `lib/portal/__tests__/portal-quote-scope.test.ts`: main añadió membresías ambiguas y las 100 cotizaciones recientes; #21 conserva el fixture anterior. El diff main→#21 elimina esas regresiones (hunks main 26, 57 y 109). Reemplazar el archivo completo reduciría cobertura aunque ambas ramas ya compartan la migración 0428.
5. `docs/specs/0436-structured-collections-accounting/spec.md:10` solo difiere en `related`: 0449 en main, 0435 en #21. Es una referencia documental desfasada, no otra versión de la migración 0436.

### Conflictos de contenido que sí requieren decisión

1. `app/portal/(app)/perfil/actions.ts`, ocho hunks: main usa `portal_set_identity_photo` (línea 102), conserva límites de reemplazo y diferencia resultado incierto de rollback; #21 mantiene actualización administrativa directa de `clients.cedula_photo_path` con filtros tenant y borrado de rollback. No basta con elegir el lado que tenga más filtros: cambiaría el protocolo de persistencia/retención.
2. `app/portal/(app)/compras/[code]/etiquetas/page.tsx`, un hunk: main obtiene `getLabelPresentation` en línea 67 y pasa `presentation.settings` en línea 139; #21 incorpora `resolveBrandForPortal` (línea 62) y principal tenant. Tomar entero #21 elimina la presentación incorporada en main. Debe conciliarse la sesión con la configuración de etiqueta cuando exista una tarea autorizada.
3. `app/studio/(app)/facturacion/_components/StudioInvoicePaymentReports.tsx`, un hunk del Badge: main línea 99 retiró `dot`; #21 línea 123 expresa cancelación y vuelve a incluir `dot`. El conflicto local es visual, pero el delta #21 completo incluye recibos, reintento, motivo y `cancelledAt`; extraer solo un archivo sin su contrato financiero sería incorrecto.
4. `components/Analytics.tsx` y sus dos suites: main amplió exclusión a URL completa, `/abrir`, queries/hash y escapes malformados; #21 corresponde al alcance anterior. `docs/specs/0371-analytics-access-boundary/spec.md` en main explica la sustitución de esa implementación parcial. Es un cambio de contrato con evidencia posterior, fuera de las 32 SQL; no se soluciona dentro del bloque C.
5. `.github/workflows/quality.yml`, AA: el diff main→#21 elimina `pnpm harness:test` en líneas 68–70 y el paso de símbolos pendientes en 77–79. La diferencia se explica por avances de main, pero reemplazar por #21 sí tendría efecto funcional sobre la cobertura. No se toca en este encargo.
6. `scripts/e2e/sdd-0168-fixture.ts`: main compara tanto origen como cadena URL original canónica; #21 compara `URL.href`, que normaliza ciertos valores. Es una diferencia de frontera de entrada, no solo formato.
7. `scripts/__tests__/harness-worktree.test.mjs` es DM: main elimina la suite Vitest de 84 líneas y contiene `scripts/tests/harness-worktree.node.mjs`; #21 amplía la suite antigua a 110 líneas. El mapa conserva DM por path, sin afirmar que Git reconocería un renombre.

### Fusión limpia con trabajo semántico pendiente

1. `app/m/cn/login/page.tsx`: main añade propagación validada del código de caja (líneas 31 y 88–91), #21 añade `lang` en otra región. Fusión textual limpia, sin conflicto de conducta identificado en estos dos deltas.
2. `app/studio/(app)/academia/_components/AcademiaClient.tsx`: main elimina `dot` del Badge (línea 290), #21 cambia tabs a `RovingTabList` (import y líneas 155/195). Son cambios independientes en el archivo, pero el componente importado sigue siendo requisito de una extracción.
3. `lib/studio/prealertas/queries.ts`: main minimiza datos de proveedor y añade `tenantId`; #21 añade filtrado tenant y lectura documental en lote en funciones distintas. No hay marcador de conflicto; sí deben preservarse ambos contratos.
4. `lib/portal/portal-queries.ts` es N: el merge reproduce exactamente #21 porque main está contenido, pero #21 añade `getPortalClientPrincipal`, cambia firma/implementación de `getPortalAdvisor` a RPC y amplía filtros. Este es código nuevo pendiente, no un archivo viejo sin efecto.
5. `scripts/verify.mjs` es A y contiene una incompatibilidad de configuración deducible: #21 agrega pasos `public-verify-concurrency` y `portal-address-concurrency`; main incorpora `assertCompleteStepPolicy` y `scripts/verify-step-policy.mjs` no declara esos nombres. La función (main líneas 114–130) lanza al encontrar nombres sin clasificación. **Inferencia estática: esa fusión textual requiere actualizar el contrato de pasos antes de poder ejecutar el gate. NO EJECUTADO como combinación; no se trasladó ni ejecutó ese runner.**

## Inventario exhaustivo

`M/A/D` son estados desde la base común. Los IDs abreviados son blobs Git, no commits. En I basta la igualdad de blob; las otras 58 filas incluyen lectura explicativa. La lista abarca todo el solapamiento de #21 con main, incluyendo cambios fuera del bloque C: no es una allowlist de extracción.

| # | Path | Main / #21 | Clase | Blob main / #21 | Lectura de contenido |
|---:|---|---|---|---|---|
| 1 | `.claude/commands/feature.md` | M / M | C (1 hunks) | `7e503dbb98c6` / `5d6ee7d5c2e1` | Metodología vieja frente al puente Worker vigente; no es dependencia SQL del bloque C. |
| 2 | `.github/workflows/quality.yml` | A / A | AA | `532fc1e6cc6e` / `e9f3ad39de30` | #21 carece de los pasos harness:test y pending-migration-symbols incorporados por main; reemplazarla reduce controles. |
| 3 | `AGENTS.md` | M / M | C (3 hunks) | `7309200c601e` / `84ce46ef1900` | Documento reorganizado por Director/Worker en main; #21 modifica el protocolo anterior. |
| 4 | `__tests__/analytics.test.ts` | M / M | C (3 hunks) | `4660b8779915` / `40ec107ab78e` | Contratos de puertas de acceso de #21 frente a protección ampliada de URLs/credenciales en main. |
| 5 | `app/api/m/push/resubscribe/route.ts` | M / M | C (3 hunks) | `87122612e1d8` / `0de378dce75a` | Parser de suscripción coincidente; #21 añade logger y wrapper respond en los mismos hunks. |
| 6 | `app/api/m/push/subscribe/route.ts` | M / M | C (2 hunks) | `740ce66ce188` / `c1f7fff4afdb` | Parser de suscripción coincidente; #21 añade observabilidad sobre la misma respuesta 422. |
| 7 | `app/api/portal/push/subscribe/route.ts` | M / M | C (3 hunks) | `a973b1ebd4c0` / `c1298b817184` | #21 combina principal Portal coherente y logger; main conserva validación de endpoint con contexto anterior. |
| 8 | `app/api/studio/push/__tests__/subscribe-boundary.test.ts` | A / A | AA | `3f9c4e02485e` / `0ddbf0ebb035` | Fixture #21 añade relación client_users/clients del principal Portal; main solo modela tenant. |
| 9 | `app/api/studio/push/__tests__/subscribe-identity.test.ts` | M / M | I | `d238816d40c9` / `d238816d40c9` | Mismo blob; ya presente. |
| 10 | `app/api/studio/push/subscribe/route.ts` | M / M | I | `5420a9ee5388` / `5420a9ee5388` | Mismo blob; ya presente. |
| 11 | `app/m/cn/login/page.tsx` | M / M | A | `facd4c7a4cc8` / `ea54e443b582` | main conserva parámetro de caja validado; #21 añade lang del formulario en otro hunk. |
| 12 | `app/portal/(app)/compras/[code]/etiquetas/page.tsx` | M / M | C (1 hunks) | `98e663fe8303` / `c827328823d3` | main incorpora presentación de etiqueta; #21 cambia marca por RPC de sesión y principal tenant. Reemplazo pierde presentation. |
| 13 | `app/portal/(app)/perfil/PortalAddresses.tsx` | M / M | C (2 hunks) | `a23e973e2932` / `d28f7827d969` | main añade edición; #21 añade retorno de foco/confirmación de borrado. Dos conductas en los mismos controles. |
| 14 | `app/portal/(app)/perfil/actions.ts` | M / M | C (8 hunks) | `c4ff511c0ea0` / `90cd155f734c` | main conserva RPC y contención de foto de identidad; #21 escribe clients por admin con rollback. Divergencia funcional crítica. |
| 15 | `app/portal/(app)/perfil/page.tsx` | M / M | C (1 hunks) | `3542a8ebb8b8` / `501cc51aebb7` | main detecta foto existente; #21 encapsula lectura/firma por contexto. No perder la señal hasCedulaPhoto. |
| 16 | `app/studio/(app)/academia/_components/AcademiaClient.tsx` | M / M | A | `5e5cbc081dea` / `3c9124c3ecba` | main retira dot; #21 introduce RovingTabList en sección distinta. |
| 17 | `app/studio/(app)/crm/_components/KommoClient.tsx` | M / M | A | `384ff07fce78` / `9b2e3bbfce31` | main retira dot; #21 cambia tabs y reloj de conversaciones. |
| 18 | `app/studio/(app)/facturacion/[code]/page.tsx` | M / M | A | `5c96aeeee1d5` / `b6fa9b0eb72e` | main retira dot; #21 cambia null de reportes y contrato de firma por tenant/factura/reporte. |
| 19 | `app/studio/(app)/facturacion/_components/StudioInvoicePaymentReports.tsx` | M / M | C (1 hunks) | `e3e30d13add7` / `75f6069626cc` | main retira dot; #21 añade cancelación, recibo, reintento y motivo. Conflicto local del Badge dentro de cambio financiero mayor. |
| 20 | `app/studio/(app)/fiscal/_components/FiscalClient.tsx` | M / M | A | `4eb62d924c01` / `45b5088a696d` | main retira dot; #21 reemplaza navegación manual de tabs por RovingTabList. |
| 21 | `app/studio/(app)/usuarios/_components/UsersClient.tsx` | M / M | A | `780f44854bbe` / `5fd002fca816` | main retira dot; #21 introduce RovingTabList. |
| 22 | `app/verificar/page.tsx` | M / M | A | `f1ca0a700b06` / `fb404f256fb6` | main añade enlace de recepción por caja; #21 cambia dos comentarios de RPC pública a privilegiada. |
| 23 | `components/Analytics.test.tsx` | A / A | AA | `83a86af1f604` / `1fe3672ad258` | main prueba queries/hash y escapes malformados; #21 cubre alcance anterior. No sustituir la suite ampliada. |
| 24 | `components/Analytics.tsx` | M / M | C (8 hunks) | `8ea2cda8134f` / `7349946c3025` | #21 limita puertas /acceso y /entrar; main también /abrir y URL completa. Divergencia de privacidad documentada en SDD-0371. |
| 25 | `components/CalculadoraForm.tsx` | M / M | A | `81e8b82c7aaf` / `1a0e877031a3` | main cambia semántica visual/avisos; #21 añade useId al campo tarifa. Fusión textual limpia. |
| 26 | `components/DestinoCombobox.test.tsx` | M / M | I | `516fe68d7769` / `516fe68d7769` | Mismo blob; ya presente. |
| 27 | `components/DestinoCombobox.tsx` | M / M | O | `dc6276e85837` / `441df9bf51ee` | Mismo arreglo funcional de foco; solo main añade tokens de marca. Resultado de 3 vías idéntico a main. |
| 28 | `docs/audits/2026-09-03-portal-quotes-local.md` | A / A | AA | `440f0087090e` / `1c373d29b01c` | Desfase histórico: main añade aviso y evidencia de extracción del 2026-09-06. |
| 29 | `docs/legal/privacidad/inventario-terceros.md` | M / M | A | `c3387f6596f0` / `63be471021b2` | main actualiza región/identidad/Analytics; #21 registra retirada de Nominatim. Texto combina limpio; actualidad legal no reevaluada. |
| 30 | `docs/legal/privacidad/mapa-de-borrado.md` | M / M | A | `79111a612d44` / `0ae13cf48c09` | main añade política de fotos; #21 marca integraciones retiradas. Sin hunk conflictivo. |
| 31 | `docs/legal/privacidad/registro-tratamiento.md` | M / M | C (2 hunks) | `87495da3920f` / `0b90d44629ca` | Colisión de versión/fecha y lista de pendientes: región verificada frente a NO VERIFICABLE y retirada de Nominatim. |
| 32 | `docs/marketing/README.md` | M / M | C (1 hunks) | `0bbd0aa147ee` / `8b7e98b82ef5` | #21 describe Analytics anterior; main documenta protección URL completa y remediación posterior. |
| 33 | `docs/runbooks/abrir-ventanas-worktree.md` | M / M | C (4 hunks) | `c84c03260fcc` / `f3a300e6a76b` | main sustituye flujo antiguo por Director/Worker; #21 corrige instrucciones antiguas. |
| 34 | `docs/runbooks/git-worktrees-multiventana.md` | M / M | C (1 hunks) | `80fa7dfc1e51` / `eabfcab016ba` | main sustituye flujo antiguo por Director/Worker; #21 corrige instrucciones antiguas. |
| 35 | `docs/runbooks/multi-ventanas-buena-practica.md` | M / M | C (1 hunks) | `bfe803bcdc07` / `b84849afcd5b` | main sustituye flujo antiguo por Director/Worker; #21 corrige instrucciones antiguas. |
| 36 | `docs/specs/0299-el-error-dice-su-causa/spec.md` | M / M | C (2 hunks) | `a366fe1e1747` / `25b6a60d268b` | Evidencia/estado de cierre divergen; no representa por sí solo un conflicto SQL. |
| 37 | `docs/specs/0315-exportaciones-csv-sin-formulas/spec.md` | A / A | I | `81f2b30ed35a` / `81f2b30ed35a` | Mismo blob; ya presente. |
| 38 | `docs/specs/0316-logs-inbound-sin-remitente/spec.md` | A / A | I | `b1bd9c2875bf` / `b1bd9c2875bf` | Mismo blob; ya presente. |
| 39 | `docs/specs/0317-acceso-cbm-sin-secreto-en-url/spec.md` | A / A | I | `258c58e24703` / `258c58e24703` | Mismo blob; ya presente. |
| 40 | `docs/specs/0318-documentos-portal-en-lote/spec.md` | A / A | I | `5f6e0cdbd699` / `5f6e0cdbd699` | Mismo blob; ya presente. |
| 41 | `docs/specs/0319-reloj-compartido-crm-sin-render-impuro/spec.md` | A / A | I | `71be216ce691` / `71be216ce691` | Mismo blob; ya presente. |
| 42 | `docs/specs/0320-e2e-local-sin-secretos/spec.md` | A / A | I | `4301638e20d2` / `4301638e20d2` | Mismo blob; ya presente. |
| 43 | `docs/specs/0321-e2e-local-acotado/spec.md` | A / A | I | `324f4247ccee` / `324f4247ccee` | Mismo blob; ya presente. |
| 44 | `docs/specs/0322-relaciones-de-ordenes-en-lote/spec.md` | A / A | I | `eab5c6db98df` / `eab5c6db98df` | Mismo blob; ya presente. |
| 45 | `docs/specs/0323-fundamentos-web-quality/spec.md` | A / A | I | `21e491359560` / `21e491359560` | Mismo blob; ya presente. |
| 46 | `docs/specs/0324-tabs-studio-con-teclado/spec.md` | A / A | I | `592408850c80` / `592408850c80` | Mismo blob; ya presente. |
| 47 | `docs/specs/0325-throttle-acceso-cbm/spec.md` | A / A | I | `74ef7ea39ba8` / `74ef7ea39ba8` | Mismo blob; ya presente. |
| 48 | `docs/specs/0326-telegram-secret-header/spec.md` | A / A | I | `ed08736474ba` / `ed08736474ba` | Mismo blob; ya presente. |
| 49 | `docs/specs/0327-cookie-operario-autenticada/spec.md` | A / A | I | `3f2686f31d9a` / `3f2686f31d9a` | Mismo blob; ya presente. |
| 50 | `docs/specs/0328-cerrar-rpc-verificacion-publica/spec.md` | A / A | I | `a76909f945d0` / `a76909f945d0` | Mismo blob; ya presente. |
| 51 | `docs/specs/0329-aislar-cache-e2e/spec.md` | A / A | I | `abfabf0cdc51` / `abfabf0cdc51` | Mismo blob; ya presente. |
| 52 | `docs/specs/0330-retirar-geocodificado-nominatim/spec.md` | A / A | I | `c85e4d10d49e` / `c85e4d10d49e` | Mismo blob; ya presente. |
| 53 | `docs/specs/0331-retirar-consultas-identidad-inseguras/spec.md` | A / A | I | `c578347e088d` / `c578347e088d` | Mismo blob; ya presente. |
| 54 | `docs/specs/0332-retener-llave-kms-backup/spec.md` | A / A | I | `bd513c3a02f4` / `bd513c3a02f4` | Mismo blob; ya presente. |
| 55 | `docs/specs/0333-validar-configuracion-integraciones/spec.md` | A / A | I | `768af488d460` / `768af488d460` | Mismo blob; ya presente. |
| 56 | `docs/specs/0334-retirar-configuracion-payload-legada/spec.md` | A / A | I | `a22535ab605e` / `a22535ab605e` | Mismo blob; ya presente. |
| 57 | `docs/specs/0335-contener-service-role-portal/spec.md` | A / A | I | `5e10658972bc` / `5e10658972bc` | Mismo blob; ya presente. |
| 58 | `docs/specs/0340-firmar-adjuntos-prealerta-por-sesion/spec.md` | A / A | I | `c8da2a0d4d83` / `c8da2a0d4d83` | Mismo blob; ya presente. |
| 59 | `docs/specs/0343-detalle-compra-portal-acotado/spec.md` | A / A | I | `281e123899b9` / `281e123899b9` | Mismo blob; ya presente. |
| 60 | `docs/specs/0344-contexto-soporte-portal-acotado/spec.md` | A / A | I | `516853cc8973` / `516853cc8973` | Mismo blob; ya presente. |
| 61 | `docs/specs/0345-contexto-detalle-envio-portal-acotado/spec.md` | A / A | I | `e3e177b86795` / `e3e177b86795` | Mismo blob; ya presente. |
| 62 | `docs/specs/0346-contexto-listado-envios-portal-acotado/spec.md` | A / A | I | `97086e7f0b30` / `97086e7f0b30` | Mismo blob; ya presente. |
| 63 | `docs/specs/0347-contexto-home-portal-acotado/spec.md` | A / A | I | `0449b6c6c4a2` / `0449b6c6c4a2` | Mismo blob; ya presente. |
| 64 | `docs/specs/0348-contexto-aceptacion-portal-acotado/spec.md` | A / A | I | `b69dd9603e1c` / `b69dd9603e1c` | Mismo blob; ya presente. |
| 65 | `docs/specs/0349-ci-calidad-sin-secretos/spec.md` | A / A | AA | `c23a81cb6a47` / `8348e7674c60` | main incorpora allowlist/evidencia de extracción; #21 conserva historia y alcance anteriores. |
| 66 | `docs/specs/0359-portal-shipments-tenant-boundary/spec.md` | A / A | I | `81eee676818e` / `81eee676818e` | Mismo blob; ya presente. |
| 67 | `docs/specs/0360-destino-combobox-focus-race/spec.md` | A / A | AA | `b6e350c816ef` / `da5eb8e6ad0f` | Misma corrección; documentos de extracción y validación posterior en main frente a cierre histórico #21. |
| 68 | `docs/specs/0367-kommo-webhook-disabled-connection/spec.md` | A / A | I | `72659da0a601` / `72659da0a601` | Mismo blob; ya presente. |
| 69 | `docs/specs/0369-e2e-project-boundary/spec.md` | A / A | I | `42ecb397480f` / `42ecb397480f` | Mismo blob; ya presente. |
| 70 | `docs/specs/0370-worktree-safe-lifecycle/spec.md` | A / A | I | `bf84618808fa` / `bf84618808fa` | Mismo blob; ya presente. |
| 71 | `docs/specs/0371-analytics-access-boundary/spec.md` | A / A | AA | `fa3bf1e228c4` / `643051fe122f` | main declara descartada la implementación parcial #21 y amplía aceptación a URL/credenciales. |
| 72 | `docs/specs/0373-push-delivery-boundary/spec.md` | A / A | AA | `940c1113ba7a` / `9701b9c1efeb` | Contrato de parser equivalente; main registra extracción, cierre y cobertura posterior. |
| 73 | `docs/specs/0374-public-verify-fail-closed/spec.md` | A / A | I | `f83528817f01` / `f83528817f01` | Mismo blob; ya presente. |
| 74 | `docs/specs/0376-worktree-git-probe-batching/spec.md` | A / A | I | `cb3eced659e6` / `cb3eced659e6` | Mismo blob; ya presente. |
| 75 | `docs/specs/0378-verification-lifecycle-integrity/spec.md` | A / A | I | `35f2e7433ed0` / `35f2e7433ed0` | Mismo blob; ya presente. |
| 76 | `docs/specs/0379-fflate-replay-compatible-patch/spec.md` | A / A | I | `dbf19c3b989a` / `dbf19c3b989a` | Mismo blob; ya presente. |
| 77 | `docs/specs/0380-portal-quotes-principal-tenant/spec.md` | A / A | AA | `f6f7a1e595a3` / `d943d87ba050` | Desfase histórico: main añade aviso/evidencia de extracción y fecha actualizada. |
| 78 | `docs/specs/0383-portal-rsc-service-role-ast-boundary/spec.md` | A / A | I | `b7852265c982` / `b7852265c982` | Mismo blob; ya presente. |
| 79 | `docs/specs/0384-portal-profile-actions-principal-tenant/spec.md` | A / A | I | `333246ff591d` / `333246ff591d` | Mismo blob; ya presente. |
| 80 | `docs/specs/0386-portal-push-principal-tenant/spec.md` | A / A | I | `913647faa1ff` / `913647faa1ff` | Mismo blob; ya presente. |
| 81 | `docs/specs/0387-portal-academy-application-principal-tenant/spec.md` | A / A | I | `0891d64ffbfe` / `0891d64ffbfe` | Mismo blob; ya presente. |
| 82 | `docs/specs/0388-portal-suppliers-application-principal-tenant/spec.md` | A / A | I | `5b41ee444c60` / `5b41ee444c60` | Mismo blob; ya presente. |
| 83 | `docs/specs/0389-portal-purchases-application-principal-tenant/spec.md` | A / A | I | `ea9bf0ee73db` / `ea9bf0ee73db` | Mismo blob; ya presente. |
| 84 | `docs/specs/0390-portal-payment-shipment-reads-principal-tenant/spec.md` | A / A | I | `ef89add2885f` / `ef89add2885f` | Mismo blob; ya presente. |
| 85 | `docs/specs/0391-portal-core-reads-principal-tenant/spec.md` | A / A | I | `138abf9a0775` / `138abf9a0775` | Mismo blob; ya presente. |
| 86 | `docs/specs/0392-portal-activation-profile-principal-tenant/spec.md` | A / A | I | `753f4d1824bc` / `753f4d1824bc` | Mismo blob; ya presente. |
| 87 | `docs/specs/0393-portal-claims-read-principal-tenant/spec.md` | A / A | I | `510aee19b527` / `510aee19b527` | Mismo blob; ya presente. |
| 88 | `docs/specs/0394-portal-address-mutations-principal-tenant/spec.md` | A / A | I | `89df6c78a011` / `89df6c78a011` | Mismo blob; ya presente. |
| 89 | `docs/specs/0395-portal-quote-writes-principal-tenant/spec.md` | A / A | I | `57aa0a9ecc10` / `57aa0a9ecc10` | Mismo blob; ya presente. |
| 90 | `docs/specs/0396-portal-elevated-actions-principal-tenant/spec.md` | A / A | I | `5b90dc09d219` / `5b90dc09d219` | Mismo blob; ya presente. |
| 91 | `docs/specs/0397-portal-invoice-actions-principal-tenant/spec.md` | A / A | I | `a932afc5ebfb` / `a932afc5ebfb` | Mismo blob; ya presente. |
| 92 | `docs/specs/0398-portal-private-contexts-principal-tenant/spec.md` | A / A | I | `d91c59aa2ee1` / `d91c59aa2ee1` | Mismo blob; ya presente. |
| 93 | `docs/specs/0399-portal-purchase-consumers-principal-tenant/spec.md` | A / A | I | `9df769506124` / `9df769506124` | Mismo blob; ya presente. |
| 94 | `docs/specs/0403-invoice-document-entity-rbac/spec.md` | A / A | I | `0a8d5456688a` / `0a8d5456688a` | Mismo blob; ya presente. |
| 95 | `docs/specs/0404-treasury-document-entity-rbac/spec.md` | A / A | I | `fffbe4d30788` / `fffbe4d30788` | Mismo blob; ya presente. |
| 96 | `docs/specs/0405-accounting-document-entity-rbac/spec.md` | A / A | I | `bcb498878f98` / `bcb498878f98` | Mismo blob; ya presente. |
| 97 | `docs/specs/0406-expense-document-entity-rbac/spec.md` | A / A | I | `0ee5377f28c4` / `0ee5377f28c4` | Mismo blob; ya presente. |
| 98 | `docs/specs/0407-shipment-document-entity-rbac/spec.md` | A / A | I | `268cee6001ad` / `268cee6001ad` | Mismo blob; ya presente. |
| 99 | `docs/specs/0408-client-document-entity-rbac/spec.md` | A / A | I | `31490ead93d6` / `31490ead93d6` | Mismo blob; ya presente. |
| 100 | `docs/specs/0409-supplier-document-entity-rbac/spec.md` | A / A | I | `cd85f8298a65` / `cd85f8298a65` | Mismo blob; ya presente. |
| 101 | `docs/specs/0410-naviera-document-entity-rbac/spec.md` | A / A | I | `5127ec73ee1a` / `5127ec73ee1a` | Mismo blob; ya presente. |
| 102 | `docs/specs/0411-bitacora-document-entity-rbac/spec.md` | A / A | I | `1f4e1aa45bc9` / `1f4e1aa45bc9` | Mismo blob; ya presente. |
| 103 | `docs/specs/0412-unlinked-document-entity-rbac/spec.md` | A / A | I | `f5d3fb170233` / `f5d3fb170233` | Mismo blob; ya presente. |
| 104 | `docs/specs/0413-private-app-csp-nonce/spec.md` | A / A | I | `e1e0e7e46233` / `e1e0e7e46233` | Mismo blob; ya presente. |
| 105 | `docs/specs/0414-structured-request-logging/spec.md` | A / A | I | `cf101c972664` / `cf101c972664` | Mismo blob; ya presente. |
| 106 | `docs/specs/0415-structured-drain-crons/spec.md` | A / A | I | `ea2d965d1c40` / `ea2d965d1c40` | Mismo blob; ya presente. |
| 107 | `docs/specs/0416-structured-scheduled-crons/spec.md` | A / A | I | `d145ab0acc61` / `d145ab0acc61` | Mismo blob; ya presente. |
| 108 | `docs/specs/0417-structured-health-crons/spec.md` | A / A | I | `2303aa58880f` / `2303aa58880f` | Mismo blob; ya presente. |
| 109 | `docs/specs/0418-structured-kommo-edge-observability/spec.md` | A / A | I | `a88c541f56ce` / `a88c541f56ce` | Mismo blob; ya presente. |
| 110 | `docs/specs/0419-structured-health-internals/spec.md` | A / A | I | `d9b796214a82` / `d9b796214a82` | Mismo blob; ya presente. |
| 111 | `docs/specs/0420-structured-worker-internals/spec.md` | A / A | I | `355f8f782849` / `355f8f782849` | Mismo blob; ya presente. |
| 112 | `docs/specs/0421-structured-bug-notification-internals/spec.md` | A / A | I | `7f06f034fa9f` / `7f06f034fa9f` | Mismo blob; ya presente. |
| 113 | `docs/specs/0422-structured-notification-primitives/spec.md` | A / A | I | `24c70c02c9b7` / `24c70c02c9b7` | Mismo blob; ya presente. |
| 114 | `docs/specs/0423-structured-client-notification-scheduling/spec.md` | A / A | I | `ffa49f94c8da` / `ffa49f94c8da` | Mismo blob; ya presente. |
| 115 | `docs/specs/0424-structured-client-notification-queries/spec.md` | A / A | I | `a7763ce5d117` / `a7763ce5d117` | Mismo blob; ya presente. |
| 116 | `docs/specs/0425-structured-portal-push/spec.md` | A / A | I | `8e7b495c859c` / `8e7b495c859c` | Mismo blob; ya presente. |
| 117 | `docs/specs/0426-structured-portal-profile-actions/spec.md` | A / A | I | `b1bc1518c503` / `b1bc1518c503` | Mismo blob; ya presente. |
| 118 | `docs/specs/0427-structured-portal-suppliers-actions/spec.md` | A / A | I | `4a437216a846` / `4a437216a846` | Mismo blob; ya presente. |
| 119 | `docs/specs/0428-structured-portal-completion/spec.md` | A / A | I | `ece451efa033` / `ece451efa033` | Mismo blob; ya presente. |
| 120 | `docs/specs/0429-structured-internal-notification-producers/spec.md` | A / A | I | `2873ab2a25e3` / `2873ab2a25e3` | Mismo blob; ya presente. |
| 121 | `docs/specs/0430-structured-inbound-notification-producers/spec.md` | A / A | I | `12c2fccba404` / `12c2fccba404` | Mismo blob; ya presente. |
| 122 | `docs/specs/0431-structured-mobile-route-logging/spec.md` | A / A | I | `f48a8762758d` / `f48a8762758d` | Mismo blob; ya presente. |
| 123 | `docs/specs/0432-structured-conversation-internals/spec.md` | A / A | I | `cf03aab05e77` / `cf03aab05e77` | Mismo blob; ya presente. |
| 124 | `docs/specs/0433-structured-bug-workflow-observability/spec.md` | A / A | I | `1349c9189939` / `1349c9189939` | Mismo blob; ya presente. |
| 125 | `docs/specs/0434-web-shell-accessibility-baseline/spec.md` | A / A | I | `61e3520152f9` / `61e3520152f9` | Mismo blob; ya presente. |
| 126 | `docs/specs/0436-structured-collections-accounting/spec.md` | A / A | AA | `99280e7d844e` / `bf5a1367032f` | Solo related: main referencia 0449 donde #21 referencia 0435. No emparejar con migración 0436. |
| 127 | `docs/specs/0437-structured-mail-rule-engine/spec.md` | A / A | I | `210df3650e97` / `210df3650e97` | Mismo blob; ya presente. |
| 128 | `docs/specs/README.md` | M / M | C (2 hunks) | `92ece56b6ca8` / `9ed73d6a6bf1` | Índice generado: inventarios distintos (408 frente a 429); no resolver escogiendo una versión completa. |
| 129 | `e2e/README.md` | M / M | C (1 hunks) | `3d6347e87265` / `b4c08f6cbb14` | main documenta workers Windows y diagnóstico D2; #21 añade flujo deny-only/otros contratos. |
| 130 | `lib/portal/__tests__/estimates.test.ts` | M / M | I | `de09c7c46faa` / `de09c7c46faa` | Mismo blob; ya presente. |
| 131 | `lib/portal/__tests__/invoices.test.ts` | M / M | A | `31c2abc8fc81` / `3bd24898701e` | main cambia tono parcial; #21 añade fixture de principal y aserciones tenant. |
| 132 | `lib/portal/__tests__/portal-quote-scope.test.ts` | A / A | AA | `6bf01be51aac` / `44a2c4f84454` | main añade regresiones de membresía ambigua y 100 cotizaciones recientes; #21 quedó vieja. |
| 133 | `lib/portal/portal-queries.ts` | M / M | N | `bc93d09d8ba7` / `cc3744194aab` | main está contenido en #21, pero #21 agrega principal coherente, RPC de asesor y filtros tenant. No es mero desfase. |
| 134 | `lib/studio/conversaciones/__tests__/conversaciones.test.ts` | M / M | A | `48003f0a6ca0` / `42a4958fa72e` | main cambia tono abierto; #21 retira aggregateOutstanding por cambio de fuente del saldo. |
| 135 | `lib/studio/conversaciones/conversations-types.ts` | M / M | A | `a6678203e36c` / `ebd484ecdd50` | main cambia tono abierto; #21 precisa comentario de saldo excluyendo anuladas. |
| 136 | `lib/studio/documents/types.ts` | M / M | A | `470ba56f38a5` / `0f3900f857df` | main cambia tono pendiente; #21 agrega entidad expense y ruta a gastos. |
| 137 | `lib/studio/notify/__tests__/push-subscription-fixture.ts` | A / A | I | `6286fab15814` / `6286fab15814` | Mismo blob; ya presente. |
| 138 | `lib/studio/notify/__tests__/push-subscription.test.ts` | A / A | I | `7ef385dd6edb` / `7ef385dd6edb` | Mismo blob; ya presente. |
| 139 | `lib/studio/notify/__tests__/send-operario-push.test.ts` | M / M | I | `064cd17797d7` / `064cd17797d7` | Mismo blob; ya presente. |
| 140 | `lib/studio/notify/__tests__/send-user-push.test.ts` | M / M | I | `a9dbb371f45c` / `a9dbb371f45c` | Mismo blob; ya presente. |
| 141 | `lib/studio/notify/push-subscription.ts` | A / A | I | `5415dddad364` / `5415dddad364` | Mismo blob; ya presente. |
| 142 | `lib/studio/notify/send-operario-push.ts` | M / M | C (2 hunks) | `57e3beeeb955` / `6a5c370f7131` | Parser coincidente; console sin datos sensibles frente a logger estructurado. Revisar redacción, no elegir archivo entero. |
| 143 | `lib/studio/notify/send-user-push.ts` | M / M | C (3 hunks) | `ab8ef53969bf` / `f473cc7c61df` | Parser y fallback coincidentes; diagnósticos console frente a logger estructurado. |
| 144 | `lib/studio/prealertas/queries.ts` | M / M | A | `9fc37d02907a` / `ac66eed8b011` | main minimiza proyección proveedor y agrega tenantId; #21 agrega filtros tenant y lecturas documentales en lote. |
| 145 | `package.json` | M / M | A | `e0435c31cbc8` / `42cadd21620a` | main añade scripts harness; #21 añade engines/packageManager y retira configuración pnpm. Requiere coherencia con workspace/lock. |
| 146 | `playwright.config.ts` | M / M | C (6 hunks) | `2a8ba96092be` / `30580ae6d570` | main limita workers/Windows; #21 agrega timeout y backend deny-only. Contratos operativos distintos. |
| 147 | `scripts/__tests__/ci-workflow-contract.test.mjs` | A / A | AA | `3cdf6aa92b5d` / `be255a24f694` | #21 omite tests de obligatoriedad de harness y símbolos pendientes presentes en main. |
| 148 | `scripts/__tests__/harness-worktree.test.mjs` | D / M | DM | `ausente` / `372eb0b5c71b` | main elimina suite Vitest y tiene scripts/tests/harness-worktree.node.mjs; #21 modifica suite antigua. |
| 149 | `scripts/__tests__/playwright-config.test.ts` | M / M | C (1 hunks) | `c10e214da8d4` / `4853c5573019` | Alias config frente a playwrightConfig y contratos nuevos de cada rama; conflicto de import. |
| 150 | `scripts/e2e/sdd-0168-fixture.ts` | M / M | C (1 hunks) | `857d4060a8f0` / `61fad9329d43` | main valida cadena URL canónica; #21 acepta normalización de URL.href y valida projectRef. Cambia frontera aceptada. |
| 151 | `scripts/harness-worktree.mjs` | M / M | C (12 hunks) | `207339b8b2fa` / `9b7aec03a9de` | Ciclo/claim/cleanup del Director/Worker frente a ciclo anterior #21. No pertenece a extracción de producto C. |
| 152 | `scripts/verify.mjs` | M / M | A | `042c6e2b9409` / `841323948e3f` | Fusión limpia puede fallar por política: #21 agrega dos nombres ausentes en STEP_POLICY main. |
| 153 | `supabase/migrations/0399_revoke_truncate_anon_authenticated.sql` | A / A | I | `84cf5ea32322` / `84cf5ea32322` | Mismo blob; ya presente. |
| 154 | `supabase/migrations/0400_revoke_public_verify_rpc_execute.sql` | A / A | I | `322383b09be4` / `322383b09be4` | Mismo blob; ya presente. |
| 155 | `supabase/migrations/0416_portal_shipments_tenant_boundary.sql` | A / A | I | `b0c022ebd48d` / `b0c022ebd48d` | Mismo blob; ya presente. |
| 156 | `supabase/migrations/0428_portal_quotes_principal_tenant.sql` | A / A | I | `9c05314165c5` / `9c05314165c5` | Mismo blob; ya presente. |
| 157 | `supabase/migrations/0435_invoice_document_entity_rbac.sql` | A / A | I | `e24d3caccbc6` / `e24d3caccbc6` | Mismo blob; ya presente. |
| 158 | `supabase/migrations/0436_treasury_document_entity_rbac.sql` | A / A | I | `a1fe9faae627` / `a1fe9faae627` | Mismo blob; ya presente. |
| 159 | `supabase/migrations/0437_accounting_document_entity_rbac.sql` | A / A | I | `c8df8870050b` / `c8df8870050b` | Mismo blob; ya presente. |
| 160 | `supabase/migrations/0438_expense_document_entity_rbac.sql` | A / A | I | `89c675df80ec` / `89c675df80ec` | Mismo blob; ya presente. |
| 161 | `supabase/migrations/0439_shipment_document_entity_rbac.sql` | A / A | I | `7b4f5e1a93db` / `7b4f5e1a93db` | Mismo blob; ya presente. |
| 162 | `supabase/migrations/0440_client_document_entity_rbac.sql` | A / A | I | `7461f077f4a2` / `7461f077f4a2` | Mismo blob; ya presente. |
| 163 | `supabase/migrations/0441_supplier_document_entity_rbac.sql` | A / A | I | `34e5f2cb11bc` / `34e5f2cb11bc` | Mismo blob; ya presente. |
| 164 | `supabase/migrations/0442_naviera_document_entity_rbac.sql` | A / A | I | `7b24a7f8b0ba` / `7b24a7f8b0ba` | Mismo blob; ya presente. |
| 165 | `supabase/migrations/0443_bitacora_document_entity_rbac.sql` | A / A | I | `0a349c35774c` / `0a349c35774c` | Mismo blob; ya presente. |
| 166 | `supabase/migrations/0444_unlinked_document_entity_rbac.sql` | A / A | I | `4f8e9d5d7f70` / `4f8e9d5d7f70` | Mismo blob; ya presente. |
| 167 | `supabase/tests/0416_portal_shipments_tenant_boundary.test.sql` | A / A | I | `6a198309bb04` / `6a198309bb04` | Mismo blob; ya presente. |
| 168 | `supabase/tests/0428_portal_quotes_principal_tenant.test.sql` | A / A | I | `35735862a3d6` / `35735862a3d6` | Mismo blob; ya presente. |
| 169 | `supabase/tests/0435_invoice_document_entity_rbac.test.sql` | A / A | I | `9f00a91f4796` / `9f00a91f4796` | Mismo blob; ya presente. |
| 170 | `supabase/tests/0436_treasury_document_entity_rbac.test.sql` | A / A | I | `2abba4be34fa` / `2abba4be34fa` | Mismo blob; ya presente. |
| 171 | `supabase/tests/0437_accounting_document_entity_rbac.test.sql` | A / A | I | `558e94deecc9` / `558e94deecc9` | Mismo blob; ya presente. |
| 172 | `supabase/tests/0438_expense_document_entity_rbac.test.sql` | A / A | I | `e57d612e2fbf` / `e57d612e2fbf` | Mismo blob; ya presente. |
| 173 | `supabase/tests/0439_shipment_document_entity_rbac.test.sql` | A / A | I | `131fcd4c3fb3` / `131fcd4c3fb3` | Mismo blob; ya presente. |
| 174 | `supabase/tests/0440_client_document_entity_rbac.test.sql` | A / A | I | `bef3b5800bd0` / `bef3b5800bd0` | Mismo blob; ya presente. |
| 175 | `supabase/tests/0441_supplier_document_entity_rbac.test.sql` | A / A | I | `8437147221c1` / `8437147221c1` | Mismo blob; ya presente. |
| 176 | `supabase/tests/0442_naviera_document_entity_rbac.test.sql` | A / A | I | `bb21af91c2c0` / `bb21af91c2c0` | Mismo blob; ya presente. |
| 177 | `supabase/tests/0443_bitacora_document_entity_rbac.test.sql` | A / A | I | `62fad1124ea7` / `62fad1124ea7` | Mismo blob; ya presente. |
| 178 | `supabase/tests/0444_unlinked_document_entity_rbac.test.sql` | A / A | I | `0cbcfc234f40` / `0cbcfc234f40` | Mismo blob; ya presente. |

## Validación y límites

| Comprobación | Resultado | Alcance |
|---|---|---|
| Raíz/rama y guard | PASÓ | Worktree asignado en e325cb4d; ownership único del Worker principal. |
| Inventario de intersección | PASÓ | 178 paths; 505 cambiados en main y 804 en #21 frente a base común. |
| Igualdad de blobs y merge de contenido en memoria | PASÓ | 120 idénticos; 45 M/M diferentes evaluados con merge-file (26 con conflicto y 19 limpios); 12 AA y 1 DM identificados por árboles. |
| Interpretación de ejemplos de conflicto/desfase | PASÓ | Lectura de diffs y funciones concretas; no resolución. |
| Merge del árbol, compilación y E2E de la combinación | NO EJECUTADO | Excluidos: no se extrae producto ni se construye una rama combinada. |
| Esquema/orden SQL | NO EJECUTADO en este anexo | Evidencia de reconstrucción en el [anexo de medición](c-analisis-bloque-c-medicion.md). |
| Producción, filas de negocio, credenciales | NO EJECUTADO | No se consultaron. |

Los 26 códigos C identifican conflictos textuales, no 26 vulnerabilidades. La ausencia de conflicto tampoco es certificación funcional. Ningún archivo del inventario fue resuelto, restaurado, copiado a la rama o incorporado al índice Git.
