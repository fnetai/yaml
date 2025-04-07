"""
IMPORTANT: Function Naming Convention
----------------------------------------------------------------------------
This module uses 'default' (not 'main') as the entry point function because:
1. 'main' in Python is traditionally used with '__main__' for script execution
2. 'default' here indicates a module's primary export/entry point
3. This matches @fnet's auto-detection system for module interfaces
4. Keeps clear separation from Python's if __name__ == '__main__' pattern

The 'default' naming convention allows this module to be used both as:
- A standard Python module with a clear entry point
- A component in the @fnet system's auto-detection framework
"""

import re
import os
# @hint: pyyaml (channel=pypi, version=6.0)
import yaml
# @hint: requests (channel=pypi)
import requests
from urllib.parse import urlparse
# @hint: fnet-expression (channel=pypi)
from fnet_expression import default as expression
from collections.abc import Mapping

# Regex patterns
RELATIVE_PATH_PATTERN = re.compile(r"^(\./|(\.\./)+).*$")
NPM_URL_PATTERN = re.compile(r"^npm:(.*)$")

def get_value(obj, path):
    """Get value from object using dot notation path."""
    current = obj
    for segment in path:
        if isinstance(segment, int):
            if not isinstance(current, list):
                return None
            if segment >= len(current):
                return None
        elif not isinstance(current, Mapping):
            return None
        try:
            current = current[segment]
        except (KeyError, IndexError):
            return None
    return current

def get_real_path(current_path, relative_path):
    """Resolve relative path based on current path."""
    combined_path = current_path + relative_path
    real_path = []
    for segment in combined_path:
        if segment == "..":
            if real_path:
                real_path.pop()
        elif segment != ".":
            real_path.append(segment)
    return real_path

def is_valid_file_url(file_url):
    """Check if a given URL is a valid file URL."""
    try:
        parsed_url = urlparse(file_url)
        return parsed_url.scheme == "file"
    except ValueError:
        return False

def is_valid_http_url(http_url):
    """Check if a given URL is a valid HTTP/HTTPS URL."""
    try:
        parsed_url = urlparse(http_url)
        return parsed_url.scheme in {"http", "https"}
    except ValueError:
        return False

def get_unpkg_url(npm_path):
    """Convert an NPM-style path to an unpkg.com URL."""
    match = NPM_URL_PATTERN.match(npm_path)
    if match:
        return f"https://unpkg.com/{match.group(1)}"
    return None

