import { expect, test, type Page } from "@playwright/test";
import { listGovernedAuditEvents } from "../lib/studio/audit-queries";
import {
  SDD_0168_FIXTURE,
  createE2EAdminClient,
  createE2EAuthenticatedClient,
  loadE2EEnvironment,
} from "../scripts/e2e/sdd-0168-fixture";
import { esperarHidratado } from "./_helpers/hidratacion";

const REQUIRED_ENV = [
  "BASE_URL",
  "E2E_SUPABASE_PROJECT_REF",
  "E2E_SUPABASE_URL",
  "E2E_SUPABASE_ANON_KEY",
  "E2E_SUPABASE_SERVICE_ROLE_KEY",
  "STUDIO_E2E_PASSWORD",
] as const;

const vercelProtectionBypassSecret =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();

if (vercelProtectionBypassSecret) {
  test.use({
    extraHTTPHeaders: {
      "x-vercel-protection-bypass": vercelProtectionBypassSecret,
      "x-vercel-set-bypass-cookie": "true",
    },
  });
}

type CommentSnapshot = {
  id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  entity_code: string | null;
  author_id: string | null;
  body: string;
  created_at: string;
  deleted_at: string | null;
};

type MentionSnapshot = {
  id: string;
  comment_id: string;
  tenant_id: string;
  mentioned_user_id: string;
  read_at: string | null;
  created_at: string;
};

