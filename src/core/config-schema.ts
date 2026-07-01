import { z } from "zod";
import type { PluginConfig } from "./types";

// zod mirror of the JSON schema in the requirement doc (section 5).

const formatSchema = z.object({
  dateTimeFormat: z.enum(["YYYY-MM-DD HH:mm", "YYYY/MM/DD HH:mm"]),
  thousandsSeparator: z.boolean(),
  emptyValue: z.enum(["", "-"]),
});

const profileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(30),
  target: z.enum(["detail", "index", "both"]),
  fieldCodes: z.array(z.string()).min(1),
  format: formatSchema,
});

export const configSchema = z
  .object({
    version: z.literal(1),
    settings: z.object({
      defaultProfileId: z.string(),
      maxRecords: z.number().int().min(1).max(5000),
      profiles: z.array(profileSchema).min(1).max(10),
    }),
  })
  .superRefine((cfg, ctx) => {
    const ids = cfg.settings.profiles.map((p) => p.id);
    if (!ids.includes(cfg.settings.defaultProfileId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "defaultProfileId must match one of the profile ids",
        path: ["settings", "defaultProfileId"],
      });
    }
    const names = cfg.settings.profiles.map((p) => p.name);
    if (new Set(names).size !== names.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "profile names must be unique",
        path: ["settings", "profiles"],
      });
    }
  });

export type ParseResult = { ok: true; config: PluginConfig } | { ok: false; error: string };

// Parse a raw config value (already JSON-parsed) without throwing.
export function parseConfig(raw: unknown): ParseResult {
  const result = configSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, config: result.data as PluginConfig };
  }
  const first = result.error.issues[0];
  return {
    ok: false,
    error: first ? `${first.path.join(".")}: ${first.message}` : "invalid config",
  };
}

// Parse the string stored by kintone.plugin.app.getConfig()["config"].
// Returns null (never throws) when the string is absent or malformed, so the
// record screen is never broken by a bad config (common spec, EC handling).
export function parseConfigString(raw: string | undefined | null): PluginConfig | null {
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = parseConfig(json);
  return parsed.ok ? parsed.config : null;
}

export function defaultConfig(): PluginConfig {
  const id = "default";
  return {
    version: 1,
    settings: {
      defaultProfileId: id,
      maxRecords: 500,
      profiles: [
        {
          id,
          name: "標準",
          target: "both",
          fieldCodes: [],
          format: {
            dateTimeFormat: "YYYY-MM-DD HH:mm",
            thousandsSeparator: false,
            emptyValue: "",
          },
        },
      ],
    },
  };
}
