---
name: ame-ui-checklist
description: "Complete functional checklist and step-by-step manual test procedures for the Ame Visual Novel Translator Tauri app. Use when: manually verifying app functionality end-to-end, writing E2E tests, doing regression testing, onboarding a tester, or checking whether a feature works. Covers launching the app, system tray behavior, MainWindow (dashboard, add-game wizard, locale changers, provider options), TranslatorWindow (translation overlay, hook select, extract settings), and OcrGuide (region selection, preprocessing)."
---

# Ame UI Functional Checklist

Step-by-step manual test procedures for the Ame Visual Novel Translator.
Each flow is written so a first-time tester can follow it without prior knowledge.

## How to use

1. Read [references/00-launch-and-layout.md](./references/00-launch-and-layout.md) first — how to start the app and what the main screen looks like.
2. Then follow the flow for the feature you want to verify. Each reference file is independent and starts from the main screen.
3. Every step tells you **what to click**, **what you should see**, and a **✅ pass criterion**.

## Reference files (operation flows)

| File | Covers |
|------|--------|
| [00-launch-and-layout.md](./references/00-launch-and-layout.md) | Launching the app, main window layout, sidebar navigation |
| [01-dashboard.md](./references/01-dashboard.md) | 主页: game cards, launch game, launch by PID, drag-drop add, edit/delete |
| [02-add-game.md](./references/02-add-game.md) | 添加游戏: 3-step wizard (path → params → verify → result) |
| [03-locale-changers.md](./references/03-locale-changers.md) | 区域转换器设置: create/edit/delete/save locale changers |
| [04-provider-options.md](./references/04-provider-options.md) | 翻译器/TTS/OCR/分词/词典 provider option pages + schema forms |
| [05-translator-window.md](./references/05-translator-window.md) | TranslatorWindow: title bar, translation view, hook select, extract settings |
| [06-ocr-guide.md](./references/06-ocr-guide.md) | OcrGuide: region selection + preprocessing wizard |
| [07-full-translation-flow.md](./references/07-full-translation-flow.md) | End-to-end: configure translator → launch game → extract text → see translation (Textractor & OCR paths) |
| [08-window-following-and-exit.md](./references/08-window-following-and-exit.md) | Game window move/minimize/restore/close → translator reacts |
| [09-tray-behavior.md](./references/09-tray-behavior.md) | 系统托盘: icon, right-click menu (打开主界面/退出), double-click reopen, stay-in-tray on close |


## Toast messages reference

| Message | Trigger |
|---------|---------|
| 已成功保存 | Save succeeded |
| 无法找到窗口 | PID window-picker failed to find a window |
| 启动失败：… | Game failed to launch |
| 请先修正输入错误再保存 | Save clicked while an options form has validation errors |
