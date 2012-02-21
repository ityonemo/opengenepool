var graphics =
{
  //various variables that we'll be keeping track of.
  //NB: these cannot remain zero, will be set in initialize method.
  metrics: {linewidth: 0, lineheight: 0, charwidth: 0, blockwidth: 0, fullwidth: 0, fullheight: 0},
  settings: {vmargin: 0, lmargin:0, rmargin: 0, zoomlevel: 0, textsequence: false},  
  linecount: 0,

  //editor is a two-tuple of the DOM object itself and the raphael-generated paper object.
  editor: {dom:{}, paper:{}},

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
    graphics.editor.dom = document.getElementById("editor");
    graphics.editor.paper = Raphael("editor");

    //register the onresize() function
    window.onresize = graphics.onresize;

    //pull the settings data from the database.  This should be formatted as json.
    //then execute the callback function.
    $.getJSON("/graphics_settings.js",function(json){graphics.settings = json; editor.graphicsinitcallback();});
  },

  newsequence: function()
  //this function initializes the the lines array ready to be populated by the various plugins.
  {
    //first set the linescount based on the sequence and the characters per line.
    graphics.linecount = Math.ceil(editor.sequence.length / graphics.settings.zoomlevel);

    //create the lines objects.
    for (var i = 0; i < graphics.linecount; i++)
    {
      graphics.lines[i] = new Line();
    };
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
    graphics.metrics.fullheight = graphics.editor.dom.clientHeight;
    graphics.metrics.fullwidth = graphics.editor.dom.clientWidth;

    //register the graphics space with the Raphael engine.  Only change the width.  Height could depend on content.
    currentheight = graphics.editor.paper.height;
    graphics.editor.paper.setSize(graphics.metrics.fullwidth, currentheight);

    //USING THE TEXT ENGINE AS A METRICS SYSTEM.
    //first make the teststring and initialize various important variables.
    var testline = graphics.editor.paper.text(graphics.settings.lmargin,graphics.settings.vmargin,this.teststring());
    testline.attr("class","sequence");
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
 
  invalidateall: function()
  {
    for (var i = 0; i < graphics.lines.length; i++)
    {
      graphics.lines[i].invalid = true;
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

  //TODO:  Go back over and check this function, was copied wholesale from the
  // original DNAutics codebase.
  { 
    //iterate over the lines array
    for (var i = 0; i < graphics.lines.length; i++)
    {
      //check to see if this line has been invalidated.
      if (graphics.lines[i].invalid)
      {
        //nuke the contents of the line.  Raphael doesn't provide a recursive remove, so we
        //have to do it stage by stage, plus we want the line's set to still be associated
        //with the paper.
        graphics.lines[i].content.forEach(function(who){who.remove();});
        graphics.lines[i].content.clear();
        
        //first save the translatey variable
        //var oldposition = graphics.lines[i].translatey;

        //push a redraw token to the plugins
        redrawtoken = new Token("redraw");
        redrawtoken.line = i;
        editor.broadcasttoken(redrawtoken);
        
        //POSTCONDITION:  None of the plugins have any need
        //to deal with generation of graphics objects.  Graphics
        //plugin can safely layout the content delivered to the elements array. 

        //layout this array.
        graphics.layout(i);

        //figure out how much we need to move
//        var deltay = graphics.lines[i].translatey - oldposition;

        //if it's nonzero
//        if (deltay != 0)
//        { //go through and nudge all of the other lines.
//          for(var j = i+1; j < graphics.lines.length; j++)
//          {
//            graphics.lines[j].translatey += deltay;
//            graphics.lines[j].content.translate(0, deltay);
//          }
//        }

        //disinvalidate the array element. 
//        graphics.lines[i].invalid = false;
      };
    };

    
    var lastline = graphics.lines.length - 1;
    var lastbox = graphics.lines[lastline].content.getBBox();
    var fullheight = lastbox.y + lastbox.height + graphics.settings.vmargin;

    graphics.editor.paper.setSize(graphics.metrics.fullwidth, fullheight);

    //plugins may like to be notify that there has been a redraw event.
    editor.broadcasttoken(new Token("redrawn"))
  },

  layout: function(line)
  {
    //create a local variable to hold the bounding boxes.
    var boxes = [];
    var elements = graphics.lines[line].elements

    //first go through and deal with the anchored content.
    for (var i = 0; i < elements.length; i++)
    {
      if (elements[i].anchored)
      {
        boxes.push(new Box(elements[i].left - elements[i].leftpadding,
                           elements[i].top - elements[i].toppadding, 
                           elements[i].right + elements[i].rightpadding, 
                           elements[i].bottom + elements[i].bottompadding));
      }
    }

    extremetop = 0;

    //find how much we need to move the line.
    graphics.lines[line].translatey = 
      ((line == 0) ? graphics.settings.vmargin : graphics.lines[line-1].translatey) + //prev line
      graphics.metrics.lineheight -                 //plus the last line's sequence
      extremetop;				    //plus the height of this sequence.

    //then translate the entire line.
    graphics.lines[line].content.translate(graphics.lines[line].translatex, graphics.lines[line].translatey)
  }
};

/////////////////////////////////////////////////////////////////////
// HELPER OBJECT DEFINITIONS

Line = function()
{
  return {
    translatex: graphics.settings.lmargin, 
    translatey: graphics.settings.vmargin, 
    content: graphics.editor.paper.set(), //an array of raphael objects.
    elements: [],  //elements is an array of graphicscontainers. 
    invalid: true,
  }
}

//styling container.
GraphicsElement = function(width, height, _anchored)
{
  return {
    content: graphics.editor.paper.set(),
    anchored: (_anchored ? true : false), //looks silly but makes it an explicit bool instead of a "false type"

    left: 0,
    top: 0,
    bottom: height,
    right: width,

    leftpadding: 0,
    rightpadding: 0,
    toppadding: 0,
    bottompadding: 0,

    snapto: function()
    {
      var bbox = this.content.getBBox();
      left = bbox.left;
      top = bbox.top;
      right = bbox.left + bbox.width;
      bottom = bbox.top + bbox.height;
    }
  }
}

//generalized box.
Box = function(_left, _top, _right, _bottom)
{
  return {
    left: _left,
    top: _top,
    right: _right,
    bottom: _bottom,

    //checks to see if this box overlaps a different box
    overlaps: function(otherbox)
    { 
      return this.overlappingranges(this.left, this.right, otherbox.left, otherbox.right) &&
        this.overlappingranges(this.top, this.bottom, otherbox.top, otherbox.bottom)
    },

    //helper function OVERLAPPINGRANGES - checks to see if two ranges [a1-a2],[b1-b2] overlap.
    overlappingranges: function (a1,a2,b1,b2)
    {
      if (a1 > b1)
      { return (a1 < b2); } 
      else
      { return (a2 > b1); }
    }
  }
}
