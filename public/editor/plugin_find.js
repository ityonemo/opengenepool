var find = new Plugin("find");

////////////////////////////////////////////////////////////////////////
// MEMBER VARIABLES

find.searchstring = "";
find.domain = {};

////////////////////////////////////////////////////////////////////////
// OVERLOADING TOKEN FUNCTIONS

find.initialize = function()
{
  find.maketool();
  find.toolbardom.innerHTML += "<input type='text' id='findinput'></input>" +
  "<button>&lt;&lt;</button><button>&gt;&gt;</button>";
  document.getElementById("findinput").addEventListener("keyup", find.find);
  find.toolbardom.onchange = find.click;
  find.domain = new Domain();
}

////////////////////////////////////////////////////////////////////////
// MEMBER FUNCTIONS

find.find = function()
{
  //reset the search value and clear the search array.
  find.searchstring = document.getElementById("findinput").value;
  var searchrc = reversecomplement(find.searchstring);
  var searchlength = find.searchstring.length;
  if (find.domain.ranges.length)
    find.clear();

  if (searchlength > 2)
  {
    var terminus = editor.sequence.length - searchlength;
    for (var i = 0; i < terminus; i++)
    {
      var slicedstring = editor.sequence.substr(i, searchlength);
      if (slicedstring == find.searchstring)
        find.domain.push(new FindRange(i, i+searchlength, 1))
      else if (slicedstring == searchrc)
        find.domain.push(new FindRange(i, i+searchlength, -1))
    }
    find.paint();
  }
}

find.clear = function()
{
  for (var i = 0; i < find.domain.ranges.length; i++)
  {
    find.domain.ranges[i].remove();
  }
  find.domain.ranges = [];
}

find.paint = function()
{
  for (var i = 0; i < find.domain.ranges.length; i++)
  {
    find.domain.ranges[i].draw();
  }
}

find.drawrange = function(path, range)
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
      " Z" 
    );
  }
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
  path.transform("T" + graphics.settings.lmargin + ",0");
  path.toBack();
}

find.click = function()
{
  if ($(find.toolbardom).attr("open") == "open")
    find.clear();
}

FindRange = function(start, end, orientation)
{
  var range = new Range(start, end, orientation)
  range.path = {};
  
  range.remove = function()
  {
    range.path.remove();
  }

  range.draw = function()
  {
    var newpath = graphics.editor.paper.path();
    newpath.attr("class","found");
    range.path = newpath;
    find.drawrange(newpath, range);
  }

  return range;
}


