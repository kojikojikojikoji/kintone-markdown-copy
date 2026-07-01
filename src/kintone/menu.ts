// Copy button + dropdown menu, shared by the detail and index screens.
// Handles the clipboard route A/B split and toast composition.

import type { OutputFormat, Profile } from "../core/types";
import { supportsClipboardItemPromise, writePlainText, writeViaClipboardItem } from "./clipboard";
import type { CopyData, CopyErrorKind, CopyOutcome } from "./assemble";
import { saveSelection } from "./localstore";
import { showToast } from "./toast";

const BUTTON_ID = "kp-mdcopy-button";
const MENU_ID = "kp-mdcopy-menu";

const FORMATS: { format: OutputFormat; label: string }[] = [
  { format: "table", label: "Markdown表" },
  { format: "list", label: "Markdown箇条書き" },
  { format: "tsv", label: "TSV" },
];

const ERROR_TEXT: Record<Exclude<CopyErrorKind, "abort">, string> = {
  fetch: "レコードの取得に失敗しました。時間をおいてもう一度お試しください",
  write: "クリップボードに書き込めませんでした。もう一度コピーボタンを押してください",
  empty: "コピーする対象のレコードがありません",
  "no-columns": "コピーできるフィールドがありません。プラグイン設定を確認してください",
};

export interface MountOptions {
  container: HTMLElement;
  screen: "detail" | "index";
  isMobile: boolean;
  profiles: Profile[]; // already filtered to this screen (>= 1)
  defaultProfileId: string;
  storeKey: string;
  initialProfileId: string | null;
  initialFormat: OutputFormat | null;
  // Detail: synchronous assembly from event.record.
  buildSync?: (profile: Profile, format: OutputFormat) => CopyOutcome;
  // Index: async assembly via cursor. Receives an abort signal.
  buildAsync?: (
    profile: Profile,
    format: OutputFormat,
    signal: AbortSignal,
  ) => Promise<CopyOutcome>;
}

export interface CopyController {
  abort(): void;
  destroy(): void;
}

function taggedError(kind: CopyErrorKind): Error {
  const err = new Error(kind);
  (err as { code?: string }).code = kind;
  return err;
}

function errorKindOf(err: unknown): Exclude<CopyErrorKind, "abort"> {
  const code = (err as { code?: string })?.code;
  if (code === "fetch" || code === "empty" || code === "no-columns") return code;
  // A rejection from write() itself (NotAllowedError, focus loss) is a write error.
  return "write";
}

