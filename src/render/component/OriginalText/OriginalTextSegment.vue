<template>
    <span>
        <span v-if="!segmented" @mouseenter="segment">{{ text }}</span>
        <span v-else>
            <span v-for="(s, index) of splitText" class="word" :key="index">
                {{ s }}
            </span>
        </span>
    </span>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { segment as segmentText } from '@render/remote';

export default defineComponent({
    props: {
        text: {
            type: String,
            required: true
        }
    },
    setup(props) {
        const splitText = ref<string[]>([]);
        const segmented = ref(false);
        let segmenting = false;
        const segment = async () => {
            if (segmenting || segmented.value) return;
            segmenting = true;
            const result = await segmentText(props.text);
            if (result) {
                splitText.value = result;
                segmented.value = true;
            }
            segmenting = false;
        };
        return {
            splitText,
            segmented,
            segment
        };
    }
});
</script>

<style scoped>
.word:hover {
    background: rgba(255, 255, 255, 0.2);
}
</style>
