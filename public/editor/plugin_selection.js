var selection = new editor.Plugin("selection",
{
  ////////////////////////////////////////////////////////////////////////
  // MEMBER VARIABLES

  clipboard: {},
  domain: {},

  //graphics object corresponding to our graphics layer and the floater layer.
  layer: {},
  floater: {},

  isselected: false,

  animateout: {},
  animatein: {},

  //our little merge bubble UI.
  mergebubble: {},

  ////////////////////////////////////////////////////////////////////////
  // OVERLOADING TOKEN FUNCTIONS
  initialize: function()
  {
    //make a secret hidden div for buffering copy events.  This is necessary
    //in order to do the injection hack for reverse complements.

    selection.clipboard = document.createElement('div');
    selection.clipboard.setAttribute('display','none');
    selection.clipboard.setAttribute('id','clipdiv');
    document.body.appendChild(selection.clipboard);

    //create appropriate graphics layers:
    if (!($("#selectionlayer").length))
      selection.layer = graphics.editor.group("selectionlayer");
    else
      selection.layer = $("#selectionlayer")[0];
    //order this layer to be at the bottom:
    graphics.editor.insertBefore(selection.layer, graphics.mainlayer);
    
    if (!($("#floaterlayer").length))
      selection.floater = graphics.editor.group("floaterlayer");
    else
      selection.floater = $("#floaterlayer")[0];
    //put this at the top.
    graphics.editor.appendChild(selection.floater);

    //set up the injection hack.
    document.oncopy = selection.trapclip;

    //our little merge bubble UI.
    //selection.mergebubble = new MergeBubble();
    //selection.mergebubble.initialize();
  },

  /////////////////////////////////////////////////////////////////////////
  // TOKENS PUBLISHED BY SELECTION
  unselect: function()
  {
    if (selection.isselected)
    {
      //clear out the graphics elements.
      for(var i = 0; i < selection.domain.ranges.length; i++)
        selection.domain.ranges[i].deleteme();
      //reset the selection flag.
      selection.isselected = false;
      //clear out the domain object.
      selection.domain = {};	
    }
  },

  select: function(token)
  {
    selection.unselect();

    //create the new domain object.
    selection.domain = new Domain(token.domain);
    for (var i = 0; i < selection.domain.ranges.length; i++)
    {
      var range = selection.domain.ranges[i];
      $.extend(range, new selection.RangeExtension(selection.domain.ranges[i]));
      range.draw();
      range.showwidgets();
    }

    selection.isselected = true;

    editor.broadcast("selected");
  },

  selectall: function(token)
  {
    //overwrite the token domain spec.
    token.domain= "0.." + editor.sequence.length;
    //pass it to the select function.
    selection.select(token);
  },

  rendered: function(token)
  {
    //gets called after a render() event.  In this case, the selection may need to be redrawn.
    if (selection.isselected)
      for (var i = 0; i < selection.domain.ranges.length; i++)
      {
        var range = selection.domain.ranges[i];
        range.hidewidgets();
        range.draw();
        range.showwidgets();
      };
  },

  ///////////////////////////////////////////////////////////////////////////////////
  // NON-TOKEN FUNCTIONS

  ///////////////////////////////////////////////////////////////////////////////////
  // clipboard trapping.

  _temp_selection: {},
  trapclip: function()
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
  },

  //target for menu actions.
  target: undefined,
  contextmenu: function(token)
  {
    editor.addcontextmenuitem(new editor.MenuItem());  //menu break

    if (!selection.isselected)
      editor.addcontextmenuitem(new editor.MenuItem("select all", selection.selectall))
    else if (token.source != "selection") // this prevents this menu item from being doubled because of how selection duplicates the token.
      editor.addcontextmenuitem(new editor.MenuItem("select none", selection.unselect));

    switch (token.source)
    {
      case "sequence":
        if (selection.isselected)
        {
          /*
          for (var i = 0; i < selection.domain.ranges.length; i++)
          {
            if ((token.ref.pos >= selection.domain.ranges[i].start) && (token.ref.pos <= selection.domain.ranges[i].end))
              selection.sendcontextmenu(token.x, token.y, selection.ranges[i], null, true);
            if (selection.domain.contains(token.ref.pos))
              editor.addcontextmenuitem(new MenuItem("split selection range", "selection.splitdomain(" + token.ref.pos + ");"));
          }*/

          //throw a second request on top that replicates the token except via selection.
          //first check to see if the token position is in current selection.
          if (selection.domain.contains(token.pos))
          {
            var j = 0;
            for(; j < selection.domain.ranges.length; j++)
              if (selection.domain.ranges[j].contains(token.pos))
                token.ref = selection.domain.ranges[j];
            selection.broadcast(token);
          }
        }
      break;
      case "selection":
        //if (selection.domain.ranges.length == 1)
        //  editor.addcontextmenuitem(new MenuItem("fork selection", "selection.fork();"));

        selection.target = token.ref;

        switch (token.ref.orientation)
        {
          case -1:
          case 1:
            editor.addcontextmenuitem(new editor.MenuItem("flip selection strand", selection.flip));
            editor.addcontextmenuitem(new editor.MenuItem("make selection undirected", selection.undirect));
          break;
          case 0:
            editor.addcontextmenuitem(new editor.MenuItem("set selection to plus strand", selection.toplus));
            editor.addcontextmenuitem(new editor.MenuItem("set selection to minus strand", selection.tominus));
          break;
        }

        //various selection tools that are only invoked if there are more than one selection ranges.
        if (selection.domain.ranges.length > 1)
        {
          editor.addcontextmenuitem(new editor.MenuItem());  //menu break
          editor.addcontextmenuitem(new editor.MenuItem("delete selection range", selection.delrange));
          editor.addcontextmenuitem(new editor.MenuItem("move selection range up", selection.moveup));
          editor.addcontextmenuitem(new editor.MenuItem("move selection range down", selection.movedown));
          editor.addcontextmenuitem(new editor.MenuItem("make first selection range", selection.movefirst));
          editor.addcontextmenuitem(new editor.MenuItem("make last selection range", selection.movelast));
        }
      break;
      case "annotations":
        if (selection.isselected)
          if (selection.ranges.length == 1)
          {
            var target = selection.target = token.ref;

            alert("hi dad " + target.ranges.length);

            //calculate the absolute bounds of the particular annotation.
            var refstart = editor.sequence.length;
            var refend = 0;
            for (var i = 0; i < target.ranges.length; i++)
            {
              refstart = Math.min(refstart, target.ranges[i].start);
              refend = Math.max(refend, target.ranges[i].end);
            }

            var start = selection.domain.ranges[0].start;
            var end = selection.domain.ranges[0].end;

            if (!((start >= refstart) && (end <= refend)))
              editor.addcontextmenuitem(new MenuItem("encompass this annotation", selection.encompass));

            if (!((ourrange.start >= start) && (ourrange.end <= end)))
              editor.addcontextmenuitem(new editor.MenuItem("select up to annotation", selection.selupto));
            else if (!((ourrange.start >= start) && (ourrange.end <= end)))
              editor.addcontextmenuitem(new editor.MenuItem("subtract this annotation", selection.subtract));

          }
        else //offer to add to the selection
          editor.addcontextmenuitem(new editor.MenuItem("select this annotation", function(){}));
      break;
    }
  },

  showtags:function()
  {    
    if (selection.domain.ranges.length > 1)
    for (var i = 0; i < selection.domain.ranges.length; i++)
    {
      var range = selection.domain.ranges[i];
      var sel_span = new graphics.Span(range);

      if (range.tag)
        range.tag.hide(range.tag.remove);

      range.tag = selection.createtag(i + 1);
      range.tag.applytransform(
        dali.translate(sel_span.start_p*graphics.metrics.charwidth + graphics.settings.lmargin, graphics.line(sel_span.start_l).top)
      );
      range.tag.show();
    }
  }
});



