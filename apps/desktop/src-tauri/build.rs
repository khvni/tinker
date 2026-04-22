use std::{
    env,
    path::{Path, PathBuf},
    process::Command,
};

fn desktop_dir(manifest_dir: &Path) -> PathBuf {
    manifest_dir
        .parent()
        .expect("src-tauri should live under apps/desktop")
        .to_path_buf()
}

fn binary_path(root: &Path, name: &str, target: &str) -> PathBuf {
    let extension = if target.contains("windows") {
        ".exe"
    } else {
        ""
    };
    root.join("binaries")
        .join(format!("{name}-{target}{extension}"))
}

fn ensure_sidecars_ready() {
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"));
    let target = env::var("TARGET").expect("missing TARGET");
    let tauri_dir = manifest_dir.as_path();
    let desktop_dir = desktop_dir(tauri_dir);
    let auth_sidecar = tauri_dir.join("resources").join("auth-sidecar.mjs");
    let opencode = binary_path(tauri_dir, "opencode", &target);
    let node = binary_path(tauri_dir, "node", &target);

    println!(
        "cargo:rerun-if-changed={}",
        desktop_dir
            .join("scripts/prepare-opencode-sidecar.mjs")
            .display()
    );

    if auth_sidecar.exists() && opencode.exists() && node.exists() {
        return;
    }

    let pnpm = if cfg!(windows) { "pnpm.cmd" } else { "pnpm" };
    let status = Command::new(pnpm)
        .args(["exec", "node", "./scripts/prepare-opencode-sidecar.mjs"])
        .current_dir(&desktop_dir)
        .status()
        .expect("failed to launch sidecar preparation script");

    if !status.success() {
        panic!("sidecar preparation failed with status {status}");
    }
}

fn main() {
    ensure_sidecars_ready();
    tauri_build::build()
}
