<template>
    <div>
        <text-display
            class="text-display"
            v-for="(text, index) of texts"
            :key="text.id"
            :original="text.original"
            :translate="text.translate"
            :ref="
                (el) => {
                    if (index === 0) currentTextElement = el;
                }
            "
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
        const hookCode = inject<Ref<string>>('hookCode') ?? ref('');
        const running = inject<Ref<boolean>>('running') ?? ref(true);
        const scrollToTop = inject<() => void>('scrollToTop');

        const MAX_LENGTH = 10;

        const texts = reactive<{ original: string, translate: Translate, id: number }[]>([]);
        let id = 0;
        const watchChange = () => {
            if (hookCode.value && running.value) {
                watchOriginal(hookCode.value, ({ key, text }) => {
                    texts.unshift({ original: text, translate: [], id });
                    id++;
                    id %= MAX_LENGTH + 1;
                    while (texts.length > MAX_LENGTH) texts.pop();
                    updateWindowHeight();
                });
                watchTranslate(
                    hookCode.value,
                    (result) => {
                        const text = texts.find(i => i.original === result.originalText);
                        if (result.key === hookCode.value && text) {
                            text.translate.push({ id: result.providerId, text: result.translateText });
                            updateWindowHeight();
                        }
                    },
                    (err, result) => {
                        const text = texts.find(i => i.original === result.originalText);
                        if (result.key === hookCode.value && text) {
                            text.translate.push({ err, id: result.providerId, text: result.translateText });
                            updateWindowHeight();
                        }
                    }
                );
            }
        };
        const unwatchChange = () => {
            if (hookCode.value) {
                unwatchOriginal(hookCode.value);
                unwatchTranslate(hookCode.value);
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

        const onTts = (s: string, t: 'original' | 'translate') => {
            ttsString = s;
            ttsType = t;
            showContextMenu();
        };

        return {
            hookCode,
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
