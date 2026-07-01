// Plugin configuration screen. Renders the profile editor and common settings,
// validates against the current form fields, and persists via setConfig.

import { configSchema, defaultConfig, parseConfigString } from "../core/config-schema";
import type { FieldMeta, PluginConfig, Profile } from "../core/types";
import { OUTPUT_FIELD_TYPES, fetchFieldMetas } from "../kintone/form-fields";
import { getClient } from "../kintone/rest";

const PLUGIN_LIST_URL = "/k/admin/system/plugin/";

interface Errors {
  profiles?: string;
  maxRecords?: string;
  // Per-profile field-level errors, keyed by profile id.
  name?: Record<string, string>;
  fields?: Record<string, string>;
}

let draft: PluginConfig;
let selectable: FieldMeta[] = [];
let editingId: string | null = null;
let errors: Errors = {};
let root: HTMLElement;

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, any>> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value as string;
    else if (key === "text") node.textContent = value as string;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (value !== undefined && value !== null && value !== false) {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function labelFor(code: string): string {
  return selectable.find((f) => f.code === code)?.label ?? code;
}

// ----- rendering -----

function renderProfileRow(profile: Profile): HTMLElement {
  const isDefault = draft.settings.defaultProfileId === profile.id;
  const defaultRadio = el("input", {
    type: "radio",
    name: "kp-default",
    checked: isDefault,
    onchange: () => {
      draft.settings.defaultProfileId = profile.id;
    },
  });
  const deleteBtn = el(
    "button",
    {
      type: "button",
      class: "kp-mdcopy-cfg-btn kp-mdcopy-cfg-btn--danger",
      onclick: () => deleteProfile(profile.id),
    },
    ["削除"],
  );
  const editBtn = el(
    "button",
    {
      type: "button",
      class: "kp-mdcopy-cfg-btn",
      onclick: () => {
        editingId = editingId === profile.id ? null : profile.id;
        render();
      },
    },
    [editingId === profile.id ? "閉じる" : "編集"],
  );

  const row = el("div", { class: "kp-mdcopy-profile-item" }, [
    el("span", { class: "kp-mdcopy-profile-name", text: profile.name || "(名称未設定)" }),
    el("label", {}, [defaultRadio, " 既定"]),
    editBtn,
    deleteBtn,
  ]);

  const wrap = el("div", {}, [row]);
  if (editingId === profile.id) {
    wrap.appendChild(renderEditor(profile));
  }
  return wrap;
}

function renderEditor(profile: Profile): HTMLElement {
  const nameInput = el("input", {
    type: "text",
    class: "kp-mdcopy-input",
    value: profile.name,
    maxlength: "30",
    oninput: (e: Event) => {
      profile.name = (e.target as HTMLInputElement).value;
    },
  });

  const targetGroup = el(
    "div",
    { class: "kp-mdcopy-radio-group" },
    (["detail", "index", "both"] as const).map((value) => {
      const text = value === "detail" ? "詳細" : value === "index" ? "一覧" : "両方";
      return el("label", {}, [
        el("input", {
          type: "radio",
          name: `kp-target-${profile.id}`,
          checked: profile.target === value,
          onchange: () => {
            profile.target = value;
          },
        }),
        ` ${text}`,
      ]);
    }),
  );

  const dateGroup = el(
    "div",
    { class: "kp-mdcopy-radio-group" },
    (["YYYY-MM-DD HH:mm", "YYYY/MM/DD HH:mm"] as const).map((value) =>
      el("label", {}, [
        el("input", {
          type: "radio",
          name: `kp-date-${profile.id}`,
          checked: profile.format.dateTimeFormat === value,
          onchange: () => {
            profile.format.dateTimeFormat = value;
          },
        }),
        ` ${value}`,
      ]),
    ),
  );

  const thousands = el("label", {}, [
    el("input", {
      type: "checkbox",
      checked: profile.format.thousandsSeparator,
      onchange: (e: Event) => {
        profile.format.thousandsSeparator = (e.target as HTMLInputElement).checked;
      },
    }),
    " 3桁区切りのカンマを入れる",
  ]);

  const emptyGroup = el(
    "div",
    { class: "kp-mdcopy-radio-group" },
    (
      [
        ["", "空文字"],
        ["-", "-"],
      ] as [OutputFormatEmpty, string][]
    ).map(([value, text]) =>
      el("label", {}, [
        el("input", {
          type: "radio",
          name: `kp-empty-${profile.id}`,
          checked: profile.format.emptyValue === value,
          onchange: () => {
            profile.format.emptyValue = value;
          },
        }),
        ` ${text}`,
      ]),
    ),
  );

  const editor = el("div", { class: "kp-mdcopy-edit" }, [
    field("プロファイル名", nameInput, errors.name?.[profile.id]),
    field("対象画面", targetGroup),
    field(
      "対象フィールド（上から順に出力）",
      renderFieldPicker(profile),
      errors.fields?.[profile.id],
    ),
    field("日時形式", dateGroup),
    field("数値の桁区切り", thousands),
    field("空値の表記", emptyGroup),
  ]);
  return editor;
}

type OutputFormatEmpty = "" | "-";

function renderFieldPicker(profile: Profile): HTMLElement {
  const available = el("select", { class: "", multiple: true, size: "8" });
  selectable
    .filter((f) => OUTPUT_FIELD_TYPES.has(f.type) && !profile.fieldCodes.includes(f.code))
    .forEach((f) =>
      available.appendChild(el("option", { value: f.code, text: `${f.label} (${f.code})` })),
    );

  const selected = el("select", { class: "", multiple: true, size: "8" });
  profile.fieldCodes.forEach((code) =>
    selected.appendChild(el("option", { value: code, text: labelFor(code) })),
  );

  const add = () => {
    Array.from(available.selectedOptions).forEach((o) => {
      if (!profile.fieldCodes.includes(o.value)) profile.fieldCodes.push(o.value);
    });
    render();
  };
  const remove = () => {
    const drop = new Set(Array.from(selected.selectedOptions).map((o) => o.value));
    profile.fieldCodes = profile.fieldCodes.filter((c) => !drop.has(c));
    render();
  };
  const move = (dir: -1 | 1) => {
    const chosen = Array.from(selected.selectedOptions).map((o) => o.value);
    if (chosen.length !== 1) return;
    const i = profile.fieldCodes.indexOf(chosen[0]);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= profile.fieldCodes.length) return;
    [profile.fieldCodes[i], profile.fieldCodes[j]] = [profile.fieldCodes[j], profile.fieldCodes[i]];
    render();
  };

  const controls = el("div", { class: "kp-mdcopy-fieldpicker-controls" }, [
    el("button", { type: "button", class: "kp-mdcopy-cfg-btn", onclick: add }, ["追加 →"]),
    el("button", { type: "button", class: "kp-mdcopy-cfg-btn", onclick: remove }, ["← 削除"]),
    el("button", { type: "button", class: "kp-mdcopy-cfg-btn", onclick: () => move(-1) }, ["↑"]),
    el("button", { type: "button", class: "kp-mdcopy-cfg-btn", onclick: () => move(1) }, ["↓"]),
  ]);

  return el("div", { class: "kp-mdcopy-fieldpicker" }, [
    labelledBox("選択可能", available),
    controls,
    labelledBox("出力する列", selected),
  ]);
}

