var selection = new Plugin("selection");

////////////////////////////////////////////////////////////////////////
// MEMBER VARIABLES

selection.clipboard = {};

selection.domain = {};
selection.ranges = [];

selection.isselected = false;

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
  if (!selection.isselected)
    editor.addcontextmenuitem(new MenuItem("select all", "select('0.." + editor.sequence.length + "');"));

  switch (token.subtype)
  {
    case "sequence":
      if (selection.isselected)
      {
        for (var i = 0; i < selection.domain.ranges.length; i++)
        {
          if ((token.ref.pos >= selection.domain.ranges[i].start) && (token.ref.pos <= selection.domain.ranges[i].end))
          {
            selection.sendcontextmenu(token.x, token.y, selection.domain.ranges[i], null, true);
          }
        }
      }
    break;
    case "selection":
      if (selection.isselected)
      {
        editor.addcontextmenuitem(new MenuItem("select none", "selection.unselect();"));
        if (selection.domain.ranges.length == 1)
          editor.addcontextmenuitem(new MenuItem("fork selection", "selection.fork();"));
      }

//      switch (token.ref.orientation)
//      {
 //       case -1, 1:
//          editor.addcontextmenuitem(new MenuItem("switch selection strand", ""));
//          editor.addcontextmenuitem(new MenuItem("make selection undirected", ""));
 //       break;
 //       case 0:
 //         editor.addcontextmenuitem(new MenuItem("set selection to plus strand", ""));
 //         editor.addcontextmenuitem(new MenuItem("set selection to minus strand", ""));
  //      break;
    //  }
    break;
  }
}

selection.unselect = function()
{
  if (selection.isselected)
  {
    selection.isselected = false;
    //clear out the domain object.
    selection.domain = {};
    //go through and eliminate the range objects.
    for(var i = 0; i < selection.ranges.length; i++)
    {
      selection.ranges[i].deleteme();
    }
    selection.ranges = [];
  }
}

selection.select = function(token)
{
  selection.unselect();
  selection.domain = new Domain(token.domain.toString());
  //create a copy of the domain object.  You may pass either a string definition or a domain object itself.
  selection.isselected = true;
  selection.createranges();
  for (var i = 0; i < selection.ranges.length; i++)
  {
    selection.ranges[i].showhandles();
  }

  editor.broadcasttoken(new Token("selected"));
};

selection.redrawn = function(token)
{
  //selection may need to be redrawn.
  if (selection.isselected)
  {
    for (var i = 0; i < selection.ranges.length; i++)
    {
      selection.ranges[i].hidehandles();
      selection.ranges[i].draw();
      selection.ranges[i].showhandles();
    };
  };
}

////////////////////////////////////////////////////////////////////////
// DRAG and DROP TOKEN handling.

selection.selectionstart = 0;
selection.currentrange = 0;
selection.draglowlimit = 0;
selection.draghighlimit = 0;

selection.startselect = function(token)
{
  selection.unselect();
  selection.domain = new Domain(token.pos.toString());
  selection.selectionstart = token.pos;
  selection.isselected = true;
  selection.createranges();
  selection.currentrange = 0;
  selection.draglowlimit = 0;
  selection.draghighlimit = editor.sequence.length;

  graphics.registerdrag(selection);
};

selection.addselect = function(token)
{
  if (!selection.isselected)  //just in case we're being asked to 
    selection.domain = new Domain(token.pos.toString());
  else if (selection.domain.contains(token.pos))
    return; //empty handed.
  else
    selection.domain.ranges.push(new Range(token.pos, token.pos, 0));

  selection.selectionstart = token.pos;
  selection.isselected = true;
  selection.createranges();
  selection.currentrange = selection.domain.ranges.length - 1;
  
  for (var i = 0; i < selection.ranges.length; i++)
  {
    selection.ranges[i].showhandles();

    //deal with resetting the high and low limits
    var thisrange = selection.domain.ranges[i]
    selection.draglowlimit = (((thisrange.end < token.pos) && (thisrange.end > selection.draglowlimit)) ? thisrange.end : selection.draglowlimit)
    selection.draghighlimit = (((thisrange.start > token.pos) && (thisrange.start < selection.draghighlimit)) ? thisrange.start : selection.draghighlimit)
  }

  graphics.registerdrag(selection);
}

