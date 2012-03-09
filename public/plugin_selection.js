var selection = new Plugin("selection");

////////////////////////////////////////////////////////////////////////
// MEMBER VARIABLES

selection.clipboard = {};

selection.fragments = [];

selection.range = new SeqRange();
selection.selected = false;	//is the user highlighting anything?
selection.selecting = false;	//are we in the process of highlighting?

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
};

////////////////////////////////////////////////////////////////////////
// IMPLEMENTED TOKEN FUNCTIONS

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

selection.select = function(token)
{
  selection.range = token.range;
  //clear any previous selected range.
  selection.drawnewselection();
};

selection.redraw = function(token)
{
  //kludgey, can we have some sort of hash?  Or at least a sorted array.
  for (var i = 0; i < selection.fragments.length; i++)
  {
    var currentfragment = selection.fragments[i];

    if (currentfragment.line == token.line)
    {
      var selectionelement = new GraphicsElement(true)

      var selectionobject = graphics.editor.paper.rect(
      currentfragment.start * graphics.metrics.charwidth, 
      -graphics.metrics.lineheight,
      (currentfragment.end - currentfragment.start + 1) * graphics.metrics.charwidth,
      graphics.metrics.lineheight)
 
      selectionobject.attr("class",(selection.range.orientation == -1) ? "reverse_select" : "forward_select");
      selectionobject.toBack();      //set up the clickresponder.

      //associate the element with the content.
      selectionelement.content.push(selectionobject);

      //store it in the fragments array
      currentfragment.ref = selectionobject;

      //put it into the elements array.
      graphics.lines[token.line].push(selectionelement);
    }
  }
};

selection.contextmenu = function(token)
{
  switch (token.subtype)
  {
    case "sequence":  //let's see if the sequence has been clicked along our part.
      if (selection.selected)
      {
        if ((token.ref.pos >= selection.range.start) && (token.ref.pos <= selection.range.end))
        {
          this.sendcontextmenu();  //fire off our own addendum to the context menu stack.
        }
      }
    break;
  }
};

////////////////////////////////////////////////////////////////////////
// DRAG and DROP handling.

selection.startselect = function(token)
{
  selection.range = new SeqRange(token.pos, token.pos);
  selection.startpoint = token.pos;
  selection.selecting = true;
  graphics.registerdrag(selection);
  editor.infobox.innerHTML = "ready";
  selection.drawnewselection();
};

selection.drag = function(token)
{
  if (token.pos && selection.selecting)
  {
    if (token.pos < selection.startpoint)
    {
      //store old position
      var _o = selection.range.start % graphics.settings.zoomlevel;
      //reset the values for the selection.
      selection.range.start = token.pos;
      selection.range.end = selection.startpoint;
      //reset the front end of the graphics.
      var _a = selection.fragments[0].ref.attr();
      selection.fragments[0].ref.attr("x", token.linepos * graphics.metrics.charwidth);
      selection.fragments[0].ref.attr("width", (_o - token.linepos) * graphics.metrics.charwidth + _a.width);
      selection.fragments[0].ref.attr("class", "reverse_select");
      selection.range.orientation = -1;
      editor.infobox.innerHTML = "(" + selection.range.start + ".." + selection.range.end + ")";
    } else
    {
      //store old position
      var _o = selection.range.end % graphics.settings.zoomlevel;
      //reset the values for the selection.
      selection.range.end = token.pos;
      selection.range.start = selection.startpoint;
      //reset the back end of the graphics.
      var _a = selection.fragments[0].ref.attr();
      selection.fragments[0].ref.attr("width", (token.linepos - _o) * graphics.metrics.charwidth + _a.width);
      selection.fragments[0].ref.attr("class", "forward_select");
      selection.range.orientation = 1;
      editor.infobox.innerHTML = selection.range.start + ".." + selection.range.end;
    }
  }
};

selection.drop = function(token)
{
  selection.selecting = false;
};

////////////////////////////////////////////////////////////////////////
// GENERAL MEMBER FUNCTIONS

selection.trapclip = function()
{
  //THIS IS A TOTAL HACK, but it works on CHROME.
  //for the copy function to work, we need to put the adjoined text or alternatively
  //the reverse complement text into the secret, hidden "clipboard div" and then 
  //change the selection 

  if (selection.selected)
  {
    var _sel_actual = window.getSelection();
    _sel_actual.removeAllRanges();                 //clear whatever we think is selected.

    selection.clipboard.innerHTML = 
      editor.subsequence(selection.range);

    var temprange = document.createRange();                  //create a new range          
    temprange.selectNodeContents(selection.clipboard);       //assign the range to the hidden div
    _sel_actual.addRange(temprange);                         
  }
};

selection.drawnewselection = function()
{
  selection.clearfragments();
  //throw the selected flag.
  selection.selected = true;
  //generate the fragments
  selection.generatefragments();
  //throw a graphics invalidate.
  selection.repaint();
  graphics.render();
};

selection.clearfragments = function()
{
  //first go through and invalidate all the relevant lines.
  selection.repaint();
  //then clean out the array.
  selection.fragments = [];
  //the effects of emptying this array should propagate when the render() call is made.
};

selection.generatefragments = function()
{
  //set up some convenience variables.
  var span = selection.range.span();
  var orientation = selection.range.orientation;
  //check if it's really short.
  if (span.start_s == span.end_s)
  {
    selection.fragments.push(new Fragment(span.start_s, span.start_p, span.end_p, orientation));
  }
  else
  {
    //set up start fragment.
    selection.fragments.push(new Fragment(span.start_s, span.start_p, graphics.settings.zoomlevel - 1, orientation));
    //if it's reaaaly long, then you have fill in middle fragments.
    if (span.start_s < span.end_s - 1)
    {
      for(var j = span.start_s + 1; j < span.end_s; j++)
      {
        selection.fragments.push(new Fragment(j, 0, graphics.settings.zoomlevel -1, orientation));
      }
    }
    //set up end fragment.
    selection.fragments.push(new Fragment(span.end_s, 0, span.end_p, orientation));
  }
}

selection.repaint = function()
{
  //go through and invalidate all the relevant lines.
  for(var i = 0; i < selection.fragments.length; i ++)
  {
    graphics.invalidate(selection.fragments[i].line);
  }
}
