# Focus Sessions - Pomodoro Timer App

[![Built with Electron](https://img.shields.io/badge/Built%20with-Electron-47848f.svg)](https://electronjs.org/)
[![React](https://img.shields.io/badge/React-18.3.1-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4.11-646cff.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4.2-3178c6.svg)](https://www.typescriptlang.org/)
[![MUI](https://img.shields.io/badge/MUI-6.3.0-0081cb.svg)](https://mui.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 👀 Overview

A modern, feature-rich Pomodoro Timer application built with Electron, React, and TypeScript. Focus Sessions helps you maintain productivity through structured work sessions with comprehensive tracking and customization options.

### ✨ Key Features

🍅 **Smart Pomodoro Timer**
- Customizable focus sessions (1-240 minutes)
- Automatic break scheduling (short & long breaks)
- Quick duration presets for flexible session lengths
- Accurate timing with pause/resume functionality

📊 **Session Tracking & Analytics**
- Daily session history with completion status
- Real-time statistics (focus time, streaks, averages)
- Export data to CSV/JSON formats
- Persistent storage with IndexedDB

🔔 **Rich Notification System**
- Audio notifications with volume control
- System tray integration with status updates
- Visual and system notifications
- Customizable notification sounds

⚙️ **Comprehensive Settings**
- Light/dark/system theme support
- Flexible time formats (12h/24h)
- Auto-start options for sessions and breaks
- Keyboard shortcuts for quick control

🖥️ **Cross-Platform Desktop App**
- System tray integration for background operation
- Window state persistence
- Global keyboard shortcuts
- Auto-updater support  

## 🚀 Quick Start

### Prerequisites
- Windows 10 or later
- Node.js 22 (see `.nvmrc`) and npm

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/GodzillaJim/my-clock-app.git
cd my-clock-app

# Install exact locked dependencies (also rebuilds better-sqlite3 for Electron)
npm ci

# Start development server
npm run dev
```

### Building for Production

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux

# Create distribution packages
npm run dist         # Current platform
npm run dist:win     # Windows installer
```

## 🏗️ Technical Architecture

### Built With
- **Frontend**: React 18, TypeScript, Material-UI (MUI)
- **Desktop**: Electron 33 with secure IPC communication
- **Build Tool**: Vite for fast development and optimized builds
- **Storage**: IndexedDB for persistent local data
- **Styling**: Emotion CSS-in-JS with MUI theme system
- **Testing**: Vitest for unit tests, Playwright for E2E testing

## 📂 Project Structure

```tree
├── electron/                    # Electron main process
│   ├── main/                   # Main process source code
│   │   ├── index.ts           # Application entry point
│   │   └── update.ts          # Auto-updater implementation
│   └── preload/               # Preload scripts for secure IPC
│
├── src/                        # React application source
│   ├── components/            # UI components
│   │   ├── timer/            # Timer-related components
│   │   │   ├── FocusTimer.tsx # Main timer interface
│   │   │   └── TimerDisplay.tsx
│   │   ├── history/          # Session history components
│   │   │   └── SessionHistory.tsx
│   │   └── settings/         # Settings interface
│   │       └── FocusSettings.tsx
│   ├── features/             # Feature modules
│   │   └── timer/           # Timer business logic
│   │       ├── hooks/       # Custom React hooks
│   │       ├── types/       # TypeScript type definitions
│   │       └── utils/       # Utility functions
│   ├── services/            # Application services
│   │   ├── focusStorage.ts  # Data persistence layer
│   │   └── notificationService.ts # Notification handling
│   └── styles/              # Theme and styling
│
├── public/                     # Static assets
│   ├── sounds/                # Notification sounds
│   └── icon.svg              # Application icon
│
├── build/                     # Build configuration
├── release/                   # Production builds (generated)
└── test/                     # Test files
```

<!--
## 🚨 Be aware

This template integrates Node.js API to the renderer process by default. If you want to follow **Electron Security Concerns** you might want to disable this feature. You will have to expose needed API by yourself.  

To get started, remove the option as shown below. This will [modify the Vite configuration and disable this feature](https://github.com/electron-vite/vite-plugin-electron-renderer#config-presets-opinionated).

```diff
# vite.config.ts

export default {
  plugins: [
    ...
-   // Use Node.js API in the Renderer-process
-   renderer({
-     nodeIntegration: true,
-   }),
    ...
  ],
}
```
-->

## 🎯 Core Features

### Timer Functionality
- **Flexible Session Lengths**: Set focus sessions from 1-240 minutes
- **Smart Break System**: Automatic short (5min) and long (15min) breaks
- **Quick Presets**: Common durations (15, 25, 30, 45, 60 minutes)
- **Pause & Resume**: Full control over session timing
- **Progress Tracking**: Visual progress indicators and remaining time

### Data Management
- **Session History**: Complete record of daily sessions
- **Statistics**: Focus time, completion rates, streak tracking
- **Data Export**: Export session data to CSV or JSON
- **Persistent Storage**: Data survives app restarts
- **Daily Reset**: Automatic daily history organization

### User Experience
- **System Tray**: Background operation with tray icon
- **Notifications**: Audio, visual, and system notifications
- **Themes**: Light, dark, and system-based themes
- **Keyboard Shortcuts**: Quick access to all functions
- **Time Formats**: 12-hour or 24-hour display options

### Advanced Features
- **Auto-updater**: Seamless application updates
- **Multi-platform**: Windows, macOS, and Linux support
- **Accessibility**: Screen reader friendly interface
- **Performance**: Optimized for minimal resource usage

## 🧪 Checks

There is no hosted CI: checks run locally. **Run `npm run check` before every push** — it must pass
before a PR is merged.

```bash
npm run check       # everything below, in order; stops at the first failure

npm run typecheck   # tsc --noEmit
npm run knip        # no unused files, dependencies or exports
npm test            # builds the app in test mode, then runs unit (jsdom) and e2e (Electron) suites
npx vite build      # production build
```

The e2e suite launches the real Electron app against a throwaway profile in your temp directory; it
never touches your own Focus Sessions data, and works while the app is open.

## 📋 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production (current platform) |
| `npm run build:win` | Build for Windows |
| `npm run build:mac` | Build for macOS |
| `npm run build:linux` | Build for Linux |
| `npm run dist` | Create distribution package |
| `npm run dist:win` | Create Windows installer |
| `npm run preview` | Preview production build |
| `npm run check` | Typecheck, knip, all tests and production build — run before every push |
| `npm run typecheck` | TypeScript type check |
| `npm run knip` | Find unused files, dependencies and exports |
| `npm test` | Build in test mode, then run unit and e2e tests |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on the foundation of [electron-vite-react](https://github.com/electron-vite/electron-vite-react)
- Material-UI for the beautiful component library
- The Electron and Vite communities for excellent tooling
