/*
	Copyright (C) 2011 by J. David Eisenberg
	
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>
*/

var novel_script;
/*
	A Character is an actor that can speak and be displayed.
	
	name: the name of the character
	escName: the escape() version of name; used as an id="" attribute
	color: text color for this character
	image: an Image object containing the image to display
	imageElement: an <img> element to go into the DOM
	src: the current source attribute
	prevSrc: previous source (in order to detect changes)
	domRef: a reference to the <img> element once inserted into the DOM
	position: where to display the character
	prevPosition: last place displayed (in order to detect changes)
	alpha: transparency (0 = transparent, 1.0 = opaque)
	visibility: either "visible" or "hidden" (as in CSS)
*/

function Character(characterName)
{
	this.name = characterName;
	if (characterName == '')
	{
		characterName = "anon" + novel.anonymous++;
	}
	this.escName = escape(characterName);
	this.color = "#000000";
	this.image = new Image();
	this.imageElement = document.createElement("img");
	this.imageElement.setAttribute("id", this.escName);
	this.src = null;
	this.prevSrc = null;
	this.domRef = null;
	this.position = new Position(0, 0, true);
	this.prevPosition = new Position(0, 0, true);
	this.alpha = 1.0;
	this.visibility = "visible";
	
	/*
		If a second argument is given, it is an anonymous
		object giving the initial image and position of this
		character.
	*/
	if (arguments.length > 1)
	{
		var obj = arguments[1];
		this.color = obj.color || this.color;
		if (obj.image)
		{
			this.image.setAttribute("src", novel.imagePath + obj.image);
		}
		this.position = obj.position || new Position(0, 0, true);
	}
}

/*
	If the <img> for this character isn't already in the DOM,
	add it to the tableau, and push it into the novel's array
	of actors that are on the screen.
*/
Character.prototype.display = function(param)
{
	var closure = this;
	if (this.domRef == null)
	{
		novel.tableau.appendChild(this.imageElement);
		novel.actors.push(this);
	}
	this.domRef = document.getElementById(this.escName);

	/*
		If the parameter is an object, set the character's properties
		to the properties given in the parameter
	*/
	if (param.constructor == Object)
	{
		for (var property in param)
		{
			if (property == "image")
			{
				this.image.src = novel.imagePath + param.image;
			}
			else
			{
				this[property] = param[property];
			}
		}
	}
	
	/*
		The image's width and height don't get set immediately if the
		image isn't cached, so wait 10 milliseconds to finish the display.
	*/
	setTimeout( function() { return closure.finishDisplay.apply( closure ); }, 10 );
}

Character.prototype.finishDisplay = function()
{
	if (this.image.complete)
	{
		/*
			Has width, height, or position changed?
			If so, hide this character.
		*/
		var pos = this.position;
		var el = this.domRef;
		var xPos = pos.x;
		var yPos = pos.y;
		var changed = false;

		if (!pos.equals(this.prevPosition) ||
			this.image.width != this.domRef.width ||
			this.image.height != this.domRef.height)
		{
			el.style.visibility = "hidden";
			changed = true;
		}
		
		el.src = this.image.src;	// load in the new picture
		
		/*
			Then set its position, visiblity, and transparency
		*/
		if (pos.xRelative)
		{
			xPos *= novel.width;
		}
		if (pos.yRelative)
		{
			yPos *= novel.height;
		}
		novel.waitCount = 0;
		xPos -= Math.floor(pos.xAnchor * this.image.width);
		yPos -= Math.floor(pos.yAnchor * this.image.height);
		el.style.position = "absolute";
		el.style.left = xPos + "px";
		el.style.top = yPos + "px";
		el.style.visibility = this.visibility;
		this.setAlpha(this.alpha);
		if (changed)
		{
			this.prevPosition = this.position.clone();
		}
	}
	else 
	{
		/* Image isn't loaded yet; try again in 10 milliseconds */
		novel.waitCount++;
		var closure = this;
		setTimeout( function() {
			return closure.finishDisplay.apply( closure );
		}, 10 );
	}
}

