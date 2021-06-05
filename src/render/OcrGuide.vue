<template>
  <div>
    <a-steps :current="current">
      <a-step
        v-for="item in steps"
        :key="item"
        :title="item"
      />
    </a-steps>
    <div
      v-if="current === 0"
      class="steps-content"
    >
      <div class="screen-wrapper">
        <a-typography-title :level="4">
          滑动滑块调整识别区域
          <a-button
            shape="round"
            type="primary"
            @click="reload(true)"
          >
            <template #icon>
              <reload-outlined />
            </template>
            重新加载截图
          </a-button>
        </a-typography-title>
        <div>
          <div class="left" />
          <div class="center">
            <a-slider
              v-model:value="width"
              range
              :tip-formatter="null"
              :max="size[0]"
            />
          </div>
          <div class="right" />
        </div>
        <div>
          <div class="left">
            <a-slider
              v-model:value="height"
              range
              vertical
              :tip-formatter="null"
              :max="size[1]"
            />
          </div>
          <div
            class="center"
            style="position: relative"
          >
            <div
              :style="{
                position: 'absolute',
                left: (width[0] / size[0]) * 100 + '%',
                bottom: (height[0] / size[1]) * 100 + '%',
                width:
                  ((width[1] - width[0]) / size[0]) * 100 +
                  '%',
                height:
                  ((height[1] - height[0]) / size[1]) * 100 +
                  '%',
                border: 'red 1px solid',
              }"
            />
            <img
              v-if="screen"
              :src="screen"
              style="width: 100%"
            >
          </div>
          <div class="right">
            <a-slider
              v-model:value="height"
              range
              vertical
              :tip-formatter="null"
              :max="size[1]"
            />
          </div>
        </div>
        <div>
          <div class="left" />
          <div class="center">
            <a-slider
              v-model:value="width"
              range
              :tip-formatter="null"
              :max="size[0]"
            />
          </div>
          <div class="right" />
        </div>
      </div>
      <a-space>
        <a-button
          type="primary"
          @click="next"
        >
          下一步
        </a-button>
      </a-space>
    </div>
    <div
      v-if="current === 1"
      class="steps-content"
    >
      <a-typography-title :level="4">
        预处理
        <a-button
          shape="round"
          type="primary"
          @click="reload(true)"
        >
          <template #icon>
            <reload-outlined />
          </template>
          重新加载截图
        </a-button>
      </a-typography-title>
      <a-form
        layout="horizontal"
        :label-col="{ span: 4 }"
        :wrapper-col="{ span: 20 }"
      >
        <a-form-item label="颜色">
          <a-radio-group
            v-model:value="color"
            :options="[
              { label: '彩色', value: 'colorful' },
              { label: '灰度', value: 'grey' },
              { label: '仅R通道', value: 'red' },
              { label: '仅G通道', value: 'green' },
              { label: '仅B通道', value: 'blue' },
            ]"
          />
        </a-form-item>
        <a-form-item>
          <template #label>
            <a-checkbox v-model:checked="thresholdEnable">
              二值化
            </a-checkbox>
          </template>
          <a-slider
            v-model:value="threshold"
            :max="255"
          />
        </a-form-item>
        <a-form-item label="预览">
          <img
            v-if="preprocess"
            :src="preprocess"
            style="width: 100%"
          >
        </a-form-item>
      </a-form>
      <a-space>
        <a-button
          type="primary"
          @click="next"
        >
          完成
        </a-button>
        <a-button @click="prev">
          上一步
        </a-button>
      </a-space>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, toRaw, computed } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import {
    getScreenCapture,
    getScreenCaptureCropRect,
    setScreenCaptureCropRect,
    getScreenCapturePreprocessOption,
    setScreenCapturePreprocessOption
} from '@render/remote';
const sharp = require('sharp');

export default defineComponent({
    components: {
        ReloadOutlined
    },
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

        const reload = (force = false) => getScreenCapture(force)
            .then(img => {
                imageBuffer = Buffer.from(img);
                preprocess.value = screen.value = 'data:image/png;base64,' + imageBuffer.toString('base64');
                return sharp(imageBuffer).metadata();
            })
            .then(meta => {
                size.value[0] = meta.width ?? 1;
                size.value[1] = meta.height ?? 1;
                return getScreenCaptureCropRect();
            })
            .then(v => (v ?? {
                left: 0,
                top: 0,
                width: size.value[0],
                height: size.value[1]
            }))
            .then(v => {
                width.value[0] = v.left;
                width.value[1] = v.left + v.width;
                height.value[0] = size.value[1] - v.top - v.height;
                height.value[1] = size.value[1] - v.top;
                screenReady = true;
                return getScreenCapturePreprocessOption();
            })
            .then(o => {
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
            height: height.value[1] - height.value[0]
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
                threshold: thresholdEnable.value ? threshold.value : undefined
            });
        };
        const _updatePreprocess = async () => {
            if (!imageBuffer) return;
            let image = sharp(imageBuffer);
            if (color.value === 'grey') {
                image = image.greyscale();
            } else if (['red', 'green', 'blue'].includes(color.value)) {
                image = image.extractChannel(color.value);
            }
            if (thresholdEnable.value) {
                image = image.threshold(threshold.value, { greyscale: false });
            }
            preprocess.value = 'data:image/png;base64,' + (await image.png().toBuffer()).toString('base64');
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
            reload
        };
    }
});
</script>

<style>
body {
    padding: 16px;
}
</style>

<style scoped>
.steps-content {
    margin-top: 16px;
    margin-left: 30px;
    margin-right: 30px;
}
.screen-wrapper {
    display: flex;
    flex-direction: column;
}
.screen-wrapper > div {
    display: flex;
    flex-direction: row;
}
.screen-wrapper .left,
.screen-wrapper .right {
    width: 40px;
}
.screen-wrapper .center {
    flex-grow: 1;
}
.screen-wrapper img {
    max-width: 100%;
}
</style>
