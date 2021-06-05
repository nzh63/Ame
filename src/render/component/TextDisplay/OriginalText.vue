<template>
  <span
    v-if="!segmented"
    @mouseenter="segment"
  >{{ text }}</span>
  <span
    v-else
    class="original-text-line"
    title
  >
    <original-text-word
      v-for="(s, index) of splitText"
      :key="index"
      :word="s"
      :get-popup-container="() => $el"
      @click="query(s.word)"
    />
  </span>
</template>

<script lang="ts">
import type { SegmentWord } from '@main/manager/SegmentManager';
import { defineComponent, getCurrentInstance, ref, watch } from 'vue';
import { dictQuery, segment as segmentText } from '@render/remote';
import OriginalTextWord from './OriginalTextWord.vue';

export default defineComponent({
    components: {
        OriginalTextWord
    },
    props: {
        text: {
            type: String,
            required: true
        }
    },
    setup(props) {
        const splitText = ref<SegmentWord[]>([]);
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

        watch(props, () => {
            splitText.value = [];
            segmented.value = false;
            segmenting = false;
        }, { deep: true });

        const query = (word: string) => {
            dictQuery(word);
        };

        const internalInstance = getCurrentInstance();

        return {
            splitText,
            segmented,
            segment,
            query,
            internalInstance
        };
    }
});
</script>

<style scoped>
.original-text-line {
    position: relative;
}
</style>
