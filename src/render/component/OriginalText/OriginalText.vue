<template>
    <div>
        <original-text-segment v-for="s of splitText" :text="s" :key="s" />
    </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import OriginalTextSegment from './OriginalTextSegment.vue';

export default defineComponent({
    components: {
        OriginalTextSegment
    },
    props: {
        text: {
            type: String,
            required: true
        }
    },
    setup(props) {
        const splitText = computed(() => props.text.split(/(?<=[「」、！？。，])/));
        return { splitText };
    }
});
</script>
