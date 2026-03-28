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

    #initialValue = Stock.#DEFAULT_VALUE;
    #currentValue;

    get id() { return this.#id; }
    get x() { return this.#x; }
    get y() { return this.#y; }
    get radius() { return this.#radius; }
    get label() { return this.#label; }
    get color() { return this.#color; }
    get initialValue() { return this.#initialValue; }
    get shape() { return this instanceof RectangleStock ? 1 : 0; }

    set x(x) { this.#x = x; }
    set y(y) { this.#y = y; }
    set radius(radius) { this.#radius = radius; }
    set label(label) { this.#label = label; }
    set color(color) { this.#color = color; }
    set initialValue(initialValue) { this.#initialValue = initialValue; }
    set shape(value) { publish("model/stock/shape", [this, value]); }

    constructor(configuration) {
        super(Item.STOCK, configuration);

        _validateTrue(configuration.x && configuration.x >= 0, "X axis coordinate 'x' must be provided in configuration as a non-negative number.");
        _validateTrue(configuration.y && configuration.y >= 0, "Y axis coordinate 'y' must be provided in configuration as a non-negative number.");

        this.x = configuration.x;
        this.y = configuration.y;

        if (configuration.radius !== undefined) this.#radius = configuration.radius;
        if (configuration.label !== undefined) this.#label = configuration.label;
        if (configuration.initialValue !== undefined) this.#initialValue = configuration.initialValue;

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

        // inner colored value bubble
        this.drawValue(context, color, r);

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
        var fontsize = 40;
        context.font = "normal " + fontsize + "px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = "#000";
        var width = context.measureText(this.#label).width;
        while (width > r * 2 - 30) { // -30 for buffer. HACK: HARD-CODED.
            fontsize -= 1;
            context.font = "normal " + fontsize + "px sans-serif";
            width = context.measureText(this.#label).width;
        }
        context.fillText(this.#label, 0, 0);
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
        this.#flows.inbound.splice(this.#flows.inbound.indexOf(flow), 1);
    }

    removeOutboundFlow(flow) {
        this.#flows.outbound.splice(this.#flows.outbound.indexOf(flow), 1);
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