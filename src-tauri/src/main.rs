// Prevents the black console window in BOTH dev and release builds (the old
// Electron app never showed one either). Subprocess CLIs are launched with
// CREATE_NO_WINDOW via `win32::hide_console`, so they don't flash either.
#![windows_subsystem = "windows"]

fn main() {
    ame_lib::run()
}
