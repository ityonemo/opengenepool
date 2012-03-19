var selection = new Plugin("selection");

////////////////////////////////////////////////////////////////////////
// MEMBER VARIABLES

selection.clipboard = {};

selection.domain = {};
selection.ranges = [];

selection.selected = false;

selection.animateout = {};
selection.animatein = {};

////////////////////////////////////////////////////////////////////////
// OVERLOADING TOKEN FUNCTIONS

selection.initialize = function()
{
  //make a secret hidden div for buffering copy events.  This is necessary
  //in order to do the injection hack for reverse complements.

  selection.clipboard = document.createElement('div');
  selection.clipboard.setAttribute('display','none');
  selection.clipboard.setAttribute('id','clipdiv');
  document.body.appendChild(selection.clipboard);

  //set up the injection hack.
  document.oncopy = selection.trapclip;

  //set up animation routines.
  selection.animateout = Raphael.animation({opacity:0}, 250, "<>");
  selection.animatein = Raphael.animation({opacity:1}, 250, "<>");
};

selection.contextmenu = function(token)
{
  switch (token.subtype)
  {
//    case "sequence":
//      if ((token.ref.pos >= selection.range.start) && (token.ref.pos <= selection.range.end))
//      {
//        selection.sendcontextmenu(token.x, token.y, selection.range, true);
//      }
//    break;
//    case "selection":
//      editor.addcontextmenuitem(new MenuItem("flip selection", "selection.flip();"));
//    break;
  }
}

selection.unselect = function()
{
  if (selection.selected)
  {
    //clear out the domain object.
    selection.domain = {};
    //go through and eliminate the range objects.
    for(var i = 0; i < selection.ranges.length; i++)
    {
      selection.ranges[i].deleteme();
    }
  }
  selection.selected = false;
}

selection.select = function(token)
{
  selection.unselect();
  selection.domain = new Domain(token.domain.toString());
  //create a copy of the domain object.  You may pass either a string definition or a domain object itself.
  selection.selected = true;
  selection.createranges();
};

selection.redraw = function(token)
{
//  if (selection.selected)
//  {
//    selection.drawoutline();
//    selection.drawhandles(true);
//  };
}

////////////////////////////////////////////////////////////////////////
// DRAG and DROP TOKEN handling.

selection.selectionstart = 0;
selection.currentrange = 0;

selection.startselect = function(token)
{
  selection.unselect();
  selection.domain = new Domain(token.pos.toString());
  selection.selectionstart = token.pos;
  selection.selected = true;
  selection.createranges();
  selection.currentrange = 0;

  graphics.registerdrag(selection);

  //selection.handlef.animate(selection.animateout);
  //selection.handler.animate(selection.animateout);
};

selection.drag = function(token)
{
  var currentrange = selection.ranges[selection.currentrange];

  if (token.pos < selection.selectionstart)
  {
    //first set up the correct color for the selection.
    currentrange.start = token.pos;
    currentrange.end = selection.selectionstart;
    currentrange.orientation = -1;
  }
  else
  {
    currentrange.start = selection.selectionstart;
    currentrange.end = token.pos;
    currentrange.orientation = 1;
  }

  currentrange.draw();
};

//selection.drop = function(token)
//{
//  selection.drawoutline();
//  selection.drawhandles();
//};

//////////////////////////////////////////////////////////////////////////
// GRAPHICS FUNCTIONS




//selection.drawhandles = function(killoldhandles)
//{
//  var sel_span = selection.range.span();
//  var linef = graphics.lines[sel_span.end_s];
//  var liner = graphics.lines[sel_span.start_s];

//  if (killoldhandles)
//  {
//    _oldf = selection.handlef;
//    _oldr = selection.handler;
//    selection.animateout.callback = new Function("_olf.remove(); _oldr.remove(); selection.animateout.callback = null;");

//    selection.handlef.animate(selection.animateout);
//    selection.handler.animate(selection.animateout);

//    selection.handler = graphics.editor.paper.circle(0,0,4);
//    selection.handler.attr("opacity", 0);
//    selection.handlef = graphics.editor.paper.circle(0,0,4);
//    selection.handlef.attr("opacity", 0);

//    selection.handler.drag(selection.handlemove, selection.handlestart, selection.handleend);
//    selection.handlef.drag(selection.handlemove, selection.handlestart, selection.handleend);
//  };

