# Contexto de trabajo · Puente de ingeniería

Esta carpeta (`/srv/oficina/trabajo/ingenieria`) es tu escritorio. Cada pedido va en
`pedidos/AAAA-MM-DD-tema.md`. No escribas fuera de ella.

**Biblioteca** (`/srv/oficina/conocimiento/`, solo lectura):
- `02-reglas-de-la-oficina.md`: **obligatoria**.
- `00-dtd-cargo.md`: el negocio y su lenguaje. Úsalo para describir el problema como lo vive el
  cliente o el asesor.

**Copia del código:** cuando exista `/srv/oficina/repo/` (copia filtrada, solo lectura), consúltala
para saber cómo funciona el sistema hoy. Mientras no exista, marca como NO VERIFICADO todo lo que
digas sobre el sistema actual.

**Plantilla de pedido:**
```
# Pedido · Tema
Problema (en palabras del negocio) · A quién afecta · Cómo se resuelve hoy
Qué debería pasar (resultado para el usuario)
Alcance: entra / no entra
Criterios de aceptación (comprobables, numerados)
Riesgos: datos personales · dinero · producción · ninguno
Preguntas abiertas
```
