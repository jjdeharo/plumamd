use tauri::{CustomMenuItem, Menu, Submenu, Manager};
// (sin icono en Rust; se fija desde frontend)

#[tauri::command]
fn initial_args() -> Vec<String> {
  std::env::args().skip(1).collect()
}

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
    // Emite los archivos abiertos cuando la vista está cargada,
    // para no perder el evento antes de que el frontend escuche.
    .on_page_load(|window, _payload| {
      let args: Vec<String> = std::env::args().skip(1).collect();
      if !args.is_empty() {
        for arg in args {
          let _ = window.emit("open-file", arg);
        }
      }
    })
    .invoke_handler(tauri::generate_handler![initial_args])
    .setup(|_app| {
      Ok(())
    })
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
