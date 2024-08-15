<template>
  <t-layout id="top-layout">
    <t-aside>
      <aside-menu />
    </t-aside>
    <t-layout>
      <t-header id="draggable" />
      <t-content id="main-content">
        <router-view />
      </t-content>
    </t-layout>
  </t-layout>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import AsideMenu from '@render/views/AsideMenu.vue';

export default defineComponent({
    components: {
        AsideMenu
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
#draggable {
    width: 100%;
    height: 30px;
    min-height: 30px;
    background: var(--td-bg-color-page);
    -webkit-app-region: drag;
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
