<template>
  <t-layout class="option-layout">
    <t-content class="option-content">
      <div v-if="name && name !== '<none>'" class="title">
        {{ name }}
      </div>
      <div v-if="description" class="description">
        {{ description }}
      </div>

      <t-form v-if="hasSchema" label-align="top">
        <OptionsSchemaEditor v-model="options" :schema="optionsJSONSchema" :description="optionsDescription" />
        <div />
      </t-form>
      <t-skeleton v-else-if="updating" animation="gradient" theme="paragraph" />
      <t-space v-else direction="vertical" align="center" style="display: flex; margin-top: var(--td-comp-margin-xxl)">
        <adjustment-icon class="empty" />
        <span>没有可以调整的选项哦</span>
      </t-space>
    </t-content>
    <t-footer v-if="hasSchema" class="option-footer">
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
import OptionsSchemaEditor from '@render/component/Options/index.vue';
import { checkIfUnsaved } from '@render/utils';
import { MessagePlugin } from 'tdesign-vue-next';
import { defineComponent, computed, ref, watch, nextTick, provide } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router';

export default defineComponent({
  components: { OptionsSchemaEditor },
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
  async setup(props) {
    const updating = ref(true);

    // eslint-disable-next-line vue/no-setup-props-destructure
    const name = ref(props.providerId);
    const description = ref('');
    const optionsJSONSchema = ref<JSONSchema>({});
    const optionsDescription = ref<any>({});
    const options = ref<any>({});
    const savedSnapshot = ref('');

    const errorCount = ref(0);
    provide('options-validation-error-count', errorCount);

    /** Recursively check if a JSON schema produces any leaf-level form items */
    function hasLeafItems(schema: JSONSchema, desc: any): boolean {
      const s = schema as any;
      if (!s || typeof s !== 'object') return false;
      if (s.type === 'object') {
        const props = s.properties ?? {};
        return Object.keys(props).length > 0 && Object.keys(props).some((key) => hasLeafItems(props[key], desc?.[key]));
      }
      if (s.type === 'array' && desc instanceof Array) {
        const items = s.items;
        if (items instanceof Array) {
          return items.some((item, idx) => hasLeafItems(item, desc[idx]));
        }
        return desc.some((childDesc: any) => hasLeafItems(items ?? {}, childDesc));
      }
      // Leaf type
      return true;
    }

    const hasSchema = computed(
      () =>
        !updating.value && optionsJSONSchema.value && hasLeafItems(optionsJSONSchema.value, optionsDescription.value),
    );

    const hasUnsavedChange = ref(false);
    watch(
      () => JSON.stringify(options.value),
      (val) => {
        hasUnsavedChange.value = val !== savedSnapshot.value;
      },
    );

    const save = () => {
      if (errorCount.value > 0) {
        MessagePlugin.warning('请先修正输入错误再保存');
        return;
      }
      const data = JSON.parse(JSON.stringify(options.value));
      props
        .setOptions(props.providerId, data)
        .then(() => {
          MessagePlugin.success('已成功保存');
          savedSnapshot.value = JSON.stringify(data);
          hasUnsavedChange.value = false;
        })
        .catch((e: any) => MessagePlugin.error(e.message ?? e));
    };

    const router = useRouter();
    const check = checkIfUnsaved(hasUnsavedChange, router);
    onBeforeRouteLeave(check);
    onBeforeRouteUpdate(check);

    let reSetupVersion = 0;
    const reSetup = () => {
      const version = ++reSetupVersion;
      const timeout = setTimeout(() => {
        updating.value = true;
        name.value = '';
        description.value = '';
      }, 200);
      return Promise.all([props.getMeta(props.providerId), props.getOptions(props.providerId)]).then(([m, o]) => {
        clearTimeout(timeout);
        if (version !== reSetupVersion) return;
        updating.value = false;
        name.value = props.providerId;
        description.value = m.description;
        optionsJSONSchema.value = m.jsonSchema;
        optionsDescription.value = m.optionsDescription;
        options.value = o;
        savedSnapshot.value = JSON.stringify(o);
      });
    };

    watch(() => [props.providerId, props.getMeta, props.getOptions], reSetup);
    await reSetup();

    return {
      name,
      description,
      updating,
      hasSchema,
      optionsJSONSchema,
      optionsDescription,
      options,
      save,
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
  /* for box-shadow */
  margin: -5px;
  padding: 5px;
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
.empty {
  display: block;
  color: var(--td-gray-color-7);
  font: var(--td-font-headline-large);
}
</style>