/*
selection.appendselect = function(token)
{
  for (var i = 0; i < token.domain.ranges.length; i++)
  {
    var myrange = token.domain.ranges[i];
    var pushrange = new Range(myrange.start, myrange.end, myrange.orientation);
    for (var j = selection.domain.ranges.length - 1; j >= 0; j--)
    {
      var selrange = selection.domain.ranges[j];
      if (pushrange.overlaps(selrange))
      {
        //combine the two ranges, giving the pre-selected orientation priority
        //NB for certain range selections, this may be buggy, but those are not real use cases.
        pushrange.start = Math.min(pushrange.start, selrange.start);
        pushrange.end = Math.max(pushrange.end, selrange.end);
        pushrange.orientation = selrange.orientation;
        //slice out the selection range from the selection.
        selection.domain.ranges.splice(j,1);
      }
    }
    selection.domain.ranges.push(pushrange);
  }
  selection.createranges();
}

*/

////////////////////////////////////////////////////////////////////////
// DRAG and DROP TOKEN handling.

selection.anchor = 0;
selection.draglowlimit = 0;
selection.draghighlimit = 0;

selection.startselect = function(token)
{
  selection.unselect();
  selection.domain = new Domain(token.pos.toString());
  selection.anchor = token.pos;
  selection.isselected = true;
  selection.draglowlimit = 0;
  selection.draghighlimit = editor.sequence.length;

  var range = selection.domain.ranges[0];
  $.extend(range, new selection.RangeExtension(selection.domain.ranges[0]));
  range.draw();

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

  selection.anchor = token.pos;
  selection.isselected = true;
  selection.draglowlimit = 0;
  selection.draghighlimit = editor.sequence.length;

  //deal with resetting the high and low limits
  for (var i = 0; i < selection.domain.ranges.length - 1; i++)
  {
    var thisrange = selection.domain.ranges[i];
    selection.draglowlimit = (((thisrange.end <= token.pos) && (thisrange.end > selection.draglowlimit)) ?
      thisrange.end : selection.draglowlimit)
    selection.draghighlimit = (((thisrange.start >= token.pos) && (thisrange.start < selection.draghighlimit)) ?
      thisrange.start : selection.draghighlimit)
  }

  var range = selection.domain.ranges[selection.domain.ranges.length - 1];
  $.extend(range, new selection.RangeExtension(selection.domain.ranges[0]));
  range.draw();

  graphics.registerdrag(selection);
}

