// Minimal ambient declarations for the kintone globals this plugin uses.
// Only the surface actually referenced is typed; kept intentionally small.

interface KintoneLoginUser {
  id: string;
  code: string;
  name: string;
  timeZone: string;
}

interface KintoneEvent {
  appId: number;
  viewType?: string;
  viewId?: number;
  record?: Record<string, { type: string; value: any }>;
  [key: string]: any;
}

type KintoneEventHandler = (event: KintoneEvent) => KintoneEvent | Promise<KintoneEvent>;

declare namespace kintone {
  namespace events {
    function on(event: string | string[], handler: KintoneEventHandler): void;
  }

  namespace app {
    function getId(): number | null;
    function getQuery(): string;
    function getHeaderMenuSpaceElement(): HTMLElement | null;
    namespace record {
      function getHeaderMenuSpaceElement(): HTMLElement | null;
    }
  }

  namespace mobile {
    namespace app {
      function getId(): number | null;
      function getHeaderSpaceElement(): HTMLElement | null;
    }
  }

  namespace plugin {
    namespace app {
      function getConfig(id: string): Record<string, string>;
      function setConfig(config: Record<string, string>, callback?: () => void): void;
    }
  }

  function getLoginUser(): KintoneLoginUser;
  function getRequestToken(): string;

  // Injected by the plugin loader; holds this plugin's id.
  const $PLUGIN_ID: string;
}

interface Window {
  kintone: typeof kintone;
}
