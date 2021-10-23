<template>
  <div>
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
    <a-menu
      theme="dark"
      mode="inline"
      :default-selected-keys="['/dashboard']"
      :selected-keys="selectedKeys"
      @click="onClick"
    >
      <a-menu-item key="/dashboard">
        <span>主页</span>
      </a-menu-item>
      <a-menu-item key="/add-game">
        <span>添加游戏</span>
      </a-menu-item>
      <a-menu-item key="/options/locale-changers">
        <span>区域转换器设置</span>
      </a-menu-item>
      <a-sub-menu key="/options/translate-provider">
        <template #title>
          <span>
            <span>翻译器设置</span>
          </span>
        </template>
        <a-menu-item
          v-for="id in translateProvidersIDs"
          :key="`/options/translate-provider/${id}`"
        >
          {{ id }}
        </a-menu-item>
      </a-sub-menu>
      <a-sub-menu key="/options/tts-provider">
        <template #title>
          <span>
            <span>TTS设置</span>
          </span>
        </template>
        <a-menu-item key="/options/tts-manager">
          通用设置
        </a-menu-item>
        <a-menu-item
          v-for="id in ttsProvidersIDs"
          :key="`/options/tts-provider/${id}`"
        >
          {{ id }}
        </a-menu-item>
      </a-sub-menu>
      <a-sub-menu key="/options/ocr-provider">
        <template #title>
          <span>
            <span>OCR设置</span>
          </span>
        </template>
        <a-menu-item key="/options/ocr-extractor">
          通用设置
        </a-menu-item>
        <a-menu-item
          v-for="id in ocrProvidersIDs"
          :key="`/options/ocr-provider/${id}`"
        >
          {{ id }}
        </a-menu-item>
      </a-sub-menu>
      <a-sub-menu key="/options/segment-provider">
        <template #title>
          <span>
            <span>分词设置</span>
          </span>
        </template>
        <a-menu-item key="/options/segment-manager">
          通用设置
        </a-menu-item>
        <a-menu-item
          v-for="id in segmentProvidersIDs"
          :key="`/options/segment-provider/${id}`"
        >
          {{ id }}
        </a-menu-item>
      </a-sub-menu>
      <a-sub-menu key="/options/dict-provider">
        <template #title>
          <span>
            <span>词典设置</span>
          </span>
        </template>
        <a-menu-item key="/options/dict-manager">
          通用设置
        </a-menu-item>
        <a-menu-item
          v-for="id in dictProvidersIDs"
          :key="`/options/dict-provider/${id}`"
        >
          {{ id }}
        </a-menu-item>
      </a-sub-menu>
    </a-menu>
  </div>
</template>

<script lang="ts">
import type { Item } from 'ant-design-vue/es/menu';
import { useRouter } from 'vue-router';
import { computed, defineComponent, ref } from 'vue';
import { getTranslateProvidersIDs, getTtsProvidersIDs, getOcrProvidersIDs, getSegmentProvidersIDs, getDictProvidersIDs } from '@render/remote';

export default defineComponent({
    setup() {
        const router = useRouter();
        function onClick(item: typeof Item) {
            if (item.key) {
                router.push(item.key.toString());
            }
        }
        const selectedKeys = computed(() => [router.currentRoute.value.path]);

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
    color: #fff;
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
    font-weight: bolder;
    font-size: larger;
    color: #fffd;
}
.logo .text .description {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
}
:deep(.ant-menu-dark .ant-menu-submenu-selected) {
    color: #1890ff !important;
}
:deep(.ant-menu-dark .ant-menu-submenu-open:not(.ant-menu-submenu-selected)) {
    color: rgba(255, 255, 255, 0.65) !important;
}
:deep(.ant-menu-dark .ant-menu-submenu-title:hover) {
    color: inherit;
}
</style>
