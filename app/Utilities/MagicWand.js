import MagicWand from 'magic-wand-tool';

/** Taken from here: https://jsfiddle.net/Tamersoul/dr7Dw/ */
class MW  {
	constructor() {
		this.colorThreshold = 15;
		this.blurRadius = 5;
		this.simplifyTolerant = 0;
		this.simplifyCount = 30;
		this.hatchLength = 4;
		this.hatchOffset = 0;
	
		this.imageInfo = null;
		this.cacheInd = null;
		this.mask = null;
		this.oldMask = null;
		this.downPoint = null;
		this.allowDraw = false;
		this.addMode = false;
		this.currentThreshold = this.colorThreshold;
		
		this.showThreshold();
		document.getElementById('blurRadius').value = this.blurRadius;
		document.getElementById('magic_trace').onclick = () => this.trace();
	}

	initCanvas(img, props) {
		this.onTrace = props.onTrace;

		var cvs = document.getElementById("resultCanvas");
			cvs.width = img.width;
			cvs.height = img.height;
		
		this.imageInfo = {
			width: cvs.width,
			height: cvs.height,
			context: cvs.getContext("2d")
		};
		this.mask = null;
		
		var tempCtx = document.createElement("canvas").getContext("2d");
			tempCtx.canvas.width = this.imageInfo.width;
			tempCtx.canvas.height = this.imageInfo.height;
			tempCtx.drawImage(img, 0, 0);
			
		this.imageInfo.data = tempCtx.getImageData(0, 0, this.imageInfo.width, this.imageInfo.height);
	}

	onRadiusChange(e) {
		this.blurRadius = e.target.value;
	}
	
	getMousePosition(e) {
		var rect = e.target.getBoundingClientRect();
		var offset = {
			top: rect.top + window.scrollY, 
			left: rect.left + window.scrollX, 
		};
		var x = Math.round((e.clientX || e.pageX) - offset.left);
		var y = Math.round((e.clientY || e.pageY) - offset.top);
		return { x: x, y: y };
	}

	onMouseUp(e) {
		this.allowDraw = false;
		this.addMode = false;
		this.oldMask = null;
		this.currentThreshold = this.colorThreshold;
	}

	onMouseDown(e) {
		if (e.button == 0) {
			this.allowDraw = true;
			this.addMode = e.ctrlKey;
			this.downPoint = this.getMousePosition(e);
			this.drawMask(this.downPoint.x, this.downPoint.y);
		} else { 
			this.allowDraw = false;
			this.addMode = false;
			this.oldMask = null;
		}
	}

	onMouseMove(e) {
		if (this.allowDraw) {
			var p = this.getMousePosition(e);
			if (p.x != this.downPoint.x || p.y != this.downPoint.y) {
				var dx = p.x - this.downPoint.x,
					dy = p.y - this.downPoint.y,
					len = Math.sqrt(dx * dx + dy * dy),
					adx = Math.abs(dx),
					ady = Math.abs(dy),
					sign = adx > ady ? dx / adx : dy / ady;
				sign = sign < 0 ? sign / 5 : sign / 3;
				var thres = Math.min(Math.max(this.colorThreshold + Math.floor(sign * len), 1), 255);
				if (thres != this.currentThreshold) {
					this.currentThreshold = thres;
					this.drawMask(this.downPoint.x, this.downPoint.y);
				}
			}
		}
	}

	onKeyDown(e) {
		if (e.keyCode == 17) document.getElementById("resultCanvas").classList.add("add-mode");
	}
	onKeyUp(e) {
		if (e.keyCode == 17) document.getElementById("resultCanvas").classList.remove("add-mode");
	}

	showThreshold() {
		document.getElementById("threshold").innerHTML = "Threshold: " + this.currentThreshold;
	}

