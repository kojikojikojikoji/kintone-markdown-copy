// All dependence on kintone-provided mount points lives here, so a kintone UI
// change has a single place to fix (common spec section 4).

export function detailHeaderSpace(): HTMLElement | null {
  return kintone.app.record.getHeaderMenuSpaceElement();
}

export function indexHeaderSpace(): HTMLElement | null {
  return kintone.app.getHeaderMenuSpaceElement();
}

export function mobileDetailHeaderSpace(): HTMLElement | null {
  return kintone.mobile.app.getHeaderSpaceElement();
}
