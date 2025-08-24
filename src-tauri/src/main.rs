#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{CustomMenuItem, Menu, Submenu, Manager};

fn main() {
  // Menú de la aplicación con entrada "Acerca de"
  let about = CustomMenuItem::new("about".to_string(), "Acerca de PlumaMD");
  let quit = CustomMenuItem::new("quit".to_string(), "Salir");
  let help_menu = Menu::new()
    .add_item(about)
    .add_item(quit);
  let app_menu = Menu::new()
    .add_submenu(Submenu::new("Ayuda", help_menu));

  tauri::Builder::default()
    .menu(app_menu)
    .on_menu_event(|event| {
      match event.menu_item_id() {
        "about" => {
          // Emitimos un evento al frontend para abrir el modal "Acerca de"
          let _ = event.window().app_handle().emit_all("open-about", ());
        }
        "quit" => {
          std::process::exit(0);
        }
        _ => {}
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
