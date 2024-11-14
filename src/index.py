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

def is_valid_file_url(file_url):
    """
    Check if a given URL is a valid file URL.
    """
    try:
        parsed_url = urlparse(file_url)
        return parsed_url.scheme == "file"
    except ValueError:
        return False

def is_valid_http_url(http_url):
    """
    Check if a given URL is a valid HTTP/HTTPS URL.
    """
    try:
        parsed_url = urlparse(http_url)
        return parsed_url.scheme in {"http", "https"}
    except ValueError:
        return False

def get_unpkg_url(npm_path):
    """
    Convert an NPM-style path to an unpkg.com URL.
    """
    match = NPM_URL_PATTERN.match(npm_path)
    if match:
        return f"https://unpkg.com/{match.group(1)}"
    return None

def read_file_content(file_path, cwd):
    """
    Read a file and return its raw and parsed content.
    """
    absolute_path = os.path.join(cwd, file_path)
    if os.path.exists(absolute_path):
        with open(absolute_path, "r", encoding="utf-8") as f:
            content = f.read()
        try:
            parsed = yaml.safe_load(content)
            return {"raw": content, "parsed": parsed, "resolved_dir": os.path.dirname(absolute_path)}
        except yaml.YAMLError as e:
            raise ValueError(f"Error parsing YAML from {absolute_path}: {e}")
    raise FileNotFoundError(f"File {absolute_path} does not exist.")

def fetch_http_content(http_url):
    """
    Fetch YAML content from an HTTP/HTTPS URL.
    """
    response = requests.get(http_url)
    response.raise_for_status()
    try:
        parsed = yaml.safe_load(response.text)
        return {"raw": response.text, "parsed": parsed}
    except yaml.YAMLError as e:
        raise ValueError(f"Error parsing YAML from {http_url}: {e}")

def apply_setter(obj, tags=None):
    """
    Process 'setter' expressions (s::) and apply to the object.
    """
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
        elif match and match["processor"] == "s":
            path = match["statement"].split(".")
            current_obj = obj
            for i, segment in enumerate(path):
                if i == len(path) - 1:
                    current_obj[segment] = value
                else:
                    current_obj = current_obj.setdefault(segment, {})
            del obj[key]
        elif isinstance(value, Mapping):
            apply_setter(value, tags)

def apply_getter(obj, current_path=None, root=None, cwd=None, tags=None):
    """
    Process 'getter' expressions (g::) and retrieve the referenced values.
    """
    current_path = current_path or []
    root = root or obj
    cwd = cwd or os.getcwd()
    tags = tags or []

    for key, value in list(obj.items()):
        if isinstance(value, str):
            match = expression(expression=value)
            if match and match["processor"] == "g":
                if is_valid_file_url(match["statement"]):
                    file_path = match["statement"].replace("file://", "")
                    result = read_file_content(file_path, cwd)
                    obj[key] = result["parsed"]
                    apply_setter(obj[key], tags)
                    apply_getter(obj[key], [], obj[key], result["resolved_dir"], tags)
                elif is_valid_http_url(match["statement"]):
                    result = fetch_http_content(match["statement"])
                    obj[key] = result["parsed"]
                    apply_setter(obj[key], tags)
                    apply_getter(obj[key], [], obj[key], tags)
                elif match["statement"].startswith("npm:"):
                    unpkg_url = get_unpkg_url(match["statement"])
                    if unpkg_url:
                        result = fetch_http_content(unpkg_url)
                        obj[key] = result["parsed"]
                        apply_setter(obj[key], tags)
                        apply_getter(obj[key], [], obj[key], tags)
        elif isinstance(value, Mapping):
            apply_getter(value, current_path + [key], root, cwd, tags)

def default(content=None, file=None, tags=None, cwd=None, yaml_options=None):
    """
    Main function to process YAML content or a file with optional tags.
    """
    cwd = cwd or os.getcwd()
    raw_content = None
    parsed = None

    if file:
        result = read_file_content(file, cwd)
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