type ReactionSnapshot = {
  id: string;
  comment_id: string;
  tenant_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

function requireData<T>(
  data: T | null,
  error: { message: string } | null,
  context: string,
): T {
  if (error) throw new Error(`${context}: ${error.message}`);
  if (!data) throw new Error(`${context}: no retornó datos.`);
  return data;
}

async function login(page: Page, email: string, password: string) {
  await page.goto(
    `/studio/login?next=/studio/tracking/${SDD_0168_FIXTURE.shipmentId}`,
  );
  const emailInput = page.getByLabel("Email");
  await esperarHidratado(emailInput, "el campo Email del login");
  await emailInput.fill(email);
  await page.getByRole("textbox", { name: "Contraseña" }).fill(password);
  await page.getByRole("button", { name: /INGRESAR/ }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname ===
      `/studio/tracking/${SDD_0168_FIXTURE.shipmentId}`,
    { timeout: 20_000 },
  );
  await page.waitForLoadState("networkidle");
}

test.describe("SDD-0168 · permanencia del ciclo de comentarios", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    // El Studio mantiene la preferencia real del rail en localStorage. En los
    // proyectos móviles, el rail expandido consume casi todo el viewport y
    // tapa el compositor; este contrato aísla la interacción de comentarios.
    await page.addInitScript(() => {
      localStorage.setItem("studio_sidebar_collapsed", "1");
    });
  });

  test.skip(
    REQUIRED_ENV.some((name) => !process.env[name]?.trim()),
    `Requiere ${REQUIRED_ENV.join(", ")} contra un Preview aislado.`,
  );

  test("crear → eliminar → deshacer → eliminar → restaurar conserva relaciones y auditoría", async ({
    page,
  }) => {
    const environment = loadE2EEnvironment();
    const admin = createE2EAdminClient(environment);
    const auditReader = await createE2EAuthenticatedClient(environment);
    const fixture = SDD_0168_FIXTURE;
    const browserErrors: string[] = [];
    const monitoredOrigins = new Set([
      new URL(process.env.BASE_URL!).origin,
      new URL(environment.supabaseUrl).origin,
    ]);

    page.on("pageerror", (error) =>
      browserErrors.push(`pageerror: ${error.stack ?? error.message}`),
    );
    page.on("console", (message) => {
      if (message.type() === "error") {
        const text = message.text();
        if (
          text.includes("Content Security Policy") &&
          text.includes(
            "https://vercel.live/_next-live/feedback/feedback.js",
          )
        ) {
          return;
        }
        browserErrors.push(`console: ${text}`);
      }
    });
    page.on("response", (response) => {
      const responseUrl = new URL(response.url());
      if (
        monitoredOrigins.has(responseUrl.origin) &&
        response.status() >= 400
      ) {
        browserErrors.push(
          `response: ${response.status()} ${response.request().method()} ${
            responseUrl.pathname
          }`,
        );
      }
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText ?? "sin detalle";
      if (failure === "net::ERR_ABORTED") return;

      const requestUrl = new URL(request.url());
      if (monitoredOrigins.has(requestUrl.origin)) {
        browserErrors.push(
          `requestfailed: ${request.method()} ${requestUrl.pathname} · ${failure}`,
        );
      }
    });

    const { data: membershipsData, error: membershipsError } = await admin
      .from("user_tenants")
      .select("user_id,role")
      .eq("tenant_id", fixture.tenantId);
    if (membershipsError) throw membershipsError;
    const adminUserId = membershipsData?.find(
      (membership) => membership.role === "admin",
    )?.user_id as string | undefined;
    const mentionedUserId = membershipsData?.find(
      (membership) => membership.role === "operations",
    )?.user_id as string | undefined;
    expect(adminUserId, "El seed debe crear el administrador E2E").toBeTruthy();
    expect(
      mentionedUserId,
      "El seed debe crear el usuario mencionado E2E",
    ).toBeTruthy();

    await login(page, fixture.adminEmail, environment.password);
    await expect(
      page.getByRole("button", { name: "Expandir sidebar" }),
    ).toBeVisible();

    const composer = page.getByPlaceholder(
      "Comenta en este embarque… usa @ para mencionar",
    );
    await expect(composer).toBeEditable();
    await esperarHidratado(composer, "el composer de comentarios");
    const mentionToken = "@Mention E.";
    const commentPrefix = fixture.commentBody.replace(mentionToken, "");
    await composer.fill(commentPrefix);
    await page.getByRole("button", { name: "Mencionar" }).click();
    const mentionPicker = page.getByRole("listbox", { name: "Mencionar a" });
    await expect(mentionPicker).toBeVisible();
    await mentionPicker
      .getByRole("option")
      .filter({ hasText: "Mention E2E" })
      .click();
    await expect(composer).toHaveValue(`${fixture.commentBody} `);
    const submitComment = page.getByRole("button", {
      name: "Comentar",
      exact: true,
    });
    await expect(submitComment).toBeEnabled();
    await submitComment.click();

    const body = page.getByText(fixture.commentBody, { exact: true });
    await expect(body).toBeVisible();

    let polledComment: CommentSnapshot | null = null;
    await expect
      .poll(async () => {
        const { data, error } = await admin
          .from("comments")
          .select(
            "id,tenant_id,entity_type,entity_id,entity_code,author_id,body,created_at,deleted_at",
          )
          .eq("tenant_id", fixture.tenantId)
          .eq("entity_type", "shipment")
          .eq("entity_id", fixture.shipmentId)
          .eq("body", fixture.commentBody)
          .maybeSingle();
        if (error) throw error;
        polledComment = data as CommentSnapshot | null;
        return polledComment;
      })
      .not.toBeNull();
    const comment = requireData<CommentSnapshot>(
      polledComment,
      null,
      "Comentario creado",
    );
    expect(comment).toMatchObject({
      tenant_id: fixture.tenantId,
      entity_type: "shipment",
      entity_id: fixture.shipmentId,
      entity_code: fixture.shipmentCode,
      author_id: adminUserId,
      body: fixture.commentBody,
      deleted_at: null,
    });

    await expect
      .poll(async () => {
        const { data, error } = await admin
          .from("comment_mentions")
          .select(
            "id,comment_id,tenant_id,mentioned_user_id,read_at,created_at",
          )
          .eq("comment_id", comment.id)
          .eq("mentioned_user_id", mentionedUserId!)
          .maybeSingle();
        if (error) throw error;
        return data as MentionSnapshot | null;
      })
      .not.toBeNull();

    const { data: mentionData, error: mentionError } = await admin
      .from("comment_mentions")
      .select("id,comment_id,tenant_id,mentioned_user_id,read_at,created_at")
      .eq("comment_id", comment.id)
      .eq("mentioned_user_id", mentionedUserId!)
      .single();
    const mention = requireData(
      mentionData as MentionSnapshot | null,
      mentionError,
      "Mención creada",
    );
    expect(mention).toMatchObject({
      comment_id: comment.id,
      tenant_id: fixture.tenantId,
      mentioned_user_id: mentionedUserId,
      read_at: null,
    });

    const commentActions = body.locator(
      "xpath=ancestor::div[.//button[@aria-label='Eliminar comentario']][1]",
    );
    await commentActions.getByRole("button", { name: "Reaccionar" }).click();
    await commentActions.getByRole("button", { name: "👍", exact: true }).click();

    await expect
      .poll(async () => {
        const { data, error } = await admin
          .from("comment_reactions")
          .select("id,comment_id,tenant_id,user_id,emoji,created_at")
          .eq("comment_id", comment.id)
          .eq("user_id", adminUserId!)
          .eq("emoji", "👍")
          .maybeSingle();
        if (error) throw error;
        return data as ReactionSnapshot | null;
      })
      .not.toBeNull();

    const { data: reactionData, error: reactionError } = await admin
      .from("comment_reactions")
      .select("id,comment_id,tenant_id,user_id,emoji,created_at")
      .eq("comment_id", comment.id)
      .eq("user_id", adminUserId!)
      .eq("emoji", "👍")
      .single();
    const reaction = requireData(
      reactionData as ReactionSnapshot | null,
      reactionError,
      "Reacción creada",
    );

    await commentActions
      .getByRole("button", { name: "Eliminar comentario" })
      .click();
    const undo = page.getByRole("button", { name: "Deshacer" });
    await expect(
      undo,
      "La acción Deshacer debe existir durante la ventana inmediata del contrato",
    ).toBeVisible({ timeout: 15_000 });
    await undo.click();
    await expect(body).toBeVisible();

    await expect
      .poll(async () => {
        const { data, error } = await admin
          .from("comments")
          .select("deleted_at")
          .eq("id", comment.id)
          .single();
        if (error) throw error;
        return data.deleted_at;
      })
      .toBeNull();

    await body
      .locator("xpath=ancestor::div[.//button[@aria-label='Eliminar comentario']][1]")
      .getByRole("button", { name: "Eliminar comentario" })
      .click();
    await expect(body).toBeHidden();

    await page.getByRole("button", { name: "Comentarios eliminados" }).click();
    const deletedCard = page.locator("article").filter({
      hasText: fixture.commentBody,
    });
    await expect(deletedCard).toBeVisible();
    await deletedCard.getByRole("button", { name: "Restaurar" }).click();
    const restoreDialog = page.getByRole("dialog");
    await expect(restoreDialog).toBeVisible();
    await restoreDialog.getByRole("button", { name: "Restaurar" }).click();
    await expect(body).toBeVisible();

    await expect
      .poll(async () => {
        const { data, error } = await admin
          .from("comments")
          .select("deleted_at")
          .eq("id", comment.id)
          .single();
        if (error) throw error;
        return data.deleted_at;
      })
      .toBeNull();

    const { data: finalCommentData, error: finalCommentError } = await admin
      .from("comments")
      .select(
        "id,tenant_id,entity_type,entity_id,entity_code,author_id,body,created_at,deleted_at",
      )
      .eq("id", comment.id)
      .single();
    const finalComment = requireData(
      finalCommentData as CommentSnapshot | null,
      finalCommentError,
      "Comentario final",
    );
    expect(finalComment).toEqual({ ...comment, deleted_at: null });

    const { data: finalMentionData, error: finalMentionError } = await admin
      .from("comment_mentions")
      .select("id,comment_id,tenant_id,mentioned_user_id,read_at,created_at")
      .eq("id", mention.id)
      .single();
    expect(
      requireData(
        finalMentionData as MentionSnapshot | null,
        finalMentionError,
        "Mención final",
      ),
    ).toEqual(mention);

    const { data: finalReactionData, error: finalReactionError } = await admin
      .from("comment_reactions")
      .select("id,comment_id,tenant_id,user_id,emoji,created_at")
      .eq("id", reaction.id)
      .single();
    expect(
      requireData(
        finalReactionData as ReactionSnapshot | null,
        finalReactionError,
        "Reacción final",
      ),
    ).toEqual(reaction);

    let auditData: Awaited<
      ReturnType<typeof listGovernedAuditEvents>
    >["events"] = [];
    await expect
      .poll(async () => {
        const result = await listGovernedAuditEvents(auditReader, {
          entityType: "comment",
        });
        if (!result.ok) {
          throw new Error(`Viewer de auditoría falló cerrado: ${result.code}`);
        }
        auditData = result.events.filter(
          (event) => event.entityId === comment.id,
        );
        return auditData.length;
      })
      .toBe(4);
    expect(
      [...auditData].reverse().map((row) => ({
        eventType: row.eventType,
        actorId: row.actorId,
        action: row.summary?.action ?? null,
      })),
    ).toEqual([
      {
        eventType: "comment_soft_deleted",
        actorId: adminUserId,
        action: "self_delete",
      },
      {
        eventType: "comment_restored",
        actorId: adminUserId,
        action: "undo",
      },
      {
        eventType: "comment_soft_deleted",
        actorId: adminUserId,
        action: "self_delete",
      },
      {
        eventType: "comment_restored",
        actorId: adminUserId,
        action: "ordinary_restore",
      },
    ]);

    expect(browserErrors).toEqual([]);
  });
});
