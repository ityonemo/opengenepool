var selection = new Plugin("selection");

////////////////////////////////////////////////////////////////////////
// MEMBER VARIABLES

selection.clipboard = {};

selection.range = new SeqRange();

selection.clipboardstylesheet = {};

selection._forwardselectcss = "::selection {background:rgba(0,255,0,0.5)}";
selection._reverseselectcss = "::selection {background:rgba(255,0,0,0.5)}";

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

  //create a short stylesheet just for the selection color manipulation.
  selection.clipboardstylesheet = document.createElement('style');
  selection.clipboardstylesheet.setAttribute('id', 'clipstyle');
  document.head.appendChild(selection.clipboardstylesheet);

  //assign the css object.
  //selection.targetstylesheet = document.styleSheets[document.styleSheets.length - 1];
  //selection.targetstylesheet.insertRule(selection._forwardselectcss, 0);
};

////////////////////////////////////////////////////////////////////////
// IMPLEMENTED TOKEN FUNCTIONS


selection.select = function(token)
{
  selection.range = token.range;
  //clear any previous selected range.
  //selection.infobox();
};

////////////////////////////////////////////////////////////////////////
// DRAG and DROP handling.

selection.selectionstart = 0;

selection.startselect = function(token)
{
  selection.range = new SeqRange(token.pos, token.pos);
  selection.selectionstart = token.pos;
  selection.enforce();
  graphics.registerdrag(selection);
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

  //enforce the position of selection to match the actual selection.
  selection.enforce();
};

selection.drop = function(token)
{
};

//////////////////////////////////////////////////////////////////////////
// GENERAL FUNCTIONS

selection.report = function()  //reports the selection contents to the informational div.
{
  document.getElementById("information").innerHTML = selection.range.toString();
};

selection.enforce = function()
{
  selection.report();
};

selection._temp_selection = {};
selection.trapclip = function()
{
  //THIS IS A TOTAL HACK, but it works on CHROME (and probably on firefox)
  //for the copy function to work, we need to put the adjoined text or alternatively
  //the reverse complement text into the secret, hidden "clipboard div" and then 
  //change the selection.
  //we will almost certainly need to make changes to make this work with safari and IE.

  var _sel_actual = window.getSelection();       //named such to prevent confusion with the selection plugin object.
  selection._temp_selection = _sel_actual.getRangeAt(0);
  _sel_actual.removeAllRanges();                 //clear whatever we think is selected.

  selection.clipboard.innerHTML = 
    editor.subsequence(selection.range);

  var temprange = document.createRange();                  //create a new range          
  temprange.selectNodeContents(selection.clipboard);       //assign the range to the hidden div
  _sel_actual.addRange(temprange);

  //set a callback that restores the old selection.
  window.setTimeout(function()
  {
    var _sel_actual = window.getSelection();
    _sel_actual.removeAllRanges();
    _sel_actual.addRange(selection._temp_selection);
  });
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
