interface ImportMeta {
  env: {
    LOGGING: boolean;
    RESOURCE_MODE: 'dev-server' | 'unpacked' | 'packed';
    ENABLE_ECHO_TRANSLATOR: boolean;
    CHECK_UPDATES: boolean;
    TEMP_STORE: boolean;
    IS_MAIN_PROCESS: boolean;
    IS_RENDER_PROCESS: boolean;
    IS_WORKER_PROCESS: boolean;
  };
}
