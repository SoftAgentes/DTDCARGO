# Handoff · SDD-0705 v0.5 · Cantidades en letras y promesas en la revisión automática

**Pedido:** el Director DTD, a partir de la revisión de la #771 (22/11/2026). Los números en letras de cuarenta en
adelante y algunas promesas sin cifra pasaban por `revisarRespuesta` sin escalar.

## Qué cambia

- `lib/studio/oficina/eval-automatico.ts`, solo `PATRONES`:
  - cantidades en letras de veinte para arriba, solas o con unidad (decenas hasta noventa, «cien», «ciento», los
    cientos, «mil», «millón»);
  - «un», «una», «once» y «doce» antes de día, hora, semana o mes;
  - promesas: «te aseguro», «le aseguro», «seguro llega», «sin falta» y «llega antes».
- `aviso-guion-servicio.test.ts`: mutantes en letras («cuarenta días», «entre sesenta y noventa días», «cuesta
  sesenta», «doscientos», «en una semana», «en un mes») y promesas («te aseguro que llega antes», «sin falta»).
  Todos escalan con `dato_inventado`. Los guiones copiados tal cual siguen pasando.

## Lo que NO hace

No cambia los guiones, el despachador ni las migraciones. No toca producción.
