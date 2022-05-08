<template>
  <a-space>
    <a-button
      shape="circle"
      @click="clear"
    >
      <template #icon>
        <delete-outlined />
      </template>
    </a-button>
    <a-radio-group
      v-model:value="multiselect"
      name="mode"
    >
      <a-radio :value="false">
        单选模式
      </a-radio>
      <a-radio :value="true">
        多选模式
      </a-radio>
    </a-radio-group>
  </a-space>
  <a-list
    item-layout="horizontal"
    :data-source="Object.keys(texts)"
    v-bind="$attrs"
  >
    <a-list-item
      v-for="(text, key) of texts"
      :key="key"
    >
      <a-list-item-meta>
        <template #title>
          <span class="break-all">{{ text }}</span>
        </template>
        <template #description>
          {{ key }}
        </template>
      </a-list-item-meta>
      <template #actions>
        <a-button
          v-if="hookCodes.includes(key)"
          class="sucess"
          type="primary"
          shape="round"
        >
          <template #icon>
            <check-outlined />
          </template>
          使用中
        </a-button>
        <a-button
          v-else
          type="primary"
          shape="round"
          @click="setHookCode(key)"
        >
          <template #icon>
            <select-outlined />
          </template>
          使用
        </a-button>
      </template>
    </a-list-item>
  </a-list>
</template>

<script lang="ts">
import { defineComponent, inject, onUnmounted, Ref, ref, VNode, onMounted } from 'vue';
import { watchOriginal, unwatchOriginal, getAllExtractText } from '@render/remote';
import { useRouter } from 'vue-router';

export default defineComponent({
    setup() {
        const texts = ref<{ [key: string]: string }>({});
        getAllExtractText().then(value => { texts.value = value; }).catch(() => { });
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
            if (multiselect.value) setHookCodeInject?.([...hookCodes.value, '' + h]);
            else setHookCodeInject?.(['' + h]);
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
        onMounted(() => {
            console.log(top.value);
        });

        return {
            hookCodes,
            texts,
            setHookCode,
            multiselect,
            clear,
            top
        };
    }
});
</script>

<style scoped>
.sucess {
    background: #52c41a;
    border-color: #52c41a;
}
.break-all {
    word-break: break-all;
}
</style>
