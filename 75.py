import os
import itertools
import time

# --- Configuration ---

# 1. Add any directory names you want to skip
EXCLUDE_DIRS = {
    'node_modules',
    '.git',
    'venv',
    '.venv',
    'dist',
    'build',
    '__pycache__',
    '.svn',
    '.hg',
    'bin',
    'obj',
}

# 2. Add any specific file names you want to skip
EXCLUDE_FILES = {
    '.DS_Store',
    'package-lock.json',
    'yarn.lock',
    'npm-debug.log',
    '.env',  # Important: Exclude environment files to avoid leaking secrets
}

# 3. Add binary file extensions to skip (prevents errors)
BINARY_EXTENSIONS = {
    # Images
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
    # Fonts
    '.woff', '.woff2', '.ttf', '.eot',
    # Media
    '.mp4', '.webm', '.ogg', '.mp3', '.wav', '.mov',
    # Archives
    '.zip', '.tar', '.gz', '.rar', '.7z',
    # Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    # Compiled code / Binaries
    '.exe', '.dll', '.so', '.a', '.o', '.lib', '.class', '.pyc',
}

# 4. Settings
LINES_TO_COPY = 75
OUTPUT_FILE = 'code_snapshot.md'
START_DIR = '.'  # Current directory

# --- End of Configuration ---


def get_language_from_ext(ext):
    """Maps file extensions to markdown language hints for syntax highlighting."""
    mapping = {
        '.py': 'python', '.js': 'javascript', '.ts': 'typescript',
        '.jsx': 'jsx', '.tsx': 'tsx', '.html': 'html', '.css': 'css',
        '.scss': 'scss', '.json': 'json', '.md': 'markdown', '.txt': 'text',
        '.sh': 'bash', '.sql': 'sql', '.java': 'java', '.c': 'c',
        '.cpp': 'cpp', '.go': 'go', '.rs': 'rust', '.php': 'php',
        '.rb': 'ruby', '.yml': 'yaml', '.yaml': 'yaml', '.xml': 'xml',
        '.dockerfile': 'dockerfile', '.gitignore': 'bash'
    }
    return mapping.get(ext.lower(), '')  # Default to no language hint


def scrape_codebase():
    """Walks the directory, scrapes files, and writes to the output file."""
    print(f"Starting codebase scrape... (Ignoring: {', '.join(EXCLUDE_DIRS)})")
    start_time = time.time()
    file_count = 0
    snapshot_content = []

    for root, dirs, files in os.walk(START_DIR, topdown=True):
        # Prune the directory list in-place
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

        for filename in files:
            # Check for excluded files
            if filename in EXCLUDE_FILES:
                continue

            file_path = os.path.join(root, filename)
            rel_path = os.path.relpath(file_path, START_DIR)
            _, ext = os.path.splitext(filename)

            # Check for binary extensions
            if ext.lower() in BINARY_EXTENSIONS:
                continue

            # Try to read the file
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    # Read the first N lines
                    lines = list(itertools.islice(f, LINES_TO_COPY))

                    if not lines:
                        continue  # Skip empty files

                    content = "".join(lines)
                    file_count += 1

                    # --- Format for Markdown ---
                    # Use a relative path for the header
                    snapshot_content.append(f"## {rel_path}\n")
                    lang = get_language_from_ext(ext)
                    snapshot_content.append(f"```{lang}\n")
                    snapshot_content.append(content.strip())
                    snapshot_content.append("\n```\n\n")

            except UnicodeDecodeError:
                # This catches other binary files that slipped through
                print(f"Skipping binary file: {rel_path}")
            except Exception as e:
                # Catch other potential errors like permissions
                print(f"Skipping {rel_path} (Error: {e})")

    # Write the final .md file
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write(f"# Codebase Snapshot\n\n")
            f.write(f"Scraped **{file_count}** files from the repository.\n\n")
            f.write("---\n\n")
            f.write("".join(snapshot_content))

        end_time = time.time()
        print(f"\n✅ Success! Scraped {file_count} files in {end_time - start_time:.2f} seconds.")
        print(f"Snapshot saved to: {OUTPUT_FILE}")

    except Exception as e:
        print(f"❌ Error writing to {OUTPUT_FILE}: {e}")


if __name__ == "__main__":
    scrape_codebase()