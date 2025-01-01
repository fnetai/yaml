import * as yaml from 'yaml';
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
// g::http://example.com/person.yaml (fetch the file and merge the content)
// g::npm:@fnet/webauth@^0.1/fnet/input.yaml (fetch the file from npm and merge the content)

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

async function fetchHttpContent(httpURL) {
  try {
    const response = await fetch(httpURL);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();

    try {
      const parsed = yaml.parse(text);
      return { parsed };
    } catch (parseError) {
      console.error(`Error parsing YAML from ${httpURL}:`, parseError?.message);
    }
  } catch (networkError) {
    console.error(`Error fetching content from ${httpURL}:`, networkError?.message);
  }
}

// Read the file content based on the filePath and current working directory (cwd)
function readFileContent(filePath, cwd) {
  const absolutePath = path.resolve(cwd, filePath);
  if (fs.existsSync(absolutePath)) {
    const fileContent = fs.readFileSync(absolutePath, 'utf-8');
    try {
      const parsed = yaml.parse(fileContent);
      return {
        parsed,
        resolvedPath: absolutePath,
        resolvedDir: path.dirname(absolutePath),
      };
    } catch (parseError) {
      console.error(`Error parsing YAML from file ${absolutePath}:`, parseError);
    }
  }
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
        obj[tag.statement] = value; // Apply the setter        
      }
    } else if (match && match.processor === 's') {
      const path = match.statement.split('.').map((segment) => {
        const arrayIndexMatch = segment.match(/^\[(\d+)\]$/);
        if (arrayIndexMatch) {
          return parseInt(arrayIndexMatch[1], 10);
        }
        return segment;
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
              currentObj[path[i]] = Array.isArray(path[i + 1]) ? [] : {};
            }
            currentObj = currentObj[path[i]];
          } else {
            if (!currentObj[path[i]]) {
              currentObj[path[i]] = Array.isArray(path[i + 1]) ? [] : {};
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
async function applyGetter(obj, currentPath = [], root = obj, cwd = process.cwd(), tags = []) {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      const match = await expression({ expression: value });

      if (match && match.processor === 'g') {
        if (match.statement.startsWith('file://') && isValidFileURL(match.statement)) {
          const filePath = match.statement.replace('file://', '');
          const fileContentResult = readFileContent(filePath, cwd);

          if (fileContentResult) {
            const { parsed: fileContentObj, resolvedDir } = fileContentResult;
            obj[key] = fileContentObj;
            await applySetter(obj[key], tags);
            await applyGetter(obj[key], [], obj[key], resolvedDir, tags);
          }
        } else if ((match.statement.startsWith('http:') || match.statement.startsWith('https:')) && isValidHttpURL(match.statement)) {
          const httpContentResult = await fetchHttpContent(match.statement);
          if (httpContentResult) {
            const { parsed: httpContentObj } = httpContentResult;
            obj[key] = httpContentObj;
            await applySetter(obj[key], tags);
            await applyGetter(obj[key], [], obj[key], cwd, tags);
          }
        }
        else if (match.statement.startsWith('npm:')) {
          const unpkgUrl = getUnpkgUrl(match.statement);
          if (unpkgUrl && isValidHttpURL(unpkgUrl)) {
            const httpContentResult = await fetchHttpContent(unpkgUrl);
            if (httpContentResult) {
              const { parsed: httpContentObj } = httpContentResult;
              obj[key] = httpContentObj;
              await applySetter(obj[key], tags);
              await applyGetter(obj[key], [], obj[key], cwd, tags);
            }
          }
        }
        else {
          let paths;
          if (relativePathPattern.test(match.statement)) {
            const relativeSegments = match.statement.split('/');
            paths = getRealPath(currentPath, relativeSegments);
          } else {
            paths = match.statement.split('.').map((segment) => {
              const arrayIndexMatch = segment.match(/^\[(\d+)\]$/);
              if (arrayIndexMatch) {
                return parseInt(arrayIndexMatch[1], 10);
              }
              return segment;
            });
          }

          const expandedPaths = paths.reduce((acc, cur) => {
            cur.split('.').forEach((segment) => {
              const arrayIndexMatch = segment.match(/^\[(\d+)\]$/);
              if (arrayIndexMatch) {
                acc.push(parseInt(arrayIndexMatch[1], 10));
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
      await applyGetter(value, currentPath.concat([key]), root, cwd, tags);
    }
  }
}

/**
 * Processes the provided YAML content or file with optional tag filtering.
 * @param {Object} args
 * @param {string} [args.content] - The YAML content to be processed.
 * @param {string} [args.file] - The path to the YAML file to be processed.
 * @param {Array<string>} [args.tags] - Optional array of tags to filter by.
 * @returns {Object} - Processed YAML content and its parsed representation.
 */
export default async ({ content, file, tags = [], cwd = process.cwd() }, context) => {
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

  parsed = yaml.parse(content);

  await applySetter(parsed, tags); // s:: processor with 't' tag support
  await applyGetter(parsed, [], parsed, cwd, tags); // g:: processor

  return {
    raw: content,
    content: yaml.stringify(parsed),
    parsed,
  };
};