<template>
  <a-tooltip
    v-if="word.extraInfo"
    placement="bottomRight"
    arrow-point-at-center
    overlay-class-name="ant-tooltip-placement-bottomRight"
    :get-popup-container="getPopupContainer"
    :align="{
      targetOffset: [0, 8],
      overflow: { adjustX: true, adjustY: false },
    }"
  >
    <template #title>
      <div class="extra-info">
        <template
          v-for="(line, index) of extraInfoSpilt"
          :key="index"
        >
          <br v-if="index !== 0">
          {{ line }}
        </template>
      </div>
    </template>
    <span
      class="word"
      v-bind="$attrs"
    >
      {{ word.word }}
    </span>
  </a-tooltip>
  <span
    v-else
    class="word"
    v-bind="$attrs"
  >
    {{ word.word }}
  </span>
</template>

<script lang="ts">
import type { SegmentWord } from '@main/manager/SegmentManager';
import { computed, defineComponent, PropType } from 'vue';

export default defineComponent({
    inheritAttrs: false,
    props: {
        word: {
            type: Object as PropType<SegmentWord>,
            required: true
        },
        getPopupContainer: {
            type: Function as PropType<() => HTMLElement>,
            default: () => document.body
        }
    },
    setup(prop) {
        const extraInfoSpilt = computed(() => (prop.word.extraInfo ?? '').split('\n'));

        return {
            extraInfoSpilt
        };
    }
});
</script>

<style scoped>
.word:hover,
.word.ant-tooltip-open {
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