/*
	A convenience method; parameter is either true or false
	to show or hide a character
*/
Character.prototype.show = function(visible)
{
	this.domRef.style.visibility = (visible) ? "visible" : "hidden";
}
	
/*
	Set the transparency. If the picture is completely opaque,
	we must remove the style information, as IE blurs the picture
	even when alpha is 100.
*/
Character.prototype.setAlpha = function(alpha)
{
	if (alpha != 1.0)
	{
		this.domRef.style.filter = "alpha(opacity=" +
			Math.floor(alpha*100) + ")";
		this.domRef.style.opacity = alpha;
	}
	else
	{
		this.domRef.style.filter = null;
		this.domRef.style.opacity = null;
	}
}

/*
	Show the character' name (if any) and the
	given string in the <div id="dialog"> area.
	
	Anything in {{ }} is interpolated.
*/
Character.prototype.say = function(str)
{
	var htmlStr = "";
	var interpolatedString = str;
	clearDialog();
	if (this.name != "")
	{
		htmlStr = '<span style="color: ' + this.color + '">' +
		this.name + ':</span><br />';
	}
	if (str.indexOf("{{") >= 0)
	{
		str = str.replace(/{{(.*?)}}/g, novel_interpolator);
	}
	htmlStr += str;
	novel.dialog.innerHTML = htmlStr;
	novel.paused = true;
}

/*
	The novel tells the characters to do some action. If
	the parameter is a string, then the character is speaking;
	if it's an object, then the character is being displayed.
*/
Character.prototype.doAction = function(param)
{
	if (param == "" || param.constructor == Object)
	{
		this.display(param);
	}
	else if (param.constructor == String)
	{
		this.say(param);
	}
}


/* ============================================== */
/*
	A TextBlock is a block of text that can be displayed.
	
	name: the name for this text block
	escName: the escape() of the name; used as an id="" attribute
	color: text color for this block
	div: a <div class="textClass"> element that holds the text
	domRef: a reference to the <div> once inserted into the DOM
	position: where to display this text block
	align: text alignment, as in CSS
	font: the font to use to display the text
	width: % of width of the window; range from 0 to 1.0
	visibility: "visible" or "hidden", as in CSS
	text: actually, an HTML string to display inside the text area
*/
function TextBlock(textName)
{
	if (textName == '')
	{
		textName = "anon" + novel.anonymous++;
	}
	this.escName = escape(textName);
	this.color = "#000000";
	this.div = document.createElement("div");
	this.div.setAttribute("id", this.escName);
	this.div.setAttribute("class", "textClass");
	this.div.setAttribute("className", "textClass");
	this.domRef = null;
	this.position = new Position(0, 0, true);
	this.align = "left";
	this.font = '20px "Deja Vu Sans", Helvetica, Arial, sans-serif';
	this.width = 1.0; // decimal percentage
	this.visibility = "visible";
	this.text = "";
	
	/*
		If given a second parameter, use its fields
		to set the TextBlock's fields
	*/
	if (arguments.length > 1)
	{
		var param = arguments[1];
		for (var property in param)
		{
			this[property] = param[property];
		}
	}
}

/*
	Convenience method to set the HTML within a text block
*/
TextBlock.prototype.setText = function(html)
{
	this.domRef.innerHTML = html;
}

