<template>
    <a-layout class="option-layout">
        <a-layout-content class="option-content">
            <a-skeleton v-if="updating" />
            <a-form v-else layout="vertical">
                <a-form-item v-for="i in options" :key="i.name">
                    <template #label>
                        <a-input
                            v-if="i.editingName"
                            v-bind:value="i.name"
                            @change="hasUnsavedChange = true"
                            @blur="i.editingName = false"
                        />
                        <a-space v-else>
                            <span>{{ i.name }}</span>
                            <edit-outlined @click="i.editingName = true" />
                            <a-popconfirm
                                title="确认删除？"
                                ok-text="是"
                                cancel-text="否"
                                @confirm="del(i)"
                            >
                                <delete-outlined />
                            </a-popconfirm>
                        </a-space>
                    </template>
                    <input-with-open-file
                        :value="i.execShell"
                        :path-transform="pathTransform"
                        :placeholder="i.placeholder"
                        @update:value="
                            (v) => {
                                hasUnsavedChange = true;
                                if (v) {
                                    i.execShell = v;
                                } else {
                                    i.execShell = '';
                                }
                            }
                        "
                    />
                </a-form-item>
            </a-form>
            <a-button type="dashed" class="add" @click="add">
                <plus-outlined /> 新建</a-button
            >
        </a-layout-content>
        <a-layout-footer v-if="options.length !== 0" class="option-footer">
            <a-space>
                <a-button type="primary" @click="save">保存并应用</a-button>
                <a-button @click="$router.push('/')">放弃</a-button>
            </a-space>
        </a-layout-footer>
    </a-layout>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons-vue';

import { checkIfUnsaved } from '@render/utils';
import InputWithOpenFile from '@render/component/InputWithOpenFile.vue';
import store from '@render/store';

export default defineComponent({
    components: {
        InputWithOpenFile,
        PlusOutlined,
        DeleteOutlined,
        EditOutlined
    },
    setup() {
        const updating = ref(false);

        const options = ref<{
            name: string;
            execShell: string;
            enable: boolean;
            placeholder?: string;
            editingName?: boolean;
        }[]>([]);
        store.get('localeChangers')
            .then((o) => {
                updating.value = false;
                options.value = o;
                if (options.value[0]?.name !== 'Locale Emulator') {
                    options.value.unshift({
                        name: 'Locale Emulator',
                        execShell: '',
                        enable: false,
                        placeholder: 'LEProc.exe'
                    });
                } else {
                    options.value[0].placeholder = 'LEProc.exe';
                }
            });

        const hasUnsavedChange = ref(false);

        const router = useRouter();
        const check = checkIfUnsaved(() => hasUnsavedChange.value, router);
        onBeforeRouteLeave(check);
        onBeforeRouteUpdate(check);

        const add = () => {
            hasUnsavedChange.value = true;
            options.value.push({
                name: 'name' + options.value.length,
                execShell: '',
                enable: false
            });
        };

        function toRaw<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
        const save = () => {
            store.set('localeChangers', toRaw(
                options.value
                    .map(i => { delete i.editingName; return i; })
                    .map(i => { delete i.placeholder; return i; })
                    .map(i => { i.enable = !!i.execShell.trim(); return i; })
            ))
                .then(() => { message.success('已成功保存'); hasUnsavedChange.value = false; })
                .catch((e: any) => message.error(e.message ?? e));
        };

        const pathTransform = (p: string) => `&'${p}' '%GAME%'`;

        const del = (i: typeof options.value[number]) => {
            options.value.splice(options.value.findIndex(j => i === j), 1);
        };

        return {
            updating,
            options,
            hasUnsavedChange,
            add,
            save,
            del,
            pathTransform
        };
    }
});
</script>

<style scoped>
.option-layout {
    background: unset;
    height: 100%;
}
.option-content {
    overflow: auto;
}
.option-footer {
    background: unset;
    padding: 12px 0 0 0;
}
.add {
    width: 100%;
    text-align: center;
}
</style>
