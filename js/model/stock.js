class Stock extends Node {
    #initialValue = Node.DEFAULT_VALUE;
    #currentValue;
    #unit = "";

    get initialValue() { return this.#initialValue; }
    get currentValue() { return this.#currentValue; }
    get unit() { return this.#unit; }
    get showValue() { return true; }

    set initialValue(initialValue) {
        if (initialValue === "" || initialValue === null || initialValue === undefined) {
            this.#initialValue = null;
        } else {
            this.#initialValue = parseFloat(initialValue);
        }
    }
    set unit(unit) { this.#unit = unit; }

    constructor(configuration) {
        super(configuration);

        if (configuration.initialValue !== undefined) {
            if (configuration.initialValue === "" || configuration.initialValue === null) {
                this.#initialValue = null;
            } else {
                this.#initialValue = parseFloat(configuration.initialValue);
            }
        }
        if (configuration.unit !== undefined) this.#unit = configuration.unit;
    }

    takeSignal(signal) {
        if (this.#currentValue !== null) {
            this.#currentValue += signal.delta;
        }
        this.sendSignal(signal);
    };

    reset() {
        this.#currentValue = this.#initialValue;
    }
}