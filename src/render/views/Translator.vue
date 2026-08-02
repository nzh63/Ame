<template>
  <div>
    <text-display
      v-for="(text, index) of texts"
      :key="text.id"
      :ref="(el) => index === 0 && (currentTextElement = toDomElement(el))"
      class="text-display"
      :original="text.original"
      :translate="text.translate"
      @tts-speak="onTts"
    />
  </div>
</template>

<script lang="ts">
import {
  watchOriginal,
  unwatchOriginal,
  watchTranslate,
  unwatchTranslate,
  resizeWindow,
  ttsSpeak,
  onTtsReply,
  offTtsReply,
  showContextMenu,
} from '@remote';
import TextDisplay from '@render/component/TextDisplay';
import type { ComponentPublicInstance, Ref } from 'vue';
import { defineComponent, ref, inject, onUnmounted, nextTick, watch, reactive, onBeforeUpdate } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

export default defineComponent({
  components: {
    TextDisplay,
  },
  setup() {
    const hookCodes = inject<Ref<string[]>>('hookCodes') ?? ref([]);
    const running = inject<Ref<boolean>>('running') ?? ref(true);
    const scrollToTop = inject<() => void>('scrollToTop');

    const MAX_LENGTH = 10;

    const texts = reactive<Ame.Translator.TextLine[]>([]);
    let id = 0;
    const watchChange = () => {
      if (hookCodes.value && running.value) {
        for (const hookCode of hookCodes.value) {
          watchOriginal(hookCode, ({ key, text }) => {
            texts.unshift({ id, key, original: text, translate: [] });
            id++;
            id %= MAX_LENGTH + 1;
            while (texts.length > MAX_LENGTH) texts.pop();
            updateWindowHeight();
          });
          watchTranslate(
            hookCode,
            (result) => {
              // 匹配同 key 下最新一条相同原文的记录（`unshift` → 数组头部最新）。
              // 用 key + originalText 双条件，避免 hookCode 相同但原文不同的串线。
              const key = String(result.key);
              const text = texts.find((i) => String(i.key) === key && i.original === result.originalText);
              if (text) {
                const translate = text.translate.find((i) => i.id === result.providerId);
                if (translate) {
                  translate.text = result.translateText;
                } else {
                  text.translate.push({ id: result.providerId, text: result.translateText });
                }
                updateWindowHeight();
              }
            },
            (err, result) => {
              const key = String(result.key);
              const text = texts.find((i) => String(i.key) === key && i.original === result.originalText);
              if (text) {
                text.translate.push({ err, id: result.providerId, text: result.translateText });
                updateWindowHeight();
              }
            },
          );
        }
      }
    };
    const unwatchChange = () => {
      for (const hookCode of hookCodes.value) {
        unwatchOriginal(hookCode);
        unwatchTranslate(hookCode);
      }
    };
    watchChange();
    onUnmounted(unwatchChange);

    watch(running, (r) => (r ? watchChange() : unwatchChange()));
    // selectKeys 是异步恢复的（TranslatorWindow 的 getGameSetting）：若
    // hookCodes 在首次 watchChange 之后才填充，必须重新订阅，否则提取事件
    // 会被 Rust 端判为 "skip translation for unselected key"。
    watch(hookCodes, () => {
      if (running.value) watchChange();
    });

    const currentTextElement = ref<HTMLElement | null>(null);
    /** 归一化函数 ref 回调值：组件实例取 `$el`，DOM 元素直接用。 */
    const toDomElement = (el: Element | ComponentPublicInstance | null): HTMLElement | null =>
      el instanceof HTMLElement ? el : el && '$el' in el ? (el.$el as HTMLElement) : null;
    onBeforeUpdate(() => {
      currentTextElement.value = null;
    });
    const updateWindowHeight = () => {
      scrollToTop?.();
      nextTick(() => {
        if (currentTextElement.value) {
          const titleBarHeight = document.documentElement.getAttribute('tablet-mode') === 'true' ? 32 : 24;
          const height: number = titleBarHeight + currentTextElement.value.offsetHeight;
          resizeWindow({ height });
        }
      });
    };

    onBeforeRouteLeave(() => {
      const titleBarHeight = document.documentElement.getAttribute('tablet-mode') === 'true' ? 32 : 24;
      const height: number = titleBarHeight + (currentTextElement.value?.offsetHeight ?? 0);
      if (height < 300) {
        resizeWindow({ height: 300 });
      }
    });

    let ttsString = '';
    let ttsType: 'original' | 'translate' = 'original';
    const ttsCallback = () => {
      ttsSpeak(ttsString, ttsType);
    };
    onTtsReply(ttsCallback);
    onUnmounted(() => {
      offTtsReply(ttsCallback);
    });

    const onTts = (s: string, t: 'original' | 'translate', x?: number, y?: number) => {
      ttsString = s;
      ttsType = t;
      showContextMenu(x, y);
    };

    return {
      hookCodes,
      texts,
      currentTextElement,
      toDomElement,
      onTts,
    };
  },
});
</script>

<style scoped>
.text-display:not(:first-of-type) {
  margin-top: 1em;
}
</style>
