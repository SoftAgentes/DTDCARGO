"use client";

/**
 * Editor de un CURSO (SDD-0093, Feature A). Drawer ancho que muestra los datos
 * del curso (con botón Editar → CourseDrawer) y su árbol de módulos → lecciones,
 * con "+ Módulo", "+ Lección" y "Editar" por fila. Carga el árbol (incl.
 * borradores) al abrir vía `loadCourseEditorTreeAction`. Solo tokens var(--*).
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  courseStatusLabel,
  courseStatusTone,
  lessonKindLabel,
  lessonStatusLabel,
  lessonWidgetLabel,
  tierLabel,
  type AcademyLesson,
  type AcademyModule,
  type CourseTree,
  type ModuleWithLessons,
} from "@/lib/studio/academia/types";
import { loadCourseEditorTreeAction } from "../actions";
import { CourseDrawer } from "./CourseDrawer";
import { ModuleDrawer } from "./ModuleDrawer";
import { LessonDrawer } from "./LessonDrawer";

export function CourseEditorDrawer({
  courseId,
  onClose,
}: {
  courseId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tree, setTree] = useState<CourseTree | null>(null);
  const [loading, setLoading] = useState(true);

  // Sub-drawers (uno a la vez por encima del editor).
  const [editCourse, setEditCourse] = useState(false);
  const [moduleDraft, setModuleDraft] = useState<
    { module?: AcademyModule; defaultSort: number } | null
  >(null);
  const [lessonDraft, setLessonDraft] = useState<
    { lesson?: AcademyLesson; defaultModuleId?: string; defaultSort: number } | null
  >(null);

  // Recarga el árbol. `showSpinner` evita el setState SÍNCRONO al montar (el
  // efecto solo dispara la promesa; el setState ocurre dentro del await).
  const reload = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      const t = await loadCourseEditorTreeAction(courseId);
      setTree(t);
      setLoading(false);
    },
    [courseId],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      const t = await loadCourseEditorTreeAction(courseId);
      if (!alive) return;
      setTree(t);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [courseId]);

  // Cuando se cierra un sub-drawer tras un cambio, recargamos el árbol.
  const afterChange = useCallback(() => {
    void reload();
    router.refresh();
  }, [reload, router]);

  const allModules: AcademyModule[] = (tree?.modules ?? []).map((m) => ({
    id: m.id,
    tenant_id: m.tenant_id,
    course_id: m.course_id,
    title: m.title,
    sort: m.sort,
  }));

  const nextModuleSort = allModules.length
    ? Math.max(...allModules.map((m) => m.sort)) + 1
    : 0;

  return (
    <DrawerShell
      title={tree?.title ?? "Curso"}
      subtitle={
        tree
          ? `${tierLabel(tree.tier)} · ${tree.slug}`
          : "Cargando contenido del curso…"
      }
      onClose={onClose}
      pending={false}
      width={720}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {loading && (
          <p style={{ font: "500 13px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
            Cargando…
          </p>
        )}

        {!loading && !tree && (
          <p style={{ font: "500 13px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
            No se pudo cargar el curso.
          </p>
        )}

        {!loading && tree && (
          <>
            {/* Cabecera del curso */}
            <section
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)",
                padding: "16px 18px",
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <Badge tone="wine" size="sm">
                    {tierLabel(tree.tier)}
                  </Badge>
                  <Badge tone={courseStatusTone(tree.status)} size="sm" dot>
                    {courseStatusLabel(tree.status)}
                  </Badge>
                  {tree.level && (
                    <Badge tone="neutral" size="sm">
                      {tree.level}
                    </Badge>
                  )}
                </div>
                {tree.summary && (
                  <p
                    style={{
                      font: "500 12.5px/1.5 var(--f-sans)",
                      color: "var(--ink-soft)",
                      margin: 0,
                    }}
                  >
                    {tree.summary}
                  </p>
                )}
                <p
                  style={{
                    font: "500 11px/1.4 var(--f-sans)",
                    color: "var(--ink-soft)",
                    margin: "8px 0 0",
                  }}
                >
                  El precio se gestiona en Servicios (Administración).
                </p>
              </div>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={() => setEditCourse(true)}
                style={{ flexShrink: 0 }}
              >
                Editar curso
              </button>
            </section>

            {/* Módulos + lecciones */}
            <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div className="studio-eyebrow">
                  Módulos · {tree.modules.length}
                </div>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  onClick={() => setModuleDraft({ defaultSort: nextModuleSort })}
                >
                  + Módulo
                </button>
              </div>

              {tree.modules.length === 0 ? (
                <p
                  style={{
                    font: "500 12.5px/1.5 var(--f-sans)",
                    color: "var(--ink-soft)",
                    padding: "8px 0",
                  }}
                >
                  Aún no hay módulos. Crea el primero con “+ Módulo”.
                </p>
              ) : (
                tree.modules.map((m) => (
                  <ModuleBlock
                    key={m.id}
                    module={m}
                    onEditModule={() =>
                      setModuleDraft({ module: m, defaultSort: m.sort })
                    }
                    onNewLesson={() =>
                      setLessonDraft({
                        defaultModuleId: m.id,
                        defaultSort: m.lessons.length
                          ? Math.max(...m.lessons.map((l) => l.sort)) + 1
                          : 0,
                      })
                    }
                    onEditLesson={(l) =>
                      setLessonDraft({ lesson: l, defaultSort: l.sort })
                    }
                  />
                ))
              )}
            </section>
          </>
        )}
      </div>

      {editCourse && tree && (
        <CourseDrawer
          course={tree}
          onClose={() => {
            setEditCourse(false);
            afterChange();
          }}
        />
      )}
      {moduleDraft && tree && (
        <ModuleDrawer
          courseId={tree.id}
          courseTitle={tree.title}
          module={moduleDraft.module}
          defaultSort={moduleDraft.defaultSort}
          onClose={() => {
            setModuleDraft(null);
            afterChange();
          }}
        />
      )}
      {lessonDraft && tree && (
        <LessonDrawer
          courseId={tree.id}
          modules={allModules}
          lesson={lessonDraft.lesson}
          defaultModuleId={lessonDraft.defaultModuleId}
          defaultSort={lessonDraft.defaultSort}
          onClose={() => {
            setLessonDraft(null);
            afterChange();
          }}
        />
      )}
    </DrawerShell>
  );
}

