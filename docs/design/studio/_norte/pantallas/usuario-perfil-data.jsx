/* global React */
/* ── Perfil de usuario interno · datos ───────────────────────── */
/* Las definiciones (CORP_LINES, USER_PROFILES, PRESENCE) se movieron  */
/* a erp/data.jsx en v2.4 (fuente única · window.ERPData). Este archivo */
/* solo re-expone para no tocar usuario-perfil.jsx.                     */
const D_UP = window.ERPData;
window.UsuarioPerfil_DATA = { CORP_LINES: D_UP.CORP_LINES, USER_PROFILES: D_UP.USER_PROFILES, PRESENCE: D_UP.PRESENCE };