selection.drag = function(token)
{
  if ((token.pos > selection.draghighlimit) || (token.pos < selection.draglowlimit)) return;  //empty-handed.
  var currentrange = selection.ranges[selection.currentrange];
  
  var oldorientation = currentrange.range.orientation;

  if (token.pos < selection.selectionstart)
  {
    //first set up the correct color for the selection.
    currentrange.range.start = token.pos;
    currentrange.range.end = selection.selectionstart;
    if (oldorientation != -1)
    {
      currentrange.range.orientation = -1;
      currentrange.path.attr("class",currentrange.cssclass());
    }
  }
  else
  {
    currentrange.range.start = selection.selectionstart;
    currentrange.range.end = token.pos;
    if (oldorientation != 1)
    {
      currentrange.range.orientation = 1;
      currentrange.path.attr("class", currentrange.cssclass());
    }
  }

  currentrange.draw();
};

selection.drop = function(token)
{
  //copy data from the isselected range object to the selection domain object.
  selection.synchronize();

  //unregister the region from recieving drag/drop notifications.
  graphics.unregisterdrag();

  //show the handles.
  selection.ranges[selection.currentrange].showhandles();
};

//////////////////////////////////////////////////////////////////////////
// GENERAL FUNCTIONS

selection.synchronize = function()
{
  //prepare to copy data from the isselected range to the domain.
  var src = selection.ranges[selection.currentrange].range;
  var dest = selection.domain.ranges[selection.currentrange];
  //synchronize the isselected region with that in the domain object.
  dest.start = src.start;
  dest.end = src.end;
  dest.orientation = src.orientation;
}

selection.createranges = function()
  //create the selection ranges from the domain
{
  // first clear all the ranges.
  for (var i = 0; i < selection.ranges.length; i++)
  {
    selection.ranges[i].deleteme();
  }
  selection.ranges = [];

  for (var i = 0; i < selection.domain.ranges.length; i++)
  {
    var currentrange = selection.domain.ranges[i];
    var newrange = new SelectionRange(currentrange.start, currentrange.end, currentrange.orientation)
    if (selection.domain.ranges.length > 1)
      newrange.tag = selection.tag(i + 1);
    selection.ranges.push(newrange);
  }
};

selection.drawrange = function(path, range)
{
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
  _sel_actual.removeAllRanges();                 //clear whatever we think is isselected.

  selection.clipboard.innerHTML = 
    editor.subsequence(selection.domain);

  var temprange = document.createRange();                  //create a new range          
  temprange.selectNodeContents(selection.clipboard);       //assign the range to the hidden div
  _sel_actual.addRange(temprange);
}

///////////////////////////////////////////////////////////////////////////////////
// selection handle drag/drop directives

selection.handle_sstart = function ()
{
  this.movedhandle="start";
  selection.handlestart(this);
};

selection.handle_estart = function ()
{
  this.movedhandle="end";
  selection.handlestart(this);
};

selection.handlestart = function(who)
{
  who.ambiguoushandle = (who.range.start == who.range.end);
  who.ambiguousinit = who.range.start;  //could actually be either
  who.handle_e.attr("cursor","col-resize");

  //now, figure out who got clicked.
  selection.currentrange = selection.ranges.indexOf(who);
}

selection.handlemove = function (dx, dy, x, y, e)
{ 
  var location = graphics.getlocation(e);
  (this.movedhandle == "start" ? this.handle_s : this.handle_e).transform(
        "T"+ location.svgx + "," + location.svgy);
  var line = graphics.getline(location.svgy);
  var linepos = graphics.getpos(location.svgx);
  var pos = line * graphics.settings.zoomlevel + linepos;

  //calculate the correct position created by the handle. 
  if (this.ambiguoushandle)
  {
    if (pos <= this.ambiguousinit)
    {
      this.range.start = pos;
      this.range.end = this.ambiguousinit;
    } else
    {
      this.range.end = pos;
      this.range.start = this.ambiguousinit;
    }
  }
  else
  {
    //if we have a normal, non-contracted range.
    if ((this.movedhandle == "start") && (pos <= this.range.end))
    {
      this.range.start = pos;
    }
    if ((this.movedhandle == "end") && (pos >= this.range.start))
    {
      this.range.end = pos;
    }
  }

  //redraw the selection border.
  this.draw();
};


