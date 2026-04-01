class Sidebar extends UI {
    static get #BACK_BUTTON_TEXT() { return "go back" };

    static get PAGE_ID_DEFAULT() { return "DEFAULT" };
    static get PAGE_ID_STOCK() { return "STOCK" };
    static get PAGE_ID_FLOW() { return "FLOW" };
    static get PAGE_ID_TEXT() { return "TEXT" };


    constructor(dom) {
        super(dom)

        this.addPage(Sidebar.PAGE_ID_DEFAULT, this.#initializeDefaultPage());
        this.addPage(Sidebar.PAGE_ID_STOCK, this.#initializeStockEditPage());
        this.addPage(Sidebar.PAGE_ID_FLOW, this.#initializeFlowEditPage());
        this.addPage(Sidebar.PAGE_ID_TEXT, this.#initializeTextEditPage());

        this.showPage(Sidebar.PAGE_ID_DEFAULT);

        subscribe("kill", function (item) {
            if (this.currentPage.target == item) {
                this.showPage(Sidebar.PAGE_ID_DEFAULT);
            }
        }.bind(this));
        subscribe("model/stock/replaced", function (newStock) {
            this.edit(newStock);
        }.bind(this));
    }

    edit(object) {
        this.showPage(object.type);
        this.currentPage.edit(object);
    };

    #initializeStockEditPage() {
        var page = new SidebarPage();
        page.addComponent(new ComponentButton(page, "", {
            header: true,
            label: Sidebar.#BACK_BUTTON_TEXT,
            onclick: function () { this.showPage(Sidebar.PAGE_ID_DEFAULT); }.bind(this)
        }));
        page.addComponent(new ComponentInput(page, "label", {
            label: "<br><br>Name:"
        }));
        page.addComponent(new ComponentChoice(page, "shape", {
            label: "Shape:",
            options: [0, 1, 2],
            iconClasses: ["choice-icon-circle", "choice-icon-rectangle", "choice-icon-boundary"]
        }));
        page.addComponent(new ComponentColor(page, "color", {
            label: "Color:",
            oninput: (value) => {
                Stock.DEFAULT_COLOR = value;
            }
        }));
        page.addComponent(new ComponentInput(page, "initialValue", {
            label: "Start Value:"
        }));
        page.addComponent(new ComponentInput(page, "unit", {
            label: "Unit:"
        }));
        page.addComponent(new ComponentNumeric(page, "fontSize", {
            label: "Font Size:",
            min: 8,
            max: 100,
            step: 1
        }));
        page.addComponent(new ComponentButton(page, "", {
            label: "delete stock",
            onclick: function (stock) {
                stock.kill();
                this.showPage(Sidebar.PAGE_ID_DEFAULT);
            }.bind(this)
        }));

        page.onEdit = function () {
            var stock = page.target;
            if (!stock) return;

            var name = stock.label;
            if (name == "" || name == "?") page.getComponent("label").select();
        };
        return page;
    }

    #initializeFlowEditPage() {
        var page = new SidebarPage();
        page.addComponent(new ComponentButton(page, "", {
            header: true,
            label: Sidebar.#BACK_BUTTON_TEXT,
            onclick: function () { this.showPage(Sidebar.PAGE_ID_DEFAULT); }.bind(this)
        }));
        page.addComponent(new ComponentChoice(page, "strength", {
            label: "<br><br>Flow Type:",
            options: [1, -1],
            labels: ["Increase (+)", "Decrease (-)"],
            oninput: function (value) { Flow.DEFAULT_STRENGTH = value; }
        }));
        page.addComponent(new ComponentHTML(page, "", {
            html: "(to make a stronger flow, draw multiple arrows!) <br><br>(to make a delayed flow, draw longer arrows)"
        }));
        page.addComponent(new ComponentButton(page, "", {
            label: "delete flow",
            onclick: function (flow) {
                flow.kill();
                this.showPage(Sidebar.PAGE_ID_DEFAULT);
            }.bind(this)
        }));

        page.onEdit = function () {
        };

        return page;
    }

    #initializeTextEditPage() {
        var page = new SidebarPage();
        page.addComponent(new ComponentButton(page, "", {
            header: true,
            label: Sidebar.#BACK_BUTTON_TEXT,
            onclick: function () { this.showPage(Sidebar.PAGE_ID_DEFAULT); }.bind(this)
        }));
        page.addComponent(new ComponentInput(page, "value", {
            label: "<br><br>Label:",
            textarea: true
        }));
        page.addComponent(new ComponentButton(page, "", {
            label: "delete label",
            onclick: function (item) {
                item.kill();
                this.showPage(Sidebar.PAGE_ID_DEFAULT);
            }.bind(this)
        }));

        page.onShow = function () {
            page.getComponent("value").select();
        };

        page.onHide = function () {
            var label = page.target;
            if (!page.target) return;

            var text = label.text;
            if (/^\s*$/.test(text)) {
                page.target = null;
                label.kill();
            }
        };

        return page;
    }

    #initializeDefaultPage() {
        var page = new SidebarPage();
        page.addComponent(new ComponentHTML(page, "", {
            html: "" +
                "<b style='font-size:1.4em'>FOS</b> <br>a tool for simulating financial orchestration<br><br>" +
                "<hr/><br>"

        }));
        return page;
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////
// COMPONENTS ///////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////
class SidebarPage extends UIPage {
    #target;

    get target() { return this.#target; }

    constructor() {
        super();
        this.#target = null;

        // start hiding
        this.hide();
    }

    addComponent(component) {
        super.addComponent(component);
    };

    edit(item) {
        if (this.target) {
            this.target.selected = false;
        }

        // new target to edit
        this.#target = item;
        this.target.selected = true;

        // show each property with its component
        for (var i = 0; i < this.components.length; i++) {
            this.components[i].show();
        }

        // callback
        this.onEdit();
    };

    hide() {
        super.hide();
        if (this.target) {
            this.target.selected = false;
        }
    };

    onEdit() { }
}


class ComponentChoice extends Component {
    #container;

    constructor(page, propertyName, configuration) {
        super(page, propertyName, configuration);

        this.choices = [];
        this.#container = document.createElement("div");
        this.#container.setAttribute("class", "component-choice-container");

        for (var i = 0; i < configuration.options.length; i++) {
            var choice = document.createElement("div");
            choice.setAttribute("class", "component-choice");

            var icon = document.createElement("div");
            if (configuration.labels) {
                choice.innerHTML = configuration.labels[i];
            } else if (configuration.iconClasses) {
                icon.setAttribute("class", configuration.iconClasses[i]);
                choice.appendChild(icon);
            } else if (configuration.iconColors) {
                icon.setAttribute("class", "choice-icon-swatch");
                icon.style.backgroundColor = configuration.iconColors[i];
                choice.appendChild(icon);
            } else {
                choice.innerHTML = configuration.options[i];
            }

            choice.onclick = function (index) {
                this.setTargetPropertyValue(this.configuration.options[index]);
                this.show();
                if (this.configuration.oninput) {
                    this.configuration.oninput(this.configuration.options[index]);
                }
            }.bind(this, i);

            this.#container.appendChild(choice);
            this.choices.push(choice);
        }

        var label = _createLabel(this.configuration.label);
        this.dom.appendChild(label);
        this.dom.appendChild(this.#container);
    }

    show() {
        var value = this.getTargetPropertyValue();
        for (var i = 0; i < this.choices.length; i++) {
            if (this.configuration.options[i] === value) {
                this.choices[i].setAttribute("selected", "yes");
            } else {
                this.choices[i].removeAttribute("selected");
            }
        }
    }
}



class ComponentColor extends Component {
    #input;
    #text;
    #copy;

    constructor(page, propertyName, configuration) {
        super(page, propertyName, configuration);

        var container = document.createElement("div");
        container.setAttribute("class", "component-color-container");

        // picker
        this.#input = document.createElement("input");
        this.#input.type = "color";
        this.#input.setAttribute("class", "component-color-picker");

        // hex text input
        this.#text = document.createElement("input");
        this.#text.setAttribute("type", "text");
        this.#text.setAttribute("class", "component-color-hex");
        this.#text.style.userSelect = "text";
        this.#text.style.webkitUserSelect = "text";

        // generic update function
        const performUpdate = (value) => {
            this.setTargetPropertyValue(value);
            if (this.configuration.oninput) {
                this.configuration.oninput(value);
            }
        };

        this.#text.onkeydown = (event) => {
            event.stopPropagation();
        };

        this.#text.oninput = () => {
            let value = this.#text.value.trim();
            if (value.charAt(0) !== '#') value = '#' + value;

            if (/^#[0-9A-F]{6}$/i.test(value)) {
                this.#input.value = value;
                performUpdate(value.toUpperCase());
            } else if (/^#[0-9A-F]{3}$/i.test(value)) {
                const r = value[1], g = value[2], b = value[3];
                this.#input.value = `#${r}${r}${g}${g}${b}${b}`;
                performUpdate(value.toUpperCase());
            }
        };

        this.#text.onblur = () => {
            let value = this.#text.value.trim().toUpperCase();
            if (value.charAt(0) !== '#') value = '#' + value;
            if (/^#[0-9A-F]{3}$/i.test(value)) {
                const r = value[1], g = value[2], b = value[3];
                value = `#${r}${r}${g}${g}${b}${b}`;
            }
            if (/^#[0-9A-F]{6}$/i.test(value)) {
                this.#text.value = value;
            }
        };

        this.#input.oninput = () => {
            let value = this.#input.value.toUpperCase();
            this.#text.value = value;
            performUpdate(value);
        };

        // copy button
        this.#copy = document.createElement("div");
        this.#copy.setAttribute("class", "component-color-copy");
        this.#copy.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        `;
        this.#copy.setAttribute("data-balloon", "Copy Hex");
        this.#copy.setAttribute("data-balloon-pos", "top");
        this.#copy.onclick = () => {
            navigator.clipboard.writeText(this.#input.value.toUpperCase());
            this.#copy.setAttribute("data-balloon", "Copied!");
            setTimeout(() => {
                this.#copy.setAttribute("data-balloon", "Copy Hex");
            }, 1000);
        };

        container.appendChild(this.#input);
        container.appendChild(this.#text);
        container.appendChild(this.#copy);

        var label = _createLabel(this.configuration.label);
        this.dom.appendChild(label);
        this.dom.appendChild(container);
    }

    show() {
        var value = this.getTargetPropertyValue();
        this.#input.value = value;
        this.#text.value = value.toUpperCase();
    }
}

class ComponentNumeric extends Component {
    #input;

    constructor(page, propertyName, configuration) {
        super(page, propertyName, configuration);

        this.#input = document.createElement("input");
        this.#input.setAttribute("type", "number");
        this.#input.setAttribute("class", "component-numeric");
        this.#input.setAttribute("min", configuration.min || 0);
        this.#input.setAttribute("max", configuration.max || 100);
        this.#input.setAttribute("step", configuration.step || 1);

        this.#input.oninput = () => {
            var value = parseFloat(this.#input.value);
            if (isNaN(value)) value = 0;
            this.setTargetPropertyValue(value);
            if (this.configuration.oninput) {
                this.configuration.oninput(value);
            }
        };

        this.#input.onkeydown = (event) => {
            event.stopPropagation();
        };

        var label = _createLabel(this.configuration.label || "");
        this.dom.appendChild(label);
        this.dom.appendChild(this.#input);
    }

    show() {
        this.#input.value = this.getTargetPropertyValue();
    }
}

