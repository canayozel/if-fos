class CircleStock extends Stock {
    static #stocks = {};
    static getStock(id) { return CircleStock.#stocks[id]; }

    constructor(configuration) {
        super(configuration);
        CircleStock.#stocks[this.id] = this;
    }

    drawHighlight(context, r) {
        context.beginPath();
        context.arc(0, 0, r + 40, 0, Math.TAU, false);
        context.fillStyle = HIGHLIGHT_COLOR;
        context.fill();
    }

    drawShape(context, color, r) {
        context.beginPath();
        context.arc(0, 0, r - 2, 0, Math.TAU, false);
        context.fillStyle = color;
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = "rgba(0,0,0,0.1)";
        context.stroke();
    }

    drawValueShape(context, color, innerRadius) {
        context.beginPath();
        context.arc(0, 0, innerRadius, 0, Math.TAU, false);
        context.fillStyle = color;
        context.fill();
    }

    isPointInStock(context, x, y, buffer) {
        return _isPointInCircle(x, y, this.x, this.y, this.radius + (buffer || 0));
    };

    kill(silent) {
        super.kill(silent);
        delete CircleStock.#stocks[this.id];
    };
}