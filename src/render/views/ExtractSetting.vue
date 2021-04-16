<template>
    <div>
        <a-form :label-col="{ span: 3 }" :wrapper-col="{ span: 21 }">
            <a-form-item label="提取方法">
                <a-select v-model:value="type">
                    <a-select-option value="textractor">
                        Textractor
                    </a-select-option>
                    <a-select-option value="ocr">OCR</a-select-option>
                </a-select>
            </a-form-item>
        </a-form>
        <div v-if="type === 'textractor'" class="screen-wrapper">
            <a-typography-title :level="4">
                滑动滑块调整识别区域
            </a-typography-title>
            <div>
                <div class="left"></div>
                <div class="center">
                    <a-slider
                        range
                        :tipFormatter="null"
                        :max="size[0]"
                        v-model:value="width"
                    />
                </div>
                <div class="right"></div>
            </div>
            <div>
                <div class="left">
                    <a-slider
                        range
                        vertical
                        :tipFormatter="null"
                        :max="size[1]"
                        v-model:value="height"
                    />
                </div>
                <div class="center" style="position: relative">
                    <div
                        :style="{
                            position: 'absolute',
                            left: (width[0] / size[0]) * 100 + '%',
                            bottom: (height[0] / size[1]) * 100 + '%',
                            width:
                                ((width[1] - width[0]) / size[0]) * 100 + '%',
                            height:
                                ((height[1] - height[0]) / size[1]) * 100 + '%',
                            border: 'red 1px solid',
                        }"
                    ></div>
                    <img v-if="screen" :src="screen" style="width: 100%" />
                </div>
                <div class="right">
                    <a-slider
                        range
                        vertical
                        :tipFormatter="null"
                        :max="size[1]"
                        v-model:value="height"
                    />
                </div>
            </div>
            <div>
                <div class="left"></div>
                <div class="center">
                    <a-slider
                        range
                        :tipFormatter="null"
                        :max="size[0]"
                        v-model:value="width"
                    />
                </div>
                <div class="right"></div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, inject, watch, ref } from 'vue';
import { switchExtractorType, getScreenCapture, getScreenCaptureCropRect, setScreenCaptureCropRect } from '@render/remote';

export default defineComponent({
    components: {
    },
    setup() {
        const type = ref<Ame.Extractor.ExtractorType>('textractor');

        const setHookCodeInject = inject<(h: string) => void>('setHookCode');
        const setRunning = inject<(h: boolean) => void>('setRunning');
        watch(type, () => {
            setRunning?.(false);
            setHookCodeInject?.('');
            switchExtractorType(type.value);
        });

        const screen = ref('');
        const size = ref([0, 0]);
        const height = ref([0, 0]);
        const width = ref([0, 0]);
        let ready = false;
        getScreenCapture()
            .then(img => {
                screen.value = img.toDataURL();
                size.value[0] = img.getSize().width;
                size.value[1] = img.getSize().height;
            })
            .then(() => getScreenCaptureCropRect())
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
                ready = true;
            });

        const update = () => {
            if (!ready) return;
            setScreenCaptureCropRect({
                left: width.value[0],
                width: width.value[1] - width.value[0],
                top: size.value[1] - height.value[1],
                height: height.value[1] - height.value[0]
            });
        };
        watch(width, update);
        watch(height, update);

        return {
            screen,
            type,
            size,
            height,
            width
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
