var sequence = new editor.Plugin("sequence",
{
  ////////////////////////////////////////////////////////////////////////
  // OVERLOADING FUNCTIONS

  //short bits of strings which represent the textual content of each line
  chunks:[],

  ready:function()
  {
    sequence.newsequence();
    sequence.isready = true;
  },

  newsequence:function(token)
  {
    if ((!token) || (!token.initial))
    {
      var zoomlevel = graphics.settings.zoomlevel;
      sequence.chunks = [];
      if (graphics.settings.textsequence)
      for (var i = 0; i * zoomlevel < editor.sequence.length; i ++)  //assign the appropriate array index to the corresponding chunk.
        sequence.chunks[i] = editor.sequence.slice(i*zoomlevel, (i + 1) * zoomlevel);
    }
  },

  zoomed: function()
  {
    //these two functions should basically be identical.
    //NB in the future this might change.
    sequence.newsequence();
  },

  contextmenu : function (token)
  {
    switch (token.subtype)
    {
      case "selection":
        //editor.addcontextmenuitem(new MenuItem("edit selection", "sequence.editdialog(" + selection.range.datastring() + ");"));
        //editor.addcontextmenuitem(new MenuItem("excise selection", "sequence._excise(" + selection.range.datastring() + ");"));
        //editor.addcontextmenuitem(new MenuItem("fork to workspace", "sequence._fork(" + selection.range.datastring() + ");"));
      break;
    }
  },

  editdialog: function (a, b, c)
  {
    alert("editing " + a + ".." + b);
  },

  _excise: function (a, b, c)
  {
    alert("excising " + a + ".." + b);
  },

  _fork: function(a, b, c)
  {
    alert("forking " + a + ".." + b);
  },

  /////////////////////////////////////////////////////////////////////////
  // RENDERING THE LINE

  redraw: function(token)
  {
    var sequencecontainer = graphics.newcontainer(token.line, "sequence_" + token.line, true)
    var sequenceobject = {};

    if (graphics.settings.textsequence)
    {
      //in the case that we are drawing a standard forward DNA strand, we will put the "baseline" underneath
      //the object.  Note that SVG positions text in a centered fashion with respect to height.
      sequenceobject = sequencecontainer.text(0,-graphics.metrics.lineheight/2, sequence.chunks[token.line]);
      $(sequenceobject).attr("class","sequence");
    }
    else
    {
      // otherwise, we should just draw a black bar.

      //adjust the width of the bar if it's the last line.
      var barwidth = ((token.line != graphics.linecount - 1) || (editor.sequence.length == graphics.settings.zoomlevel)) ? 
                       graphics.metrics.linewidth :
                       ((editor.sequence.length % graphics.settings.zoomlevel) * graphics.metrics.charwidth);

      sequenceobject = sequencecontainer.rect(0,-graphics.metrics.lineheight * (5/8), barwidth, graphics.metrics.lineheight/4);

      $(sequenceobject).attr("class","sequencebox");

      sequencecontainer.toppadding = graphics.metrics.lineheight * (3/8);
      sequencecontainer.bottompadding = graphics.metrics.lineheight * (3/8);
    }

    //now set mousedown jQuery event.

    /*$(sequenceobject).mousedown(function(e)
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
      ref.linepos = Math.floor((point.internalx / graphics.metrics.charwidth) + 0.5);
      ref.pos = ref.line * graphics.settings.zoomlevel + ref.linepos;

      if (rightclick)
      {
        sequence.sendcontextmenu(e.clientX, e.clientY, ref);
      }
      else //normal click
      {
        var token = new Token(e.shiftKey ? "addselect" : "startselect");
        token.line = ref.line;
        token.linepos = ref.linepos;
        token.pos = ref.pos;
        editor.broadcasttoken(token);
      }
    });*/
    
    positioncontainer = graphics.newcontainer(token.line, "position_" + token.line, true);

    //in the case that we are drawing a standard forward DNA strand, we will put the "baseline" underneath
    //the object.  Note that Raphael positions text in a centered fashion with respect to height.
    var positionobject = positioncontainer.text(-graphics.settings.rmargin/4, 0, (token.line * graphics.settings.zoomlevel + 1).toString());
    $(positionobject).attr("class","position");
    ////////////////////
    // HACK ALERT
    //there is a hack here because object's bounding box doesn't align with the proper font line due to
    //some glyphs descending below the baseline.  This may not have to be perfect.  TODO: figure out if this scales.
    hackvalue = 4;
    ////END HACK
    positionobject.applytransform(new dali.Translate(0, -positionobject.height/2 - hackvalue));
  }
});
