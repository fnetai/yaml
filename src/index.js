import { parse, stringify } from 'yaml';
import expression from '@fnet/expression';
import getValue from 'get-value';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';

// Expressions in object key
// s:: means setter for a propery path with dot notation
// t:: means tag
// Expression in object value
// g:: means getter
// Expression in object key for composition
// merge:: means deep merge stack into object path
// push:: means append stack items into array path

// Sample setters
// s::person.name
// s::person[0].name
// s::person[0].name.first

// Sample getters
// g::person (in current key leve)
// g::person.name
// g::../person[0].name (go one level up and get the name of the first person with dot notation)
// g::/person[0].name.first (root level and get the first person's first name with dot notation)
// g::file://./person.yaml (read the file and merge the content)
// g::file://../person.yaml (read the file and merge the content)
// g::file://./person.yaml#/person/name (read the file and extract specific path)
// g::http://example.com/person.yaml (fetch the file and merge the content)
// g::http://example.com/person.yaml#/data/users/0 (fetch the file and extract specific path)
// g::npm:@fnet/webauth@^0.1/fnet/input.yaml (fetch the file from npm and merge the content)
// g::npm:@fnet/webauth@^0.1/fnet/input.yaml#/config/database (fetch from npm and extract specific path)

// sample tags
// t::dev::person
// t::prod::s::person.name
// t::prod::t::local::s::person.name (nested tags with setters)

// @ai: any object key name including any preprocessor follows regular yaml syntax rules
// @ai: any object key having setter processor uses dot notation always to set the value of the object
// @ai: setter always can be used in object keys
// @ai: getter always can be used in object values
// @ai: tag can be used in object keys
// @ai: any setter or tagger is being removed from object key after they are being processed
// @ai: any getter is being replaced with the value behind the getter processor protocol

const MERGE_PREFIX = 'merge::';
const PUSH_PREFIX = 'push::';

// Regex pattern to detect relative paths like "./" and "../"
const relativePathPattern = /^(\.\/|(\.\.\/)+).*$/;

// Validate if the provided string is a valid file URL
function isValidFileURL(fileURL) {
  try {
    const parsedUrl = new URL(fileURL);
    return parsedUrl.protocol === 'file:';
  } catch (error) {
    return false;
  }
}

