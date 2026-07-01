// Clipboard writing with the Safari constraint in mind (common spec section 5,
// FR-19 / FR-20). Route A is preferred; route B is a two-step fallback.

// Route A is available when ClipboardItem can take a Promise and
// navigator.clipboard.write exists (Chrome, Edge, Safari).
export function supportsClipboardItemPromise(): boolean {
  return typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function";
}

// Route A (FR-19): call write() synchronously inside the click handler and let
// the text be produced inside the Promise. Safari rejects a writeText() that
// runs after an awaited fetch, so the work must live in the ClipboardItem
// Promise instead. `buildText` may reject to signal a failure; the rejection
// propagates through write() and leaves the clipboard unchanged.
export function writeViaClipboardItem(buildText: () => Promise<string>): Promise<void> {
  const blobPromise = buildText().then((text) => new Blob([text], { type: "text/plain" }));
  const item = new ClipboardItem({ "text/plain": blobPromise });
  return navigator.clipboard.write([item]);
}

// Synchronous-path write for the detail screen (FR-9) and route B's confirm
// click (FR-20). The call itself is synchronous within the user gesture.
export function writePlainText(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
