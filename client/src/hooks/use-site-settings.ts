import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_SITE_SETTINGS,
  SiteSettingsSchema,
  type SiteSettingsData,
} from "@shared/site-settings";

export function useSiteSettings() {
  const query = useQuery<SiteSettingsData>({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const response = await fetch("/api/site-settings");
      if (!response.ok) {
        return DEFAULT_SITE_SETTINGS;
      }

      const payload = await response.json();
      return SiteSettingsSchema.parse(payload.settings);
    },
  });

  return {
    ...query,
    settings: query.data ?? DEFAULT_SITE_SETTINGS,
  };
}