/*
	Display the text block on the screen
*/
TextBlock.prototype.display = function(param)
{
	var el;
	var xPos;
	var yPos;

	/*
		If the <div> isn't in the DOM yet, insert it,
		and add it to the list of actors in the tableau.
	*/
	if (this.domRef == null)
	{
		novel.tableau.appendChild(this.div);
		novel.actors.push(this);
	}
	this.domRef = document.getElementById(this.escName);
	el = this.domRef;
	
	/*
		Hide the text, then look at the parameter and take
		appropriate action depending upon its type
	*/
	el.style.visibility = "hidden";
	if (param.constructor == Position)
	{
		this.position = param;
	}
	else if (param.constructor == String)
	{
		this.text = param;
	}
	else if (param.constructor == Object)
	{
		for (var propertyName in param)
		{
			this[propertyName] = param[propertyName];
		}
	}
	// set the text
	el.innerHTML = this.text.replace(/{{(.*?)}}/g,
		novel_interpolator);;

	xPos = this.position.x;
	yPos = this.position.y;
	
	// and its position and attributes
	if (this.position.xRelative)
	{
		xPos *= novel.width;
	}
	if (this.position.yRelative)
	{
		yPos *= novel.height;
	}
	el.style.color = this.color;
	el.style.font = this.font;
	el.style.position = "absolute";
	el.style.width = Math.floor(this.width * 100) + "%";
	if (this.width != 1.0)
	{
		el.style.marginLeft = Math.floor((1 - this.width) * 100) + "%";
	}
	else
	{
		el.style.marginLeft = "0";
	}
	el.style.left = xPos + "px";
	el.style.top = yPos + "px";
	el.style.textAlign = this.align;
	el.style.visibility = this.visibility; // then reveal (if visible)
}

/*
	A convenience method; parameter is either true or false
	to show or hide a text block
*/
TextBlock.prototype.show = function(visible)
{
	this.domRef.style.visibility = (visible) ? "visible" : "hidden";
}
	
/*
	Set the transparency. If the picture is completely opaque,
	we must remove the style information, as IE blurs the picture
	even when alpha is 100.
*/
TextBlock.prototype.setAlpha = function(alpha)
{
	if (alpha != 1.0)
	{
		this.domRef.style.filter = "alpha(opacity=" +
			Math.floor(alpha*100) + ")";
		this.domRef.style.opacity = alpha;
	}
	else
	{
		this.domRef.style.filter = null;
		this.domRef.style.opacity = null;
	}
}

/*
	At this moment, the only action a text block can
	take is to display itself.
*/
TextBlock.prototype.doAction = function(param)
{
	this.display(param);
}

/* ============================================== */
/*
	A MenuItem is an actor, but unlike a Character
	or a TextBlock, it doesn't have methods; instead,
	the menu function handles everything associated
	with menus.
*/
function MenuItem(n, text, label)
{
	this.domRef = document.createElement("div");
	this.domRef.setAttribute("id", "menuItem" + n);
	this.domRef.setAttribute("class", "menuItem");
	this.domRef.setAttribute("className", "menuItem");
	this.text = text;
	this.label = label;
}

/* ============================================== */
/*
	A Position specifies an item's screen position
	(x, y); whether the coordinates are absolute (pixels)
	or relative (decimal percent in range 0-1.0).
	
	xAnchor and yAnchor are used to offset the "top left"
	point of an image.
	
	Presume an image that is 200 x 150 would ordinarily
	be displayed with its upper left corner at (300, 400).
	If xAnchor is .2 and yAnchor is .5, then the image
	will display at the upper left coordinate
	of (300 - (200 * .2), 400 - (150 * .5)), or (260, 325).
*/
function Position(x, y)
{
	this.x = x
	this.y = y
	this.xRelative = (x <= 1.0);
	this.yRelative = (y <= 1.0);
	this.xAnchor = (arguments.length >= 3) ? arguments[2] : 0;
	this.yAnchor = (arguments.length >= 4) ? arguments[3] : 0;
}

/*
	Compare two Position objects for equality; returns
	true or false
*/
Position.prototype.equals = function(other)
{
	return (this.x == other.x && this.y == other.y &&
		this.relative == other.relative &&
		this.xAnchor == other.xAnchor && this.yAnchor == other.yAnchor); 
}

