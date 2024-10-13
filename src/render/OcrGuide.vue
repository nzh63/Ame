<template>
  <t-layout>
    <t-header>
      <t-steps :current="current">
        <t-step-item v-for="item in steps" :key="item" :title="item" />
      </t-steps>
    </t-header>
    <t-content v-if="current === 0" class="steps-content">
      <h1>
        滑动滑块调整识别区域
        <t-button shape="round" theme="primary" @click="reload(true)">
          <template #icon>
            <refresh-icon />
          </template>
          重新加载截图
        </t-button>
      </h1>
      <div class="screen">
        <t-slider v-model:value="width" range :tip-formatter="null" :max="size[0]" style="grid-area: top" />
        <t-slider
          v-model:value="height"
          range
          layout="vertical"
          :tip-formatter="null"
          :max="size[1]"
          style="grid-area: left"
        />
        <div style="grid-area: center; position: relative">
          <div
            :style="{
              position: 'absolute',
              left: (width[0] / size[0]) * 100 + '%',
              bottom: (height[0] / size[1]) * 100 + '%',
              width: ((width[1] - width[0]) / size[0]) * 100 + '%',
              height: ((height[1] - height[0]) / size[1]) * 100 + '%',
              border: 'red 1px solid',
            }"
          />
          <img v-if="screen" :src="screen" style="max-width: 100%; max-height: 500px" />
        </div>
        <t-slider
          v-model:value="height"
          range
          layout="vertical"
          :tip-formatter="null"
          :max="size[1]"
          style="grid-area: right"
        />
        <t-slider v-model:value="width" range :tip-formatter="null" :max="size[0]" style="grid-area: bottom" />
      </div>
    </t-content>
    <t-content v-if="current === 1" class="steps-content">
      <h1>
        预处理
        <t-button shape="round" theme="primary" @click="reload(true)">
          <template #icon>
            <refresh-icon />
          </template>
          重新加载截图
        </t-button>
      </h1>
      <t-form>
        <t-form-item label="颜色">
          <t-radio-group
            v-model:value="color"
            :options="[
              { label: '彩色', value: 'colorful' },
              { label: '灰度', value: 'grey' },
              { label: '仅R通道', value: 'red' },
              { label: '仅G通道', value: 'green' },
              { label: '仅B通道', value: 'blue' },
            ]"
          />
        </t-form-item>
        <t-form-item>
          <template #label>
            <t-checkbox v-model:checked="thresholdEnable"> 二值化 </t-checkbox>
          </template>
          <t-slider v-model:value="threshold" :max="255" />
        </t-form-item>
        <t-form-item label="预览">
          <img v-if="preprocess" :src="preprocess" style="max-width: 100%; max-height: 500px" />
        </t-form-item>
      </t-form>
    </t-content>
    <t-footer>
      <t-space>
        <t-button v-if="current === 1" theme="primary" @click="next"> 完成 </t-button>
        <t-button v-if="current < 1" theme="primary" @click="next"> 下一步 </t-button>
        <t-button v-if="current > 0" theme="default" @click="prev"> 上一步 </t-button>
      </t-space>
    </t-footer>
  </t-layout>
</template>

<script lang="ts">
import {
  getScreenCapture,
  getScreenCaptureCropRect,
  setScreenCaptureCropRect,
  getScreenCapturePreprocessOption,
  setScreenCapturePreprocessOption,
  getPreprocessedImage,
} from '@remote';
import electron from 'electron';
import { defineComponent, ref, watch, toRaw, computed } from 'vue';

export default defineComponent({
  setup() {
    const current = ref(0);
    const steps: string[] = ['选择区域', '设置预处理'];
    const next = () => {
      current.value++;
      if (current.value === 2) {
        saveOption();
        window.close();
      }
    };
    const prev = () => {
      current.value--;
    };

    let imageBuffer: Buffer;
    const screen = ref('');
    const preprocess = ref('');
    const size = ref([0, 0]);
    const height = ref([0, 0]);
    const width = ref([0, 0]);
    let screenReady = false;

    const color = ref<'colorful' | 'grey' | 'red' | 'green' | 'blue'>('colorful');
    const thresholdEnable = ref(false);
    const threshold = ref(128);

    const reload = (force = false) =>
      getScreenCapture(force)
        .then((img) => {
          imageBuffer = Buffer.from(img);
          preprocess.value = screen.value = 'data:image/png;base64,' + imageBuffer.toString('base64');
          return electron.nativeImage.createFromBuffer(imageBuffer).getSize();
        })
        .then((meta) => {
          size.value[0] = meta.width ?? 1;
          size.value[1] = meta.height ?? 1;
          return getScreenCaptureCropRect();
        })
        .then(
          (v) =>
            v ?? {
              left: 0,
              top: 0,
              width: size.value[0],
              height: size.value[1],
            },
        )
        .then((v) => {
          width.value = [v.left, v.left + v.width];
          height.value = [size.value[1] - v.top - v.height, size.value[1] - v.top];
          screenReady = true;
          return getScreenCapturePreprocessOption();
        })
        .then((o) => {
          color.value = o.color;
          if (o.threshold !== undefined) {
            thresholdEnable.value = true;
            threshold.value = o.threshold;
          }
          return _updatePreprocess();
        });
    reload();

    const rect = computed(() => ({
      left: width.value[0],
      width: width.value[1] - width.value[0],
      top: size.value[1] - height.value[1],
      height: height.value[1] - height.value[0],
    }));

    const update = () => {
      if (!screenReady) return;
      setScreenCaptureCropRect(toRaw(rect.value));
    };
    watch(width, update);
    watch(height, update);

    const saveOption = () => {
      setScreenCapturePreprocessOption({
        color: color.value,
        threshold: thresholdEnable.value ? threshold.value : undefined,
      });
    };
    const _updatePreprocess = async () => {
      if (!imageBuffer) return;
      const image = await getPreprocessedImage(imageBuffer, {
        color: color.value,
        threshold: thresholdEnable.value ? threshold.value : undefined,
      });
      preprocess.value = 'data:image/png;base64,' + Buffer.from(image).toString('base64');
    };
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const updatePreprocess = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        timeoutId = null;
        saveOption();
        _updatePreprocess();
      }, 100);
    };

    watch(color, updatePreprocess);
    watch(thresholdEnable, updatePreprocess);
    watch(threshold, updatePreprocess);

    return {
      current,
      next,
      prev,
      steps,
      screen,
      preprocess,
      size,
      height,
      width,
      color,
      thresholdEnable,
      threshold,
      reload,
    };
  },
});
</script>

<style>
body {
  padding: var(--td-comp-paddingTB-l) var(--td-comp-paddingLR-l);
  --td-bg-color-page: transparent;
}
</style>

<style scoped>
.steps-content {
  padding: 0 var(--td-comp-paddingLR-l);
}
.screen {
  display: grid;
  grid-template-rows: 20px 1fr 20px;
  grid-template-columns: 0fr 20px auto 20px 1fr;
  grid-template-areas:
    '. . top . .'
    '. left center right .'
    '. . bottom . .';
  grid-gap: 10px;
}
</style>

<style>
::-webkit-scrollbar {
  width: 12px !important;
  height: 12px !important;
}
::-webkit-scrollbar-thumb {
  border: 4px solid transparent !important;
  background-clip: content-box !important;
  background-color: var(--td-scrollbar-color) !important;
  border-radius: 6px !important;
}
::-webkit-scrollbar-thumb:vertical:hover,
::-webkit-scrollbar-thumb:horizontal:hover {
  background-color: var(--td-scrollbar-hover-color) !important;
}
</style>
