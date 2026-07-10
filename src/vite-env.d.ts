/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional server proxy that backs Nova's import suggestions with a real model. */
  readonly VITE_NOVA_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
