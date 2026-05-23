<template>
  <!-- Object: iterate properties recursively (no DOM wrapper, leaves form-items as direct children of t-form) -->
  <template v-if="isObject">
    <OptionsSchemaEditor
      v-for="key in objectKeys"
      :key="key"
      :model-value="objectChildren[key]"
      :schema="s.properties[key]"
      :description="description?.[key]"
      :path="[...path, key]"
      @update:model-value="(v) => onObjectChildUpdate(key, v)"
    />
  </template>

  <!-- Array with array description: iterate items recursively -->
  <template v-else-if="isExpandedArray">
    <OptionsSchemaEditor
      v-for="idx in arrayIndices"
      :key="idx"
      :model-value="arrayChildren[idx]"
      :schema="arrayItemSchema(idx)"
      :description="description?.[idx]"
      :path="[...path, idx]"
      @update:model-value="(v) => onArrayChildUpdate(idx, v)"
    />
  </template>

  <!-- Leaf type: render t-form-item with the appropriate input -->
  <t-form-item v-else :key="path.join('.')" :class="{ 't-is-error': !!error }">
    <template #label>
      <t-space size="small">
        <span>{{ readableName }}</span>
        <span class="key">
          {{ path.join('.') }}
        </span>
      </t-space>
    </template>
    <EnumField
      v-if="enumValues"
      :model-value="modelValue"
      :enum-values="enumValues"
      @update:model-value="(v) => $emit('update:modelValue', v)"
    />
    <InputField
      v-else
      :model-value="modelValue"
      :type-info="typeInfo"
      @update:model-value="(v) => $emit('update:modelValue', v)"
      @update:error="(e) => (error = e)"
    />
    <template #help>
      <span v-if="error" class="error-message">
        {{ path.join('.') + ' ' + error }}
      </span>
      <span v-else-if="fieldDescription">{{ fieldDescription }}</span>
    </template>
  </t-form-item>
</template>

<script lang="ts">
import EnumField from './item/EnumField.vue';
import InputField from './item/InputField.vue';
import type { JSONSchema } from '@main/schema';
import { computed, defineComponent, inject, onUnmounted, ref, watch, type PropType, type Ref } from 'vue';

export default defineComponent({
  name: 'OptionsSchemaEditor',
  components: { EnumField, InputField },
  props: {
    schema: { type: Object as PropType<JSONSchema>, required: true },
    modelValue: { type: null as unknown as PropType<any>, required: true },
    description: { type: null as unknown as PropType<any>, default: undefined },
    path: { type: Array as PropType<(string | number)[]>, default: () => [] },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const error = ref<string | undefined>();

    // Sync this field's validation error to the parent-provided error counter
    const errorCount = inject<Ref<number>>('options-validation-error-count', ref(0));
    let prevHadError = false;
    watch(error, (val) => {
      const hadError = prevHadError;
      const hasError = !!val;
      if (hasError && !hadError) errorCount.value++;
      if (!hasError && hadError) errorCount.value--;
      prevHadError = hasError;
    });
    onUnmounted(() => {
      if (prevHadError) errorCount.value--;
    });

    const s = computed(() => props.schema as any);

    const isObject = computed(() => s.value.type === 'object');

    const objectKeys = computed(() => Object.keys(s.value.properties ?? {}));

    const objectChildren = computed(() => {
      const obj = props.modelValue ?? {};
      const result: Record<string, any> = {};
      for (const key of objectKeys.value) {
        result[key] = obj[key];
      }
      return result;
    });

    const onObjectChildUpdate = (key: string, newVal: any) => {
      const newObj = { ...(props.modelValue ?? {}) };
      newObj[key] = newVal;
      emit('update:modelValue', newObj);
    };

    // Array type that is expanded (description is an array)
    const isExpandedArray = computed(() => s.value.type === 'array' && props.description instanceof Array);

    const arrayLength = computed(() => {
      if (props.description instanceof Array) return props.description.length;
      return Array.isArray(props.modelValue) ? props.modelValue.length : 0;
    });

    const arrayIndices = computed(() => {
      return Array.from({ length: arrayLength.value }, (_, i) => i);
    });

    const arrayChildren = computed(() => {
      if (Array.isArray(props.modelValue)) return [...props.modelValue];
      return [];
    });

    const arrayItemSchema = (idx: number): JSONSchema => {
      const items = s.value.items;
      if (items instanceof Array) {
        return (items[idx] ?? {}) as JSONSchema;
      }
      return (items as JSONSchema) ?? {};
    };

    const onArrayChildUpdate = (idx: number, newVal: any) => {
      const newArr = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
      newArr[idx] = newVal;
      emit('update:modelValue', newArr);
    };

    // ---- Leaf field helpers ----

    const enumValues = computed(() => {
      return s.value.enum || s.value.examples || undefined;
    });

    const typeInfo = computed(() => {
      const t = s.value.type;
      if (typeof t === 'string') return [t];
      if (Array.isArray(t)) return t as string[];
      const anyOf = s.value.anyOf;
      if (Array.isArray(anyOf)) return anyOf.map((i: any) => i.type as string).filter(Boolean);
      return [];
    });

    const readableName = computed(() => {
      const d = props.description;
      if (d === undefined || d === null) return props.path.join('.');
      if (typeof d === 'string') return d;
      if (typeof d === 'object' && 'readableName' in d) return d.readableName;
      return props.path.join('.');
    });

    const fieldDescription = computed(() => {
      const d = props.description;
      if (d === undefined || d === null) return undefined;
      if (typeof d === 'object' && 'description' in d) return d.description;
      return undefined;
    });

    return {
      error,
      s: s,
      isObject,
      objectKeys,
      objectChildren,
      onObjectChildUpdate,
      isExpandedArray,
      arrayLength,
      arrayIndices,
      arrayChildren,
      arrayItemSchema,
      onArrayChildUpdate,
      enumValues,
      typeInfo,
      readableName,
      fieldDescription,
    };
  },
});
</script>

<style scoped>
.key {
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-small);
}
.error-message {
  color: var(--td-error-color);
}
</style>
