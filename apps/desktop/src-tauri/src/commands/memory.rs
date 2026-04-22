use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

const ALLOWED_MEMORY_DIRECTORIES: [&str; 6] = [
    "Pending",
    "People",
    "Active Work",
    "Capabilities",
    "Preferences",
    "Organization",
];

/// Validate that a destination directory exactly matches one of the canonical
/// Memory folders on disk.
pub(crate) fn validate_destination_dir(value: &str) -> Result<(), String> {
    if ALLOWED_MEMORY_DIRECTORIES.contains(&value) {
        return Ok(());
    }

    Err(format!(
        "Destination directory must exactly match one of: {}.",
        ALLOWED_MEMORY_DIRECTORIES.join(", ")
    ))
}

fn has_pending_segment(path: &Path) -> bool {
    path.components().any(|component| {
        matches!(
            component.as_os_str().to_str(),
            Some(segment) if segment == "Pending"
        )
    })
}

fn require_pending_segment(path: &Path) -> Result<(), String> {
    if has_pending_segment(path) {
        return Ok(());
    }
    Err(format!(
        "Memory file is not in a pending directory: \"{}\".",
        path.display()
    ))
}

fn user_subdir_from_pending_file(path: &Path) -> Result<PathBuf, String> {
    let pending_dir = path.parent().ok_or_else(|| {
        format!(
            "Memory file has no parent directory: \"{}\".",
            path.display()
        )
    })?;
    let user_subdir = pending_dir.parent().ok_or_else(|| {
        format!(
            "Memory file has no grandparent directory: \"{}\".",
            path.display()
        )
    })?;
    Ok(user_subdir.to_path_buf())
}

/// Move a pending memory entry into the chosen category directory and
/// return its new absolute path.
#[tauri::command]
pub async fn memory_approve(file_path: String, destination_dir: String) -> Result<String, String> {
    validate_destination_dir(&destination_dir)?;

    let source_path = PathBuf::from(&file_path);
    if !source_path.exists() {
        return Err(format!("Memory file does not exist: \"{file_path}\"."));
    }
    require_pending_segment(&source_path)?;

    let basename = source_path
        .file_name()
        .ok_or_else(|| format!("Memory file has no basename: \"{file_path}\"."))?
        .to_owned();

    let user_subdir = user_subdir_from_pending_file(&source_path)?;
    let destination_root = user_subdir.join(&destination_dir);
    fs::create_dir_all(&destination_root).map_err(|error| error.to_string())?;

    let destination_path = destination_root.join(&basename);
    fs::rename(&source_path, &destination_path).map_err(|error| error.to_string())?;

    Ok(destination_path.to_string_lossy().into_owned())
}

/// Tombstone-log + delete a pending memory entry.
#[tauri::command]
pub async fn memory_dismiss(file_path: String) -> Result<(), String> {
    let source_path = PathBuf::from(&file_path);
    if !source_path.exists() {
        return Err(format!("Memory file does not exist: \"{file_path}\"."));
    }
    require_pending_segment(&source_path)?;

    let basename = source_path
        .file_name()
        .ok_or_else(|| format!("Memory file has no basename: \"{file_path}\"."))?
        .to_string_lossy()
        .into_owned();

    let user_subdir = user_subdir_from_pending_file(&source_path)?;
    let tombstone_path = user_subdir.join(".dismissed.log");

    let mut log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&tombstone_path)
        .map_err(|error| error.to_string())?;
    writeln!(log_file, "{basename}").map_err(|error| error.to_string())?;

    fs::remove_file(&source_path).map_err(|error| error.to_string())?;

    Ok(())
}

/// Return `git diff --no-color HEAD -- <file_path>` output, or an empty
/// string when the file is not tracked by a git repository.
#[tauri::command]
pub async fn memory_diff(file_path: String) -> Result<String, String> {
    let target_path = PathBuf::from(&file_path);
    let working_dir = target_path
        .parent()
        .ok_or_else(|| format!("Memory file has no parent directory: \"{file_path}\"."))?
        .to_path_buf();
    let target_for_task = target_path.clone();

    tauri::async_runtime::spawn_blocking(move || run_git_diff(&working_dir, &target_for_task))
        .await
        .map_err(|error| format!("Memory diff task join failed: {error}"))?
}

fn run_git_diff(working_dir: &Path, target_path: &Path) -> Result<String, String> {
    let output = match Command::new("git")
        .arg("diff")
        .arg("--no-color")
        .arg("HEAD")
        .arg("--")
        .arg(target_path)
        .current_dir(working_dir)
        .output()
    {
        Ok(output) => output,
        Err(_) => return Ok(String::new()),
    };

    let stderr = String::from_utf8_lossy(&output.stderr);

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).into_owned());
    }

    // Git returns non-zero in a few benign cases that should surface as an
    // empty diff rather than an error:
    //   - current directory (or any ancestor) is not a git repository
    //   - the file exists but has never been tracked
    let lowered = stderr.to_lowercase();
    if lowered.contains("not a git repository")
        || lowered.contains("does not have any commits")
        || lowered.contains("unknown revision")
        || lowered.contains("ambiguous argument")
        || lowered.contains("did not match any file")
    {
        return Ok(String::new());
    }

    Err(stderr.trim().to_string())
}

#[cfg(test)]
mod memory_test {
    use super::validate_destination_dir;

    #[test]
    fn accepts_canonical_memory_folder_names() {
        validate_destination_dir("Pending").expect("Pending should be valid");
        validate_destination_dir("People").expect("People should be valid");
        validate_destination_dir("Active Work").expect("Active Work should be valid");
        validate_destination_dir("Capabilities").expect("Capabilities should be valid");
        validate_destination_dir("Preferences").expect("Preferences should be valid");
        validate_destination_dir("Organization").expect("Organization should be valid");
    }

    #[test]
    fn rejects_empty_slug() {
        assert!(validate_destination_dir("").is_err());
    }

    #[test]
    fn rejects_traversal_tokens() {
        assert!(validate_destination_dir("..").is_err());
        assert!(validate_destination_dir("../escape").is_err());
    }

    #[test]
    fn rejects_path_separators() {
        assert!(validate_destination_dir("people/khani").is_err());
        assert!(validate_destination_dir("people\\sub").is_err());
    }

    #[test]
    fn rejects_uppercase_or_leading_digit() {
        assert!(validate_destination_dir("1people").is_err());
        assert!(validate_destination_dir("-people").is_err());
        assert!(validate_destination_dir("active-work").is_err());
    }

    #[test]
    fn rejects_whitespace_and_punctuation() {
        assert!(validate_destination_dir("people!").is_err());
        assert!(validate_destination_dir(" Active Work ").is_err());
    }
}
