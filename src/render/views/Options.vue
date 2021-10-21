<template>
  <a-layout class="option-layout">
    <a-layout-content class="option-content">
      <a-typography-title
        v-if="id"
        :level="4"
        class="title"
      >
        {{ id }}
      </a-typography-title>
      <div
        v-if="description"
        class="description"
      >
        <a-typography-text type="secondary">
          {{ description }}
        </a-typography-text>
      </div>
      <a-form
        v-if="optionsEditList.length !== 0"
        layout="vertical"
      >
        <a-form-item
          v-for="i in optionsEditList"
          :key="i.key"
        >
          <template #label>
            <a-space>
              {{ i.readableName }}
              <a-typography-text
                v-if="i.readableName !== i.key.join('.')"
                type="secondary"
              >
                {{ i.key.join(".") }}
              </a-typography-text>
            </a-space>
          </template>
          <a-select
            v-if="
              i.enum !== undefined && i.enumSelectId !== undefined
            "
            ref="select"
            v-model:value="i.enumSelectId"
            @change="onUpdateEnum(i.enumSelectId, i.key, i)"
          >
            <a-select-option
              v-for="(value, index) in i.enum"
              :key="index"
              :value="index"
              :title="stringify(value)"
            >
              {{ stringify(value) }}
            </a-select-option>
          </a-select>
          <a-input
            v-else
            v-model:value="i.optionsValueString"
            @pressEnter="onUpdate(i.optionsValueString, i.key, i)"
            @blur="onUpdate(i.optionsValueString, i.key, i)"
          >
            <template #suffix>
              <a-space>
                <a-badge
                  v-for="j in i.typeInfo"
                  :key="j"
                  :count="j"
                  :number-style="{
                    backgroundColor: 'rgba(0,0,0,0.45)',
                  }"
                />
              </a-space>
            </template>
          </a-input>
          <template
            v-if="i.help"
            #help
          >
            <span class="warning-message">{{ i.help }}</span>
          </template>
          <template
            v-if="i.description"
            #extra
          >
            {{ i.description }}
          </template>
        </a-form-item>
      </a-form>
      <a-skeleton v-else-if="updating" />
      <a-empty v-else />
    </a-layout-content>
    <a-layout-footer
      v-if="optionsEditList.length !== 0"
      class="option-footer"
    >
      <a-space>
        <a-button
          type="primary"
          @click="save"
        >
          保存并应用
        </a-button>
        <a-button @click="$router.push('/')">
          放弃
        </a-button>
      </a-space>
    </a-layout-footer>
  </a-layout>
</template>

<script lang="ts">
import { defineComponent, ref, toRaw, watch, nextTick } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';

import type { JSONSchema } from '@main/schema';
import {
    getTranslateProviderOptionsMeta,
    getTranslateProviderOptions,
    setTranslateProviderOptions
} from '@render/remote';
import { checkIfUnsaved } from '@render/utils';