/*
	Creates a duplicate of a Position; needed to make sure
	that the current and previous positions of a Character
	are two separate objects.
*/
Position.prototype.clone = function()
{
	var newPos = new Position(this.x, this.y, this.relative);
	newPos.xAnchor = this.xAnchor;
	newPos.yAnchor = this.yAnchor;
	return newPos;
}

/* =========================================================== */

/*
	These are the functions for driving the novel.
	Even though there is only one novel, I create an object for it
	to avoid polluting the variables namespace. Further than it
	already is polluted, that is.
	
	frame: the current frame that is onscreen
	tableau: the <div id="novel"> (Name comes from card games)
	dialog: the <div id="dialog"> where characters "speak"
	audio: the <div id="audio"> (if any, for music)
	paused: awaiting a click. We need this because JavaScript can't
		wait() or sleep().
	history: keeps track of path through novel (not used yet)
	historyPos: position in history (not used yet)
	ignoreClicks: is a menu or input on screen? (If so, ignore clicks in tableau/dialog)
	labels: associative array of all labels defined in the script
	subs: associative array of all subroutines defined in the script
	callStack: keep track of call statements (to "subroutines" in script)
	anonymous: how many un-named text blocks or actors have we created?
	actors: the list of characters and textblocks currently in the tableau
	userVar: "variables" defined in the script (associative array)
	scriptStack: current script stack; used in if statements and menus
	backgroundImage: background image array; in order to fade/dissolve background, it
		has to be an image rather than a background CSS style
	activeBG: which background is active (0 or 1)?
	bgAlpha: the transparency of the backgroundImage (0=transparent, 1=opaque)
	waitCount: # of times waiting to complete picture loading (used for
		debugging)
*/

function Novel() {
	this.frame = 0;
	this.tableau = null;
	this.dialog = null;
	this.audio = null;
	this.paused = false;
	this.history = new Array();
	this.historyPos = 0;
	this.ignoreClicks = false;
	this.labels = new Array();
	this.subs = new Array();
	this.callStack = new Array();
	this.anonymous = 0;
	this.actors = new Array(); // who is on screen right now?
	this.userVar = new Object();
	this.scriptStack = new Array();
	this.backgroundImage = new Array(2);
	this.activeBG = 0;
	this.bgAlpha = 1.0;
	this.waitCount = 0;
	
	this.PERCENT = true;
	this.PIXEL = false;
}

/*
	In order to avoid binding problems with "this",
	the remaining functions are globals. Functions that
	the scripts call directly aren't prefixed; functions
	that are internal begin with novel_, again to avoid
	polluting the namespace. Further.
*/

/*
	This method interpolates {{...}} expressions
	in strings.
*/
function novel_interpolator(str, p1, offset, s)
{
	return eval(p1);
}

/*
	Remove all menu items from the tableau
*/
function novel_clearMenuItems()
{
	var actor;
	var domObject;
	var i;
	if (novel)
	{
		i = 0;
		while (i < novel.actors.length)
		{
			if (novel.actors[i].constructor == MenuItem)
			{
				domObject = novel.actors[i].domRef;
				if (domObject != null)
				{
					domObject.parentNode.removeChild(domObject);
				}
				novel.actors[i].domRef = null;
				novel.actors.splice(i, 1);
			}
			else
			{
				i++;
			}
		}
	}
}

/*
	When user clicks a menu item, it invokes the novel_menuJump
	function. This function attaches the appropriate onclick.
*/
function novel_addOnClick(el, value)
{
	el.onclick = function(e) { novel_menuJump.apply(window, [value, e]); return false;};
}

/*
	Handle a click on a menu item. Stop event propagation
	so that the tableau doesn't intercept the event. 
	Set novel_script to the menu's script, and the frame
	to the first command in that script. Then
	start playing the novel.
*/
function novel_menuJump(menuScript, evt)
{
	if (!evt)
	{
		evt = window.event;
	}
	evt.cancelBubble = true;
	if (evt.stopPropagation)
	{
		evt.stopPropagation();
	}
	novel_clearMenuItems();
	novel.dialog.style.textAlign = "left";
	novel.ignoreClicks = false;
	novel_pushScript();
	novel_script = menuScript;
	novel.frame = 0;
	playNovel();
}

