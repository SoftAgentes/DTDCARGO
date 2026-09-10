# `docs/legal/privacidad/` — Datos personales

> **Clasificación: interno.** Ningún archivo de esta carpeta contiene datos de
> clientes: solo nombres de tablas, columnas, buckets y rutas de archivo. Por eso
> sí va en git (a diferencia de `docs/legal/*.pdf`, que está gitignoreado).

## Qué hay acá

| Archivo | Qué es | Quién lo mantiene |
|---|---|---|
| [`AUDITORIA-2026-07.md`](AUDITORIA-2026-07.md) | El informe: 12 puntos, 13 hallazgos con `archivo:línea`, lo `NO VERIFICABLE` y lo que va a la abogada | Se regenera con `/revisar-datos-ve` |
| [`registro-tratamiento.md`](registro-tratamiento.md) | Qué datos trata el sistema, campo por campo. **El activo que más dura** | Humano — las columnas `⬜` son decisiones, no las puede inventar la auditoría |
| [`mapa-de-borrado.md`](mapa-de-borrado.md) | **Todos los destinos de un dato personal** y qué pasa con cada uno. Prerrequisito del botón "eliminar mi cuenta" (SDD-0191 Slice B) | Humano — se destraba con la respuesta de la abogada sobre retención |
| [`inventario-terceros.md`](inventario-terceros.md) | Los 10 proveedores que reciben datos personales y los 3 que no | Humano, con cada proveedor nuevo |
| [`fotos-identidad-cliente-v1.md`](fotos-identidad-cliente-v1.md) | Política propuesta de retención, eliminación solicitada y frontera VE-China para fotos vigentes e históricas | Founder + Legal + Ingeniería; no entra en vigor hasta aplicar sus controles |
| [`revision-0445-2026-09-04.md`](revision-0445-2026-09-04.md) | Revisión técnica de la contención funcional y de privacidad posterior a 0445 | Ingeniería; 0447 pendiente de autorización/aplicación Cloud |
| [`aws-adjuntos-expediente-contractual.md`](aws-adjuntos-expediente-contractual.md) | Identidad esperada, DPA, subprocesadores y huellas oficiales AWS; la aceptación real vive fuera de Git | Operaciones + legal |
| [`pipl-aws-adjuntos.md`](pipl-aws-adjuntos.md) | Evaluación de impacto, mecanismo transfronterizo y texto de consentimiento separado para adjuntos | Legal China + founder |
| [`runbook-brecha.md`](runbook-brecha.md) | Qué hacer las primeras horas. **Se llena antes de necesitarlo** | Humano |

## Cómo se regenera

```bash
/revisar-datos-ve
```

La skill vive en [`.claude/skills/revisar-datos-ve/`](../../../.claude/skills/revisar-datos-ve/)
— fork MIT de Carlos Domínguez re-anclado a Venezuela y China. Es **advisory**:
solo responde `ENCONTRADO`, `CORRECTO` o `NO VERIFICABLE`, y nada entra al informe
sin `archivo:línea`.

## El marco, en una línea

**Venezuela no tiene ley especial de datos personales**, pero sí doctrina
vinculante: CRBV arts. 28 y 60, Sala Constitucional del TSJ (332/2001 y
759/2025), Ley Especial contra los Delitos Informáticos (arts. 20-22, **penal**) y
Ley sobre Mensajes de Datos y Firmas Electrónicas. **PIPL de China** aplica al
equipo de Yiwu. RGPD y Chile 21.719 son **referencia, no obligación**.

No hay autoridad administrativa ni multa: el riesgo es una **acción de habeas
data** en el juzgado del domicilio del titular, y responsabilidad **penal** por
revelación indebida.

## Los tres primeros movimientos

1. ⭐ **Sellar el contenido de `legal_docs`** (hallazgo H-1) — barato, sin PSC, y
   es el que más riesgo quita.
2. **El mapa de borrado** (H-3) — sin él, cualquier botón de "eliminar" vuelve a
   mentir.
3. **El aviso al receptor del POD** (H-6) — condición para poder ampliar la
   captura, no un extra.

---

*Nada de esto es asesoría legal.*