export default defineComponent({
    props: {
        providerId: {
            type: String,
            required: true
        },
        getMeta: {
            type: Function,
            default: getTranslateProviderOptionsMeta
        },
        getOptions: {
            type: Function,
            default: getTranslateProviderOptions
        },
        setOptions: {
            type: Function,
            default: setTranslateProviderOptions
        }
    },
    setup(props) {
        const updating = ref(false);

        const id = ref(props.providerId);
        const description = ref('');
        const optionsJSONSchema = ref<JSONSchema>({});
        const optionsDescription = ref<any>({});
        const options = ref<any>({});
        const reSetup = () => {
            updating.value = true;
            optionsEditList.value = [];
            return Promise.all([
                props.getMeta(props.providerId),
                props.getOptions(props.providerId)])
                .then(([m, o]) => {
                    updating.value = false;
                    id.value = m.id;
                    description.value = m.description;
                    optionsJSONSchema.value = m.jsonSchema;
                    optionsDescription.value = m.optionsDescription;
                    options.value = o;
                    updateOptionsEditList();
                });
        };
        nextTick(reSetup);

        watch(props, reSetup);

        type ListItem = {
            optionsValue: any,
            optionsValueString: string,
            description?: string,
            readableName: string,
            key: (string | number)[],
            typeInfo: string[],
            enum?: any[],
            enumSelectId: number,
            help?: string
        };
        const updateOptionsEditList = () => {
            const list: ListItem[] = [];
            function f(root: JSONSchema | boolean | undefined, options: any, optionsDescription: any, key: (string | number)[] = []) {
                if (!root || root === true) return;
                if (root.type === 'object') {
                    Object.keys(root.properties ?? {}).forEach(i => f(root.properties?.[i], options?.[i], optionsDescription?.[i], [...key, i]));
                } else if (root.type === 'array' && optionsDescription instanceof Array) {
                    const items = root.items;
                    if (items instanceof Array) {
                        items.forEach((i, index) => f(items[index], options[index], optionsDescription[index], [...key, index]));
                    } else {
                        optionsDescription.forEach((i, index) => f(items, options[index], optionsDescription[index], [...key, index]));
                    }
                } else {
                    const item: ListItem = {
                        optionsValue: options,
                        optionsValueString: options === null ? '<null>' : typeof options === 'string' ? options : JSON.stringify(options) ?? '',
                        description: optionsDescription?.description,
                        readableName: optionsDescription?.readableName ?? optionsDescription ?? key.join('.'),
                        key,
                        typeInfo: typeof root.type === 'string' ? [root.type] : root.anyOf?.map(i => (i as JSONSchema).type as string) ?? [],
                        enumSelectId: -1
                    };
                    if (root.enum) {
                        item.enum = root.enum;
                        item.enumSelectId = root.enum.findIndex(i => JSON.stringify(i) === JSON.stringify(options));
                    }
                    list.push(item);
                }
            }
            f(optionsJSONSchema.value, options.value, optionsDescription.value);
            optionsEditList.value = list;
        };
        const optionsEditList = ref<ListItem[]>([]);

        const hasUnsavedChange = ref(false);

        const onUpdate = (newValueString: string, key: (string | number)[], i: ListItem) => {
            delete i.help;
            let newValue: any = newValueString;
            const nullable = i.typeInfo.some(i => i === 'null');
            const isNumber = i.typeInfo.some(i => i === 'number');
            const isArray = i.typeInfo.some(i => i === 'array');
            const isString = i.typeInfo.some(i => i === 'string');
            const isUnion = i.typeInfo.length > 1;
            if (nullable) {
                if (newValue === '<null>') {
                    newValue = null;
                } else if (!isUnion) {
                    i.help = key.join('.') + ' 应当位null（输入<null>）';
                }
            }
            if (isNumber) {
                if (Number.isNaN(parseFloat(newValue)) || /[^0-9.]/.test(newValueString)) {
                    if (!isArray && !isString) i.help = key.join('.') + ' 应当是一个数字';
                } else {
                    newValue = parseFloat(newValue);
                }
            }
            if (isArray) {
                try {
                    newValue = JSON.parse(newValue);
                } catch (e: any) {
                    if (!isString) i.help = e.message;
                }
            }

            let c: any = options.value;
            for (let i = 0; i < key.length - 1; i++) {
                c = c[key[i]];
            }
            if (key.length) {
                hasUnsavedChange.value = c[key[key.length - 1]] !== newValue;
                c[key[key.length - 1]] = newValue;
            } else {
                hasUnsavedChange.value = options.value !== newValue;
                options.value = newValue;
            }

            i.optionsValueString = newValue === null ? '<null>' : typeof newValue === 'string' ? newValue : JSON.stringify(newValue);
        };
        const onUpdateEnum = (index: number, key: (string | number)[], i: ListItem) => {
            if (i.enum === undefined) return;
            const newValue = i.enum[index];
            let c: any = options.value;
            for (let i = 0; i < key.length - 1; i++) {
                c = c[key[i]];
            }
            if (key.length) {
                hasUnsavedChange.value = c[key[key.length - 1]] !== newValue;
                c[key[key.length - 1]] = newValue;
            } else {
                hasUnsavedChange.value = options.value !== newValue;
                options.value = newValue;
            }
            i.optionsValueString = newValue === null ? '<null>' : typeof newValue === 'string' ? newValue : JSON.stringify(newValue);
        };

        const save = () => {
            props.setOptions(props.providerId, toRaw(options.value))
                .then(() => { message.success('已成功保存'); hasUnsavedChange.value = false; })
                .catch((e: any) => message.error(e.message ?? e));
        };

        const router = useRouter();
        const check = checkIfUnsaved(() => hasUnsavedChange.value, router);
        onBeforeRouteLeave(check);
        onBeforeRouteUpdate(check);

        const stringify = (value: unknown) => {
            return typeof value === 'string' ? value : JSON.stringify(value);
        };

        return {
            id,
            description,
            updating,
            optionsEditList,
            onUpdate,
            onUpdateEnum,
            save,
            stringify
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
.title {
    margin-bottom: 0;
}
.description {
    white-space: pre-line;
    margin-bottom: 8px;
}
.title + :not(.description) {
    margin-top: 8px;
}
.warning-message {
    color: #ff4d4f;
}
</style>
