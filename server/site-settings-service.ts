import { desc, eq, sql } from "drizzle-orm";
import {
  contactMessages,
  siteSettings,
  type ContactMessage,
  type InsertContactMessage,
  type SiteSettings,
} from "@shared/schema";
import {
  ContactMessageInputSchema,
  DEFAULT_SITE_SETTINGS,
  SiteSettingsSchema,
  UpdateSiteSettingsSchema,
  type ContactMessageInput,
  type SiteSettingsData,
} from "@shared/site-settings";
import { db } from "./db";

const SETTINGS_ID = "main";

const getPgErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) return undefined;
  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === "string" ? maybeCode : undefined;
};

const isMissingRelationError = (error: unknown) => getPgErrorCode(error) === "42P01";

const toSiteSettingsData = (row: SiteSettings): SiteSettingsData => ({
  siteName: row.siteName,
  heroSubtitle: row.heroSubtitle,
  heroDescription: row.heroDescription,
  aboutTitle: row.aboutTitle,
  aboutLines: row.aboutLines,
  contactTitle: row.contactTitle,
  contactSubtitle: row.contactSubtitle,
  contactNameLabel: row.contactNameLabel,
  contactEmailLabel: row.contactEmailLabel,
  contactMessageLabel: row.contactMessageLabel,
  contactNamePlaceholder: row.contactNamePlaceholder,
  contactEmailPlaceholder: row.contactEmailPlaceholder,
  contactMessagePlaceholder: row.contactMessagePlaceholder,
  contactButtonLabel: row.contactButtonLabel,
  contactSuccessTitle: row.contactSuccessTitle,
  contactSuccessDescription: row.contactSuccessDescription,
  contactDestination: row.contactDestination,
  footerGithubUrl: row.footerGithubUrl,
  footerDiscordUrl: row.footerDiscordUrl,
  footerYoutubeUrl: row.footerYoutubeUrl,
  footerEmail: row.footerEmail,
  footerCopyright: row.footerCopyright,
  footerDevelopedBy: row.footerDevelopedBy,
});

const insertDefaultSettings = async (): Promise<SiteSettingsData> => {
  const [created] = await db
    .insert(siteSettings)
    .values({
      id: SETTINGS_ID,
      ...DEFAULT_SITE_SETTINGS,
    })
    .returning();

  return toSiteSettingsData(created);
};

export async function getSiteSettingsData(): Promise<SiteSettingsData> {
  try {
    const [existing] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, SETTINGS_ID));

    if (!existing) {
      return insertDefaultSettings();
    }

    return SiteSettingsSchema.parse(toSiteSettingsData(existing));
  } catch (error) {
    if (isMissingRelationError(error)) {
      return DEFAULT_SITE_SETTINGS;
    }
    throw error;
  }
}

export async function updateSiteSettingsData(
  payload: Partial<SiteSettingsData>,
): Promise<SiteSettingsData> {
  const parsedPatch = UpdateSiteSettingsSchema.parse(payload);
  const current = await getSiteSettingsData();
  const next = SiteSettingsSchema.parse({
    ...current,
    ...parsedPatch,
  });

  try {
    const [updated] = await db
      .update(siteSettings)
      .set({
        ...next,
        updatedAt: sql`now()`,
      })
      .where(eq(siteSettings.id, SETTINGS_ID))
      .returning();

    return SiteSettingsSchema.parse(toSiteSettingsData(updated));
  } catch (error) {
    if (isMissingRelationError(error)) {
      throw new Error("DB_MISSING_SITE_TABLE");
    }
    throw error;
  }
}

export async function createContactMessage(
  payload: ContactMessageInput,
): Promise<ContactMessage> {
  const parsed = ContactMessageInputSchema.parse(payload);
  const insertPayload: InsertContactMessage = {
    name: parsed.name,
    email: parsed.email,
    message: parsed.message,
  };

  try {
    const [created] = await db.insert(contactMessages).values(insertPayload).returning();
    return created;
  } catch (error) {
    if (isMissingRelationError(error)) {
      throw new Error("DB_MISSING_CONTACT_TABLE");
    }
    throw error;
  }
}

export async function getContactMessages(limit = 200): Promise<ContactMessage[]> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, limit)) : 200;

  try {
    return db
      .select()
      .from(contactMessages)
      .orderBy(desc(contactMessages.createdAt))
      .limit(safeLimit);
  } catch (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }
}
