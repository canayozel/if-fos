class FOS {
    static get #DEFAULT_ANIMATION_SPEED() { return 3; };

    #configuration;
    #padding = { all: 25, bottom: 110 };
    #fps = 1000 / 30; // 30 FPS

    #elements = {};
    #resizing = null;
    #lockMode = null;

    constructor(dom, configuration) {
        FOS.#registerGlobalParameters();

        _validateAssigned(dom, "Parent dom to build the simulator must be provided in the configuration.");
        _validateAssigned(configuration, "Configuration object must be provided.");

        // configuration
        this.#configuration = configuration;
        FOS.#initializeConfigurationParameter(this.#configuration, "embedded", false, FOS.#booleanParser, FOS.#booleanTypeChecker);
        FOS.#initializeConfigurationParameter(this.#configuration, "ui", true, FOS.#booleanParser, FOS.#booleanTypeChecker);
        FOS.#initializeConfigurationParameter(this.#configuration, "autoSignal", true, FOS.#arrayParser, Array.isArray);
        FOS.#initializeConfigurationParameter(this.#configuration, "animationSpeed", FOS.#DEFAULT_ANIMATION_SPEED, parseInt, parameter => typeof parameter == "number");

        // initialize parameters
        const offset = { x: 0, y: 0, scale: 1 };
        if (this.#configuration.embedded && !this.#configuration.ui) {
            this.#padding.bottom = this.#padding.all;
        }

        // initialize html elements
        this.#createHTMLElements(dom);

        // mouse
        this.mouse = new Mouse(this.#elements.simulator, {
            offset: offset,
            padding: this.#padding,
            embedded: this.#configuration.embedded
        });

        // model
        this.model = new Model(this.#elements.simulator, this.mouse, {
            initialMode: Model.MODE_COMPOSE,
            offset: offset,
            padding: this.#padding,
            embedded: this.#configuration.embedded
        });

        // toolbar, sidebar & playbar
        this.toolbar = new Toolbar(this.#elements.toolbar);
        this.sidebar = new Sidebar(this.#elements.sidebar);
        this.playbar = new Playbar(this.#elements.playbar, this.#createPlaybarConfiguration());
        this.modal = new Modal(this.#elements.modal, this.#createModalConfiguration());

        this.#registerTextTool();
        this.#registerEraseTool();
        this.#registerMoveTool();
        this.#registerPenTool();

        subscribe("resize", function () { this.model.center(this.#configuration.embedded) }.bind(this));
        subscribe("export/file", function () { this.#saveToFile() }.bind(this));
        subscribe("import/file", function () { this.#loadFromFile() }.bind(this));

        subscribe("model/mode/changed", function () {
            if (this.model.isPlaying()) {
                this.playbar.showPage(Playbar.PAGE_ID_PLAY);
                this.sidebar.showPage(Sidebar.PAGE_ID_DEFAULT);
                this.sidebar.setAttribute("mode", "play");
                this.toolbar.hide();
                this.#elements.simulator.removeAttribute("cursor");
            } else if (this.model.isComposing()) {
                this.playbar.showPage(Playbar.PAGE_ID_COMPOSE);
                this.sidebar.showPage(Sidebar.PAGE_ID_DEFAULT);
                this.sidebar.setAttribute("mode", "compose");
                this.toolbar.show();
                this.#elements.simulator.setAttribute("cursor", this.toolbar.currentTool);
            }
        }.bind(this));
    }

    async run() {
        try {
            await this.#loadFromURL(); // try to load from URL
        } catch (e) {
            console.error("Error loading simulation from URL:", e);
        }

        setInterval(function () {
            if (!this.modal.open) {
                this.model.update(this.#getAnimationConfiguration());

                // Central Compose-mode Cursor Management
                if (this.model.isComposing() && this.toolbar.currentTool === Toolbar.TOOL_MOVE) {
                    const target = this.sidebar.currentPage.target;

                    // If actively resizing OR hovering an editable node's halo
                    if (this.#resizing || (target && target.type === Item.NODE && target.isPointInResizeZone(this.mouse.x, this.mouse.y))) {
                        var cursor = "nwse-resize";

                        // Reference coordinates relative to the node center
                        var focusNode = this.#resizing || target;
                        var dx = this.mouse.x - focusNode.x;
                        var dy = this.mouse.y - focusNode.y;

                        // Decide on 'Inclination' for diagonal corners
                        // (isRight && !isBottom) OR (isLeft && isBottom) => nesw-resize ( / )
                        // Otherwise => nwse-resize ( \ )
                        var isRightSide = dx > 0;
                        var isBottomSide = dy > 0;
                        var diagonal = (isRightSide !== isBottomSide) ? "nesw-resize" : "nwse-resize";

                        if (this.#resizing) {
                            // Active drag mode takes precedence
                            if (this.#lockMode === "HORIZONTAL") cursor = "ew-resize";
                            else if (this.#lockMode === "VERTICAL") cursor = "ns-resize";
                            else if (this.#lockMode === "FREE") cursor = diagonal;
                            else cursor = diagonal; // PENDING
                        } else {
                            // Hover Hinting: Predict intent based on quadrants
                            if (target instanceof StockRectangle) {
                                var adx = Math.abs(dx);
                                var ady = Math.abs(dy);
                                var halfW = target.width / 2;
                                var halfH = target.height / 2;

                                // Divide the Halo into logical 'Edge' vs 'Corner' zones
                                var isOuterX = adx > halfW;
                                var isOuterY = ady > halfH;

                                if (isOuterX && !isOuterY) cursor = "ew-resize";
                                else if (isOuterY && !isOuterX) cursor = "ns-resize";
                                else cursor = diagonal; // Geometrically in a corner
                            } else {
                                // Circles always use the correct diagonal inclination
                                cursor = diagonal;
                            }
                        }
                        this.mouse.showCursor(cursor);
                    }
                }
            }
            this.mouse.update(); // collect cursor requests from components and apply to DOM last
        }.bind(this), this.#fps);

        if (this.#configuration.embedded) {
            // hide compose functionality
            this.toolbar.hide();
            this.sidebar.hide();
            if (!this.#configuration.ui) {
                this.playbar.hide()
            }

            // fullscreen canvas
            this.#elements.simulator.setAttribute("fullscreen", "yes");
            this.#elements.playbar.setAttribute("fullscreen", "yes");

            // autoplay
            this.model.setMode(Model.MODE_PLAY);
            this.model.autoSignal(this.#configuration.autoSignal);
        } else {
            // show edit functionality
            this.toolbar.show();
            this.sidebar.show();
            this.playbar.show();
        }

        publish("resize");

        // display the body now
        this.#elements.container.setAttribute("style", "opacity:100")

        requestAnimationFrame(this.#draw.bind(this));
    }

    /**********************************************************************/
    // PRIVATE METHODS
    /**********************************************************************/
    #createHTMLElements(container) {
        this.#elements.container = container;
        this.#elements.container.setAttribute("style", "opacity:0")

        // create simulator dom
        this.#elements.simulator = document.createElement("div");
        this.#elements.simulator.setAttribute("id", "simulator")

        // create playbar dom
        this.#elements.playbar = document.createElement("div");
        this.#elements.playbar.setAttribute("id", "playbar")

        // create sidebar dom
        this.#elements.sidebar = document.createElement("div");
        this.#elements.sidebar.setAttribute("id", "sidebar")

        // create toolbar dom
        this.#elements.toolbar = document.createElement("div");
        this.#elements.toolbar.setAttribute("id", "toolbar")

        // create toolbar dom
        this.#elements.modal = document.createElement("div");
        this.#elements.modal.setAttribute("id", "modal-container")

        this.#elements.container.appendChild(this.#elements.simulator);
        this.#elements.container.appendChild(this.#elements.playbar);
        this.#elements.container.appendChild(this.#elements.sidebar);
        this.#elements.container.appendChild(this.#elements.toolbar);
        this.#elements.container.appendChild(this.#elements.modal);
    }

    #createModalConfiguration() {
        return {
            saveToURL: function (action) { return this.#saveToURL(action); }.bind(this),
        }
    }

    #createPlaybarConfiguration() {
        return {
            embedded: this.#configuration.embedded,
            isComposing: this.model.isComposing.bind(this.model),
            isPlaying: this.model.isPlaying.bind(this.model),
            play: function () { this.setMode(Model.MODE_PLAY) }.bind(this.model),
            compose: function () { this.setMode(Model.MODE_COMPOSE) }.bind(this.model),
            getAnimationSpeed: function () { return this.#configuration.animationSpeed }.bind(this),
            setAnimationSpeed: function (animationSpeed) { this.#configuration.animationSpeed = animationSpeed }.bind(this),
            saveToURL: function (action) { return this.#saveToURL(action); }.bind(this),
        }
    }

    #draw() {
        if (!this.modal.open) {
            this.model.draw(this.#getAnimationConfiguration());
        }
        requestAnimationFrame(this.#draw.bind(this));
    }

    #getAnimationConfiguration() {
        return {
            isPlaying: this.model.isPlaying(),
            isComposing: this.model.isComposing(),
            animationSpeed: this.#configuration.animationSpeed
        };
    }

    #getFlowSelectionRadius() {
        // radius to use for select 
        if (this.toolbar.currentTool === Toolbar.TOOL_MOVE || this.toolbar.currentTool !== Toolbar.TOOL_PEN) return 40; // selecting, wide radius!
        else if (this.toolbar.currentTool === Toolbar.TOOL_ERASE) return 25; // no accidental erase
        else return 15; // add text close to flows
    }

    #loadFromFile() {
        let input = document.createElement('input');
        input.type = 'file';
        input.onchange = e => {
            var file = e.target.files[0];
            var reader = new FileReader();
            reader.readAsText(file, 'UTF-8');
            reader.onload = readerEvent => {
                var data = readerEvent.target.result;
                this.model.deserialize(this.#getAnimationConfiguration(), data);
            }
        };
        input.click();
    };

    async #loadFromURL() {
        var data = _getParameterByName("data");
        if (data) {
            try {
                if (data.charAt(0) !== '[') {
                    data = await _decompressFromBase64(data);
                }
                if (data) {
                    this.model.deserialize(this.#getAnimationConfiguration(), data);
                }
            } catch (e) {
                console.error("Deserialization failed:", e);
            }
        }
    };

    #saveToFile() {
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + this.model.serialize());
        element.setAttribute('download', "model.fos");
        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);

        this.model.dirty = false;
    }

    async #saveToURL(action) {
        this.model.dirty = false;
        var data = this.model.serialize();
        var compressed = await _compressToBase64(data);

        var link = window.location.origin + window.location.pathname + "?";
        link += "data=" + compressed

        window.history.replaceState(null, null, link);

        if (action === Toolbar.TOOL_EMBED) {
            link += "&embedded=1"
        }

        return link;
    }

    #selectItemToEdit() {
        if (!this.model.isComposing()) return true;

        // Did user click on a text ? If so, edit THAT text.
        const clickedText = this.model.getTextByCoordinates(this.mouse.x, this.mouse.y, 0);
        if (clickedText) {
            this.sidebar.edit(clickedText);
            return true;
        }

        // Did user click on a node ? If so, edit THAT node.
        const clickedNode = this.model.getNodeByCoordinates(this.mouse.x, this.mouse.y, 0);
        if (clickedNode) {
            this.sidebar.edit(clickedNode);
            return true;
        }

        // Did user click on a flow ? If so, edit THAT flow.
        const clickedFlow = this.model.getFlowByCoordinates(this.mouse.x, this.mouse.y, this.#getFlowSelectionRadius());
        if (clickedFlow) {
            this.sidebar.edit(clickedFlow);
            return true;
        }
        return false;
    }

    #registerTextTool() {
        // subscriptions
        subscribe("mouseclick", function () {
            if (!this.model.isComposing() || this.toolbar.currentTool !== Toolbar.TOOL_TEXT) return;
            if (this.#selectItemToEdit()) return;

            if (this.sidebar.currentPage.id !== Sidebar.PAGE_ID_TEXT) {
                var newText = this.model.addText(this.#getAnimationConfiguration(), {
                    x: this.mouse.x,
                    y: this.mouse.y + 10, // to make text actually centered
                    value: "Add your text here"
                });
                this.sidebar.edit(newText);
                return;
            }
            this.sidebar.showPage(Sidebar.PAGE_ID_DEFAULT);
        }.bind(this));
    }

    #registerEraseTool() {
        var erase = function (clicked) {
            if (!this.model.isComposing() || this.toolbar.currentTool !== Toolbar.TOOL_ERASE) return;

            if (this.mouse.pressed || clicked) {
                var text = this.model.getTextByCoordinates(this.mouse.x, this.mouse.y, 0);
                if (text) text.kill();

                var node = this.model.getNodeByCoordinates(this.mouse.x, this.mouse.y, 0);
                if (node) node.kill();

                var flow = this.model.getFlowByCoordinates(this.mouse.x, this.mouse.y, this.#getFlowSelectionRadius());
                if (flow) flow.kill();
            }
        }.bind(this);

        subscribe("mousemove", function () { erase(); }.bind(this));
        subscribe("mouseclick", function () { erase(true); }.bind(this));
    }

    #registerMoveTool() {
        var dragging, offset = { x: 0, y: 0 };
        var initialDimensions = { w: 1, h: 1, x: 1, y: 1 };
        var initialMouse = { x: 1, y: 1 };

        subscribe("mouseclick", function () {
            if (!this.model.isComposing() || this.toolbar.currentTool !== Toolbar.TOOL_MOVE) return;
            if (this.#selectItemToEdit()) return;
            this.sidebar.showPage(Sidebar.PAGE_ID_DEFAULT);
        }.bind(this));

        subscribe("mousedown", function () {
            if (!this.model.isComposing() || this.toolbar.currentTool !== Toolbar.TOOL_MOVE) return;

            // Hit test nodes first for resizing (Halo area)
            const clickedNode = this.model.getNodeByCoordinates(this.mouse.x, this.mouse.y, 40); // 40 is buffer
            if (clickedNode && clickedNode.type === Item.NODE) {
                var inNode = clickedNode.isPointInNode(null, this.mouse.x, this.mouse.y, 0);
                var isResize = clickedNode.isPointInResizeZone(this.mouse.x, this.mouse.y);

                if (isResize) {
                    this.#resizing = clickedNode;
                    initialDimensions = {
                        x: clickedNode.x,
                        y: clickedNode.y,
                        w: clickedNode.width,
                        h: clickedNode.height
                    };
                    initialMouse = {
                        x: this.mouse.x,
                        y: this.mouse.y
                    };
                    this.#lockMode = "PENDING";
                    this.sidebar.edit(clickedNode); // Ensure it's selected
                    publish("tool/changed", [Toolbar.TOOL_MOVE, true])
                    return;
                }
            }

            const text = this.model.getTextByCoordinates(this.mouse.x, this.mouse.y, 0);
            if (text) {
                dragging = text;
                offset.x = this.mouse.x - text.x;
                offset.y = this.mouse.y - text.y;
                this.sidebar.edit(text);
                publish("tool/changed", [Toolbar.TOOL_MOVE, true])
                return;
            }

            const node = this.model.getNodeByCoordinates(this.mouse.x, this.mouse.y, 0);
            if (node) {
                dragging = node;
                offset.x = this.mouse.x - node.x;
                offset.y = this.mouse.y - node.y;
                this.sidebar.edit(node);
                publish("tool/changed", [Toolbar.TOOL_MOVE, true])
                return;
            }

            const flow = this.model.getFlowByCoordinates(this.mouse.x, this.mouse.y, this.#getFlowSelectionRadius());
            if (flow) {
                dragging = flow;
                offset.x = this.mouse.x - flow.x;
                offset.y = this.mouse.y - flow.y;
                this.sidebar.edit(flow);
                publish("tool/changed", [Toolbar.TOOL_MOVE, true])
            }

        }.bind(this));

        subscribe("mousemove", function () {
            if (!this.model.isComposing() || this.toolbar.currentTool !== Toolbar.TOOL_MOVE) return;

            if (this.#resizing) {
                var dxAtMouse = this.mouse.x - this.#resizing.x;
                var dyAtMouse = this.mouse.y - this.#resizing.y;

                if (this.#lockMode === "PENDING") {
                    var dxMove = Math.abs(this.mouse.x - initialDimensions.x);
                    var dyMove = Math.abs(this.mouse.y - initialDimensions.y);
                    if (dxMove > 5 || dyMove > 5) {
                        if (dxMove > dyMove * 1.5) this.#lockMode = "HORIZONTAL";
                        else if (dyMove > dxMove * 1.5) this.#lockMode = "VERTICAL";
                        else this.#lockMode = "FREE";
                    }
                }

                if (this.#resizing instanceof StockRectangle) {
                    var minHalfW = 30;
                    var minHalfH = 30;

                    var deltaX = this.mouse.x - initialMouse.x;
                    var deltaY = this.mouse.y - initialMouse.y;

                    // Quadrant multiplier (relative to initial center)
                    var multX = (initialMouse.x >= initialDimensions.x) ? 1 : -1;
                    var multY = (initialMouse.y >= initialDimensions.y) ? 1 : -1;

                    if (this.#lockMode === "HORIZONTAL") {
                        this.#resizing.width = Math.max(60, initialDimensions.w + deltaX * 2 * multX);
                        this.#resizing.height = initialDimensions.h;

                        // Prevent cursor drift at min bounds
                        if (this.#resizing.width <= 60) {
                            var stopOffset = (60 - initialDimensions.w) / (2 * multX);
                            this.mouse.x = initialMouse.x + stopOffset;
                        }
                    } else if (this.#lockMode === "VERTICAL") {
                        this.#resizing.height = Math.max(60, initialDimensions.h + deltaY * 2 * multY);
                        this.#resizing.width = initialDimensions.w;

                        if (this.#resizing.height <= 60) {
                            var stopOffset = (60 - initialDimensions.h) / (2 * multY);
                            this.mouse.y = initialMouse.y + stopOffset;
                        }
                    } else if (this.#lockMode === "FREE") {
                        this.#resizing.width = Math.max(60, initialDimensions.w + deltaX * 2 * multX);
                        this.#resizing.height = Math.max(60, initialDimensions.h + deltaY * 2 * multY);

                        // Handle constraints for clamping both axes
                        if (this.#resizing.width <= 60) {
                            var stopOffset = (60 - initialDimensions.w) / (2 * multX);
                            this.mouse.x = initialMouse.x + stopOffset;
                        }
                        if (this.#resizing.height <= 60) {
                            var stopOffset = (60 - initialDimensions.h) / (2 * multY);
                            this.mouse.y = initialMouse.y + stopOffset;
                        }
                    }
                } else {
                    // Incremental Circles: Distance-delta logic
                    var initialDist = Math.sqrt(Math.pow(initialMouse.x - initialDimensions.x, 2) + Math.pow(initialMouse.y - initialDimensions.y, 2));
                    var currentDist = Math.sqrt(Math.pow(this.mouse.x - initialDimensions.x, 2) + Math.pow(this.mouse.y - initialDimensions.y, 2));
                    var deltaDist = currentDist - initialDist;

                    this.#resizing.radius = Math.max(30, (initialDimensions.w / 2) + deltaDist);

                    // Prevent cursor drift at min bounds
                    if (this.#resizing.radius <= 30) {
                        var stopDelta = 30 - (initialDimensions.w / 2);
                        var angle = Math.atan2(this.mouse.y - initialDimensions.y, this.mouse.x - initialDimensions.x);
                        this.mouse.x = initialDimensions.x + Math.cos(angle) * (initialDist + stopDelta);
                        this.mouse.y = initialDimensions.y + Math.sin(angle) * (initialDist + stopDelta);
                    }
                }

                this.model.update(this.#getAnimationConfiguration());
                publish("model/changed");
                return;
            }

            if (dragging) {
                dragging.move(this.mouse.x - offset.x, this.mouse.y - offset.y);

                this.model.update(this.#getAnimationConfiguration()); // update to have no visual glitches

                publish("model/changed");
                return;
            }
        }.bind(this));

        subscribe("mouseup", function () {
            if (!this.model.isComposing() || this.toolbar.currentTool !== Toolbar.TOOL_MOVE) return;
            publish("tool/changed", [Toolbar.TOOL_MOVE])
            this.#resizing = null;
            this.#lockMode = null;
            dragging = null;
            offset.x = 0;
            offset.y = 0;
        }.bind(this));
    }

    #registerPenTool() {
        subscribe("mouseclick", function () {
            if (!this.model.isComposing() || this.toolbar.currentTool !== Toolbar.TOOL_PEN) return;
            this.model.removeStroke();
            if (this.#selectItemToEdit()) return;
            this.sidebar.showPage(Sidebar.PAGE_ID_DEFAULT);
        }.bind(this));

        subscribe("mousedown", function () {
            if (!this.model.isComposing() || this.toolbar.currentTool !== Toolbar.TOOL_PEN) return;

            this.model.addStroke([this.mouse.x, this.mouse.y]);
            this.model.draw(this.#getAnimationConfiguration());
        }.bind(this));

        subscribe("mousemove", function () {
            if (!this.model.isComposing() || this.toolbar.currentTool !== Toolbar.TOOL_PEN) return;
            this.model.draw(this.#getAnimationConfiguration());
        }.bind(this));

        subscribe("mouseup", function () {
            if (!this.model.isComposing() || this.toolbar.currentTool !== Toolbar.TOOL_PEN) return;
            const stroke = this.model.getStroke();

            if (!stroke || stroke.length < 2) return;
            if (!this.mouse.moved) return;

            // detect which item draw
            // if started in a node and ended near/in a node, it is an flow else it is a node
            const startPoint = stroke[0];
            let sourceNode = this.model.getNodeByCoordinates(startPoint[0], startPoint[1], 0);
            if (!sourceNode) sourceNode = this.model.getNodeByCoordinates(startPoint[0], startPoint[1], 20); // try again with buffer

            const endPoint = stroke[stroke.length - 1];
            let targetNode = this.model.getNodeByCoordinates(endPoint[0], endPoint[1], 0);
            if (!targetNode) targetNode = this.model.getNodeByCoordinates(endPoint[0], endPoint[1], 40); // try again with buffer

            if (sourceNode && targetNode) { // add flow
                let flowConfiguration = { source: sourceNode, target: targetNode };
                if (sourceNode === targetNode) {
                    // find rotation first by getting average point
                    var bounds = _getBounds(stroke);
                    var x = (bounds.left + bounds.right) / 2;
                    var y = (bounds.top + bounds.bottom) / 2;
                    var dx = x - sourceNode.x;
                    var dy = y - sourceNode.y;
                    var angle = Math.atan2(dy, dx);

                    // find arc height.
                    var translated = _translatePoints(stroke, -sourceNode.x, -sourceNode.y);
                    var rotated = _rotatePoints(translated, -angle);
                    bounds = _getBounds(rotated);

                    // arc & rotation
                    flowConfiguration.rotation = angle * (360 / Math.TAU) + 90;
                    flowConfiguration.arc = bounds.right;


                    // if the arc is NOT created than the radius, don't draw, and otherwise, make sure minimum distance of radius+25)
                    if (flowConfiguration.arc < sourceNode.radius) {
                        flowConfiguration = null;
                        this.sidebar.edit(sourceNode); // you were probably trying to edit the node
                    } else {
                        var minimum = sourceNode.radius + 25;
                        if (flowConfiguration.arc < minimum) flowConfiguration.arc = minimum;
                    }
                } else {
                    // find the arc by translating & rotating
                    var dx = targetNode.x - sourceNode.x;
                    var dy = targetNode.y - sourceNode.y;
                    var angle = Math.atan2(dy, dx);
                    var translated = _translatePoints(stroke, -sourceNode.x, -sourceNode.y);
                    var rotated = _rotatePoints(translated, -angle);
                    var bounds = _getBounds(rotated);

                    // arc
                    if (Math.abs(bounds.top) > Math.abs(bounds.bottom)) {
                        flowConfiguration.arc = -bounds.top;
                    } else {
                        flowConfiguration.arc = -bounds.bottom;
                    }
                }

                if (flowConfiguration) {
                    var newFlow = this.model.addFlow(this.#getAnimationConfiguration(), flowConfiguration);
                    this.sidebar.edit(newFlow);
                }
            } else if (!sourceNode) { // add node
                var bounds = _getBounds(stroke);
                var x = (bounds.left + bounds.right) / 2;
                var y = (bounds.top + bounds.bottom) / 2;
                var r = ((bounds.width / 2) + (bounds.height / 2)) / 2;

                if (r > 15) { // stroke cannot be too small
                    var newNode = this.model.addNode(this.#getAnimationConfiguration(), {
                        x: x,
                        y: y
                    });
                    this.sidebar.edit(newNode);
                }
            }

            this.model.removeStroke();
        }.bind(this));
    }
    /**********************************************************************/
    // PRIVATE STATIC METHODS
    /**********************************************************************/
    static #arrayParser(parameter) {
        if (parameter && (parameter = JSON.parse(parameter)) && Array.isArray(parameter)) {
            return parameter;
        }
        return null;
    }

    static #booleanParser(parameter) {
        return !!parseInt(parameter);
    }

    static #booleanTypeChecker(parameter) {
        return typeof parameter == "boolean";
    }

    static #initializeConfigurationParameter(configuration, parameterName, defaultValue, parser, validator) {
        let parameter = _getParameterByName(parameterName);
        if (parameter) {
            configuration[parameterName] = parser(parameter)
        } else {
            parameter = configuration[parameterName];
            if (parameter !== undefined) {
                if (validator(parameter)) return;
                configuration[parameterName] = parser(parameter)
            } else {
                configuration[parameterName] = defaultValue;
            }
        }
    }

    static #registerGlobalParameters(model) {
        window.HIGHLIGHT_COLOR = "rgba(193, 220, 255, 0.6)";
        window.onresize = function () {
            publish("resize");
        };

        Math.TAU = Math.PI * 2;

        const os = window.navigator.userAgentData.platform.toLowerCase();
        window.isMacLike = os.indexOf("macos") != -1 || os.indexOf("mac os") != -1;
        window.isMobile = window.navigator.userAgentData.mobile;

        window.onbeforeunload = function (e) {
            if (window.fos && window.fos.model && window.fos.model.dirty) {
                const dialogText = "Are you sure you want to leave without saving your changes?";
                e.returnValue = dialogText;
                return dialogText;
            }
        };
    }
}