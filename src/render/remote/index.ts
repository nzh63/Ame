/**
 * Tauri IPC layer — replaces the removed Electron `src/remote/*` with
 * direct Tauri command calls.
 *
 * The original code uses `defineRemoteFunction` which:
 * - In main process: registers `ipcMain.handle(channel, handler)`
 * - In render process: returns `(...args) => ipcRenderer.invoke(channel, ...args)`
 *
 * In Tauri, the render process calls `invoke(command, args)` directly.
 * Event-based watchers use `listen()` from `@tauri-apps/api/event`.
 */
import type { PostProcessOption, PreprocessOption } from '@main/extractor';
import type { SegmentWord } from '@main/providers/SegmentProvider';
import type { JSONSchema } from '@main/schema';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/** Metadata returned by the options commands. */
export interface OptionsMeta {
  id: string | null;
  description: string | null;
  jsonSchema: JSONSchema;
  optionsDescription: unknown;
}

/** OCR crop rectangle. */
export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export async function storeGet(key: string, defaultValue?: unknown) {
  return invoke('store_get', { key, default: defaultValue ?? null });
}

export async function storeSet(key: string, value?: unknown) {
  return invoke('store_set', { key, value: value ?? null });
}

export async function storeHas(key: string) {
  return invoke<boolean>('store_has', { key });
}

export async function storeDelete(key: string) {
  return invoke('store_delete', { key });
}

export async function storeReset(...keys: string[]) {
  return invoke('store_reset', { keys });
}

export async function storeClear() {
  return invoke('store_clear');
}

// ─── Game / Session ──────────────────────────────────────────────────────────

export async function startGame(arg: Ame.GameSetting) {
  return invoke<{ pids: number[] }>('start_game', { arg });
}

export async function startExtract(
  uuid: string,
  gamePids: number[],
  hookCode?: string,
  type?: Ame.Extractor.ExtractorType,
) {
  return invoke('start_extract', { uuid, gamePids, hookCode, type });
}

export async function getAllExtractText() {
  return invoke<Ame.Extractor.Result>('get_all_extract_text');
}

export async function getExtractorType() {
  return invoke<Ame.Extractor.ExtractorType>('get_extractor_type');
}

export async function switchExtractorType(type: Ame.Extractor.ExtractorType) {
  return invoke('switch_extractor_type', { type });
}

export async function getGameSetting() {
  return invoke<Ame.GameSetting>('get_game_setting');
}

export async function setGameSelectKeys(keys: Ame.Extractor.Key[]) {
  return invoke('set_game_select_keys', { keys });
}

// ─── Window finding ──────────────────────────────────────────────────────────

export async function findWindowByClick() {
  return invoke<number>('find_window_by_click');
}

// ─── Icon ────────────────────────────────────────────────────────────────────

export async function readIcon(path: string) {
  return invoke<string>('read_icon', { path });
}

// ─── Dialog ──────────────────────────────────────────────────────────────────

export async function showOpenDialog(options?: unknown) {
  return invoke('show_open_dialog', { options });
}

// ─── Window operations ───────────────────────────────────────────────────────

export async function resizeWindow(arg: { height?: number; width?: number }) {
  return invoke('resize_window', { arg });
}

export async function minimizeWindow() {
  return invoke('minimize_window');
}

export async function toggleMaximizeWindow() {
  return invoke<boolean>('toggle_maximize_window');
}

export async function closeWindow() {
  return invoke('close_window');
}

export async function hideWindow() {
  return invoke('hide_window');
}

export async function showWindow() {
  return invoke('show_window');
}

export async function setWindowAlwaysOnTop(flag: boolean) {
  return invoke('set_window_always_on_top', { flag });
}

export async function showContextMenu(x?: number, y?: number) {
  return invoke('show_context_menu', { x, y });
}

// ─── Options (providers / managers / extractors) ─────────────────────────────

export async function getProvidersIDs(type: string) {
  return invoke<string[]>('get_providers_ids', { type });
}

export async function getProviderOptionsMeta(type: string, providerId: string) {
  return invoke<OptionsMeta>('get_provider_options_meta', { type, providerId });
}

export async function getProviderOptions(type: string, providerId: string) {
  return invoke('get_provider_options', { type, providerId });
}

export async function setProviderOptions(type: string, providerId: string, value: unknown) {
  return invoke('set_provider_options', { type, providerId, value });
}

export async function getManagerOptionsMeta(type: string) {
  return invoke<OptionsMeta>('get_manager_options_meta', { type });
}

export async function getManagerOptions(type: string, _?: unknown) {
  return invoke('get_manager_options', { type });
}

export async function setManagerOptions(type: string, _: unknown, value: unknown) {
  return invoke('set_manager_options', { type, value });
}

export async function getExtractorOptionsMeta(type: string, _?: unknown) {
  return invoke<OptionsMeta>('get_extractor_options_meta', { type });
}

export async function getExtractorOptions(type: string, _?: unknown) {
  return invoke('get_extractor_options', { type });
}