function ModuleBlock({
  module,
  onEditModule,
  onNewLesson,
  onEditLesson,
}: {
  module: ModuleWithLessons;
  onEditModule: () => void;
  onNewLesson: () => void;
  onEditLesson: (lesson: AcademyLesson) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        background: "var(--bg-surface)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          background: "var(--bg-elevated)",
          borderBottom: module.lessons.length ? "1px solid var(--border)" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <code
            style={{ font: "700 10px/1 var(--f-mono)", color: "var(--ink-soft)" }}
          >
            #{module.sort}
          </code>
          <span
            style={{
              font: "700 13px/1.3 var(--f-sans)",
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {module.title}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={onEditModule}
          >
            Editar
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={onNewLesson}
          >
            + Lección
          </button>
        </div>
      </div>

      {module.lessons.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {module.lessons.map((l, i) => (
            <li
              key={l.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
              }}
            >
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <span
                  style={{
                    font: "600 12.5px/1.3 var(--f-sans)",
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {l.title}
                </span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <Badge tone="neutral" size="sm">
                    {lessonKindLabel(l.kind)}
                  </Badge>
                  <Badge
                    tone={l.status === "publicado" ? "success" : "neutral"}
                    size="sm"
                    dot
                  >
                    {lessonStatusLabel(l.status)}
                  </Badge>
                  {l.free_preview && (
                    <Badge tone="wine" size="sm">
                      Preview gratis
                    </Badge>
                  )}
                  {l.widget && (
                    <span
                      style={{
                        font: "500 10.5px/1 var(--f-sans)",
                        color: "var(--ink-soft)",
                      }}
                    >
                      {lessonWidgetLabel(l.widget)}
                    </span>
                  )}
                  {l.duration_min != null && (
                    <code
                      style={{ font: "500 10.5px/1 var(--f-mono)", color: "var(--ink-soft)" }}
                    >
                      {l.duration_min} min
                    </code>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={() => onEditLesson(l)}
                style={{ flexShrink: 0 }}
              >
                Editar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