export function mountCopyUI(options: MountOptions): CopyController {
  const { container, screen, isMobile, profiles } = options;

  // Idempotent: remove any prior UI in this container (SPA re-show guard).
  container.querySelector(`#${BUTTON_ID}`)?.remove();
  container.querySelector(`#${MENU_ID}`)?.remove();

  let selectedProfile =
    profiles.find((p) => p.id === options.initialProfileId) ??
    profiles.find((p) => p.id === options.defaultProfileId) ??
    profiles[0];
  let selectedFormat: OutputFormat = options.initialFormat ?? "table";

  let busy = false;
  let abortController: AbortController | null = null;
  let confirmCleanup: (() => void) | null = null;

  // ----- DOM -----
  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.className = `kp-mdcopy-button${isMobile ? " kp-mdcopy-button--mobile" : ""}`;
  button.textContent = "コピー";
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-expanded", "false");

  const menu = document.createElement("div");
  menu.id = MENU_ID;
  menu.className = "kp-mdcopy-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;

  let profileSelect: HTMLSelectElement | null = null;
  if (profiles.length >= 2) {
    const row = document.createElement("div");
    row.className = "kp-mdcopy-profile-row";
    const label = document.createElement("label");
    label.className = "kp-mdcopy-profile-label";
    label.textContent = "プロファイル";
    const select = document.createElement("select");
    select.className = "kp-mdcopy-profile-select";
    profiles.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === selectedProfile.id) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => {
      const next = profiles.find((p) => p.id === select.value);
      if (next) selectedProfile = next;
    });
    const divider = document.createElement("div");
    divider.className = "kp-mdcopy-divider";
    label.appendChild(select);
    row.appendChild(label);
    menu.appendChild(row);
    menu.appendChild(divider);
    profileSelect = select;
  }

  const itemButtons: HTMLButtonElement[] = FORMATS.map(({ format, label }) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "kp-mdcopy-item";
    item.setAttribute("role", "menuitem");
    item.dataset.format = format;
    item.textContent = label;
    item.addEventListener("click", () => onFormatClick(format, item));
    menu.appendChild(item);
    return item;
  });

  // ----- helpers -----
  function setBusy(next: boolean): void {
    busy = next;
    button.disabled = next;
    itemButtons.forEach((b) => (b.disabled = next));
    if (profileSelect) profileSelect.disabled = next;
  }

  function resetItems(): void {
    if (confirmCleanup) {
      confirmCleanup();
      confirmCleanup = null;
    }
    itemButtons.forEach((b, i) => {
      b.textContent = FORMATS[i].label;
      b.className = "kp-mdcopy-item";
      b.disabled = false;
    });
  }

  function openMenu(): void {
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    const first = itemButtons[0];
    if (first) first.focus();
  }

  function closeMenu(): void {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    // Route B: discard any pending confirm data without writing (EC-22/FR-20).
    resetItems();
  }

  function persist(): void {
    saveSelection(options.storeKey, {
      profileId: selectedProfile.id,
      format: selectedFormat,
    });
  }

  function showSuccessToasts(data: CopyData): void {
    if (data.truncated && data.totalCount !== undefined && data.totalCount > data.rowCount) {
      showToast(`先頭${data.rowCount}件のみコピーしました(全${data.totalCount}件)`, "success");
    } else {
      showToast(`クリップボードにコピーしました(${data.rowCount}行)`, "success");
    }
    if (data.permissionExcludedCount > 0) {
      const unit = screen === "index" ? "列" : "項目";
      showToast(`閲覧権限のない${data.permissionExcludedCount}${unit}を除外しました`, "success");
    }
  }

  function showErrorToast(kind: Exclude<CopyErrorKind, "abort">): void {
    showToast(ERROR_TEXT[kind], "error");
  }

  // ----- copy flows -----
  function onFormatClick(format: OutputFormat, item: HTMLButtonElement): void {
    if (busy) return; // EC-13
    selectedFormat = format;
    persist();

    if (screen === "detail" && options.buildSync) {
      runDetail(format);
      return;
    }
    if (options.buildAsync) {
      if (supportsClipboardItemPromise()) {
        runIndexRouteA(format);
      } else {
        runIndexRouteB(format, item);
      }
    }
  }

  function runDetail(format: OutputFormat): void {
    const outcome = options.buildSync!(selectedProfile, format);
    if (!outcome.ok) {
      showErrorToast(outcome.error as Exclude<CopyErrorKind, "abort">);
      closeMenu();
      return;
    }
    // Synchronous within the gesture: safe for Safari (FR-9).
    writePlainText(outcome.data.text)
      .then(() => showSuccessToasts(outcome.data))
      .catch(() => showErrorToast("write"));
    closeMenu();
  }

  function runIndexRouteA(format: OutputFormat): void {
    setBusy(true);
    const controller = new AbortController();
    abortController = controller;
    let pending: CopyData | null = null;

    writeViaClipboardItem(async () => {
      const outcome = await options.buildAsync!(selectedProfile, format, controller.signal);
      if (!outcome.ok) throw taggedError(outcome.error);
      pending = outcome.data;
      return outcome.data.text;
    })
      .then(() => {
        if (pending) showSuccessToasts(pending);
      })
      .catch((err) => {
        const code = (err as { code?: string })?.code;
        if (code === "abort") return; // EC-12: silent
        showErrorToast(errorKindOf(err));
      })
      .finally(() => {
        abortController = null;
        setBusy(false);
      });
    closeMenu();
  }

  async function runIndexRouteB(format: OutputFormat, item: HTMLButtonElement): Promise<void> {
    setBusy(true);
    const controller = new AbortController();
    abortController = controller;
    item.textContent = "取得中…";

    let outcome: CopyOutcome;
    try {
      outcome = await options.buildAsync!(selectedProfile, format, controller.signal);
    } catch {
      setBusy(false);
      abortController = null;
      showErrorToast("fetch");
      resetItems();
      return;
    }
    abortController = null;

    if (!outcome.ok) {
      setBusy(false);
      resetItems();
      if (outcome.error !== "abort") showErrorToast(outcome.error);
      return;
    }

    // Menu closed while fetching: discard, write nothing (FR-20/EC-22).
    if (menu.hidden) {
      setBusy(false);
      return;
    }

    const data = outcome.data;
    // Re-enable only the confirm item; keep the others disabled until confirm.
    itemButtons.forEach((b) => (b.disabled = b !== item));
    button.disabled = false;
    item.disabled = false;
    item.textContent = `コピーする(${data.rowCount}行)`;
    item.classList.add("kp-mdcopy-item--confirm");

    const onConfirm = (): void => {
      writePlainText(data.text)
        .then(() => showSuccessToasts(data))
        .catch(() => showErrorToast("write"));
      confirmCleanup = null;
      item.removeEventListener("click", onConfirm);
      busy = false;
      closeMenu();
    };
    item.addEventListener("click", onConfirm);
    confirmCleanup = () => item.removeEventListener("click", onConfirm);
  }

  // ----- menu interaction -----
  function onButtonClick(): void {
    if (busy) return;
    if (menu.hidden) openMenu();
    else closeMenu();
  }

  function onDocumentClick(e: MouseEvent): void {
    if (menu.hidden) return;
    const target = e.target as Node;
    if (!menu.contains(target) && target !== button) closeMenu();
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (menu.hidden) return;
    if (e.key === "Escape") {
      closeMenu();
      button.focus();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const enabled = itemButtons.filter((b) => !b.disabled);
      if (enabled.length === 0) return;
      const active = document.activeElement as HTMLElement;
      let idx = enabled.indexOf(active as HTMLButtonElement);
      idx =
        e.key === "ArrowDown"
          ? (idx + 1) % enabled.length
          : (idx - 1 + enabled.length) % enabled.length;
      enabled[idx].focus();
    }
  }

  button.addEventListener("click", onButtonClick);
  document.addEventListener("click", onDocumentClick, true);
  menu.addEventListener("keydown", onKeyDown);

  container.appendChild(button);
  container.appendChild(menu);

  return {
    abort(): void {
      abortController?.abort();
      abortController = null;
    },
    destroy(): void {
      abortController?.abort();
      document.removeEventListener("click", onDocumentClick, true);
      button.remove();
      menu.remove();
    },
  };
}
