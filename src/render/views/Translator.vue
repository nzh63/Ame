<template>
  <div>
    <text-display
      v-for="(text, index) of texts"
      :key="text.id"
      :ref="
        (el) => {
          if (index === 0) currentTextElement = el;
        }
      "
      class="text-display"
      :original="text.original"
      :translate="text.translate"
      @tts-speak="onTts"
    />
  </div>
</template>

<script lang="ts">
import { watchOriginal, unwatchOriginal, watchTranslate, unwatchTranslate, resizeWindow, ttsSpeak, onTtsReply, offTtsReply, showContextMenu } from '@render/remote';
import { onBeforeRouteLeave } from 'vue-router';
import { defineComponent, ref, inject, onUnmounted, Ref, nextTick, watch, reactive, onBeforeUpdate } from 'vue';
import TextDisplay from '@render/component/TextDisplay';

type Translate = { id: string, text: string, err?: any }[];

export default defineComponent({
    components: {
        TextDisplay
    },
    setup() {
        const hookCodes = inject<Ref<string[]>>('hookCodes') ?? ref([]);
        const running = inject<Ref<boolean>>('running') ?? ref(true);
        const scrollToTop = inject<() => void>('scrollToTop');

        const MAX_LENGTH = 10;

        const texts = reactive<{ original: string, translate: Translate, id: number }[]>([]);
        let id = 0;
        const watchChange = () => {
            if (hookCodes.value && running.value) {
                for (const hookCode of hookCodes.value) {
                    watchOriginal(hookCode, ({ key, text }) => {
                        texts.unshift({ original: text, translate: [], id });
                        id++;
                        id %= MAX_LENGTH + 1;
                        while (texts.length > MAX_LENGTH) texts.pop();
                        updateWindowHeight();
                    });
                    watchTranslate(
                        hookCode,
                        (result) => {
                            const text = texts.find(i => i.original === result.originalText);
                            if (result.key === hookCode && text) {
                                const translate = text.translate.find(i => i.id === result.providerId);
                                if (translate) {
                                    translate.text = result.translateText;
                                } else {
                                    text.translate.push({ id: result.providerId, text: result.translateText });
                                }
                                updateWindowHeight();
                            }
                        },
                        (err, result) => {
                            const text = texts.find(i => i.original === result.originalText);
                            if (result.key === hookCode && text) {
                                text.translate.push({ err, id: result.providerId, text: result.translateText });
                                updateWindowHeight();
                            }
                        }
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

        watch(running, r => r ? watchChange() : unwatchChange());

        const currentTextElement = ref<any>(null);
        onBeforeUpdate(() => {
            currentTextElement.value = null;
        });
        const updateWindowHeight = () => {
            scrollToTop?.();
            nextTick(() => {
                if (currentTextElement.value) {
                    const titleBarHeight = 24;
                    const height: number = titleBarHeight + currentTextElement.value.$el.offsetHeight;
                    resizeWindow(height);
                }
            });
        };

        onBeforeRouteLeave(() => {
            const titleBarHeight = 24;
            const height: number = titleBarHeight + (currentTextElement.value?.$el.offsetHeight ?? 0);
            if (height < 300) {
                resizeWindow(300);
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
            onTts
        };
    }
});
</script>

<style scoped>
.text-display:not(:first-of-type) {
    margin-top: 1em;
}
</style>
