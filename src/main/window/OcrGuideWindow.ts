import type { Session } from '@main/Session';
import { WindowWithSession } from '@main/window/WindowWithSession';

export class OcrGuideWindow extends WindowWithSession {
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

  public constructor(session: Session) {
    super(session, OcrGuideWindow.windowOption);
    this.loadURL(OcrGuideWindow.url);

    this.once('ready-to-show', () => {
      this.show();
      this.moveTop();
    });
  }
}
