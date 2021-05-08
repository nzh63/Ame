<template>
    <a-checkbox v-model:checked="option.removeDuplication">
        移除重复字符
    </a-checkbox>
</template>

<script lang="ts">
import type { PostProcessOption } from '@main/extractor';
import { defineComponent, ref, watch, toRaw } from 'vue';
import { getTextractorPostProcessOption, setTextractorPostProcessOption } from '@render/remote';

export default defineComponent({
    setup() {
        const option = ref<PostProcessOption>({ removeDuplication: false });
        getTextractorPostProcessOption()
            .then(o => {
                option.value = o;
            });

        const saveOption = () => {
            setTextractorPostProcessOption(toRaw(option.value));
        };

        watch(option, saveOption, { deep: true });

        return {
            option
        };
    }
});
</script>
