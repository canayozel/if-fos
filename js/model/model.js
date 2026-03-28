class Model {
    static get MODE_COMPOSE() { return 0; };
    static get MODE_PLAY() { return 1; };

    #texts = [];
    #stocks = [];
    #flows = [];
    #stroke = [];

    #dom;
    #canvas;
    #context;
    #embedded;
    #mode;
    #mouse;
    #padding;
    #offset;

    #dirty = false;
    #updated = false;
    #drawCountdownFull = 60; // two-second buffer
    #drawCountdown = this.#drawCountdownFull;

    get dirty() { return this.#dirty; }
    get embedded() { return this.#embedded; }

    set dirty(dirty) { return this.#dirty = dirty; }

    constructor(dom, mouse, configuration) {
        _validateAssigned(dom, "Model DOM must be provided.");
        _validateAssigned(mouse, "Mouse must be provided.");
        _validateAssigned(configuration, "Configuration object must be provided.");
        _validateAssigned(configuration.offset, "Offset information must be present in the configuration.");
        _validateAssigned(configuration.padding, "Padding information must be present in the configuration.");
        _validateTrue(configuration.initialMode === Model.MODE_COMPOSE || configuration.initialMode === Model.MODE_PLAY, "Initial mode must be present in the configuration.");
        _validateTrue(configuration.embedded !== undefined, "Embedded mode information must be present in the configuration.");

        this.#dom = dom
        this.#mouse = mouse

        this.#mode = configuration.initialMode
        this.#embedded = configuration.embedded;

        this.#offset = configuration.offset;
        this.#padding = configuration.padding;

        this.#canvas = _createCanvas(this.#dom);
        this.#context = this.#canvas.getContext("2d");

        subscribe("model/reset", () => { this.#drawCountdown = this.#drawCountdownFull; });
        subscribe("mousemove", () => { this.#drawCountdown = this.#drawCountdownFull; });
        subscribe("mousedown", () => { this.#drawCountdown = this.#drawCountdownFull; });
        subscribe("resize", () => { this.#drawCountdown = this.#drawCountdownFull; });
        subscribe("kill", (item) => { this.#removeItem(item) });
        subscribe("model/changed", (source) => {
            if (this.isComposing()) this.#drawCountdown = this.#drawCountdownFull;
            this.dirty = source == "stroke";
        });
        subscribe("tool/changed", (tool, grabbed) => {
            var postfix = grabbed ? "-grabbed" : "";
            this.#dom.setAttribute("cursor", tool + postfix);
            this.removeStroke();
        });
        subscribe("model/stock/shape", (stock, shape) => {
            this.replaceStock(stock, shape);
        });
    }

    autoSignal(signal) {
        if (signal && Array.isArray(signal) && signal.length == 2) {
            var stock = Stock.getStock(signal[0]);
            if (stock) {
                var direction = signal[1] && signal[1] > 0 ? 1 : -1;
                stock.takeSignal({ delta: direction * Stock.DEFAULT_SIGNAL_DELTA_MULTIPLIER });
            }
        }
    }

    center(scale) {
        if (this.#stocks.length == 0 && this.#texts.length == 0) return;

        var bounds = this.getBounds();
        var cx = (bounds.left + bounds.right) / 2;
        var cy = (bounds.top + bounds.bottom) / 2;

        if (scale) {
            var fitWidth = this.#dom.clientWidth - (2 * this.#padding.all);
            var fitHeight = this.#dom.clientHeight - this.#padding.bottom - this.#padding.all;

            this.#offset.x = (this.#padding.all + fitWidth) / 2 - cx;
            this.#offset.y = (this.#padding.all + fitHeight) / 2 - cy;

            var w = bounds.right - bounds.left;
            var h = bounds.bottom - bounds.top;
            var modelRatio = w / h;
            var screenRatio = fitWidth / fitHeight;

            // wider or taller than the screen ? wider : taller
            this.#offset.scale = modelRatio > screenRatio ? fitWidth / w : fitHeight / h;
        } else {
            var offsetX = (this.#dom.clientWidth + this.#padding.all) / 2 - cx;
            var offsetY = (this.#dom.clientHeight - this.#padding.bottom) / 2 - cy;

            // move all stocks
            for (var i = 0; i < this.#stocks.length; i++) {
                var stock = this.#stocks[i];
                stock.x += offsetX;
                stock.y += offsetY;
            }

            // move all texts
            for (var i = 0; i < this.#texts.length; i++) {
                var text = this.#texts[i];
                text.x += offsetX;
                text.y += offsetY;
            }
        }
    };

    clear() {
        while (this.#stocks.length > 0) {
            this.#stocks[0].kill();
        }

        while (this.#texts.length > 0) {
            this.#texts[0].kill();
        }
    };

    deserialize(animationConfiguration, data) {
        this.clear();

        var data = JSON.parse(data);

        var stocks = data[0];
        var flows = data[1];
        var texts = data[2];

        // stocks
        for (var i = 0; i < stocks.length; i++) {
            var stock = stocks[i];
            this.addStock(animationConfiguration, {
                id: stock[0],
                x: stock[1],
                y: stock[2],
                initialValue: stock[3],
                label: decodeURIComponent(stock[4]),
                hue: stock[5],
                shape: stock[6],
                unit: stock[7] ? decodeURIComponent(stock[7]) : ""
            });
        }

        // flows
        for (var i = 0; i < flows.length; i++) {
            var flow = flows[i];
            this.addFlow(animationConfiguration, {
                source: Stock.getStock(flow[0]),
                target: Stock.getStock(flow[1]),
                arc: flow[2],
                strength: flow[3],
                rotation: flow[4]
            });
        }

        // texts
        for (var i = 0; i < texts.length; i++) {
            var text = texts[i];
            this.addText(animationConfiguration, {
                x: text[0],
                y: text[1],
                value: decodeURIComponent(text[2])
            });
        }

        this.dirty = false;
    };

    draw(configuration) {
        if (this.#mouse.pressed && this.#stroke.length > 0) { // stroke
            var lastPoint = this.#stroke[this.#stroke.length - 1];

            // style
            this.#context.strokeStyle = "#ccc";
            this.#context.lineWidth = 5;
            this.#context.lineCap = "round";

            // draw line from last to current
            this.#context.beginPath();
            this.#context.moveTo(lastPoint[0] * 2, lastPoint[1] * 2);
            this.#context.lineTo(this.#mouse.x * 2, this.#mouse.y * 2);
            this.#context.stroke();

            // update last point
            this.#stroke.push([this.#mouse.x, this.#mouse.y]);

            return;
        }

        // draw model only if arrow-signals are moving
        for (var i = 0; i < this.#flows.length; i++) {
            if (this.#flows[i].signals.length > 0) {
                this.#drawCountdown = this.#drawCountdownFull;
                break;
            }
        }

        this.#drawCountdown--;
        if (this.#drawCountdown <= 0) return;

        // also only draw if updated
        if (!this.#updated) return;
        this.#updated = false;

        // clear & save
        this.#context.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
        this.#context.save();

        // translate to center, (translate, scale, translate) to expand to size
        var CW = this.#dom.clientWidth - (2 * this.#padding.all);
        var CH = this.#dom.clientHeight - this.#padding.bottom - this.#padding.all;
        var tx = this.#offset.x * 2;
        var ty = this.#offset.y * 2;
        var s = this.#offset.scale

        tx -= CW + this.#padding.all;
        ty -= CH + this.#padding.all;
        tx = s * tx;
        ty = s * ty;
        tx += CW + this.#padding.all;
        ty += CH + this.#padding.all;

        if (this.#embedded) { // dunno why but this is needed
            tx += this.#padding.all;
            ty += this.#padding.all;
        }

        this.#context.setTransform(s, 0, 0, s, tx, ty);

        // draw all
        try {
            for (var i = 0; i < this.#texts.length; i++) this.#texts[i].draw(this.#context, configuration);
            for (var i = 0; i < this.#flows.length; i++) this.#flows[i].draw(this.#context, configuration);
            for (var i = 0; i < this.#stocks.length; i++) this.#stocks[i].draw(this.#context, configuration);
        } catch (e) {
            console.error("Draw loop error:", e);
        }

        // restore
        this.#context.restore();
    };

    getBounds() {
        if (this.#stocks.length == 0 && this.#texts.length == 0) return;

        // get bounds of all objects
        var left = Infinity;
        var top = Infinity;
        var right = -Infinity;
        var bottom = -Infinity;

        var processItems = function (items) {
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var bounds = item.getBoundingBox(this.#context);
                if (left > bounds.left) left = bounds.left;
                if (top > bounds.top) top = bounds.top;
                if (right < bounds.right) right = bounds.right;
                if (bottom < bounds.bottom) bottom = bounds.bottom;
            }
        }.bind(this);

        processItems(this.#stocks);
        processItems(this.#flows);
        processItems(this.#texts);

        return {
            left: left,
            top: top,
            right: right,
            bottom: bottom
        };

    };

    isComposing() {
        return this.#mode == Model.MODE_COMPOSE;
    }

    isPlaying() {
        return this.#mode == Model.MODE_PLAY;
    }

    serialize() {
        var data = []; // 0: stocks, 1: flows, 2: labels, 3: UID

        // stocks
        var stocks = [];
        for (var i = 0; i < this.#stocks.length; i++) {
            var stock = this.#stocks[i];

            // 0: id, 1: x, 2: y, 3: initialValue, 4: label, 5: color, 6: shape, 7: unit
            stocks.push([
                stock.id,
                Math.round(stock.x),
                Math.round(stock.y),
                stock.initialValue,
                encodeURIComponent(encodeURIComponent(stock.label)),
                stock.color,
                stock instanceof RectangleStock ? 1 : 0,
                encodeURIComponent(encodeURIComponent(stock.unit))
            ]);
        }

        // flows
        var flows = [];
        for (var i = 0; i < this.#flows.length; i++) {
            var flow = this.#flows[i];

            // 0: from, 1: to, 2: arc, 3: stregth, 4: rotation
            flows.push([
                flow.source.id,
                flow.target.id,
                Math.round(flow.arc),
                flow.strength,
                flow.isLoop() ? Math.round(flow.rotation) : null
            ]);
        }

        // Labels
        var texts = [];
        for (var i = 0; i < this.#texts.length; i++) {
            var text = this.#texts[i];

            // 0: x, 1: y, 2: value
            texts.push([
                Math.round(text.x),
                Math.round(text.y),
                encodeURIComponent(encodeURIComponent(text.value))
            ]);
        }

        data.push(stocks);
        data.push(flows);
        data.push(texts);

        // only uri encode quotes, also replace the last character
        var dataString = JSON.stringify(data);
        dataString = dataString.replace(/"/gi, "%22");
        dataString = dataString.substring(0, dataString.length - 1) + "%5D";
        return dataString;
    };

    setMode(mode) {
        this.#mode = mode;
        if (this.isComposing()) {
            publish("model/reset");
            this.#drawCountdown = this.#drawCountdownFull * 2;
        } else {
            this.#drawCountdown = this.#drawCountdownFull;
        }

        publish("model/mode/changed");
    }

    update(configuration) {
        _configureProperties(configuration, configuration, {
            isPlaying: this.isPlaying()
        });

        for (var i = 0; i < this.#texts.length; i++) {
            this.#texts[i].update(this.#mouse, configuration);
        }

        for (var i = 0; i < this.#flows.length; i++) {
            this.#flows[i].update(this.#mouse, configuration);
        }

        for (var i = 0; i < this.#stocks.length; i++) {
            this.#stocks[i].update(this.#mouse, configuration);
        }

        this.#updated = true;
    };
    //**********************************************************************/
    // ITEM METHODS
    /**********************************************************************/
    addFlow(animationConfiguraiton, flowConfiguration) {
        var flow = new Flow(flowConfiguration);
        flow.initialize(this, this.#mouse);

        this.#flows.push(flow);

        publish("model/changed");

        return flow;
    };

    addStock(animationConfiguraiton, stockConfiguration) {
        var stock;
        if (stockConfiguration.shape === 1 || stockConfiguration.shape === "rectangle") {
            stock = new RectangleStock(stockConfiguration);
        } else {
            stock = new CircleStock(stockConfiguration);
        }
        stock.initialize(this, this.#mouse);

        this.#stocks.push(stock)
        this.update(animationConfiguraiton);

        publish("model/changed");

        return stock;
    }

    addStroke(stroke) {
        this.#stroke.push(stroke)

        publish("model/changed");
    }

    addText(animationConfiguraiton, textConfiguration) {
        var text = new Text(textConfiguration);
        text.initialize(this, this.#mouse);

        this.#texts.push(text)
        this.update(animationConfiguraiton);

        publish("model/changed");

        return text;
    };

    getStroke() {
        return this.#stroke;
    };

    getFlowByCoordinates(x, y, buffer) {
        for (var i = this.#flows.length - 1; i >= 0; i--) { // top-down
            var flow = this.#flows[i];
            if (flow.isPointOnLabel(x, y, buffer)) return flow;
        }
        return null;
    };

    getFlowsByStartStock(startStock) {
        return this.#flows.filter(function (flow) {
            return (flow.from === startStock);
        });
    };

    getStockByCoordinates(x, y, buffer) {
        for (var i = this.#stocks.length - 1; i >= 0; i--) { // top-down
            var stock = this.#stocks[i];
            if (stock.isPointInStock(this.#context, x, y, buffer)) return stock;
        }
        return null;
    };

    getTextByCoordinates(x, y, buffer) {
        for (var i = this.#texts.length - 1; i >= 0; i--) { // top-down
            var text = this.#texts[i];
            if (text.isPointInText(this.#context, x, y)) return text;
        }
        return null;
    };

    removeFlow(flow) {
        var index = this.#flows.indexOf(flow);
        if (index === -1) return;
        this.#flows.splice(index, 1);

        publish("model/changed");
    };

    removeStock(stock) {
        var index = this.#stocks.indexOf(stock);
        if (index === -1) return;
        this.#stocks.splice(index, 1);

        // Remove all associated TO and FROM flows
        for (var i = 0; i < this.#flows.length; i++) {
            var flow = this.#flows[i];
            if (flow.isAssociated(stock)) {
                flow.kill();
                i--; // move index back, because it's been killed
            }
        }
        publish("model/changed");
    };

    removeStroke() {
        this.#stroke = [];

        publish("model/changed", [true]);
    }

    removeText(text) {
        var index = this.#texts.indexOf(text);
        if (index === -1) return;
        this.#texts.splice(index, 1);

        publish("model/changed");
    };

    replaceStock(stock, shape) {
        var stockConfiguration = {
            id: stock.id,
            x: stock.x,
            y: stock.y,
            label: stock.label,
            color: stock.color,
            initialValue: stock.initialValue,
            unit: stock.unit,
            shape: shape
        };

        var index = this.#stocks.indexOf(stock);

        // RELEASE the ID before creating the new stock
        stock.kill(true);

        var newStock;
        if (shape === 1 || shape === "rectangle") {
            newStock = new RectangleStock(stockConfiguration);
        } else {
            newStock = new CircleStock(stockConfiguration);
        }
        newStock.initialize(this, this.#mouse);

        // Update #stocks array
        if (index !== -1) {
            this.#stocks[index] = newStock;
        } else {
            this.#stocks.push(newStock);
        }

        // Swap in flows - using ID comparison for robustness
        for (var i = 0; i < this.#flows.length; i++) {
            var flow = this.#flows[i];
            if (flow.source.id === stockConfiguration.id) {
                flow.source = newStock;
            }
            if (flow.target.id === stockConfiguration.id) {
                flow.target = newStock;
            }
        }

        publish("model/stock/replaced", [newStock]);
        publish("model/changed");
        return newStock;
    }

    /**********************************************************************/
    // PRIVATE METHODS
    /**********************************************************************/
    #removeItem(item) {
        if (item.type == Item.TEXT) {
            this.removeText(item);
        } else if (item.type == Item.STOCK) {
            this.removeStock(item);
        } else if (item.type == Item.FLOW) {
            this.removeFlow(item);
        }
    }
}