class Stock extends Item {
    static DEFAULT_SIGNAL_DELTA_MULTIPLIER = 0.33;
    static DEFAULT_COLOR = "#EA3E3E";
    static #ID_COUNTER = 0;

    static get #DEFAULT_LABEL() { return "?"; }
    static get #DEFAULT_RADIUS() { return 60; };
    static get #DEFAULT_VALUE() { return 0.5; }
    static #stocks = {};
    static getStock(id) { return Stock.#stocks[id]; }

    #id; #x; #y;
    #width = Stock.#DEFAULT_RADIUS * 2;
    #height = Stock.#DEFAULT_RADIUS * 2;
    #label = Stock.#DEFAULT_LABEL;
    #color = Stock.DEFAULT_COLOR;

    #controls = { visible: false, alpha: 0, direction: 0, selected: false, pressed: false }
    #offset = { main: 0, goTo: 0, vel: 0, acc: 0, damp: 0, hookes: 0 }
    #listeners = { modelreset: null, mousedown: null, mousemove: null, mouseup: null }
    #flows = { inbound: [], outbound: [] }
    #innerRadius;

    #unit = "";
    #initialValue = Stock.#DEFAULT_VALUE;
    #currentValue;

    get id() { return this.#id; }
    get x() { return this.#x; }
    get y() { return this.#y; }
    get width() { return this.#width; }
    get height() { return this.#height; }
    get radius() { return this.width / 2; }
    get label() { return this.#label; }
    get color() { return this.#color; }
    get initialValue() { return this.#initialValue; }
    get currentValue() { return this.#currentValue; }
    get unit() { return this.#unit; }
    get showValue() { return true; }
    get isContentDark() { return this.#isDarkColor(this.color); }
    get shape() {
        if (this instanceof RectangleStock) return 1;
        if (this instanceof BoundaryStock) return 2;
        return 0;
    }

    set x(x) { this.#x = x; }
    set y(y) { this.#y = y; }
    set width(v) { this.#width = v; }
    set height(v) { this.#height = v; }
    set radius(radius) {
        this.#width = radius * 2;
        this.#height = radius * 2;
    }
    set label(label) { this.#label = label; }
    set color(color) { this.#color = color; }
    set initialValue(initialValue) {
        if (initialValue === "" || initialValue === null || initialValue === undefined) {
            this.#initialValue = null;
        } else {
            this.#initialValue = parseFloat(initialValue);
        }
    }
    set unit(unit) { this.#unit = unit; }
    set shape(value) { publish("model/stock/shape", [this, value]); }

    constructor(configuration) {
        super(Item.STOCK, configuration);

        _validateTrue(configuration.x !== undefined && configuration.x >= 0, "X axis coordinate 'x' must be provided in configuration as a non-negative number.");
        _validateTrue(configuration.y !== undefined && configuration.y >= 0, "Y axis coordinate 'y' must be provided in configuration as a non-negative number.");

        this.x = configuration.x;
        this.y = configuration.y;

        if (configuration.width !== undefined) this.#width = configuration.width;
        if (configuration.height !== undefined) {
            this.#height = configuration.height;
        } else if (configuration.width !== undefined) {
            this.#height = (this instanceof RectangleStock) ? this.#width * 0.75 : this.#width;
        }

        // Force circularity if not rectangle
        if (this.#width !== undefined && !(this instanceof RectangleStock)) {
            this.#height = this.#width;
        }

        if (configuration.radius !== undefined) {
            this.#width = configuration.radius * 2;
            this.#height = (this instanceof RectangleStock) ? this.#width * 0.75 : this.#width;
        }
        if (configuration.label !== undefined) this.#label = configuration.label;

        // initialValue / unit
        if (configuration.initialValue !== undefined) {
            if (configuration.initialValue === "" || configuration.initialValue === null) {
                this.#initialValue = null;
            } else {
                this.#initialValue = parseFloat(configuration.initialValue);
            }
        }
        if (configuration.unit !== undefined) this.#unit = configuration.unit;

        // color
        this.#color = configuration.color || configuration.hue || Stock.DEFAULT_COLOR;
        // ensure it's a string if it was a numeric hue index from very old versions
        if (typeof this.#color === "number") this.#color = Stock.DEFAULT_COLOR;

        this.#reset();

        this.#id = this.generateId(configuration.id);
    }

    addInboundFlow(flow) {
        this.#flows.inbound.push(flow);
    }

    addOutboundFlow(flow) {
        this.#flows.outbound.push(flow);
    }

    getBoundingBox(context) {
        return {
            left: this.x - this.width / 2,
            top: this.y - this.height / 2,
            right: this.x + this.width / 2,
            bottom: this.y + this.height / 2
        };
    };

    draw(context, configuration) {
        var x = this.x * 2;
        var y = this.y * 2;
        var r = this.radius * 2;
        var color = this.color;

        context.save();
        context.translate(x, y);

        // highlight selected
        if (this.selected) {
            this.drawHighlight(context, r);
        }

        // draw base shape
        this.drawShape(context, color, r);

        // label
        this.drawLabel(context, r);

        // restore
        context.restore();
    }

    drawHighlight(context, r) {
        _throwErrorMessage("drawHighlight not implemented in Stock base class");
    }

    drawShape(context, color, r) {
        _throwErrorMessage("drawShape not implemented in Stock base class");
    }

    drawLabel(context, r) {
        // 1. Capture State & Constants
        const isDark = this.isContentDark;
        const textColor = isDark ? "#FFF" : "#000";
        const subtextColor = isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)";
        const pillColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";
        
        const label = this.label;
        const unit = this.unit || "";
        const initVal = this.initialValue;
        const currVal = this.currentValue;
        const showVal = this.showValue;
        const hasAmount = (showVal && initVal !== null && !isNaN(initVal));
        
        const halfWidth = r / 2;
        const nodeHeight = this.height * 2;
        const isCircle = !(this instanceof RectangleStock);

        // --- 5px (CSS) PADDING CALIBRATION ---
        const padding = 10; // 5px * 2 for retina
        const maxW = r - padding;
        const maxH = nodeHeight - padding;
        
        const lineSpacingRatio = isCircle ? 0.85 : 0.95; 
        const gapRatio = isCircle ? 0.05 : 0.12; 
        const pillPaddingRatio = 0.2; 

        // Helper: Circle width at physical altitude Y
        const getWidthAtY = (y) => {
            if (!isCircle) return maxW;
            const safeR = halfWidth - (padding / 2);
            const absY = Math.abs(y);
            if (absY >= safeR) return 0;
            return 2 * Math.sqrt(safeR * safeR - (absY * absY));
        };

        // --- PHASE 1: BINARY SEARCH FOR OPTIMAL FIT ---
        let nameLines = [];
        let stackHeight = 0;
        let finalAmountPillH = 0;

        const checkFit = (size) => {
            const uSize = Math.max(10, size * 0.65);
            let pillH = 0;
            let combinedW = 0;

            // A. Amount Metrics
            if (hasAmount) {
                const dV = Math.round(currVal * 100) / 100;
                context.font = "bold " + size + "px sans-serif";
                const vW = context.measureText(dV.toString()).width;
                context.font = "bold " + uSize + "px sans-serif";
                const uW = unit ? context.measureText(" " + unit).width : 0;
                combinedW = vW + uW;
                pillH = size * (1 + pillPaddingRatio * 2);
            }

            // B. Name Metrics
            context.font = "bold " + size + "px sans-serif";
            const nLines = this.#wrapText(context, label, maxW);
            const lSpac = size * lineSpacingRatio;
            const nH = nLines.length * lSpac;
            const gap = hasAmount ? (size * gapRatio) : 0;
            const totalH = nH + gap + pillH;

            // C. Constraint: Vertical
            if (totalH > maxH) return false;

            const sTop = -totalH / 2;
            
            // D. Constraint: Width Checks
            if (hasAmount) {
                const aY = (sTop + totalH) - pillH / 2;
                const aCheckY = aY + (pillH / 2) * (isCircle ? 0.4 : 0);
                if ((combinedW + r * 0.1) > getWidthAtY(aCheckY)) return false;
            }
            
            for (let i = 0; i < nLines.length; i++) {
                const lY = sTop + (i * lSpac) + (lSpac / 2);
                const lCheckY = lY - (lSpac / 2) * (isCircle ? 0.4 : 0);
                if (context.measureText(nLines[i]).width > getWidthAtY(lCheckY)) return false;
            }

            // Persistence
            nameLines = nLines;
            stackHeight = totalH;
            finalAmountPillH = pillH;
            return true;
        };

        // Binary Search (Range: 8px to Container scale)
        let low = 8, high = Math.max(r, nodeHeight);
        for (let i = 0; i < 8; i++) {
            let mid = (low + high) / 2;
            if (checkFit(mid)) low = mid;
            else high = mid;
        }
        const finalSize = low;
        checkFit(finalSize); 

        // --- PHASE 2: RENDERING ---
        const LS = finalSize;
        const US = Math.max(10, LS * 0.65);
        const lSpacing = LS * lineSpacingRatio;
        const sTop = -stackHeight / 2;

        context.textAlign = "center";
        context.textBaseline = "middle";

        // Draw Name lines
        context.fillStyle = subtextColor;
        context.font = "bold " + LS + "px sans-serif";
        for (let i = 0; i < nameLines.length; i++) {
            const y = sTop + (i * lSpacing) + (lSpacing / 2);
            context.fillText(nameLines[i], 0, y);
        }

        // Draw Amount pill
        if (hasAmount) {
            const centerY = (sTop + stackHeight) - (finalAmountPillH / 2);
            const dVal = Math.round(currVal * 100) / 100;
            
            context.font = "bold " + LS + "px sans-serif";
            const vW = context.measureText(dVal.toString()).width;
            context.font = "bold " + US + "px sans-serif";
            const uTxt = unit ? (" " + unit) : "";
            const uW = unit ? context.measureText(uTxt).width : 0;
            const fullW = vW + uW;

            const ph = finalAmountPillH, pw = fullW + r * 0.15;
            const px = -pw / 2, py = centerY - ph / 2;
            const pr = isCircle ? Math.min(ph / 2, r * 0.1) : (r * 0.08);

            context.beginPath();
            context.roundRect(px, py, pw, ph, pr);
            context.fillStyle = pillColor;
            context.fill();

            const sx = -fullW / 2;
            context.textAlign = "left";
            context.font = "bold " + LS + "px sans-serif";
            context.fillStyle = textColor;
            context.fillText(dVal, sx, centerY);

            if (unit) {
                context.font = "bold " + US + "px sans-serif";
                context.fillStyle = subtextColor;
                context.fillText(uTxt, sx + vW, centerY + (LS - US) * 0.1);
            }
        }
    }


    initialize(model, mouse) {
        this.#reset();

        this.#listeners.modelreset = subscribe("model/reset", function () { this.#onModelReset(model) }.bind(this));
        this.#listeners.mousedown = subscribe("mousedown", function () { this.#onMouseDown(model, mouse) }.bind(this));
        this.#listeners.mousemove = subscribe("mousemove", function () { this.#onMouseMove(model, mouse) }.bind(this));
        this.#listeners.mouseup = subscribe("mouseup", function () { this.#onMouseUp(model, mouse) }.bind(this));
    }

    isPointInStock(context, x, y, buffer) {
        _throwErrorMessage("isPointInStock not implemented in Stock base class");
    };

    isPointInResizeZone(x, y) {
        // Resize if clicking/hovering the highlight area (halo) 
        // that is outside the core stock
        // Circles use an 8px halo for a balanced, high-precision feel
        var highlightRadius = this.radius + 10;
        var inHighlight = _isPointInCircle(x, y, this.x, this.y, highlightRadius);
        var inStock = this.isPointInStock(null, x, y, 0);
        return inHighlight && !inStock;
    };

    getBoundaryOffset(angle) {
        return this.radius; // circular default
    }

    kill(silent) {
        unsubscribe("model/reset", this.#listeners.modelreset);
        unsubscribe("mousedown", this.#listeners.mousedown);
        unsubscribe("mousemove", this.#listeners.mousemove);
        unsubscribe("mouseup", this.#listeners.mouseup);

        delete Stock.#stocks[this.id];

        if (!silent) publish("kill", [this]);
    };

    move(x, y) {
        this.x = x;
        this.y = y;
    }

    removeInboundFlow(flow) {
        var index = this.#flows.inbound.indexOf(flow);
        if (index !== -1) this.#flows.inbound.splice(index, 1);
    }

    removeOutboundFlow(flow) {
        var index = this.#flows.outbound.indexOf(flow);
        if (index !== -1) this.#flows.outbound.splice(index, 1);
    }

    takeSignal(signal) {
        this.#currentValue += signal.delta;

        this.#sendSignal(signal);
    };

    update(mouse, configuration) {
        if (!configuration.isPlaying) {
            this.#reset();
        }

        // Cursor (Only for Signals in Play Mode)
        if (configuration.isPlaying && this.#controls.selected) {
            mouse.showCursor("pointer");
        }

        // Visually & vertically bump the stock
        var gotoAlpha = (this.#controls.visible) ? 1 : 0;
        this.#controls.alpha = this.#controls.alpha * 0.5 + gotoAlpha * 0.5;
    };

    /**********************************************************************/
    // PRIVATE METHODS
    /**********************************************************************/

    #wrapText(context, text, maxWidth) {
        var words = text.split(/\s+/);
        var lines = [];
        var currentLine = words[0];

        for (var i = 1; i < words.length; i++) {
            var word = words[i];
            var width = context.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }

    #isDarkColor(color) {
        if (!color || color.charAt(0) !== '#') return false;
        var r, g, b;
        if (color.length === 4) { // #RGB
            r = parseInt(color[1] + color[1], 16);
            g = parseInt(color[2] + color[2], 16);
            b = parseInt(color[3] + color[3], 16);
        } else { // #RRGGBB
            r = parseInt(color.substring(1, 3), 16);
            g = parseInt(color.substring(3, 5), 16);
            b = parseInt(color.substring(5, 7), 16);
        }
        var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5;
    }

    #reset() {
        this.#currentValue = this.#initialValue;
    }

    #sendSignal(signal) {
        var flows = this.#flows.outbound;
        for (var i = 0; i < flows.length; i++) {
            flows[i].addSignal(signal);
        }
    };

    generateId(id) {
        if (id !== undefined) {
            _validateTrue(!Stock.#stocks[id], "ID is already in use!");
        } else {
            do { id = Stock.#ID_COUNTER++; } while (Stock.#stocks[id]);
        }

        Stock.#stocks[id] = this;
        return id;
    }

    /**********************************************************************/
    // EVENT METHODS
    /**********************************************************************/
    #onModelReset(model) {
        this.#reset();
    }
    #onMouseDown(model, mouse) {
        if (!model.isPlaying()) return;

        this.#controls.pressed = this.#controls.selected;
        if (this.#controls.pressed) {
            var delta = this.#controls.direction * Stock.DEFAULT_SIGNAL_DELTA_MULTIPLIER;
            this.#currentValue += delta;

            this.#sendSignal({ delta: delta });
        }
    }
    #onMouseMove(model, mouse) {
        if (!model.isPlaying()) return;

        // Selection: Included when mouse is over stock OR resizing halo
        var inStock = this.isPointInStock(model.context, mouse.x, mouse.y);
        var inHalo = this.isPointInResizeZone(mouse.x, mouse.y);

        this.#controls.selected = (inStock || inHalo);
        this.#controls.visible = this.#controls.selected;
        this.#controls.direction = inStock ? (mouse.y < this.y) ? 1 : -1 : 0;
    }
    #onMouseUp(model, mouse) {
        if (!model.isPlaying()) return;

        this.#controls.pressed = false;
    }
}