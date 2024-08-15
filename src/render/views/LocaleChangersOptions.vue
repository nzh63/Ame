<template>
  <t-layout class="option-layout">
    <t-content class="option-content">
      <t-space
        class="option-content"
        direction="vertical"
      >
        <t-skeleton v-if="updating" />
        <t-form
          v-else
          label-align="top"
        >
          <t-form-item
            v-for="i in options"
            :key="i.name"
          >
            <template #label>
              <t-input
                v-if="i.editingName"
                :value="i.name"
                @change="hasUnsavedChange = true"
                @blur="i.editingName = false"
              />
              <t-space
                v-else
                size="small"
              >
                <span>{{ i.name }}</span>
                <t-button
                  size="small"
                  variant="text"
                  @click="i.editingName = true"
                >
                  <edit-icon />
                </t-button>
                <t-popconfirm
                  content="确认删除？"
                  @confirm="del(i)"
                >
                  <t-button
                    size="small"
                    variant="text"
                  >
                    <delete-1-icon />
                  </t-button>
                </t-popconfirm>
              </t-space>
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
          </t-form-item>
        </t-form>
        <t-button
          variant="dashed"
          class="add"
          @click="add"
        >
          <template #icon>
            <add-icon />
          </template>
          新建
        </t-button>
      </t-space>
    </t-content>
    <t-footer
      v-if="options.length !== 0"
      class="option-footer"
    >
      <t-space>
        <t-button
          theme="primary"
          @click="save"
        >
          保存并应用
        </t-button>
        <t-button
          theme="default"
          @click="$router.push('/')"
        >
          放弃
        </t-button>
      </t-space>
    </t-footer>
  </t-layout>
</template>

<script lang="ts">
import { quote } from 'shell-quote';
import { defineComponent, ref } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { Delete1Icon } from 'tdesign-icons-vue-next';

import { checkIfUnsaved } from '@render/utils';
import InputWithOpenFile from '@render/component/InputWithOpenFile.vue';
import store from '@render/store';

export default defineComponent({
    components: {
        Delete1Icon,
        InputWithOpenFile
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
        const check = checkIfUnsaved(hasUnsavedChange, router);
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
                .then(() => { MessagePlugin.success('已成功保存'); hasUnsavedChange.value = false; })
                .catch((e: any) => MessagePlugin.error(e.message ?? e));
        };

        const pathTransform = (p: string) => `& ${quote([p])} %GAME%`;

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
    width: 100%;
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
