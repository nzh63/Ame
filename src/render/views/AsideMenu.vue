<template>
  <t-menu
    theme="dark"
    :value="selectedKeys"
    class="menu"
    @change="v => onClick(v as string)"
  >
    <template #logo>
      <div class="logo">
        <img src="@assets/icon.svg">
        <div class="text">
          <div class="title">
            Ame
          </div>
          <div class="description">
            Visual Novel Translator
          </div>
        </div>
      </div>
    </template>
    <t-menu-item value="/dashboard">
      <span>主页</span>
    </t-menu-item>
    <t-menu-item value="/add-game">
      <span>添加游戏</span>
    </t-menu-item>
    <t-menu-item value="/options/locale-changers">
      <span>区域转换器设置</span>
    </t-menu-item>
    <t-submenu value="/options/translate-provider">
      <template #title>
        <span>
          <span>翻译器设置</span>
        </span>
      </template>
      <t-menu-item
        v-for="id in translateProvidersIDs"
        :key="`/options/translate-provider/${id}`"
        :value="`/options/translate-provider/${id}`"
      >
        {{ id }}
      </t-menu-item>
    </t-submenu>
    <t-submenu value="/options/tts-provider">
      <template #title>
        <span>
          <span>TTS设置</span>
        </span>
      </template>
      <t-menu-item value="/options/tts-manager">
        通用设置
      </t-menu-item>
      <t-menu-item
        v-for="id in ttsProvidersIDs"
        :key="`/options/tts-provider/${id}`"
        :value="`/options/tts-provider/${id}`"
      >
        {{ id }}
      </t-menu-item>
    </t-submenu>
    <t-submenu value="/options/ocr-provider">
      <template #title>
        <span>
          <span>OCR设置</span>
        </span>
      </template>
      <t-menu-item value="/options/ocr-extractor">
        通用设置
      </t-menu-item>
      <t-menu-item
        v-for="id in ocrProvidersIDs"
        :key="`/options/ocr-provider/${id}`"
        :value="`/options/ocr-provider/${id}`"
      >
        {{ id }}
      </t-menu-item>
    </t-submenu>
    <t-submenu value="/options/segment-provider">
      <template #title>
        <span>
          <span>分词设置</span>
        </span>
      </template>
      <t-menu-item value="/options/segment-manager">
        通用设置
      </t-menu-item>
      <t-menu-item
        v-for="id in segmentProvidersIDs"
        :key="`/options/segment-provider/${id}`"
        :value="`/options/segment-provider/${id}`"
      >
        {{ id }}
      </t-menu-item>
    </t-submenu>
    <t-submenu value="/options/dict-provider">
      <template #title>
        <span>
          <span>词典设置</span>
        </span>
      </template>
      <t-menu-item value="/options/dict-manager">
        通用设置
      </t-menu-item>
      <t-menu-item
        v-for="id in dictProvidersIDs"
        :key="`/options/dict-provider/${id}`"
        :value="`/options/dict-provider/${id}`"
      >
        {{ id }}
      </t-menu-item>
    </t-submenu>
  </t-menu>
</template>

<script lang="ts">
import { useRouter } from 'vue-router';
import { computed, defineComponent, ref } from 'vue';
import { getTranslateProvidersIDs, getTtsProvidersIDs, getOcrProvidersIDs, getSegmentProvidersIDs, getDictProvidersIDs } from '@render/remote';

export default defineComponent({
    setup() {
        const router = useRouter();
        function onClick(item: string) {
            router.push(item);
        }
        const selectedKeys = computed(() => router.currentRoute.value.path);

        const translateProvidersIDs = ref<string[]>([]);
        getTranslateProvidersIDs().then(value => {
            translateProvidersIDs.value = value;
        });

        const ttsProvidersIDs = ref<string[]>([]);
        getTtsProvidersIDs().then(value => {
            ttsProvidersIDs.value = value;
        });

        const ocrProvidersIDs = ref<string[]>([]);
        getOcrProvidersIDs().then(value => {
            ocrProvidersIDs.value = value;
        });

        const segmentProvidersIDs = ref<string[]>([]);
        getSegmentProvidersIDs().then(value => {
            segmentProvidersIDs.value = value;
        });

        const dictProvidersIDs = ref<string[]>([]);
        getDictProvidersIDs().then(value => {
            dictProvidersIDs.value = value;
        });

        return {
            onClick,
            selectedKeys,
            translateProvidersIDs,
            ttsProvidersIDs,
            ocrProvidersIDs,
            segmentProvidersIDs,
            dictProvidersIDs
        };
    }
});
</script>

<style scoped>
.menu :deep(.t-menu--scroll) {
    scrollbar-gutter: stable both-edges;
    padding: var(--td-comp-paddingTB-l) 0;
}
.logo {
    align-items: center;
    display: flex;
    flex: 1 1 100%;
    letter-spacing: normal;
    min-height: 48px;
    outline: none;
    position: relative;
    text-decoration: none;
    margin: 0.5em 1em;
    -webkit-app-region: drag;
}
.logo img {
    width: 3em;
    height: 3em;
}
.logo .text {
    align-items: left;
    align-self: center;
    display: flex;
    flex-wrap: wrap;
    flex: 1 1;
    overflow: hidden;
    padding: 12px 0;
    flex-direction: column;
    margin-left: 1em;
}
.logo .text .title {
    font: var(--td-font-title-small);
    color: var(--td-font-white-1);
}
.logo .text .description {
    font: var(--td-font-body-small);
}
.t-menu--dark {
  --td-scrollbar-color: rgba(255, 255, 255, 10%);
  --td-scrollbar-hover-color: rgba(255, 255, 255, 30%);
  --td-scroll-track-color: #333;
}
</style>
