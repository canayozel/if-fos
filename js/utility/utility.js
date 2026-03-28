/**************************************************************************/
/**************************************************************************/
function _addMouseEvents(target, eventSource) {
	const _onmousemove = function (event) {
		const _fakeEvent = {};
		if (event.changedTouches) { // touch
			const offset = _getTotalOffset(target);
			_fakeEvent.x = event.changedTouches[0].clientX - offset.left;
			_fakeEvent.y = event.changedTouches[0].clientY - offset.top;
			event.preventDefault();
		} else { // not touch

			_fakeEvent.x = event.offsetX;
			_fakeEvent.y = event.offsetY;
		}
		eventSource.onMouseMove(_fakeEvent);
		return _fakeEvent;
	};
	const _onmousedown = function (event) {
		const _fakeEvent = _onmousemove(event);
		eventSource.onMouseDown(_fakeEvent);
	};

	const _onmouseup = function (event) {
		const _fakeEvent = {};
		eventSource.onMouseUp(_fakeEvent);
	};

	// add events
	target.addEventListener("mousedown", _onmousedown);
	target.addEventListener("mousemove", _onmousemove);
	document.body.addEventListener("mouseup", _onmouseup);

	// touch
	target.addEventListener("touchstart", _onmousedown, false);
	target.addEventListener("touchmove", _onmousemove, false);
	document.body.addEventListener("touchend", _onmouseup, false);
}
/**************************************************************************/
/**************************************************************************/
function _blendColors(color1, color2, blend) {
	let color = "#";
	for (let i = 0; i < 3; i++) {
		const sub1 = color1.substring(1 + 2 * i, 3 + 2 * i);
		const sub2 = color2.substring(1 + 2 * i, 3 + 2 * i);
		const num1 = parseInt(sub1, 16);
		const num2 = parseInt(sub2, 16);

		// blended number & sub
		const num = Math.floor(num1 * (1 - blend) + num2 * blend);
		const sub = num.toString(16).toUpperCase();
		const paddedSub = ('0' + sub).slice(-2); // in case it's only one digit long

		color += paddedSub;
	}
	return color;
}
/**************************************************************************/
/**************************************************************************/
function _createCanvas(dom) {
	const canvas = document.createElement("canvas");

	// dimensions
	const __onResize = function () {
		const width = dom.clientWidth;
		const height = dom.clientHeight;

		canvas.width = width * 2; // retina
		canvas.style.width = width + "px";

		canvas.height = height * 2; // retina
		canvas.style.height = height + "px";
	};
	__onResize();

	dom.appendChild(canvas);

	subscribe("resize", function () {
		__onResize();
	});
	return canvas;
}
/**************************************************************************/
/**************************************************************************/
function _configureProperties(object, configuration, properties) {
	for (const propertyName in properties) {
		// default values
		if (configuration[propertyName] === undefined) {
			let value = properties[propertyName];
			if (typeof value == "function") value = value();
			configuration[propertyName] = value;
		}
		// transfer to "object"
		object[propertyName] = configuration[propertyName];
	}
}
/**************************************************************************/
/**************************************************************************/
function _createButton(label, onclick) {
	const button = document.createElement("div");

	button.innerHTML = label;
	button.onclick = onclick;
	button.setAttribute("class", "component-button");

	return button;
}
/**************************************************************************/
/**************************************************************************/
function _createTextInput(className, textarea, oninput) {
	const input = textarea ? document.createElement("textarea") : document.createElement("input");

	input.oninput = oninput;
	input.setAttribute("class", className);
	input.addEventListener("keydown", function (event) {
		event.stopPropagation(); // stop it from triggering key.js
	}, false);

	return input;
}
/**************************************************************************/
/**************************************************************************/
function _createLabel(message) {
	const label = document.createElement("div");

	label.innerHTML = message;
	label.setAttribute("class", "component-label");

	return label;
}
/**************************************************************************/
/**************************************************************************/
function _createNumberInput(onUpdate) {
	const input = {};

	input.dom = document.createElement("input");
	input.dom.style.border = "none";
	input.dom.style.width = "40px";
	input.dom.style.padding = "5px";

	input.dom.addEventListener("keydown", function (event) {
		event.stopPropagation ? event.stopPropagation() : (event.cancelBubble = true);
	},
		false); // STOP IT FROM TRIGGERING KEY.js

	// on update
	input.dom.onchange = function () {
		let value = parseInt(input.getValue());
		if (isNaN(value)) value = 0;
		input.setValue(value);
		onUpdate(value);
	};

	// select on click, yo
	input.dom.onclick = function () {
		input.dom.select();
	};

	// set & get value
	input.getValue = function () {
		return input.dom.value;
	};

	input.setValue = function (number) {
		input.dom.value = number;
	};

	// return an OBJECT.
	return input;
}
/**************************************************************************/
/**************************************************************************/
function _format(template) {
	let args = [].slice.call(arguments, 1), i = 0;
	return template.replace(/%s/g, () => args[i++]);
}
/**************************************************************************/
/**************************************************************************/
function _getBounds(points) {
	// Bounds
	let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
	for (let i = 0; i < points.length; i++) {
		const point = points[i];
		if (point[0] < left) left = point[0];
		if (right < point[0]) right = point[0];
		if (point[1] < top) top = point[1];
		if (bottom < point[1]) bottom = point[1];
	}

	// Dimensions
	const width = (right - left);
	const height = (bottom - top);

	return { left: left, right: right, top: top, bottom: bottom, width: width, height: height };
}
/**************************************************************************/
/**************************************************************************/
function _getParameterByName(name) {
	const url = window.location.href;
	name = name.replace(/[\[\]]/g, "\\$&");
	const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"), results = regex.exec(url);
	if (!results) return null;
	if (!results[2]) return '';
	return decodeURIComponent(results[2].replace(/\+/g, " "));
}
/**************************************************************************/
/**************************************************************************/
function _isPointInBox(x, y, box) {
	if (x < box.x) return false;
	if (x > box.x + box.width) return false;
	if (y < box.y) return false;
	return y <= box.y + box.height;

}
/**************************************************************************/
/**************************************************************************/
function _isPointInCircle(x, y, cx, cy, radius) {
	// point distance
	const dx = cx - x;
	const dy = cy - y;
	const distanceSquared = dx * dx + dy * dy;

	// radius
	const radiusSquared = radius * radius;

	return distanceSquared <= radiusSquared;
}
/**************************************************************************/
/**************************************************************************/
function _rotatePoints(points, angle) {
	points = JSON.parse(JSON.stringify(points));
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		const x = p[0];
		const y = p[1];
		p[0] = x * Math.cos(angle) - y * Math.sin(angle);
		p[1] = y * Math.cos(angle) + x * Math.sin(angle);
	}
	return points;
}
/**************************************************************************/
/**************************************************************************/
function _translatePoints(points, dx, dy) {
	points = JSON.parse(JSON.stringify(points));
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		p[0] += dx;
		p[1] += dy;
	}
	return points;
}
/**************************************************************************/
/**************************************************************************/
function _throwErrorMessage(message) {
	throw Error(message);
}
/**************************************************************************/
/**************************************************************************/
function _validateAssigned(object, message) {
	_validateTrue(!!object, message);
}
/**************************************************************************/
/**************************************************************************/
function _validateTrue(object, message) {
	if (object !== true) {
		_throwErrorMessage(message);
	}
}
/**************************************************************************/
/**************************************************************************/