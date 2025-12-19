/**
 * <qs-actor-autocomplete> - AT Protocol actor autocomplete input
 *
 * Attributes:
 *   - placeholder: Input placeholder text
 *   - debounce: Debounce delay in ms (default: 200)
 *   - limit: Max suggestions to show (default: 5)
 *   - name: Form field name
 *   - required: Whether the field is required
 *   - disabled: Whether the field is disabled
 *   - value: Current value
 *
 * Events:
 *   - input: Fires when value changes
 *   - change: Fires when a selection is made
 *   - qs-select: Fires with full actor data on selection
 *
 * Form integration:
 *   - Works with <form> elements
 *   - Submits handle value
 *   - Supports validation
 */

const styles = `
  :host {
    --qs-input-bg: transparent;
    --qs-input-border: #ccc;
    --qs-input-border-focus: #0085ff;
    --qs-input-text: inherit;
    --qs-input-placeholder: #999;
    --qs-menu-bg: #fff;
    --qs-menu-border: #ddd;
    --qs-menu-shadow: rgba(0, 0, 0, 0.15);
    --qs-item-hover: #f3f4f6;
    --qs-avatar-bg: #e5e7eb;
    --qs-handle-color: #111;
    --qs-name-color: #666;
    --qs-radius: 0.375rem;
    --qs-input-padding: 0.5rem 0.75rem;

    display: block;
    position: relative;
    font-family: inherit;
  }

  input {
    width: 100%;
    box-sizing: border-box;
    padding: var(--qs-input-padding);
    font-size: 1rem;
    font-family: inherit;
    border: 1px solid var(--qs-input-border);
    border-radius: var(--qs-radius);
    background: var(--qs-input-bg);
    color: var(--qs-input-text);
  }

  input::placeholder {
    color: var(--qs-input-placeholder);
  }

  input:focus {
    outline: none;
    border-color: var(--qs-input-border-focus);
  }

  input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--qs-menu-bg);
    border: 1px solid var(--qs-menu-border);
    border-radius: calc(var(--qs-radius) + 2px);
    box-shadow: 0 4px 12px var(--qs-menu-shadow);
    max-height: 240px;
    overflow-y: auto;
    z-index: 100;
    list-style: none;
    padding: 4px;
    margin: 4px 0 0 0;
  }

  .menu:empty {
    display: none;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: var(--qs-radius);
    cursor: pointer;
  }

  .item:hover,
  .item.active {
    background: var(--qs-item-hover);
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--qs-avatar-bg);
    flex-shrink: 0;
    overflow: hidden;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .handle {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--qs-handle-color);
  }

  .display-name {
    font-size: 0.875rem;
    color: var(--qs-name-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .info {
    min-width: 0;
    flex: 1;
  }
`;

class BskyHandleInput extends HTMLElement {
  static formAssociated = true;

  static get observedAttributes() {
    return [
      "placeholder",
      "debounce",
      "limit",
      "disabled",
      "required",
      "value",
    ];
  }

  #internals;
  #input;
  #menu;
  #suggestions = [];
  #activeIndex = -1;
  #debounceTimer = null;
  #selectedActor = null;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.#render();
    this.#input = this.shadowRoot.querySelector("input");
    this.#menu = this.shadowRoot.querySelector(".menu");

    this.#input.addEventListener("input", this.#onInput);
    this.#input.addEventListener("keydown", this.#onKeydown);
    this.#input.addEventListener("focusout", this.#onFocusout);

