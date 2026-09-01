---
sdd: "0286"
title: "Los GET del Studio respetan el alcance por módulo"
status: done
author: "Sam (founder) + Codex"
created: 2026-08-24
updated: 2026-09-01
supersedes: null
superseded_by: null
related: ["0085", "0139", "0224", "0252"]
confidencialidad: interno
---

# DTD-0286 — El alcance por módulo llega a la API Studio

## Problema

Los handlers de `app/api/studio/**` exigían sesión y quedaban filtrados por
RLS, pero RLS limita el tenant y no decide el alcance de un rol. Un miembro del
tenant podía invocar directamente varios GET aunque el módulo no apareciera en
su navegación.

`requireModuleView()` no sirve en un route handler porque redirige. La API
necesita conservar JSON y responder `403` antes de la primera consulta del
dominio.

## Decisión

Se agrega `moduleViewDenial(supabase, moduleId)` como simétrico de lectura de
`moduleEditDenial`. El helper aplica:

1. matriz RBAC y overrides por rol;
2. alcance de almacén;
3. segundo candado de superadministrador.

Devuelve un mensaje de denegación o `null`; nunca redirige.

## Cobertura medida el 2026-09-01

Hay 15 handlers GET bajo `app/api/studio`.

### Con guard de módulo

| Ruta | Módulo |
|---|---|
| `attachments/[id]/download` | `expenses` |
| `bitacora/export` | `bitacora` |
| `conversaciones/[id]` | `conversaciones` |
| `kpis` | `dashboard` |
| `legal/evidence/[code]` | `legal` |
| `shipments/[id]` | `tracking` |
| `shipments` | `tracking` |

`attachments/download` usa `expenses` porque el piloto vigente sólo admite la
entidad `expense`; la autorización documental por RLS no reemplaza el permiso
del módulo.

### Excepciones con autorización más fina

| Ruta | Justificación |
|---|---|
| `audit/export` | la RPC autoriza la solicitud antes de firmar la URL |
| cinco GET de `bugs/**` | Bug Reporter transversal; RLS por registro y controles admin donde corresponde |
| `comercial/export` | el tipo decide entre `quotes` e `invoices`, con overrides |
| `operativo/export` | el tipo decide entre `clients`, `collections` y `tracking`, con overrides |

La allowlist queda codificada con la ruta exacta y su razón. No autoriza por
prefijo ni por carpeta.

## Contrato anti-drift

`lib/studio/rbac-api-guard.test.ts` analiza el AST de cada `route.ts`, reconoce
declaraciones, `export const GET` y exports nombrados, y exige una clasificación
exhaustiva:

- las siete rutas protegidas deben esperar el helper en el cuerpo superior,
  controlar esa denegación con una respuesta `403` y ejecutarlo antes de su
  primera consulta de dominio;
- las ocho excepciones no pueden tener un guard fijo incompatible con su
  autorización propia;
- cualquier GET nuevo, ruta eliminada, módulo equivocado o excepción obsoleta
  rompe el contrato.

El AST evita falsos verdes causados por imports, comentarios, callbacks nunca
ejecutados u otros handlers del mismo archivo.

## Compatibilidad y fuera de alcance

- No cambia POST, PATCH ni DELETE.
- No cambia RLS, schema, migraciones ni datos.
- No cambia UI ni navegación.
- `legal` conserva el contrato de la UI: además de admin del tenant, exige
  platform admin por ser módulo `SUPERADMIN_ONLY`.
- La discrepancia entre el docblock y el comportamiento de descarga de session
  replay se registra como deuda separada; no altera esta decisión.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.02 · defaults seguros | cumplimiento | ausencia de permiso devuelve 403 antes de datos |
| SGE-00.05 · permisos server-side | cumplimiento | helper en los siete GET + contrato exhaustivo |
| SGE-00 · separación tenant/rol | cumplimiento | RLS conserva tenant; RBAC decide módulo |
| ERR-01 · error mínimo | cumplimiento | JSON 403 sin detalle de datos ni excepción cruda |
| Políticas visuales | no aplica | no hay cambios de UI |

## Verificación requerida

- test del contrato AST;
- test de respuesta 403 antes de consultas y caminos positivos;
- `pnpm docs:check`;
- `pnpm governance:check`;
- `pnpm components:check`;
- gate canónico del repositorio.
