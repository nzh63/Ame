<template>
  <t-layout id="top-layout">
    <t-aside>
      <aside-menu />
    </t-aside>
    <t-layout>
      <t-header id="draggable">
        <div class="window-controls">
          <button class="window-control" aria-label="最小化" title="最小化" @click="minimize">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M0 5.5h10" stroke="currentColor" stroke-width="1" />
            </svg>
          </button>
          <button
            class="window-control"
            :aria-label="isMaximized ? '还原' : '最大化'"
            :title="isMaximized ? '还原' : '最大化'"
            @click="toggleMaximize"
          >
            <svg v-if="isMaximized" width="10" height="10" viewBox="0 0 10 10">
              <path d="M2.5 2.5V0.5h7v7h-2" fill="none" stroke="currentColor" stroke-width="1" />
              <rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1" />
            </svg>
            <svg v-else width="10" height="10" viewBox="0 0 10 10">
              <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1" />
            </svg>
          </button>
          <button class="window-control close" aria-label="关闭" title="关闭" @click="close">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" stroke-width="1" />
            </svg>
          </button>
        </div>
      </t-header>
      <t-content id="main-content">
        <router-view v-slot="{ Component }">
          <suspense suspensible timeout="200">
            <template v-if="Component">
              <component :is="Component" />
            </template>
            <template #fallback>
              <t-skeleton animation="gradient" theme="paragraph" />
            </template>
          </suspense>
        </router-view>
      </t-content>
    </t-layout>
  </t-layout>
</template>

<script lang="ts">
import { closeWindow, minimizeWindow, showWindow, toggleMaximizeWindow } from '@remote';
import AsideMenu from '@render/views/AsideMenu.vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { defineComponent, onBeforeUnmount, onMounted, ref } from 'vue';

export default defineComponent({
  components: {
    AsideMenu,
  },
  setup() {
    const isMaximized = ref(false);
    let unlistenResize: (() => void) | undefined;

    const minimize = () => minimizeWindow();
    const toggleMaximize = async () => {
      isMaximized.value = await toggleMaximizeWindow();
    };
    const close = () => closeWindow();

    // Mirror the old Electron `ready-to-show` → `show()`.
    onMounted(async () => {
      showWindow();
      const appWindow = getCurrentWindow();
      isMaximized.value = await appWindow.isMaximized();
      // Keep the maximize/restore icon in sync even when the state changes
      // outside the button (Aero Snap, double-click on the drag region, …).
      unlistenResize = await appWindow.onResized(() => {
        appWindow.isMaximized().then((v) => {
          isMaximized.value = v;
        });
      });
    });

    onBeforeUnmount(() => {
      unlistenResize?.();
    });

    return {
      isMaximized,
      minimize,
      toggleMaximize,
      close,
    };
  },
});
</script>

<style>
body,
#app {
  height: 100%;
}
</style>

<style scoped>
#top-layout {
  height: 100%;
}
#draggable {
  width: 100%;
  height: 30px;
  min-height: 30px;
  display: flex;
  justify-content: flex-end;
  align-items: stretch;
  background: var(--td-bg-color-page);
  -webkit-app-region: drag;
  user-select: none;
}

.window-controls {
  display: flex;
  -webkit-app-region: no-drag;
}

.window-control {
  width: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  padding: 0;
  background: transparent;
  color: var(--td-text-color-primary);
  cursor: default;
}

.window-control:hover {
  background: rgba(0, 0, 0, 0.08);
}

.window-control.close:hover {
  background: #e81123;
  color: #fff;
}

#main-content {
  padding: var(--td-comp-paddingTB-xl) var(--td-comp-paddingLR-xl);
  background: #fff;
  min-height: 280px;
  overflow-y: auto;
  overflow-x: hidden;
}
</style>

<style>
html,
body {
  width: 100%;
  height: 100%;
}
::-webkit-scrollbar {
  width: 12px !important;
  height: 12px !important;
}
::-webkit-scrollbar-thumb {
  border: 4px solid transparent !important;
  background-clip: content-box !important;
  background-color: var(--td-scrollbar-color) !important;
  border-radius: 6px !important;
}
::-webkit-scrollbar-thumb:vertical:hover,
::-webkit-scrollbar-thumb:horizontal:hover {
  background-color: var(--td-scrollbar-hover-color) !important;
}
</style>
