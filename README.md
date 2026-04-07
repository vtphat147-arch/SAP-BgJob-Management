# SAP Background Jobs Management

An SAP Fiori application for managing and monitoring SAP background jobs. Built with SAPUI5 and the Flexible Programming Model (FPM).

## Features

- **View Background Jobs**: Display a list of all background jobs with details like job name, status, start date/time, duration, and creator
- **Create New Jobs**: Schedule new background jobs with program and variant selection
- **Filter Own Jobs**: Quickly filter to show only jobs created by the current user
- **View Job Logs**: Access detailed job execution logs for troubleshooting
- **Job Scheduling**: Schedule jobs with flexible date/time options

## Prerequisites

- [Node.js](https://nodejs.org) LTS version (v18.x or higher recommended)
- npm (comes with Node.js)
- Access to SAP backend system with OData V4 service

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd project5
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

### Development Mode (Live Backend)

Connect to the live SAP backend:

```bash
npm start
```

### Development Mode (Mock Data)

Run with mock data for offline development:

```bash
npm run start-mock
```

### Local Development

Run with local configuration:

```bash
npm run start-local
```

### Integration Tests

Run OPA5 integration tests:

```bash
npm run int-test
```

## Project Structure

```
project5/
├── webapp/
│   ├── Component.js           # Application component
│   ├── manifest.json          # Application descriptor
│   ├── index.html             # Entry point
│   ├── annotations/           # OData annotations
│   │   └── annotation.xml
│   ├── ext/
│   │   ├── fragment/          # UI fragments
│   │   │   ├── JobLog.fragment.xml
│   │   │   ├── ProgramValueHelp.fragment.xml
│   │   │   ├── SchedulingDialog.fragment.xml
│   │   │   └── VariantValueHelp.fragment.xml
│   │   └── main/              # Main views and controllers
│   │       ├── Main.controller.js
│   │       ├── Main.view.xml
│   │       ├── CreateJob.controller.js
│   │       └── CreateJob.view.xml
│   ├── i18n/                  # Internationalization
│   │   └── i18n.properties
│   ├── localService/          # Mock service metadata
│   │   └── mainService/
│   │       └── metadata.xml
│   └── test/                  # Test files
│       └── integration/
├── ui5.yaml                   # UI5 tooling configuration
├── ui5-local.yaml             # Local development configuration
├── ui5-mock.yaml              # Mock server configuration
├── ui5-deploy.yaml            # Deployment configuration
└── package.json
```

## Build and Deployment

### Build for Production

```bash
npm run build
```

The build output will be generated in the `dist` folder.

### Deploy to SAP

```bash
npm run deploy
```

### Test Deployment (Dry Run)

```bash
npm run deploy-test
```

## Technologies

- **SAPUI5** v1.108.33
- **SAP Fiori Elements** - Flexible Programming Model (FPM)
- **OData V4** - Backend service protocol
- **SAP Horizon Theme** - Modern UI theme

## Application Details

| Property | Value |
|----------|-------|
| Generator | SAP Fiori Application Generator v1.20.1 |
| Template | Custom Page V4 |
| UI5 Version | 1.108.33 |
| OData Version | 4.0 |
| Main Entity | JobList |

## License

This project is proprietary software.


