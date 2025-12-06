import type { SchemaType, SchemaDescription } from '@main/schema';

export const ocrExtractorOptionsSchema = {
  delay: Number,
  trigger: {
    mouse: {
      left: Boolean,
      wheel: Boolean,
    },
    keyboard: {
      enter: Boolean,
      space: Boolean,
    },
    movement: {
      interval: Number,
      threshold: Number,
    },
  },
};

export type OcrExtractorOptions = SchemaType<typeof ocrExtractorOptionsSchema>;

export const ocrExtractorOptionsDescription: SchemaDescription<typeof ocrExtractorOptionsSchema> = {
  delay: {
    readableName: '截图延时',
    description: '单位：ms',
  },
  trigger: {
    mouse: {
      left: '鼠标左键触发',
      wheel: '鼠标滚轮触发',
    },
    keyboard: {
      enter: '回车键触发',
      space: '空格键触发',
    },
    movement: {
      interval: {
        readableName: '移动检测间隔',
        description: '单位：ms',
      },
      threshold: {
        readableName: '移动检测阈值',
        description: '取值范围: [0, 1]',
      },
    },
  },
};

export const ocrExtractorOptionsDefaultValue: OcrExtractorOptions = {
  delay: 500,
  trigger: {
    mouse: {
      left: true,
      wheel: true,
    },
    keyboard: {
      enter: true,
      space: true,
    },
    movement: {
      interval: 100,
      threshold: 0.005,
    },
  },
};
