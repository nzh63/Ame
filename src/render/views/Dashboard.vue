<template>
    <div class="top">
        <game-card
            class="game-card"
            v-for="(game, index) of games"
            :key="index"
            :id="index"
            v-bind="game"
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
</template>

<script lang="ts">
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
            visible: false
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
            startExtract([this.pid]);
            this.visible = false;
        }
    },
    mounted() {
        this.reloadGames();
    }
});
</script>
<style scoped>
.top {
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
