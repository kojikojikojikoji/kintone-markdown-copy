// Toast notifications (common spec section 7). Top-right, auto-dismiss after
// 4 seconds, max 3 at once. DOM built with createElement (no innerHTML).

const CONTAINER_ID = "kp-mdcopy-toast-container";
const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 4000;

export type ToastType = "success" | "error";

function ensureContainer(): HTMLElement {
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = CONTAINER_ID;
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message: string, type: ToastType = "success"): void {
  const container = ensureContainer();
  while (container.childElementCount >= MAX_TOASTS && container.firstElementChild) {
    container.removeChild(container.firstElementChild);
  }
  const toast = document.createElement("div");
  toast.className = `kp-mdcopy-toast kp-mdcopy-toast--${type}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  container.appendChild(toast);
  window.setTimeout(() => {
    if (toast.parentElement === container) {
      container.removeChild(toast);
    }
  }, AUTO_DISMISS_MS);
}