/*
	Fade out the background image by decreasing
	its alpha by 10% every 0.1 seconds. When totally
	transparent, swap to the new background image source,
	and start fading in.
*/
function novel_fadeBgOut()
{
	var bg = document.getElementById("background" + novel.activeBG);
	novel.bgAlpha -= 0.1;
	bg.style.filter = "alpha(opacity=" + Math.floor(novel.bgAlpha*100) + ")";
	bg.style.opacity = novel.bgAlpha;
	if (novel.bgAlpha > 0)
	{
		setTimeout(novel_fadeBgOut, 100);
	}
	else
	{
		bg.src = novel.imagePath + novel.backgroundImage[novel.activeBG];
		novel_fadeBgIn();
	}
}
	

/*
	Fade in the background image by increasing
	its alpha by 10% every 0.1 seconds. When totally
	opaque, restart playing the novel.
*/
function novel_fadeBgIn()
{
	var bg = document.getElementById("background" + novel.activeBG);
	novel.bgAlpha += 0.1;
	if (novel.bgAlpha < 1)
	{
		bg.style.filter = "alpha(opacity=" +
			Math.floor(novel.bgAlpha*100) + ")";
		bg.style.opacity = novel.bgAlpha;
		setTimeout(novel_fadeBgIn, 100);
	}
	else
	{
		bg.style.filter = null;
		bg.style.opacity = null;
		playNovel();
	}
}

/*
	Dissolve between background images by altering each one's
	alpha by 10% every 0.1 seconds. When one is totally
	transparent, the other will be totally opaque.
*/
function novel_dissolveIn()
{
	var bgA = document.getElementById("background" + novel.activeBG);
	var bgB = document.getElementById("background" + (1 - novel.activeBG));
	novel.bgAlpha -= 0.1;
	bgA.style.filter = "alpha(opacity=" + Math.floor(novel.bgAlpha*100) + ")";
	bgA.style.opacity = novel.bgAlpha;
	bgB.style.filter = "alpha(opacity=" + Math.floor(100 - novel.bgAlpha*100) + ")";
	bgB.style.opacity = (1.0 - novel.bgAlpha);
	if (novel.bgAlpha > 0)
	{
		setTimeout(novel_dissolveIn, 100);
	}
	else
	{
		novel.activeBG = 1 - novel.activeBG;
		novel.bgAlpha = 1.0;
		playNovel();
	}
}
	
/*
	Create the associative array of the labels and
	their frame numbers in the main script. Only the
	main script labels are scanned; labels in
	menus or if statements are ignored.
*/
function novel_collectLabels()
{
	for (var i = 0; i < novel_script.length; i += 2)
	{
		if (novel_script[i] == label)
		{
			novel.labels[novel_script[i + 1]] = i;
		}
		else if (novel_script[i] == sub)
		{
			novel.subs[novel_script[i+1]] = i;
		}
	}
}
		
/*
	Save a reference to the script array
	and the frame
*/
function novel_pushScript()
{
	novel.scriptStack.push(novel_script);
	novel.scriptStack.push(novel.frame);
}

/*
	Restore the script array and frame.
*/
function novel_popScript()
{
	if (novel.scriptStack.length > 0)
	{
		novel.frame = novel.scriptStack.pop() + 2;
		novel_script = novel.scriptStack.pop();
	}
}

/*
	Take all actors off the tableau, and set their
	DOM references to null
*/
function clearTableau()
{
	var actor;
	var domObject;
	if (novel)
	{
		while (novel.actors.length > 0)
		{
			actor = novel.actors.pop();
			domObject = actor.domRef;
			if (domObject != null)
			{
				domObject.parentNode.removeChild(domObject);
			}
			actor.domRef = null;
		}
	}
}