    // Sync initial value
    if (this.hasAttribute("value")) {
      this.#input.value = this.getAttribute("value");
      this.#updateFormValue();
    }
  }

  disconnectedCallback() {
    clearTimeout(this.#debounceTimer);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.#input) return;

    switch (name) {
      case "placeholder":
        this.#input.placeholder = newValue || "";
        break;
      case "disabled":
        this.#input.disabled = newValue !== null;
        break;
      case "required":
        this.#input.required = newValue !== null;
        this.#updateValidity();
        break;
      case "value":
        if (this.#input.value !== newValue) {
          this.#input.value = newValue || "";
          this.#updateFormValue();
        }
        break;
    }
  }

  // Form-associated custom element methods
  get form() {
    return this.#internals.form;
  }

  get name() {
    return this.getAttribute("name");
  }

  get type() {
    return this.localName;
  }

  get value() {
    return this.#input?.value || "";
  }

  set value(v) {
    if (this.#input) {
      this.#input.value = v;
      this.#updateFormValue();
    }
  }

  get validity() {
    return this.#internals.validity;
  }

  get validationMessage() {
    return this.#internals.validationMessage;
  }

  get willValidate() {
    return this.#internals.willValidate;
  }

  checkValidity() {
    return this.#internals.checkValidity();
  }

  reportValidity() {
    return this.#internals.reportValidity();
  }

  // Selected actor data
  get actor() {
    return this.#selectedActor;
  }

  #render() {
    const placeholder =
      this.getAttribute("placeholder") || "handle.bsky.social";
    const disabled = this.hasAttribute("disabled");
    const required = this.hasAttribute("required");

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <input
        type="text"
        placeholder="${placeholder}"
        autocomplete="off"
        ${disabled ? "disabled" : ""}
        ${required ? "required" : ""}
      >
      <ul class="menu" role="listbox"></ul>
    `;
  }

  #onInput = async (e) => {
    const query = e.target.value.trim();
    this.#selectedActor = null;
    this.#updateFormValue();

    this.dispatchEvent(new Event("input", { bubbles: true }));

    clearTimeout(this.#debounceTimer);

    if (!query || query.length < 2) {
      this.#clearSuggestions();
      return;
    }

    const debounce = parseInt(this.getAttribute("debounce")) || 200;
    this.#debounceTimer = setTimeout(() => this.#search(query), debounce);
  };

  #onKeydown = (e) => {
    if (this.#suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.#activeIndex = Math.min(
          this.#activeIndex + 1,
          this.#suggestions.length - 1,
        );
        this.#renderSuggestions();
        break;

      case "ArrowUp":
        e.preventDefault();
        this.#activeIndex = Math.max(this.#activeIndex - 1, 0);
        this.#renderSuggestions();
        break;

      case "Enter":
        if (this.#activeIndex >= 0) {
          e.preventDefault();
          this.#select(this.#activeIndex);
        }
        break;

      case "Escape":
        e.preventDefault();
        this.#clearSuggestions();
        break;
    }
  };

  #onFocusout = () => {
    // Delay to allow click on suggestion
    setTimeout(() => this.#clearSuggestions(), 150);
  };

  async #search(query) {
    try {
      const limit = parseInt(this.getAttribute("limit")) || 5;
      const url = new URL(
        "https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead",
      );
      url.searchParams.set("q", query);
      url.searchParams.set("limit", String(limit));

      const res = await fetch(url);
      if (!res.ok) return;

      const json = await res.json();
      this.#suggestions = json.actors || [];
      this.#activeIndex = -1;
      this.#renderSuggestions();
    } catch (err) {
      console.error("Bluesky handle search failed:", err);
    }
  }

  #renderSuggestions() {
    if (this.#suggestions.length === 0) {
      this.#menu.innerHTML = "";
      return;
    }

    this.#menu.innerHTML = this.#suggestions
      .map(
        (actor, i) => `
        <li class="item ${i === this.#activeIndex ? "active" : ""}"
            role="option"
            data-index="${i}">
          <div class="avatar">
            ${actor.avatar ? `<img src="${this.#esc(actor.avatar)}" alt="">` : ""}
          </div>
          <div class="info">
            <div class="handle">@${this.#esc(actor.handle)}</div>
            ${actor.displayName ? `<div class="display-name">${this.#esc(actor.displayName)}</div>` : ""}
          </div>
        </li>
      `,
      )
      .join("");

    // Add click handlers
    this.#menu.querySelectorAll(".item").forEach((item) => {
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.#select(parseInt(item.dataset.index));
      });
    });
  }

  #select(index) {
    const actor = this.#suggestions[index];
    if (!actor) return;

    this.#selectedActor = actor;
    this.#input.value = actor.handle;
    this.#updateFormValue();
    this.#clearSuggestions();

    this.dispatchEvent(new Event("change", { bubbles: true }));
    this.dispatchEvent(
      new CustomEvent("qs-select", {
        bubbles: true,
        detail: { actor },
      }),
    );
  }

  #clearSuggestions() {
    this.#suggestions = [];
    this.#activeIndex = -1;
    this.#menu.innerHTML = "";
  }

  #updateFormValue() {
    const value = this.#input?.value || "";
    this.#internals.setFormValue(value);
    this.#updateValidity();
  }

  #updateValidity() {
    const value = this.#input?.value || "";
    const required = this.hasAttribute("required");

    if (required && !value) {
      this.#internals.setValidity(
        { valueMissing: true },
        "Please enter a handle",
        this.#input,
      );
    } else {
      this.#internals.setValidity({});
    }
  }

  #esc(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}

customElements.define("qs-actor-autocomplete", BskyHandleInput);

export { BskyHandleInput };