function labelledBox(title: string, control: HTMLElement): HTMLElement {
  return el("div", {}, [el("div", { class: "kp-mdcopy-desc", text: title }), control]);
}

function field(label: string, control: HTMLElement, error?: string): HTMLElement {
  const children: (Node | string)[] = [
    el("label", { class: "kp-mdcopy-label", text: label }),
    control,
  ];
  if (error) children.push(el("p", { class: "kp-mdcopy-error", text: error }));
  return el("div", { class: "kp-mdcopy-field" }, children);
}

function render(): void {
  root.textContent = "";

  const header = el("div", {}, [
    el("h1", { class: "kp-mdcopy-h1", text: "kintone-markdown-copy" }),
    el("p", { class: "kp-mdcopy-lead", text: "レコードと一覧を Markdown / TSV でコピーします。" }),
  ]);

  const profileCard = el("div", { class: "kp-mdcopy-card" }, [
    el("h2", { class: "kp-mdcopy-card-title", text: "プロファイル" }),
  ]);
  if (errors.profiles) {
    profileCard.appendChild(el("p", { class: "kp-mdcopy-error", text: errors.profiles }));
  }
  draft.settings.profiles.forEach((p) => profileCard.appendChild(renderProfileRow(p)));
  const addBtn = el(
    "button",
    {
      type: "button",
      class: "kp-mdcopy-cfg-btn",
      disabled: draft.settings.profiles.length >= 10,
      onclick: addProfile,
    },
    ["+ プロファイルを追加"],
  );
  profileCard.appendChild(el("div", { class: "kp-mdcopy-field" }, [addBtn]));

  const maxInput = el("input", {
    type: "number",
    class: "kp-mdcopy-number",
    min: "1",
    max: "5000",
    value: String(draft.settings.maxRecords),
    oninput: (e: Event) => {
      draft.settings.maxRecords = Number((e.target as HTMLInputElement).value);
    },
  });
  const commonCard = el("div", { class: "kp-mdcopy-card" }, [
    el("h2", { class: "kp-mdcopy-card-title", text: "共通設定" }),
    field("上限件数", maxInput, errors.maxRecords),
    el("p", {
      class: "kp-mdcopy-desc",
      text: "一覧コピーで取得するレコード数の上限です（1〜5000）。",
    }),
  ]);

  const saveBar = el("div", { class: "kp-mdcopy-savebar" }, [
    el("button", { type: "button", class: "kp-mdcopy-save", onclick: save }, ["保存"]),
    el("button", { type: "button", class: "kp-mdcopy-cancel", onclick: cancel }, ["キャンセル"]),
  ]);

  root.appendChild(header);
  root.appendChild(profileCard);
  root.appendChild(commonCard);
  root.appendChild(saveBar);
}

