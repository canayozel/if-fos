class Node extends Item {
    static DEFAULT_SIGNAL_DELTA_MULTIPLIER = 0.33;
    static DEFAULT_COLOR = "#EA3E3E";
    static ID_COUNTER = 0;

    static DEFAULT_LABEL = "?";
    static DEFAULT_RADIUS = 60;
    static nodes = {};
    static getNode(id) { return Node.nodes[id]; }

    #id; #x; #y;
    #width = Node.DEFAULT_RADIUS * 2;
    #height = Node.DEFAULT_RADIUS * 2;
    #label = Node.DEFAULT_LABEL;
    #color = Node.DEFAULT_COLOR;

    #controls = { visible: false, alpha: 0, direction: 0, selected: false, pressed: false }
    #offset = { main: 0, goTo: 0, vel: 0, acc: 0, damp: 0, hookes: 0 }
    #listeners = { modelreset: null, mousedown: null, mousemove: null, mouseup: null }
    #flows = { inbound: [], outbound: [] }
    #innerRadius;

    #fontSize = 20;

    get id() { return this.#id; }
    get x() { return this.#x; }
    get y() { return this.#y; }
    get width() { return this.#width; }
    get height() { return this.#height; }
    get radius() { return this.width / 2; }
    get label() { return this.#label; }
    get color() { return this.#color; }
    get fontSize() { return this.#fontSize; }
    get showValue() { return false; } // Value-less by default (Sink etc)
    get isContentDark() { return this.#isDarkColor(this.color); }
    get shape() {
        if (typeof StockRectangle !== "undefined" && this instanceof StockRectangle) return 1;
        if (typeof Sink !== "undefined" && this instanceof Sink) return 2;
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
    set fontSize(v) {
        v = parseFloat(v) || 20;
        if (v > 0 && v < 5) v = Math.round(v * 20);
        this.#fontSize = v;
    }
    set shape(value) { publish("model/node/shape", [this, value]); }

    constructor(configuration) {
        super(Item.NODE, configuration);

        _validateTrue(configuration.x !== undefined && configuration.x >= 0, "X axis coordinate 'x' must be provided in configuration as a non-negative number.");
        _validateTrue(configuration.y !== undefined && configuration.y >= 0, "Y axis coordinate 'y' must be provided in configuration as a non-negative number.");

        this.x = configuration.x;
        this.y = configuration.y;

        if (configuration.width !== undefined) this.#width = configuration.width;
        if (configuration.height !== undefined) {
            this.#height = configuration.height;
        } else if (configuration.width !== undefined) {
            this.#height = (this instanceof StockRectangle) ? this.#width * 0.75 : this.#width;
        }

        if (this.#width !== undefined && !(this instanceof StockRectangle)) {
            this.#height = this.#width;
        }

        if (configuration.radius !== undefined) {
            this.#width = configuration.radius * 2;
            this.#height = (this instanceof StockRectangle) ? this.#width * 0.75 : this.#width;
        }
        if (configuration.label !== undefined) this.#label = configuration.label;

        if (configuration.fontSize !== undefined) this.fontSize = configuration.fontSize;

        this.#color = configuration.color || configuration.hue || Node.DEFAULT_COLOR;
        if (typeof this.#color === "number") this.#color = Node.DEFAULT_COLOR;

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

        if (this.selected) {
            this.drawHighlight(context, r);
        }

        this.drawShape(context, color, r);
        this.drawLabel(context, r * 2);
        context.restore();
    }

    drawHighlight(context, r) {
        _throwErrorMessage("drawHighlight not implemented in Node base class");
    }

    drawShape(context, color, r) {
        _throwErrorMessage("drawShape not implemented in Node base class");
    }

    drawLabel(context, diameter) {
        const isDark = this.isContentDark;
        const textColor = isDark ? "#FFF" : "#000";
        const subtextColor = isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)";
        const pillColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";

        const label = this.label;
        const unit = this.unit || "";
        const hasAmount = (this.showValue && this.initialValue !== null && !isNaN(this.initialValue));

        const isCircle = !(this instanceof StockRectangle);
        const LS = this.fontSize * 2;
        const US = Math.max(11, LS * 0.7);
        const padding = 12;

        const getWidthAtY = (y, h, totalH) => {
            const maxW = diameter - padding;
            if (!isCircle) return maxW;
            const safeR = (diameter / 2) - (padding / 2);
            const absY = Math.max(Math.abs(y - h / 2), Math.abs(y + h / 2));
            if (absY >= safeR) return 0;
            return 2 * Math.sqrt(safeR * safeR - (absY * absY));
        };

        const lSpac = LS * (isCircle ? 0.9 : 1.0);
        const gap = hasAmount ? (LS * (isCircle ? 0.05 : 0.1)) : 0;
        const pillH = hasAmount ? (LS * 1.44) : 0;

        context.font = "bold " + LS + "px 'Inter', sans-serif";

        const wrap = (totalH) => {
            const words = label.split(/\s+/);
            const lines = [];
            let currentLine = words[0];
            let startY = -totalH / 2;
            for (let i = 1; i < words.length; i++) {
                const y = startY + (lines.length * lSpac) + (lSpac / 2);
                const limit = getWidthAtY(y, lSpac, totalH);
                if (context.measureText(currentLine + " " + words[i]).width <= limit) {
                    currentLine += " " + words[i];
                } else {
                    lines.push(currentLine);
                    currentLine = words[i];
                }
            }
            if (currentLine !== undefined) lines.push(currentLine);
            return lines;
        };

        let lines = [label];
        let totalH = (lines.length * lSpac) + gap + pillH;
        for (let pass = 0; pass < 2; pass++) {
            lines = wrap(totalH);
            totalH = (lines.length * lSpac) + gap + pillH;
        }

        const sTop = -totalH / 2;
        context.textAlign = "center";
        context.textBaseline = "middle";

        context.fillStyle = subtextColor;
        context.font = "bold " + LS + "px 'Inter', sans-serif";
        for (let i = 0; i < lines.length; i++) {
            const y = sTop + (i * lSpac) + (lSpac / 2);
            context.fillText(lines[i], 0, y);
        }

        if (hasAmount) {
            const centerY = (sTop + totalH) - (pillH / 2);
            const dVal = Math.round(this.currentValue * 100) / 100;
            
            context.font = "bold " + LS + "px 'Inter', sans-serif";
            const vW = context.measureText(dVal).width;
            context.font = "bold " + US + "px 'Inter', sans-serif";
            const uTxt = unit ? (" " + unit) : "";
            const uW = unit ? context.measureText(uTxt).width : 0;
            const fullW = vW + uW;

            const pw = fullW + diameter * 0.15;
            const px = -pw / 2, py = centerY - pillH / 2;
            const pr = isCircle ? Math.min(pillH / 2, diameter * 0.1) : (diameter * 0.08);

            context.beginPath();
            context.roundRect(px, py, pw, pillH, pr);
            context.fillStyle = pillColor;
            context.fill();

            const sx = -fullW / 2;
            context.textAlign = "left";
            context.font = "bold " + LS + "px 'Inter', sans-serif";
            context.fillStyle = textColor;
            context.fillText(dVal, sx, centerY);

            if (unit) {
                context.font = "bold " + US + "px 'Inter', sans-serif";
                context.fillStyle = subtextColor;
                context.fillText(uTxt, sx + vW, centerY);
            }
        }
    }


    reset() {
        // base node has no internal value to reset
    }

    initialize(model, mouse) {
        this.reset();

        this.#listeners.modelreset = subscribe("model/reset", function () { this.#onModelReset(model) }.bind(this));
        this.#listeners.mousedown = subscribe("mousedown", function () { this.#onMouseDown(model, mouse) }.bind(this));
        this.#listeners.mousemove = subscribe("mousemove", function () { this.#onMouseMove(model, mouse) }.bind(this));
        this.#listeners.mouseup = subscribe("mouseup", function () { this.#onMouseUp(model, mouse) }.bind(this));
    }

    isPointInNode(context, x, y, buffer) {
        _throwErrorMessage("isPointInNode not implemented in Node base class");
    };

    isPointInResizeZone(x, y) {
        var highlightRadius = this.radius + 10;
        var inHighlight = _isPointInCircle(x, y, this.x, this.y, highlightRadius);
        var inNode = this.isPointInNode(null, x, y, 0);
        return inHighlight && !inNode;
    };

    getBoundaryOffset(angle) {
        return this.radius;
    }

    kill(silent) {
        unsubscribe("model/reset", this.#listeners.modelreset);
        unsubscribe("mousedown", this.#listeners.mousedown);
        unsubscribe("mousemove", this.#listeners.mousemove);
        unsubscribe("mouseup", this.#listeners.mouseup);

        delete Node.nodes[this.id];

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
        this.sendSignal(signal);
    };

    update(mouse, configuration) {
        if (!configuration.isPlaying) {
            this.reset();
        }

        if (configuration.isPlaying && this.#controls.selected) {
            mouse.showCursor("pointer");
        }

        var gotoAlpha = (this.#controls.visible) ? 1 : 0;
        this.#controls.alpha = this.#controls.alpha * 0.5 + gotoAlpha * 0.5;
    };

    #isDarkColor(color) {
        if (!color || color.charAt(0) !== '#') return false;
        var r, g, b;
        if (color.length === 4) {
            r = parseInt(color[1] + color[1], 16);
            g = parseInt(color[2] + color[2], 16);
            b = parseInt(color[3] + color[3], 16);
        } else {
            r = parseInt(color.substring(1, 3), 16);
            g = parseInt(color.substring(3, 5), 16);
            b = parseInt(color.substring(5, 7), 16);
        }
        var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5;
    }

    sendSignal(signal) {
        var flows = this.#flows.outbound;
        for (var i = 0; i < flows.length; i++) {
            flows[i].addSignal(signal);
        }
    };

    generateId(id) {
        if (id !== undefined) {
            _validateTrue(!Node.nodes[id], "ID is already in use!");
        } else {
            do { id = Node.ID_COUNTER++; } while (Node.nodes[id]);
        }

        Node.nodes[id] = this;
        return id;
    }

    #onModelReset(model) {
        this.reset();
    }

    #onMouseDown(model, mouse) {
        if (!model.isPlaying()) return;

        this.#controls.pressed = this.#controls.selected;
        if (this.#controls.pressed) {
            var delta = this.#controls.direction * Node.DEFAULT_SIGNAL_DELTA_MULTIPLIER;
            if (typeof Stock !== "undefined" && this instanceof Stock) {
                this.takeSignal({ delta: delta });
            } else {
                this.sendSignal({ delta: delta });
            }
        }
    }

    #onMouseMove(model, mouse) {
        if (!model.isPlaying()) return;

        var inNode = this.isPointInNode(model.context, mouse.x, mouse.y);
        var inHalo = this.isPointInResizeZone(mouse.x, mouse.y);

        this.#controls.selected = (inNode || inHalo);
        this.#controls.visible = this.#controls.selected;
        this.#controls.direction = inNode ? (mouse.y < this.y) ? 1 : -1 : 0;
    }

    #onMouseUp(model, mouse) {
        if (!model.isPlaying()) return;

        this.#controls.pressed = false;
    }
}
