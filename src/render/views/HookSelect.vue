<template>
  <t-space class="header">
    <t-button theme="default" shape="circle" @click="clear">
      <template #icon>
        <delete-icon />
      </template>
    </t-button>
    <t-radio-group v-model:value="multiselect" name="mode">
      <t-radio :value="false"> 单选模式 </t-radio>
      <t-radio value> 多选模式 </t-radio>
    </t-radio-group>
  </t-space>
  <t-list>
    <t-list-item v-for="(text, key) of texts" :key="key">
      <t-list-item-meta>
        <template #title>
          <span class="text">{{ text }}</span>
        </template>
        <template #description>
          <span class="key">{{ key }}</span>
        </template>
      </t-list-item-meta>
      <template #action>
        <t-button v-if="hookCodes.includes('' + key)" class="sucess" theme="primary" shape="round">
          <template #icon>
            <check-icon />
          </template>
          使用中
        </t-button>
        <t-button v-else theme="primary" shape="round" @click="setHookCode(key)">
          <template #icon>
            <rocket-icon />
          </template>
          使用
        </t-button>
      </template>
    </t-list-item>
  </t-list>
</template>

<script lang="ts">
import { watchOriginal, unwatchOriginal, getAllExtractText } from '@remote';
import type { Ref, VNode } from 'vue';
import { defineComponent, inject, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

export default defineComponent({
  setup() {
    const texts = ref<{ [key: string]: string }>({});
    getAllExtractText()
      .then((value) => {
        texts.value = value;
      })
      .catch(() => {});
    watchOriginal('any', ({ key, text }) => {
      texts.value[key] = text;
    });
    onUnmounted(() => {
      unwatchOriginal('any');
    });

    const hookCodes = inject<Ref<string[]>>('hookCodes') ?? ref([]);
    const setHookCodeInject = inject<(h: string[]) => void>('setHookCodes');
    const router = useRouter();
    const setRunning = inject<(r: boolean) => void>('setRunning');

    const multiselect = ref(hookCodes.value.length > 1);

    const setHookCode = (h: string | number) => {
      if (multiselect.value) setHookCodeInject?.([...hookCodes.value, String(h)]);
      else setHookCodeInject?.([String(h)]);
      setRunning?.(true);
      if (!multiselect.value) router.push('/translator');
    };

    const clear = () => {
      if (hookCodes.value.length) {
        hookCodes.value = [];
      } else {
        texts.value = {};
      }
    };

    const top = ref<VNode>();

    return {
      hookCodes,
      texts,
      setHookCode,
      multiselect,
      clear,
      top,
    };
  },
});
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
}
.sucess {
  background: #52c41a;
  border-color: #52c41a;
}
.text {
  font-size: var(--td-font-size-link-medium);
  word-break: break-all;
}
.key {
  color: var(--td-gray-color-8);
  word-break: break-all;
}
</style>
