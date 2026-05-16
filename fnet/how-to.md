# Developer Guide for `@fnet/yaml`

## Overview

`@fnet/yaml` is a YAML processor for Flownet-style configuration files.
It extends plain YAML with expression-based processors that let you:

- set values dynamically with `s::`
- read values locally or from external sources with `g::`
- read raw text with `gtext::`
- read binary content with `gbinary::`
- conditionally include sections with `t::`
- deep-merge object stacks with `merge::`
- append array stacks with `push::`

It supports `file://`, `http://`, `https://`, and `npm:` sources.

## Installation

```bash
npm install @fnet/yaml
```

or

```bash
yarn add @fnet/yaml
```

## Function Signature

```ts
type Input = {
  content?: string;
  file?: string;
  tags?: string[];
  cwd?: string;
};

type Output = {
  raw: string;
  content: string;
  parsed: object;
};
```

## Basic Usage

```js
import yamlProcessor from '@fnet/yaml';

const inputYaml = `
s::app.name: demo
t::prod::s::app.debug: false
t::dev::s::app.debug: true
config: g::file://./config.yaml#/app
`;

const result = await yamlProcessor({
  content: inputYaml,
  tags: ['prod'],
});

console.log(result.parsed);
```

## Processing Order

Expressions are processed in this order:

1. `s::` and `t::`
2. `g::`, `gtext::`, `gbinary::`
3. `merge::`
4. `push::`

This matters because `merge::` and `push::` can work with values already resolved by getters.

## Supported Processors

### `s::` — Setter

Setters write values into object paths using dot and bracket notation.

```yaml
s::person.name: John Doe
s::person.age: 30
s::users[0].role: Developer
s::users[1].role: Designer
```

Result:

```yaml
person:
  name: John Doe
  age: 30
users:
  - role: Developer
  - role: Designer
```

### `g::` — Getter

Getters can read:

- local values from the current parsed object
- local files via `file://`
- remote content via `http://` and `https://`
- package files via `npm:`

#### Local getters

```yaml
s::app.name: demo
s::app.version: 1.0.0

name: g::app.name
version: g::app.version
```

Relative and root-style paths are also supported:

```yaml
s::city: Istanbul

user:
  profile:
    city: g::../city

rootCity: g::/city
```

#### File / HTTP / npm getters

```yaml
fileConfig: g::file://./config.yaml
remoteConfig: g::https://example.com/config.yaml
pkgConfig: g::npm:@fnet/webauth@^0.1/fnet/input.yaml
```

### `gtext::` — Raw text getter

Returns the raw text payload without YAML parsing.

```yaml
readme: gtext::file://./README.md
remoteText: gtext::https://example.com/message.txt
```

### `gbinary::` — Binary getter

Returns a Node.js `Buffer`.

```yaml
logo: gbinary::file://./assets/logo.png
archive: gbinary::https://example.com/archive.zip
```

## URL Fragments

Structured getters (`g::`) support fragment extraction with `#`.

Supported styles:

- slash style: `#/people/0/name`
- bracket style: `#/people[0]/name`
- wildcard value spread: `#/*` or `#/permissions/*`
- brace expansion: `#/{create,list,get}` or `#/permissions/{create,update}`
- child-key glob matching: `#/comment_*` or `#/permissions/comment_*`

Examples:

```yaml
dbHost: g::file://./config.yaml#/database/host
firstUser: g::https://example.com/users.yaml#/people/0
firstUserName: g::file://./users.yaml#/people[0]/name
permissionValues: g::file://./permissions.yaml#/*
selectedPermissions: g::file://./permissions.yaml#/{create,list,get}
commentPermissions: g::file://./permissions.yaml#/comment_*
pkgValue: g::npm:@scope/pkg@1.0.0/config.yaml#/app/theme
```

Wildcard fragments return all values from an object target. This is useful when a
dictionary-style YAML file should become an array of values.

```yaml
# permissions.yaml
create: { name: financing.create }
update: { name: financing.update }

# rbac.yaml
push::permissions:
  - g::file://./permissions.yaml#/*
```

Brace expansion returns selected child values in the order listed.

```yaml
# permissions.yaml
create: { name: ticket.create }
list: { name: ticket.list }
get: { name: ticket.get }
update: { name: ticket.update }

# rbac.yaml
push::permissions:
  - g::file://./permissions.yaml#/{create,list,get,update}
```

Glob fragments match immediate child keys and return matching values in source key
order. `*` matches any sequence of characters within one path segment.