selection.drag = function(token)
{
  if ((token.pos > selection.draghighlimit) || (token.pos < selection.draglowlimit)) return;  //empty-handed.
  var range = selection.domain.ranges[selection.domain.ranges.length - 1]; //our working range is always the last range.

  var oldorientation = range.orientation;
  if (token.pos < selection.anchor) //we should have a reverse orientation.
  {
    range.start = token.pos;
    range.end = selection.anchor;
    //reset the orientation.
    if (oldorientation != -1)
    {
      range.orientation = -1;
      $(range.path).attr("class", range.cssclass());
    }
  }
  else  //we should have a forward orientation.
  {
    range.start = selection.anchor;
    range.end = token.pos;
    if (oldorientation != 1)
    {
      range.orientation = 1;
      $(range.path).attr("class", range.cssclass());
    }
  }
  range.draw();
};

selection.drop = function(token)
{
  //show the handles.
  selection.domain.ranges[selection.domain.ranges.length - 1].showwidgets();
};

//////////////////////////////////////////////////////////////////////////
// GENERAL FUNCTIONS

//selection range manipulation functions.

selection.flip = function()
{
  selection.target.orientation *= -1;
  selection.target.draw();
  selection.target.sethandlecss();
}
selection.undirect = function()
{
  selection.target.orientation = 0;
  selection.target.draw();
  selection.target.sethandlecss();
}
selection.toplus = function()
{
  selection.target.orientation = 1;
  selection.target.draw();
  selection.target.sethandlecss();
}
selection.tominus = function()
{
  selection.target.orientation = -1;
  selection.target.draw();
  selection.target.sethandlecss();
}

