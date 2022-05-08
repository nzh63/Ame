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
import type { LayoutContent } from 'ant-design-vue';
import { defineComponent, provide, ref } from 'vue';
import { useRouter } from 'vue-router';

import TranslatorTitleBar from '@render/component/TranslatorTitleBar.vue';
import { getGameSetting, onWindowBlur, onWindowFocus, setGameSelectKeys } from './remote';
import logger from '@logger/TranslatorWindow';

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
        onWindowFocus(mouseover);
        onWindowBlur(mouseleave);

        const hookCodes = ref<string[]>([]);
        provide('setHookCodes', (h: string[]) => {
            hookCodes.value = h;
            setGameSelectKeys(h);
        });
        provide('hookCodes', hookCodes);

        const running = ref(false);
        provide('setRunning', (r: boolean) => { running.value = r; });
        provide('running', running);

        const content = ref<typeof LayoutContent | null>(null);
        provide('scrollToTop', () => {
            if (content.value) content.value.$el.scrollTop &&= 0;
        });

        const router = useRouter();
        getGameSetting()
            .then(setting => {
                logger('%s %O', router.currentRoute.value.path, setting);
                if (setting?.selectKeys?.length) {
                    if (['/', '/hook-select'].find(i => i === router.currentRoute.value.path) &&
                         hookCodes.value.length === 0) {
                        hookCodes.value = setting.selectKeys;
                        running.value = true;
                        router.push('/translator');
                    }
                }
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
