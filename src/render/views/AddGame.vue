<template>
  <t-steps readonly :current="current">
    <t-step-item v-for="item in steps" :key="item" :title="item" />
  </t-steps>
  <div v-if="current === 0" class="steps-content">
    <t-form :model="formState">
      <t-form-item label="标题">
        <t-input v-model:value="formState.name" placeholder="标题" />
      </t-form-item>
      <t-form-item label="路径">
        <input-with-open-file v-model:value="formState.path" placeholder="路径" />
      </t-form-item>
      <t-form-item class="form-buttons">
        <t-button theme="primary" @click="next"> 下一步 </t-button>
      </t-form-item>
    </t-form>
  </div>
  <div v-if="current === 1" class="steps-content">
    <t-form :model="formState">
      <t-form-item label="区域转换器">
        <t-select v-model:value="formState.localeChanger" @change="updateExecShell">
          <t-option v-for="i in localeChangers" :key="i.name" :value="i.name" :disabled="!i.enable">
            {{ i.name }}
          </t-option>
        </t-select>
      </t-form-item>
      <t-form-item label="启动参数">
        <t-textarea
          v-model:value="formState.execShell"
          auto-size
          class="exec-shell"
          :disabled="formState.localeChanger !== '自定义启动参数'"
        />
      </t-form-item>
      <t-form-item label="提取方法">
        <t-select v-model:value="formState.type">
          <t-option value="textractor"> Textractor </t-option>
          <t-option value="ocr"> OCR </t-option>
        </t-select>
      </t-form-item>
      <t-form-item label="HookCode">
        <t-input
          v-model:value="formState.hookCode"
          :disabled="formState.type !== 'textractor'"
          placeholder="可以留空"
        />
      </t-form-item>
      <t-form-item class="form-buttons">
        <t-button theme="primary" @click="next"> 下一步 </t-button>
        <t-button theme="default" @click="prev"> 上一步 </t-button>
      </t-form-item>
    </t-form>
  </div>
  <div v-if="current === 2" class="steps-content">
    <t-loading size="large" text="加载中..." class="spin" />
  </div>
  <div
    v-if="current === 3"
    :class="{
      result: true,
      [result]: true,
    }"
  >
    <check-circle-icon v-if="result === 'success'" class="icon" />
    <error-circle-icon v-else class="icon" />
    <div class="title">添加{{ result === 'success' ? '成功' : '失败' }}</div>
    <div class="describe">
      {{ resultInfo }}
    </div>
    <t-button v-if="result === 'success'" theme="primary" @click="$router.push('/')"> 完成 </t-button>
    <t-space v-else>
      <div class="form-buttons">
        <t-button theme="primary" @click="current = 0"> 重新添加 </t-button>
        <t-button
          theme="default"
          @click="
            done();
            $router.push('/');
          "
        >
          仍然使用当前配置
        </t-button>
      </div>
    </t-space>
  </div>
</template>

<script lang="ts">
import { startGame } from '@remote';
import InputWithOpenFile from '@render/component/InputWithOpenFile.vue';
import store from '@render/store';
import path from 'path';
import { quote } from 'shell-quote';
import { v4 as uuidv4 } from 'uuid';
import { defineComponent, toRaw } from 'vue';

export default defineComponent({
  components: {
    InputWithOpenFile,
  },
  data() {
    return {
      formState: {
        name: '',
        path: '',
        type: 'textractor' as Ame.Extractor.ExtractorType,
        hookCode: '',
        localeChanger: '不转换',
        execShell: '',
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
      }[],
    };
  },
  watch: {
    'formState.path'(): void {
      this.formState.name = path.basename(this.formState.path);
    },
  },
  async mounted() {
    this.localeChangers = await store.get('localeChangers');
    this.localeChangers.unshift({ name: '不转换', enable: true, execShell: '& %GAME%' });
    this.localeChangers.push({ name: '自定义启动参数', enable: true, execShell: '& %GAME%' });
  },
  methods: {
    next(): void {
      if (this.current === 0) {
        this.formState.execShell = `& ${quote([this.formState.path])}`;
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
        this.resultInfo = String(e.message ?? e);
      }
      this.current++;
    },
    async done() {
      const newGame: any = { ...toRaw(this.formState) };
      delete newGame.localeChanger;
      await store.set('games', [...(await store.get('games', [])), { ...newGame, uuid: uuidv4() }]);
    },
    updateExecShell() {
      const pattern = this.localeChangers.find((i) => i.name === this.formState.localeChanger)?.execShell ?? '& %GAME%';
      this.formState.execShell = pattern.replaceAll('%GAME%', quote([this.formState.path]));
    },
  },
});
</script>

<style scoped>
.steps-content {
  padding-top: var(--td-comp-paddingTB-xl);
  width: 100%;
}
.form-buttons button:not(:first-child) {
  margin-left: 10px;
}
.spin {
  margin: auto;
  display: flex;
}
.exec-shell {
  word-break: break-all;
}
.result {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: var(--td-comp-margin-xxl);
}
.result .title {
  margin-top: var(--td-comp-margin-xxl);
  font: var(--td-font-title-large);
}
.result .describe {
  margin: var(--td-comp-margin-s) 0 var(--td-comp-margin-xxxl);
  font: var(--td-font-body-medium);
  color: var(--td-text-color-secondary);
}
.result .icon {
  display: block;
  font-size: var(--td-comp-size-xxxxl);
}
.result.success .icon {
  color: var(--td-success-color);
}
.result.error .icon {
  color: var(--td-error-color);
}
</style>
