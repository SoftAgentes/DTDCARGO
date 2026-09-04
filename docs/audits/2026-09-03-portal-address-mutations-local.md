# Auditoría local · mutaciones de direcciones Portal

Fecha: 2026-09-03

Alcance: SDD-0394, alta, edición y predeterminada con fixtures locales.

Fuera de alcance: direcciones reales, borrado 0427, Cloud, push, `main`,
despliegue y limpieza.

## Hallazgo reproducido

Las acciones derivaban un cliente canónico, pero perdían tenant y Shipping Mark
al llamar los helpers compartidos. En una sesión híbrida, una policy de equipo
podía ampliar un UPDATE por id si la aplicación no conservaba todo el principal.

La reproducción falló 8/8: cuatro contratos de acciones confirmaron acceso con
principal inválido y argumentos incompletos; cuatro contratos de helpers
confirmaron filtros/payload sin tenant + Shipping Mark.

## Correctivo local

- Alta, edición y predeterminada derivan el principal completo y cortan antes del
  dominio si no es válido.
- Portal pasa tenant + Shipping Mark; los helpers fijan además cliente e id según
  la mutación.
- El INSERT transporta tenant/Shipping Mark y conserva el trigger de sellado.
- Los callers Studio conservan las firmas compatibles sin scope Portal obligatorio.
- El borrado transaccional 0427/SDD-0377 no cambió.

## Evidencia ejecutada

- Reproducción RED: 8/8 fallos causales.
- Focales, helpers y borrado histórico: 23/23 verdes.
- Portal + contrato de helper: 896/896 en 69 archivos.
- Suite unitaria global: 7.249/7.249 en 569 archivos; lint completo verde.
- TypeScript y ESLint focal: verdes.
- Gates de documentación, numeración, gobernanza, componentes y diff: verdes.
- No se creó ni aplicó ninguna migración.

## Revisión focal de datos personales

- Datos ya existentes: línea, ciudad, estado, referencia y etiqueta de dirección,
  tenant, cliente y Shipping Mark. No se agregaron campos, categorías, terceros
  ni destinos.
- **CORRECTO:** las mutaciones cubiertas fijan el principal autenticado completo
  antes de consultar o escribir.
- **NO VERIFICABLE:** direcciones reales, retención, ejercicio operativo del
  borrado, backups y comportamiento de Cloud, porque no se consultaron datos
  alojados ni se ejecutó 0427.

Esta revisión no afirma cumplimiento legal ni operativo. Sólo demuestra el
correctivo y sus contratos locales dentro del alcance indicado.
