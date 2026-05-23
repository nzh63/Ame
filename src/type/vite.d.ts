interface ImportMeta {
  env: {
    DEV: boolean;
    PROD: boolean;
    E2E?: true;
    IS_MAIN_PROCESS: boolean;
    IS_RENDER_PROCESS: boolean;
    IS_WORKER_PROCESS: boolean;
  };
}