```yaml
# permissions.yaml
comment_create: { name: ticket.comment.create }
comment_list: { name: ticket.comment.list }
comment_get: { name: ticket.comment.get }

# rbac.yaml
push::permissions:
  - g::file://./permissions.yaml#/comment_*
```

Both forms also work below a nested object, for example
`#/ticket/{create,update}` and `#/ticket/comment_*`.

## `t::` — Tag filtering

Tags let you conditionally keep or discard YAML entries.

```yaml
t::dev::s::database.host: localhost
t::prod::s::database.host: prod-db.example.com
```

With `tags: ['dev']`, only the `dev` entry is applied.

Nested tags are supported:

```yaml
t::prod::t::local::s::logging.level: debug
```

This entry is applied only when both `prod` and `local` are active.

## `merge::` — Deep object composition

`merge::` is used for object stack composition.

- objects are merged recursively
- later items override earlier items
- arrays are replaced, not concatenated
- use `push::` when you want array append behavior

```yaml
merge::app:
  - name: base-app
    database:
      host: localhost
      port: 5432
    features:
      auth: false
      billing: false
  - database:
      host: prod-db
  - features:
      auth: true
```

Result:

```yaml
app:
  name: base-app
  database:
    host: prod-db
    port: 5432
  features:
    auth: true
    billing: false
```

### Root merge

Use `merge::/` to merge into the document root.

```yaml
merge::/:
  - app:
      name: demo
  - database:
      host: localhost
      port: 5432
```

### Merge with getters

```yaml
merge::app:
  - g::file://./base.yaml#/app
  - g::file://./prod.yaml#/app
  - debug: true
```

### Merge with tags

Base and tagged merge stacks can be combined:

```yaml
merge::app:
  - name: base-app
    env: base

t::dev::merge::app:
  - env: development
    debug: true

t::prod::merge::app:
  - env: production
    debug: false
```

## `push::` — Array composition

`push::` appends items into an array path.

- scalar values are appended as items
- objects are appended as items
- arrays are flattened one level and appended item-by-item

```yaml
push::app.plugins:
  - auth
  - billing
  -
    - monitoring
    - tracing
```

Result:

```yaml
app:
  plugins:
    - auth
    - billing
    - monitoring
    - tracing
```

### Push with getters

```yaml
push::team.members:
  - g::file://./people.yaml#/members
  - name: Dana
    role: Analyst
```

Dictionary-style files can be appended with wildcard fragments:

```yaml
push::permissions:
  - g::file://./permissions/financing.yaml#/*
  - g::file://./permissions/invoicing.yaml#/*
```

### Push with tags

```yaml
push::app.plugins:
  - core
  - auth

t::dev::push::app.plugins:
  - devtools
  - mock-api

t::prod::push::app.plugins:
  - sentry
```

## Combined Example

```yaml
s::defaults.region: eu-west-1

merge::app:
  - g::file://./base.yaml#/app
  - g::file://./env/prod.yaml#/app
  - region: g::defaults.region

push::app.plugins:
  - g::file://./base.yaml#/plugins
  - monitoring
  - tracing

t::prod::s::app.debug: false
t::dev::s::app.debug: true
```

## Supported Source Protocols

| Protocol | Structured `g::` | `gtext::` | `gbinary::` |
| --- | ---: | ---: | ---: |
| local object path | yes | no | no |
| `file://` | yes | yes | yes |
| `http://` / `https://` | yes | yes | yes |
| `npm:` | yes | yes | yes |

Notes:

- fragment extraction applies to structured `g::` getters
- `npm:` sources are resolved through `unpkg.com`

## Session Cache

Within a single root parse session, repeated `file://`, `http://`, `https://`, and `npm:` reads are cached.

That means if the same source is used multiple times, including with different fragments, the library avoids redundant reads/fetches and reuses the already resolved content.

## Error Handling

The processor throws or surfaces errors in cases such as:

- missing `content` and `file`
- non-existent local file paths
- invalid YAML input
- network failures for remote sources

Fragment lookups that do not resolve return `null` for structured remote/file getter extraction.

## Best Practices

- use `merge::` for object configuration layers
- use `push::` for array composition
- use fragments to fetch only the part you need
- use tags for environment overlays
- prefer `gtext::` only when you need raw text
- prefer `gbinary::` only when you need a `Buffer`

## Acknowledgement

`@fnet/yaml` is built on top of the `yaml` package and Flownet expression-processing conventions.
