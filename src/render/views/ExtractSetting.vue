<template>
    <div>
        <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
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
            <div>
                <div class="left">
                    <a-slider
                        range
                        vertical
                        :max="size[1]"
                        v-model:value="height"
                    />
                </div>
                <div class="right" style="position: relative">
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
            </div>
            <div>
                <div class="left"></div>
                <div class="right">
                    <a-slider range :max="size[0]" v-model:value="width" />
                </div>
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
            .then(v => {
                width.value[0] = v.x;
                width.value[1] = v.x + v.width;
                height.value[0] = size.value[1] - v.y - v.height;
                height.value[1] = size.value[1] - v.y;
                ready = true;
            });

        const update = () => {
            if (!ready) return;
            setScreenCaptureCropRect({
                x: width.value[0],
                width: width.value[1] - width.value[0],
                y: size.value[1] - height.value[1],
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
}
.screen-wrapper > div {
    display: flex;
    flex-direction: row;
}
.screen-wrapper .left {
    width: 40px;
}
.screen-wrapper .right {
    flex-grow: 1;
}
.screen-wrapper img {
    max-width: 100%;
}
</style>
