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
        context.translate(x, y + this.#offset.main);

        // highlight selected
        if (this.selected) {
            this.drawHighlight(context, r);
        }

        // draw base shape
        this.drawShape(context, color, r);

        // label
        this.drawLabel(context, r);

        // controls
        this.drawControls(context, configuration);

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
        var isDark = this.isContentDark;
        var textColor = isDark ? "#FFF" : "#000";
        var subtextColor = isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)";
        var pillColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";

        var hasValue = (this.#initialValue !== null && !isNaN(this.#initialValue) && this.showValue);
        var halfWidth = r / 2;
        var halfHeight = this.height / 2;
        var isCircle = !(this instanceof RectangleStock);

        // Unified Scaling Engine: Base all font decisions on the actual visual room (min of width/height)
        var effectiveRadius = isCircle ? halfWidth : Math.min(halfWidth, halfHeight);
        var r_scale = effectiveRadius * 2;

        // Helper for specialized geometry-aware width
        const getWidthAtY = (y) => {
            if (!isCircle) return r * 0.95;
            var absY = Math.abs(y);
            if (absY >= halfWidth) return 0;
            return 2 * Math.sqrt(halfWidth * halfWidth - (absY * absY)) * 0.88;
        };

        // 1. DATA CENTER (Metric Card Style)
        var valueFontSize = hasValue ? (r_scale * 0.28) : 0; 
        var valueY = hasValue ? (halfHeight * 0.45) : 0; 

        if (hasValue) {
            context.font = "bold " + valueFontSize + "px sans-serif";
            var displayValue = Math.round(this.#currentValue * 100) / 100;
            var valueText = displayValue.toString();
            var unitFontSize = Math.max(10, valueFontSize * 0.65);
            var unitText = this.unit ? (" " + this.unit) : "";

            // Calculate widths
            var valW = context.measureText(valueText).width;
            context.font = "bold " + unitFontSize + "px sans-serif";
            var unitW = this.unit ? context.measureText(unitText).width : 0;
            var combinedW = valW + unitW;

            var maxWidth = getWidthAtY(valueY);

            // Auto scale combined horizontal text
            while (combinedW > maxWidth && valueFontSize > (r * 0.1)) {
                valueFontSize -= 1;
                unitFontSize = Math.max(10, valueFontSize * 0.65);

                context.font = "bold " + valueFontSize + "px sans-serif";
                valW = context.measureText(valueText).width;
                context.font = "bold " + unitFontSize + "px sans-serif";
                unitW = this.unit ? context.measureText(unitText).width : 0;
                combinedW = valW + unitW;
            }

            // Draw THE PILL (Visual Island - Horizontal)
            var pillPaddingH = r * 0.1;
            var pillPaddingV = valueFontSize * 0.2;
            var pillW = combinedW + pillPaddingH * 2;
            var pillH = valueFontSize + pillPaddingV * 2;

            var pillTop = valueY - (valueFontSize / 2) - pillPaddingV;
            var pillX = -pillW / 2;
            var pillY = pillTop;
            var pillR = isCircle ? Math.min(pillH / 2, r * 0.15) : (r * 0.08);

            context.beginPath();
            context.roundRect(pillX, pillY, pillW, pillH, pillR);
            context.fillStyle = pillColor;
            context.fill();

            // VALUE + UNIT (Side by Side layout)
            var startX = -combinedW / 2;

            context.font = "bold " + valueFontSize + "px sans-serif";
            context.fillStyle = textColor;
            context.textAlign = "left";      // Left align so they fit next to each other
            context.textBaseline = "middle";
            context.fillText(valueText, startX, valueY);

            if (this.unit) {
                context.font = "bold " + unitFontSize + "px sans-serif";
                context.fillStyle = subtextColor;
                context.fillText(unitText, startX + valW, valueY + (valueFontSize - unitFontSize) * 0.1);
            }
        }

        // pillY is used as the boundary for the name above it
        var safePillY = hasValue ? pillY : 0; 
        var requiredGap = hasValue ? (halfHeight * 0.15) : 0; // Height-aware gap!
        var topLimit = -halfHeight * 0.85;

        // 2. CONTEXT HEADER (Synchronized Growth Logic)
        var nameFontSize = r_scale * 0.28; 
        context.font = "bold " + nameFontSize + "px sans-serif";

        var lines = [];
        var lineSpacing = 0;
        var totalHeight = 0;

        while (nameFontSize > (r * 0.08) || nameFontSize > 10) {
            context.font = "bold " + nameFontSize + "px sans-serif";
            
            // Expected center for multi-line layout
            var spaceAvailable = hasValue ? (safePillY - requiredGap - topLimit) : (halfHeight * 1.7);
            var expectedCenterY = hasValue ? (topLimit + spaceAvailable / 2) : 0;
            var maxWidth = getWidthAtY(expectedCenterY);

            lines = this.#wrapText(context, this.label, maxWidth);
            lineSpacing = nameFontSize * 1.1;
            totalHeight = lines.length * lineSpacing;

            // Check if it fits in the available vertical space
            if (hasValue) {
                if (totalHeight <= spaceAvailable) {
                    break;
                }
            } else {
                if (totalHeight <= halfHeight * 1.7) {
                    break;
                }
            }
            nameFontSize -= 1;
        }

        if (lines && lines.length > 0) {
            var startY;
            if (hasValue) {
                // Original perfect centering
                var spaceTop = topLimit;
                var spaceBottom = safePillY - requiredGap;
                var spaceCenter = (spaceTop + spaceBottom) / 2;
                startY = spaceCenter - (totalHeight / 2) + (lineSpacing / 2);
            } else {
                startY = 0 - (totalHeight / 2) + (lineSpacing / 2);
            }

            context.fillStyle = subtextColor; // Consistently use premium styling for the Name
            context.textAlign = "center";
            context.textBaseline = "middle";
            for (var i = 0; i < lines.length; i++) {
                context.fillText(lines[i], 0, startY + i * lineSpacing);
            }
        }
    }

    drawControls(context, configuration) {
        // WOBBLE CONTROLS
        var cl = 40;
        var cy = 0;
        if (configuration.wobble > 0) {
            var wobble = configuration.wobble * (Math.TAU / 30);
            cy = Math.abs(Math.sin(wobble)) * 10;
        }

        // controls
        context.globalAlpha = this.#controls.alpha;
        context.strokeStyle = "rgba(0,0,0,0.8)";
        // top arrow
        context.beginPath();
        context.moveTo(-cl, -cy - cl);
        context.lineTo(0, -cy - cl * 2);
        context.lineTo(cl, -cy - cl);
        context.lineWidth = (this.#controls.direction > 0) ? 10 : 3;
        context.stroke();
        // bottom arrow
        context.beginPath();
        context.moveTo(-cl, cy + cl);
        context.lineTo(0, cy + cl * 2);
        context.lineTo(cl, cy + cl);
        context.lineWidth = (this.#controls.direction < 0) ? 10 : 3;
        context.stroke();
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
        var highlightRadius = this.radius + 40;
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
        this.#offset.vel -= 6 * (signal.delta / Math.abs(signal.delta));

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
        if (configuration.isPlaying && this.#controls.pressed) {
            this.#offset.goTo = -this.#controls.direction * 20; // by 20 pixels
        } else {
            this.#offset.goTo = 0;
        }
        this.#offset.main += this.#offset.vel;
        if (this.#offset.main > 40) this.#offset.main = 40
        if (this.#offset.main < -40) this.#offset.main = -40;
        this.#offset.vel += this.#offset.acc;
        this.#offset.vel *= this.#offset.damp;
        this.#offset.acc = (this.#offset.goTo - this.#offset.main) * this.#offset.hookes;
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