function stopAudio()
{
	if (novel.audio && novel.audio.src)
	{
		novel.audio.currentTime = 0;
		novel.audio.pause();
	}
}

/*
	Clear the <div id="dialog">
*/
function clearDialog()
{
	novel.dialog.innerHTML = "";
}

/*
	Set the visibility of the dialog to the given value
*/
function showDialog(status)
{
	novel.dialog.style.visibility = status;
}

/*
	Set the dialog to the first item in the MenuArray; the
	remaining entries are pairs of item labels and scripts,
	which are associated with individual MenuItem objects.
*/
function menu(menuArray)
{
	novel.ignoreClicks = true;
	novel.dialog.innerHTML = menuArray[0];
	novel.dialog.style.textAlign="center";
	for (var i = 1; i < menuArray.length; i += 2)
	{
		var mItem = new MenuItem((i-1) / 2, menuArray[i], menuArray[i+1]); 
		var el = mItem.domRef;
		novel_addOnClick(el, menuArray[i+1]);
		el.innerHTML = menuArray[i].replace(/{{(.*?)}}/g, novel_interpolator);
		novel.tableau.appendChild(el);
		novel.actors.push(mItem);
	}
	novel.paused = true;
}

/*
	All jumps go back to the main script, so pop off all the
	information in the script stack.
*/
function jump(label)
{
	while (novel.scriptStack.length > 0)
	{
		novel.frame = novel.scriptStack.pop();
		novel_script = novel.scriptStack.pop();
	}
	novel.frame = novel.labels[label];
	/*
		Since this function is called from playNovel() and
		it adds 2 to the frame count, subtract 2 so that
		we jump to the correct point in the script.
	*/
	novel.frame -= 2;
}

/*
	Set up a new scene. First, clear the tableau and dialog.
	If the parameter was a string, it's the name of a background
	image. If the parameter is an object, the image property is
	the background file name and the effect property tells how you
	want to display the background (only "fade" is valid for now)
*/
function scene(param)
{
	var fileName;
	var effect;
	clearTableau();
	clearDialog();
	if (typeof param == "string")
	{
		fileName = param;
		effect = "";
	}
	else
	{
		fileName = param.image;
		effect = param.effect;
	}
	novel.bgAlpha = 1.0;
	if (!effect)
	{
		novel.backgroundImage[novel.activeBG] = fileName;
		document.getElementById("background" + novel.activeBG).src = novel.imagePath +
			fileName;
	}
	else if (effect == "fade")
	{
		novel.backgroundImage[novel.activeBG] = fileName;
		/*
		 document.getElementById("background" + novel.activeBG).src =
			novel.imagePath + fileName;
		*/
		novel.paused = true;
		novel_fadeBgOut();
	}
	else if (effect == "dissolve")
	{
		novel.backgroundImage[1 - novel.activeBG] = fileName;
		document.getElementById("background" + (1 - novel.activeBG)).src =
			novel.imagePath + fileName;
		novel.paused = true;
		novel_dissolveIn();
	}
}

/*
	Call a subroutine; a section of the script with the given
	label.
*/
function call(label)
{
	if (typeof novel.subs[label] != 'undefined')
	{
		novel.callStack.push(novel.frame);
		novel.frame = novel.subs[label];
	}
}

/*
	Return from a subroutine call
*/
function endSub()
{
	if (novel.callStack.length != 0)
	{
		novel.frame = novel.callStack.pop();
	}
}

/*
	Set a user variable or variables; the parameter
	is either a string containing JavaScript to evaluate
	or it is an object whose properties are inserted into
	novel.userVar.  If you use the second form, then
	when you refer to a variable in	an interpolated string,
	you must qualify it with novel.userVar.
*/
function setVars(param)
{
	if (typeof param == "string")
	{
		eval(param);
	}
	else if (typeof param == "object")
	{
		for (var property in param)
		{
			novel.userVar[property] = param[property];
		}
	}
}

