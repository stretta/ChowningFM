let midiAccess = null;
let connectedMidiInput = null;
const precisionNumberControls = new Map();
let rnboParameterDescriptors = new Map();
let rnboOutportDescriptors = [];
let fmPartialsViewState = null;

applySkinTheme();

window.addEventListener("rnbo-ready", (event) => {
    const app = event.detail;
    const skin = getActiveSkin();
    hydrateRNBODescriptors(app.patcher);

    console.log("RNBO ready", {
        patcher: app.patcher.desc.meta.filename,
        parameters: app.device.parameters.map((param) => param.id),
        skin: skin.theme
    });

    applySkinTheme();
    setAppCopy(app, skin);
    mountControls(app.device, skin);
    mountDerivedReadouts(app.device, app.patcher);
    mountFMPartialsDisplay(app.device, skin);
    mountPresetMenu(app.device, app.patcher);
    mountWebMIDI(app.device);
    mountOutputControls(app.device, skin);
});

function hydrateRNBODescriptors(patcher) {
    const parameterDescriptors = patcher && patcher.desc && Array.isArray(patcher.desc.parameters)
        ? patcher.desc.parameters
        : [];
    const outportDescriptors = patcher && patcher.desc && Array.isArray(patcher.desc.outports)
        ? patcher.desc.outports
        : [];

    rnboParameterDescriptors = new Map(
        parameterDescriptors.map((descriptor) => [descriptor.paramId || descriptor.id || descriptor.name, descriptor])
    );
    rnboOutportDescriptors = outportDescriptors;
}

function getTemplateConfig() {
    return window.RNBO_TEMPLATE_CONFIG || {};
}

function getActiveSkin() {
    const config = getTemplateConfig();
    const registry = window.RNBO_UI_SKINS || {};
    return registry[config.uiSkin] || registry.default || {
        name: "Default",
        theme: "default",
        description: "Neutral starter skin for any RNBO export.",
        createGroups(parameters) {
            return [{ title: "Parameters", controls: parameters.map((param) => param.id) }];
        }
    };
}

function applySkinTheme() {
    const skin = getActiveSkin();
    document.body.dataset.uiSkin = skin.theme || "default";
}

function setAppCopy(app, skin) {
    const config = getTemplateConfig();
    const title = document.getElementById("app-title");
    const subtitle = document.getElementById("app-subtitle");
    const patcherName = app.patcher.desc.meta.filename || "Unnamed patcher";
    const patcherTitle = document.getElementById("patcher-title");

    if (title) {
        title.textContent = config.appName || "Canvas Template";
    }

    if (subtitle) {
        subtitle.textContent = skin.description || config.appDescription || "";
    }

    if (patcherTitle) {
        patcherTitle.textContent = `${patcherName} (RNBO ${app.patcher.desc.meta.rnboversion})`;
    }
}

function mountControls(device, skin) {
    const container = document.getElementById("rnbo-parameter-sliders");
    if (!container) {
        return;
    }

    container.innerHTML = "";

    const parameterMap = new Map(device.parameters.map((param) => [param.id, param]));
    const groups = resolveControlGroups(device.parameters, skin);

    groups.forEach((group) => {
        const groupElement = createControlGroup(group.title);
        if (group.accent) {
            groupElement.dataset.accent = group.accent;
        }

        group.controls.forEach((id) => {
            const param = parameterMap.get(id);
            if (!param) {
                return;
            }

            const label = getParameterLabel(param, skin);
            const control = createControlForParam(param, label, skin);

            groupElement.querySelector(".control-group-grid").appendChild(control);
        });

        const derivedTags = Array.isArray(group.derivedTags) ? group.derivedTags : [];
        derivedTags.forEach((tag) => {
            groupElement.querySelector(".control-group-grid").appendChild(createDerivedReadout(tag));
        });

        if (groupElement.querySelector(".control-group-grid").children.length > 0) {
            container.appendChild(groupElement);
        }
    });

    device.parameterChangeEvent.subscribe((param) => {
        syncParameterUI(param);
    });
}

function resolveControlGroups(parameters, skin) {
    const hiddenIds = new Set(resolveHiddenParamIds(skin));
    const visibleParameters = parameters.filter((param) => !hiddenIds.has(param.id));
    const groups = typeof skin.createGroups === "function"
        ? skin.createGroups(visibleParameters, getTemplateConfig())
        : [{ title: "Parameters", controls: visibleParameters.map((param) => param.id) }];
    const usedIds = new Set(groups.flatMap((group) => group.controls));
    const remaining = visibleParameters
        .filter((param) => !usedIds.has(param.id))
        .map((param) => param.id);

    if (remaining.length > 0) {
        groups.push({
            title: "More",
            controls: remaining
        });
    }

    return groups;
}

function resolveHiddenParamIds(skin) {
    const config = getTemplateConfig();
    const globalIds = Array.isArray(config.hiddenParamIds) ? config.hiddenParamIds : [];
    const skinIds = Array.isArray(skin.hiddenParamIds) ? skin.hiddenParamIds : [];
    return [...new Set([...globalIds, ...skinIds])];
}

function getParameterLabel(param, skin) {
    const override = skin.labelOverrides && skin.labelOverrides[param.id];
    return override || param.name;
}

function createControlForParam(param, labelText, skin) {
    if (shouldUseGraphicSelector(param, skin)) {
        return createGraphicSelector(param, labelText);
    }

    if (shouldUsePrecisionNumber(param, skin)) {
        return createPrecisionNumberControl(param, labelText, skin);
    }

    return createVerticalSlider(param, labelText, skin);
}

function shouldUseGraphicSelector(param, skin) {
    const graphicSelectorIds = Array.isArray(skin.graphicSelectorParamIds)
        ? skin.graphicSelectorParamIds
        : [];

    if (graphicSelectorIds.includes(param.id)) {
        return true;
    }

    return Array.isArray(param.enumValues) && param.enumValues.length > 0 && param.enumValues.length <= 4;
}

function shouldUsePrecisionNumber(param, skin) {
    const options = getPrecisionNumberOptions(param, skin);

    if (!options.enabled) {
        return false;
    }

    return Number(param.steps) !== 2 && !Array.isArray(param.enumValues);
}

function getPrecisionNumberOptions(param, skin) {
    const config = getTemplateConfig();
    const globalIds = Array.isArray(config.precisionNumberParamIds)
        ? config.precisionNumberParamIds
        : [];
    const skinIds = Array.isArray(skin.precisionNumberParamIds)
        ? skin.precisionNumberParamIds
        : [];
    const globalOptions = config.numberControlOptions && config.numberControlOptions[param.id];
    const skinOptions = skin.numberControlOptions && skin.numberControlOptions[param.id];
    const descriptor = getParameterDescriptor(param);
    const descriptorMeta = descriptor && descriptor.meta ? descriptor.meta : {};

    return Object.assign({
        enabled: globalIds.includes(param.id) || skinIds.includes(param.id) || hasPrecisionNumberMeta(descriptorMeta),
        decimalPlaces: 2,
        showTrailingZeros: true,
        pixelsPerStep: 12
    }, normalizePrecisionMetaOptions(descriptorMeta), globalOptions, skinOptions);
}

