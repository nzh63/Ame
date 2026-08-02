/**
 * 隐藏页面默认右键菜单（WebView2/Chromium 的 contextmenu）。
 * 在窗口入口调用一次即可；有自定义右键菜单的地方（如翻译窗口的"大声朗读"）
 * 仍然可以自行监听并弹出自定义菜单。
 */
export function suppressContextMenu(): void {
  window.addEventListener('contextmenu', (event) => event.preventDefault(), { capture: true });
}
