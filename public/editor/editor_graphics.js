//Graphics plugin class definition
graphics = new editor.Plugin("graphics",
{
  //various variables that we'll be keeping track of.
  //NB: these cannot remain zero, will be set in initialize method.
  metrics: new Hash({linewidth: 0, lineheight: 0, charwidth: 0, blockwidth: 0, fullwidth: 0, fullheight: 0, box:undefined}),
  settings: undefined,
  //settings contains the following variables, and comes from the JSON query.
  //  vmargin, lmargin, rmargin, zoomlevel, linepadding, contentpadding, textsequence

  linecount: 0,
  invalid: false,

  //editor is the dali.js generated DOM object.
  editor: undefined,
  //zoomer is the zoomer object in the toolbar.
  zoomer: undefined,
  //main layer is a group element that signifies the main layer.
  mainlayer: undefined,

  ///////////////////////////////////////////////////////////////////////////////////////
  //ZOOM VALUES HELPER ARRAY
  zoomvalues: [50, 75, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 500000, 1000000, 5000000, 10000000],
  zoomstrings: ["50bp","75bp","100bp","200bp","500bp","1kbp","2kbp","5kbp","10kbp","20kbp","50kbp","100kbp","500kbp","1Mbp","5Mbp","10Mbp"],
  zoomarray: [],

  ////////////////////////////////////////////////////////////////////////////////////////
  // TOKEN-BASED FUNCTIONS

  // main graphics initialization call.
  _initialize: function()
  {
    //associate with the dom object.
    var editordiv = document.getElementById("editor");
    graphics.editor = dali.SVG(editordiv, "editorsvg");

    //initialize the graphics layers in back-to-front order.
    graphics.mainlayer = graphics.editor.group("mainlayer");
    //reassign graphics.line object
    graphics.line = graphics.mainlayer.childNodes;

    //register the onresize() function
    graphics.editor.parentNode.onresize = graphics.onresize;

    ////////////////////////////////////
    // GENERATE THE GRAPHICS TOOLBAR
    graphics.maketoolbar();
    graphics.toolbardom.innerHTML +=
      "<select id='zoomer'></select><br><button id='getsvg' type='button' onclick='graphics.getsvg()'>get svg</button>";
    //now assign the zoomer object.
    graphics.zoomer = document.getElementById("zoomer");

    //set the callback function for changing the zoomer.
    graphics.zoomer.onchange = function()
    { 
      graphics.zoom(graphics.zoomarray[graphics.zoomer.selectedIndex]);
    };

    ////////////////////////////////////
    // OTHER INITIALIZATION

    //pull the settings data from the database.  This should be formatted as json.
    //then execute the callback function.
    $.getJSON("/settings/graphics_settings.js", function(json){graphics.settings = new Hash(json);});
  },

  _ready: function()
  {
    if (!graphics.settings)
    { //make sure we wait till the settings have come in.
      window.setTimeout(graphics._ready, 10);
      return;
    }

    //if we've set the zoom option, enact that in the zoom button.
    if (editor.options.z && (editor.sequence.length >= editor.options.z))
      graphics.settings.zoomlevel = parseInt(editor.options.z);
    else if (editor.sequence.length >= 100)
      graphics.settings.zoomlevel = 100;
    else
      graphics.setting.zoomlevel = graphics.zoomvalues[graphics.zoomvalues.length - 1];

    graphics._newsequence();

    graphics.zoomer.value = graphics.zoomstrings[graphics.zoomvalues.indexOf(graphics.settings.zoomlevel)];

    graphics.isready = true;
  },

  _newsequence: function()
  {
    if (!(editor.stateflags & editor.readyflag)) return;

    //first set the linescount based on the sequence and the characters per line.
    graphics.linecount = Math.ceil(editor.sequence.length / graphics.settings.zoomlevel);

    //nuke the old objects.
    graphics.mainlayer.clear();
    //create the lines objects.
    for (var i = 0; i < graphics.linecount; i++)
      graphics.newline(i);

    //now create the zoomer object to contain the appropriate zoom levels.
    //first nuke everything.
    graphics.zoomer.innerHTML="";
    graphics.zoomarray = [];
    //rebuild it.
    for (var i = 0; graphics.zoomvalues[i] < editor.sequence.length; i++) //beware the infinite loooooooop =(
    {
      var selection = document.createElement('option');
      selection.innerHTML = graphics.zoomstrings[i];
      graphics.zoomarray.push(graphics.zoomvalues[i]);
      graphics.zoomer.appendChild(selection);
    }

    //finally create the last object.
    var selection = document.createElement('option');
    selection.innerHTML = 'full';
    graphics.zoomarray.push(editor.sequence.length);
    graphics.zoomer.appendChild(selection);

    graphics.onresize();
  },

  _allsystemsgo: function()
  {
    graphics.broadcast("render");
  },

  _invalidateall: function()
  //invalidate all of the lines.
  {
    for (var i = 0; i < graphics.linecount; i++)
      graphics._invalidate(i);
  },

  _invalidate: function(token)
  //basically a function that invalidates any given single line.
  {
    graphics.line[(isNaN(token) ? token.line : token)].invalid = true;
    if (!graphics.invalid)
    {
      graphics.invalid = true;
      //send a command to render, with a delay of 10 ms to allow for other commands to post invalidations.
      //10 ms ~ 100 fps, far better than really necessary.
      window.setTimeout(graphics._render, 10);
    }
  },

  _render: function()
  //goes through and checks to see if any of the lines are labeled invalid.  
  //Then render these lines.  If rendering said line causes the succeeding 
  //lines to become invalid, invalidate those.
  { 
    if (!graphics.invalid) return;
    graphics.invalid = false; //flag the invalidation to false.

    //iterate over the lines array
    for (var i = 0; i < graphics.linecount; i++)
      //check to see if this line has been invalidated.
      if (graphics.line[i].invalid)
      {
        graphics.clearline(i);

        //push a redraw token to the plugins in response, the plugins
        //should fill in graphics elements to the line referred to in the token.
        graphics.broadcast("redraw", {line:i} );
        
        //POSTCONDITION:  None of the plugins have any need
        //to deal with generation of graphics objects.  Graphics
        //plugin can safely layout the content delivered to the elements array. 
        //layout this array.
        graphics.layout(i);
      };
    
    var lastline = graphics.mainlayer.lastChild;
    var fullheight = lastline._tbottom + graphics.settings.vmargin;

    graphics.editor.height = fullheight;

    //plugins may like to be notified that we have completed a render event.
    graphics.broadcast("rendered");
  },

  ////////////////////////////////////////////////////////////////////////////////////////
  // non-token helper functions.

  onresize: function()
  {
    //do this resize because it may not actually happen.
    graphics.metrics.fullheight = graphics.editor.parentNode.clientHeight;

    //check to see if the width has changed, if only the height has changed, there is no need for an onresize event.
    if (graphics.metrics.fullwidth != graphics.editor.parentNode.clientWidth)
    {
      graphics.calculatemetrics();

      graphics.broadcast("invalidateall");  
      graphics.broadcast("resize");
    };
  },

  calculatemetrics: function()
  {
    //pull the height and width data
    graphics.metrics.fullheight = graphics.editor.parentNode.clientHeight;
    graphics.metrics.fullwidth = graphics.editor.parentNode.clientWidth;

    //register the graphics space with the Dali engine.  Only change the width.  Height could depend on content.
    graphics.editor.width = graphics.metrics.fullwidth;

    //USING THE TEXT ENGINE AS A METRICS SYSTEM.
    //first make the teststring and initialize various important variables.
    var testline = graphics.editor.text(graphics.settings.lmargin,graphics.settings.vmargin,graphics.teststring());

    //set the height and the charwidth - this should be independent of the choice.
    //note "blockwidth" is the width of the original, this should be used for zoom-independent
    //graphics element components, such as arrowhead widths.
    graphics.metrics.lineheight = testline.height;
    graphics.metrics.blockwidth = testline.width/50; //the width of one letter block.
    //calculate the virtual width of the graphics line.
    var testwidth = graphics.metrics.blockwidth * graphics.settings.zoomlevel;

    //check to see if our settings exceed the actual width.
    if (testwidth + graphics.settings.lmargin + graphics.settings.rmargin > graphics.metrics.fullwidth)
    {
       //let us know that we're going to be using a strictly graphical representation.
       graphics.settings.textsequence = false;
       //set the linewidth and the bounds.
       graphics.metrics.linewidth = graphics.metrics.fullwidth - graphics.settings.lmargin - graphics.settings.rmargin;
    }
    else
    {
       //let us know that we are going to be using both graphical and textual content.
       graphics.settings.textsequence = true;
       //set the linewidth and the bounds.
       //TODO:  Incorporate kerning function.
       graphics.metrics.linewidth = graphics.metrics.blockwidth * graphics.settings.zoomlevel;
    }

    graphics.metrics.charwidth = graphics.metrics.linewidth/graphics.settings.zoomlevel;

    graphics.metrics.box = graphics.editor.parentNode.getBoundingClientRect();

    //clear the testline from the page
    testline.remove();
  },

  zoom: function(level)
  {
    for (var i = 0; i < graphics.linecount; i++)
      graphics.clearline(i);

    //empty the lines array.
    graphics.mainlayer.clear();

    graphics.settings.zoomlevel = level;
    //first set the linescount based on the sequence and the characters per line.
    graphics.linecount = Math.ceil(editor.sequence.length / graphics.settings.zoomlevel);

    //calculate metrics
    graphics.calculatemetrics();

    //create the lines objects.
    for (var i = 0; i < graphics.linecount; i++)
      graphics.newline(i);

    //invalidate all.
    graphics.broadcast("invalidateall");
    //inform the plugins that we have rezoomed.
    graphics.broadcast("zoomed",{level: level});
    //trigger a render event.
    graphics.broadcast("render");
  },

  clearline: function(line)
  {
    line = (isNaN(line) ? line : graphics.line[line]); //set it to the element if we've not got it set that way yet.
    line.clear();
  },

  //generate the test string for the metrics function.  The test string is a 50-character-long string of a's.
  teststring: function()
  {
    var s="";
    for(var i = 0; i < 50; i++)
      s += "a";
    return s;
  },

  ///////////////////////////////////////////////////////////////////////////////////////
  // General graphics functions

  layout: function(line)
  {
    //fix the line variable
    line = (isNaN(line) ? line : graphics.line[line]); 
    //reset the line to (0,0).
    line.currenttransform = undefined;

    //create a local variable to hold the bounding boxes.
    var boxes = [];

    //first go through and deal with the anchored content.
    var unanchored = [];     //temporary array identifying content that can be moved.

    graphics.sort(line);     //sort the line, in descending order.  The downstream greedy algorithm will result in pretty layout.

    for (var i = 0; i < line.childNodes.length; i++)
    {
      if (line.childNodes[i].anchored)
        boxes.push(line.childNodes[i].getBBox());  //put it in our list.  Since these elements should all be (0,0) untransformed, let them be.
      else
        unanchored.push(line.childNodes[i]);        //or deal with it later.
    }

    //next go through and deal with the unanchored content.
    for (var i = 0; i < unanchored.length; i++)
    {
      //create a box shell to represent our unanchored content.
      var boxshell = new graphics.Shell(unanchored[i]);

      //set a cleared variable.
      var cleared = false;
      while (!cleared)
      {
        cleared = true;  // set this correct, only triggered if we find a problem.
        //scan through the boxes, checking for a collision.
          
        for(var j = 0; j < boxes.length; j++)
          //direct check for a collision.
          if (boxes[j].overlaps(boxshell))
          {
            //we are not cleared.
            cleared = false;
            //now find out how much we have to move the element up.
            boxshell.deltay += boxes[j].top - boxshell.bottom - graphics.settings.contentpadding;

            break;  //break out of the for loop and because cleared is false, run through the
          };         //while loop again.
      };
      
      //since we've cleared, we have to add this item's box to the list of boxes.
      boxes.push(boxshell);
      //and we should brand the SVG DOM element with the box.
      boxshell.brand();
    }

    //find how much we need to move the line.  First the bounds of the previous box.
    var prevy = (line.index == 0) ? graphics.settings.vmargin : graphics.line[line.index - 1]._tbottom;
    var translatey = prevy + graphics.settings.linepadding + line.height - line.bottom;
    //some SVG-renderers delay performing transformation actions, so you have to precalculate the new bottom
    line._tbottom = line.bottom + translatey;

    //then translate the entire line.
    line.applytransform(dali.translate(graphics.settings.lmargin, translatey));
  },

  sort: function(line) //specialized sorting function which orders the line graphics elements by width.
  {
    if (line.childNodes.length < 2) return; //quit if there are zero or one elements.
    var previous = line.childNodes[0].width; //stores the previous result.
    for (var index = 1; index < line.childNodes.length; index++)
    {
      if (line.childNodes[index].width <= previous) //move ahead by resetting the previous value
        previous = line.childNodes[index].width;
      else                                          //otherwise we need to do an insertion.
        for (var index2 = 0; index2 < index; index2++)
          if (line.childNodes[index].width >= line.childNodes[index2].width) //then we move index before index2.
          {
            line.insertBefore(line.childNodes[index], line.childNodes[index2]);
            break;
          }
    }
  },

  getlocation: function(event, target)
  {
    //returns the location of an event relative to the internal coordinate system of "target".  If nothing is passed,
    //returns it relative to graphics.editor.
    var bbox = (target) ? target.getBoundingClientRect() : graphics.metrics.box;

    return dali.point(event.clientX - bbox.left, event.clientY - bbox.top + 
      ((target == undefined) || (target == graphics.editor) ? graphics.editor.parentNode.scrollTop : 0));
  },

  getpos: function(xpos)
  {
    //converts an x pixel position to an x position.
    //to get the position, divide the x position by charwidth
    var value = Math.floor(((xpos - graphics.settings.lmargin) / graphics.metrics.charwidth) + 0.5)
    return ((value < 0) ? 0 : ((value > graphics.settings.zoomlevel) ? graphics.settings.zoomlevel : value));
  },

  getline: function(ypos)
    //this function is slow, there may be better ways to do this for UI-response snappiness
    //for example how the drag and drop code immediately below handles the situation.
  {
    var i = 0;
    for (; i < graphics.mainlayer.childNodes.length; i++)
      if (graphics.mainlayer.childNodes[i].bottom > ypos) break;
    return i;
  },

  /////////////////////////////////////////////////////////////////////////////////////////
  //drag and drop function.
  dragtarget: {},
  dragline: 0,  //hack to get more responsive drag and drop events.

  registerdrag: function(who)
  {
    dragtarget = who;
    //then register a mousemove event using event handling.
    graphics.editor.addEventListener("mousemove", graphics.dragmove, true);
    window.addEventListener("mouseup", graphics.dragfinish, true);
  },

  unregisterdrag: function()
  {
    dragtarget = null;
    graphics.editor.removeEventListener("mousemove", graphics.dragmove, true);
    window.removeEventListener("mouseup", graphics.dragfinish, true);
  },
  
  dragmove: function(event)
  {
    var location = graphics.getlocation(event);
    var linepos = graphics.getpos(location.x);

    if (linepos != undefined) //note getpos can return 'undefined' if we are outside of the general range.
    {
      var token = new editor.Token("drag", 
      {
        line: graphics.dragline, 
        linepos: linepos,
        pos: graphics.dragline * graphics.settings.zoomlevel + linepos,
        event: event
      });
      dragtarget.handletoken(token);
    }
  },

  dragfinish: function(event)
  {
    var token = new editor.Token("drop");
    dragtarget.handletoken(token);
    graphics.unregisterdrag();
  },

  //export the image as svg:
  getsvg: function()
  {
    mywindow = window.open("","svg output");
    mywindow.document.write("<code>");  //flank the output with code to make it look nice.
    mywindow.document.write(graphics.editor.toString().split("&").join("&amp;").split( "<").join("&lt;").split(">").join("&gt;").split("\n").join("<br>").split(" ").join("&nbsp;"));
        //substitute &, <, and > for proper HTML characters

    mywindow.document.write("</code>"); //end code tag
  },

});

