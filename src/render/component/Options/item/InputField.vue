<template>
  <t-input :value="inputText" @change="onChange">
    <template #suffix>
      <t-space size="small">
        <t-tag v-for="t in typeInfo" :key="t">
          {{ t }}
        </t-tag>
      </t-space>
    </template>
  </t-input>
</template>

<script lang="ts">
import { defineComponent, ref, watch, type PropType } from 'vue';

export default defineComponent({
  props: {
    modelValue: { type: null as unknown as PropType<any>, required: true },
    typeInfo: { type: Array as PropType<string[]>, required: true },
  },
  emits: ['update:modelValue', 'update:error'],
  setup(props, { emit }) {
    const inputText = ref('');

    watch(
      () => props.modelValue,
      (val) => {
        inputText.value = val === null ? '<null>' : typeof val === 'string' ? val : (JSON.stringify(val) ?? '');
      },
      { immediate: true },
    );

    const onChange = (value: string | number) => {
      const newValueString = String(value);
      let newValue: any = newValueString;
      let error: string | undefined;

      const nullable = props.typeInfo.some((t) => t === 'null');
      const isNumber = props.typeInfo.some((t) => t === 'number');
      const isArray = props.typeInfo.some((t) => t === 'array');
      const isString = props.typeInfo.some((t) => t === 'string');
      const isUnion = props.typeInfo.length > 1;

      if (nullable) {
        if (newValue === '<null>') {
          newValue = null;
        } else if (!isUnion) {
          error = '应当为null（输入<null>）';
        }
      }
      if (isNumber) {
        if (Number.isNaN(parseFloat(newValue)) || /[^0-9.]/.test(newValueString)) {
          if (!isArray && !isString) error = '应当是一个数字';
        } else {
          newValue = parseFloat(newValue);
        }
      }
      if (isArray) {
        try {
          newValue = JSON.parse(newValue);
        } catch (e: any) {
          if (!isString) error = (e as Error).message;
        }
      }

      emit('update:error', error);

      if (!error) {
        emit('update:modelValue', newValue);
      }

      inputText.value =
        newValue === null ? '<null>' : typeof newValue === 'string' ? newValue : JSON.stringify(newValue);
    };

    return { inputText, onChange };
  },
});
</script>
