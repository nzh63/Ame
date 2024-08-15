<template>
  <div>
    <t-form>
      <t-form-item label="文本大小">
        <t-slider
          :value="fontSize"
          :min="6"
          :max="100"
          tooltip-placement="bottom"
          @change-end="v => changeFontSize(v as number)"
        />
      </t-form-item>
      <t-form-item label="提取方法">
        <t-select
          :value="type"
          @change="v => changeType(v as Ame.Extractor.ExtractorType)"
        >
          <t-option
            value="textractor"
            label="Textractor"
          />
          <t-option
            value="ocr"
            label="OCR"
          />
        </t-select>
      </t-form-item>
      <t-form-item
        v-if="type === 'textractor'"
        label="详细设置"
      >
        <textractor-setting />
      </t-form-item>
      <t-form-item
        v-if="type === 'ocr'"
        label=""
      >
        <t-button
          theme="primary"
          @click="openOcrGuideWindow"
        >
          <template #icon>
            <refresh-icon />
          </template>
          再次启动Ocr引导界面
        </t-button>
      </t-form-item>
    </t-form>
  </div>
</template>

<script lang="ts">
import { defineComponent, inject, Ref, ref } from 'vue';
import TextractorSetting from '@render/component/TextractorSetting.vue';
import { switchExtractorType, getExtractorType, openOcrGuideWindow } from '@render/remote';
import store from '@render/store';

export default defineComponent({
    components: {
        TextractorSetting
    },
    setup() {
        const type = ref<Ame.Extractor.ExtractorType>('textractor');
        getExtractorType()
            .then(t => {
                type.value = t;
            });

        const setHookCodeInject = inject<(h: string) => void>('setHookCode');
        const setRunning = inject<(h: boolean) => void>('setRunning');
        const _fontSize = inject<Ref<number>>('fontSize');
        const fontSize = ref(_fontSize?.value);

        const changeFontSize = async (value: number) => {
            fontSize.value = value;
            if (_fontSize) _fontSize.value = value;
            await store.set('ui.fontSize', value);
        };

        const changeType = async (newType: Ame.Extractor.ExtractorType) => {
            setRunning?.(false);
            setHookCodeInject?.('');
            await switchExtractorType(newType);
            type.value = newType;
        };

        return {
            screen,
            fontSize,
            type,
            changeFontSize,
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
