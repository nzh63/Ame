<template>
    <a-list item-layout="horizontal" :data-source="Object.keys(texts)">
        <a-list-item v-for="(text, key) of texts" :key="key">
            <a-list-item-meta>
                <template #title>{{ text }}</template>
                <template #description>{{ key }}</template>
            </a-list-item-meta>
            <template #actions>
                <a-button
                    type="primary"
                    shape="round"
                    @click="setHookCode(key)"
                >
                    <template #icon>
                        <check-outlined />
                    </template>
                    使用
                </a-button>
            </template>
        </a-list-item>
    </a-list>
</template>

<script lang="ts">
import { defineComponent, inject, onUnmounted, ref } from 'vue';
import { CheckOutlined } from '@ant-design/icons-vue';
import { watchOriginal, unwatchOriginal, getAllExtractText } from '@render/remote';
import { useRouter } from 'vue-router';

export default defineComponent({
    components: {
        CheckOutlined
    },
    setup() {
        const texts = ref<{ [key: string]: string }>({});
        getAllExtractText().then(value => { texts.value = value; }).catch(() => { });
        watchOriginal('any', ({ key, text }) => {
            texts.value[key] = text;
        });
        onUnmounted(() => {
            unwatchOriginal('any');
        });

        const setHookCodeInject = inject<(h: string) => void>('setHookCode');
        const router = useRouter();
        const setRunning = inject<(r: boolean) => void>('setRunning');
        const setHookCode = (h: string | number) => {
            setHookCodeInject?.('' + h);
            setRunning?.(true);
            router.push('/translator');
        };

        return {
            texts,
            setHookCode
        };
    }
});
</script>

<style scoped>
</style>
