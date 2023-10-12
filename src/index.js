import yaml from 'js-yaml';
import expression from '@fnet/expression';
import getValue from 'get-value';

import fs from 'fs';
import path from 'path';
import { URL } from 'url';

import axios from 'axios';

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

async function fetchHttpContent(httpURL) {
    try {
        const response = await axios.get(httpURL);

        try {
            const parsed = yaml.load(response.data);
            return {
                parsed,
            }
        } catch (parseError) {
            console.error(`Error parsing YAML from ${httpURL}:`, parseError);
        }

    } catch (networkError) {
        console.error(`Error fetching content from ${httpURL}:`, networkError);
    }
}

// Read the file content based on the filePath and current working directory (cwd)
function readFileContent(filePath, cwd) {
    const absolutePath = path.resolve(cwd, filePath);
    if (fs.existsSync(absolutePath)) {
        const fileContent = fs.readFileSync(absolutePath, 'utf-8');
        try {
            const parsed = yaml.load(fileContent);
            return {
                parsed,
                resolvedPath: absolutePath,
                resolvedDir: path.dirname(absolutePath)
            }
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
        }
        else if (segment === ".") {
            // Do nothing
        }
        else {
            realPath.push(segment);
        }
    }

    return realPath;
}

// Process and apply setters in the given object
async function applySetter(obj) {
    for (const [key, value] of Object.entries(obj)) {
        const match = await expression({ expression: key });

        if (match && match.processor === 's') {
            const path = match.statement.split('.').map(segment => {
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
                            currentObj[path[i]] = (typeof path[i + 1] === "number") ? [] : {};
                        }
                        currentObj = currentObj[path[i]];
                    } else {
                        if (!currentObj[path[i]]) {
                            currentObj[path[i]] = (typeof path[i + 1] === "number") ? [] : {};
                        }
                        currentObj = currentObj[path[i]];
                    }
                }
            }

            delete obj[key];
        } else if (typeof value === 'object' && value !== null) {
            await applySetter(value);
        }
    }
}

// Process and apply getters in the given object
async function applyGetter(obj, currentPath = [], root = obj, cwd = process.cwd()) {
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
                        await applySetter(obj[key]);
                        await applyGetter(obj[key], [], obj[key], resolvedDir);
                    }
                }
                else if (match.statement.startsWith('http') && isValidHttpURL(match.statement)) {
                    const httpContentResult = await fetchHttpContent(match.statement);
                    if (httpContentResult) {
                        const { parsed: httpContentObj } = httpContentResult;

                        obj[key] = httpContentObj;
                        await applySetter(obj[key]);
                        await applyGetter(obj[key], [], obj[key]);
                    }
                }
                else {
                    let paths;

                    if (relativePathPattern.test(match.statement)) {
                        const relativeSegments = match.statement.split('/');
                        paths = getRealPath(currentPath, relativeSegments);
                    } else {
                        paths = match.statement.split('.').map(segment => {
                            const arrayIndexMatch = segment.match(/^\[(\d+)\]$/);
                            if (arrayIndexMatch) {
                                return parseInt(arrayIndexMatch[1], 10);
                            }
                            return segment;
                        });
                    }

                    const expandedPaths = paths.reduce((acc, cur) => {
                        cur.split('.').forEach(segment => {
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
            await applyGetter(value, currentPath.concat([key]), root, cwd);
        }
    }
}

// Main exported function that processes the YAML content
export default async ({ content }) => {
    const parsed = yaml.load(content);
    await applySetter(parsed); // s:: processor
    await applyGetter(parsed); // g:: processor
    return {
        content: yaml.dump(parsed),
        parsed
    }
};