<template>
  <t-layout class="option-layout">
    <t-content class="option-content">
      <div v-if="providerId && providerId !== '<none>'" class="title">
        {{ providerId }}
      </div>
      <div v-if="description" class="description">
        {{ description }}
      </div>

      <t-form v-if="optionsEditList.length !== 0" label-align="top">
        <t-form-item v-for="i in optionsEditList" :key="i.key.join('.')">
          <template #label>
            <t-space size="small">
              <span>
                {{ i.readableName }}
              </span>
              <span class="key">
                {{ i.key.join('.') }}
              </span>
            </t-space>
          </template>
          <t-select
            v-if="i.enum !== undefined && i.enumSelectId !== undefined"
            ref="select"
            :value="i.enumSelectId"
            @change="(v: any) => onUpdateEnum(v, i.key, i)"
          >
            <t-option v-for="(value, index) in i.enum" :key="index" :value="index" :label="stringify(value)">
              {{ stringify(value) }}
            </t-option>
          </t-select>
          <t-input v-else :value="i.optionsValueString" @change="(v: any) => onUpdate(v, i.key, i)">
            <template #suffix>
              <t-space size="small">
                <t-tag v-for="j in i.typeInfo" :key="j">
                  {{ j }}
                </t-tag>
              </t-space>
            </template>
          </t-input>
          <template #help>
            <span v-if="i.help" class="error-message">
              {{ i.help }}
            </span>
            <span v-else-if="i.description">{{ i.description }}</span>
          </template>
        </t-form-item>
        <div />
      </t-form>
      <t-skeleton v-else-if="updating" :delay="200" />
      <t-space v-else direction="vertical" align="center" style="display: flex; margin-top: var(--td-comp-margin-xxl)">
        <adjustment-icon class="empty" />
        <span>没有可以调整的选项哦</span>
      </t-space>
    </t-content>
    <t-footer v-if="optionsEditList.length !== 0" class="option-footer">
      <t-space>
        <t-button theme="primary" @click="save"> 保存并应用 </t-button>
        <t-button theme="default" @click="$router.push('/')"> 放弃 </t-button>
      </t-space>
    </t-footer>
  </t-layout>
</template>

<script lang="ts">
import type { JSONSchema } from '@main/schema';
import { getProviderOptionsMeta, getProviderOptions, setProviderOptions } from '@remote';
import { checkIfUnsaved } from '@render/utils';
import { MessagePlugin } from 'tdesign-vue-next';
import { defineComponent, ref, toRaw, watch, nextTick } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router';