	drawMask(x, y) {
		if (!this.imageInfo) return;
		
		this.showThreshold();
		
		var image = {
			data: this.imageInfo.data.data,
			width: this.imageInfo.width,
			height: this.imageInfo.height,
			bytes: 4
		};
		
		if (this.addMode && !this.oldMask) {
			this.oldMask = this.mask;
		}
		
		let old = this.oldMask ? this.oldMask.data : null;

		this.mask = MagicWand.floodFill(image, x, y, this.currentThreshold, old, true);
		if (this.mask) this.mask = MagicWand.gaussBlurOnlyBorder(this.mask, this.blurRadius, old);
		
		if (this.addMode && this.oldMask) {
			this.mask = this.mask ? this.concatMasks(this.mask, this.oldMask) : this.oldMask;
		}
		
		this.drawBorder();
	}
	
	drawBorder(noBorder) {
		if (!this.mask) return;
		
		var x,y,i,j,k,
			w = this.imageInfo.width,
			h = this.imageInfo.height,
			ctx = this.imageInfo.context,
			imgData = ctx.createImageData(w, h),
			res = imgData.data;
		
		if (!noBorder) this.cacheInd = MagicWand.getBorderIndices(this.mask);
		
		ctx.clearRect(0, 0, w, h);
		
		var len = this.cacheInd.length;
		for (j = 0; j < len; j++) {
			i = this.cacheInd[j];
			x = i % w; // calc x by index
			y = (i - x) / w; // calc y by index
			k = (y * w + x) * 4; 
			if ((x + y + this.hatchOffset) % (this.hatchLength * 2) < this.hatchLength) { // detect hatch color 
				res[k + 3] = 255; // black, change only alpha
			} else {
				res[k] = 255; // white
				res[k + 1] = 255;
				res[k + 2] = 255;
				res[k + 3] = 255;
			}
		}
	
		ctx.putImageData(imgData, 0, 0);
	}
	
	/** convert current selection to an actual */
	trace() {
		var cs = MagicWand.traceContours(this.mask);
			cs = MagicWand.simplifyContours(cs, this.simplifyTolerant, this.simplifyCount);
	
		this.mask = null;

		// filter out inner polygons
		let xyPoints = cs.filter(el => el.inner == false).map(el => el.points);
		this.onTrace(xyPoints);
	
		// draw contours
		var ctx = this.imageInfo.context;
		ctx.clearRect(0, 0, this.imageInfo.width, this.imageInfo.height);

		//outer
		ctx.beginPath();
		for (var i = 0; i < cs.length; i++) {
			if (cs[i].inner) continue;
			var ps = cs[i].points;
			ctx.moveTo(ps[0].x, ps[0].y);
			for (var j = 1; j < ps.length; j++) {
				ctx.lineTo(ps[j].x, ps[j].y);
			}
		}
		ctx.strokeStyle = "blue";
		ctx.stroke();	
	}
	
	/** combine selections */
	concatMasks(mask, old) {
		let data1 = old.data,
			data2 = mask.data,
			w1 = old.width,
			w2 = mask.width,
			b1 = old.bounds,
			b2 = mask.bounds,
			b = { // bounds for new mask
				minX: Math.min(b1.minX, b2.minX),
				minY: Math.min(b1.minY, b2.minY),
				maxX: Math.max(b1.maxX, b2.maxX),
				maxY: Math.max(b1.maxY, b2.maxY)
			},
			w = old.width, // size for new mask
			h = old.height,
			i, j, k, k1, k2, len;
	
		let result = new Uint8Array(w * h);
	
		// copy all old mask
		len = b1.maxX - b1.minX + 1;
		i = b1.minY * w + b1.minX;
		k1 = b1.minY * w1 + b1.minX;
		k2 = b1.maxY * w1 + b1.minX + 1;
		// walk through rows (Y)
		for (k = k1; k < k2; k += w1) {
			result.set(data1.subarray(k, k + len), i); // copy row
			i += w;
		}
	
		// copy new mask (only "black" pixels)
		len = b2.maxX - b2.minX + 1;
		i = b2.minY * w + b2.minX;
		k1 = b2.minY * w2 + b2.minX;
		k2 = b2.maxY * w2 + b2.minX + 1;
		// walk through rows (Y)
		for (k = k1; k < k2; k += w2) {
			// walk through cols (X)
			for (j = 0; j < len; j++) {
				if (data2[k + j] === 1) result[i + j] = 1;
			}
			i += w;
		}
	
		return {
			data: result,
			width: w,
			height: h,
			bounds: b
		};
	}
}

export default MW;