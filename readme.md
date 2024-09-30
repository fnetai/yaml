# @fnet/yaml

**@fnet/yaml** is a utility designed to process YAML content with advanced functionalities. From an end-user perspective, this tool offers the ability to not only parse YAML files but also dynamically modify and extend them with enhanced tag-driven features. Below is a detailed breakdown of its main purpose and functionality.

### Main Purpose
The primary purpose of @fnet/yaml is to **process and manage YAML files**. It is designed to support complex configurations and manipulations by enabling users to:
- **Parse YAML content** from both local files and HTTP URLs.
- **Apply dynamic modifications** (setters) to the YAML structure based on specific tags.
- **Retrieve and insert content** (getters) from various sources into the YAML structure.

### Key Functionalities

#### Reading and Parsing YAML Content
The utility can handle YAML content:
- **From local files**: It reads and parses the YAML content from any specified file path, ensuring that the file exists and is readable before proceeding.
- **From HTTP URLs**: It fetches and parses YAML content from a given HTTP URL, making sure to handle network errors and parse errors gracefully.

#### Dynamic Modifications with Setters
- **Setters** allow users to dynamically insert values into the YAML structure based on expressions and conditions. These modifications are facilitated through custom tags (`t::` for processing tags and `s::` for setting values).
- **Tag Filtering**: Users can specify tags to filter which parts of the YAML should be processed, providing granular control over the modifications.

#### Content Retrieval with Getters
- **Getters** fetch and insert content into the YAML from various sources. This includes:
  - **Local file paths**: Allows incorporation of content from other YAML files.
  - **HTTP URLs**: Inserts content retrieved from remote YAML files.
  - **Relative paths and complex expressions**: Handles both relative and complex paths within the YAML structure to resolve values dynamically.

### Error Handling
@fnet/yaml ensures robust **error handling** by:
- Validating URLs (both file and HTTP URLs) to ensure correctness.
- Gracefully dealing with network and parse errors, logging meaningful messages to aid debugging and user awareness.

### Example Use Cases
- **Configuration Management**: Ideal for managing and modifying configuration files dynamically, accommodating changes without manual edits.
- **Complex Data Structures**: Supports scenarios where nested or linked data needs to be managed, making it easier to maintain large and intricate YAML structures.
- **Automated Deployments**: Useful in CI/CD pipelines for dynamically generating and modifying configurations based on various conditions and inputs.

In summary, **@fnet/yaml** provides a comprehensive and flexible approach to handling YAML files, offering powerful features for parsing, dynamic modifications, and content retrieval, all while ensuring robust error handling and user control through tag filtering.