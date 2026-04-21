use std::{fs, path::Path};

fn main() {
    let sources_dir = Path::new("src/sources");

    // Re-run if anything in the directory changes
    println!("cargo:rerun-if-changed=src/sources");

    let mut paths: Vec<_> = fs::read_dir(sources_dir)
        .expect("src/sources directory not found")
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "json"))
        .map(|e| e.path())
        .collect();
    paths.sort(); // deterministic order

    let mut out = String::from("const SOURCE_FILES: &[(&str, &str)] = &[\n");

    for path in &paths {
        // Re-run if this specific file changes
        println!("cargo:rerun-if-changed={}", path.display());

        let content = fs::read_to_string(path)
            .unwrap_or_else(|e| panic!("Failed to read {}: {}", path.display(), e));

        // Parse just enough to extract the "name" field used as the HashMap key
        let json: serde_json::Value = serde_json::from_str(&content)
            .unwrap_or_else(|e| panic!("Failed to parse {}: {}", path.display(), e));

        let key = json["name"]
            .as_str()
            .unwrap_or_else(|| panic!("Missing \"name\" field in {}", path.display()));

        // Use Rust Debug formatting for correct string escaping of both key and content
        out.push_str(&format!("    ({:?}, {:?}),\n", key, content));
    }

    out.push_str("];\n");

    let out_dir = std::env::var("OUT_DIR").expect("OUT_DIR not set");
    fs::write(Path::new(&out_dir).join("sources.rs"), &out)
        .expect("Failed to write sources.rs");
}
