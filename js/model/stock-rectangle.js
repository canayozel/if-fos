class RectangleStock extends Stock {
    static #stocks = {};
    static getStock(id) { return RectangleStock.#stocks[id]; }

    constructor(configuration) {
        super(configuration);
        RectangleStock.#stocks[this.id] = this;
    }

    drawHighlight(context, r) {
        var w = r * 2;
        var h = r * 1.5;
        context.beginPath();
        context.rect(-w / 2 - 20, -h / 2 - 20, w + 40, h + 40);
        context.fillStyle = HIGHLIGHT_COLOR;
        context.fill();
    }

    drawShape(context, color, r) {
        var w = r * 2;
        var h = r * 1.5;

        // white-gray bubble with colored border
        context.beginPath();
        context.rect(-w / 2, -h / 2, w, h);
        context.fillStyle = "#ffffff";
        context.fill();
        context.lineWidth = 6;
        context.strokeStyle = color;
        context.stroke();
    }

    drawValueShape(context, color, innerSize) {
        var w = innerSize * 2;
        var h = innerSize * 1.5;
        context.beginPath();
        context.rect(-w / 2, -h / 2, w, h);
        context.fillStyle = color;
        context.fill();
    }

    isPointInStock(context, x, y, buffer) {
        var b = buffer || 0;
        var w = this.radius * 2;
        var h = this.radius * 1.5;
        return x >= this.x - w / 2 - b &&
               x <= this.x + w / 2 + b &&
               y >= this.y - h / 2 - b &&
               y <= this.y + h / 2 + b;
    };

    kill() {
        super.kill();
        delete RectangleStock.#stocks[this.id];
    };
}