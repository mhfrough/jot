//! Jot for Windows, Linux and Android.
//!
//! One window that shows the web app from ../ui, unchanged apart from paths. Notes are kept in the
//! web view's own IndexedDB inside the app's data folder, so clearing a browser never touches them.
//! The plugins let the page save an export where you choose and open web links in your browser.

#[cfg(desktop)]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }));

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("Jot could not start");
}
