<template>
  <t-card
    class="game-card"
    hover-shadow
  >
    <template #title>
      <transition
        name="slide"
        mode="out-in"
      >
        <div
          v-if="!showEdit"
          class="name"
        >
          <t-image
            :src="icon"
            class="icon"
          >
            <template #error>
              <file-icon />
            </template>
            <template #loading>
              <file-icon />
            </template>
          </t-image>
          {{ name }}
        </div>
        <div v-else />
      </transition>
    </template>
    <template #content>
      <transition
        name="slide"
        mode="out-in"
      >
        <span
          v-if="!showEdit"
          class="path"
        >
          {{ path }}
        </span>
        <t-form
          v-else
          :model="formState"
        >
          <t-form-item label="标题">
            <t-input
              v-model:value="formState.name"
              placeholder="标题"
            />
          </t-form-item>
          <t-form-item label="路径">
            <input-with-open-file
              v-model:value="formState.path"
              placeholder="路径"
            />
          </t-form-item>
          <t-form-item label="提取方法">
            <t-select v-model:value="formState.type">
              <t-option value="textractor">
                Textractor
              </t-option>
              <t-option value="ocr">
                OCR
              </t-option>
            </t-select>
          </t-form-item>
          <t-form-item label="HookCode">
            <t-input
              v-model:value="formState.hookCode"
              :disabled="formState.type !== 'textractor'"
              placeholder=""
            />
          </t-form-item>
          <t-form-item label="启动参数">
            <t-input
              v-model:value="formState.execShell"
              placeholder=""
            />
          </t-form-item>
        </t-form>
      </transition>
    </template>
    <template #actions>
      <t-space size="small">
        <t-button
          v-if="!showEdit"
          size="small"
          variant="text"
          @click="edit"
        >
          <setting-icon />
        </t-button>
        <t-button
          v-else
          size="small"
          variant="text"
          @click="save"
        >
          <save-icon />
        </t-button>
        <t-loading
          v-if="!showEdit"
          :loading="starting"
          inherit-color
        >
          <t-button
            size="small"
            variant="text"
            :disabled="starting"
            @click="play"
          >
            <play-circle-stroke-icon />
          </t-button>
        </t-loading>
        <t-button
          v-else
          size="small"
          variant="text"
          @click="showEdit = false"
        >
          <rollback-icon />
        </t-button>
        <t-popconfirm
          theme="danger"
          content="确认删除？"
          @confirm="$emit('del', id)"
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
  </t-card>
</template>

<script lang="ts">
import { defineComponent, PropType, toRaw } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { Delete1Icon } from 'tdesign-icons-vue-next';
import InputWithOpenFile from '@render/component/InputWithOpenFile.vue';
import { startGame, startExtract, readIcon } from '@remote';

export default defineComponent({
    components: {
        Delete1Icon,
        InputWithOpenFile
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
            icon: '',
            formState: {
                name: '',
                path: '',
                execShell: '',
                type: '',
                hookCode: ''
            }
        };
    },
    watch: {
        path() {
            this.readIcon();
        }
    },
    mounted() {
        this.readIcon();
    },
    methods: {
        async readIcon() {
            this.icon = await readIcon(this.path);
        },
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
                MessagePlugin.error(`启动失败：${e.message ?? e}`);
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
.name {
    display: flex;
    align-items: center;
    gap: 5px;
}
.name .icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  background-color: transparent;
  pointer-events: none;
}
.path {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-secondary);
    margin-top: var(--td-comp-margin-xs);
    word-break: break-all;
}
:deep(.t-card__body) {
    padding-top: 0;
}
.slide-enter-active,
.slide-leave-active {
    transition: all .2s cubic-bezier(.38,0,.24,1);
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
