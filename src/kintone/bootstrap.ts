// Event registration and per-screen wiring for the record screens.

import { parseConfigString } from "../core/config-schema";
import type { FieldMeta, KintoneRecord, PluginConfig, Profile, TargetScreen } from "../core/types";
import { assembleDetail, assembleIndex } from "./assemble";
import { detailHeaderSpace, indexHeaderSpace, mobileDetailHeaderSpace } from "./dom-map";
import { fetchFieldMetas } from "./form-fields";
import { loadSelection, selectionKey } from "./localstore";
import { mountCopyUI, type CopyController } from "./menu";
import { getClient } from "./rest";

let active: CopyController | null = null;
const formMetaCache = new Map<number, Promise<Map<string, FieldMeta>>>();

function pluginId(): string {
  return kintone.$PLUGIN_ID;
}

function loadConfig(): PluginConfig | null {
  const raw = kintone.plugin.app.getConfig(pluginId());
  return parseConfigString(raw?.config);
}

function applicableProfiles(
  config: PluginConfig,
  screen: Exclude<TargetScreen, "both">,
): Profile[] {
  return config.settings.profiles.filter((p) => p.target === screen || p.target === "both");
}

function getFormMetas(appId: number): Promise<Map<string, FieldMeta>> {
  let cached = formMetaCache.get(appId);
  if (!cached) {
    cached = fetchFieldMetas(getClient(), appId).catch((err) => {
      formMetaCache.delete(appId);
      throw err;
    });
    formMetaCache.set(appId, cached);
  }
  return cached;
}

async function onDetailShow(event: KintoneEvent, isMobile: boolean): Promise<KintoneEvent> {
  const config = loadConfig();
  if (!config) return event;
  const profiles = applicableProfiles(config, "detail");
  if (profiles.length === 0) return event; // EC-18

  const container = isMobile ? mobileDetailHeaderSpace() : detailHeaderSpace();
  if (!container) return event;

  const appId = event.appId;
  const record = (event.record ?? {}) as KintoneRecord;
  const user = kintone.getLoginUser();
  const storeKey = selectionKey(appId, user.code);
  const last = loadSelection(storeKey);

  let formMetas: Map<string, FieldMeta>;
  try {
    formMetas = await getFormMetas(appId);
  } catch {
    return event; // form fetch failed; leave the screen untouched
  }

  active?.destroy();
  active = mountCopyUI({
    container,
    screen: "detail",
    isMobile,
    profiles,
    defaultProfileId: config.settings.defaultProfileId,
    storeKey,
    initialProfileId: last?.profileId ?? null,
    initialFormat: last?.format ?? null,
    buildSync: (profile, format) =>
      assembleDetail(record, formMetas, profile, format, user.timeZone),
  });
  return event;
}

async function onIndexShow(event: KintoneEvent): Promise<KintoneEvent> {
  // Only list and custom views; calendar shows no button (section 3).
  if (event.viewType !== "list" && event.viewType !== "custom") return event;

  const config = loadConfig();
  if (!config) return event;
  const profiles = applicableProfiles(config, "index");
  if (profiles.length === 0) return event; // EC-18

  const container = indexHeaderSpace();
  if (!container) return event;

  const appId = event.appId;
  const client = getClient();
  const user = kintone.getLoginUser();
  const storeKey = selectionKey(appId, user.code);
  const last = loadSelection(storeKey);
  const limit = config.settings.maxRecords;

  let formMetas: Map<string, FieldMeta>;
  try {
    formMetas = await getFormMetas(appId);
  } catch {
    return event;
  }

  active?.destroy();
  active = mountCopyUI({
    container,
    screen: "index",
    isMobile: false,
    profiles,
    defaultProfileId: config.settings.defaultProfileId,
    storeKey,
    initialProfileId: last?.profileId ?? null,
    initialFormat: last?.format ?? null,
    buildAsync: (profile, format, signal) =>
      assembleIndex(
        client,
        appId,
        kintone.app.getQuery(),
        formMetas,
        profile,
        format,
        user.timeZone,
        limit,
        signal,
      ),
  });
  return event;
}

export function registerDesktop(): void {
  kintone.events.on("app.record.detail.show", (event) => onDetailShow(event, false));
  kintone.events.on("app.record.index.show", (event) => onIndexShow(event));
}

export function registerMobile(): void {
  kintone.events.on("mobile.app.record.detail.show", (event) => onDetailShow(event, true));
}
