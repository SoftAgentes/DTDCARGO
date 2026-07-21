# UPL-01 v0.1 — Carga de archivos e imágenes

| Control | Valor |
|---|---|
| Estado | redactada — pendiente de aprobación |
| Depende de | SGE-00, LOD-01, ERR-01, MP-01 y AUD-01 |

## Contrato

- Selector y dropzone declaran tipos, tamaño máximo, cantidad y propósito antes de elegir.
- Drag/drop siempre tiene botón equivalente de selección.
- Validación inicial ocurre antes de subir; el servidor vuelve a validar tipo,
  tamaño, tenant y permiso sin confiar en extensión/MIME del cliente.
- La vista previa conserva proporción, nombre, tamaño y estado; no recorta evidencia sin advertir.
- Cada archivo muestra queued, uploading, processing, ready, failed o removed.
- Progreso es real cuando el transporte lo permite; reintento no duplica el archivo.
- Cancelar distingue detener upload de eliminar un archivo ya persistido.
- Storage usa ruta por tenant/entidad/ID y URL firmada; nunca binarios runtime en git.
- Reemplazar/versionar/eliminar se decide con MP-01 y se audita cuando el archivo es evidencia.
- Mensajes no exponen ruta interna, token, bucket privado ni respuesta cruda.
- Imágenes con PII/metadatos reciben tratamiento definido por la política del módulo.

## Gate

Probar tipo/tamaño inválido, archivo vacío/corrupto, múltiples, red lenta,
cancelación, reintento, duplicado, procesamiento server-side, permiso, aislamiento
tenant, móvil, teclado y lector de pantalla.
