class CircleStock extends Stock {
    constructor(configuration) {
        super(configuration);
    }

    drawHighlight(context, r) {
        var radius = this.width / 2;
        context.beginPath();
        context.arc(0, 0, (radius + 10) * 2, 0, Math.TAU, false); // retina
        context.fillStyle = HIGHLIGHT_COLOR;
        context.fill();
    }

    drawShape(context, color, r) {
        var radius = this.width / 2;
        context.beginPath();
        context.arc(0, 0, radius * 2 - 2, 0, Math.TAU, false);
        context.fillStyle = color;
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = "rgba(0,0,0,0.1)";
        context.stroke();
    }


    isPointInStock(context, x, y, buffer) {
        return _isPointInCircle(x, y, this.x, this.y, this.radius + (buffer || 0));
    };

    kill(silent) {
        super.kill(silent);
    };
}