# Developer Guide for `@fnet/yaml`

## 1. Overview
`@fnet/yaml` is an npm library designed to process YAML files with enhanced capabilities such as using expressions in keys and values. It allows for dynamic value setting with setters, fetching data via file and HTTP URLs using getters, and conditionally applying transformations based on tags. This utility is particularly useful for developers working with complex YAML configurations that require dynamic and conditional data manipulation.

## 2. Installation
To install the `@fnet/yaml` library, you can use npm or yarn as shown in the following commands:

```bash
npm install @fnet/yaml
```

or

```bash
yarn add @fnet/yaml
```

## 3. Usage

The primary export of the library is an asynchronous function that accepts parameters for processing YAML content or files with optional tag filtering. Here is a step-by-step guide on how to use the library:

### Function Signature

```javascript
import yamlProcessor from '@fnet/yaml';

const processYAML = async ({ content, file, tags }) => {
  const result = await yamlProcessor({ content, file, tags });
  console.log(result);
};
```

### Parameters

- `content`: A string containing the YAML content to process.
- `file`: Path to a YAML file that will be read and processed.
- `tags`: An optional array of strings to filter which tags should be applied during processing.

### Return Value

The function returns an object with the following properties:
- `raw`: The original content of the YAML (either from the content string or from the file).
- `content`: The processed YAML content as a string.
- `parsed`: The processed YAML content as a parsed JavaScript object.

## 4. Examples

### Example 1: Processing YAML from a String

```javascript
const yamlContent = `
t::dev::name: John Doe
s::person.age: 30
person:
  skills: [coding, writing]
`;

processYAML({ content: yamlContent, tags: ['dev'] })
  .then(result => console.log(result.parsed))
  .catch(error => console.error('Error processing YAML:', error));
```

This example processes a YAML string, setting and conditionally including key-value pairs based on provided tags.

### Example 2: Processing YAML from a File

```javascript
processYAML({ file: './config.yml', tags: ['prod'] })
  .then(result => console.log(result.parsed))
  .catch(error => console.error('Error processing YAML:', error));
```

In this example, the YAML content is read from a file, filtered using the 'prod' tag.

## 5. Acknowledgement

This library leverages several external utility functions and libraries such as `yaml` for parsing YAML content, and `axios` for handling HTTP requests. Special thanks to the maintainers and contributors of these projects for providing reliable tools that enhance the functionality of this YAML processing library.

By following this guide, developers can efficiently leverage the capabilities of the `@fnet/yaml` library to manage and manipulate complex YAML configurations with dynamic data and conditional expressions.