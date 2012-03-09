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
  selection.infobox();
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

      var selectionobject = graphics.editor.paper.rect(0,0);
      //store it in the fragments array
      currentfragment.ref = selectionobject;

      //move the fragment to where it needs to be.
      selection.paintfragment(i);      
 
      selectionobject.attr("class",(selection.range.orientation == -1) ? "reverse_select" : "forward_select");
      selectionobject.toBack();      //set up the clickresponder.

      //associate the element with the content.
      selectionelement.content.push(selectionobject);

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
      //store the value of the old line.
      var _o = Math.floor(selection.range.start / graphics.settings.zoomlevel);
      //reset the values for the selection.
      selection.range.start = token.pos;
      selection.range.end = selection.startpoint;
      //check to see if we need to create new fragments.
      if (token.line < selection.fragments[0].line)
      {
        //first set the first fragment to the front.
        selection.fragments[0].start = 0;
        selection.fragments[0].orientation = -1;
        selection.paintfragment(0);

        for (var j = selection.fragments[0].line - 1; j >= token.line; j--)
        {
          selection.createline(token, j, -1);
        }
      }
      else
      {
        //reset the first fragment.
        selection.fragments[0].start = token.linepos;
        selection.fragments[0].orientation = -1;
        selection.range.orientation = -1;
        selection.paintfragment(0);
      }
    } 
    else
    {
      //reset the values for the selection.
      selection.range.end = token.pos;
      selection.range.start = selection.startpoint;

      //reset the last fragment.
      var _last = selection.fragments.length - 1;

      if (token.line > selection.fragments[_last].line)
      { 
        //first set the last fragment to the end.
        selection.fragments[_last].end = graphics.settings.zoomlevel - 1;
        selection.fragments[_last].orientation = 1;
        selection.paintfragment(_last);

        for (var j = selection.fragments[_last].line + 1; j <= token.line; j++)
        {
          selection.createline(token, j, 1);
        }
      }
      else
      {
        if (token.pos == selection.startpoint)
        {
          selection.fragments[_last].start = token.linepos;
        };

        selection.fragments[_last].end = token.linepos;
        selection.fragments[_last].orientation = 1;
        selection.range.orientation = 1;
        selection.paintfragment(_last);
      };
    }
    selection.infobox();
  }
};

selection.createline = function(token, j, o)
{
  var selectionelement = new GraphicsElement(true)
  var selectionobject = graphics.editor.paper.rect(0,0);
  var new_f = new Fragment(j, 
    (((j == token.line) && (o == -1)) ? token.linepos : 0),
    (((j == token.line) && (o == 1)) ? token.linepos : graphics.settings.zoomlevel - 1), o);
        
  //store it in the fragments array
  new_f.ref = selectionobject;

  selectionobject.translate(graphics.lines[j].translatex, graphics.lines[j].translatey);
  selectionobject.toBack();      //set up the clickresponder.

  //push or unshift it to the fragments array.
  if (o == -1) { selection.fragments.unshift(new_f);}
  else {selection.fragments.push(new_f);}

  //move the fragment to where it needs to be.
  selection.paintfragment((o == -1) ? 0 : selection.fragments.length - 1);
                 
  //associate the element with the content.
  selectionelement.content.push(selectionobject);

  //put it into the elements array.
  graphics.lines[j].push(selectionelement); 
}

selection.drop = function(token)
{
  selection.selecting = false;
};

////////////////////////////////////////////////////////////////////////
// GENERAL MEMBER FUNCTIONS

selection.infobox = function()
{
  var _c = (selection.range.orientation == -1)
  editor.infobox.innerHTML = (_c?"(":"") + selection.range.start + ".." + selection.range.end + (_c?")":"");
}

selection.paintfragment = function(i)
{ 
  var currentfragment = selection.fragments[i];

  currentfragment.ref.attr(
  {
    x:       currentfragment.start * graphics.metrics.charwidth, 
    y:       -graphics.metrics.lineheight,
    width:   (currentfragment.end - currentfragment.start + 1) * graphics.metrics.charwidth,
    height:  graphics.metrics.lineheight,
    "class": ((currentfragment.orientation == -1) ? "reverse_select" : "forward_select")
  });
};

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