///////////////////////////////////////////////////////////////////////////////////
// annotations gymnastics

selection.encompass = function() 
{
  var selrange = selection.domain.ranges[0];
  selrange.start = Math.min(selrange.start, target.start);
  selrange.end = Math.max(selrange.end, target.end);
}

selection.subtract = function() 
{
  var selrange = selection.domain.ranges[0];

  if ((target.start > selrange.start) && (target.end < selrange.end))
  {
    var orientation = selrange.orientation;
    //gonna have to split it into two!
    if (orientation >= 0)
    {
      selection.domain.ranges.push(new Range(target.end, selrange.end, orientation));
      selrange.end = target.start;
    } else
    {
      selection.domain.ranges.push(new Range(selrange.start, target.start, orientation));
      selrange.start = target.end;
    }
  } else
  {
    //contract as appropriate.
    if (selrange.end > target.end)
      selrange.start = target.end;
    else //(selstart < start)
      selrange.end = target.start;
  }
}

selection.selupto = function() 
{
  var selrange = selection.domain.ranges[0];
  
  if (selrange.start > target.end)
    selrange.start = target.end;
  else // selend < start
    selrange.end = target.start;

}

///////////////////////////////////////////////////////////////////////////////////
// selection handle drag/drop directives

selection.handlestart = function(event)
{
  //figure out which handle is being moved.
  var handle = dali.dragobject;

  //set the cursor to the handle to be the left/right cursor.
  $(handle).css("cursor","col-resize");

  //set the absolute maximum high and low limits for the selection.
  handle.draglowlimit = (handle.position == 1) ? handle.ref.start : 0;
  handle.draghighlimit = (handle.position == -1) ? handle.ref.end : editor.sequence.length;
  handle.lastpos = (handle.position == -1 ? handle.ref.start : handle.ref.end) //determine the current position.

  //set the anchor for the handle.
  handle.ambiganchor = handle.ref.start; //(choice is arbitrary since this is used only if it started off ambiguously)

  //seek through the domain-ranges and determine if we need to change the limits.
  for (var i = 0; i < selection.domain.ranges.length; i++)
  {
    var range = selection.domain.ranges[i];
    if (range !== handle.ref)
    {
      //do we need to reset the low limit.
      handle.draglowlimit = (((range.end > handle.draglowlimit) && (range.end <= handle.lastpos)) ?
        range.end : handle.draglowlimit);
      //do we need to reset the high limit?
      handle.draghighlimit = (((range.start < handle.draghighlimit) && (range.start >= handle.lastpos)) ?
        range.start : handle.draghighlimit);
    }
  }

  //disappear the tag in case we are using the start handle.
  if ((handle.position == -1) && (handle.ref.tag))
  {
    handle.ref.tag.hide(function(){handle.ref.tag.remove(); handle.ref.tag = undefined;});
  }
}

selection.handlemove = function (x, y, event)
{ 
  var handle = dali.dragobject;
  //move the handle to the correct position.
  handle.applytransform(dali.translate(x,y), true);
  var line = graphics.getline(y);
  var linepos = graphics.getpos(x);
  var pos = line * graphics.settings.zoomlevel + linepos;

  if ((pos >= handle.draglowlimit) && (pos <= handle.draghighlimit))
  {
    switch (handle.position)
    {
      //this depends on the current position of the handle.
      case 0: //ambiguous due to overlap.
        if (pos < handle.ambiganchor)
        {
          handle.ref.start = pos;
          handle.ref.end = handle.ambiganchor;
        }
        else
        {
          handle.ref.start = handle.ambiganchor;
          handle.ref.end = pos;
        }
      break;
      case -1: //start handle
        handle.ref.start = pos;
      break;
      case 1: //end handle
        handle.ref.end = pos;
      break;
    }
  }

  //calculate the correct position created by the handle. 
  /*if (handle.position == 0)
  {
    /*if ((pos >= selection.draglowlimit) && (pos <= selection.draghighlimit))
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
  }*/

  //redraw the selection border.
  handle.ref.draw();
};