def read_file_content(file_path, cwd, tags=None):
    """Read a file and return its parsed content."""
    absolute_path = os.path.join(cwd, file_path)
    if os.path.exists(absolute_path):
        with open(absolute_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        if file_path.endswith(('.yaml', '.yml')):
            result = default(content=content, tags=tags, cwd=os.path.dirname(absolute_path))
            return {
                "parsed": result["parsed"],
                "resolved_path": absolute_path,
                "resolved_dir": os.path.dirname(absolute_path)
            }
        return {
            "parsed": content,  # For gtext, return raw content
            "resolved_path": absolute_path,
            "resolved_dir": os.path.dirname(absolute_path)
        }
    raise FileNotFoundError(f"File {absolute_path} does not exist.")

def fetch_http_content(http_url, cwd=None, tags=None):
    """Fetch content from an HTTP/HTTPS URL."""
    try:
        response = requests.get(http_url)
        response.raise_for_status()
        
        if http_url.endswith(('.yaml', '.yml')):
            result = default(content=response.text, tags=tags, cwd=cwd)
            return {"parsed": result["parsed"]}
        return {"parsed": response.text}  # For gtext, return raw content
    except requests.RequestException as e:
        print(f"Error fetching content from {http_url}: {str(e)}")
        return None

def parse_path_segment(segment):
    """Parse path segment to handle array indices."""
    array_match = re.match(r'^\[(\d+)\]$', segment)
    if array_match:
        return int(array_match.group(1))
    return segment

def apply_setter(obj, tags=None):
    """Process 'setter' expressions (s::) and apply to the object."""
    tags = tags or []
    for key, value in list(obj.items()):
        match = expression(expression=key)
        if match and match["processor"] == "t":
            tag = match.get("next")
            if tag and tag["processor"] not in tags:
                del obj[key]
                continue
            sub_processor = tag.get("next")
            if sub_processor and sub_processor["processor"] in {"s", "t"}:
                obj[sub_processor["expression"]] = value
                apply_setter(obj, tags)
            else:
                obj[tag["statement"]] = value
            del obj[key]
        elif match and match["processor"] == "s":
            path = [parse_path_segment(seg) for seg in match["statement"].split(".")]
            current_obj = obj
            
            for i, segment in enumerate(path[:-1]):
                next_is_array = isinstance(path[i + 1], int)
                if isinstance(segment, int):
                    while len(current_obj) <= segment:
                        current_obj.append([] if next_is_array else {})
                    current_obj = current_obj[segment]
                else:
                    if segment not in current_obj:
                        current_obj[segment] = [] if next_is_array else {}
                    current_obj = current_obj[segment]
            
            current_obj[path[-1]] = value
            del obj[key]
            
            if isinstance(value, Mapping):
                apply_setter(value, tags)
        elif isinstance(value, Mapping):
            apply_setter(value, tags)

def apply_getter(obj, current_path=None, root=None, cwd=None, tags=None):
    """Process 'getter' expressions (g::) and retrieve the referenced values."""
    current_path = current_path or []
    root = root or obj
    cwd = cwd or os.getcwd()
    tags = tags or []

    for key, value in list(obj.items()):
        if isinstance(value, str):
            match = expression(expression=value)
            if match and match["processor"] in {"g", "gtext"}:
                if is_valid_file_url(match["statement"]):
                    file_path = match["statement"].replace("file://", "")
                    result = read_file_content(file_path, cwd, tags)
                    obj[key] = result["parsed"]
                    if match["processor"] == "g" and isinstance(obj[key], Mapping):
                        apply_setter(obj[key], tags)
                        apply_getter(obj[key], [], obj[key], result["resolved_dir"], tags)
                elif is_valid_http_url(match["statement"]):
                    result = fetch_http_content(match["statement"], cwd, tags)
                    if result:
                        obj[key] = result["parsed"]
                        if match["processor"] == "g" and isinstance(obj[key], Mapping):
                            apply_setter(obj[key], tags)
                            apply_getter(obj[key], [], obj[key], cwd, tags)
                elif match["statement"].startswith("npm:"):
                    unpkg_url = get_unpkg_url(match["statement"])
                    if unpkg_url:
                        result = fetch_http_content(unpkg_url, cwd, tags)
                        if result:
                            obj[key] = result["parsed"]
                            if match["processor"] == "g" and isinstance(obj[key], Mapping):
                                apply_setter(obj[key], tags)
                                apply_getter(obj[key], [], obj[key], cwd, tags)
                else:
                    paths = []
                    if RELATIVE_PATH_PATTERN.match(match["statement"]):
                        relative_segments = match["statement"].split("/")
                        paths = get_real_path(current_path, relative_segments)
                    else:
                        # Match JavaScript's path expansion behavior
                        expanded_paths = []
                        for segment in match["statement"].split("."):
                            for subseg in segment.split("."):
                                array_match = re.match(r'^\[(\d+)\]$', subseg)
                                if array_match:
                                    expanded_paths.append(int(array_match.group(1)))
                                else:
                                    expanded_paths.append(subseg)
                        paths = expanded_paths

                    value_from_path = get_value(root, paths)
                    if value_from_path is not None:
                        obj[key] = value_from_path
        elif isinstance(value, Mapping):
            apply_getter(value, current_path + [key], root, cwd, tags)

def default(content=None, file=None, tags=None, cwd=None, yaml_options=None):
    """Main function to process YAML content or a file with optional tags."""
    cwd = cwd or os.getcwd()
    raw_content = None
    parsed = None

    if file:
        result = read_file_content(file, cwd, tags)
        raw_content = result["raw"]
        parsed = result["parsed"]
        cwd = result["resolved_dir"]
    elif content:
        raw_content = content
        parsed = yaml.safe_load(content)

    if parsed is None:
        raise ValueError("No content provided or file could not be read.")

    apply_setter(parsed, tags)
    apply_getter(parsed, [], parsed, cwd, tags)

    return {
        "raw": raw_content,
        "content": yaml.dump(parsed, **(yaml_options or {})),
        "parsed": parsed,
    }