export default defineComponent({
  props: {
    providerId: {
      type: String,
      required: true,
    },
    getMeta: {
      type: Function as () => any,
      default: getProviderOptionsMeta.bind(globalThis, 'translate') as () => any,
    },
    getOptions: {
      type: Function as () => any,
      default: getProviderOptions.bind(globalThis, 'translate') as () => any,
    },
    setOptions: {
      type: Function as () => any,
      default: setProviderOptions.bind(globalThis, 'translate') as () => any,
    },
  },
  setup(props) {
    const updating = ref(false);

    const description = ref('');
    const optionsJSONSchema = ref<JSONSchema>({});
    const optionsDescription = ref<any>({});
    const options = ref<any>({});
    const reSetup = () => {
      updating.value = true;
      optionsEditList.value = [];
      return Promise.all([props.getMeta(props.providerId), props.getOptions(props.providerId)]).then(([m, o]) => {
        updating.value = false;
        description.value = m.description;
        optionsJSONSchema.value = m.jsonSchema;
        optionsDescription.value = m.optionsDescription;
        options.value = o;
        updateOptionsEditList();
      });
    };
    nextTick(reSetup);

    watch(props, reSetup);

    interface ListItem {
      optionsValue: any;
      optionsValueString: string;
      description?: string;
      readableName: string;
      key: (string | number)[];
      typeInfo: string[];
      enum?: readonly any[];
      enumSelectId: number;
      help?: string;
    }
    const updateOptionsEditList = () => {
      const list: ListItem[] = [];
      function f(
        root: JSONSchema | boolean | undefined,
        options: any,
        optionsDescription: any,
        key: (string | number)[] = [],
      ) {
        if (!root || root === true) return;
        if (root.type === 'object') {
          Object.keys(root.properties ?? {}).forEach((i) =>
            f(root.properties?.[i], options?.[i], optionsDescription?.[i], [...key, i]),
          );
        } else if (root.type === 'array' && optionsDescription instanceof Array) {
          const items = root.items;
          if (items instanceof Array) {
            items.forEach((i, index) => f(items[index], options[index], optionsDescription[index], [...key, index]));
          } else {
            optionsDescription.forEach((i, index) =>
              f(items, options[index], optionsDescription[index], [...key, index]),
            );
          }
        } else {
          const item: ListItem = {
            optionsValue: options,
            optionsValueString:
              options === null ? '<null>' : typeof options === 'string' ? options : (JSON.stringify(options) ?? ''),
            description: optionsDescription?.description,
            readableName: optionsDescription?.readableName ?? optionsDescription ?? key.join('.'),
            key,
            typeInfo:
              typeof root.type === 'string' ? [root.type] : (root.anyOf?.map((i) => (i as any).type as string) ?? []),
            enumSelectId: -1,
          };
          if (root.enum || root.examples) {
            item.enum = root.enum || root.examples;
            item.enumSelectId = item.enum!.findIndex((i) => JSON.stringify(i) === JSON.stringify(options));
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
      const nullable = i.typeInfo.some((i) => i === 'null');
      const isNumber = i.typeInfo.some((i) => i === 'number');
      const isArray = i.typeInfo.some((i) => i === 'array');
      const isString = i.typeInfo.some((i) => i === 'string');
      const isUnion = i.typeInfo.length > 1;
      if (nullable) {
        if (newValue === '<null>') {
          newValue = null;
        } else if (!isUnion) {
          i.help = key.join('.') + ' 应当为null（输入<null>）';
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
        hasUnsavedChange.value ||= c[key[key.length - 1]] !== newValue;
        c[key[key.length - 1]] = newValue;
      } else {
        hasUnsavedChange.value ||= options.value !== newValue;
        options.value = newValue;
      }

      i.optionsValueString =
        newValue === null ? '<null>' : typeof newValue === 'string' ? newValue : JSON.stringify(newValue);
    };
    const onUpdateEnum = (index: number, key: (string | number)[], i: ListItem) => {
      if (i.enum === undefined) return;
      const newValue = i.enum[index];
      let c: any = options.value;
      for (let i = 0; i < key.length - 1; i++) {
        c = c[key[i]];
      }
      if (key.length) {
        hasUnsavedChange.value ||= c[key[key.length - 1]] !== newValue;
        c[key[key.length - 1]] = newValue;
      } else {
        hasUnsavedChange.value ||= options.value !== newValue;
        options.value = newValue;
      }
      i.optionsValueString =
        newValue === null ? '<null>' : typeof newValue === 'string' ? newValue : JSON.stringify(newValue);
      i.enumSelectId = index;
    };

    const save = () => {
      props
        .setOptions(props.providerId, toRaw(options.value))
        .then(() => {
          MessagePlugin.success('已成功保存');
          hasUnsavedChange.value = false;
        })
        .catch((e: any) => MessagePlugin.error(e.message ?? e));
    };

    const router = useRouter();
    const check = checkIfUnsaved(hasUnsavedChange, router);
    onBeforeRouteLeave(check);
    onBeforeRouteUpdate(check);

    const stringify = (value: unknown) => {
      return typeof value === 'string' ? value : JSON.stringify(value);
    };

    return {
      description,
      updating,
      optionsEditList,
      onUpdate,
      onUpdateEnum,
      save,
      stringify,
    };
  },
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
  color: var(--td-text-color-primary);
  font: var(--td-font-title-large);
}
.description {
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-medium);
  white-space: pre-line;
  margin-bottom: 8px;
}
.title + :not(.description) {
  margin-top: 8px;
}
.key {
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-small);
}
.error-message {
  color: var(--td-error-color);
}
.empty {
  display: block;
  color: var(--td-gray-color-7);
  font: var(--td-font-headline-large);
}
</style>
