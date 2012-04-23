//Graphics plugin class definition
graphics = new editor.Plugin("graphics",
{
  //various variables that we'll be keeping track of.
  //NB: these cannot remain zero, will be set in initialize method.
  metrics: {linewidth: 0, lineheight: 0, charwidth: 0, blockwidth: 0, fullwidth: 0, fullheight: 0},
  settings: {vmargin: 0, lmargin:0, rmargin: 0, zoomlevel: 0, linepadding: 0, textsequence: false},  
  linecount: 0,
  invalid: false,
  initstate: {settings: false, sequence: false, resize: false},

  //editor is the dali.js generated DOM object.
  editor: {},
  //main layer is a group element that signifies the main layer.
  mainlayer: {},
  //there is also a selection layer, behind the main layer, and a floater layer, above it.
  selectionlayer: {},
  floaterlayer: {},

  ////////////////////////////////////////////////////////////////////////////////////////
  // TOKEN-BASED FUNCTIONS

  // main graphics initialization call.
  initialize: function()
  {
    //associate with the dom object.
    var editordiv = document.getElementById("editor");
    graphics.editor = dali.SVG(editordiv, "editorsvg");

    //initialize the graphics layers in back-to-front order.
    graphics.mainlayer = graphics.editor.group("mainlayer");

    //register the onresize() function
    graphics.editor.parentNode.onresize = graphics.onresize;

    //pull the settings data from the database.  This should be formatted as json.
    //then execute the callback function.
    $.getJSON("/settings/graphics_settings.js", function(json)
    {
      graphics.settings = json;
      graphics.initstate.settings = true;
      graphics.onresize(true);
    });
  },

  newsequence: function()
  {
    //block until the graphics settings have arrived.
    if (graphics.initstate.settings)
      graphics._newsequence();
    else
      window.setTimeout(graphics.newsequence, 100);
  },

  _newsequence: function()
  {
    //first set the linescount based on the sequence and the characters per line.
    graphics.linecount = Math.ceil(editor.sequence.length / graphics.settings.zoomlevel);

    //create the lines objects.
    for (var i = 0; i < graphics.linecount; i++)
      graphics.newline(i);

    //create the zoomer object
    var zoomer = document.getElementById("zoomer");
    graphics.zoomarray = [];
    for (var i = 0; graphics.zoomvalues[i] < editor.sequence.length; i++) //infinite loooooooop =(
    {
      var selection = document.createElement('option');
      selection.innerHTML = graphics.zoomstrings[i];
      graphics.zoomarray.push(graphics.zoomvalues[i]);
      zoomer.appendChild(selection);
    }

    var selection = document.createElement('option');
    selection.innerHTML = 'full';
    graphics.zoomarray.push(editor.sequence.length);
    zoomer.appendChild(selection);

    zoomer.onchange = function()
    {
      graphics.zoom(graphics.zoomarray[this.selectedIndex]);
    }

    graphics.initstate.sequence = true;
  },

  allsystemsgo: function()
  {
    graphics.broadcast("render");
  },

  invalidateall: function()
  //invalidate all of the lines.
  {
    for (var i = 0; i < graphics.linecount; i++)
      graphics.line(i).invalidate;
  },

  invalidate: function(token)
  //basically a function that invalidates any given single line.
  {
    graphics.line((isNaN(token) ? token.line : token)).invalid = true;
    if (!graphics.invalid)
    {
      graphics.invalid = true;
      //send a command to render, with a delay of 10 ms to allow for other commands to post invalidations.
      //10 ms ~ 100 fps, far better than really necessary.
      window.setTimeout(graphics.render, 10);
    }
  },

  render: function()
  //goes through and checks to see if any of the lines are labeled invalid.  
  //Then render these lines.  If rendering said line causes the succeeding 
  //lines to become invalid, invalidate those.
  { 
    graphics.invalid = false; //flag the invalidation to false.
    //iterate over the lines array
    for (var i = 0; i < graphics.linecount; i++)
      //check to see if this line has been invalidated.
      if (graphics.line(i).invalid)
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
    var fullheight = lastline.bottom + graphics.settings.vmargin;

    graphics.editor.height = fullheight;

    //plugins may like to be notified that we have completed a render event.
    graphics.broadcast("rendered");
  },

  ////////////////////////////////////////////////////////////////////////////////////////
  // non-token helper functions.

  line: function(i) { return graphics.mainlayer.childNodes[i];},

  onresize: function(isinitializing)
  {
    //do this resize because it may not actually happen.
    graphics.metrics.fullheight = graphics.editor.parentNode.clientHeight;

    //check to see if the width has changed, if only the height has changed, there is no need for an onresize event.
    if (graphics.metrics.fullwidth != graphics.editor.parentNode.clientWidth)
    {
      graphics.calculatemetrics();
      if (!isinitializing)
        graphics.broadcast("invalidateall");
        
      graphics.broadcast("resize", {initial: isinitializing});
      graphics.initstate.resize = true;
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

    //inform the plugins that we have rezoomed.
    graphics.broadcast("zoomed");
    graphics.broadcast("render");
  },

  clearline: function(line)
  {
    if (!isNaN(line)) line = graphics.line(line); //set it to the element if we've not got it set that way yet.
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
    if (!isNaN(line)) line = graphics.line(line);
    //reset the line to (0,0).
    line.applytransform(new dali.Identity(), true);

    //create a local variable to hold the bounding boxes.
    var boxes = [];

    //first go through and deal with the anchored content.
    var unanchored = [];     //temporary array identifying content that can be moved.

    graphics.sort(line); //cycle sort the line.

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
            boxshell.deltay += boxes[j].top - (boxshell.bottom + boxshell.bottompadding);

            break;  //break out of the for loop and because cleared is false, run through the
          };         //while loop again.
      };
      
      //since we've cleared, we have to add this item's box to the list of boxes.
      boxes.push(boxshell);
      //and we should brand the SVG DOM element with the box.
      boxshell.brand();
    }

    //find how much we need to move the line.  First the bounds of the previous box.
    var prevy = (line.index == 0) ? graphics.settings.vmargin : graphics.line(line.index - 1).bottom;
    var translatey = prevy + graphics.settings.linepadding + line.height - line.bottom;

    //then translate the entire line.
    line.applytransform(new dali.Translate(graphics.settings.lmargin, translatey), true);
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

  /*

  getlocation: function(event, target)
  {
    var location = {};
    if (target)
    {
      location.internalx = event.clientX - target.getBoundingClientRect().left;
      location.internaly = event.clientY - target.getBoundingClientRect().top;
    }
    location.svgx = event.clientX - graphics.editor.dom.getBoundingClientRect().left;
    location.svgy = event.clientY - graphics.editor.dom.getBoundingClientRect().top + graphics.editor.dom.scrollTop;
    
    return location;
  },

  getpos: function(xpos)
  {
    //to get the position, divide the x position by charwidth
    var value = Math.floor(((xpos - graphics.settings.lmargin) / graphics.metrics.charwidth) + 0.5)
    return ((value < 0) || (value > graphics.settings.zoomlevel)) ? undefined : value;
  },

  getline: function(ypos)
    //this function is slow, there may be better ways to do this for UI-response snappiness
    //for example how the drag and drop code immediately below handles the situation.
  {
    var i = 0;
    for (; i < graphics.lines.length; i++)
      if (graphics.lines[i].translatey > ypos) break;

    return i;
  },

  /////////////////////////////////////////////////////////////////////////////////////////
  //drag and drop function.
/*  dragtarget: {},
  dragline: 0,  //hack to get more responsive drag and drop events.

  registerdrag: function(who)
  {
    dragtarget = who;
    graphics.editor.dom.onmousemove = graphics.dragmove;
    window.onmouseup = graphics.dragfinish;
  },

  unregisterdrag: function()
  {
    dragtarget = null;
    graphics.editor.dom.onmousemove = null;
    window.onmouseup = null;
  },
  
  dragmove: function(event)
  {
    var location = graphics.getlocation(event, graphics.editor.dom);
    var token = new Token("drag");
    token.line = graphics.dragline
    token.linepos = graphics.getpos(location.internalx);
    token.pos = token.line * graphics.settings.zoomlevel + token.linepos;
    token.event = event;
    dragtarget.handletoken(token);
    return false;
  },

  dragfinish: function(event)
  {
    var token = new Token("drop");
    dragtarget.handletoken(token);
    graphics.unregisterdrag();
  },*/


  ///////////////////////////////////////////////////////////////////////////////////////
  //ZOOM VALUES HELPER
  zoomvalues: [50, 75, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 500000, 1000000, 5000000, 10000000],
  zoomstrings: ["50bp","75bp","100bp","200bp","500bp","1kbp","2kbp","5kbp","10kbp","20kbp","50kbp","100kbp","500kbp","1Mbp","5Mbp","10Mbp"],
  zoomarray: [],

  //export the image as svg:
  getsvg: function()
  {
    //TODO: check to see if raphael is in svg mode.
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

  return line;
};

//styling container.
graphics.newcontainer = function(line, _name, anchored)
{
  //if we've passed it a line number, replace it with the actual object.
  if (!isNaN(line)) line = $("#line_" + line)[0];  
  
  container = line.group(_name);
  $.extend(container,
  {
    anchored: (anchored ? true : false), //looks silly but makes it an explicit bool instead of a "false type"

    leftpadding: 0,
    rightpadding: 0,
    toppadding: 0,
    bottompadding: 0,

    paddedBBox: function()
    {
      var box = dali.rect();
      box.left = this.left - this.leftpadding;
      box.top = this.top - this.toppadding;
      box.right = this.right + this.rightpadding;
      box.bottom = this.bottom + this.bottompadding;
      return box;
    }
  });

  return container;
};

//generalized fragment

graphics.Fragment = function(_line, _start, _end, _orientation)
{
  $.extend(this,
  {
    line: _line,
    start: _start,
    end: _end,
    orientation: _orientation,
  });
};

graphics.Span = function(range)
{
  $.extend(this,
  {
    start_l: Math.floor((range.start)/graphics.settings.zoomlevel),
    start_p: (range.start)%graphics.settings.zoomlevel, 
    end_l: Math.floor((range.end)/graphics.settings.zoomlevel),
    end_p: (range.end)%graphics.settings.zoomlevel,
  });

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

  //these getters apply the deltax and deltays to the box variables.
  this.__defineGetter__("left",function() {return left + this.deltax;});
  this.__defineGetter__("top",function() {return top + this.deltay;});
  this.__defineGetter__("right",function() {return right + this.deltax;});
  this.__defineGetter__("bottom",function() {return bottom + this.deltay;});

  $.extend(this,
  {
    deltax: 0,
    deltay: 0,
    leftpadding: template.leftpadding,
    rightpadding: template.rightpadding,
    bottompadding: template.bottompadding,
    toppadding: template.toppadding,
    ref: template,
    brand: function() {this.ref.applytransform(new dali.Translate(this.deltax, this.deltay), true);},
    overlaps: function(box)
    {
      return !((box.left > this.right) || 
               (box.right < this.left) || 
               (box.top > this.bottom) || 
               (box.bottom < this.top));
    }
  });
}
