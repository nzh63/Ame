<template>
  <a-input
    :value="value"
    :placeholder="placeholder"
    @update:value="update"
  >
    <template #suffix>
      <a-tooltip title="打开...">
        <more-outlined
          class="open"
          :rotate="90"
          @click="open"
        />
      </a-tooltip>
    </template>
  </a-input>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { showOpenDialog } from '@render/remote';

export default defineComponent({
    props: {
        value: {
            type: String,
            default: ''
        },
        placeholder: {
            type: String,
            default: ''
        },
        pathTransform: {
            type: Function,
            default: (path: string) => path
        }
    },
    emits: ['update:value'],
    data() {
        return {
            showEdit: false,
            formState: {
                title: '',
                path: ''
            }
        };
    },
    methods: {
        async open() {
            const path = await showOpenDialog({
                filters: [{ name: '可执行文件', extensions: ['exe'] }]
            });
            if (path !== undefined) this.$emit('update:value', this.pathTransform(path));
        },
        update(newValue: string) {
            this.$emit('update:value', newValue);
        }
    }
});
</script>