export async function setExtractorOptions(type: string, _: unknown, value: unknown) {
  return invoke('set_extractor_options', { type, value });
}

// ─── TTS ─────────────────────────────────────────────────────────────────────

export async function ttsSpeak(text: string, type: 'original' | 'translate') {
  return invoke('tts_speak', { text, type });
}

export function onTtsReply(callback: () => void): Promise<UnlistenFn> {
  return listen('tts-speak-reply', callback);
}

export function offTtsReply(unlisten: UnlistenFn) {
  unlisten();
}

// ─── Segment / Dict ──────────────────────────────────────────────────────────

export async function segment(text: string) {
  return invoke<SegmentWord[]>('segment', { text });
}

export async function dictQuery(text: string) {
  return invoke('dict_query', { text });
}

// ─── Textractor ──────────────────────────────────────────────────────────────

export async function getTextractorPostProcessOption() {
  return invoke<PostProcessOption | null>('get_textractor_post_process_option');
}

export async function setTextractorPostProcessOption(option: unknown) {
  return invoke('set_textractor_post_process_option', { option });
}

// ─── OCR ─────────────────────────────────────────────────────────────────────

export async function getScreenCapture(force = false) {
  return invoke<number[]>('get_screen_capture', { force });
}

export async function getPreprocessedImage(img: Uint8Array | number[], option: unknown) {
  return invoke<number[]>('get_preprocessed_image', { img, option });
}

export async function getScreenCaptureCropRect() {
  return invoke<CropRect | null>('get_screen_capture_crop_rect');
}

export async function setScreenCaptureCropRect(rect: unknown) {
  return invoke('set_screen_capture_crop_rect', { rect });
}

export async function getScreenCapturePreprocessOption() {
  return invoke<PreprocessOption>('get_screen_capture_preprocess_option');
}

export async function setScreenCapturePreprocessOption(option: unknown) {
  return invoke('set_screen_capture_preprocess_option', { option });
}

export async function openOcrGuideWindow() {
  return invoke('open_ocr_guide_window');
}

// ─── Watch (event-based) ─────────────────────────────────────────────────────

type OriginalWatchCallback = (arg: Ame.Translator.OriginalText) => void;
type TranslateWatchCallback = (arg: Ame.Translator.TranslateResult) => void;
type TranslateWatchErrorCallback = (err: unknown, arg: Ame.Translator.TranslateResult) => void;

const originalUnlisteners: Partial<Record<string, UnlistenFn>> = {};
const translateUnlisteners: Partial<Record<string, UnlistenFn[]>> = {};

export async function watchOriginal(key: Ame.Extractor.Key, callback: OriginalWatchCallback) {
  if (originalUnlisteners[key]) {
    await unwatchOriginal(key);
  }
  const unlisten = await listen<Ame.Translator.OriginalText>('original-watch-list-update', (event) => {
    if (key === 'any' || key === event.payload.key) {
      callback(event.payload);
    }
  });
  originalUnlisteners[key] = unlisten;
  await invoke('watch_original', { key });
  // Electron: 订阅时立即补发该 key 已有的提取文本。
  const all = await getAllExtractText();
  if (key !== 'any' && all?.[key]) {
    callback({ key, text: all[key] });
  } else if (key === 'any') {
    for (const [k, text] of Object.entries(all ?? {})) {
      callback({ key: k, text });
    }
  }
}

export async function unwatchOriginal(key: Ame.Extractor.Key) {
  originalUnlisteners[key]?.();
  delete originalUnlisteners[key];
  return invoke('unwatch_original', { key });
}

export async function watchTranslate(
  key: Ame.Extractor.Key,
  callback: TranslateWatchCallback,
  errCallback?: TranslateWatchErrorCallback,
) {
  if (translateUnlisteners[key]) {
    await unwatchTranslate(key);
  }
  const unlisten1 = await listen<Ame.Translator.TranslateResult>('translate-watch-list-update', (event) => {
    if (key === 'any' || key === event.payload.key) {
      callback(event.payload);
    }
  });
  const unlisten2 = await listen<{ err: unknown; value: Ame.Translator.TranslateResult }>(
    'translate-watch-list-update-error',
    (event) => {
      if (key === 'any' || key === event.payload.value.key) {
        errCallback?.(event.payload.err, event.payload.value);
      }
    },
  );
  translateUnlisteners[key] = [unlisten1, unlisten2];
  return invoke('watch_translate', { key });
}

export async function unwatchTranslate(key: Ame.Extractor.Key) {
  translateUnlisteners[key]?.forEach((fn) => fn());
  delete translateUnlisteners[key];
  return invoke('unwatch_translate', { key });
}

// ─── Window focus/blur events ────────────────────────────────────────────────

export function onWindowFocus(callback: () => void): Promise<UnlistenFn> {
  return listen('window-focus', callback);
}

export function onWindowBlur(callback: () => void): Promise<UnlistenFn> {
  return listen('window-blur', callback);
}

// ─── Misc ────────────────────────────────────────────────────────────────────

export async function ping() {
  return invoke<string>('ping');
}
