class Stock extends Item {
    static DEFAULT_SIGNAL_DELTA_MULTIPLIER = 0.33;
    static DEFAULT_COLOR = "#EA3E3E";
    static #ID_COUNTER = 0;

    static get #DEFAULT_LABEL() { return "?"; }
    static get #DEFAULT_RADIUS() { return 60; };
    static get #DEFAULT_VALUE() { return 0.5; }
    static get #COLORS() {
        return {
            0: "#EA3E3E", // red
            1: "#EA9D51", // orange
            2: "#FEEE43", // yellow
            3: "#BFEE3F", // green
            4: "#7FD4FF", // blue
            5: "#A97FFF" // purple
        };
    }
    static #stocks = {};
    static getStock(id) { return Stock.#stocks[id]; }

    #id; #x; #y;
    #radius = Stock.#DEFAULT_RADIUS;
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
    get radius() { return this.#radius; }
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
    set radius(radius) { this.#radius = radius; }
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

        if (configuration.radius !== undefined) this.#radius = configuration.radius;
        if (configuration.label !== undefined) this.#label = configuration.label;
        if (configuration.initialValue !== undefined) {
            if (configuration.initialValue === "" || configuration.initialValue === null) {
                this.#initialValue = null;
            } else {
                this.#initialValue = parseFloat(configuration.initialValue);
            }
        }
        if (configuration.unit !== undefined) this.#unit = configuration.unit;

        // color / hue (compatibility)
        if (configuration.color !== undefined) {
            this.#color = configuration.color;
        } else if (configuration.hue !== undefined) {
            // map index if numeric, else use string
            if (typeof configuration.hue === "number" && Stock.#COLORS[configuration.hue]) {
                this.#color = Stock.#COLORS[configuration.hue];
            } else {
                this.#color = configuration.hue;
            }
        }

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
            left: this.x - this.radius,
            top: this.y - this.radius,
            right: this.x + this.radius,
            bottom: this.y + this.radius
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

    drawValue(context, color, r) {
        // radius is inverse tangent (in radians) (atan) of value
        var _r = Math.atan(this.#currentValue * 5);
        _r = _r / (Math.PI / 2);
        _r = (_r + 1) / 2;

        // INFINITE RANGE FOR RADIUS
        // linear from 0 to 1, asymptotic otherwise.
        var _value;
        if (this.#currentValue >= 0 && this.#currentValue <= 1) {
            // (0,1) -> (0.1, 0.9)
            _value = 0.1 + 0.8 * this.#currentValue;
        } else {
            if (this.#currentValue < 0) {
                // asymptotically approach 0, starting at 0.1
                _value = (1 / (Math.abs(this.#currentValue) + 1)) * 0.1;
            }
            if (this.#currentValue > 1) {
                // asymptotically approach 1, starting at 0.9
                _value = 1 - (1 / this.#currentValue) * 0.1;
            }
        }
        var _innerRadiusGoto = r * _value; // radius
        this.#innerRadius = (this.#innerRadius || 0) * 0.8 + _innerRadiusGoto * 0.2;

        this.drawValueShape(context, color, this.#innerRadius);
    }

    drawValueShape(context, color, innerSize) {
        _throwErrorMessage("drawValueShape not implemented in Stock base class");
    }

    drawLabel(context, r) {
        var isDark = this.isContentDark;
        var textColor = isDark ? "#FFF" : "#000";
        var subtextColor = isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)";
        var pillColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";

        var hasValue = (this.#initialValue !== null && !isNaN(this.#initialValue) && this.showValue);
        var radius = r / 2;
        var isCircle = !(this instanceof RectangleStock);

        // Helper for specialized geometry-aware width
        const getWidthAtY = (y) => {
            if (!isCircle) return r * 0.95;
            var absY = Math.abs(y);
            if (absY >= radius) return 0;
            return 2 * Math.sqrt(radius * radius - (absY * absY)) * 0.88;
        };

        // 1. DATA CENTER (Metric Card Style - Horizontal Density for Human Sight)
        var valueFontSize = hasValue ? (r * 0.26) : 0; // Value font size
        var valueY = hasValue ? radius * 0.55 : 0; // Pushed to the absolute lower rim to maximize gap

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
            var pillPaddingH = r * 0.12;
            var pillPaddingV = valueFontSize * 0.25;
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
        var requiredGap = hasValue ? (r * 0.12) : 0; // Much larger forced empty buffer

        // 2. CONTEXT HEADER (The Name - Equatorial Prioritization)
        var nameFontSize = hasValue ? (r * 0.42) : (r * 0.48); // Name font noticeably increased
        context.font = "bold " + nameFontSize + "px sans-serif";

        var lines = [];
        var lineSpacing = 0;
        var totalHeight = 0;

        while (nameFontSize > (r * 0.08) || nameFontSize > 10) {
            context.font = "bold " + nameFontSize + "px sans-serif";

            // Name center Y estimation
            var expectedCenterY = hasValue ? ((safePillY - requiredGap - radius * 0.85) / 2) : 0;
            var maxWidth = getWidthAtY(expectedCenterY);

            lines = this.#wrapText(context, this.label, maxWidth);
            lineSpacing = nameFontSize * 1.1;
            totalHeight = lines.length * lineSpacing;

            // Check if it fits in the available vertical space
            if (hasValue) {
                var spaceAvailable = (safePillY - requiredGap) - (-radius * 0.85);
                if (totalHeight <= spaceAvailable) {
                    break;
                }
            } else {
                if (totalHeight <= radius * 1.7) {
                    break;
                }
            }
            nameFontSize -= 1;
        }

        if (lines && lines.length > 0) {
            var startY;
            if (hasValue) {
                // Center exactly between the top curve and the pill, incorporating the MASSIVE gap
                var spaceTop = -radius * 0.85;
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
        this.#innerRadius = 0;

        this.#listeners.modelreset = subscribe("model/reset", function () { this.#onModelReset(model) }.bind(this));
        this.#listeners.mousedown = subscribe("mousedown", function () { this.#onMouseDown(model, mouse) }.bind(this));
        this.#listeners.mousemove = subscribe("mousemove", function () { this.#onMouseMove(model, mouse) }.bind(this));
        this.#listeners.mouseup = subscribe("mouseup", function () { this.#onMouseUp(model, mouse) }.bind(this));
    }

    isPointInStock(context, x, y, buffer) {
        _throwErrorMessage("isPointInStock not implemented in Stock base class");
    };

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

        // Cursor!
        if (this.#controls.selected) mouse.showCursor("pointer");

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

        this.#controls.selected = this.isPointInStock(model.context, mouse.x, mouse.y);
        this.#controls.visible = this.#controls.selected;
        this.#controls.direction = this.#controls.selected ? (mouse.y < this.y) ? 1 : -1 : 0;
    }
    #onMouseUp(model, mouse) {
        if (!model.isPlaying()) return;

        this.#controls.pressed = false;
    }
}