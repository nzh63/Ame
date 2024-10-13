<template>
  <div :class="{ 'title-bar': true, hidden: hideTitleBar }">
    <t-radio-group
      :value="$router.currentRoute.value.path"
      variant="default-filled"
      size="small"
      @change="(v) => navigation(v as string)"
    >
      <t-radio-button value="/translator"> 翻译 </t-radio-button>
      <t-radio-button value="/hook-select"> 文本选择 </t-radio-button>
      <t-radio-button value="/extract-setting"> 提取设置 </t-radio-button>
    </t-radio-group>
    <span class="drag" />
    <t-radio-group value="null" variant="default-filled" size="small">
      <t-radio-button @click="minimizeWindow">
        <minus-icon class="icon" />
      </t-radio-button>
      <t-radio-button @click="setRunning(!running)">
        <pause-icon v-if="running" class="icon" />
        <play-icon v-else class="icon" />
      </t-radio-button>
      <t-radio-button @click="setWindowAlwaysOnTop(!alwaysOnTop)">
        <pin-filled-icon
          class="icon pin"
          :style="{
            transform: alwaysOnTop ? 'rotate(-45deg)' : '',
          }"
        />
      </t-radio-button>
    </t-radio-group>
  </div>
</template>

<script lang="ts">
import * as remote from '@remote';
import type { Ref } from 'vue';
import { defineComponent, ref, inject, nextTick } from 'vue';
import { useRouter } from 'vue-router';

export default defineComponent({
  props: {
    hideTitleBar: {
      type: Boolean,
      required: true,
    },
  },
  emits: ['update:hideTitleBar'],
  setup(prop, context) {
    const alwaysOnTop = ref(false);

    const router = useRouter();
    const navigation = (value: string) => {
      router.push(value);
    };

    const running = inject<Ref<boolean>>('running') ?? ref(true);
    const setRunning = inject<(r: boolean) => void>('setRunning') ?? (() => {});

    const setWindowAlwaysOnTop = (flag: boolean) => {
      alwaysOnTop.value = flag;
      return remote.setWindowAlwaysOnTop(flag);
    };

    const minimizeWindow = async () => {
      context.emit('update:hideTitleBar', true);
      await nextTick();
      return remote.minimizeWindow();
    };

    return {
      alwaysOnTop,
      navigation,
      minimizeWindow,
      setWindowAlwaysOnTop,
      running,
      setRunning,
    };
  },
});
</script>

<style scoped>
.title-bar {
  width: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  --td-bg-color-component: transparent;
}
.title-bar .drag {
  -webkit-app-region: drag;
  flex-grow: 1;
}
.hidden {
  opacity: 0;
  visibility: hidden;
}
.icon {
  font-size: 24px;
}
.icon.pin {
  padding: 6px 0;
}
</style>
