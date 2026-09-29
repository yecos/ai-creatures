mod brain;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            brain::get_brain_config,
            brain::save_brain_config,
            brain::brain_status,
            brain::brain_chat
        ])
        .run(tauri::generate_context!())
        .expect("error while running AI Creatures");
}
