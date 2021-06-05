<template>
  <div>
    <a-form
      :label-col="{ span: 3 }"
      :wrapper-col="{ span: 21 }"
    >
      <a-form-item label="提取方法">
        <a-select
          :value="type"
          @change="changeType"
        >
          <a-select-option value="textractor">
            Textractor
          </a-select-option>
          <a-select-option value="ocr">
            OCR
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item
        v-if="type === 'textractor'"
        label="详细设置"
      >
        <textractor-setting />
      </a-form-item>
      <a-form-item
        v-if="type === 'ocr'"
        label=""
      >
        <a-button
          type="primary"
          @click="openOcrGuideWindow"
        >
          <template #icon>
            <reload-outlined />
          </template>
          再次启动Ocr引导界面
        </a-button>
      </a-form-item>
    </a-form>
  </div>
</template>

<script lang="ts">
import { defineComponent, inject, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import TextractorSetting from '@render/component/TextractorSetting.vue';
import { switchExtractorType, getExtractorType, openOcrGuideWindow } from '@render/remote';

export default defineComponent({
    components: {
        TextractorSetting,
        ReloadOutlined
    },
    setup() {
        const type = ref<Ame.Extractor.ExtractorType>('textractor');
        getExtractorType()
            .then(t => {
                type.value = t;
            });

        const setHookCodeInject = inject<(h: string) => void>('setHookCode');
        const setRunning = inject<(h: boolean) => void>('setRunning');

        const changeType = async (newType: Ame.Extractor.ExtractorType) => {
            setRunning?.(false);
            setHookCodeInject?.('');
            await switchExtractorType(newType);
            type.value = newType;
        };

        return {
            screen,
            type,
            changeType,
            openOcrGuideWindow
        };
    }
});
</script>

<style scoped>
.screen-wrapper {
    display: flex;
    flex-direction: column;
    max-width: 400px;
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
