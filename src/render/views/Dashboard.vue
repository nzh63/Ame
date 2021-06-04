<template>
    <div
        class="drag-area"
        :class="{ draging }"
        ref="dragArea"
        @drop="drop"
        @dragenter="dragenter"
        @dragleave="dragleave"
        @dragover.prevent
    >
        <a-typography-title v-if="draging" class="tip">
            松开以添加
        </a-typography-title>
        <div class="dash-board">
            <game-card
                class="game-card"
                v-for="(game, index) of games"
                :key="game.uuid"
                :id="index"
                :uuid="game.uuid"
                :name="game.name"
                :path="game.path"
                :type="game.type"
                :hookCode="game.hookCode"
                :execShell="game.execShell"
                @save="save"
                @del="del"
            />
            <a-button class="pid" type="dashed" @click="visible = true">
                通过PID启动
            </a-button>
            <div class="placeholder" v-for="i in 10" :key="i"></div>
            <a-modal v-model:visible="visible" title="通过PID启动" @ok="start">
                请输入PID
                <a-input-number v-model:value="pid" :min="0" />
            </a-modal>
        </div>
    </div>
</template>

<script lang="ts">
import { v4 as uuidv4 } from 'uuid';
import { defineComponent, toRaw } from 'vue';

import GameCard from '@render/component/GameCard.vue';
import store from '@render/store';
import { startExtract } from '@render/remote';

export default defineComponent({
    components: {
        GameCard
    },
    data() {
        return {
            games: [] as Ame.GameSetting[],
            pid: 0,
            visible: false,
            dragArea: null as null | HTMLElement,
            draging: false
        };
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
            this.draging = true;
        },
        dragleave(e: DragEvent) {
            if (e.target !== this.$refs.dragArea) return;
            this.draging = false;
        },
        async drop(e: DragEvent) {
            e.preventDefault();
            this.draging = false;
            const files = Array.from(e.dataTransfer?.files ?? []).filter(i => /\.exe/.test(i.path));
            const newGames: Ame.GameSetting[] = [];
            for (const { path, name } of files) {
                newGames.push({
                    uuid: uuidv4(),
                    path,
                    name,
                    execShell: `&'${path}'`,
                    type: 'textractor',
                    hookCode: ''
                });
            }
            await store.set('games', [...await store.get('games', []), ...newGames]);
            await this.reloadGames();
        }
    },
    mounted() {
        this.reloadGames();
    }
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
    top: 50%;
    z-index: 999;
    text-align: center;
    color: rgba(0, 0, 0, 0.65);
}
.draging > *:not(.tip) {
    opacity: 0.2;
}
.draging > * {
    pointer-events: none;
}
.draging {
    border: rgba(0, 0, 0, 0.85) dashed;
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
}
.pid,
.game-card {
    min-height: 175px;
}
</style>