function syncParameterUI(param) {
    const slider = document.querySelector(`[data-param-slider="${param.id}"]`);
    const readout = document.querySelector(`[data-param-readout="${param.id}"]`);
    const graphicOptions = document.querySelectorAll(`[data-param-option="${param.id}"]`);
    const precisionNumberControl = precisionNumberControls.get(param.id);

    if (slider) {
        slider.value = param.value;
        syncRangeControlVisual(slider, param);
    }

    if (graphicOptions.length > 0) {
        const roundedValue = Math.round(Number(param.value));
        graphicOptions.forEach((option) => {
            option.dataset.active = option.dataset.paramValue === String(roundedValue) ? "true" : "false";
        });
    }

    if (readout) {
        readout.textContent = formatReadoutValue(param, readout);
    }

    if (precisionNumberControl) {
        syncPrecisionNumberControl(param, { source: "external" });
    }
}

function createControlGroup(title) {
    const section = document.createElement("section");
    const heading = document.createElement("h2");
    const grid = document.createElement("div");

    section.className = "control-group";
    section.dataset.group = title.toLowerCase().replace(/\s+/g, "-");
    heading.className = "control-group-title";
    heading.textContent = title;
    grid.className = "control-group-grid";

    section.appendChild(heading);
    section.appendChild(grid);

    return section;
}

function createDerivedReadout(tag) {
    const card = document.createElement("article");
    const label = document.createElement("h3");
    const value = document.createElement("output");

    card.className = "derived-readout paired-readout";
    label.className = "derived-readout-label";
    value.className = "derived-readout-value";
    value.dataset.outportTag = tag;
    const unit = getDerivedReadoutUnit(tag);
    if (unit) {
        value.dataset.unit = unit;
    }
    value.textContent = "0";

    label.textContent = formatOutportLabel(tag);

    card.appendChild(label);
    card.appendChild(value);

    return card;
}

