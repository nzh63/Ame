import type { Context } from '@main/Context';
import { WindowWithContext } from '@main/window/WindowWithContext';

export class OcrGuideWindow extends WindowWithContext {
  private static readonly windowOption = {
    show: false,
    useContentSize: true,
    width: 800,
    height: 600,
    title: 'Ocr引导',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  };

  private static readonly url = import.meta.env.DEV
    ? 'http://localhost:9090/OcrGuide.html'
    : `file://${__dirname}/../render/OcrGuide.html`;

  public constructor(context: Context) {
    super(context, OcrGuideWindow.windowOption);
    this.loadURL(OcrGuideWindow.url);

    this.once('ready-to-show', () => {
      this.show();
      this.moveTop();
    });
  }
}
