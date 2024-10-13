# @fnet/yaml Developer Guide

## Overview
`@fnet/yaml` is a Node.js library designed to process YAML documents with extended features such as the ability to use expressions that allow for dynamic path setting (setter) and value getting (getter), as well as optional tag processing. The library provides a convenient way to manage YAML configurations, making dynamic assignments and external data inclusions straightforward.

## Installation
You can install the `@fnet/yaml` library using npm or yarn by running one of the following commands:

```sh
# Using npm
npm install @fnet/yaml

# Using yarn
yarn add @fnet/yaml
```

## Usage
The primary use of `@fnet/yaml` is to process YAML content by replacing placeholders with actual data sourced from various locations such as local files, HTTP URLs, or even npm packages. The library supports expressions for setting and getting values dynamically, as well as filtering parts of the configuration using tags.

### Basic Example
Here's a basic example illustrating how to use `@fnet/yaml` to process a YAML file with setters, getters, and tags:

```javascript
import processYaml from '@fnet/yaml';

async function main() {
  const result = await processYaml({
    file: 'path/to/your/config.yaml', // Path to the YAML file
    tags: ['dev'], // Optional tags to filter what parts of the config are processed
  });

  console.log(result.parsed); // Outputs the processed YAML in JSON format
  console.log(result.content); // Outputs the processed YAML as a string
}

main();
```

## Examples

### Example: Using Setters and Getters
Imagine you want to manage a configuration file with dynamic values:

**config.yaml:**
```yaml
s::person.name: John Doe
age: 30
address:
  g::file://./extra-details.yaml
```

**extra-details.yaml:**
```yaml
street: 123 Main St
city: Sampleville
```

**JavaScript Usage:**
```javascript
import processYaml from '@fnet/yaml';

async function main() {
  const result = await processYaml({
    file: 'config.yaml',
  });

  console.log(result.parsed);
  // Output:
  // {
  //   person: { name: 'John Doe' },
  //   age: 30,
  //   address: { street: '123 Main St', city: 'Sampleville' }
  // }
}

main();
```

### Example: Fetching Data from URLs
The library supports fetching YAML data from HTTP URLs and merging it into your configuration.

**config.yaml:**
```yaml
data:
  g::http://example.com/data.yaml
```

**JavaScript Usage:**
```javascript
import processYaml from '@fnet/yaml';

async function main() {
  const result = await processYaml({
    file: 'config.yaml',
  });

  console.log(result.parsed);
  // Outputs the configuration with external data included
}

main();
```

## Acknowledgement
`@fnet/yaml` utilizes the `yaml` library for YAML parsing and stringification, and it may internally leverage `axios` for HTTP requests. Special thanks to all the contributors who have helped in developing these robust tools.