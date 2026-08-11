import { medusaFetch } from "@/lib/medusa";

// Mirrors apps/backend's src/modules/analytics-settings model.
export type AnalyticsSettings = {
  ga4MeasurementId: string | null;
  gtmContainerId: string | null;
  metaPixelId: string | null;
  clarityProjectId: string | null;
};

type MedusaAnalyticsSettings = {
  ga4_measurement_id: string | null;
  gtm_container_id: string | null;
  meta_pixel_id: string | null;
  clarity_project_id: string | null;
};

// Never throws — same defensive pattern as getSiteSettings/getPromoBanner.
export async function getAnalyticsSettings(): Promise<AnalyticsSettings | null> {
  try {
    const { settings } = await medusaFetch<{ settings: MedusaAnalyticsSettings | null }>(
      "/store/analytics-settings",
      { next: { revalidate: 30 } }
    );
    return settings
      ? {
          ga4MeasurementId: settings.ga4_measurement_id,
          gtmContainerId: settings.gtm_container_id,
          metaPixelId: settings.meta_pixel_id,
          clarityProjectId: settings.clarity_project_id,
        }
      : null;
  } catch {
    return null;
  }
}

export function hasAnyAnalyticsService(settings: AnalyticsSettings | null): boolean {
  if (!settings) return false;
  return Boolean(
    settings.ga4MeasurementId || settings.gtmContainerId || settings.metaPixelId || settings.clarityProjectId
  );
}
