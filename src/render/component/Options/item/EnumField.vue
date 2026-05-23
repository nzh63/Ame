<template>
  <t-select :value="selectedIndex" @change="onChange">
    <t-option v-for="(value, index) in enumValues" :key="index" :value="index" :label="stringify(value)">
      {{ stringify(value) }}
    </t-option>
  </t-select>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue';

export default defineComponent({
  props: {
    modelValue: { type: null as unknown as PropType<any>, required: true },
    enumValues: { type: Array as PropType<readonly any[]>, required: true },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const selectedIndex = computed(() => {
      return props.enumValues.findIndex((i) => JSON.stringify(i) === JSON.stringify(props.modelValue));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onChange = (value: any) => {
      const index = typeof value === 'number' ? value : parseInt(value, 10);
      emit('update:modelValue', props.enumValues[index]);
    };

    const stringify = (value: unknown) => {
      return typeof value === 'string' ? value : JSON.stringify(value);
    };

    return { selectedIndex, onChange, stringify };
  },
});
</script>
