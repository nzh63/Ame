<template>
    <div class="title-bar" :class="{ hidden: hideTitleBar }">
        <a-radio-group
            :value="$router.currentRoute.value.path"
            size="small"
            @change="navigation"
        >
            <a-radio-button value="/translator">translator</a-radio-button>
            <a-radio-button value="/hook-select">hook-select</a-radio-button>
        </a-radio-group>
        <span class="drag"></span>
        <a-radio-group value="null" size="small">
            <a-radio-button value="a" @click="minimizeWindow">
                <line-outlined />
            </a-radio-button>
            <a-radio-button
                value="b"
                v-if="running"
                @click="
                    setRunning(false);
                    running = false;
                "
                ><pause-outlined />
            </a-radio-button>
            <a-radio-button
                value="b"
                v-else
                @click="
                    setRunning(true);
                    running = true;
                "
            >
                <caret-right-outlined />
            </a-radio-button>
            <a-radio-button
                value="c"
                v-if="alwaysOnTop"
                @click="
                    setWindowAlwaysOnTop(false);
                    alwaysOnTop = false;
                "
            >
                <unlock-outlined />
            </a-radio-button>
            <a-radio-button
                v-else
                @click="
                    setWindowAlwaysOnTop(true);
                    alwaysOnTop = true;
                "
            >
                <lock-outlined />
            </a-radio-button>
        </a-radio-group>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, inject, Ref } from 'vue';
import { LineOutlined, PauseOutlined, CaretRightOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons-vue';
import type { RadioChangeEvent } from 'ant-design-vue/lib/radio/interface';
import { useRouter } from 'vue-router';

import { minimizeWindow, setWindowAlwaysOnTop } from '@render/remote';

export default defineComponent({
    components: {
        LineOutlined, PauseOutlined, CaretRightOutlined, LockOutlined, UnlockOutlined
    },
    props: {
        hideTitleBar: {
            type: Boolean,
            required: true
        }
    },
    setup() {
        const alwaysOnTop = ref(false);

        const router = useRouter();
        const navigation = (event: RadioChangeEvent) => {
            router.push(event.target.value);
        };

        const running = inject<Ref<boolean>>('running') ?? ref(true);
        const setRunning = inject<(r: boolean) => void>('setRunning') ?? (() => { });

        return {
            alwaysOnTop,
            navigation,
            minimizeWindow,
            setWindowAlwaysOnTop,
            running,
            setRunning
        };
    }
});
</script>

<style scoped>
.title-bar {
    width: 100%;
    height: 24px;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
}
.title-bar .drag {
    -webkit-app-region: drag;
    flex-grow: 1;
}
.hidden {
    visibility: hidden;
}
</style>
