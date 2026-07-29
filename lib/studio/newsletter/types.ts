export type NewsletterCampaignStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sending"
  | "sent"
  | "partial"
  | "failed"
  | "cancelled";

export type NewsletterCampaign = {
  id: string;
  tenant_id: string;
  internal_name: string;
  subject: string;
  preview_text: string;
  heading: string;
  body_text: string;
  cta_label: string | null;
  cta_url: string | null;
  status: NewsletterCampaignStatus;
  content_hash: string;
  approved_content_hash: string | null;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  approved_at: string | null;
  send_requested_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NewsletterCampaignInput = {
  id?: string;
  internalName: string;
  subject: string;
  previewText: string;
  heading: string;
  bodyText: string;
  ctaLabel: string;
  ctaUrl: string;
};

export type NewsletterActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  campaignId?: string;
};
