<template>
  <t-input :value="value" :placeholder="placeholder" @update:value="update">
    <template #suffix>
      <t-tooltip content="打开...">
        <t-button size="small" variant="text" @click="open">
          <ellipsis-icon />
        </t-button>
      </t-tooltip>
    </template>
  </t-input>
</template>

<script lang="ts">
import { showOpenDialog } from '@remote';
import { defineComponent } from 'vue';

export default defineComponent({
  props: {
    value: {
      type: String,
      default: '',
    },
    placeholder: {
      type: String,
      default: '',
    },
    pathTransform: {
      type: Function,
      default: (path: string) => path,
    },
  },
  emits: ['update:value'],
  data() {
    return {
      showEdit: false,
      formState: {
        title: '',
        path: '',
      },
    };
  },
  methods: {
    async open() {
      const path = await showOpenDialog({
        filters: [{ name: '可执行文件', extensions: ['exe'] }],
      });
      if (path !== undefined) this.$emit('update:value', this.pathTransform(path));
    },
    update(newValue: string) {
      this.$emit('update:value', newValue);
    },
  },
});
</script>
