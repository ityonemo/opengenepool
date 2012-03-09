var sequence = new Plugin("sequence");

////////////////////////////////////////////////////////////////////////
// OVERLOADING FUNCTIONS

//short bits of strings which represent the textual content of each line
sequence.chunks = [];

sequence.newsequence = function()
{
  var zoomlevel = graphics.settings.zoomlevel;
  sequence.chunks = [];
  for (var i = 0; i * zoomlevel < editor.sequence.length; i ++)
  {
    //assign the appropriate array index to the corresponding chunk.
    sequence.chunks[i] = editor.sequence.slice(i*zoomlevel, (i + 1) * zoomlevel);
  };
}

sequence.setzoom = function()
{
  //these two functions should basically be identical.
  //NB in the future this might change.
  sequence.newsequence();
}


var temp;

/////////////////////////////////////////////////////////////////////////
// RENDERING THE LINE

sequence.redraw = function(token)
{
  var sequenceelement = new GraphicsElement(true)
  var sequenceobject = {};

  if (graphics.settings.textsequence)
  {
    //in the case that we are drawing a standard forward DNA strand, we will put the "baseline" underneath
    //the object.  Note that Raphael positions text in a centered fashion with respect to height.
    sequenceobject = graphics.editor.paper.text(0,-graphics.metrics.lineheight/2, sequence.chunks[token.line]);
    sequenceobject.attr("class","sequence");
    sequenceelement.content.push(sequenceobject);
  }
  else
  {
    // otherwise, we should just draw a black bar.

    //adjust the width of the bar if it's the last line.
    var barwidth = (token.line == sequence.chunks.length - 1) ? (sequence.chunks[token.line].length * graphics.metrics.charwidth) : graphics.metrics.linewidth;

    sequenceobject = graphics.editor.paper.rect(0,-graphics.metrics.lineheight * (5/8), barwidth, graphics.metrics.lineheight/4);

    sequenceobject.attr("class","sequencebox");
    sequenceelement.content.push(sequenceobject);

    sequenceelement.toppadding = graphics.metrics.lineheight * (3/8);
    sequenceelement.bottompadding = graphics.metrics.lineheight * (3/8);
  }

  sequenceobject.mousedown(function(e)
  {
    if (!e) var e = window.event;
    if (e.which) rightclick = (e.which == 3);
    else if (e.button) rightclick = (e.button == 2);

    var point = graphics.getlocation(e, e.target.parentNode);
    //figure out the row and character we clicked on.
    var ref = {};
    //retrieve the position within the sequence object that we are at.
    //nb:  0 is on the very left side, and y coordinates go from -lineheight to 0.
    ref.line = graphics.getline(point.svgy); 
    ref.linepos = Math.ceil(point.internalx / graphics.metrics.charwidth);
    ref.pos = ref.line * graphics.settings.zoomlevel + ref.linepos;

    if (rightclick)
    {
      sequence.sendcontextmenu(e.clientX, e.clientY, ref);
    }
    else //normal click
    {
      var token = new Token("startselect");
      token.line = ref.line;
      token.linepos = ref.linepos;
      token.pos = ref.pos;
      editor.broadcasttoken(token);
    }
  });

  sequenceelement.snapto();
  
  positionelement = new GraphicsElement(true)
  //in the case that we are drawing a standard forward DNA strand, we will put the "baseline" underneath
  //the object.  Note that Raphael positions text in a centered fashion with respect to height.
  var positionobject = graphics.editor.paper.text(-graphics.settings.rmargin, 0, (token.line * graphics.settings.zoomlevel + 1).toString());
  positionobject.attr("class","position");
  ////////////////////
  // HACK ALERT
  //there is a hack here because object's bounding box doesn't align with the proper font line due to
  //some glyphs extending below the font line. TODO: fix this!
  hackvalue = 3;
  ////END HACK
  positionobject.translate(0, -positionobject.getBBox().height/2 - hackvalue);
  positionelement.content.push(positionobject);
  positionelement.snapto(); //to set the properties of the GraphicsElement.

  //put it into the elements array.
  graphics.lines[token.line].push(sequenceelement);
  graphics.lines[token.line].push(positionelement);
}