/*
	The label and sub functions don't do anything; they are just
	there so we can use label without quotemarks in the script.
*/
function label(str)
{
	// do nothing
}

function sub(str)
{
	// do nothing
}

/*
	Play the audio with the given filename
*/
function audio(str)
{
	var audioSource;
	if (novel.audio)
	{
		stopAudio();
		novel.audio.src = novel.audioPath + str;
		novel.audio.addEventListener('ended', function() {
			this.currentTime = 0;
			this.play();
		}, false);
		novel.audio.play();
	}
}

/*
	Handle an if statement. The parameter is an object
	with three properties: 
	condition: the condition to test (a string to be evaluated)
	ifPart: an array of script instructions to execute if condition is true
	elsePart: an array of script instructions to execute if condition
		is false (the elsePart is optional)
*/
function ifStatement(param)
{
	var ok = eval(param.condition);
	novel_pushScript();
	novel.frame = 0;
	if (ok)
	{
		novel_script = param.ifPart;
	}
	else
	{
		if (param.elsePart)
		{
			novel_script = param.elsePart;
		}
		else
		{
			novel_popScript();
		}
	}
	novel.frame -= 2; // because playNovel() will add 2
}

/*
	Call an author-defined JavaScript function.
	jsInfo.fcn is the function name;
	jsInfo.params is an array of parameters
*/
function jsCall(jsInfo)
{
	jsInfo.fcn.apply(window, jsInfo.params);
}

function textInput(param)
{
}

/*
	Initialize the novel object; the parameters w and h are
	the width and height of the <div id="novel">.
	The prepareNovel() function is provided by the script author;
	it sets up characters and text blocks. Always start the novel
	at the label "start".
*/
function initNovel(w, h)
{
	if ((typeof novel != 'undefined') && novel.tableau)
	{
		clearTableau();
	}
	if ((typeof novel != 'undefined') && novel.dialog)
	{
		clearDialog();
	}
	novel = new Novel();
	novel.tableau = document.getElementById("novelDiv");
	novel.dialog = document.getElementById("dialogDiv");
	if (!!(document.createElement('audio').canPlayType))
	{
		novel.audio = new Audio();
	}
	else
	{
		novel.audio = null;
	}
	novel.width = w;
	novel.height = h;
	prepareNovel();
	novel_script = script;
	novel_collectLabels();
	novel.frame = novel.labels["start"];
	playNovel();
}

/*
	Play the novel. If you aren't in the menu, paused, or at the
	end of the novel, grab the next entry in novel_script. If it's
	a Character or a TextBlock, invoke its doAction() function, using
	the next item in the novel_script as its parameter.
	
	If the entry is a function, then invoke that function with the next
	item in the novel_script as its parameter.
	
	If none of the above, it's an error. Give an alert.
*/
function playNovel()
{
	var obj;
	novel.paused = false;
	/*
	novel.history.push(novel.frame);
	novel.historyPos++;
	*/
	while (!novel.ignoreClicks && novel.frame < novel_script.length && ! novel.paused)
	{
		obj = novel_script[novel.frame];
//		document.getElementById("debug").innerHTML = "frame: " + novel.frame + " " + obj + "/" + novel_script[novel.frame +1];
		if (obj.constructor == Character || obj.constructor == TextBlock)
		{
			obj.doAction(novel_script[novel.frame+1]);
			novel.frame += 2;
		}
		else if (typeof(obj) == "function")
		{
			novel_script[novel.frame].apply(window, [novel_script[novel.frame+1]]);
			novel.frame += 2;
		}
		else
		{
			alert("Frame " + novel.frame + "\nUnknown: " +
				obj + "\n" + typeof(obj));
			novel.frame += 2;
		}
		/*
			If at the end of a script,
			pop it off the script stack.
		*/
		if (novel.frame >= novel_script.length)
		{
			novel_popScript();
		}
	}
}