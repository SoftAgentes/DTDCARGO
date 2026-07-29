# Copias corregidas V1 · control interno

**Fecha:** 2026-07-23  
**Método:** edición generativa de objeto preciso con el isólogo oficial como
referencia.  
**Estado:** candidatas de retoque; no autorizadas para publicación.

Los originales permanecen intactos. Estas copias corrigen identidad anterior y
datos sensibles, pero la edición generativa puede reconstruir detalles menores
de la escena. Antes de publicar se requiere comparación humana al 100 %, cierre
de permisos y aprobación editorial.

| Archivo | Corrección | SHA-256 | Resultado |
|---|---|---|---|
| `02-equipo-china-corregida.jpg` | Isólogos actuales; credenciales sin datos; pantalla sin texto. | `6d3bc26669b9fb4cbdfb1dfd9c50c440b0af9417d44c4ac7fce4932bab8d2ec1` | **Candidata visual**; permisos pendientes. |
| `04-cajas-identificadas-corregida-borrador.jpg` | Terceros, SKU y guías neutralizados. | `ff82860c66f1cd185ef55f21a67a8ed356d1feeece3d5ad767107a884114df7b` | **Borrador rechazado:** parte del wordmark de la cinta no quedó exacto. |
| `06-recibiendo-contenedor-corregida.jpg` | QR y URL eliminados; isólogos actuales en camisetas. | `f1b208a0bdfbe78a72af338f16889ace088169a33a4c6dad0a3c7ece9e9a4e09` | **Candidata visual**; permisos pendientes. |
| `07-equipo-oficina-corregida.jpg` | Isólogos actuales; pantallas y documentos neutralizados. | `1bdfea5f1973aad01398b254d6b740d330aa6a3d9f4084b73630ce4c9b3eec12` | **Candidata visual**; permisos pendientes. |
| `08-operacion-puerto-corregida.jpg` | Isólogos actuales en chalecos; identificadores neutralizados. | `8f02fb3a69cc33fc2d8e63a12d6a2302e4cc5f042388dca475ef3679a2a6796b` | **Candidata visual**; permisos de personal/recinto pendientes. |

## Fuente de marca

Todas las ediciones recibieron como referencia
`public/brand/dtdcargo-isologo-primary.png`. No se autorizó la generación de
wordmarks nuevos.

## Prompts de producción

Los prompts siguieron el patrón `precise-object-edit`:

1. cambiar únicamente logos, QR, URL, credenciales, pantallas o datos
   identificables señalados por la auditoría;
2. conservar personas, poses, cajas, contenedores, luz, encuadre y perspectiva;
3. usar el isólogo oficial como referencia exacta;
4. no agregar palabras, URLs, códigos, slogans ni marcas nuevas;
5. exportar una copia nueva sin sobrescribir el original.

## Bloqueos

- `01-mini-carga`: el intento de edición sobre gorra/uniforme de una persona
  identificable fue rechazado por el sistema. Requiere permiso y retoque manual
  no generativo.
- `04-cajas-identificadas`: necesita corrección manual determinística para
  preservar el wordmark exacto de la cinta.
- `03`, `05` y `09`: no necesitan retoque inmediato de datos; siguen
  bloqueadas por procedencia/licencia no documentada.
