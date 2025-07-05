declare module '@addons/ScreenCapturer' {
  declare namespace ScreenCapturer {
    type PID = number;
    type HWND = bigint;
    interface CaptureResult {
      width: number;
      height: number;
      buffer: Buffer;
    }
    function findWindow(pids: PID[]): Promise<HWND | undefined>;
    function capture(hwnd: HWND): Promise<CaptureResult>;
  }
  export = ScreenCapturer;
}

declare module '@addons/WindowEventHook' {
  declare namespace WindowEventHook {
    type PID = number;
    type HWINEVENTHOOK = bigint;
    function startWindowMinimizeHook(pids: PID[], callback: (isMinimize: boolean) => void): Promise<HWINEVENTHOOK[]>;
    function startWindowMoveHook(
      pids: PID[],
      callback: (diff: { diffLeft: number; diffTop: number }) => void,
    ): Promise<HWINEVENTHOOK[]>;
    function stopWindowEventHook(hooks: HWINEVENTHOOK[]): void;
  }
  export = WindowEventHook;
}

declare module '@addons/WindowsHook' {
  declare namespace WindowsHook {
    type HANDLE = bigint;
    function startGlobalKeyboardHook(callback: (wParam: number, vkCode: number) => void): HANDLE;
    function startGlobalMouseHook(callback: (wParam: number, pt: { x: number; y: number }) => void): HANDLE;
    function stopHook(handel: HANDLE): void;
  }
  export = WindowsHook;
}

declare module '@addons/Process' {
  declare namespace Process {
    type PID = number;
    function isWow64(pid: PID): boolean;
    function waitProcessForExit(pids: PID[]): Promise<void>;
    function getPidFromPoint(x: number, y: number): PID | undefined;
  }
  export = Process;
}

declare module '@addons/PP-OCR' {
  interface Option {
    gpu: 'off' | 'auto' | number;
  }

  interface Image {
    data: Buffer;
    info: {
      width: number;
      height: number;
    };
  }

  interface RotatedRect {
    center: { x: number; y: number };
    size: { width: number; height: number };
    angle: number;
  }

  export class Detecter {
    private constructor();
    public static create(param: string, model: string, option: Option): Promise<Detecter>;

    public detect(img: Image): Promise<RotatedRect[]>;
  }

  export class Recognizer {
    private constructor();
    public static create(param: string, model: string, option: Option): Promise<Recognizer>;

    public recognize(img: Image, boxes: RotatedRect[]): Promise<string[]>;
  }

  export namespace GPU {
    const devices: number[];
  }
}
