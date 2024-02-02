**Important Note:** This document will automatically update, so please do not make any changes. Otherwise, you might lose them.

# Flow Node Project Setup Guide

## Prerequisites

1. Ensure you have `@fnet/cli` installed globally. If not, install it using:
```bash
npm i @fnet/cli -g
```

2. Once installed, two binary commands will be available: `fnet` and `fnode`. Use `fnode` for flow node projects.

## Identifying Project Type

- If there's a `node.yaml` in the project directory, it's a flow node project.
- Use `fnode` commands for operations related to flow node projects.

## Building the Project

To compile the project, use:
```bash
fnode build
```
This will generate a `.workspace` directory containing all necessary files and configurations for debugging, building, and deploying the project.

## Watching the Project

To run the project in development mode, use:
```bash
fnode watch
```

## Deploying the Project

Before deploying, ensure the `node.devops.yaml` file has the correct configurations for deployment. 

### Configuration for NPM Deploy in devops.yaml

For deploying to npm, ensure your `node.devops.yaml` file has the following structure:

```yaml
targets:
  - name: npm
    enabled: true
    params:
        name: "NPM PACKAGE NAME IN NPM REPO"
        version: "NPM VERSION"
```

Replace `"NPM PACKAGE NAME IN NPM REPO"` with the desired npm package name and `"NPM VERSION"` with the desired version.

To deploy the project as per the configurations, use:
```bash
fnode deploy
```

### Configuration for NPM Deploy

For deploying to npm, the tool will look for a `npm.fnet` file under the first `.fnet` directory it finds (in the project root or any parent directory, with a fallback to the user's home directory). The `npm.fnet` file should have the following format:

```yaml
version: 1
type: fnet.config
env:
  NPM_TOKEN: "YOUR_NPM_TOKEN"
```

Replace `YOUR_NPM_TOKEN` with your actual npm token for authentication during deployment.