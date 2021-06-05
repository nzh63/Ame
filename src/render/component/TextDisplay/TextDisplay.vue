<template>
  <div
    ref="topDiv"
    class="translator"
  >
    <div
      class="line"
      title="原文"
      @click.right="onRightClick(original, 'original')"
    >
      <original-text :text="original" />
    </div>
    <div
      v-for="i in translate"
      :key="i.id"
      class="line"
      :title="i.id"
      @click.right="
        onRightClick(
          i.err ? i.err?.message ?? i.err : i.text,
          'translate'
        )
      "
    >
      <span
        v-if="i.err"
        class="error"
      >
        {{ i.id }}发生错误：{{ i.err?.message ?? i.err }}
      </span>
      <span v-else>{{ i.text }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import OriginalText from '@render/component/TextDisplay/OriginalText.vue';

export default defineComponent({
    components: {
        OriginalText
    },
    props: {
        original: {
            type: String,
            required: true
        },
        translate: {
            type: Array as PropType<{ id: string, text: string, err?: any }[]>,
            required: true
        }
    },
    emits: {
        'tts-speak': (s: string, t: 'original' | 'translate') => true
    },
    setup(props, context) {
        const onRightClick = (s: string, t: 'original' | 'translate') => {
            context.emit('tts-speak', s, t);
        };

        return {
            onRightClick
        };
    }
});
</script>

<style scoped>
.translator .line {
    line-height: 1.2;
    font-weight: 500;
    font-size: 16px;
}
.translator .line:not(:last-child) {
    margin-bottom: 0.3em;
}
.error {
    color: #ff4d4f;
    font-weight: 750;
}
</style>
