/**
 * SDD-0704 · D-5 de Sam (2026-11-21): «Pantalla IA: opción A, pedir la contraseña otra vez». Lo que permite gastar
 * más se confirma con la contraseña: el servidor vuelve a autenticar y la base acepta esa autenticación durante 5
 * minutos. La contraseña solo viaja en este formulario: no se guarda, no se registra y no vuelve a la página.
 */
export function CampoContrasena({ id }: { id: string }) {
  return (
    <>
      <label className="studio-label" htmlFor={id}>
        Tu contraseña (solo si el cambio permite gastar más)
      </label>
      <input id={id} name="contrasena" type="password" className="studio-input" autoComplete="current-password" aria-describedby={`${id}-ayuda`} />
      <p id={`${id}-ayuda`} style={{ font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
        Para bajar el gasto no hace falta. Si la escribes, vale 5 minutos.
      </p>
    </>
  );
}
