"""CLI wrapper around win32_ui primitives for ad-hoc desktop UI automation.

Usage:
  python win32_ui_cli.py list [substring]
  python win32_ui_cli.py shot <title> <out.png>
  python win32_ui_cli.py ocr <image.png>
  python win32_ui_cli.py click <title> <screen_x> <screen_y>
  python win32_ui_cli.py clicktext <title> <text>
  python win32_ui_cli.py read <title>
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import win32_ui as ui


def _hwnd_or_die(title):
    wins = ui.find_window(title)
    if not wins:
        print(f"No window matching '{title}'")
        sys.exit(1)
    return wins[0][0], wins[0][1]


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "list":
        ui.list_windows(sys.argv[2] if len(sys.argv) > 2 else "")

    elif cmd == "shot":
        hwnd, title = _hwnd_or_die(sys.argv[2])
        out = sys.argv[3] if len(sys.argv) > 3 else "shot.png"
        print(f"Screenshot '{title}' -> {out}")
        ui.screenshot_window(hwnd, out)

    elif cmd == "ocr":
        for x, y, text in ui.ocr(sys.argv[2]):
            print(f"{x} {y} {text}")

    elif cmd == "click":
        hwnd, title = _hwnd_or_die(sys.argv[2])
        ui.focus_window(hwnd)
        x, y = int(sys.argv[3]), int(sys.argv[4])
        print(f"Click '{title}' at screen ({x},{y})")
        ui.click_screen(x, y)

    elif cmd == "clicktext":
        hwnd, title = _hwnd_or_die(sys.argv[2])
        ui.focus_window(hwnd)
        ok = ui.click_text(hwnd, sys.argv[3])
        print("Clicked" if ok else "Not found")
        sys.exit(0 if ok else 2)

    elif cmd == "read":
        hwnd, title = _hwnd_or_die(sys.argv[2])
        _, text = ui.read_page(hwnd)
        print(text)

    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
