# Reconciliación de specs · puerta pública y guía Alibaba

Fecha: 2026-09-04

Alcance: SDD-0264 y SDD-0276

Fuera de alcance: Cloud, datos reales, cuentas externas, push, `main`, despliegue
y limpieza

## Inventario corregido

El texto operativo decía «94 specs no cerradas», pero el inventario actual tiene
405 specs reales: 299 `done`, una `superseded` y 105 abiertas antes de este
slice. El archivo `_template/spec.md` no es una spec y se excluye del conteo.

Después de este cierre quedan 301 `done`, una `superseded` y 103 abiertas:
88 `in-progress`, ocho `proposed`, cuatro `approved` y tres `draft`.

## SDD-0264 · guía Alibaba

- Contenida en `origin/main` y sin delta de producto contra esa referencia.
- La fuente central y los seis consumidores conservan Jinhua como Ciudad, Yiwu
  como Distrito, las dos líneas y la cadena de autollenado completa.
- Navegador de producción local abrió `/faq`, desplegó la pregunta y mostró los
  dos pasos, la advertencia de Shipping Mark y los valores CJK correctos.
- No se accedió al formulario real ni a una cuenta Alibaba; la medición de 2026-08-14
  se conserva como procedencia, no se presenta como una comprobación nueva.

## SDD-0276 · puerta única

- Contenida en `origin/main`; 34/34 pruebas focales aprobadas.
- `/entrar` muestra «Ingresar a mi portal» y «Crear mi cuenta y Shipping Mark».
- El enlace legado conserva el query y responde 308 permanente. La spec decía
  301 en tres lugares aunque su prueba ya documentaba y exigía 308; se reconcilió.
- La home conserva el CTA sin scroll horizontal a 320, 375, 440 y 1024 px; el
  wordmark reaparece en 440 px. Consola: 0 errores y 0 warnings.

## Gates compartidos

- Build de producción: 158 rutas.
- Suite unitaria completa: 7.308/7.308 en 578 archivos.
- TypeScript, lint, docs, gobernanza y componentes: correctos en el mismo HEAD.

## Estado

- SDD-0264: `done` con evidencia local y en `origin/main`.
- SDD-0276: `done` con evidencia local y en `origin/main`.
- Reconciliación amplia: 2/105 cerradas en este corte; 103 continúan abiertas.
- Checklist general: se mantiene en 59/106 (55,7 %), porque esta casilla agrupa
  todo el inventario y no se fracciona para inflar el porcentaje.
