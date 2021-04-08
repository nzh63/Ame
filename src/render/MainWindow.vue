<template>
    <a-layout id="top-layout">
        <a-layout-sider
            v-model="collapsed"
            :trigger="null"
            :width="225"
            collapsible
        >
            <aside-menu />
        </a-layout-sider>
        <a-layout-content id="main-content">
            <router-view></router-view>
        </a-layout-content>
    </a-layout>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import AsideMenu from '@render/views/AsideMenu.vue';

export default defineComponent({
    components: {
        AsideMenu
    },
    setup() {
        const collapsed = ref(false);

        return {
            collapsed
        };
    }
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

#top-layout .trigger {
    font-size: 18px;
    line-height: 64px;
    padding: 0 24px;
    cursor: pointer;
    transition: color 0.3s;
}

#top-layout .trigger:hover {
    color: #1890ff;
}

#main-content {
    margin: 24px 16px;
    padding: 24px;
    background: #fff;
    minheight: 280px;
}
</style>
