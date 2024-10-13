import { defineTranslateProvider } from '@main/providers/translate';

export default defineTranslateProvider(
  {
    id: 'echo',
    optionsSchema: null,
    defaultOptions: null,
    data() {
      return null;
    },
  },
  {
    translate(t) {
      return t;
    },
  },
);