// ----- actions -----

function addProfile(): void {
  if (draft.settings.profiles.length >= 10) return;
  const id = newId();
  draft.settings.profiles.push({
    id,
    name: `プロファイル${draft.settings.profiles.length + 1}`,
    target: "both",
    fieldCodes: [],
    format: { dateTimeFormat: "YYYY-MM-DD HH:mm", thousandsSeparator: false, emptyValue: "" },
  });
  editingId = id;
  render();
}

function deleteProfile(id: string): void {
  if (draft.settings.defaultProfileId === id) {
    errors.profiles =
      "既定のプロファイルは削除できません。先に別のプロファイルを既定にしてください";
    render();
    return;
  }
  draft.settings.profiles = draft.settings.profiles.filter((p) => p.id !== id);
  if (editingId === id) editingId = null;
  errors.profiles = undefined;
  render();
}

function validate(): boolean {
  errors = { name: {}, fields: {} };
  let ok = true;
  const { profiles, maxRecords } = draft.settings;

  if (profiles.length === 0) {
    errors.profiles = "プロファイルを1件以上作成してください";
    ok = false;
  }

  const seen = new Map<string, number>();
  for (const p of profiles) {
    const name = p.name.trim();
    if (name.length < 1 || name.length > 30) {
      errors.name![p.id] = "1〜30文字で入力してください";
      ok = false;
    }
    seen.set(name, (seen.get(name) ?? 0) + 1);
    if (p.fieldCodes.length === 0) {
      errors.fields![p.id] = "フィールドを1つ以上選択してください";
      ok = false;
    }
    // Warn on fields that no longer exist in the form (common spec).
    const missing = p.fieldCodes.filter((c) => !selectable.some((f) => f.code === c));
    if (missing.length > 0) {
      errors.fields![p.id] = `フォームに存在しないフィールドがあります: ${missing.join(", ")}`;
      ok = false;
    }
  }
  for (const p of profiles) {
    if ((seen.get(p.name.trim()) ?? 0) > 1) {
      errors.name![p.id] = "同じ名前のプロファイルがあります。別の名前を付けてください";
      ok = false;
    }
  }

  if (!Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > 5000) {
    errors.maxRecords = "1から5000までの整数を入力してください";
    ok = false;
  }

  if (!profiles.some((p) => p.id === draft.settings.defaultProfileId) && profiles.length > 0) {
    draft.settings.defaultProfileId = profiles[0].id;
  }

  return ok;
}

function save(): void {
  if (!validate()) {
    // Open the first profile with an error so the message is visible.
    const bad = draft.settings.profiles.find((p) => errors.name?.[p.id] || errors.fields?.[p.id]);
    if (bad) editingId = bad.id;
    render();
    return;
  }
  const parsed = configSchema.safeParse(draft);
  if (!parsed.success) {
    errors.profiles = "設定を保存できませんでした。入力内容を確認してください";
    render();
    return;
  }
  kintone.plugin.app.setConfig({ config: JSON.stringify(draft) }, () => {
    window.location.href = PLUGIN_LIST_URL;
  });
}

function cancel(): void {
  window.location.href = PLUGIN_LIST_URL;
}

// ----- init -----

async function init(): Promise<void> {
  root = document.getElementById("kp-mdcopy-config-root") as HTMLElement;
  if (!root) return;

  const stored = parseConfigString(kintone.plugin.app.getConfig(kintone.$PLUGIN_ID)?.config);
  draft = stored ?? defaultConfig();
  editingId = draft.settings.profiles[0]?.id ?? null;

  const appId = kintone.app.getId();
  if (appId != null) {
    try {
      const metas = await fetchFieldMetas(getClient(), appId, true);
      selectable = Array.from(metas.values()).filter((f) => OUTPUT_FIELD_TYPES.has(f.type));
    } catch {
      selectable = [];
    }
  }
  render();
}

void init();
