# Developer Guide for @fnet/yaml

## Overview

The `@fnet/yaml` library is designed to enhance YAML processing capabilities by allowing developers to use expressions such as setters and getters directly within YAML keys and values. It supports reading from files, URLs, and even fetching content from npm packages. With these enhancements, developers can manage complex configurations across different environments by manipulating YAML data dynamically.

## Installation

To install the `@fnet/yaml` library, you can use either npm or yarn:

```bash
npm install @fnet/yaml
```

or

```bash
yarn add @fnet/yaml
```

## Usage

The library processes YAML content with special expression tags for dynamic data manipulation. Here's a guide on using the library:

### Function Signature

```typescript
type Input = {
    content?: string;        // The YAML content to be processed
    file?: string;          // The path to the YAML file to be processed
    tags?: string[];        // Array of tags to filter content by (e.g., ['dev', 'prod'])
    cwd?: string;          // Current working directory for resolving relative paths
};

type Output = {
    raw: string;           // Original unprocessed YAML content
    content: string;       // Processed YAML content as string
    parsed: Object;        // Processed YAML content as JavaScript object
};
```

### Example Use Case

```javascript
import yamlProcessor from '@fnet/yaml';

(async () => {
    const inputYaml = `
        # Using a setter to update person name
        s::person.name: John Doe

        # Using a getter to include content from another YAML file
        profile: g::file://./additional-profile.yaml

        # Using a tag to conditionally include data
        t::prod::producer:
            name: exampleProd
    `;

    try {
        const { raw, content, parsed } = await yamlProcessor({ 
            content: inputYaml, 
            tags: ['prod'] 
        });
        
        console.log('Original YAML:', raw);
        console.log('Processed YAML:', content);
        console.log('Parsed Object:', parsed);

    } catch (error) {
        console.error('Error processing YAML:', error);
    }
})();
```

## Examples

### Setting Values with Setters

Setters (`s::`) allow you to dynamically set values in your YAML structure:

```yaml
s::settings.server.host: localhost
s::settings.server.port: 8080
```

### Getting Values with Getters

Getters (`g::`) retrieve values from various sources:

```yaml
# Local file
config: g::file://./config.yaml

# HTTP(S) URL
apiData: g::http://api.example.com/data.yaml

# NPM package
npmConfig: g::npm:@fnet/webauth@^0.1/config.yaml
```

### Using Tags

Tags (`t::`) conditionally process sections based on the environment:

```yaml
t::dev::logLevel: debug
t::prod::logLevel: error
```

### Combining Features

You can combine different features:

```yaml
# Tag with setter
t::prod::s::database.host: prod-db.example.com

# Tag with getter
t::dev::config: g::file://./dev-config.yaml
```

## Error Handling

The processor throws errors in these cases:
- When neither content nor file is provided
- When a specified file doesn't exist
- When YAML parsing fails
- When expression processing fails

## Acknowledgement

This library leverages the `yaml` library for YAML parsing and additional internal and external utilities for expression processing.
