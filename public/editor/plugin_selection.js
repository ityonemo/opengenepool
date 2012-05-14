var selection = new editor.Plugin("selection",
{
  ////////////////////////////////////////////////////////////////////////
  // MEMBER VARIABLES

  clipboard: {},
  domain: {},

  //graphics object corresponding to our graphics layer and the widget layer.
  layer: {},
  widgets: {},

  isselected: false,

  animateout: {},
  animatein: {},

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
    
    if (!($("#widgetlayer").length))
      selection.widgets = graphics.editor.group("widgetlayer");
    else
      selection.widgets = $("#widgetlayer")[0];
    //put this at the top.
    graphics.editor.appendChild(selection.widgets);

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
      //remove the merge tags

      var mb = $(".mergebubble");
      for(var j = 0; j < mb.length; j++)
      {
        var bubble = mb[j];
        bubble.hide(function(){bubble.remove()});
      }
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
          //throw a second request on top that replicates the token except via selection.
          //first check to see if the token position is in current selection.
          if (selection.domain.contains(token.pos))
          {
            selection.splitsite = token.pos;
            editor.addcontextmenuitem(new editor.MenuItem("split selection range", selection.splitrange));
            for(var j = 0; j < selection.domain.ranges.length; j++)
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
          if (selection.domain.ranges.indexOf(token.ref) != 0)
          {
            editor.addcontextmenuitem(new editor.MenuItem("make first selection range", selection.movefirst));
            editor.addcontextmenuitem(new editor.MenuItem("move selection range up", selection.moveup));
          }
          if (selection.domain.ranges.indexOf(token.ref) != selection.domain.ranges.length - 1)
          {
            editor.addcontextmenuitem(new editor.MenuItem("move selection range down", selection.movedown));
            editor.addcontextmenuitem(new editor.MenuItem("make last selection range", selection.movelast));
          }
        }
      break;
      case "annotations":
        if (selection.isselected)
          if (selection.domain.ranges.length == 1)
          {
            var target = selection.target = token.ref;

            //calculate the absolute bounds of the particular annotation.  Just throw that data into target.
            target.refstart = editor.sequence.length;
            target.refend = 0;
            for (var i = 0; i < target.ranges.length; i++)
            {
              target.refstart = Math.min(target.refstart, target.ranges[i].start);
              target.refend = Math.max(target.refend, target.ranges[i].end);
            }

            var start = selection.domain.ranges[0].start;
            var end = selection.domain.ranges[0].end;

            if (!((start >= target.refstart) && (end <= target.refend)))
              editor.addcontextmenuitem(new editor.MenuItem("encompass this annotation", selection.encompass));

            if ((target.refend < start) || (target.refstart > end))
              editor.addcontextmenuitem(new editor.MenuItem("select up to annotation", selection.selupto));
            else if ((target.refstart >= start) || (target.refend <= end))
              editor.addcontextmenuitem(new editor.MenuItem("subtract this annotation", selection.subtract));

          }
        else //offer to add to the selection
          editor.addcontextmenuitem(new editor.MenuItem("select this annotation", function(){}));
      break;
    }
  },

  ////////////////////////////////////////////////////////////////////////
  // DRAG and DROP TOKEN handling.

  //temporary variables that are stored during the drag ad drop procedure.
  anchor: 0,
  draglowlimit: 0,
  draghighlimit: 0,

  //the editor graphics unit has just detected that we have moved far enough to qualify as a drag operation,
  // the shift key is not being pressed.
  startselect: function(token)
  { 
    if (!(selection.isselected && token.mode))
    {
      selection.unselect();
      selection.domain = new Domain(token.pos.toString());
    }
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
  },

  drag: function(token)
  {
    token.pos = Math.min(token.pos, selection.draghighlimit);
    token.pos = Math.max(token.pos, selection.draglowlimit);

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
  },

  drop: function(token) 
  {
    //show the handles.
    selection.domain.ranges[selection.domain.ranges.length - 1].showwidgets();
    selection.flagoverlaps();
  },

  /////////////////////////////////////////////////////////////////////////////////////
  // GENERAL HELPER FUNCTIONS.
  flagoverlaps: function()
  {
    var ranges = selection.domain.ranges;

    //first clear out all overlap_s/overlap_e definitions.
    for (var k = 0; k < ranges.length; k++)
      ranges[k].overlap_e = ranges[k].overlap_s = undefined;
    //then clear out all of the mergebubbles.
    var mb = $(".mergebubble");
    for (var l = 0; l < mb.length; l++)
    {
      var bubble = mb[l];
      bubble.hide(function(){bubble.remove()});
    }

    if (ranges.length > 1)
    {
      //scan pairwise for overlaps.
      for (var i = 0; i < ranges.length - 1; i++)
        for (var j = i + 1; j < ranges.length; j++)
        {
          if (ranges[i].start == ranges[j].end)
          {
            ranges[i].overlap_s = ranges[j];
            ranges[j].overlap_e = ranges[i];
            selection.createmergebubble(ranges[j], ranges[i]).show();
          }
          if (ranges[i].end == ranges[j].start)
          {
            ranges[i].overlap_e = ranges[j]; 
            ranges[j].overlap_s = ranges[i];
            selection.createmergebubble(ranges[i], ranges[j]).show();
          }
        }
    }
  },

  ////////////////////////////////////////////////////////////////////////////////////
  // GRAPHICS HELPER FUNCTIONS.

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
  },

  //////////////////////////////////////////////////////////////////////////
  // RANGE MANIPULATION FUNCTIONS.
  // these are typically called by the menu function, and require selection.target to be set to the
  // correct range.  You can also directly call these by passing the index of the target range.

  flip: function(index)
  {
    var target = (isNaN(index)) ? selection.target : selection.domain.ranges[index];

    target.orientation *= -1;
    target.draw();
    target.sethandlecss();
  },

  undirect: function(index)
  {
    var target = (isNaN(index)) ? selection.target : selection.domain.ranges[index];

    target.orientation = 0;
    target.draw();
    target.sethandlecss();
  },
  toplus: function(index)
  {
    var target = (isNaN(index)) ? selection.target : selection.domain.ranges[index];

    target.orientation = 1;
    target.draw();
    target.sethandlecss();
  },
  tominus: function(index)
  {
    var target = (isNaN(index)) ? selection.target : selection.domain.ranges[index];

    target.orientation = -1;
    target.draw();
    target.sethandlecss();
  },

  delrange: function(index)
  {
    var target = (isNaN(index)) ? selection.target : selection.domain.ranges[index];

    target.deleteme();
    selection.domain.ranges.splice(selection.domain.ranges.indexOf(target),1);
    selection.flagoverlaps();
    selection.rendered();
  },
  moveup: function(index)
  {
    var target = (isNaN(index)) ? selection.target : selection.domain.ranges[index];

    var ranges = selection.domain.ranges;
    var i = ranges.indexOf(target);
    ranges.splice(i-1, 2, ranges[i], ranges[i-1]);
    selection.flagoverlaps();
    selection.rendered(); 
  },
  movedown: function(index)
  {
    var target = (isNaN(index)) ? selection.target : selection.domain.ranges[index];

    var ranges = selection.domain.ranges;
    var i = ranges.indexOf(target);
    ranges.splice(i, 2, ranges[i + 1], ranges[i]);
    selection.flagoverlaps();
    selection.rendered(); 
  },
  movefirst: function(index)
  {
    var target = (isNaN(index)) ? selection.target : selection.domain.ranges[index];

    var ranges = selection.domain.ranges;
    ranges.splice(ranges.indexOf(target),1);
    ranges.unshift(target);
    selection.rendered();
  },
  movelast: function(index)
  {
    var target = (isNaN(index)) ? selection.target : selection.domain.ranges[index];

    var ranges = selection.domain.ranges;
    ranges.splice(ranges.indexOf(target),1);
    ranges.push(target);
    selection.flagoverlaps();
    selection.rendered();
  },

  ///////////////////////////////////////////////////////////////////////////////////
  // range manipulation with respect to annotations.  selection.target should be the
  // target annotation, also should have 'refstart' and 'refend' members which reflect
  // the extreme start and ends of the annotation.

  encompass: function() 
  {
    var selrange = selection.domain.ranges[0];
    var target = selection.target;

    selrange.start = Math.min(selrange.start, target.refstart);
    selrange.end = Math.max(selrange.end, target.refend);
    selection.rendered();
  },

  subtract: function() 
  {
    var selrange = selection.domain.ranges[0];
    var target = selection.target;

    if ((target.refstart > selrange.start) && (target.refend < selrange.end))
    {
      var orientation = selrange.orientation;
      //gonna have to split it into two!
      if (orientation >= 0)
      {
        selection.domain.ranges.push(new Range(target.refend, selrange.end, orientation));
        selrange.end = target.refstart;
      } else
      {
        selection.domain.ranges.push(new Range(selrange.start, target.refstart, orientation));
        selrange.start = target.refend;
      }

      var range = selection.domain.ranges[selection.domain.ranges.length - 1];
      $.extend(range, new selection.RangeExtension(range));
      range.draw();
    } else
    {
      //contract as appropriate.
      if (selrange.end > target.refend)
        selrange.start = target.refend;
      else //(selstart < start)
        selrange.end = target.refstart;
    }
    selection.rendered();
  },

  selupto: function() 
  {
    var selrange = selection.domain.ranges[0];
    var target = selection.target;
    
    if (selrange.start > target.refend)
      selrange.start = target.refend;
    else // selend < start
      selrange.end = target.refstart;
    selection.rendered();
  },

  ///////////////////////////////////////////////////////////////////////////////////
  // SELECTION HANDLE DRAGGING.
  // note that this is not the same as standard drag/drop responding.  Furthermore,
  // note that this doesn't use the drag/drop token system that is provided by graphics
  // plugin and instead directly uses the dali drag/drop handler.

  handlestart: function(event)
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
  },

  handlemove: function (x, y, event)
  { 
    var handle = dali.dragobject;
    //move the handle to the correct position.
    handle.applytransform(dali.translate(x,y), true);
    var line = graphics.getline(y);
    var linepos = graphics.getpos(x);
    var pos = line * graphics.settings.zoomlevel + linepos;

    pos = Math.max(pos, handle.draglowlimit);
    pos = Math.min(pos, handle.draghighlimit);

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

    //redraw the selection border.
    handle.ref.draw();
  },

  handleend: function()
  {
    var handle = dali.dragobject;
  
    handle.ref.hidewidgets();
    handle.ref.showwidgets();

    $(handle).css("cursor","");

    selection.flagoverlaps();
  },

});

