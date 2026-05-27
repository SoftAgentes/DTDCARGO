# 📦 nuevo/ · Buzón de trabajo v1.1+

Esta carpeta contiene **TODO** lo que se cree o modifique después del handoff a Claude Code en mayo 2026.

## ¿Por qué existe?

El proyecto DTD-Cargo v1.0 vive en la raíz (`DTD Studio · ERP.html`, `erp/`, `operario/`, `portal/`, etc.). Esos archivos están **congelados** como referencia.

Cuando se trabaja en un entorno distinto (Claude Code, o sesiones nuevas de Claude Design), los archivos nuevos vienen acá para que sea trivial distinguir qué es **v1.0** (raíz) de qué es **v1.1+** (esta carpeta). Esto evita que dos entornos editen los mismos archivos en paralelo y se pisen.

## Reglas

1. **Todo archivo nuevo va acá.** Aunque por convención "debería" ir a `erp/modules/<nombre>.jsx`, primero pasa por `nuevo/modules/<nombre>.jsx`. El usuario decide cuándo consolidar.

2. **Si hay que tocar un archivo viejo** (ej.: agregar un import en `DTD Studio · ERP.html`, sumar un ítem al sidebar de `shell.jsx`), se hace el cambio mínimo posible y se anota en `CHANGELOG.md` de esta carpeta: qué archivo, qué líneas, por qué.

3. **No duplicar archivos viejos acá.** Si un archivo de v1.0 no se modifica, no se copia. La raíz sigue siendo la fuente para todo lo que no aparezca acá.

4. **Convención de subcarpetas (espejo de la raíz):**
   ```
   nuevo/
   ├── README.md          ← este archivo
   ├── CHANGELOG.md       ← qué se hizo y qué archivos viejos se tocaron
   ├── modules/           ← módulos nuevos del ERP (se cargan desde DTD Studio · ERP.html)
   ├── pantallas/         ← HTMLs nuevos standalone (perfiles, vistas aisladas)
   ├── operario/          ← screens nuevos para apps móviles
   └── portal/            ← screens nuevos para el portal
   ```

## Consolidar a v1.0 (cuando una pantalla está aprobada)

Cuando una pantalla nueva está aprobada y estable, el usuario puede pedir mover el archivo a su ubicación "real" (de `nuevo/modules/foo.jsx` a `erp/modules/foo.jsx`). Eso es una acción explícita, no automática.

Después de mover, se anota en `CHANGELOG.md`: "consolidado a v1.0 el YYYY-MM-DD".