function isValidHttpURL(httpURL) {
  try {
    const parsedUrl = new URL(httpURL);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

// Helper function to handle npm URLs (like g::npm:@fnet/webauth@^0.1/fnet/input.yaml)
function getUnpkgUrl(npmPath) {
  const npmMatch = npmPath.match(/^npm:(.*)$/);
  if (npmMatch) {
    // Construct the equivalent unpkg URL
    const unpkgUrl = `https://unpkg.com/${npmMatch[1]}`;
    return unpkgUrl;
  }
  return null;
}

// Helper function to parse URL with fragment for path extraction
function parseUrlWithFragment(urlString) {
  try {
    const url = new URL(urlString);
    const baseUrl = urlString.split('#')[0];
    const fragment = url.hash ? url.hash.substring(1) : null; // Remove # character

    let pathSegments = null;
    if (fragment && fragment.startsWith('/')) {
      pathSegments = fragment.substring(1).split('/').flatMap(segment => {
        if (segment === '') return [];
        // Handle standalone index: /people/0
        const indexMatch = segment.match(/^(\d+)$/);
        if (indexMatch) return [parseInt(indexMatch[1], 10)];
        // Handle bracket notation within segment: /people[0] or /people[0]/name
        const parts = [];
        const keyMatch = segment.match(/^([^\[]*)((?:\[\d+\])*)$/);
        if (keyMatch) {
          if (keyMatch[1]) parts.push(keyMatch[1]);
          const indices = keyMatch[2].match(/\[(\d+)\]/g) || [];
          indices.forEach(idx => parts.push(parseInt(idx.slice(1, -1), 10)));
        } else {
          parts.push(segment);
        }
        return parts.length ? parts : [segment];
      });
    }

    return { baseUrl, pathSegments };
  } catch (error) {
    // If URL parsing fails, return original URL without fragment support
    return { baseUrl: urlString, pathSegments: null };
  }
}

// Extract a fragment path from parsed YAML content.
// A trailing `*` segment means "return all values from this object/array target".
// A trailing `{a,b}` segment expands to values from multiple immediate child keys.
// A trailing glob segment such as `comment_*` expands to matching immediate child values.
function extractFragmentValue(source, pathSegments) {
  if (!pathSegments || pathSegments.length === 0) return source;

  const expansionIndex = pathSegments.findIndex(segment =>
    typeof segment === 'string' && (hasBraceExpansion(segment) || segment.includes('*'))
  );

  if (expansionIndex !== -1) {
    if (expansionIndex !== pathSegments.length - 1) return null;

    const parentPath = pathSegments.slice(0, -1);
    const target = parentPath.length > 0 ? getValue(source, parentPath) : source;
    const expansion = pathSegments[pathSegments.length - 1];

    if (hasBraceExpansion(expansion)) {
      if (target === undefined || target === null) return null;
      return expandBraceKeys(expansion).map(childKey => {
        const childValue = getValue(target, [childKey]);
        return childValue !== undefined ? childValue : null;
      });
    }

    if (Array.isArray(target) && expansion === '*') return target;
    if (isPlainObject(target)) {
      const matcher = globToRegExp(expansion);
      return Object.keys(target).filter(key => matcher.test(key)).map(key => target[key]);
    }

    return null;
  }

  const extractedValue = getValue(source, pathSegments);
  return extractedValue !== undefined ? extractedValue : null;
}

function hasBraceExpansion(segment) {
  return /\{[^{}]+\}/.test(segment);
}

function expandBraceKeys(segment) {
  const match = segment.match(/^(.*)\{([^{}]+)\}(.*)$/);
  if (!match) return [segment];

  const [, prefix, body, suffix] = match;
  return body.split(',').map(part => `${prefix}${part.trim()}${suffix}`);
}

function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '[^/]*')}$`);
}

async function fetchHttpContent(httpURL, cwd, tags, cache) {
  const cacheKey = `http:${httpURL}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  try {
    const response = await fetch(httpURL);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();

    const { parsed } = await fnetYaml({ content: text, cwd, tags }, undefined, cache);

    const result = { parsed };
    cache.set(cacheKey, result);
    return result;
  } catch (networkError) {
    console.error(`Error fetching content from ${httpURL}:`, networkError?.message);
  }
}

