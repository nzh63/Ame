<template>
  <a-layout
    id="top-layout"
    @mouseover="mouseover"
    @mouseleave="mouseleave"
  >
    <translator-title-bar v-model:hide-title-bar="hideTitleBar" />
    <a-layout-content
      id="main-content"
      ref="content"
      :class="{'overflow-hidden': hideTitleBar}"
    >
      <router-view />
    </a-layout-content>
  </a-layout>
</template>

<script lang="ts">
import { defineComponent, provide, ref } from 'vue';

import TranslatorTitleBar from '@render/component/TranslatorTitleBar.vue';

export default defineComponent({
    components: {
        TranslatorTitleBar
    },
    setup() {
        const hideTitleBar = ref(true);
        let hideTimeout: ReturnType<typeof setTimeout> | null = null;
        const mouseover = () => {
            hideTitleBar.value = false;
            if (hideTimeout) clearTimeout(hideTimeout);
            hideTimeout = null;
        };
        const mouseleave = () => {
            if (hideTimeout) clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => { hideTitleBar.value = true; }, 1000);
        };

        const hookCodes = ref<string[]>([]);
        provide('setHookCodes', (h: string[]) => { hookCodes.value = h; });
        provide('hookCodes', hookCodes);

        const running = ref(false);
        provide('setRunning', (r: boolean) => { running.value = r; });
        provide('running', running);

        const content = ref<any>(null);
        provide('scrollToTop', () => {
            if (content.value) content.value.$el.scrollTop &&= 0;
        });

        return {
            hideTitleBar,
            mouseover,
            mouseleave,
            content
        };
    }
});
</script>

<style>
body,
#app {
    height: 100%;
    background: unset !important;
}
</style>

<style scoped>
#top-layout {
    height: 100%;
    background: unset !important;
}
#main-content {
    padding: 0px 16px;
    height: 100%;
    overflow: overlay;
    background: rgba(0, 0, 0, 0.6);
}
.overflow-hidden {
    overflow: hidden !important;
}
::-webkit-scrollbar {
    width: 2px;
    height: 2px;
    transition: all 2s 1s;
}
*:hover::-webkit-scrollbar {
    width: 15px;
    height: 2px;
}

::-webkit-scrollbar-track-piece {
    background-color: none;
    background-color: rgba(0, 0, 0, 0.5);
}

::-webkit-scrollbar-thumb:vertical {
    height: 2px;
    background: rgba(255, 255, 255, 0.5);
}

::-webkit-scrollbar-thumb:horizontal {
    width: 2px;
    background: rgba(255, 255, 255, 0.5);
}
</style>
