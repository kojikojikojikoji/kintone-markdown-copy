import { describe, expect, it } from "vitest";
import { defaultConfig, parseConfig, parseConfigString } from "../../src/core/config-schema";

function validConfig() {
  return {
    version: 1,
    settings: {
      defaultProfileId: "p1",
      maxRecords: 500,
      profiles: [
        {
          id: "p1",
          name: "標準",
          target: "both",
          fieldCodes: ["a"],
          format: { dateTimeFormat: "YYYY-MM-DD HH:mm", thousandsSeparator: false, emptyValue: "" },
        },
      ],
    },
  };
}

describe("config schema", () => {
  it("accepts a valid config", () => {
    const result = parseConfig(validConfig());
    expect(result.ok).toBe(true);
  });

  it("TC-31: rejects a wrong version without throwing", () => {
    const bad = validConfig();
    (bad as any).version = 2;
    const result = parseConfig(bad);
    expect(result.ok).toBe(false);
  });

  it("TC-31: rejects an invalid target enum without throwing", () => {
    const bad = validConfig();
    (bad.settings.profiles[0] as any).target = "everywhere";
    const result = parseConfig(bad);
    expect(result.ok).toBe(false);
  });

  it("rejects a defaultProfileId that matches no profile", () => {
    const bad = validConfig();
    bad.settings.defaultProfileId = "missing";
    expect(parseConfig(bad).ok).toBe(false);
  });

  it("rejects duplicate profile names", () => {
    const bad = validConfig();
    bad.settings.profiles.push({ ...bad.settings.profiles[0], id: "p2" });
    expect(parseConfig(bad).ok).toBe(false);
  });

  it("rejects maxRecords out of range", () => {
    const bad = validConfig();
    bad.settings.maxRecords = 6000;
    expect(parseConfig(bad).ok).toBe(false);
  });

  it("parseConfigString returns null for malformed JSON, never throws", () => {
    expect(parseConfigString("{not json")).toBeNull();
    expect(parseConfigString(undefined)).toBeNull();
    expect(parseConfigString("")).toBeNull();
  });

  it("parseConfigString parses a valid stored string", () => {
    const cfg = parseConfigString(JSON.stringify(validConfig()));
    expect(cfg?.settings.profiles[0].name).toBe("標準");
  });

  it("defaultConfig is itself valid", () => {
    // The starter profile has no fields yet, which the app treats as unsaved,
    // but the shape must still parse for round-tripping.
    const cfg = defaultConfig();
    expect(cfg.settings.profiles[0].fieldCodes).toEqual([]);
  });
});
