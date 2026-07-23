import { expect, test, type Page } from "@playwright/test";
import {
  SDD_0168_FIXTURE,
  createE2EAdminClient,
  loadE2EEnvironment,
} from "../scripts/e2e/sdd-0168-fixture";

const REQUIRED_ENV = [
  "BASE_URL",
  "E2E_SUPABASE_PROJECT_REF",
  "E2E_SUPABASE_URL",
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
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /INGRESAR/ }).click();
  await expect(page).toHaveURL(
    new RegExp(`/studio/tracking/${SDD_0168_FIXTURE.shipmentId}`),
  );
}

test.describe("SDD-0168 · permanencia del ciclo de comentarios", () => {
  test.setTimeout(90_000);

  test.skip(
    REQUIRED_ENV.some((name) => !process.env[name]?.trim()),
    `Requiere ${REQUIRED_ENV.join(", ")} contra un Preview aislado.`,
  );

  test("crear → eliminar → deshacer → eliminar → restaurar conserva relaciones y auditoría", async ({
    page,
  }) => {
    const environment = loadE2EEnvironment();
    const admin = createE2EAdminClient(environment);
    const fixture = SDD_0168_FIXTURE;
    const browserErrors: string[] = [];
    const monitoredOrigins = new Set([
      new URL(process.env.BASE_URL!).origin,
      new URL(environment.supabaseUrl).origin,
    ]);

    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") {
        browserErrors.push(`console: ${message.text()}`);
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
      const requestUrl = new URL(request.url());
      if (monitoredOrigins.has(requestUrl.origin)) {
        browserErrors.push(
          `requestfailed: ${request.method()} ${requestUrl.pathname} · ${
            request.failure()?.errorText ?? "sin detalle"
          }`,
        );
      }
    });

    const { data: usersData, error: usersError } =
      await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (usersError) throw usersError;
    const adminUser = usersData.users.find(
      (user) => user.email === fixture.adminEmail,
    );
    const mentionedUser = usersData.users.find(
      (user) => user.email === fixture.mentionedEmail,
    );
    expect(adminUser, "El seed debe crear el administrador E2E").toBeTruthy();
    expect(mentionedUser, "El seed debe crear el usuario mencionado E2E").toBeTruthy();

    await login(page, fixture.adminEmail, environment.password);

    const composer = page.getByPlaceholder(
      "Comenta en este embarque… usa @ para mencionar",
    );
    await expect(composer).toBeVisible();
    await composer.fill(fixture.commentBody);
    await page.getByRole("button", { name: "Comentar" }).click();

    const body = page.getByText(fixture.commentBody, { exact: true });
    await expect(body).toBeVisible();

    const { data: commentData, error: commentError } = await admin
      .from("comments")
      .select(
        "id,tenant_id,entity_type,entity_id,entity_code,author_id,body,created_at,deleted_at",
      )
      .eq("tenant_id", fixture.tenantId)
      .eq("entity_type", "shipment")
      .eq("entity_id", fixture.shipmentId)
      .eq("body", fixture.commentBody)
      .single();
    const comment = requireData(
      commentData as CommentSnapshot | null,
      commentError,
      "Comentario creado",
    );
    expect(comment).toMatchObject({
      tenant_id: fixture.tenantId,
      entity_type: "shipment",
      entity_id: fixture.shipmentId,
      entity_code: fixture.shipmentCode,
      author_id: adminUser!.id,
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
          .eq("mentioned_user_id", mentionedUser!.id)
          .maybeSingle();
        if (error) throw error;
        return data as MentionSnapshot | null;
      })
      .not.toBeNull();

    const { data: mentionData, error: mentionError } = await admin
      .from("comment_mentions")
      .select("id,comment_id,tenant_id,mentioned_user_id,read_at,created_at")
      .eq("comment_id", comment.id)
      .eq("mentioned_user_id", mentionedUser!.id)
      .single();
    const mention = requireData(
      mentionData as MentionSnapshot | null,
      mentionError,
      "Mención creada",
    );
    expect(mention).toMatchObject({
      comment_id: comment.id,
      tenant_id: fixture.tenantId,
      mentioned_user_id: mentionedUser!.id,
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
          .eq("user_id", adminUser!.id)
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
      .eq("user_id", adminUser!.id)
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
    await page.getByRole("button", { name: "Deshacer" }).click();
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

    const { data: auditData, error: auditError } = await admin
      .from("entity_audit_log")
      .select("event_type,actor_id,payload,occurred_at")
      .eq("tenant_id", fixture.tenantId)
      .eq("entity_type", "comment")
      .eq("entity_id", comment.id)
      .order("occurred_at", { ascending: true });
    if (auditError) throw auditError;
    expect(
      (auditData ?? []).map((row) => ({
        eventType: row.event_type,
        actorId: row.actor_id,
        action: (row.payload as { action?: string }).action,
      })),
    ).toEqual([
      {
        eventType: "comment_soft_deleted",
        actorId: adminUser!.id,
        action: "self_delete",
      },
      {
        eventType: "comment_restored",
        actorId: adminUser!.id,
        action: "undo",
      },
      {
        eventType: "comment_soft_deleted",
        actorId: adminUser!.id,
        action: "self_delete",
      },
      {
        eventType: "comment_restored",
        actorId: adminUser!.id,
        action: "ordinary_restore",
      },
    ]);

    expect(browserErrors).toEqual([]);
  });
});
