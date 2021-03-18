import html2canvas from 'html2canvas';

import MW from '../Utilities/MagicWand';
import {MAP_ID} from '../config';

class MagicModal {
	constructor(props) {
		// events
		this.onInit = props.onInit;
		this.onCapture = props.onCapture;
		this.onTraceSuccess = props.onTraceSuccess;
		this.onEnd = props.onEnd;

		// show modal
		this.magicWrapper = document.getElementById('magicwand_wrapper');

		// bind close key
		this.magicClose = document.getElementById('magicwand_close');
		this.magicClose.onclick = () => { this.hide() }

		// content
		this.magicContent = document.getElementById('magicwand_content');
	}

	/** init MagicWand modal with all the necessary stuff */
	init() {
		// clear the content
		this.magicContent.innerHTML = '';
		// do a callback func
		this.onInit();
		// make a screenshot and show it in modal
		html2canvas(document.getElementById(MAP_ID), {
			allowTaint: false,
			logging: false,
			useCORS: true,
			height: window.innerHeight,
			width: window.innerWidth,
			windowHeight: window.innerHeight,
			windowWidth: window.innerWidth,
			scale: 1
		}).then(canvas => {
			// add img
			let dataUrl = canvas.toDataURL("image/png");

			let imageFoo = document.createElement('img');
				imageFoo.src = dataUrl;
				imageFoo.className = 'magicImage';
				imageFoo.width = window.innerWidth;
				imageFoo.height = window.innerHeight;
			this.magicContent.appendChild(imageFoo);

			let canvasResult = document.createElement('canvas');
				canvasResult.id = 'resultCanvas';
			this.magicContent.appendChild(canvasResult);

			// show modal
			this.show();

			// load and wait 5 seconds
			setTimeout(() => {
				// init magic stuff
				this.magic = new MW();
				this.magic.initCanvas(imageFoo, {
					onTrace: (data) => {
						this.onTraceSuccess(data);
					}
				});

				// do this once everything is done
				this.onEnd();

				// bind functions
				canvasResult.onmouseup = (e) => this.magic.onMouseUp(e) ;
				canvasResult.onmousedown = (e) => this.magic.onMouseDown(e);
				canvasResult.onmousemove = (e) => this.magic.onMouseMove(e);
			}, 5000);
		});
	}

	/** show magicwand modal */
	show() {
		this.magicWrapper.style.display = 'block';
	}
	/** hide magicwand modal */
	hide() {
		this.magicWrapper.style.display = 'none';
	}
}

export default MagicModal;