selection.handleend = function()
{
  var handle = dali.dragobject;
  
  handle.ref.hidewidgets();
  handle.ref.showwidgets();

  $(handle).css("cursor","");

  //run a check to see if we're going to have an overlapping handle problem.  First the start handle
/*  if ((handle.position == -1) || ((handle.position == 0) && (handle.ref.end == handle.ambiganchor)))
    if (handle.ref.start == selection.draglowlimit)
    {
      for (var i = 0; i < selection.domain.ranges.length; i++) //now run through the ranges and look for the range that shares the overlap.
        if (selection.domain.ranges[i].end == this.range.start)
        {
          this.overlapstart = i;
          selection.ranges[i].overlapend = thisrange;
        }
    } else
    {
      //make sure we clear the overlapstart/overlapend variables
      if (this.overlapstart >= 0)
      {
        selection.ranges[this.overlapstart].overlapend = -1;
        this.overlapstart = -1;
      }
    }*/
/*
  //now the end handle
  if ((this.movedhandle == "end") || ((this.ambiguoushandle) && (this.range.start == this.ambiguousinit)))
    if (this.range.end == selection.draghighlimit)
    {
      for (var i = 0; i < selection.domain.ranges.length; i++) //now run through the ranges and look for the range that shares the overlap.
        if (selection.domain.ranges[i].start == this.range.end)
        {
          this.overlapend = i;
          selection.ranges[i].overlapstart = thisrange;
        }
    } else
    {
      if (this.overlapend >= 0)
      {
        selection.ranges[this.overlapend].overlapstart = -1
        this.overlapend = -1;
      }
    }*/
};
/*

////////////////////////////////////////////////////////////////////////////////////
// CLASS FUNCTIONS

selection.tag = function (i)
{
};

selection.splitdomain = function(pos)
{
  for (var i = 0; i < selection.domain.ranges.length; i++)
  {
    var thisrange = selection.domain.ranges[i];
    if ((pos > thisrange.start) && (pos < thisrange.end))
    {
      var lowerrange = new Range(thisrange.start, pos, thisrange.orientation);
      var higherrange = new Range(pos, thisrange.end, thisrange.orientation);
      selection.domain.ranges.splice(i,1,lowerrange, higherrange);

      //redraw the whole thing.
      selection.createranges();
      //inform the pieces that they are overlapping.
      selection.ranges[i].overlapend = i + 1;
      selection.ranges[i + 1].overlapstart = i;
      return;
    }
  }
}

selection.merge = function()
{
  //merge the two selection segments that are defined by the array selection.mergebubble.targets
  var targets = selection.mergebubble.targets;
  var lowerindex = Math.min(targets[0], targets[1]);
  var higherindex = Math.max(targets[0], targets[1]);
  var lower = selection.domain.ranges[lowerindex];
  var higher = selection.domain.ranges[higherindex];
  var newRange = new Range(Math.min(lower.start,higher.start), Math.max(lower.end, higher.end),
    (lower.length() > higher.length()) ? lower.orientation : higher.orientation); // the longer piece dominates.

  //splice the new segment into the lower place.
  selection.domain.ranges.splice(lowerindex, 1, newRange);
  selection.domain.ranges.splice(higherindex, 1);

  //redraw the whole thing.
  selection.createranges();
}
*/

///////////////////////////////////////////////////////////////////////////////////
// IMPLEMENTED CLASSES

//selection range is an broader version of the 'range' object found in the DNA.js package.

