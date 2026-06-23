mod commands;
mod git_worker;
mod scanner;
mod types;

use tracing_subscriber::EnvFilter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let builder =
        tauri_specta::Builder::<tauri::Wry>::new().commands(tauri_specta::collect_commands![
            commands::scan_repositories,
            commands::get_repo_status,
            commands::get_repos_status,
            commands::fetch_repos,
            commands::pull_repos,
            commands::get_repo_branches,
            commands::checkout_branch,
            commands::get_changed_files,
            commands::get_file_diff,
            commands::get_merge_conflicts,
            commands::resolve_conflict,
            commands::stash_repo,
            commands::commit_and_push,
            commands::check_system_git,
            commands::check_ssh_agent,
            commands::log_frontend_error,
        ]);

    #[cfg(debug_assertions)]
    builder
        .export(
            specta_typescript::Typescript::default(),
            "../src/bindings.ts",
        )
        .expect("Failed to export TypeScript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
