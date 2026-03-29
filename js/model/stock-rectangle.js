class RectangleStock extends Stock {
    constructor(configuration) {
        super(configuration);
    }

    drawHighlight(context, r) {
        var w = this.width * 2;
        var h = this.height * 2;
        context.beginPath();
        context.rect(-w / 2 - 40, -h / 2 - 40, w + 80, h + 80);
        context.fillStyle = HIGHLIGHT_COLOR;
        context.fill();
    }

    drawShape(context, color, r) {
        var w = this.width * 2;
        var h = this.height * 2;

        context.beginPath();
        context.rect(-w / 2, -h / 2, w, h);
        context.fillStyle = color;
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = "rgba(0,0,0,0.1)";
        context.stroke();
    }
    
    drawResizeHandle(context, r) {
        // [DEPRECATED] using highlight area instead
    }

    drawValueShape(context, color, innerSize) {
        var ratio = this.height / this.width;
        var w = innerSize * 2;
        var h = w * ratio;
        context.beginPath();
        context.rect(-w / 2, -h / 2, w, h);
        context.fillStyle = color;
        context.fill();
    }

    isPointInStock(context, x, y, buffer) {
        var b = buffer || 0;
        var w = this.width;
        var h = this.height;
        return x >= this.x - w / 2 - b &&
               x <= this.x + w / 2 + b &&
               y >= this.y - h / 2 - b &&
               y <= this.y + h / 2 + b;
    };
    
    isPointInResizeZone(x, y) {
        var buffer = 40;
        var inHighlight = this.isPointInStock(null, x, y, buffer);
        var inStock = this.isPointInStock(null, x, y, 0);
        return inHighlight && !inStock;
    };

    getBoundaryOffset(angle) {
        var W = this.width / 2;
        var H = this.height / 2;
        var cos = Math.abs(Math.cos(angle));
        var sin = Math.abs(Math.sin(angle));
        
        if (W * sin > H * cos) {
            return H / sin;
        } else {
            return W / cos;
        }
    }

    kill(silent) {
        super.kill(silent);
    };
}