selection.RangeExtension = function()
{
  $.extend(this,
  {
    //graphics elements:
    path: undefined,
    handle_s: selection.createhandle(-1),
    handle_e: selection.createhandle(1),
    //graphic element to supply the (merge) method
    tag: undefined,

    draw: function()
    {
      if (!this.path)
        this.path = selection.layer.path("");

      //retrieve the data that will be used to generate the image.
      var sel_span = new graphics.Span(this);
      //set some convenience variables.
      var line1 = graphics.line(sel_span.start_l);
      var line2 = graphics.line(sel_span.end_l);
      var xpos1 = sel_span.start_p * graphics.metrics.charwidth + graphics.settings.lmargin;
      var xpos2 = sel_span.end_p * graphics.metrics.charwidth + graphics.settings.lmargin;
      //check to see if it's on one line line, in which case it is a simple rectangle.
      if (sel_span.start_l == sel_span.end_l)
        this.path.d = "M " + xpos1 + "," + line1.top +
                     " H " + xpos2 +
                     " V " + line1.bottom  +
                     " H " + xpos1 +
                     " Z";
      else
        this.path.d = "M " + xpos1 + "," + line1.top +
                     " H " + (graphics.metrics.linewidth + graphics.settings.lmargin) +
                     " V " + line2.top +
                     " H " + xpos2 +
                     " V " + line2.bottom +
                     " H " + graphics.settings.lmargin +
                     " V " + line1.bottom +
                     " H " + xpos1 +
                     " Z";

      $(this.path).attr("class", this.cssclass());
      this.setclickhandler();
    },

    deleteme: function()
    {
      //remove the path from the paper.
      this.path.remove();
      var that = this;

      //take care of handles
      this.handle_s.hide(function(){that.handle_s.remove();});
      this.handle_e.hide(function(){that.handle_e.remove();});

      //take care of tag (if necessary)
      if (this.tag)
        this.tag.hide(function(){that.tag.remove()});
    },

    overlapstart: -1,
    overlapend: -1,

    sethandlecss: function()
    {
      //set the css class of the handles.
      $(this.handle_s).attr("class", this.hcssclass());
      $(this.handle_e).attr("class", this.hcssclass());
    },

    showwidgets: function(complete)
    {
      var sel_span = new graphics.Span(this);

      var handlestartx = sel_span.start_p*graphics.metrics.charwidth + graphics.settings.lmargin;
      var handlestarty = graphics.line(sel_span.start_l).top + graphics.line(sel_span.start_l).height/2;
      var handleendx = sel_span.end_p*graphics.metrics.charwidth + graphics.settings.lmargin;
      var handleendy = graphics.line(sel_span.end_l).top + graphics.line(sel_span.end_l).height/2;

      this.handle_s.applytransform(dali.translate(handlestartx, handlestarty), true);
      this.handle_e.applytransform(dali.translate(handleendx, handleendy), true);

      //brand the handles with their relative position.
      if (this.start == this.end)
        this.handle_s.position = this.handle_e.position = 0;
      else
      {
        this.handle_s.position = -1;
        this.handle_e.position = 1;
      }

      //brand the handles with the identity of the range.
      this.handle_s.ref = this;
      this.handle_e.ref = this;

      this.sethandlecss();

      this.handle_s.show(complete);
      this.handle_e.show(complete);

      selection.showtags();
    },

    hidewidgets: function(complete)
    {
      var thattag = this.tag;
      if (this.tag)
        this.tag.hide(function(){if (complete) complete(); thattag.remove();});
      this.tag = undefined;

      this.handle_s.hide(complete);
      this.handle_e.hide(complete);
    },

    hcssclass: function()
    {
      return [
        "sel_handle minus",
        "sel_handle undirected",
        "sel_handle plus"][this.orientation + 1];
    },

    //outputs the css class for such an annotation
    cssclass: function()
    {
      return [
        "selection minus",
        "selection undirected",
        "selection plus"][this.orientation + 1];
    },

    setclickhandler: function()
    {
      var that = this;
      $(this.path).mousedown(function(e)
      {
        if (!e) var e = window.event;
        if (e.which) rightclick = (e.which == 3);
        else if (e.button) rightclick = (e.button == 2);

        if (rightclick)
        {
          editor.showcontextmenu(e);
          selection.broadcast("contextmenu", {ref:that});
        }
      })
    }
  });

  this.handle_s.setdrag(selection.handleend, selection.handlemove, selection.handlestart);
  this.handle_e.setdrag(selection.handleend, selection.handlemove, selection.handlestart);
}

