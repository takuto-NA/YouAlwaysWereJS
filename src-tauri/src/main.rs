// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

// Game state management commands
#[tauri::command]
fn get_game_state() -> Result<String, String> {
    // Future: This will integrate with AI services
    Ok(serde_json::json!({
        "status": "ready",
        "player": {
            "name": "Player",
            "health": 100,
            "score": 0
        }
    }).to_string())
}

#[tauri::command]
fn update_game_state(action: String) -> Result<String, String> {
    // Future: This will use LangGraph for decision making
    Ok(serde_json::json!({
        "action": action,
        "result": "success"
    }).to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_game_state,
            update_game_state
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}



