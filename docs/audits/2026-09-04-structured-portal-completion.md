# Cierre de observabilidad del Portal · SDD-0428 · evidencia local

Fecha: 2026-09-04

Alcance: progreso de Academia, límite de error e inventario completo de archivos
de producción bajo `app/portal` y `app/api/portal`

Fuera de alcance: progreso o datos reales, permisos, RLS, cambios visuales,
migraciones, Cloud, push, `main`, despliegues y limpieza

## Resultado

Academia y el límite de error usan ahora el logger canónico con operación, etapa
y error saneado. No registran curso, lección, cliente, tenant ni digest. El copy
visible cambió únicamente “Volvé” por “Vuelve”, conforme al tuteo venezolano; la
estructura y los estilos permanecen idénticos.

Se retiraron los tres `console.*` restantes. Un contrato recursivo cubre ahora
todos los archivos TypeScript de producción de las dos raíces del Portal y falla
si reaparece un log libre.

## Evidencia ejecutada

- RED: 4/4 fallos confirmaron dos módulos sin logger, residuo global y voseo.
- GREEN focal: 11/11 pruebas en dos archivos.
- Suite completa: 7.426/7.426 pruebas en 594 archivos.
- TypeScript y ESLint: correctos.
- Gobernanza: 28 políticas aprobadas y cápsula vigente.
- Componentes: cinco fuentes, agregado reproducible y cero rutas rotas.
- Build de producción: compilación y generación correctas, 158 rutas.
- Inventario Portal: cero `console.*` libre en archivos de producción.

El build mostró los avisos esperados por ausencia de variables públicas de
Supabase en este entorno local y terminó con código 0. Las pruebas usaron dobles
y no actualizaron progreso ni datos reales.

## Estado

- SDD-0428: **done local**.
- Logs retirados en este slice: **3**.
- Observabilidad libre en producción Portal: **0 residuos**.
- Checklist general: **59/106 (55,7 %)**; el subfrente Portal queda cerrado, pero
  la casilla agregada permanece abierta por módulos legacy fuera del Portal.
- Migraciones: ninguna nueva; 0401–0444 siguen preparadas y no aplicadas.
- Publicación/producción: **NO VERIFICABLE**; no hubo push ni despliegue.