selection.handlegraphic = function(position)
  //position is a variable which refers to whether this is a start handle or an end handle.
  // -1: start
  // 0: ambiguous
  // +1: end
{
  var graphic = selection.floater.circle(0,0,5);
  return graphic;
};

//position is a variable which specifies the position of the handle:
// -1: start, 0: either (0 length selection), 1: end
selection.createhandle = function(position)
{
  var handle = selection.handlegraphic(position);

  $.extend(handle, new selection.Widget({position:position}));
  $(handle).css("opacity","0");
  return handle;
};

selection.taggraphic = function(i)
{
  var tagset = selection.floater.group();
  var tagtext = tagset.text(0, 0, i.toString());
  $(tagtext).attr("class","sel_tag text");
  var textbox = tagtext.getBBox();
  tagtext.dy = textbox.height / 2;
  var tagbox = tagset.rect(-(textbox.width/2) - 2, -(textbox.height/2), textbox.width + 4, textbox.height + 4);
  $(tagbox).attr("class","sel_tag box");
  tagbox.parentNode.insertBefore(tagbox,tagtext);
  return tagset;
}

selection.createtag = function(i)
{
  var tag = selection.taggraphic(i);
  $.extend(tag, new selection.Widget({val:i}));
  $(tag).css("opacity","0");
  return tag;
}

selection.Widget = function(etc)
{
  $.extend(this,
  {
    ref: {}, //references the current range
    show: function (complete) {$(this).animate({opacity:1},250, complete)},
    hide: function (complete) {$(this).animate({opacity:1},250, complete)},
  }, etc);
}

/*

MergeBubble = function()
{
  return {
    //member variable - this is the image.
    image: {},
    targets: [],
    fired: false,

    initialize: function()
    {
      //draw the graphics object associated with the Merge Bubble.
      var tagtext = graphics.editor.paper.text(0,-2,"merge?");
      tagtext.attr("class","merge_tag text");
      var textbox = tagtext.getBBox();
      var tagbox = graphics.editor.paper.rect(-(textbox.width/2)-1, -(textbox.height/2), textbox.width + 2, textbox.height + 1,2);
      tagbox.attr("class","merge_tag box");

      var tagset = graphics.editor.paper.set();
      tagset.push(tagbox,tagtext);

      this.image = tagset;
      this.hide();
    },

    show: function (x, y)
    {
      this.image.transform("T" + x + "," + y );
      this.image.toFront();
      this.image.animate(selection.animatein);
      this.image.mousedown(selection.mergebubble.clickhandler)
      this.fired = false;
    },

    clickhandler: function(e)
    {
      if (!e) var e = window.event;
      if (e.which) rightclick = (e.which == 3);
      else if (e.button) rightclick = (e.button == 2);
      if (!rightclick && !selection.mergebubble.fired)
      {
        selection.mergebubble.fired = true;
        selection.merge();
        selection.mergebubble.hide();
      }
    },
 
    hide: function()
    {
      this.image.animate(selection.animateout);
    }
  }
}
*/
/////////////////////////////////////////////////////////////////////
// GLOBAL HELPER FUNCTION

select = function(spec)
{
  editor.broadcast("select",{domain: spec});
}

selectall = function()
{
  editor.broadcast("selectall");
}