selection.splitrange = function()
{
  //selection.target contains the position.
  var pos = selection.splitsite;

  for (var i = 0; i < selection.domain.ranges.length; i++)
  {
    var thisrange = selection.domain.ranges[i];
    if ((pos > thisrange.start) && (pos < thisrange.end))
    {
      var newrange = new Range(pos, thisrange.end, thisrange.orientation);
      $.extend(newrange, new selection.RangeExtension(newrange));
      thisrange.end = pos;
      selection.domain.ranges.splice(i + 1, 0,newrange);
      selection.flagoverlaps();
      selection.rendered();
      return;
    }
  }
}


selection.merge = function(mergebubble)
{
  //set the orientation to the dominant one.
  mergebubble.start.orientation = (mergebubble.start.length > mergebubble.end.length) ? 
    mergebubble.start.orientation : mergebubble.end.orientation;

  //merge the two selection segments that are defined in the merge bubble.
  mergebubble.start.end = mergebubble.end.end;

  mergebubble.end.deleteme();
  selection.domain.ranges.splice(selection.domain.ranges.indexOf(mergebubble.end),1);
  selection.flagoverlaps();
  selection.rendered();
}

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

    overlap_s: undefined,
    overlap_e: undefined,

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
  var graphic = selection.widgets.circle(0,0,5);
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
  var tagset = selection.widgets.group();
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

