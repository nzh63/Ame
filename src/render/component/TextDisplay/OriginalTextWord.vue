<template>
  <t-tooltip
    v-if="word.extraInfo"
    placement="mouse"
    :align="{
      targetOffset: [0, 8],
      overflow: { adjustX: true, adjustY: false },
    }"
  >
    <template #content>
      <div class="extra-info">
        <template v-for="(line, index) of extraInfoSpilt" :key="index">
          <br v-if="index !== 0" />
          {{ line }}
        </template>
      </div>
    </template>
    <span class="word" v-bind="$attrs">
      {{ word.word }}
    </span>
  </t-tooltip>
  <span v-else class="word" v-bind="$attrs">
    {{ word.word }}
  </span>
</template>

<script lang="ts">
import type { SegmentWord } from '@main/providers/SegmentProvider';
import type { PropType } from 'vue';
import { computed, defineComponent } from 'vue';

export default defineComponent({
  inheritAttrs: false,
  props: {
    word: {
      type: Object as PropType<SegmentWord>,
      required: true,
    },
    getPopupContainer: {
      type: Function as PropType<() => HTMLElement>,
      default: () => document.body,
    },
  },
  setup(prop) {
    const extraInfoSpilt = computed(() => (prop.word.extraInfo ?? '').split('\n'));

    return {
      extraInfoSpilt,
    };
  },
});
</script>

<style scoped>
.word:hover {
  background: rgba(255, 255, 255, 0.2);
}
.word {
  cursor: pointer;
}
.extra-info {
  white-space: nowrap;
  width: max-content;
}
</style>
