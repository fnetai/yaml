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

The library is designed to handle YAML content with special expression tags for dynamic data manipulation. Below is a simple guide on how to use the library to process YAML data.

### Example Use Case

Suppose you have a YAML configuration file that needs to pull in information dynamically from different sources like files or URLs. You can use the library to process this YAML content accordingly.

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
        const { content, parsed } = await yamlProcessor({ content: inputYaml, tags: ['prod'] });
        
        console.log('Processed YAML:');
        console.log(content);

    } catch (error) {
        console.error('Error processing YAML:', error);
    }
})();
```

## Examples

### Setting Values with Setters

Setters (e.g., `s::`) allow you to dynamically set values in your YAML structure.

```yaml
s::settings.server.host: localhost
s::settings.server.port: 8080
```

### Getting Values with Getters

Getters (e.g., `g::`) retrieve values, which can include fetching and merging external file content.

```yaml
config: g::file://./config.yaml
apiData: g::http://api.example.com/data.yaml
npmConfig: g::npm:@fnet/webauth@^0.1/config.yaml
```

### Using Tags

Tags (e.g., `t::`) conditionally process sections of your YAML based on the environment or context.

```yaml
t::dev::logLevel: debug
t::prod::logLevel: error
```

By specifying the tag when processing, you control which sections are included.

## Acknowledgement

This library leverages the `yaml` library for YAML parsing and additional internal and external utilities for expression processing.