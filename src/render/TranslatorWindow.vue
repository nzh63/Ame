<template>
    <a-layout id="top-layout" @mouseenter="mouseenter" @mouseleave="mouseleave">
        <translator-title-bar :hideTitleBar="hideTitleBar" />
        <a-layout-content id="main-content">
            <router-view></router-view>
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
        const hideTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
        const mouseenter = () => {
            hideTitleBar.value = false;
            if (hideTimeout.value) clearTimeout(hideTimeout.value);
            hideTimeout.value = null;
        };
        const mouseleave = () => {
            if (hideTimeout.value) clearTimeout(hideTimeout.value);
            hideTimeout.value = setTimeout(() => { hideTitleBar.value = true; }, 1000);
        };

        const hookCode = ref('');
        provide('setHookCode', (h: string) => { hookCode.value = h; });
        provide('hookCode', hookCode);
        const running = ref(false);
        provide('setRunning', (r: boolean) => { running.value = r; });
        provide('running', running);

        return {
            hideTitleBar,
            hideTimeout,
            mouseenter,
            mouseleave
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
