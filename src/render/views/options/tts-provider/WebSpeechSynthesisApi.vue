<template>
  <options :provider-id="providerId" :get-meta="getMeta" :get-options="getOptions" :set-options="setOptions" />
</template>

<script lang="ts">
import { getProviderOptionsMeta, getProviderOptions, setProviderOptions } from '@remote';
import Options from '@render/views/Options.vue';
import { defineComponent, ref } from 'vue';

export default defineComponent({
  components: {
    Options,
  },
  setup() {
    const providerId = 'WebSpeechSynthesisApi';
    const getMeta = ref(getProviderOptionsMeta.bind(globalThis, 'tts'));
    const getOptions = getProviderOptions.bind(globalThis, 'tts');
    const setOptions = setProviderOptions.bind(globalThis, 'tts');

    let voices: string[] = [];
    function check() {
      if (speechSynthesis.getVoices().length && speechSynthesis.getVoices().every((i) => i.voiceURI)) {
        speechSynthesis.onvoiceschanged = null;
        voices = speechSynthesis.getVoices().map((i) => i.voiceURI);
        getMeta.value = async (id) => {
          const meta = await getProviderOptionsMeta('tts', id);
          if (typeof meta.jsonSchema !== 'object') return meta;
          const voice = meta.jsonSchema.properties?.voice;
          if (typeof voice === 'object') {
            if (voice?.properties?.originalVoiceURI && voice?.properties?.originalVoiceURI !== true) {
              voice.properties.originalVoiceURI.enum = [null, ...voices];
            }
            if (voice?.properties?.translateVoiceURI && voice?.properties?.translateVoiceURI !== true) {
              voice.properties.translateVoiceURI.enum = [null, ...voices];
            }
          }
          return meta;
        };
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
