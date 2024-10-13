# @fnet/yaml

## Introduction

The `@fnet/yaml` project is designed to extend the capabilities of YAML processing by introducing expressions that modify YAML data through setters, getters, and tags. This tool allows users to dynamically manage YAML files by setting values, retrieving content, and applying contextual processing based on tags. It's particularly useful for scenarios where YAML configurations need to be managed in a flexible and organized manner, accommodating both local and remote resources.

## How It Works

`@fnet/yaml` works by parsing YAML content and then applying specific processing rules defined by expressions embedded in the keys and values. Users can define "setters" to modify hierarchical structures, "getters" to retrieve data from different sources like files or URLs, and "tags" to conditionally process entries based on the environment or user-defined labels. The tool can handle both inline YAML content and external YAML files.

## Key Features

- **Setters (`s::`)**: Modify YAML content by specifying paths using dot notation, allowing structured adjustments to nested data.
- **Getters (`g::`)**: Retrieve and integrate content from external sources, such as local files, HTTP URLs, or npm packages, directly into the YAML structure.
- **Tags (`t::`)**: Implement conditional logic by selectively processing parts of the YAML based on tag expressions.
- **File and URL Handling**: Access and merge YAML content from local files, HTTP(s) endpoints, and package repositories.
- **Path Resolution**: Supports relative and absolute paths for accessing nested YAML data.

## Conclusion

`@fnet/yaml` offers a practical approach for users who need to manage YAML configurations with enhanced flexibility and power. It is a straightforward solution for handling complex YAML processing tasks, such as merging configurations from various sources and applying dynamic modifications with ease.