/////////////////////////////////////////////////////////////////////
// HELPER OBJECT DEFINITIONS

graphics.newline = function(index)
{
  var line = graphics.mainlayer.group("line_" + index);

  $.extend(line,
  {
    invalid: true,
    index: index,
  });

  //hack to enable faster line hinting for drag/drop events:
  line.onmouseover = function(){graphics.dragline = line.index;};

  return line;
};

//styling container.
graphics.newcontainer = function(line, name, anchored)
{
  //if we've passed it a line number, replace it with the actual object.
  line = (isNaN(line) ? line : graphics.line[line]); 
  
  container = line.group(name);
  $.extend(container,
  {
    anchored: (anchored ? true : false), //looks silly but makes it an explicit bool instead of a "false type"

    leftpadding: 0,
    rightpadding: 0,
    toppadding: 0,
    bottompadding: 0,
  });

  return container;
};

//generalized fragment object. Keeps track of line, start, end, and orientation.

graphics.Fragment = function(line, start, end, orientation)
{
  this.line = line;
  this.start = start;
  this.end = end;
  this.orientation = orientation;
};

graphics.Fragment.prototype =
{
  overlaps: function(otherfragment)
  {
    if (this.line != otherfragment.line) return false;
    if ((this.end < otherfragment.start) || (this.start > otherfragment.end)) return false;
    return true;
  }
}

