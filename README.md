# Google Calendar Event Duplicator

A Chrome extension that adds a "Duplicate" button to Google Calendar event popups, allowing users to copy events to a pre-configured destination calendar with one click.

## 🚀 Features

- **One-click duplication**: Duplicate any Google Calendar event with a single button click
- **Smart event detection**: Automatically detects event popups on calendar.google.com
- **Birthday event support**: Special handling for birthday events with automatic yearly recurrence
- **Configurable destination**: Choose your preferred destination calendar in the options page
- **Type-safe codebase**: Written in TypeScript with comprehensive type definitions
- **Modular architecture**: Well-organized, testable code structure

## 🏗️ Architecture

This extension has been refactored into a modern TypeScript architecture with the following structure:

```
src/
├── shared/              # Shared utilities and types
│   ├── types.ts        # TypeScript type definitions
│   ├── constants.ts    # Application constants
│   ├── validators.ts   # Input validation functions
│   ├── sanitizers.ts   # Data sanitization utilities
│   └── utils.ts        # General utility functions
├── background/         # Background service worker
│   ├── auth/           # Authentication management
│   ├── api/            # Google Calendar API client
│   ├── services/       # Business logic services
│   └── messaging/      # Chrome runtime messaging
├── content/            # Content script for calendar.google.com
│   ├── observers/      # DOM observation and mutation handling
│   ├── ui/             # UI components (button injection/management)
│   └── extractors/     # Event data extraction from DOM
└── options/            # Options page
    ├── components/     # UI components
    └── services/       # Settings and authentication management
```

## 🛠️ Development

### Prerequisites

- Node.js 16+ and npm
- Chrome browser for testing

### Setup

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Run tests
npm run test

# Watch mode for development
npm run build:watch
npm run test:watch
```

### Build Process

The extension uses TypeScript and esbuild for compilation:

1. **TypeScript compilation** (`tsc`): Compiles TypeScript files to JavaScript in `dist/`
2. **Bundling** (`esbuild`): Creates browser-compatible bundles for each entry point
3. **Output**: Final files are placed in `dist/` directory

### Testing

The project includes comprehensive tests using Jest:

- **Unit tests**: Test individual functions and classes
- **Integration tests**: Test component interactions
- **Mocks**: Chrome API and DOM mocks for testing
- **Fixtures**: Sample data for consistent testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test -- --coverage
```

### Development Scripts

- `npm run build` - Build the extension for production
- `npm run build:watch` - Build in watch mode for development
- `npm run typecheck` - Check TypeScript types without building
- `npm run test` - Run the test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run clean` - Clean build artifacts

## 📦 Installation

### For Development

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the extension
4. Open Chrome and go to `chrome://extensions/`
5. Enable "Developer mode"
6. Click "Load unpacked" and select the project directory

### For Users

The extension can be installed from the Chrome Web Store (once published) or by loading the unpacked extension in developer mode.

## 🔧 Configuration

1. After installation, click the extension icon to open settings
2. Sign in to your Google account when prompted
3. Select your destination calendar from the dropdown
4. Save your settings

## 🎯 Usage

1. Go to [Google Calendar](https://calendar.google.com)
2. Click on any event to open its details popup
3. Look for the "📋 Duplicate" button
4. Click the button to copy the event to your configured calendar
5. The button will show:
   - ⏳ Loading while processing
   - ✅ Success when completed
   - ❌ Error if something went wrong

## 🧪 Testing Strategy

The extension includes extensive testing:

### Unit Tests
- **Validators**: Input validation functions
- **Sanitizers**: Data sanitization utilities
- **Utilities**: Helper functions and error handling
- **Services**: Business logic components

### Integration Tests
- **API Client**: Google Calendar API interactions
- **Event Duplication**: End-to-end duplication flow
- **Authentication**: OAuth token management

### Mocks and Fixtures
- **Chrome API Mocks**: Simulate extension APIs
- **DOM Fixtures**: Sample calendar popup structures
- **API Response Fixtures**: Consistent test data

## 🚦 Error Handling

The extension includes comprehensive error handling:

- **Input Validation**: All user inputs are validated and sanitized
- **API Errors**: Graceful handling of Google Calendar API errors
- **Authentication Issues**: Clear messaging for auth problems
- **Network Failures**: Retry logic with exponential backoff
- **Security**: Protection against XSS and injection attacks

## 🔒 Security

Security is a top priority:

- **Input Sanitization**: All data is sanitized before use
- **Token Validation**: OAuth tokens are validated before API calls  
- **Content Security Policy**: Strict CSP prevents XSS attacks
- **Minimal Permissions**: Only requests necessary permissions
- **No Data Storage**: Extension doesn't store user data externally

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the existing code style
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 📋 API Compatibility

- **Google Calendar API v3**: Full compatibility
- **Chrome Extensions Manifest V3**: Modern extension architecture
- **OAuth 2.0**: Secure authentication flow

## 🐛 Known Issues

- Birthday events from Google Contacts have limited properties available
- Extension uses Chrome profile's primary Google account (not web session account)
- Some enterprise Google Workspace configurations may have restrictions

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Google Calendar API for providing calendar access
- Chrome Extensions API for browser integration
- TypeScript and esbuild for development tooling