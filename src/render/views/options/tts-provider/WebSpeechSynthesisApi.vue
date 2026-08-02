<template>
  <options :provider-id="providerId" :get-meta="getMeta" :get-options="getOptions" :set-options="setOptions" />
</template>

<script lang="ts">
import { getProviderOptionsMeta, getProviderOptions, setProviderOptions } from '@remote';
import Options from '@render/views/Options.vue';
import { defineComponent, onUnmounted, reactive, ref } from 'vue';

export default defineComponent({
  components: {
    Options,
  },
  async setup() {
    const providerId = 'WebSpeechSynthesisApi';
    const getMeta = ref(() => meta);
    const getOptions = getProviderOptions.bind(globalThis, 'tts');
    const setOptions = setProviderOptions.bind(globalThis, 'tts');

    onUnmounted(() => {
      speechSynthesis.onvoiceschanged = null;
    });

    const meta = reactive(await getProviderOptionsMeta('tts', providerId));

    function check() {
      if (speechSynthesis.getVoices().length && speechSynthesis.getVoices().every((i) => i.voiceURI)) {
        speechSynthesis.onvoiceschanged = null;
        const voices = speechSynthesis.getVoices().map((i) => i.voiceURI);
        if (typeof meta.jsonSchema !== 'object') return meta;
        const voice = meta.jsonSchema.properties?.voice;
        if (typeof voice === 'object') {
          if (voice?.properties?.originalVoiceURI) {
            voice.properties.originalVoiceURI.enum = [null, ...voices];
          }
          if (voice?.properties?.translateVoiceURI) {
            voice.properties.translateVoiceURI.enum = [null, ...voices];
          }
        }
        getMeta.value = () => meta;
      }
    }
    speechSynthesis.onvoiceschanged = check;
    check();

    return {
      providerId,
      getMeta,
      getOptions,
      setOptions,
    };
  },
});
</script>
