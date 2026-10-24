//! Jot for Windows, Linux and Android.
//!
//! One window that shows the web app from ../ui, unchanged apart from paths. Notes are kept in the
//! web view's own IndexedDB inside the app's data folder, so clearing a browser never touches them.
//! The plugins let the page save an export where you choose and open web links in your browser.

#[cfg(desktop)]
use tauri::Manager;
#[cfg(desktop)]
use tauri_plugin_window_state::{StateFlags, WindowExt};

// The window comes back where it was and at the size it was, maximised or not
#[cfg(desktop)]
const KEPT: StateFlags = StateFlags::SIZE.union(StateFlags::POSITION).union(StateFlags::MAXIMIZED);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(KEPT)
                .skip_initial_state("main")
                .build(),
        )
        // The window starts hidden (tauri.conf.json) and is shown once it is back in place,
        // so it never jumps from the centre to where it was left
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.restore_state(KEPT);
                let _ = window.show();
            }
            Ok(())
        });

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("Jot could not start");
}
