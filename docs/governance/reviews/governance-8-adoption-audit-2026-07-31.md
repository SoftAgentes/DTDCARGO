# REV-SGE-024 — Gobernanza 8: auditoría integral de adopción

**Fecha:** 2026-07-31

**Alcance:** políticas aprobadas, flujos reales A–J, Corte E2–E5 y deuda PLG-01

**Resultado:** tres slices técnicos acotados; un bloqueo externo; cero barridos

## 1. Integridad del núcleo

- Gobernanzas 1–7 permanecen cerradas en `origin/main`.
- La fuente normativa conserva versión 6.1, 27 políticas aprobadas y cuatro
  componentes registrados.
- `AUD-01` tenía un header obsoleto: SDD-0174 y REV-AUD-046 ya demostraban D1–D5
  en Producción.
- `VIS-02` tenía un header obsoleto: V1–V4, Gmail y Outlook están cerrados;
  Apple Mail es `no aplica` y Noto Serif SC continúa limitada a documento formal
  `lang="zh-CN"`.
- Las fotografías históricas no se modifican. La cápsula se regenera únicamente
  con `pnpm governance:index`.

## 2. Recuento reproducible

Después de reconciliar los dos headers, 20 políticas conservan adopción abierta:

| Estado de adopción | Cantidad | Políticas |
|---|---:|---|
| pendiente | 16 | A11Y-01, AUD-02, BUS-01, CRT-01, DAT-01, ERR-01, FRM-01, IA-01, ICO-01, LOD-01, MOT-01, MP-01, PRG-01, TBL-01, UPL-01 y WIZ-01 |
| parcial | 1 | CAL-01 |
| gradual | 1 | NUM-01 |
| no conforme | 1 | DND-01 |
| no implementada | 1 | HTD-01 |

El conteo anterior usa una categoría primaria por política, no suma consumidores
ni convierte una muestra conforme en adopción transversal. AUD-02 se cuenta en
`pendiente` aunque su estado también explicita no conformidad. SGE-00, BTN-01 y
VIS-01 permanecen aprobadas y se aplican dentro de cada slice; no se reabren
AVS-01, AUD-01 ni VIS-02.

## 3. Matriz de flujos A–J

| Grupo | Flujo y evidencia | Clasificación | Riesgo | Acción |
|---|---|---|---|---|
| A · HTD-01 | `InvoiceDetailClient` → `voidInvoice` → `void_invoice_with_audit_reason` | no conformidad | R3 | SDD-0215: presión sostenida con alternativa accesible; conserva permiso, motivo, RPC y auditoría |
| B · DND-01 | `BoardKanban` → `moveTaskAction` | no conformidad | R2 | SDD-0216: destino accesible, anuncio, conflicto concurrente y rollback |
| C · CAL/DAT | SDD-0141 + `calendar-events-queries.ts` | parcial / no aplica | R2 | SDD-0217 corrige timezone; reprogramación espera una fecha fuente editable; no se fabrica date picker |
| D · BUS/CRT | `GlobalSearchModal` y `ClientCombobox` | cumplimiento / no aplica | R2 | Sin cambio: scope, permisos, race, teclado y retorno de foco presentes; no crean entidades |
| E · ERR/LOD/PRG/WIZ | `ActionButton`, errores inline y muestras A/B | cumplimiento parcial | R2 | Probar pending/error/rollback dentro de A/B; sin sustitución masiva por toast |
| F · FRM/NUM | `NumericInput` canonical + Facturación | cumplimiento / no aplica | R3 | La anulación no edita montos; NUM-01 permanece sin barrido |
| G · UPL | `DocsPanel` + contratos `documents`/Storage | cumplimiento con deuda no bloqueante | R3 | Tamaño/MIME/tenant/ruta privada/URL firmada presentes; cuarentena transversal requiere diseño separado |
| H · TBL/ICO/A11Y | `DataTable` + Kanban | cumplimiento parcial / no conformidad DND | R2 | La corrección accesible queda limitada al Kanban auditado |
| I · IA | tools de agentes read-only, `<untrusted_content>` y revisión humana de Bitácora | cumplimiento en muestra | R3 | Sin cambio: contexto gated por tenant, tools read-only e IA propone |
| J · SGE/BTN/VIS/AVS/CMP | consumidores de A–C | cumplimiento condicionado | R2/R3 | Verificar solo dentro de los slices; cero usos nuevos de deprecated |

## 4. Corte E2–E5

No existe en las fuentes autorizadas una decisión aprobada que identifique en
conjunto jurisdicción, clase de evento, plazo, inicio del cómputo, disposición,
responsable, fundamento y evidencia de aprobación. Metadata de Producción no
muestra tablas, bucket ni jobs que permitan inferirla.

Por tanto E2–E5 permanecen bloqueados. No se crean holds, exportación, expiración,
retención, bucket, job ni purga. El gate se abre únicamente cuando el founder
apruebe o identifique el documento contractual/legal que contenga esos campos.

## 5. Orden y allowlists

1. reconciliación documental del núcleo;
2. SDD-0215 / HTD-01 en anulación de factura;
3. SDD-0216 / DND-01 en Bitácora;
4. SDD-0217 / CAL-01 timezone;
5. PLG-01 reproducible sin segunda fuente normativa;
6. baseline final y cierre verificable.

Cada slice publica su allowlist antes de editar, incluye pruebas focalizadas y
se conserva en un commit atómico selectivo.