selection.mergegraphic = function()
{
  var mergeset = selection.widgets.group();
  var mergetext = mergeset.text(0, 0, "merge?");
  $(mergetext).attr("class", "merge_tag text");
  var textbox = mergetext.getBBox();
  mergetext.dy = textbox.height / 2;
  var mergebox = mergeset.rect(-(textbox.width/2) - 2, -(textbox.height/2), textbox.width + 4, textbox.height + 4, 2);
  $(mergebox).attr("class", "merge_tag box");
  mergebox.parentNode.insertBefore(mergebox, mergetext);
  $(mergeset).attr("class", "mergebubble");

  $(mergeset).click(function(){selection.merge(mergeset);})
  return mergeset;
}

selection.createmergebubble = function(start, end)
{
  //should pass the starting and ending segments for this mergebubble.
  var mergebubble = selection.mergegraphic();
  $.extend(mergebubble, new selection.Widget());
  $(mergebubble).css("opacity","0");
  mergebubble.start = start;
  mergebubble.end = end;

  var sel_span = new graphics.Span(end);

  mergebubble.applytransform(
    dali.translate(sel_span.start_p*graphics.metrics.charwidth + graphics.settings.lmargin, 
      graphics.line(sel_span.start_l).top - mergebubble.height)
  );

  return mergebubble;
}

selection.Widget = function(etc)
{
  $.extend(this,
  {
    ref: undefined, //special reference object that all widgets should have.
    show: function (complete) {$(this).animate({opacity:1},250, complete)},
    hide: function (complete) {$(this).animate({opacity:0},250, complete)},
  }, etc);
}

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

