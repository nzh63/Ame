<template>
  <div>
    <a-steps :current="current">
      <a-step
        v-for="item in steps"
        :key="item"
        :title="item"
      />
    </a-steps>
    <div
      v-if="current === 0"
      class="steps-content"
    >
      <a-form
        layout="horizontal"
        :model="formState"
        :label-col="{ span: 4 }"
        :wrapper-col="{ span: 14 }"
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
        <a-form-item
          class="form-buttons"
          :wrapper-col="{ span: 14, offset: 4 }"
        >
          <a-button
            type="primary"
            @click="next"
          >
            下一步
          </a-button>
        </a-form-item>
      </a-form>
    </div>
    <div
      v-if="current === 1"
      class="steps-content"
    >
      <a-form
        layout="horizontal"
        :model="formState"
        :label-col="{ span: 4 }"
        :wrapper-col="{ span: 14 }"
      >
        <a-form-item label="区域转换器">
          <a-select
            v-model:value="formState.localeChanger"
            @change="updateExecShell"
          >
            <a-select-option
              v-for="i in localeChangers"
              :key="i.name"
              :disabled="!i.enable"
            >
              {{ i.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="启动参数">
          <a-textarea
            v-model:value="formState.execShell"
            auto-size
            class="exec-shell"
            :disabled="formState.localeChanger !== '自定义启动参数'"
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
            placeholder="可以留空"
          />
        </a-form-item>
        <a-form-item
          class="form-buttons"
          :wrapper-col="{ span: 14, offset: 4 }"
        >
          <a-button
            type="primary"
            @click="next"
          >
            下一步
          </a-button>
          <a-button @click="prev">
            上一步
          </a-button>
        </a-form-item>
      </a-form>
    </div>
    <div
      v-if="current === 2"
      class="steps-content"
    >
      <spin
        size="large"
        tip="正在检查"
        class="spin"
      />
    </div>
    <div
      v-if="current === 3"
      class="steps-content"
    >
      <a-result
        v-if="result === 'success'"
        status="success"
        :title="resultInfo"
      >
        <template #extra>
          <a-button
            type="primary"
            @click="$router.push('/')"
          >
            完成
          </a-button>
        </template>
      </a-result>
      <a-result
        v-if="result === 'error'"
        status="error"
        :title="resultInfo"
      >
        <template #extra>
          <div class="form-buttons">
            <a-button
              type="primary"
              @click="current = 0"
            >
              重新添加
            </a-button>
            <a-button @click="done(); $router.push('/')">
              仍然使用当前配置
            </a-button>
          </div>
        </template>
      </a-result>
    </div>
  </div>
</template>

<script lang="ts">

import { defineComponent, toRaw } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import InputWithOpenFile from '@render/component/InputWithOpenFile.vue';
import type { PlatformPath } from 'path';
import Spin from '@render/component/Spin';
import store from '@render/store';
import { startGame } from '@render/remote';

const path: PlatformPath = require('path');

export default defineComponent({
    components: {
        InputWithOpenFile,
        Spin
    },
    data() {
        return {
            formState: {
                name: '',
                path: '',
                type: 'textractor' as Ame.Extractor.ExtractorType,
                hookCode: '',
                localeChanger: '不转换',
                execShell: ''
            },
            result: '',
            resultInfo: '',
            steps: ['选择游戏路径', '设置启动参数', '检查配置'],
            current: 0,
            localeChangers: [] as {
                name: string;
                execShell: string;
                enable: boolean;
                placeholder?: string;
                editingName?: boolean;
            }[]
        };
    },
    watch: {
        'formState.path'(): void {
            this.formState.name = path.basename(this.formState.path);
        }
    },
    async mounted() {
        this.localeChangers = await store.get('localeChangers');
        this.localeChangers.unshift({ name: '不转换', enable: true, execShell: "&'%GAME%'" });
        this.localeChangers.push({ name: '自定义启动参数', enable: true, execShell: "&'%GAME%'" });
    },
    methods: {
        next(): void {
            if (this.current === 0) {
                this.formState.execShell = `&'${this.formState.path}'`;
            }
            this.current++;
            if (this.current === 2) {
                this.check();
            }
        },
        prev() {
            this.current--;
        },
        async check() {
            try {
                await startGame({ ...toRaw(this.formState), uuid: '' });
                this.result = 'success';
                this.resultInfo = '';
                this.done();
            } catch (e: any) {
                this.result = 'error';
                this.resultInfo = '' + (e.message ?? e);
            }
            this.current++;
        },
        async done() {
            const newGame: any = { ...toRaw(this.formState) };
            delete newGame.localeChanger;
            await store.set('games', [...await store.get('games', []), { ...newGame, uuid: uuidv4() }]);
        },
        updateExecShell() {
            this.formState.execShell = (this.localeChangers.find(i => i.name === this.formState.localeChanger)?.execShell ?? "&'%GAME'").replace('%GAME%', this.formState.path.replace(/'/g, "\\'"));
        }
    }
});
</script>

<style scoped>
.steps-content {
    margin-top: 16px;
    margin-left: 30px;
    margin-right: 30px;
}
.form-buttons button:not(:first-child) {
    margin-left: 10px;
}
.spin {
    margin: 60px auto;
    display: block;
}
.exec-shell {
    word-break: break-all;
}
</style>
