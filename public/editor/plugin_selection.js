var selection = new Plugin("selection");

////////////////////////////////////////////////////////////////////////
// MEMBER VARIABLES

selection.clipboard = {};

selection.range = new SeqRange();

selection.clipboardstylesheet = {};

selection.path = {};
selection.handler = {};
selection.handlef = {};
selection.fpos = {x: -100, y: -100};
selection.rpos = {x: -100, y: -100};
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

  selection.path = graphics.editor.paper.path("");
  selection.path.attr("id", "selection");
  selection.path.translate(graphics.settings.lmargin, 0);

  selection.handler = graphics.editor.paper.circle(0,0,5);
  selection.handlef = graphics.editor.paper.circle(0,0,5);

  selection.animateout = Raphael.animation({opacity:0}, 250, "<>");
  selection.animatein = Raphael.animation({opacity:1}, 250, "<>");

  selection.handler.animate(selection.animateout);
  selection.handlef.animate(selection.animateout);
};

selection.contextmenu = function(token)
{
  switch (token.subtype)
  {
    case "sequence":
      if ((token.ref.pos >= selection.range.start) && (token.ref.pos <= selection.range.end))
      {
        selection.sendcontextmenu(token.x, token.y, selection.range, true);
      }
    break;
  }
}

////////////////////////////////////////////////////////////////////////
// IMPLEMENTED TOKEN FUNCTIONS

selection.select = function(token)
{
  selection.range = token.range;
  //clear any previous selected range.
  selection.selected = true;
  selection.redraw();
};

_oldf = {};
_oldr = {};

selection.redraw = function(token)
{
  if (selection.selected)
  {
    selection.drawoutline();
    selection.drawhandles(true);
  };
}

////////////////////////////////////////////////////////////////////////
// DRAG and DROP TOKEN handling.

selection.selectionstart = 0;

selection.startselect = function(token)
{
  selection.range = new SeqRange(token.pos, token.pos);
  selection.selectionstart = token.pos;
  selection.selected = true;
  graphics.registerdrag(selection);

  selection.handlef.animate(selection.animateout);
  selection.handler.animate(selection.animateout);
};

selection.drag = function(token)
{
  if (token.pos < selection.selectionstart)
  {
    //first set up the correct color for the selection.
    selection.clipboardstylesheet.innerHTML = selection._reverseselectcss;
    selection.range.start = token.pos;
    selection.range.end = selection.selectionstart;
    selection.range.orientation = -1;
  }
  else
  {
    selection.clipboardstylesheet.innerHTML = selection._forwardselectcss;
    selection.range.start = selection.selectionstart;
    selection.range.end = token.pos;
    selection.range.orientation = 1;
  }

  selection.drawoutline();
};

selection.drop = function(token)
{
  selection.drawoutline();
  selection.drawhandles();
};

//////////////////////////////////////////////////////////////////////////
// GENERAL FUNCTIONS

selection.drawhandles = function(killoldhandles)
{
  var sel_span = selection.range.span();
  var linef = graphics.lines[sel_span.end_s];
  var liner = graphics.lines[sel_span.start_s];

  if (killoldhandles)
  {
    _oldf = selection.handlef;
    _oldr = selection.handler;
    selection.animateout.callback = new Function("_olf.remove(); _oldr.remove(); selection.animateout.callback = null;");

    selection.handlef.animate(selection.animateout);
    selection.handler.animate(selection.animateout);

    selection.handler = graphics.editor.paper.circle(0,0,5);
    selection.handler.attr("opacity", 0);
    selection.handlef = graphics.editor.paper.circle(0,0,5);
    selection.handlef.attr("opacity", 0);
  };

  var classtext = (selection.range.orientation == -1) ? "reverse_handle" : "forward_handle";
  selection.handlef.attr("class", classtext);
  selection.handler.attr("class", classtext);

  selection.handlef.attr("cx", graphics.settings.lmargin + (sel_span.end_p + 1) * graphics.metrics.charwidth);
  selection.handlef.attr("cy", linef.translatey - linef.content.getBBox().height/2);
  selection.handler.attr("cx", graphics.settings.lmargin + sel_span.start_p * graphics.metrics.charwidth);
  selection.handler.attr("cy", liner.translatey - liner.content.getBBox().height/2);

  selection.handlef.animate(selection.animatein);
  selection.handler.animate(selection.animatein);
}

selection.drawoutline = function()
{
  selection.path.attr("class", (selection.range.orientation == -1) ? "reverse" : "forward");
  var sel_span = selection.range.span();
  if (sel_span.start_s == sel_span.end_s)
  {
    var xpos = sel_span.start_p * graphics.metrics.charwidth;
    var height = graphics.lines[sel_span.start_s].content.getBBox().height; 
    selection.path.attr("d",
    "M " + xpos + "," + (graphics.lines[sel_span.start_s].translatey - height) +
    " H " + (sel_span.end_p + 1) * graphics.metrics.charwidth +
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

    selection.path.attr("d",
    "M " + xpos1 + "," + (ypos1 - height1) +
    " H " + graphics.metrics.linewidth +
    " V " + (ypos2 - height2) +
    " H " + (sel_span.end_p + 1) * graphics.metrics.charwidth +
    " v " + height2  +
    " H " + 0 +
    " V " + ypos1 +
    " H " + xpos1 +
    " Z"
    );
  }
};

selection.report = function()  //reports the selection contents to the informational div.
{
  document.getElementById("information").innerHTML = selection.range.toString();
};

temp_blah = {};

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

////////////////////////////////////////////////////////////////////////////////////
// GLOBAL HELPER FUNCTIONS

select = function(start, end)
{
  var mytoken = new Token("select");
  mytoken.range = new SeqRange(start, end, 1);
  editor.broadcasttoken(mytoken);
};

selectrc = function(start, end)
{
  var mytoken = new Token("select");
  mytoken.range = new SeqRange(start, end, -1);
  editor.broadcasttoken(mytoken);
};
