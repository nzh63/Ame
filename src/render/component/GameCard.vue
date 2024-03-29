<template>
  <a-card
    class="game-card"
    hoverable
  >
    <transition
      name="slide"
      mode="out-in"
    >
      <a-card-meta
        v-if="!showEdit"
        :title="name"
        :description="path"
      />
      <a-form
        v-else
        layout="horizontal"
        :model="formState"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
      >
        <a-form-item label="标题">
          <a-input
            v-model:value="formState.name"
            placeholder="标题"
          />
        </a-form-item>
        <a-form-item label="路径">
          <input-with-open-file
            v-model:value="formState.path"
            placeholder="路径"
          />
        </a-form-item>
        <a-form-item label="提取方法">
          <a-select v-model:value="formState.type">
            <a-select-option value="textractor">
              Textractor
            </a-select-option>
            <a-select-option value="ocr">
              OCR
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="HookCode">
          <a-input
            v-model:value="formState.hookCode"
            :disabled="formState.type !== 'textractor'"
            placeholder=""
          />
        </a-form-item>
        <a-form-item label="启动参数">
          <a-input
            v-model:value="formState.execShell"
            placeholder=""
          />
        </a-form-item>
      </a-form>
    </transition>
    <template #actions>
      <a-button
        v-if="!showEdit"
        key="setting"
        type="link"
        @click="edit"
      >
        <setting-outlined />
      </a-button>
      <a-button
        v-else
        type="primary"
        shape="circle"
        @click="save"
      >
        <save-filled />
      </a-button>
      <spin
        v-if="!showEdit"
        :spinning="starting"
      >
        <a-button
          key="play"
          type="link"
          :disabled="starting"
          @click="play"
        >
          <play-circle-outlined />
        </a-button>
      </spin>
      <a-button
        v-else
        key="return"
        type="link"
        @click="showEdit = false"
      >
        <spin :spinning="starting">
          <a-button type="link">
            <rollback-outlined />
          </a-button>
        </spin>
      </a-button>
      <a-popconfirm
        title="确认删除？"
        ok-text="是"
        cancel-text="否"
        @confirm="$emit('del', id)"
      >
        <a-button type="link">
          <delete-outlined />
        </a-button>
      </a-popconfirm>
    </template>
  </a-card>
</template>

<script lang="ts">
import { defineComponent, PropType, toRaw } from 'vue';
import message from 'ant-design-vue/es/message';
import InputWithOpenFile from '@render/component/InputWithOpenFile.vue';
import Spin from '@render/component/Spin';
import { startGame, startExtract } from '@render/remote';

export default defineComponent({
    components: {
        InputWithOpenFile,
        Spin
    },
    props: {
        uuid: {
            type: String,
            default: ''
        },
        name: {
            type: String,
            default: ''
        },
        path: {
            type: String,
            default: ''
        },
        type: {
            type: String as PropType<Ame.Extractor.ExtractorType>,
            default: 'textractor'
        },
        hookCode: {
            type: String,
            default: ''
        },
        execShell: {
            type: String,
            default: ''
        },
        id: {
            type: Number,
            required: true
        }
    },
    emits: ['del', 'save'],
    data() {
        return {
            showEdit: false,
            starting: false,
            formState: {
                name: '',
                path: '',
                execShell: '',
                type: '',
                hookCode: ''
            }
        };
    },
    methods: {
        edit() {
            this.showEdit = !this.showEdit;
            const { formState } = this;
            type formStateKey = keyof typeof formState;
            for (const i in formState) {
                formState[i as formStateKey] = this[i as formStateKey];
            }
        },
        save() {
            this.showEdit = !this.showEdit;
            this.$emit('save', this.id, { ...this.formState, uuid: this.uuid });
        },
        async play() {
            this.starting = true;
            try {
                const { pids } = await startGame(toRaw(this.$props));
                startExtract(this.uuid, pids, this.hookCode, this.type);
            } catch (e: any) {
                message.error(`启动失败：${e.message ?? e}`);
            }
            this.starting = false;
        }
    }
});
</script>

<style scoped>
.game-card {
    cursor: auto;
    display: inline-flex;
    flex-direction: column;
}
:deep(.ant-btn-link) {
    color: inherit;
    font-size: large;
    line-height: 100%;
}
:deep(.ant-card-body) {
    flex-grow: 1;
}
:deep(.ant-card-meta-description) {
    word-break: break-all;
}
:deep(.ant-btn-link span[role="img"]) {
    line-height: 0;
}
.open:hover {
    color: #40a9ff;
}
.slide-enter-active,
.slide-leave-active {
    transition: all 0.2s ease-out;
}

.slide-enter-from {
    transform: translateX(-20%);
    opacity: 0;
}
.slide-leave-to {
    transform: translateX(20%);
    opacity: 0;
}
</style>
