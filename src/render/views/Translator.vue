<template>
    <div class="translator" ref="topDiv">
        <div
            class="line"
            title="原文"
            @click.right="onRightClick(originalText, 'original')"
        >
            {{ originalText }}
        </div>
        <div
            class="line"
            v-for="i in translate"
            :key="i.id"
            :title="i.id"
            @click.right="
                onRightClick(
                    i.err ? i.err?.message ?? i.err : i.text,
                    'translate'
                )
            "
        >
            <span v-if="i.err" class="error">
                {{ i.id }}发生错误：{{ i.err?.message ?? i.err }}
            </span>
            <span v-else>{{ i.text }}</span>
        </div>
    </div>
</template>

<script lang="ts">
import { watchOriginal, unwatchOriginal, watchTranslate, unwatchTranslate, resizeWindow, ttsSpeak, onTTSReply, offTTSReply, showContextMenu } from '@render/remote';
import { onBeforeRouteLeave } from 'vue-router';
import { defineComponent, ref, inject, onUnmounted, Ref, nextTick, watch } from 'vue';

export default defineComponent({
    setup() {
        const hookCode = inject<Ref<string>>('hookCode') ?? ref('');
        const running = inject<Ref<boolean>>('running') ?? ref(true);

        const originalText = ref('');
        const translate = ref<{ id: string, text: string, err?: any }[]>([]);
        const watchO = () => {
            if (hookCode.value && running.value) {
                watchOriginal(hookCode.value, ({ key, text }) => {
                    originalText.value = text;
                    translate.value = [];
                    updateWindowHeight();
                });
            }
        };
        watchO();
        onUnmounted(() => {
            if (hookCode.value) unwatchOriginal(hookCode.value);
        });

        const watchT = () => {
            if (hookCode.value && running.value) {
                watchTranslate(hookCode.value, (result) => {
                    if (result.key === hookCode.value && result.originalText === originalText.value) {
                        translate.value.push({ id: result.providerId, text: result.translateText });
                        updateWindowHeight();
                    }
                }, (err, result) => {
                    if (result.key === hookCode.value && result.originalText === originalText.value) {
                        translate.value.push({ err, id: result.providerId, text: result.translateText });
                        updateWindowHeight();
                    }
                });
            }
        };
        watchT();
        onUnmounted(() => {
            if (hookCode.value) unwatchTranslate(hookCode.value);
        });

        watch(running, r => {
            if (r) {
                watchO();
                watchT();
            } else {
                if (hookCode.value) {
                    unwatchOriginal(hookCode.value);
                    unwatchTranslate(hookCode.value);
                }
            }
        });

        const topDiv = ref<any>(null);
        const updateWindowHeight = () => {
            nextTick(() => {
                if (topDiv) {
                    const titleBarHeight = 24;
                    const height: number = titleBarHeight + topDiv.value.offsetHeight;
                    resizeWindow(height);
                }
            });
        };

        onBeforeRouteLeave(() => {
            const titleBarHeight = 24;
            const height: number = titleBarHeight + topDiv.value.offsetHeight;
            if (height < 300) {
                resizeWindow(300);
            }
        });

        const ttsString = ref('');
        const ttsType = ref<'original' | 'translate'>('original');
        const ttsCallback = () => {
            ttsSpeak(ttsString.value, ttsType.value);
        };
        onTTSReply(ttsCallback);
        onUnmounted(() => {
            offTTSReply(ttsCallback);
        });

        const onRightClick = (s: string, t: 'original' | 'translate') => {
            ttsString.value = s;
            ttsType.value = t;
            showContextMenu();
        };

        return {
            hookCode,
            originalText,
            translate,
            topDiv,
            onRightClick
        };
    }
});
</script>

<style scoped>
.translator .line {
    line-height: 1.2;
    font-weight: 500;
    font-size: 16px;
}
.translator .line:not(:last-child) {
    margin-bottom: 0.3em;
}
.error {
    color: #ff4d4f;
    font-weight: 750;
}
</style>
