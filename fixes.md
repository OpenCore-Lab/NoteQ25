# Fixes & Improvements Log

## 1. File Handling & Persistence
**Summary**: Fixed critical bugs related to file saving and directory management.
**Description**:
- **Directory Creation**: Implemented recursive directory creation using `fs.mkdirSync(path, { recursive: true })` to ensure the target folder structure exists before writing files.
- **Path Handling**: Switched to using `path.join()` for consistent cross-platform file path construction, resolving issues with Windows backslashes vs. forward slashes.
- **Error Handling**: Added try-catch blocks around file operations to gracefully handle permission errors or invalid paths without crashing the main process.

## 2. Window Management (Electron)
**Summary**: Resolved "window is not defined" and "BrowserWindow is not a constructor" errors.
**Description**:
- **Context Isolation**: Ensured that `BrowserWindow` and other Electron main-process modules are only accessed within the `main.js` or `preload.js`, never in the renderer (React) directly.
- **IPC Communication**: Established a robust `ipcMain` and `ipcRenderer` bridge. The renderer now sends signals (e.g., `window-minimize`, `window-close`) to the main process, which handles the actual window manipulation.

## 3. UI/UX Polish
**Summary**: Fixed "white screen of death" and layout overflow issues.
**Description**:
- **React Rendering**: Corrected the `ReactDOM.createRoot` implementation to ensure the app mounts correctly to the DOM.
- **Sidebar Layout**: Fixed the sidebar width and scrolling behavior. It now remains fixed while the content area scrolls, preventing the "disappearing sidebar" bug.
- **Dark Mode**: Implemented a system-aware dark mode that persists user preference.

## 4. Search Functionality
**Summary**: Fixed the "Search is not working" issue.
**Description**:
- **Indexing**: The search now iterates through all loaded notes in memory rather than attempting to grep files on disk (which was slow and error-prone).
- **Real-time Filtering**: Implemented a reactive filter that updates the note list instantly as the user types in the search bar.

## 5. Editor Synchronization
**Summary**: Resolved the "Editor content not saving" and "Typing lag" issues.
**Description**:
- **Debouncing**: Added a 500ms debounce to the save function. This prevents the app from writing to the disk on every keystroke, which was causing performance stuttering and occasional file corruption.
- **State Management**: The editor now correctly syncs its local state with the global `AppContext`, ensuring that switching notes doesn't lose unsaved changes.

## 6. Daily Notes Logic
**Summary**: Fixed the "Daily Note creates duplicate files" bug.
**Description**:
- **Date Checking**: The system now checks if a note with `date: YYYY-MM-DD` already exists before creating a new one.
- **Filename Sanitization**: Daily notes are now named consistently (e.g., `2023-10-27.md`) to avoid collision with titled notes.

## 7. App Data Sanitization
**Summary**: Fixed `YAMLException` when saving notes.
**Description**:
- **Undefined Handling**: Added a sanitization layer in `project_system.js` to recursively remove `undefined` values from the note object before passing it to `js-yaml`. This prevents the "unacceptable kind of an object to dump" crash.

## 8. Rich Text Editor Polish & Stability
**Summary**: Implemented enterprise-grade list behaviors, fixed critical crashes, and improved editor robustness.
**Description**:
- **Crash Fix**: Resolved a `TypeError` loop caused by missing Markdown extension initialization.
- **Layout Protection**: Prevented long unbroken text strings from pushing the app UI off-screen.
- **Intelligent Lists**: Toggling lists now respects the current block scope, preventing the "whole page becomes a bullet point" bug.

## 9. Advanced Editor Features (Enterprise)
**Summary**: Implemented advanced rich text capabilities including Link management, Code Blocks with syntax highlighting, and Smart Paste.
**Description**:
- **Link Management**: 
    - Added a modal to insert/edit links.
    - If text is selected, it links the text.
    - If no text is selected, allows entering "Anchor Text" and "URL".
- **Code Blocks**:
    - Integrated `lowlight` for syntax highlighting (Atom One Dark theme).
    - Added a language selector in the toolbar that appears when a code block is active.
- **Context Menu**:
    - Custom right-click menu in the editor.
    - **Smart Paste**: Options for "Paste (Formatted)" and "Paste as Plain Text".
    - **Formatting Control**: Options to "Remove Formatting" (selection) and "Clear All Formatting" (document).
- **UI Components**:
    - Created reusable `InputModal` and `EditorContextMenu` components.
    - Replaced native prompts with styled modals.

## 10. Code Block & Theme Overhaul (2026-01-30)
**Summary**: Modernized code block handling, implemented true dark mode, and added a dynamic theme engine.
**Description**:
- **Code Block Intelligence**:
    - **Auto-Language Detection**: Implemented `lowlight` auto-detection to identify languages as you type, removing the need for manual selection.
    - **Dynamic Theming**: Code blocks now automatically switch between `Github Dark` (in light mode) and `Github Light` (in dark mode).
    - **Formatting Fixes**: Resolved critical bugs where code blocks merged with preceding content (e.g., images) by enforcing newlines during Markdown serialization.
- **True Dark Mode**:
    - **Grayscale Palette**: Replaced the blue-tinted "Slate" palette with a neutral "Gray/Black" palette for a professional dark mode experience.
    - **Deep Black**: Updated the app background to `#0a0a0a` (Deep Black) for better contrast.
- **Dynamic Theme Engine**:
    - **CSS Variables**: Refactored the entire app to use `--color-primary` for the accent color.
    - **11 New Themes**: Added a "Theme & Colors" section in Settings with 11 preset themes (Emerald Green, Crimson Red, Royal Purple, etc.).
    - **Persistence**: Theme choices are now persisted locally and applied instantly.

## 11. Editor Stability & State Management (2026-01-30)
**Summary**: Fixed persistent "Unsaved Changes" false positives and improved save logic reliability.
**Description**:
- **Programmatic Update Guard**: Implemented a `useRef` guard to distinguish between user edits and app-initiated content loading. This prevents the "Unsaved Changes" modal from appearing when simply switching notes.
- **Content Normalization**: Added strict normalization (trimming, newline standardization) to the `onUpdate` handler to prevent invisible formatting differences from flagging the file as dirty.
- **Autosave Refinement**: Updated the autosave logic to check the `unsavedChanges` flag before triggering, ensuring no redundant writes occur.
