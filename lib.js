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

/**
 * <qs-tangled-stars> - Inline badge showing Tangled repo star count
 *
 * Attributes:
 *   - handle: The repo owner's handle (e.g., "alice.bsky.social")
 *   - repo: The repository name
 *   - instance: (required) Quickslice instance URL
 *
 * Example:
 *   <qs-tangled-stars handle="slices.network" repo="quickslice" instance="https://quickslice.example.com"></qs-tangled-stars>
 */

const dollyIcon = `<svg viewBox="0 0 25 25" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="m 16.775491,24.987061 c -0.78517,-0.0064 -1.384202,-0.234614 -2.033994,-0.631295 -0.931792,-0.490188 -1.643475,-1.31368 -2.152014,-2.221647 C 11.781409,23.136647 10.701392,23.744942 9.4922931,24.0886 8.9774725,24.238111 8.0757679,24.389777 6.5811304,23.84827 4.4270703,23.124679 2.8580086,20.883331 3.0363279,18.599583 3.0037061,17.652919 3.3488675,16.723769 3.8381157,15.925061 2.5329485,15.224503 1.4686756,14.048584 1.0611184,12.606459 0.81344502,11.816973 0.82385989,10.966486 0.91519098,10.154906 1.2422711,8.2387903 2.6795811,6.5725716 4.5299585,5.9732484 5.2685364,4.290122 6.8802592,3.0349975 8.706276,2.7794663 c 1.2124148,-0.1688264 2.46744,0.084987 3.52811,0.7011837 1.545426,-1.7139736 4.237779,-2.2205077 6.293579,-1.1676231 1.568222,0.7488935 2.689625,2.3113526 2.961888,4.0151464 1.492195,0.5977882 2.749007,1.8168898 3.242225,3.3644951 0.329805,0.9581836 0.340709,2.0135956 0.127128,2.9974286 -0.381606,1.535184 -1.465322,2.842146 -2.868035,3.556463 0.0034,0.273204 0.901506,2.243045 0.751284,3.729647 -0.03281,1.858525 -1.211631,3.619894 -2.846433,4.475452 -0.953967,0.556812 -2.084452,0.546309 -3.120531,0.535398 z m -4.470079,-5.349839 c 1.322246,-0.147248 2.189053,-1.300106 2.862307,-2.338363 0.318287,-0.472954 0.561404,-1.002348 0.803,-1.505815 0.313265,0.287151 0.578698,0.828085 1.074141,0.956909 0.521892,0.162542 1.133743,0.03052 1.45325,-0.443554 0.611414,-1.140449 0.31004,-2.516537 -0.04602,-3.698347 C 18.232844,11.92927 17.945151,11.232927 17.397785,10.751793 17.514522,9.9283111 17.026575,9.0919791 16.332883,8.6609491 15.741721,9.1323278 14.842258,9.1294949 14.271975,8.6252369 13.178927,9.7400102 12.177239,9.7029996 11.209704,8.8195135 10.992255,8.6209543 10.577326,10.031484 9.1211947,9.2324497 8.2846288,9.9333947 7.6359672,10.607693 7.0611981,11.578553 6.5026891,12.62523 5.9177873,13.554793 5.867393,14.69141 c -0.024234,0.66432 0.4948601,1.360337 1.1982269,1.306329 0.702996,0.06277 1.1815208,-0.629091 1.7138087,-0.916491 0.079382,0.927141 0.1688108,1.923227 0.4821259,2.828358 0.3596254,1.171275 1.6262605,1.915695 2.8251855,1.745211 0.08481,-0.0066 0.218672,-0.01769 0.218672,-0.0176 z m 0.686342,-3.497495 c -0.643126,-0.394168 -0.33365,-1.249599 -0.359402,-1.870938 0.064,-0.749774 0.115321,-1.538054 0.452402,-2.221125 0.356724,-0.487008 1.226721,-0.299139 1.265134,0.325689 -0.02558,0.628509 -0.314101,1.25416 -0.279646,1.9057 -0.07482,0.544043 0.05418,1.155133 -0.186476,1.652391 -0.197455,0.275121 -0.599638,0.355105 -0.892012,0.208283 z m -2.808766,-0.358124 c -0.605767,-0.328664 -0.4133176,-1.155655 -0.5083256,-1.73063 0.078762,-0.66567 0.013203,-1.510085 0.5705316,-1.976886 0.545037,-0.380109 1.286917,0.270803 1.029164,0.868384 -0.274913,0.755214 -0.09475,1.580345 -0.08893,2.34609 -0.104009,0.451702 -0.587146,0.691508 -1.002445,0.493042 z" transform="translate(-0.42924038,-0.87777209)"/></svg>`;