// Read the file content based on the filePath and current working directory (cwd)
async function readFileContent(filePath, cwd, tags, cache) {
  const absolutePath = path.resolve(cwd, filePath);
  const cacheKey = `file:${absolutePath}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const { parsed } = await fnetYaml({ file: absolutePath, tags }, undefined, cache);

  const result = {
    parsed,
    resolvedPath: absolutePath,
    resolvedDir: path.dirname(absolutePath),
  };
  cache.set(cacheKey, result);
  return result;
}

// Resolve a relative path based on the current path and the given relative path
function getRealPath(currentPath, relativePath) {
  const combinedPath = [...currentPath, ...relativePath];
  const realPath = [];
  for (let segment of combinedPath) {
    if (segment === "..") {
      realPath.pop(); // Move one level up
    } else if (segment === ".") {
      // Do nothing
    } else {
      realPath.push(segment);
    }
  }
  return realPath;
}

// Process and apply setters in the given object, with tag handling for processor 't'
async function applySetter(obj, tags = []) {
  for (const [key, value] of Object.entries(obj)) {
    const match = await expression({ expression: key });

    if (match && match.processor === 't') {

      if (!match.next) continue;

      const tag = match.next;

      // If the tag is not in the provided tags array, remove this entry
      if (!tags.includes(tag.processor)) {
        delete obj[key];
        continue;
      }

      const subProcessor = tag.next; // Get the underlying processor (e.g., 's')

      // Handle the underlying processor (assume it is 's' for setter)
      if (subProcessor?.processor === 's' || subProcessor?.processor === 't') {
        delete obj[key]; // Remove the tag entry
        obj[subProcessor.expression] = value; // Apply the setter
        await applySetter(obj, tags); // Pass along the sub-processor
      }
      else {
        delete obj[key]; // Remove the tag entry
        if (
          (tag.statement.startsWith(MERGE_PREFIX) || tag.statement.startsWith(PUSH_PREFIX)) &&
          Object.prototype.hasOwnProperty.call(obj, tag.statement)
        ) {
          const existingValue = obj[tag.statement];
          const existingSources = Array.isArray(existingValue) ? existingValue : [existingValue];
          const incomingSources = Array.isArray(value) ? value : [value];
          obj[tag.statement] = [...existingSources, ...incomingSources];
        } else {
          obj[tag.statement] = value; // Apply the setter
        }
      }
    } else if (match && match.processor === 's') {
      const path = match.statement.split('.').flatMap((segment) => {
        // Handle "key[index]" notation e.g. "users[0]" → ['users', 0]
        const parts = [];
        const keyMatch = segment.match(/^([^\[]*)((?:\[\d+\])*)$/);
        if (keyMatch) {
          if (keyMatch[1]) parts.push(keyMatch[1]);
          const indices = keyMatch[2].match(/\[(\d+)\]/g) || [];
          indices.forEach(idx => parts.push(parseInt(idx.slice(1, -1), 10)));
        } else {
          parts.push(segment);
        }
        return parts.length ? parts : [segment];
      });

      let currentObj = obj;

      for (let i = 0; i < path.length; i++) {
        if (i === path.length - 1) {
          if (typeof path[i] === "number" && !Array.isArray(currentObj)) {
            currentObj = [];
          }
          currentObj[path[i]] = value;
        } else {
          if (typeof path[i] === "number") {
            if (!currentObj[path[i]]) {
              currentObj[path[i]] = typeof path[i + 1] === 'number' ? [] : {};
            }
            currentObj = currentObj[path[i]];
          } else {
            if (!currentObj[path[i]]) {
              currentObj[path[i]] = typeof path[i + 1] === 'number' ? [] : {};
            }
            currentObj = currentObj[path[i]];
          }
        }
      }

      delete obj[key];

      if (typeof currentObj === 'object' && currentObj !== null) {
        await applySetter(currentObj, tags);
      }

    } else if (typeof value === 'object' && value !== null) {
      await applySetter(value, tags);
    }
  }
}

// Process and apply getters in the given object
async function applyGetter(obj, currentPath = [], root = obj, cwd = process.cwd(), tags = [], cache = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      const match = await expression({ expression: value });

      if (match?.processor === 'g' || match?.processor === 'gtext' || match?.processor === 'gbinary') {
        if (match.statement.startsWith('file://') && isValidFileURL(match.statement)) {
          const { baseUrl, pathSegments } = parseUrlWithFragment(match.statement);
          const filePath = baseUrl.replace('file://', '');
          const absoluteFilePath = path.resolve(cwd, filePath);

          if (match.processor === 'gtext') {
            const cacheKey = `gtext:file:${absoluteFilePath}`;
            let fileContent;
            if (cache.has(cacheKey)) {
              fileContent = cache.get(cacheKey);
            } else {
              fileContent = fs.readFileSync(absoluteFilePath, 'utf-8');
              cache.set(cacheKey, fileContent);
            }
            obj[key] = fileContent;
          }
          else if (match.processor === 'gbinary') {
            const cacheKey = `gbinary:file:${absoluteFilePath}`;
            let fileContent;
            if (cache.has(cacheKey)) {
              fileContent = cache.get(cacheKey);
            } else {
              fileContent = fs.readFileSync(absoluteFilePath);
              cache.set(cacheKey, fileContent);
            }
            obj[key] = fileContent;
          }
          else {
            const fileContentResult = await readFileContent(filePath, cwd, tags, cache);
            if (fileContentResult) {
              const { parsed: fileContentObj, resolvedDir } = fileContentResult;

              // Apply path extraction if fragment is provided
              if (pathSegments && pathSegments.length > 0) {
                obj[key] = extractFragmentValue(fileContentObj, pathSegments);
              } else {
                obj[key] = fileContentObj;
                await applySetter(obj[key], tags);
                await applyGetter(obj[key], [], obj[key], resolvedDir, tags, cache);
              }
            }
          }
        }
        else if ((match.statement.startsWith('http:') || match.statement.startsWith('https:')) && isValidHttpURL(match.statement)) {
          const { baseUrl, pathSegments } = parseUrlWithFragment(match.statement);

          if (match.processor === 'gtext') {
            const cacheKey = `gtext:http:${baseUrl}`;
            let fileContent;
            if (cache.has(cacheKey)) {
              fileContent = cache.get(cacheKey);
            } else {
              const response = await fetch(baseUrl);
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              fileContent = await response.text();
              cache.set(cacheKey, fileContent);
            }
            obj[key] = fileContent;
          }
          else if (match.processor === 'gbinary') {
            const cacheKey = `gbinary:http:${baseUrl}`;
            let buffer;
            if (cache.has(cacheKey)) {
              buffer = cache.get(cacheKey);
            } else {
              const response = await fetch(baseUrl);
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              buffer = Buffer.from(await response.arrayBuffer());
              cache.set(cacheKey, buffer);
            }
            obj[key] = buffer;
          }
          else {
            const httpContentResult = await fetchHttpContent(baseUrl, cwd, tags, cache);
            if (httpContentResult) {
              const { parsed: httpContentObj } = httpContentResult;

              // Apply path extraction if fragment is provided
              if (pathSegments && pathSegments.length > 0) {
                obj[key] = extractFragmentValue(httpContentObj, pathSegments);
              } else {
                obj[key] = httpContentObj;
                await applySetter(obj[key], tags);
                await applyGetter(obj[key], [], obj[key], cwd, tags, cache);
              }
            }
          }
        }
        else if (match.statement.startsWith('npm:')) {
          const { baseUrl: baseNpmUrl, pathSegments } = parseUrlWithFragment(match.statement);
          const unpkgUrl = getUnpkgUrl(baseNpmUrl);
          if (unpkgUrl && isValidHttpURL(unpkgUrl)) {
            if (match.processor === 'gtext') {
              const cacheKey = `gtext:http:${unpkgUrl}`;
              let fileContent;
              if (cache.has(cacheKey)) {
                fileContent = cache.get(cacheKey);
              } else {
                const response = await fetch(unpkgUrl);
                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
                }
                fileContent = await response.text();
                cache.set(cacheKey, fileContent);
              }
              obj[key] = fileContent;
            }
            else if (match.processor === 'gbinary') {
              const cacheKey = `gbinary:http:${unpkgUrl}`;
              let buffer;
              if (cache.has(cacheKey)) {
                buffer = cache.get(cacheKey);
              } else {
                const response = await fetch(unpkgUrl);
                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
                }
                buffer = Buffer.from(await response.arrayBuffer());
                cache.set(cacheKey, buffer);
              }
              obj[key] = buffer;
            }
            else {
              const httpContentResult = await fetchHttpContent(unpkgUrl, cwd, tags, cache);
              if (httpContentResult) {
                const { parsed: httpContentObj } = httpContentResult;

                // Apply path extraction if fragment is provided
                if (pathSegments && pathSegments.length > 0) {
                  obj[key] = extractFragmentValue(httpContentObj, pathSegments);
                } else {
                  obj[key] = httpContentObj;
                  await applySetter(obj[key], tags);
                  await applyGetter(obj[key], [], obj[key], cwd, tags, cache);
                }
              }
            }
          }
        }
        else {
          let paths;
          if (relativePathPattern.test(match.statement)) {
            const relativeSegments = match.statement.split('/');
            paths = getRealPath(currentPath, relativeSegments);
          } else {
            paths = match.statement.split('.').flatMap((segment) => {
              // Handle "key[index]" notation e.g. "users[0]" → ['users', 0]
              const parts = [];
              const keyMatch = segment.match(/^([^\[]*)((?:\[\d+\])*)$/);
              if (keyMatch) {
                if (keyMatch[1]) parts.push(keyMatch[1]);
                const indices = keyMatch[2].match(/\[(\d+)\]/g) || [];
                indices.forEach(idx => parts.push(parseInt(idx.slice(1, -1), 10)));
              } else {
                parts.push(segment);
              }
              return parts.length ? parts : [segment];
            });
          }

          const expandedPaths = paths.reduce((acc, cur) => {
            if (typeof cur === 'number') {
              acc.push(cur);
              return acc;
            }
            cur.toString().split('.').flatMap((segment) => {
              const keyMatch = segment.match(/^([^\[]*)((?:\[\d+\])*)$/);
              if (keyMatch) {
                if (keyMatch[1]) acc.push(keyMatch[1]);
                const indices = keyMatch[2].match(/\[(\d+)\]/g) || [];
                indices.forEach(idx => acc.push(parseInt(idx.slice(1, -1), 10)));
              } else {
                acc.push(segment);
              }
            });
            return acc;
          }, []);

          const valueFromPath = getValue(root, expandedPaths);
          if (valueFromPath !== undefined) {
            obj[key] = valueFromPath;
          }
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      await applyGetter(value, currentPath.concat([key]), root, cwd, tags, cache);
    }
  }
}

// Check whether a value is a plain object (not array, Date, Buffer, etc.)
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !(Buffer.isBuffer(v));
}

// Deep merge `source` into `target`. Primitives and arrays are replaced.
function deepMerge(target, source) {
  if (isPlainObject(target) && isPlainObject(source)) {
    for (const key of Object.keys(source)) {
      if (isPlainObject(source[key])) {
        if (!isPlainObject(target[key])) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }
  // For primitives and arrays: source wins
  return source;
}

// Resolve a setter-like path string into an array of segments (supports bracket notation)
function resolvePathSegments(pathStr) {
  return pathStr.split('.').flatMap((segment) => {
    const parts = [];
    const keyMatch = segment.match(/^([^\[]*)((?:\[\d+\])*)$/);
    if (keyMatch) {
      if (keyMatch[1]) parts.push(keyMatch[1]);
      const indices = keyMatch[2].match(/\[(\d+)\]/g) || [];
      indices.forEach(idx => parts.push(parseInt(idx.slice(1, -1), 10)));
    } else {
      parts.push(segment);
    }
    return parts.length ? parts : [segment];
  });
}

function getOrCreatePathParent(root, path) {
  let current = root;

  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    const nextSegment = path[i + 1];

    if (current[segment] === undefined || current[segment] === null || typeof current[segment] !== 'object') {
      current[segment] = typeof nextSegment === 'number' ? [] : {};
    }

    current = current[segment];
  }

  return { parent: current, key: path[path.length - 1] };
}

function normalizeStackSources(value) {
  return Array.isArray(value) ? value : [value];
}

function assignMergedValue(obj, pathStr, merged) {
  if (pathStr === '' || pathStr === '/') {
    if (isPlainObject(merged)) {
      deepMerge(obj, merged);
    }
    return;
  }

  const path = resolvePathSegments(pathStr);
  const { parent, key } = getOrCreatePathParent(obj, path);

  if (isPlainObject(merged) && isPlainObject(parent[key])) {
    deepMerge(parent[key], merged);
  } else {
    parent[key] = merged;
  }
}

function assignPushedValues(obj, pathStr, items) {
  if (pathStr === '' || pathStr === '/') {
    if (Array.isArray(obj)) {
      obj.push(...items);
    }
    return;
  }

  const path = resolvePathSegments(pathStr);
  const { parent, key } = getOrCreatePathParent(obj, path);

  if (!Array.isArray(parent[key])) {
    parent[key] = [];
  }

  parent[key].push(...items);
}

// Process merge:: expressions in the object tree.
// Merge runs *after* getters, so values may contain resolved objects/arrays.
async function applyMerge(obj) {
  const mergeKeys = [];
  for (const key of Object.keys(obj)) {
    if (key.startsWith(MERGE_PREFIX)) {
      mergeKeys.push(key);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      await applyMerge(obj[key]);
    }
  }

  for (const key of mergeKeys) {
    const pathStr = key.slice(MERGE_PREFIX.length);
    const value = obj[key];
    delete obj[key];

    const sources = normalizeStackSources(value);
    let merged;

    for (const src of sources) {
      if (merged === undefined) {
        if (isPlainObject(src)) {
          merged = { ...src };
        } else {
          merged = src;
        }
        continue;
      }

      if (isPlainObject(merged) && isPlainObject(src)) {
          deepMerge(merged, src);
      } else {
        merged = src;
      }
    }

    if (merged !== undefined) {
      assignMergedValue(obj, pathStr, merged);
    }
  }
}

// Process push:: expressions in the object tree.
// Push runs after getters and merges, so values may contain resolved arrays/objects.
async function applyPush(obj) {
  const pushKeys = [];
  for (const key of Object.keys(obj)) {
    if (key.startsWith(PUSH_PREFIX)) {
      pushKeys.push(key);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      await applyPush(obj[key]);
    }
  }

  for (const key of pushKeys) {
    const pathStr = key.slice(PUSH_PREFIX.length);
    const value = obj[key];
    delete obj[key];

    const items = normalizeStackSources(value).flatMap((entry) => Array.isArray(entry) ? entry : [entry]);
    assignPushedValues(obj, pathStr, items);
  }
}

/**
 * @typedef {Object} Input
 * @property {string} [content] - The YAML content to be processed
 * @property {string} [file] - The path to the YAML file to be processed
 * @property {string[]} [tags=[]] - Array of tags to filter content by (e.g., ['dev', 'prod'])
 * @property {string} [cwd=process.cwd()] - Current working directory for resolving relative paths
 */

/**
 * @typedef {Object} Output
 * @property {string} raw - Original unprocessed YAML content
 * @property {string} content - Processed YAML content as string
 * @property {Object} parsed - Processed YAML content as JavaScript object
 */

/**
 * Processes the provided YAML content or file with optional tag filtering.
 * @param {Input} args - The configuration object
 * @param {Object} [context] - Additional context object (currently unused)
 * @param {Map} [cache] - Internal session cache for deduplicating URL fetches (passed recursively)
 * @returns {Promise<Output>} Processed YAML result
 * @throws {Error} When neither content nor file is provided
 * @throws {Error} When specified file doesn't exist
 */
async function fnetYaml({ content, file, tags = [], cwd = process.cwd() }, context, cache) {
  // Create a new session cache for the root call; recursive calls reuse the same cache
  if (!cache) cache = new Map();
  let parsed;

  // If file parameter is provided, read the file content
  if (file) {
    const absolutePath = path.resolve(cwd, file);
    if (fs.existsSync(absolutePath)) {
      content = fs.readFileSync(absolutePath, 'utf-8');
      cwd = path.dirname(absolutePath); // Update cwd to the directory of the file
    } else {
      throw new Error(`File ${file} does not exist.`);
    }
  }

  // Ensure that we have content to work on
  if (!content) {
    throw new Error("No content provided or file could not be read.");
  }

  parsed = parse(content);

  await applySetter(parsed, tags); // s:: processor with 't' tag support
  await applyGetter(parsed, [], parsed, cwd, tags, cache); // g:: processor
  await applyMerge(parsed); // merge:: processor (runs after getters)
  await applyPush(parsed); // push:: processor (runs after merges)

  return {
    raw: content,
    content: stringify(parsed),
    parsed,
  };
};

export default fnetYaml;
