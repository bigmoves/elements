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
<qs-tangled-stars handle="slices.network" repo="quickslice"></qs-tangled-stars>
```

**Attributes:** `handle`, `repo`, `instance`

## Installation

```bash
npm install quickslice-elements
```

## Usage

```html
<!-- From npm -->
<script type="module" src="quickslice-elements/dist/elements.min.js"></script>

<!-- From CDN -->
<script type="module" src="https://cdn.jsdelivr.net/npm/quickslice-elements@0.1.0/dist/elements.min.js"></script>
```

## Development

```bash
npm install
npm run dev      # Start dev server
npm run build    # Build for production
```

## License

ISC
