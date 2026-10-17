import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Layout raíz del back de contenido (`/back/*`).
 *
 * Solo metadata: TODO `/back` es noindex — el login y el panel del equipo no
 * son para buscadores. Mismo patrón que `app/studio/layout.tsx` (SDD-0512).
 * Sin este archivo, `/back/login` heredaba el `index, follow` de
 * `app/layout.tsx`: ni `(auth)` ni `(app)` declaraban `robots`, y la página de
 * login es un client component, que no puede exportar `metadata`.
 *
 * Una página del back que declare su propio `robots` lo reemplaza entero: no
 * lo declares ahí (`app/__tests__/back-noindex.test.ts` lo detecta).
 *
 * `/back` NO va al Disallow de `app/robots.ts`: con el rastreo bloqueado, Google
 * no lee este noindex y una URL que ya conocía queda indexada «URL-only» (mismo
 * criterio que `/track/`). El guard de sesión vive en `(app)/layout.tsx`.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function BackRootLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