//  var classtext = (selection.range.orientation == -1) ? "reverse_handle" : "forward_handle";
//  selection.handlef.attr("class", classtext);
//  selection.handler.attr("class", classtext);

//  selection.handlef.attr("cx", graphics.settings.lmargin + (sel_span.end_p + 1) * graphics.metrics.charwidth);
//  selection.handlef.attr("cy", linef.translatey - linef.content.getBBox().height/2);
//  selection.handler.attr("cx", graphics.settings.lmargin + sel_span.start_p * graphics.metrics.charwidth);
//  selection.handler.attr("cy", liner.translatey - liner.content.getBBox().height/2);

//  selection.handlef.toFront();
//  selection.handler.toFront();

//  selection.handlef.animate(selection.animatein);
//  selection.handler.animate(selection.animatein);
//}

//selection.drawoutline = function()
//{
//  selection.path.attr("class", (selection.range.orientation == -1) ? "reverse" : "forward");
//  var sel_span = selection.range.span();
//  if (sel_span.start_s == sel_span.end_s)
//  {
//    var xpos = sel_span.start_p * graphics.metrics.charwidth;
//    var height = graphics.lines[sel_span.start_s].content.getBBox().height; 
//    selection.path.attr("d",
//    "M " + xpos + "," + (graphics.lines[sel_span.start_s].translatey - height) +
//    " H " + (sel_span.end_p + 1) * graphics.metrics.charwidth +
//    " v " + height  +
//    " H " + xpos +
//    " Z" //NB there is a bug here because the graphics.lines[].translatey is incorrect AFTER
//    );   //a setzoom() call because it hasn't been subjected to a layout yet.  Need to run a callback that
//  }      //redraws just selections after the redraw event.
//  else
//  {
//    var xpos1 = sel_span.start_p * graphics.metrics.charwidth;
//    var xpos2 = sel_span.end_p * graphics.metrics.charwidth;
//    var ypos1 = graphics.lines[sel_span.start_s].translatey;
//    var ypos2 = graphics.lines[sel_span.end_s].translatey;
//    var height1 = graphics.lines[sel_span.start_s].content.getBBox().height; 
//    var height2 = graphics.lines[sel_span.end_s].content.getBBox().height;

//    selection.path.attr("d",
//    "M " + xpos1 + "," + (ypos1 - height1) +
//    " H " + graphics.metrics.linewidth +
//    " V " + (ypos2 - height2) +
//    " H " + (sel_span.end_p + 1) * graphics.metrics.charwidth +
//    " v " + height2  +
//    " H " + 0 +
//    " V " + ypos1 +
//    " H " + xpos1 +
//    " Z"
//    );
//  }
//};

//////////////////////////////////////////////////////////////////////////
// GENERAL FUNCTIONS

selection.createranges = function()
  //create the selection ranges from the domain
{
  selection.ranges = [];  // first clear all the ranges.
  for (var i = 0; i < selection.domain.ranges.length; i++)
  {
    var currentrange = selection.domain.ranges[i]
    selection.ranges.push(new SelectionRange(currentrange.start, currentrange.end, currentrange.orientation))
  }
};

selection.drawrange = function(path, range)
{
  path.attr("class", (range.orientation == -1) ? "reverse" : "forward");

  var sel_span = range.span();
  if (sel_span.start_s == sel_span.end_s)
  {
    var xpos = sel_span.start_p * graphics.metrics.charwidth;
    var height = graphics.lines[sel_span.start_s].content.getBBox().height; 
    path.attr("d",
      "M " + xpos + "," + (graphics.lines[sel_span.start_s].translatey - height) +
      " H " + (sel_span.end_p) * graphics.metrics.charwidth +
      " v " + height  +
      " H " + xpos +
      " Z" //NB there is a bug here because the graphics.lines[].translatey is incorrect AFTER
    );   //a setzoom() call because it hasn't been subjected to a layout yet.  Need to run a callback that
  }      //redraws just selections after the redraw event.
  else
  {
    var xpos1 = sel_span.start_p * graphics.metrics.charwidth;
    var xpos2 = sel_span.end_p * graphics.metrics.charwidth;
    var ypos1 = graphics.lines[sel_span.start_s].translatey;
    var ypos2 = graphics.lines[sel_span.end_s].translatey;
    var height1 = graphics.lines[sel_span.start_s].content.getBBox().height; 
    var height2 = graphics.lines[sel_span.end_s].content.getBBox().height;

    path.attr("d",
    "M " + xpos1 + "," + (ypos1 - height1) +
    " H " + graphics.metrics.linewidth +
    " V " + (ypos2 - height2) +
    " H " + (sel_span.end_p) * graphics.metrics.charwidth +
    " v " + height2  +
    " H " + 0 +
    " V " + ypos1 +
    " H " + xpos1 +
    " Z"
    );
  }
  path.toBack();
}

