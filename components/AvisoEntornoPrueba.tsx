import { resolveAppEnv, type EnvSource } from "@/lib/runtime/app-env";

/**
 * Aviso «Entorno de prueba» (SDD-0544 · D11 de la SDD-0540).
 *
 * Se monta una sola vez en el layout raíz, así que cubre el sitio público, el
 * Studio, el Portal y la PWA `/m`: todas esas rutas cuelgan de `app/layout.tsx`.
 * Sólo aparece con `APP_ENV=staging` (`lib/runtime/app-env.ts`); con
 * `production`, `preview` o `local` no deja nada en el HTML. Los Preview de
 * Vercel quedan afuera a propósito: escriben en la base de producción
 * (SDD-0540 §1.2) y un aviso de «prueba» ahí diría lo contrario.
 *
 * Es un componente de servidor: lee el entorno al renderizar. Las páginas que
 * Next prerenderiza en el build (la portada, los servicios) lo leen en ese
 * momento; por eso la imagen de prueba se construye con el build arg
 * `APP_ENV=staging` (`build-image-prueba.yml` → `Dockerfile`). Las rutas
 * dinámicas (Studio, Portal, `/m`) lo leen del `.env` del servidor.
 *
 * Fijo arriba y sin capturar clics (`pointer-events: none` en `globals.css`):
 * se ve sobre cualquier pantalla y no tapa ningún control. Estilos en
 * `.entorno-prueba` de `app/globals.css`.
 */
export function AvisoEntornoPrueba({ env }: { env?: EnvSource } = {}) {
  if (resolveAppEnv(env) !== "staging") return null;

  return (
    <div className="entorno-prueba" role="note" aria-label="Entorno de prueba" data-entorno-prueba="">
      <p className="entorno-prueba__etiqueta">
        <span>Entorno de prueba</span>
        <span className="entorno-prueba__detalle"> · No es el sitio real</span>
      </p>
    </div>
  );
}
