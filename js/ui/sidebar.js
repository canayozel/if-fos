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
        page.addComponent(new ComponentChoice(page, "hue", {
            label: "Color:",
            options: [0, 1, 2, 3, 4, 5],
            iconColors: ["#EA3E3E", "#EA9D51", "#FEEE43", "#BFEE3F", "#7FD4FF", "#A97FFF"],
            oninput: function (value) { Stock.DEFAULT_HUE = value; }
        }));
        page.addComponent(new ComponentChoice(page, "initialValue", {
            label: "Start Amount:",
            options: [0, 0.16, 0.33, 0.50, 0.66, 0.83, 1],
            labels: ["0", "1", "2", "3", "4", "5", "6"]
        }));
        page.addComponent(new ComponentChoice(page, "shape", {
            label: "Shape:",
            options: [0, 1],
            iconClasses: ["choice-icon-circle", "choice-icon-rectangle"]
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
            var color = stock.color;
            page.getComponent("initialValue").setBGColor(window.HIGHLIGHT_COLOR);
            page.getComponent("shape").setBGColor(window.HIGHLIGHT_COLOR);

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
            page.getComponent("strength").setBGColor(window.HIGHLIGHT_COLOR);
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
    #currentColor;
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
                if (this.#currentColor) {
                    this.choices[i].style.backgroundColor = this.#currentColor;
                }
            } else {
                this.choices[i].removeAttribute("selected");
                this.choices[i].style.backgroundColor = "";
            }
        }
    }

    setBGColor(color) {
        this.#currentColor = color;
        this.show();
    };
}


