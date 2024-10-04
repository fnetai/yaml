# Developer Guide for `@fnet/yaml`

## Overview

`@fnet/yaml` is an advanced YAML processing library designed to extend the functionality of YAML by introducing expressions within keys and values of YAML documents. The library allows for dynamic evaluation and transformation of YAML content using setters (`s::`), getters (`g::`), and tags (`t::`). This makes it a powerful tool for configuration management and data transformation in development projects.

Developers can leverage these features to automatically resolve YAML dependencies from local files, remote URLs, and manipulate YAML content based on expressions, enhancing the flexibility and reusability of YAML files in various environments.

## Installation

To install `@fnet/yaml`, use npm or yarn:

```bash
npm install @fnet/yaml
```

or

```bash
yarn add @fnet/yaml
```

### Prerequisites

Ensure you have Node.js installed on your system (version 12 or above is recommended for broader compatibility).

## Usage

This section demonstrates how to use the `@fnet/yaml` library in your projects using the exported `index` function.

### Importing the Library

```javascript
import yamlProcessor from '@fnet/yaml';
```

### Processing YAML with Expressions

You can process a YAML file or content with expressions for dynamic transformation using the `index` function. Here's how to use the library:

```javascript
import yamlProcessor from '@fnet/yaml';

(async () => {
  const yamlContent = `
    s::example:
      name: g::prop.name
      location: g::file://./location.yaml
  `;

  const result = await yamlProcessor({ content: yamlContent, tags: ['dev'] });
  console.log(result.parsed);
})();
```

#### Parameters:

- `content`: The YAML string to be processed.
- `file`: The file path to the YAML file to be processed (optional if `content` is provided).
- `tags`: An array of tags to filter which parts of the YAML should be processed based on their tags.
- `cwd`: The current working directory path (default is `process.cwd()`).

## Examples

### Example 1: Using Setters and Getters

```javascript
const yamlContent = `
s::user:
  name: John Doe
  profile: g::http://example.com/profile.yaml
`;

(async () => {
  const result = await yamlProcessor({ content: yamlContent });
  console.log(result.parsed);
})();
```

This example demonstrates the use of getters to fetch remote YAML content and integrate it into the local YAML processing result.

### Example 2: Tag-Based Transformation

```javascript
const yamlFile = 'config.yaml';

(async () => {
  const result = await yamlProcessor({ file: yamlFile, tags: ['prod'] });
  console.log(result.parsed);
})();
```

Utilize the tags to apply processing only to YAML parts marked with specific environment tags (`prod` in this case).

## Common Issues and Troubleshooting

1. **File Not Found Error**: Ensure the file path is correct and the file exists when using the `file` parameter.
2. **Invalid URL Error**: Verify all URLs are correct and accessible when using `g::` to fetch remote content.
3. **YAML Parsing Errors**: Check for any syntax errors in your YAML document if parsing fails.

## Advanced Topics

### Custom Tags Processing

You can use tags combined with setters to conditionally apply transformations:

```yaml
t::prod::s::service.url
```

This applies the setter only when the specified `prod` tag is activated.

### Integrating Dynamic Content

Inlining dynamic content or fetching external content is possible using the `g::` expressions to facilitate seamless YAML extensions with little to no manual intervention.

## Acknowledgement

While this library uses elements from the broader Node.js ecosystem, the direct set of external libraries is abstracted for installation purposes. Special thanks to the developers who have contributed to foundational packages in parsing and HTTP requests that are indirectly part of this library.

By using `@fnet/yaml`, developers can create powerful YAML configurations that adapt dynamically based on your project's requirements.