selection.handleend = function()
{
  //reset the handle position.
  this.hidehandles();
  this.showhandles();

  selection.synchronize();
};


////////////////////////////////////////////////////////////////////////////////////
// CLASS FUNCTIONS

selection.handle = function (position)
{
  return graphics.editor.paper.circle(0,0,4);
};

selection.tag = function (i)
{
  var tagtext = graphics.editor.paper.text(0,-2,i.toString());
  var textbox = tagtext.getBBox();
  var tagbox = graphics.editor.paper.rect(-(textbox.width/2), -(textbox.height/2)-2, textbox.width, textbox.height);
  tagtext.attr("class","sel_tag text");
  tagbox.attr("class","sel_tag box");
  var tagset = graphics.editor.paper.set();
  tagset.push(tagbox,tagtext);
  return tagset;
};

SelectionRange = function (start, end, orientation)
{
  var segment =
  {
    path: graphics.editor.paper.path(""),
    handle_s: selection.handle('start'),
    handle_e: selection.handle('end'),
    tag: undefined,

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
      this.handle_s.animate(selection.animateout);
      this.handle_e.animate(selection.animateout);
      //take care of tag (if necessary)
      if (this.tag)
        this.tag.animate(selection.animateout);

      var _sel_todelete = this;
      window.setTimeout(function()
        { _sel_todelete.handle_s.remove(); _sel_todelete.handle_e.remove(); if (_sel_todelete.tag) {_sel_todelete.tag.remove();};}, 250);
    },

    showhandles: function()
    {
      var sel_span = this.range.span();

      this.handle_s.transform(
        "T"+(sel_span.start_p*graphics.metrics.charwidth + graphics.settings.lmargin)+
        ","+(graphics.lines[sel_span.start_s].translatey - graphics.lines[sel_span.start_s].content.getBBox().height/2)
      );
      this.handle_e.transform(
        "T"+(sel_span.end_p*graphics.metrics.charwidth + graphics.settings.lmargin)+
        ","+(graphics.lines[sel_span.end_s].translatey - graphics.lines[sel_span.end_s].content.getBBox().height/2)
      );

      this.handle_s.attr("class", this.hcssclass());
      this.handle_e.attr("class", this.hcssclass());

      this.handle_s.toFront();
      this.handle_e.toFront();

      if (this.tag)
      {
        this.tag.transform(
          "T"+(sel_span.start_p*graphics.metrics.charwidth + graphics.settings.lmargin)+
          ","+(graphics.lines[sel_span.start_s].translatey - graphics.lines[sel_span.start_s].content.getBBox().height)
        );
        this.tag.toFront();
        this.tag.animate(selection.animatein);
      }

      this.handle_s.animate(selection.animatein);
      this.handle_e.animate(selection.animatein);
    },

    hidehandles: function()
    {
      if (this.tag)
      {
        this.tag.toFront();
        this.tag.animate(selection.animateout);
      }

      this.handle_s.animate(selection.animateout);
      this.handle_e.animate(selection.animateout);
    },

    //which handle has been moved last.
    movedhandle: "",
    //are we unsure because we started with a collapsed handle?
    ambiguoushandle: false,
    ambiguousinitial: 0,

    hcssclass: function()
    {
      return [
        "sel_handle reverse",
        "sel_handle undirected",
        "sel_handle forward"][this.range.orientation + 1];
    },

    //outputs the css class for such an annotation
    cssclass: function()
    {
      return [
        "selection reverse",
        "selection undirected",
        "selection forward"][this.range.orientation + 1];
    },
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

  //disappear the handles.
  segment.handle_s.attr("opacity","0");
  segment.handle_e.attr("opacity","0");

  segment.handle_s.drag(selection.handlemove, selection.handle_sstart, selection.handleend, segment);
  segment.handle_e.drag(selection.handlemove, selection.handle_estart, selection.handleend, segment);

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