function createVerticalSlider(param, labelText, skin) {
    const wrapper = document.createElement("section");
    const label = document.createElement("label");
    const slider = document.createElement("input");
    const readout = document.createElement("output");

    wrapper.className = "control-strip";
    if ((skin.theme || "") === "juno" && param.id === "PulseLevel") {
        wrapper.classList.add("pulse-source");
    }
    if ((skin.theme || "") === "juno" && param.id === "PW") {
        wrapper.classList.add("pulse-width");
    }

    label.className = "control-label";
    label.htmlFor = `slider-${param.id}`;
    label.textContent = labelText || param.name;

    slider.className = "vertical-slider";
    slider.id = `slider-${param.id}`;
    slider.type = "range";
    slider.min = param.min;
    slider.max = param.max;
    slider.step = getStep(param);
    slider.value = param.value;
    slider.setAttribute("orient", "vertical");
    slider.dataset.paramSlider = param.id;
    slider.setAttribute("aria-label", param.name);

    readout.className = "control-readout";
    readout.dataset.paramReadout = param.id;
    readout.textContent = formatReadoutValue(param, readout);

    slider.addEventListener("input", () => {
        param.value = Number.parseFloat(slider.value);
        readout.textContent = formatReadoutValue(param, readout);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(slider);
    wrapper.appendChild(readout);

    return wrapper;
}

function createHorizontalSlider(param, options = {}) {
    const wrapper = document.createElement("section");
    const label = document.createElement("label");
    const slider = document.createElement("input");
    const readout = document.createElement("output");

    wrapper.className = options.wrapperClassName || "horizontal-control";

    label.className = "control-label";
    label.htmlFor = options.id || `slider-${param.id}-horizontal`;
    label.textContent = options.labelText || param.name;

    slider.className = options.sliderClassName || "horizontal-slider";
    slider.id = label.htmlFor;
    slider.type = "range";
    slider.min = param.min;
    slider.max = param.max;
    slider.step = getStep(param);
    slider.value = param.value;
    slider.dataset.paramSlider = param.id;
    slider.setAttribute("aria-label", param.name);
    syncRangeControlVisual(slider, param);

    readout.className = options.readoutClassName || "horizontal-control-readout";
    readout.dataset.paramReadout = param.id;
    if (options.readoutFormat) {
        readout.dataset.readoutFormat = options.readoutFormat;
    }
    readout.textContent = formatReadoutValue(param, readout);

    slider.addEventListener("input", () => {
        param.value = Number.parseFloat(slider.value);
        readout.textContent = formatReadoutValue(param, readout);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(slider);
    wrapper.appendChild(readout);

    return wrapper;
}

function createCompactKnob(param, options = {}) {
    const wrapper = document.createElement("section");
    const label = document.createElement("label");
    const shell = document.createElement("div");
    const face = document.createElement("div");
    const slider = document.createElement("input");
    const readout = document.createElement("output");

    wrapper.className = options.wrapperClassName || "compact-knob-control";

    label.className = "control-label compact-knob-label";
    label.htmlFor = options.id || `knob-${param.id}`;
    label.textContent = options.labelText || param.name;

    shell.className = options.shellClassName || "compact-knob-shell";

    face.className = options.faceClassName || "compact-knob-face";
    face.setAttribute("aria-hidden", "true");

    slider.className = options.sliderClassName || "compact-knob-input";
    slider.id = label.htmlFor;
    slider.type = "range";
    slider.min = param.min;
    slider.max = param.max;
    slider.step = getStep(param);
    slider.value = param.value;
    slider.dataset.paramSlider = param.id;
    slider.setAttribute("aria-label", param.name);
    syncRangeControlVisual(slider, param);

    readout.className = options.readoutClassName || "compact-knob-readout";
    readout.dataset.paramReadout = param.id;
    if (options.readoutFormat) {
        readout.dataset.readoutFormat = options.readoutFormat;
    }
    readout.textContent = formatReadoutValue(param, readout);

    slider.addEventListener("input", () => {
        param.value = Number.parseFloat(slider.value);
        syncRangeControlVisual(slider, param);
        readout.textContent = formatReadoutValue(param, readout);
    });

    shell.appendChild(face);
    shell.appendChild(slider);
    wrapper.appendChild(label);
    wrapper.appendChild(shell);
    wrapper.appendChild(readout);

    return wrapper;
}

function syncRangeControlVisual(slider, param) {
    if (!slider || slider.type !== "range") {
        return;
    }

    const min = Number(param ? param.min : slider.min);
    const max = Number(param ? param.max : slider.max);
    const value = Number(param ? param.value : slider.value);
    const span = max - min;
    const progress = span === 0 ? 0 : (value - min) / span;
    const clampedProgress = Math.max(0, Math.min(1, progress));

    const progressValue = clampedProgress.toFixed(4);
    const knobFillValue = `${clampedProgress * 280}deg`;
    const knobRotationValue = `${(clampedProgress * 280) - 140}deg`;

    slider.style.setProperty("--range-progress", progressValue);
    slider.style.setProperty("--knob-fill", knobFillValue);
    slider.style.setProperty("--knob-rotation", knobRotationValue);

    if (slider.parentElement) {
        slider.parentElement.style.setProperty("--range-progress", progressValue);
        slider.parentElement.style.setProperty("--knob-fill", knobFillValue);
        slider.parentElement.style.setProperty("--knob-rotation", knobRotationValue);
    }
}

function createPrecisionNumberControl(param, labelText, skin) {
    const wrapper = document.createElement("section");
    const options = getPrecisionNumberOptions(param, skin);
    const label = document.createElement("label");
    const control = document.createElement("div");
    const display = document.createElement("div");
    const editor = document.createElement("input");
    const readout = document.createElement("output");

    wrapper.className = "control-strip precision-number-control";
    wrapper.dataset.controlType = "precision-number";
    wrapper.dataset.paramId = param.id;

    label.className = "control-label";
    label.htmlFor = `precision-number-${param.id}`;
    label.textContent = labelText || param.name;

    control.className = "precision-number";
    control.id = `precision-number-${param.id}`;
    control.dataset.paramPrecisionNumber = param.id;
    control.dataset.editing = "false";
    control.tabIndex = 0;
    control.setAttribute("role", "spinbutton");
    control.setAttribute("aria-label", param.name);

    display.className = "precision-number-display";
    display.setAttribute("aria-hidden", "true");

    editor.className = "precision-number-editor";
    editor.type = "text";
    editor.inputMode = "decimal";
    editor.hidden = true;
    editor.tabIndex = -1;
    editor.setAttribute("aria-label", `${param.name} numeric editor`);

    readout.className = "control-readout";
    readout.dataset.paramReadout = param.id;

    control.appendChild(display);
    control.appendChild(editor);
    wrapper.appendChild(label);
    wrapper.appendChild(control);
    wrapper.appendChild(readout);

    const state = {
        param,
        controlEl: control,
        displayEl: display,
        editorEl: editor,
        readoutEl: readout,
        decimalPlaces: getPrecisionNumberDecimalPlaces(param, options),
        showTrailingZeros: options.showTrailingZeros !== false,
        renderedValue: "",
        pointerId: null,
        pointerStartY: 0,
        dragStartValue: Number(param.value),
        dragThresholdPassed: false,
        isDragging: false,
        hoverTokenIndex: null,
        activeTokenIndex: null,
        activePlaceValue: null,
        pixelsPerStep: Number(options.pixelsPerStep) || 12,
        isEditing: false,
        pendingExternalSync: false
    };

    control.addEventListener("pointermove", (event) => {
        handlePrecisionNumberPointerMove(state, event);
    });
    control.addEventListener("pointerdown", (event) => {
        handlePrecisionNumberPointerDown(state, event);
    });
    control.addEventListener("pointerup", (event) => {
        handlePrecisionNumberPointerUp(state, event);
    });
    control.addEventListener("pointercancel", () => {
        cancelPrecisionNumberDrag(state);
    });
    control.addEventListener("pointerleave", () => {
        if (!state.isDragging && state.pointerId === null) {
            state.hoverTokenIndex = null;
            updatePrecisionNumberTokenState(state);
        }
    });

    precisionNumberControls.set(param.id, state);
    syncPrecisionNumberControl(param, { source: "external", force: true });

    return wrapper;
}

function syncPrecisionNumberControl(param, syncOptions = {}) {
    const state = precisionNumberControls.get(param.id);

    if (!state) {
        return;
    }

    const isExternalSync = syncOptions.source !== "local";
    const isInteractive = state.isDragging || state.pointerId !== null || state.isEditing;

    if (isExternalSync && isInteractive && !syncOptions.force) {
        state.pendingExternalSync = true;
        return;
    }

    state.pendingExternalSync = false;

    const value = Number(param.value);
    const formattedValue = formatPrecisionNumberValue(value, state);
    const tokens = buildPrecisionTokens(formattedValue);

    state.renderedValue = formattedValue;
    renderPrecisionTokens(state.displayEl, tokens);
    syncPrecisionNumberTokenSelection(state, tokens);
    updatePrecisionNumberTokenState(state);
    state.readoutEl.textContent = param.unit ? `${formattedValue} ${param.unit}` : formattedValue;
    state.controlEl.setAttribute("aria-valuenow", `${value}`);

    if (Number.isFinite(param.min)) {
        state.controlEl.setAttribute("aria-valuemin", `${param.min}`);
    }

    if (Number.isFinite(param.max)) {
        state.controlEl.setAttribute("aria-valuemax", `${param.max}`);
    }
}

function getPrecisionNumberDecimalPlaces(param, options) {
    if (Number.isInteger(options.decimalPlaces) && options.decimalPlaces >= 0) {
        return options.decimalPlaces;
    }

    if (Number(param.steps) > 1) {
        const step = (param.max - param.min) / (param.steps - 1);
        const stepText = `${step}`;
        const decimals = stepText.includes(".") ? stepText.split(".")[1].length : 0;
        return Math.min(Math.max(decimals, 0), 6);
    }

    return 2;
}

function getParameterDescriptor(param) {
    return rnboParameterDescriptors.get(param.id) || null;
}

function hasPrecisionNumberMeta(meta) {
    if (!meta || typeof meta !== "object") {
        return false;
    }

    return Object.prototype.hasOwnProperty.call(meta, "decimalPlaces")
        || Object.prototype.hasOwnProperty.call(meta, "showTrailingZeros")
        || Object.prototype.hasOwnProperty.call(meta, "pixelsPerStep");
}

function normalizePrecisionMetaOptions(meta) {
    if (!meta || typeof meta !== "object") {
        return {};
    }

    const options = {};

    if (meta.decimalPlaces !== undefined) {
        options.decimalPlaces = Math.max(0, Number.parseInt(meta.decimalPlaces, 10) || 0);
    }

    if (meta.showTrailingZeros !== undefined) {
        options.showTrailingZeros = `${meta.showTrailingZeros}` !== "false";
    }

    if (meta.pixelsPerStep !== undefined) {
        options.pixelsPerStep = Number(meta.pixelsPerStep) || 12;
    }

    return options;
}

function formatPrecisionNumberValue(value, options) {
    const safeValue = Number.isFinite(value) ? value : 0;
    const roundedValue = roundToPlaces(safeValue, options.decimalPlaces);
    const fixedValue = roundedValue.toFixed(options.decimalPlaces);

    if (options.showTrailingZeros) {
        return fixedValue;
    }

    if (options.decimalPlaces === 0) {
        return fixedValue;
    }

    const trimmedValue = fixedValue
        .replace(/(\.\d*?[1-9])0+$/, "$1")
        .replace(/\.0+$/, "")
        .replace(/\.$/, "");

    return trimmedValue === "-0" ? "0" : trimmedValue;
}

function buildPrecisionTokens(formattedValue) {
    const decimalIndex = formattedValue.indexOf(".");
    const integerEnd = decimalIndex >= 0 ? decimalIndex : formattedValue.length;
    let integerDigitsSeen = 0;
    let fractionDigitsSeen = 0;
    const integerDigitsTotal = [...formattedValue.slice(0, integerEnd)].filter(isDigitCharacter).length;

    return [...formattedValue].map((char, index) => {
        if (isDigitCharacter(char)) {
            if (index < integerEnd) {
                const placeExponent = integerDigitsTotal - integerDigitsSeen - 1;
                integerDigitsSeen += 1;

                return {
                    char,
                    kind: "digit",
                    placeValue: 10 ** placeExponent,
                    editable: true
                };
            }

            fractionDigitsSeen += 1;

            return {
                char,
                kind: "digit",
                placeValue: 10 ** (-fractionDigitsSeen),
                editable: true
            };
        }

        if (char === ".") {
            return {
                char,
                kind: "decimal",
                placeValue: null,
                editable: false
            };
        }

        if (char === "-") {
            return {
                char,
                kind: "sign",
                placeValue: null,
                editable: false
            };
        }

        return {
            char,
            kind: "literal",
            placeValue: null,
            editable: false
        };
    });
}

function renderPrecisionTokens(displayEl, tokens) {
    displayEl.innerHTML = "";

    tokens.forEach((token, index) => {
        const tokenEl = document.createElement("span");

        tokenEl.className = "precision-token";
        tokenEl.dataset.tokenIndex = String(index);
        tokenEl.dataset.tokenKind = token.kind;
        tokenEl.dataset.editable = token.editable ? "true" : "false";
        tokenEl.textContent = token.char;

        if (token.placeValue !== null) {
            tokenEl.dataset.placeValue = `${token.placeValue}`;
        }

        displayEl.appendChild(tokenEl);
    });
}

function handlePrecisionNumberPointerDown(state, event) {
    if (event.button !== 0) {
        return;
    }

    const nearestToken = getNearestEditablePrecisionToken(state, event.clientX);

    if (!nearestToken) {
        return;
    }

    state.pointerId = event.pointerId;
    state.pointerStartY = event.clientY;
    state.dragStartValue = Number(state.param.value);
    state.dragThresholdPassed = false;
    state.isDragging = false;
    state.activeTokenIndex = nearestToken.tokenIndex;
    state.activePlaceValue = nearestToken.placeValue;
    state.hoverTokenIndex = nearestToken.tokenIndex;

    state.controlEl.dataset.dragging = "false";
    state.controlEl.setPointerCapture(event.pointerId);
    state.controlEl.focus();
    updatePrecisionNumberTokenState(state);

    event.preventDefault();
}

function handlePrecisionNumberPointerMove(state, event) {
    if (state.pointerId === null) {
        const nearestToken = getNearestEditablePrecisionToken(state, event.clientX);
        state.hoverTokenIndex = nearestToken ? nearestToken.tokenIndex : null;
        updatePrecisionNumberTokenState(state);
        return;
    }

    if (event.pointerId !== state.pointerId) {
        return;
    }

    const deltaY = state.pointerStartY - event.clientY;

    if (!state.dragThresholdPassed && Math.abs(deltaY) >= 4) {
        state.dragThresholdPassed = true;
        state.isDragging = true;
        state.controlEl.dataset.dragging = "true";
    }

    if (!state.isDragging || state.activePlaceValue === null) {
        return;
    }

    const rawSteps = deltaY / state.pixelsPerStep;
    const stepCount = truncateTowardZero(rawSteps);
    const nextValue = clampValue(
        roundToPlaces(state.dragStartValue + (stepCount * state.activePlaceValue), state.decimalPlaces),
        state.param.min,
        state.param.max
    );

    if (nextValue === Number(state.param.value)) {
        return;
    }

    state.param.value = nextValue;
    syncPrecisionNumberControl(state.param, { source: "local", force: true });
}

function handlePrecisionNumberPointerUp(state, event) {
    if (state.pointerId === null || event.pointerId !== state.pointerId) {
        return;
    }

    if (state.controlEl.hasPointerCapture(event.pointerId)) {
        state.controlEl.releasePointerCapture(event.pointerId);
    }

    state.pointerId = null;
    state.dragThresholdPassed = false;
    state.isDragging = false;
    state.controlEl.dataset.dragging = "false";
    state.activeTokenIndex = null;
    state.activePlaceValue = null;
    updatePrecisionNumberTokenState(state);
    flushPendingPrecisionNumberSync(state);
}

function cancelPrecisionNumberDrag(state) {
    if (state.pointerId === null) {
        return;
    }

    if (state.isDragging) {
        state.param.value = clampValue(
            roundToPlaces(state.dragStartValue, state.decimalPlaces),
            state.param.min,
            state.param.max
        );
        syncPrecisionNumberControl(state.param, { source: "local", force: true });
    }

    if (state.controlEl.hasPointerCapture(state.pointerId)) {
        state.controlEl.releasePointerCapture(state.pointerId);
    }

    state.pointerId = null;
    state.dragThresholdPassed = false;
    state.isDragging = false;
    state.activeTokenIndex = null;
    state.activePlaceValue = null;
    state.controlEl.dataset.dragging = "false";
    updatePrecisionNumberTokenState(state);
    flushPendingPrecisionNumberSync(state);
}

function getNearestEditablePrecisionToken(state, clientX) {
    const tokenElements = [...state.displayEl.querySelectorAll('[data-editable="true"]')];

    if (tokenElements.length < 1) {
        return null;
    }

    let nearestToken = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    tokenElements.forEach((tokenEl) => {
        const rect = tokenEl.getBoundingClientRect();
        const centerX = rect.left + (rect.width / 2);
        const distance = Math.abs(clientX - centerX);

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestToken = {
                tokenIndex: Number(tokenEl.dataset.tokenIndex),
                placeValue: Number(tokenEl.dataset.placeValue),
                element: tokenEl
            };
        }
    });

    return nearestToken;
}

function syncPrecisionNumberTokenSelection(state, tokens) {
    if (state.activePlaceValue !== null) {
        const activeIndex = tokens.findIndex((token) => token.placeValue === state.activePlaceValue);
        state.activeTokenIndex = activeIndex >= 0 ? activeIndex : null;
    }

    if (state.hoverTokenIndex !== null && !tokens[state.hoverTokenIndex]) {
        state.hoverTokenIndex = null;
    }
}

function updatePrecisionNumberTokenState(state) {
    const tokenElements = state.displayEl.querySelectorAll(".precision-token");

    tokenElements.forEach((tokenEl) => {
        const tokenIndex = Number(tokenEl.dataset.tokenIndex);
        tokenEl.dataset.hover = state.hoverTokenIndex === tokenIndex ? "true" : "false";
        tokenEl.dataset.active = state.activeTokenIndex === tokenIndex ? "true" : "false";
    });
}

function truncateTowardZero(value) {
    return value < 0 ? Math.ceil(value) : Math.floor(value);
}

function clampValue(value, min, max) {
    let nextValue = value;

    if (Number.isFinite(min)) {
        nextValue = Math.max(min, nextValue);
    }

    if (Number.isFinite(max)) {
        nextValue = Math.min(max, nextValue);
    }

    return nextValue;
}

function flushPendingPrecisionNumberSync(state) {
    if (!state.pendingExternalSync) {
        return;
    }

    syncPrecisionNumberControl(state.param, { source: "external", force: true });
}

function mountDerivedReadouts(device, patcher) {
    const outports = Array.isArray(rnboOutportDescriptors) && rnboOutportDescriptors.length > 0
        ? rnboOutportDescriptors
        : patcher && patcher.desc && Array.isArray(patcher.desc.outports)
            ? patcher.desc.outports
            : [];

    if (outports.length < 1 || !device.outports || device.outports.length < 1) {
        return;
    }

    const allowedTags = new Set(outports.map((outport) => outport.tag));

    device.messageEvent.subscribe((event) => {
        if (!allowedTags.has(event.tag)) {
            return;
        }

        document.querySelectorAll(`[data-outport-tag="${event.tag}"]`).forEach((target) => {
            target.textContent = formatOutportPayload(event.payload);
        });
    });
}

function mountFMPartialsDisplay(device, skin) {
    const host = document.getElementById("fm-visualization-host");

    if (!host) {
        return;
    }

    host.innerHTML = "";

    const parameterMap = new Map(device.parameters.map((param) => [param.id, param]));
    const carrierRatio = parameterMap.get("CarrierRatio") || null;
    const modulatorRatio = parameterMap.get("ModulatorRatio") || null;
    const modulationIndex = parameterMap.get("ModulationIndex") || null;

    if (!carrierRatio || !modulatorRatio || !modulationIndex) {
        host.hidden = true;
        fmPartialsViewState = null;
        return;
    }

    host.hidden = false;

    const card = document.createElement("section");
    const headingRow = document.createElement("div");
    const title = document.createElement("h3");
    const summary = document.createElement("p");
    const canvas = document.createElement("canvas");

    card.className = "partials-panel";
    if (skin && skin.theme) {
        card.dataset.uiTheme = skin.theme;
    }

    headingRow.className = "partials-panel-heading";
    title.className = "partials-panel-title";
    title.textContent = "FM Partials";
    summary.className = "partials-panel-summary";
    canvas.className = "partials-panel-canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "FM partial spectrum visualization");

    headingRow.appendChild(title);
    headingRow.appendChild(summary);
    card.appendChild(headingRow);
    card.appendChild(canvas);
    host.appendChild(card);

    fmPartialsViewState = {
        device,
        carrierRatio,
        modulatorRatio,
        modulationIndex,
        summary,
        canvas,
        context: canvas.getContext("2d"),
        reflectMode: 1,
        floorDb: -80,
        xmax: 32,
        nmax: 80,
        showGrid: true
    };

    const render = () => {
        renderFMPartialsDisplay(fmPartialsViewState);
    };

    render();

    device.parameterChangeEvent.subscribe((param) => {
        if (!fmPartialsViewState) {
            return;
        }

        if (param.id === carrierRatio.id || param.id === modulatorRatio.id || param.id === modulationIndex.id) {
            render();
        }
    });

    if (typeof ResizeObserver === "function") {
        const observer = new ResizeObserver(() => {
            render();
        });

        observer.observe(card);
        fmPartialsViewState.resizeObserver = observer;
    } else {
        window.addEventListener("resize", render);
        fmPartialsViewState.resizeHandler = render;
    }
}

function renderFMPartialsDisplay(state) {
    if (!state || !state.context || !state.canvas) {
        return;
    }

    const width = Math.max(320, Math.round(state.canvas.clientWidth || state.canvas.parentElement?.clientWidth || 640));
    const height = Math.max(220, Math.round(window.innerWidth <= 640 ? 220 : 260));
    const pixelRatio = window.devicePixelRatio || 1;

    state.canvas.width = Math.round(width * pixelRatio);
    state.canvas.height = Math.round(height * pixelRatio);
    state.canvas.style.height = `${height}px`;

    const ctx = state.context;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const carrier = Number(state.carrierRatio.value) || 0;
    const modulator = Number(state.modulatorRatio.value) || 0;
    const beta = Number(state.modulationIndex.value) || 0;
    const lines = computeStablePartials({
        carrier,
        modulator,
        beta,
        nmax: state.nmax,
        floorDb: state.floorDb,
        xmax: state.xmax,
        reflectMode: state.reflectMode
    });

    state.summary.textContent = `C ${formatSpectrumNumber(carrier)} | M ${formatSpectrumNumber(modulator)} | I ${formatSpectrumNumber(beta)}`;
    drawFMPartialLines(ctx, lines, {
        width,
        height,
        floorDb: state.floorDb,
        xmax: state.xmax,
        showGrid: state.showGrid
    });
}

function drawFMPartialLines(ctx, lines, options) {
    const { width, height, floorDb, xmax, showGrid } = options;
    const theme = getComputedStyle(document.body);
    const palette = {
        background: theme.getPropertyValue("--color-canvas-background").trim() || "#fffdf7",
        plotBackground: theme.getPropertyValue("--color-canvas-plot").trim() || "#ffffff",
        border: theme.getPropertyValue("--color-canvas-border").trim() || "rgba(37, 53, 60, 0.12)",
        grid: theme.getPropertyValue("--color-canvas-grid").trim() || "rgba(37, 53, 60, 0.1)",
        axis: theme.getPropertyValue("--color-canvas-axis").trim() || "rgba(37, 53, 60, 0.32)",
        label: theme.getPropertyValue("--color-canvas-label").trim() || "rgba(37, 53, 60, 0.65)",
        line: theme.getPropertyValue("--color-canvas-line").trim() || "#0d7c8f"
    };
    const margin = {
        top: 20,
        right: 14,
        bottom: 42,
        left: 44
    };
    const plotWidth = Math.max(1, width - margin.left - margin.right);
    const plotHeight = Math.max(1, height - margin.top - margin.bottom);
    const baselineY = margin.top + plotHeight;
    const mapX = (partial) => margin.left + (partial / xmax) * plotWidth;
    const mapY = (db) => {
        const ratio = (db - floorDb) / (0 - floorDb);
        const clamped = Math.max(0, Math.min(1, ratio));
        return margin.top + plotHeight * (1 - clamped);
    };

    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = palette.plotBackground;
    ctx.fillRect(margin.left, margin.top, plotWidth, plotHeight);
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(margin.left + 0.5, margin.top + 0.5, plotWidth - 1, plotHeight - 1);

    if (showGrid) {
        ctx.strokeStyle = palette.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let partial = 1; partial <= Math.floor(xmax); partial += 1) {
            const x = mapX(partial) + 0.5;
            ctx.moveTo(x, margin.top);
            ctx.lineTo(x, baselineY);
        }

        for (const db of [0, -20, -40, -60, -80]) {
            const y = mapY(db) + 0.5;
            ctx.moveTo(margin.left, y);
            ctx.lineTo(width - margin.right, y);
        }

        ctx.stroke();
    }

    ctx.strokeStyle = palette.axis;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(margin.left, baselineY + 0.5);
    ctx.lineTo(width - margin.right, baselineY + 0.5);
    ctx.moveTo(margin.left + 0.5, margin.top);
    ctx.lineTo(margin.left + 0.5, baselineY);
    ctx.stroke();

    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 2;
    ctx.beginPath();

    lines.forEach((line) => {
        const x = mapX(line.p) + 0.5;
        ctx.moveTo(x, baselineY);
        ctx.lineTo(x, mapY(line.db));
    });

    ctx.stroke();

    ctx.fillStyle = palette.label;
    ctx.font = '600 11px "Avenir Next", "Avenir", sans-serif';
    ctx.textBaseline = "middle";

    [0, -20, -40, -60, -80].forEach((db) => {
        const y = mapY(db);
        ctx.fillText(`${db}`, 8, y);
    });

    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    for (let partial = 0; partial <= Math.floor(xmax); partial += 4) {
        ctx.fillText(`${partial}`, mapX(partial), baselineY + 8);
    }

    ctx.textAlign = "left";
    ctx.fillText("dB", 8, 4);
    ctx.textAlign = "center";
    ctx.fillText("partial", margin.left + plotWidth / 2, baselineY + 24);
}

function computeStablePartials(options) {
    const carrier = Number(options.carrier) || 0;
    const modulator = Number(options.modulator) || 0;
    const beta = Number(options.beta) || 0;
    const nmax = Math.max(0, Number(options.nmax) || 0);
    const floorDb = Number(options.floorDb) || -80;
    const xmax = Math.max(0.1, Number(options.xmax) || 32);
    const reflectMode = Number(options.reflectMode) ? 1 : 0;
    const quantization = 1e-6;
    const bessel = buildBesselSequence(beta, nmax);
    const accumulator = new Map();

    const keyFor = (partial) => (Math.round(partial / quantization) * quantization).toFixed(6);
    const addSigned = (partial, amplitude) => {
        if (partial < 0) {
            return;
        }

        const key = keyFor(partial);
        accumulator.set(key, (accumulator.get(key) || 0) + amplitude);
    };

    addSigned(carrier, bessel[0]);

    for (let n = 1; n <= nmax; n += 1) {
        const jn = bessel[n];
        addSigned(carrier + (n * modulator), jn);

        const lowerAmplitude = n % 2 === 1 ? -jn : jn;
        const lowerPartial = carrier - (n * modulator);

        if (lowerPartial >= 0) {
            addSigned(lowerPartial, lowerAmplitude);
        } else if (reflectMode) {
            addSigned(-lowerPartial, lowerAmplitude);
        }
    }

    const entries = [...accumulator.entries()];
    if (entries.length < 1) {
        return [];
    }

    let maxMagnitude = 0;
    entries.forEach(([, amplitude]) => {
        maxMagnitude = Math.max(maxMagnitude, Math.abs(amplitude));
    });

    if (maxMagnitude <= 0) {
        maxMagnitude = 1e-12;
    }

    return entries
        .map(([key, amplitude]) => {
            const partial = Number.parseFloat(key);
            if (partial < 0 || partial > xmax) {
                return null;
            }

            const magnitude = Math.abs(amplitude);
            if (magnitude <= 0) {
                return null;
            }

            const db = 20 * Math.log(magnitude / maxMagnitude) / Math.LN10;
            return {
                p: partial,
                db: Number.isFinite(db) ? Math.max(db, floorDb) : floorDb
            };
        })
        .filter(Boolean)
        .sort((left, right) => left.p - right.p);
}

function buildBesselSequence(value, nmax) {
    const sequence = new Array(nmax + 1);

    for (let index = 0; index <= nmax; index += 1) {
        sequence[index] = besselJSeries(index, value);
    }

    return sequence;
}

function besselJSeries(order, value) {
    const absoluteValue = Math.abs(value);

    if (absoluteValue < 1e-12) {
        return order === 0 ? 1 : 0;
    }

    let sign = 1;
    if (value < 0 && order % 2 === 1) {
        sign = -1;
    }

    const x = absoluteValue;
    const half = x * 0.5;
    let term = 1;

    for (let index = 0; index < order; index += 1) {
        term *= half;
    }

    for (let index = 2; index <= order; index += 1) {
        term /= index;
    }

    let sum = term;
    const xSquaredOverFour = (x * x) / 4;

    for (let m = 0; m < 200; m += 1) {
        term *= -xSquaredOverFour / ((m + 1) * (m + order + 1));
        sum += term;

        if (Math.abs(term) < 1e-15) {
            break;
        }
    }

    return sign * sum;
}

function formatSpectrumNumber(value) {
    return trimTrailingZeros(roundToPlaces(Number(value) || 0, 3).toFixed(3));
}

function formatOutportLabel(tag) {
    const explicitLabels = {
        CarrierFreq: "Freq",
        ModulatorFreq: "Freq",
        ModulatorrFreq: "Freq",
        FreqDeviation: "Deviation"
    };

    if (explicitLabels[tag]) {
        return explicitLabels[tag];
    }

    const normalizedTag = tag === "ModulatorrFreq" ? "ModulatorFreq" : tag;
    return normalizedTag.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function formatOutportPayload(payload) {
    const value = Array.isArray(payload) ? payload[0] : payload;

    if (typeof value === "number" && Number.isFinite(value)) {
        return trimTrailingZeros(roundToPlaces(value, 3).toFixed(3));
    }

    if (Array.isArray(payload)) {
        return payload.join(", ");
    }

    return `${payload}`;
}

function getDerivedReadoutUnit(tag) {
    const unitMap = {
        CarrierFreq: "hz",
        ModulatorFreq: "hz",
        ModulatorrFreq: "hz",
        FreqDeviation: "hz"
    };

    return unitMap[tag] || "";
}

function trimTrailingZeros(valueText) {
    return valueText
        .replace(/(\.\d*?[1-9])0+$/, "$1")
        .replace(/\.0+$/, "")
        .replace(/\.$/, "");
}

function roundToPlaces(value, places) {
    const factor = 10 ** Math.max(0, places);
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function isDigitCharacter(char) {
    return /\d/.test(char);
}

function createGraphicSelector(param, labelText) {
    const wrapper = document.createElement("section");
    const label = document.createElement("label");
    const options = document.createElement("div");
    const readout = document.createElement("output");
    const waveformNames = getEnumNames(param);
    const steps = Number(param.steps) || waveformNames.length || 0;
    const valueStep = steps > 1 ? (param.max - param.min) / (steps - 1) : 1;

    wrapper.className = "control-strip graphic-selector";
    label.className = "control-label";
    label.textContent = labelText || param.name;

    options.className = "graphic-options";
    options.setAttribute("role", "radiogroup");
    options.setAttribute("aria-label", param.name);

    waveformNames.forEach((name, index) => {
        const button = document.createElement("button");
        const optionValue = Math.round(param.min + (valueStep * index));

        button.type = "button";
        button.className = "graphic-option";
        button.dataset.paramOption = param.id;
        button.dataset.paramValue = String(optionValue);
        button.dataset.kind = getGraphicSelectorKind(param.id);
        button.dataset.valueName = name;
        button.dataset.active = optionValue === Math.round(Number(param.value)) ? "true" : "false";
        button.setAttribute("aria-label", `${param.name} ${name}`);
        button.appendChild(createGraphicIcon(param.id, name));

        button.addEventListener("click", () => {
            param.value = optionValue;
            readout.textContent = formatValue(param);
            syncGraphicOptions(param.id, optionValue);
        });

        options.appendChild(button);
    });

    readout.className = "control-readout";
    readout.dataset.paramReadout = param.id;
    readout.textContent = formatValue(param);

    wrapper.appendChild(label);
    wrapper.appendChild(options);
    wrapper.appendChild(readout);

    return wrapper;
}

function getEnumNames(param) {
    if (Array.isArray(param.enumValues) && param.enumValues.length > 0) {
        return param.enumValues;
    }

    return ["sine", "square", "tri", "ramp"];
}

function getGraphicSelectorKind(paramId) {
    return paramId === "FilterMode" ? "filter" : "waveform";
}

function createGraphicIcon(paramId, name) {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    const path = document.createElementNS(namespace, "path");

    svg.setAttribute("viewBox", "0 0 64 36");
    svg.setAttribute("class", "graphic-icon");
    svg.setAttribute("aria-hidden", "true");

    path.setAttribute("class", "graphic-trace");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("d", getGraphicPath(paramId, name));

    svg.appendChild(path);

    return svg;
}

function getGraphicPath(paramId, name) {
    if (paramId === "FilterMode") {
        return getFilterModePath(name);
    }

    return getWaveformPath(name);
}

function getWaveformPath(name) {
    switch (name.toLowerCase()) {
        case "sine":
            return "M 4 18 C 10 6, 18 6, 24 18 S 38 30, 44 18 S 58 6, 60 18";
        case "square":
            return "M 4 26 L 4 10 L 20 10 L 20 26 L 44 26 L 44 10 L 60 10";
        case "tri":
        case "triangle":
            return "M 4 18 L 18 6 L 32 30 L 46 6 L 60 18";
        case "ramp":
        case "saw":
            return "M 4 30 L 24 6 L 24 30 L 44 6 L 44 30 L 60 12";
        default:
            return "M 4 18 L 60 18";
    }
}

function getFilterModePath(name) {
    switch (name.toLowerCase()) {
        case "lpf":
        case "lowpass":
            return "M 4 10 L 22 10 C 30 10, 36 11, 40 13 C 46 17, 50 23, 60 28";
        case "bpf":
        case "bandpass":
            return "M 4 28 C 14 28, 18 28, 22 26 C 28 22, 30 12, 32 8 C 34 12, 36 22, 42 26 C 46 28, 50 28, 60 28";
        case "hpf":
        case "highpass":
            return "M 4 28 C 16 28, 22 27, 28 24 C 36 20, 42 16, 60 10";
        case "notch":
            return "M 4 10 L 22 10 C 27 10, 29 14, 32 26 C 35 14, 37 10, 42 10 L 60 10";
        default:
            return "M 4 18 L 60 18";
    }
}

function syncGraphicOptions(paramId, activeValue) {
    const graphicOptions = document.querySelectorAll(`[data-param-option="${paramId}"]`);
    graphicOptions.forEach((option) => {
        option.dataset.active = option.dataset.paramValue === String(activeValue) ? "true" : "false";
    });
}

function getStep(param) {
    if (param.steps > 1) {
        return (param.max - param.min) / (param.steps - 1);
    }

    return (param.max - param.min) / 1000;
}

function formatValue(param) {
    const value = Number(param.value);
    if (Array.isArray(param.enumValues) && param.enumValues.length > 0) {
        const steps = Number(param.steps) || param.enumValues.length;
        const index = steps > 1
            ? Math.round((value - param.min) / ((param.max - param.min) / (steps - 1)))
            : 0;
        const enumValue = param.enumValues[Math.max(0, Math.min(param.enumValues.length - 1, index))];
        return enumValue || `${value}`;
    }

    if (param.steps === 2) {
        return `${Math.round(value)}`;
    }

    const formatted = value.toFixed(2).replace(/\.00$/, "");
    return param.unit ? `${formatted} ${param.unit}` : formatted;
}

function mountPresetMenu(device, patcher) {
    const presetPanel = document.getElementById("preset-panel");
    const presetSelect = document.getElementById("preset-select");

    if (!presetPanel || !presetSelect) {
        return;
    }

    const presets = patcher.presets || [];
    presetSelect.innerHTML = "";

    if (presets.length < 1) {
        presetPanel.hidden = true;
        return;
    }

    presets.forEach((preset, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = preset.name || `Preset ${index + 1}`;
        presetSelect.appendChild(option);
    });

    presetSelect.addEventListener("change", () => {
        const selectedPreset = presets[Number(presetSelect.value)];
        if (selectedPreset) {
            device.setPreset(selectedPreset.preset);
        }
    });

    if (getTemplateConfig().autoLoadFirstPreset) {
        presetSelect.value = "0";
        device.setPreset(presets[0].preset);
    } else {
        presetSelect.value = "";
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Choose preset";
        placeholder.selected = true;
        placeholder.disabled = true;
        presetSelect.prepend(placeholder);
    }

    presetPanel.hidden = presets.length < 2;
}

async function mountWebMIDI(device) {
    const midiPanel = document.getElementById("midi-panel");
    const midiInputSelect = document.getElementById("midi-input-select");

    if (!midiPanel || !midiInputSelect || device.numMIDIInputPorts < 1) {
        return;
    }

    if (!navigator.requestMIDIAccess) {
        midiPanel.hidden = true;
        return;
    }

    try {
        midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    } catch (err) {
        console.warn("Web MIDI unavailable", err);
        midiPanel.hidden = true;
        return;
    }

    const refreshMidiInputs = () => {
        const inputs = Array.from(midiAccess.inputs.values());
        midiInputSelect.innerHTML = "";

        if (inputs.length < 1) {
            disconnectMidiInput();
            midiPanel.hidden = true;
            return;
        }

        inputs.forEach((input) => {
            const option = document.createElement("option");
            option.value = input.id;
            option.textContent = input.name || input.manufacturer || input.id;
            midiInputSelect.appendChild(option);
        });

        const defaultInputId = connectedMidiInput && inputs.some((input) => input.id === connectedMidiInput.id)
            ? connectedMidiInput.id
            : inputs[0].id;

        midiInputSelect.value = defaultInputId;
        connectMidiInput(device, midiAccess.inputs.get(defaultInputId));
        midiPanel.hidden = false;
    };

    midiInputSelect.onchange = () => {
        connectMidiInput(device, midiAccess.inputs.get(midiInputSelect.value));
    };

    midiAccess.onstatechange = refreshMidiInputs;
    refreshMidiInputs();
}

function connectMidiInput(device, input) {
    if (!input) {
        disconnectMidiInput();
        return;
    }

    if (connectedMidiInput && connectedMidiInput.id === input.id) {
        return;
    }

    disconnectMidiInput();
    connectedMidiInput = input;
    connectedMidiInput.onmidimessage = (event) => {
        if (!event.data || event.data.length < 1) {
            return;
        }

        const payload = Array.from(event.data);
        const midiEvent = new RNBO.MIDIEvent(device.context.currentTime * 1000, 0, payload);
        device.scheduleEvent(midiEvent);
    };
}

function disconnectMidiInput() {
    if (!connectedMidiInput) {
        return;
    }

    connectedMidiInput.onmidimessage = null;
    connectedMidiInput = null;
}

function mountOutputControls(device, skin) {
    const container = document.getElementById("rnbo-output-controls");
    if (!container) {
        return;
    }

    container.innerHTML = "";

    const noteParam = device.parameters.find((param) => param.id === "NoteInput") || null;
    const volumeParam = resolveVolumeParameter(device.parameters, skin);

    if (!noteParam && !volumeParam) {
        const message = document.createElement("p");
        message.className = "output-control-empty";
        message.textContent = "Performance controls will appear here when the RNBO export includes note or volume parameters.";
        container.appendChild(message);
        return;
    }

    const group = document.createElement("div");
    group.className = "output-control-cluster";

    if (noteParam) {
        group.appendChild(createCompactKnob(noteParam, {
            wrapperClassName: "compact-knob-control output-note-control",
            sliderClassName: "compact-knob-input output-note-knob",
            readoutClassName: "compact-knob-readout output-note-readout",
            labelText: "Pitch",
            readoutFormat: "note-short-name",
            id: `output-knob-${noteParam.id}`
        }));
    }

    if (volumeParam) {
        group.appendChild(createCompactKnob(volumeParam, {
            wrapperClassName: "compact-knob-control output-volume-control",
            sliderClassName: "compact-knob-input output-volume-knob",
            readoutClassName: "compact-knob-readout output-volume-readout",
            labelText: "Volume",
            id: `output-knob-${volumeParam.id}`
        }));
    }

    container.appendChild(createOutputControlPanel("Performance", group));
}

function createOutputControlPanel(title, control) {
    const panel = document.createElement("section");
    const panelHeading = document.createElement("h3");

    panel.className = "output-control-panel";
    panelHeading.className = "output-control-title";
    panelHeading.textContent = title;

    panel.appendChild(panelHeading);
    panel.appendChild(control);

    return panel;
}

function resolveVolumeParameter(parameters, skin) {
    const candidateIds = getVolumeParamCandidates(skin);
    const parameterMap = new Map(parameters.map((param) => [param.id, param]));

    for (const id of candidateIds) {
        if (parameterMap.has(id)) {
            return parameterMap.get(id);
        }
    }

    return parameters.find((param) => /\b(volume|level|gain|amp|amplitude|output)\b/i.test(`${param.id} ${param.name}`)) || null;
}

function getVolumeParamCandidates(skin) {
    const config = getTemplateConfig();
    const globalCandidates = Array.isArray(config.volumeParamIds) ? config.volumeParamIds : [];
    const skinCandidates = Array.isArray(skin.volumeParamIds) ? skin.volumeParamIds : [];

    return [
        ...globalCandidates,
        ...skinCandidates,
        "Volume",
        "volume",
        "MasterVolume",
        "masterVolume",
        "OutputVolume",
        "outputVolume",
        "OutputLevel",
        "outputLevel",
        "Level",
        "level",
        "Gain",
        "gain",
        "Amp",
        "amp"
    ];
}

function getOutputControlLabel(param, skin) {
    if (skin.outputControlLabel) {
        return skin.outputControlLabel;
    }

    return getParameterLabel(param, skin);
}

function formatReadoutValue(param, readout) {
    if (readout && readout.dataset.readoutFormat === "note-name") {
        const note = Math.round(Number(param.value));
        return `${getNoteName(note)} (${note})`;
    }

    if (readout && readout.dataset.readoutFormat === "note-short-name") {
        return getNoteName(Math.round(Number(param.value)));
    }

    return formatValue(param);
}

function getNoteName(note) {
    const normalized = Number.isFinite(note) ? note : 0;
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const octave = Math.floor(normalized / 12) - 1;
    return `${names[((normalized % 12) + 12) % 12]}${octave}`;
}
