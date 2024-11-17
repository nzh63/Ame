import { availableDictConfigs } from '@main/providers/dict';
import type { SchemaType, SchemaDescription } from '@main/schema';

export const dictManagerOptionsSchema = {
  defaultProvider: [...availableDictConfigs.map((i) => i.id)],
};

export type DictManagerOptions = SchemaType<typeof dictManagerOptionsSchema>;

export const dictManagerOptionsDescription: SchemaDescription<typeof dictManagerOptionsSchema> = {
  defaultProvider: '默认提供程序',
};

export const dictManagerOptionsDefaultValue: DictManagerOptions = {
  defaultProvider: availableDictConfigs[0].id,
};
