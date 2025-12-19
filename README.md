# quickslice-elements

Custom web components for the AT Protocol ecosystem.

## Components

### `<qs-actor-autocomplete>`

Autocomplete input for searching Bluesky actors by handle.

```html
<qs-actor-autocomplete
  placeholder="Search users..."
  name="actor"
  required
></qs-actor-autocomplete>
```

**Attributes:** `placeholder`, `debounce`, `limit`, `name`, `required`, `disabled`, `value`

**Events:** `input`, `change`, `qs-select`

### `<qs-tangled-stars>`

Inline badge showing star count for a Tangled repository.

```html
<qs-tangled-stars handle="slices.network" repo="quickslice" instance="https://your-quickslice-instance.com"></qs-tangled-stars>
```

**Attributes:** `handle`, `repo`, `instance` (required)

## Usage

```html
<script src="https://cdn.jsdelivr.net/gh/bigmoves/elements@v0.1.0/dist/elements.min.js"></script>
```

## License

Apache 2.0
