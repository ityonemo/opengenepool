var graphics = new function Graphics()
{
  $.extend(this,
  {
    //various variables that we'll be keeping track of.
    //NB: these cannot remain zero, will be set in initialize method.
    metrics: {linewidth: 0, lineheight: 0, charwidth: 0, blockwidth: 0, fullwidth: 0, fullheight: 0},
    settings: {vmargin: 0, lmargin:0, rmargin: 0, zoomlevel: 0, linepadding: 0, textsequence: false},  
    linecount: 0,

    //editor is the dali.js generated DOM object.
    editor: {},
    //main layer is a group element that signifies the main layer.
    mainlayer: {},

    //graphics in the editor are organized by sequence line.
    lines: [],
    //a line object contains:
    //  translatey - y component of translation matrix - usually topmargin + offset 
    //  translatex - x component of translation matrix - usually leftmargin
    //  content - raphael set element corresponding to the line.
    //  invalid - boolean, should be called on 'invalidate' call.

    ////////////////////////////////////////////////////////////////////////////////////////
    //INITIALIZATION FUNCTIONS

    // main graphics initialization call.
    initialize: function()
    {
      //associate with the dom object.
      var editordiv = document.getElementById("editor");
      graphics.editor = dali.SVG(editordiv, "editorsvg");
      graphics.mainlayer = graphics.editor.group("mainlayer");

      //register the onresize() function
      window.onresize = graphics.onresize;

      //pull the settings data from the database.  This should be formatted as json.
      //then execute the callback function.
      $.getJSON("/settings/graphics_settings.js", function(json)
      {
        graphics.settings = json;
        graphics.initcallback();
      });
    },

    //upon complete initialization of the graphics routine, then proceed to initialize the plugins.
    //also tell all the components that there is a new sequence.
    initcallback: function()
    {
      graphics.setmetrics();
      graphics.newsequence();
      editor.broadcast(new Token("initialize"));
      editor.broadcast(new Token("newsequence"));
      //graphics.render();
    },

    //ZOOM VALUES HELPER
    zoomvalues: [50, 75, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 500000, 1000000, 5000000, 10000000],
    zoomstrings: ["50bp","75bp","100bp","200bp","500bp","1kbp","2kbp","5kbp","10kbp","20kbp","50kbp","100kbp","500kbp","1Mbp","5Mbp","10Mbp"],
    zoomarray: [],

    newsequence: function()
    //this function initializes the the lines array ready to be populated by the various plugins.
    {
      //first set the linescount based on the sequence and the characters per line.
      graphics.linecount = Math.ceil(editor.sequence.length / graphics.settings.zoomlevel);

      //create the lines objects.
      graphics.lines = [];
      for (var i = 0; i < graphics.linecount; i++)
      {
        graphics.lines[i] = new Line(i);
      };

      //create the zoomer object
      var zoomer = document.getElementById("zoomer");
      graphics.zoomarray = [];
      for (var i = 0; graphics.zoomvalues[i] < editor.sequence.length; i++)
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
    },

    zoom: function(level)
    {
      for (var i = 0; i < graphics.linecount; i++)
      {
        graphics.clearline(i);
      }

      //empty the lines array.
      graphics.lines = [];

      graphics.settings.zoomlevel = level;
      //first set the linescount based on the sequence and the characters per line.
      graphics.linecount = Math.ceil(editor.sequence.length / graphics.settings.zoomlevel);

      //create the lines objects.
      for (var i = 0; i < graphics.linecount; i++)
      {
        graphics.lines[i] = new Line(i);
      };

      //inform the plugins that we have rezoomed.
      //TODO:  FIX THIS.
      editor.broadcast(new Token("setzoom"));

      onresize();
    },

    onresize: function()
    {
      graphics.setmetrics();
      graphics.invalidateall();
      graphics.render();
    },

    //generates a string of "a"s to test the graphics settings.
    teststring: function()
    {
      var s="";
      for(var i = 0; i < graphics.settings.zoomlevel; i++)
      { s += "a";}
      return s;
    },

    setmetrics: function()
    {
      //pull the height and width data
      graphics.metrics.fullheight = graphics.editor.parentNode.clientHeight;
      graphics.metrics.fullwidth = graphics.editor.parentNode.clientWidth;

      //register the graphics space with the Dali engine.  Only change the width.  Height could depend on content.
      graphics.editor.width = graphics.metrics.fullwidth;

      //USING THE TEXT ENGINE AS A METRICS SYSTEM.
      //first make the teststring and initialize various important variables.
      var testline = graphics.editor.text(graphics.settings.lmargin,graphics.settings.vmargin,graphics.teststring());
      //find the bounding-box for the testline.
      var bbox = testline.getBBox();
      //set variables

      //check to see if our settings exceed the actual width.
      if (bbox.width + graphics.settings.lmargin + graphics.settings.rmargin > graphics.metrics.fullwidth)
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
         graphics.metrics.linewidth = bbox.width;
      }

      //set the height and the charwidth - this should be independent of the choice.
      //note "blockwidth" is the width of the original, this should be used for zoom-independent
      //graphics element components, such as arrowhead widths.
      graphics.metrics.lineheight = bbox.height;
      graphics.metrics.charwidth = graphics.metrics.linewidth/graphics.settings.zoomlevel;
      graphics.metrics.blockwidth = bbox.width/graphics.settings.zoomlevel;

      //clear the testline from the page
      testline.remove();
    },

    ///////////////////////////////////////////////////////////////////////////////////////
    //RENDERING FUNCTIONS
 
    clearline: function (line)
    {
      //temporary variable.
      var currentline = graphics.lines[line];

      //go through and remove everything inside the DOM.
      for (i = 0; i < currentline.elements.length; i++)
      {
        currentline.elements[i].remove();
      }
      //clear out the array
      currentline.elements = [];

      //broadcast a message that we have clared the line.
      var clearline = new Token("clearline");
      clearline.line = line;
      editor.broadcast(clearline);
    },

    invalidateall: function()
    {
      for (var i = 0; i < graphics.lines.length; i++)
      {
        graphics.invalidate(i);
      }
    },

    invalidate: function(i)
    //basically a function that passes through and invalidates any given line.
    {
      graphics.lines[i].invalid = true;
    },

    
    render: function()
    //goes through and checks to see if any of the lines are labeled invalid.  
    //Then render these lines.  If rendering said line causes the succeeding 
    //lines to become invalid, invalidate those.

    { 
      //iterate over the lines array
      for (var i = 0; i < graphics.lines.length; i++)
      {
        //check to see if this line has been invalidated.
        if (graphics.lines[i].invalid)
        {
          graphics.clearline(i);

          //push a redraw token to the plugins in response, the plugins
          //should fill in graphics elements to the line referred to in the token.
          redraw = new Token("redraw");
          redraw.line = i;
          editor.broadcast(redraw);
        
          //POSTCONDITION:  None of the plugins have any need
          //to deal with generation of graphics objects.  Graphics
          //plugin can safely layout the content delivered to the elements array. 

          //layout this array.
          graphics.layout(i);
        };
      };
    
      var lastline = graphics.lines[graphics.lines.length - 1];
      var lastbox = lastline.content.getBBox();
      var fullheight = lastline.translatey + lastbox.height + graphics.settings.vmargin;

      graphics.editor.height = fullheight;

      //plugins may like to be notified that we have completed a render event.
      editor.broadcast(new Token("rendered"))
    },

    layout: function(line)
    {
      //create a local variable to hold the bounding boxes.
      var boxes = [];
      var elements = graphics.lines[line].elements;

      //first go through and deal with the anchored content.
      var unanchored = [];     //temporary array identifying content that can be moved.

      for (var i = 0; i < elements.length; i++)
      {
        if (elements[i].anchored)
          boxes.push(elements[i].getBBox());  //put it in our list
        else
          unanchored.push(elements[i]);        //or deal with it next.
      }

      //next go through and deal with the unanchored content.
      for (var i = 0; i < unanchored.length; i++)
      {
        //set a cleared variable.
        var cleared = false;
        while (!cleared)
        {
          cleared = true;  // set this correct, only triggered if we find a problem.
          //scan through the boxes, checking for a collision.
          
          for(var j = 0; j < boxes.length; j++)
          {
            //direct check for a collision.
            if (boxes[j].overlaps(unanchored[i]))
            {
              //we are not cleared.
              cleared = false;
              //now find out how much we have to move the element up.
              var deltay = boxes[j].top - (unanchored[i].bottom + unanchored[i].bottompadding);
              unanchored[i].content.applytransform(new dali.Translate(0, deltay), true);
              unanchored[i].snapto();

              break;  //break out of the for loop and because cleared is false, run through the
            };         //while loop again.
          };
        };

        //since we've cleared, we have to add this item's box to the list of boxes.
        boxes.push(unanchored[i].getBBox());
      }

      var contentbox = graphics.lines[line].content.getBBox();
      var extremetop = -contentbox.y;

      //find how much we need to move the line.  First the bounds of the previous box.
      var prevy = (line == 0) ? 0 : graphics.lines[line - 1].translatey;
      var currentline = graphics.lines[line];
      currentline.translatey = prevy + graphics.settings.linepadding + extremetop;

      //then translate the entire line.
      currentline.content.applytransform(new dali.Translate(currentline.translatex, currentline.translatey), true);
    },

    //////////////////////////////////////////////////////////////////////////
    // pixel-to-position conversions.

    /*

    //take an event mapped to a target and retrieve internal and external x and y coordinates for this event.
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
      {
        if (graphics.lines[i].translatey > ypos) break; 
      }
      return i;
    },

    /////////////////////////////////////////////////////////////////////////////////////////
    //drag and drop function.
    dragtarget: {},
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
  });
};



/////////////////////////////////////////////////////////////////////
// HELPER OBJECT DEFINITIONS

Line = function(_index)
{
  $.extend(this,{
    translatex: graphics.settings.lmargin, 
    translatey: graphics.settings.vmargin, 
    content: graphics.mainlayer.group("line_" + _index),
    elements: [],  //elements is an array of graphicscontainers. 
    invalid: true,
    index: _index,
    reset: function(){translatex = graphics.settings.lmargin; translatey = graphics.settings.vmargin;},

    push: function(who)
    {
      this.elements.push(who);
      //this.content.mouseenter(new Function("graphics.dragline = " + this.index + ";"));
    },
  });
};

//styling container.
GraphicsElement = function(parent, _name, _anchored)
{
  $.extend(this,
  {
    content: parent.group(_name), //this is a reference to the SVG group element contained within this particular graphics element which
                                  //should be handled as a unit.

    anchored: (_anchored ? true : false), //looks silly but makes it an explicit bool instead of a "false type"

    left: 0,
    top: 0,
    bottom: 0,
    right: 0,

    leftpadding: 0,
    rightpadding: 0,
    toppadding: 0,
    bottompadding: 0,

    remove: function()  //pass it on.
    {
      this.content.remove();
    },

    snapto: function()
    {
      var bbox = this.content.getBBox();
      this.left = bbox.left;
      this.top = bbox.top;
      this.right = bbox.right;
      this.bottom = bbox.bottom;
    },

    getBBox: function()
    {
      var box = graphics.editor.createSVGRect();
      box.left = this.left - this.leftpadding;
      box.top = this.top - this.toppadding;
      box.right = this.right + this.rightpadding;
      box.bottom = this.bottom + this.bottompadding;
      return box;
    }
  });
}

//generalized fragment

Fragment = function(_segment, _start, _end, _orientation, _ref)
{
  $.extend(this,
  {
    segment: _segment,
    start: _start,
    end: _end,
    orientation: _orientation,
    ref: _ref,
  });
}
