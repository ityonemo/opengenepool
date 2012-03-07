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
      selectionelement.content = selectionobject

      //put it into the elements array.
      graphics.lines[token.line].elements.push(selectionelement);
      //put the raphael object into the raphael array.
      graphics.lines[token.line].content.push(selectionobject);
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

selection.startselect = function(token)
{
  selection.range = new SeqRange(token.pos, token.pos);
  selection.selecting = true;
  selection.drawnewselection();
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
  selection.fragments = [];
  //throw the selected flag.
  selection.selected = true;
  //generate the fragments
  selection.generatefragments();
  //throw a graphics invalidate.
  graphics.render();
};

selection.clearfragments = function()
{
  for(var i = 0; i < selection.fragments.length; i ++)
  {
    graphics.invalidate(selection.fragments[i].line);
  }
};

selection.generatefragments = function()
{
  //set up some convenience variables.
  var span = selection.range.span();
  var orientation = selection.range.orientation;
  //check if it's really short.
  if (span.start_s == span.end_s)
  {
    var fragment =
      {line: span.start_s,
       start: span.start_p, 
       end: span.end_p,
       direction: orientation}; 
    selection.fragments.push(fragment);
    graphics.invalidate(span.start_s);
  }
  else
  {
    //set up distinct start and end fragments.
    var startfragment =
      {line: span.start_s,
       start: span.start_p, 
       end: graphics.settings.zoomlevel - 1,
       direction: orientation};
    selection.fragments.push(startfragment);
    graphics.invalidate(span.start_s);
    var endfragment =
      {line: span.end_s,
       start: 0, 
       end: span.end_p,
       direction: orientation};
    selection.fragments.push(endfragment);
    graphics.invalidate(span.end_s);

    //if it's reaaaly long, then you have fill in middle fragments.
    if (span.start_s < span.end_s - 1)
    {
      for(var j = span.start_s + 1; j < span.end_s; j++)
      {
        var midfragment =
          {line: j,
           start: 0,
           end: graphics.settings.zoomlevel -1,
           direction: orientation};
        selection.fragments.push(midfragment);
        graphics.invalidate(j);
      }
    }
  }
}