const starsStyles = `
  :host {
    --qs-stars-label-bg: #e1e4e8;
    --qs-stars-label-text: #24292f;
    --qs-stars-count-bg: #fff;
    --qs-stars-count-text: #24292f;
    --qs-stars-border: #d1d5da;
    --qs-stars-radius: 0.375em;
    --qs-stars-font-size: 0.75em;

    display: inline-flex;
    align-items: stretch;
    font-size: inherit;
    font-family: inherit;
    line-height: 1;
    text-decoration: none;
    cursor: pointer;
    vertical-align: middle;
    border-radius: var(--qs-stars-radius);
    overflow: hidden;
    border: 1px solid var(--qs-stars-border);
  }

  :host(:hover) {
    opacity: 0.9;
  }

  .label {
    display: flex;
    align-items: center;
    gap: 0.4em;
    padding: 0.35em 0.6em;
    background: var(--qs-stars-label-bg);
    color: var(--qs-stars-label-text);
    font-size: var(--qs-stars-font-size);
    font-weight: 600;
  }

  .icon {
    width: 1.1em;
    height: 1.1em;
    flex-shrink: 0;
  }

  .icon svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .count {
    display: flex;
    align-items: center;
    padding: 0.35em 0.6em;
    background: var(--qs-stars-count-bg);
    color: var(--qs-stars-count-text);
    font-size: var(--qs-stars-font-size);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    border-left: 1px solid var(--qs-stars-border);
  }

  .loading {
    opacity: 0.5;
  }

  .error {
    opacity: 0.4;
  }
`;

class TangledStars extends HTMLElement {
  static get observedAttributes() {
    return ["handle", "repo", "instance"];
  }

  #count = null;
  #loading = true;
  #error = false;
  #debounceTimer = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.#render();
    this.#fetchStars();
    this.addEventListener("click", this.#onClick);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.#onClick);
    clearTimeout(this.#debounceTimer);
  }

  attributeChangedCallback() {
    if (this.shadowRoot.innerHTML) {
      clearTimeout(this.#debounceTimer);
      this.#debounceTimer = setTimeout(() => this.#fetchStars(), 150);
    }
  }

  get handle() {
    return this.getAttribute("handle") || "";
  }

  get repo() {
    return this.getAttribute("repo") || "";
  }

  get instance() {
    return this.getAttribute("instance") || "";
  }

  get count() {
    return this.#count;
  }

  #onClick = () => {
    if (this.handle && this.repo) {
      window.open(`https://tangled.sh/${this.handle}/${this.repo}`, "_blank");
    }
  };

  #render() {
    const stateClass = this.#loading ? "loading" : this.#error ? "error" : "";
    const countText = this.#loading ? "…" : (this.#count ?? 0).toString();

    this.shadowRoot.innerHTML = `
      <style>${starsStyles}</style>
      <span class="label ${stateClass}">
        <span class="icon">${dollyIcon}</span>
        <span>Stars</span>
      </span>
      <span class="count ${stateClass}">${countText}</span>
    `;
  }

  async #fetchStars() {
    const handle = this.handle;
    const repo = this.repo;
    const instance = this.instance;

    if (!handle || !repo || !instance) {
      this.#loading = false;
      this.#error = true;
      this.#render();
      return;
    }

    this.#loading = true;
    this.#error = false;
    this.#render();

    try {
      const query = `
        query GetRepoStars($handle: String!, $name: String!) {
          shTangledRepo(first: 1, where: { actorHandle: { eq: $handle }, name: { eq: $name } }) {
            edges {
              node {
                shTangledFeedStarViaSubject {
                  totalCount
                }
              }
            }
          }
        }
      `;

      const res = await fetch(`${instance}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          variables: { handle, name: repo },
        }),
      });

      if (!res.ok) throw new Error("Failed to fetch");

      const json = await res.json();
      const edges = json.data?.shTangledRepo?.edges || [];

      if (edges.length > 0) {
        this.#count = edges[0].node.shTangledFeedStarViaSubject?.totalCount ?? 0;
      } else {
        this.#count = 0;
      }

      this.#loading = false;
      this.#error = false;
    } catch (err) {
      console.error("Failed to fetch Tangled stars:", err);
      this.#loading = false;
      this.#error = true;
      this.#count = null;
    }

    this.#render();
  }
}

customElements.define("qs-tangled-stars", TangledStars);

export { BskyHandleInput, TangledStars };