//selection.flip = function()
//{
//  selection.range.orientation *= -1;
//  selection.drawoutline();
//  selection.drawhandles();
//}

selection._temp_selection = {};
selection.trapclip = function()
{
  //THIS IS A TOTAL HACK, but it works on CHROME (and probably on firefox)
  //for the copy function to work, we need to put the adjoined text or alternatively
  //the reverse complement text into the secret, hidden "clipboard div" and then 
  //change the selection.
  //we will almost certainly need to make changes to make this work with safari and IE.

  var _sel_actual = window.getSelection();       //named such to prevent confusion with the selection plugin object.
  _sel_actual.removeAllRanges();                 //clear whatever we think is selected.

  selection.clipboard.innerHTML = 
    editor.subsequence(selection.range);

  var temprange = document.createRange();                  //create a new range          
  temprange.selectNodeContents(selection.clipboard);       //assign the range to the hidden div
  _sel_actual.addRange(temprange);
}

///////////////////////////////////////////////////////////////////////////////////
// selection handle drag/drop directives

//selection.handlestart = function (){ $("." + this.attr("class")).css("cursor","col-resize"); };
//selection.handlemove = function (dx, dy, x, y, e){ 
//  var location = graphics.getlocation(e);
//  this.attr({cx:location.svgx, cy:location.svgy});
//  var line = graphics.getline(location.svgy);
//  var linepos = graphics.getpos(location.svgx);
//  var pos = line * graphics.settings.zoomlevel + linepos;

//  if ((this == selection.handler) && (pos <= selection.range.end))
//  {
//    selection.range.start = pos;
//  }
//  if ((this == selection.handlef) && (pos >= selection.range.start))
//  {
//    selection.range.end = pos;
//  }

//  selection.drawoutline();
//};

//selection.handleend = function()
//{ 
//  $("." + this.attr("class")).css("cursor","pointer");
//  this.animate(selection.animateout);
//  selection.drawhandles();
//};

selection.handle = function()
{
  //this graphics element can be overridden.
  //in the case that it's overridden, it will be passed a string:
  //"forward" or "reverse" to allow for different styles of handle.
  //in order to properly reflect the mouse position, the handle should be centered around (0,0).
  return graphics.editor.paper.circle(0,0,4);
}

////////////////////////////////////////////////////////////////////////////////////
// CLASS FUNCTIONS

SelectionHandle = function (generator, position)
{
  var handle =
  {
  };

  return handle;
}

SelectionRange = function (start, end, orientation)
{
  var segment =
  {
    path: graphics.editor.paper.path(""),
    //handlef: new SelectionHandle(new Function("selection.handle('forward');"),'forward'),
    //handler: new SelectionHandle(new Function("selection.handle('reverse');"),'reverse'),
    range: new Range(start, end, orientation),

    draw: function()
    {
      selection.drawrange(this.path, this.range)
    },

    deleteme: function()
    {
      //remove the path from the paper.
      this.path.remove();
      //then take care of the handles
    },

    //outputs the css class for such an annotation
    cssclass: function()
    {
      return [
        "selection reverse",
        "selection undirected",
        "selection forward"][this.range.orientation + 1];
    }
  }

  segment.path.translate(graphics.settings.lmargin, 0);
  segment.path.mousedown(function(e)
  {
    if (!e) var e = window.event;
    if (e.which) rightclick = (e.which == 3);
    else if (e.button) rightclick = (e.button == 2);

    if (rightclick)
    {
      selection.sendcontextmenu(e.clientX, e.clientY, selection.range);
    }
  })

  segment.draw();
  //brand the path.
  segment.path.attr("class", segment.cssclass());

  //selection.handler.drag(selection.handlemove, selection.handlestart, selection.handleend);
  //selection.handlef.drag(selection.handlemove, selection.handlestart, selection.handleend);

  return segment;
}

/////////////////////////////////////////////////////////////////////
// GLOBAL HELPER FUNCTION

select = function(spec)
{
  var token = new Token("select");
  token.domain = spec;
  editor.broadcasttoken(token);
}

