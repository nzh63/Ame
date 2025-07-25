<template>
  <div
    ref="dragArea"
    :class="{ 'drag-area': true, draging }"
    @drop="drop"
    @dragenter="dragenter"
    @dragleave="dragleave"
    @dragover.prevent
  >
    <h1 v-if="draging" class="tip">松开以添加</h1>
    <div class="dash-board">
      <game-card
        v-for="(game, index) of games"
        :id="index"
        :key="game.uuid"
        class="game-card"
        :uuid="game.uuid"
        :name="game.name"
        :path="game.path"
        :type="game.type"
        :hook-code="game.hookCode"
        :exec-shell="game.execShell"
        @save="save"
        @del="del"
      />
      <t-button class="pid" variant="dashed" @click="visible = true"> 通过PID启动 </t-button>
      <div v-for="i in 10" :key="i" class="placeholder" />
      <t-dialog v-model:visible="visible" header="通过PID启动" @confirm="start">
        <t-form>
          <t-form-item label="游戏进程PID">
            <t-input v-model:value="pid" :min="0" type="number" @enter="start">
              <template #suffix>
                <t-tooltip content="通过点击选取窗口">
                  <t-button size="small" variant="text" @click="findWindowByClick">
                    <focus-icon />
                  </t-button>
                </t-tooltip>
              </template>
            </t-input>
          </t-form-item>
        </t-form>
      </t-dialog>
    </div>
  </div>
</template>

<script lang="ts">
import { findWindowByClick, startExtract } from '@remote';
import GameCard from '@render/component/GameCard.vue';
import store from '@render/store';
import electron from 'electron';
import { quote } from 'shell-quote';
import { MessagePlugin } from 'tdesign-vue-next';
import { v4 as uuidv4 } from 'uuid';
import { defineComponent, toRaw } from 'vue';

export default defineComponent({
  components: {
    GameCard,
  },
  data() {
    return {
      games: [] as Ame.GameSetting[],
      pid: 0,
      visible: false,
      dragArea: null as null | HTMLElement,
      draging: false,
    };
  },
  mounted() {
    this.reloadGames();
  },
  methods: {
    async save(id: number, value: Ame.GameSetting) {
      this.games[id] = value;
      await store.set('games', toRaw(this.games));
      await this.reloadGames();
    },
    async del(id: number) {
      this.games.splice(id, 1);
      await store.set('games', toRaw(this.games));
      await this.reloadGames();
    },
    async reloadGames() {
      this.games = await store.get('games');
    },
    start() {
      startExtract('', [this.pid]);
      this.visible = false;
    },
    dragenter(e: DragEvent) {
      if (!e.dataTransfer?.types.includes('Files')) return;
      this.draging = true;
    },
    dragleave(e: DragEvent) {
      if (e.target !== this.$refs.dragArea) return;
      this.draging = false;
    },
    async drop(e: DragEvent) {
      e.preventDefault();
      this.draging = false;
      const files = Array.from(e.dataTransfer?.files ?? []);
      const newGames: Ame.GameSetting[] = [];
      for (const i of files) {
        const path = electron.webUtils.getPathForFile(i);
        if (!/\.exe$/.test(path)) continue;
        newGames.push({
          uuid: uuidv4(),
          path,
          name: i.name,
          execShell: '& ' + quote([path]),
          type: 'textractor',
          hookCode: '',
        });
      }
      await store.set('games', [...(await store.get('games', [])), ...newGames]);
      await this.reloadGames();
    },
    async findWindowByClick() {
      const pid = await findWindowByClick();
      if (pid === undefined) {
        MessagePlugin.error('无法找到窗口');
      } else {
        this.pid = pid;
      }
    },
  },
});
</script>

<style scoped>
.drag-area {
  min-width: 100%;
  min-height: 100%;
}
.tip {
  position: sticky;
  height: 0;
  margin: 0;
  top: 50%;
  z-index: 999;
  text-align: center;
  color: var(--td-font-gray-2);
  font: var(--td-font-headline-large);
}
.draging > *:not(.tip) {
  opacity: 0.2;
}
.draging > * {
  pointer-events: none;
}
.draging {
  border: var(--td-font-gray-2) dashed 2.5px;
  margin: -2.5px;
}
.dash-board {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-around;
}
.pid,
.placeholder,
.game-card {
  min-width: 300px;
  max-width: 400px;
  margin: 5px;
  flex-basis: 300px;
  flex-grow: 1;
  height: unset;
}
.placeholder {
  margin: 0px;
}
.pid,
.game-card {
  min-height: 125px;
}
</style>