//generalized span.

graphics.Span = function(range)
{
  this.start_l = Math.floor((range.start)/graphics.settings.zoomlevel);
  this.start_p = (range.start)%graphics.settings.zoomlevel;
  this.end_l = Math.floor((range.end)/graphics.settings.zoomlevel);
  this.end_p = (range.end)%graphics.settings.zoomlevel;

  //adjust it so that it's flush with the end of the line instead of the beginning.
  if ((this.end_p == 0) && (range.start != range.end))
  {
    this.end_l--;
    this.end_p = graphics.settings.zoomlevel
  }
};

//shell box that can be moved around and will brand its template on finishing.
graphics.Shell = function(template)
{
  //private variables that cache the old box.
  var left = template.left, top = template.top, right = template.right, bottom = template.bottom;

  //these getters apply the deltax deltay, and padding to the box variables.
  this.__defineGetter__("left",function() {return left + this.deltax - this.leftpadding;});
  this.__defineGetter__("top",function() {return top + this.deltay - this.toppadding;});
  this.__defineGetter__("right",function() {return right + this.deltax + this.rightpadding;});
  this.__defineGetter__("bottom",function() {return bottom + this.deltay + this.bottompadding;});

  $.extend(this,
  {
    deltax: 0,
    deltay: 0,
    leftpadding: template.leftpadding,
    rightpadding: template.rightpadding,
    bottompadding: template.bottompadding,
    toppadding: template.toppadding,
    ref: template,
    brand: function() {this.ref.applytransform(dali.translate(this.deltax, this.deltay), true);},
    overlaps: function(box)
    {
      return !((box.left > this.right) || 
               (box.right < this.left) || 
               (box.top > this.bottom) || 
               (box.bottom < this.top));
    }
  });
}
