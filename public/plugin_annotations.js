var annotations = new Plugin("annotations");

////////////////////////////////////////////////////////////////////////
// MEMBER VARIABLES

//list of annotations
annotations.annotations = [];
annotations.annotip = {};

////////////////////////////////////////////////////////////////////////
// OVERLOADING TOKEN FUNCTIONS

annotations.initialize = function()
{
  //in the initialize function we are going to set up the annotations tooltip.
  annotations.annotip = document.createElement('div');
  annotations.annotip.setAttribute('id','annotip');
  document.body.appendChild(annotations.annotip);
  
  var annotip_title = document.createElement('span');
  annotip_title.setAttribute('id','annotip_title');
  annotations.annotip.appendChild(annotip_title);

  var annotip_text = document.createElement('span');
  annotip_text.setAttribute('id','annotip_text');
  annotations.annotip.appendChild(annotip_text);
}

//temporary variable to store current annotation.
var current_annotation = {};

annotations.newsequence = function()
{
  //rebuild the annotation list: pull from XML.  For now just use the internal list.
  //use jQuery to parse the XML of the query.
  var xdoc = $.parseXML(editor.queryresult);
  queriedxml = $(xdoc);
          
  //use the xml jQuery object to find the sequence tag and use it.
  queriedxml.find("annotation").each(
    function()
    {
      var myannotation = 
        new Annotation($(this).attr("caption"),
                       $(this).attr("type"),
                       $(this).attr("range"),
                       $(this).attr("id"));

      current_annotation = myannotation;

      $(this).children().each(
        function()
        {
          current_annotation.data[$(this).attr("type")] = new AnnoData($(this).text(), $(this).attr("id"));
        }
      );

      //generate the structure and push it onto the annotations list.
      annotations.annotations.push(myannotation)
    }
  );

  //re-initialize the annotation fragments list.
  annotations.fragments = []; 

  //parse over the annotations array and split into graphically digestible
  //elements which will go into the "annofragments" array.
  for (var i = 0; i < annotations.annotations.length; i++)
  {
    annotations.generatefragments(i);
  }
};

annotations.generatefragments = function(i)
//generate annotation fragments for annotation of index i.
{
  var span = annotations.annotations[i].range.span();
  var orientation = annotations.annotations[i].range.orientation;

  //check if it's really short.
  if (span.start_s == span.end_s)
  {
    //then there's only one fragment.
    annotations.fragments.push(new Fragment(span.start_s, span.start_p, span.end_p, orientation, annotations.annotations[i]));
  }
  else
  {
    //set up start fragment.
    annotations.fragments.push(new Fragment(
      span.start_s, span.start_p, graphics.settings.zoomlevel - 1, orientation, annotations.annotations[i]));

    //if it's reaaaly long, then you have fill in middle fragments.
    if (span.start_s < span.end_s - 1)
    {
      for(var j = span.start_s + 1; j < span.end_s; j++)
      {
        annotations.fragments.push(new Fragment(j, 0, graphics.settings.zoomlevel -1, orientation, annotations.annotations[i]));
      }
    }

    //set up end fragment
    annotations.fragments.push(new Fragment(span.end_s, 0, span.end_p, orientation, annotations.annotations[i]));
  }

  //return a structure reporting the start and end lines.
  return {start: span.start_s, end: span.end_s}
};

annotations.setzoom = function(token)
{
  //re-initialize the annotation fragments list.
  annotations.fragments = []; 

  //parse over the annotations array and split into graphically digestible
  //elements which will go into the "annofragments" array.
  for (var i = 0; i < annotations.annotations.length; i++)
  {
    annotations.generatefragments(i);
  }
}

annotations.redraw = function(token)
{
  //this is a really kludgey array parsing function.  In the future
  //the array should be parsed into sub-arrays indexed by line, or sorted
    
  var graphicsarray = [];

  for (var i = 0; i < annotations.fragments.length; i++)
  {
    var currentfragment = annotations.fragments[i];
    var currentannotation = annotations.fragments[i].ref;

    if (currentfragment.line == token.line)
    {
      var cleft = currentfragment.start*graphics.metrics.charwidth;
      var cright = (currentfragment.end+1)*graphics.metrics.charwidth;

      var height = graphics.metrics.lineheight;

      var graphicselement = new GraphicsElement();

      //set up the content.  Note that the Y position is very likely to be altered
      //by the internal layout engine.
      graphicselement.content = annotations.createfragmentgraphic(cleft, cright, currentfragment.orientation,
      currentannotation);
      graphicselement.snapto();

      graphicselement.toppadding = ((((cright - cleft) < graphics.metrics.blockwidth) || (currentfragment.orientation == 0)) ? 
        graphics.metrics.lineheight / 5 : 0) + 1;
      graphicselement.bottompadding = graphicselement.toppadding;

      //find what to use as the description string.
      var finalstring = (currentannotation.data["note"] ? 
        currentannotation.data["note"].data :
        (currentannotation.data["gene"] ?
          currentannotation.data["gene"].data + " gene" : ""));

      //set up the tooltip associated with the raphael object. 
      var descriptionstring = currentannotation.type + 
            '<span class="' + (currentannotation.cssclass()) + '"> ' + 
            currentannotation.to_s() +
            " </span><br/>" + finalstring;

      annotations.addTip(graphicselement.content, currentannotation.caption, descriptionstring);

      //put it into the elements array.
      graphics.lines[token.line].push(graphicselement);
    }
  }
};

annotations.contextmenu = function(token)
{
  switch (token.subtype)
  {
    case "annotations":
      editor.addcontextmenuitem(new MenuItem("delete annotation", "alert('delete annotation: " + token.ref.caption + "');"));
    break;
    case "selection":
      editor.addcontextmenuitem(new MenuItem("create annotation", "annotations.createdialog(" + selection.range.datastring() + ");"))
    break;
  }
}

annotations.createdialog = function(start, end, orientation)
{
  alert("range: " + start + ".." + end);
}


//////////////////////////////////////////////////////////////////////
// GENERAL MEMBER FUNCTIONS

var annotation_tipover = false;

annotations.addTip = function(element, title, text)
{
  //jQuery based craziness that associates callback functions with the
  //selected annotation segment.  jQuery is necessary to deal with overlapping
  //mouseover/mouseout insanity and resolve to simple functions.
  element.mouseover(
    function(){
      document.getElementById("annotip_title").innerHTML=title;
      document.getElementById("annotip_text").innerHTML="<br/>" + text;
      $("#annotip").css("display","block");
      annotation_tipover = true;
    })
  element.mouseout(
    function()
    {
      annotations.hideTip()
    });
  element.mousemove(
    function(e)
    {
      $("#annotip")
        .css("left",(e.clientX+20).toString() + "px")
        .css("top",(e.clientY+20).toString() + "px");
    }); 
};

annotations.hideTip = function()
{
  $("#annotip").css("display","none");
  annotation_tipover = false;
}

annotations.createfragmentgraphic = function (left, right, type, ref)
//create graphics element for an annotation.  
//type: -1 - left ended arrow
//type: 0 - no directionality.
//type: +1 - right-ended arrow 
{
  //set the default value for the type element.
  if (!type) var type = 0;

  var thisfragment = graphics.editor.paper.set();
  var thisarrow = {};
  var height = graphics.metrics.lineheight;
  var arrowedge = graphics.metrics.lineheight / 5;
  
  if (((right - left) < graphics.metrics.blockwidth) || (type == 0))
  {
    thisarrow = graphics.editor.paper.rect
      (left,-height + arrowedge,right-left,height - arrowedge * 2);
  }
  else
  {
    switch (type)
    {
      case -1:
        thisarrow = graphics.editor.paper.path(
        "M " + left.toString() + " " + (-height / 2).toString() +
        " L " + (left + graphics.metrics.blockwidth).toString() + " 0 " +
        " V " + (-arrowedge).toString() +
        " H " + right.toString() +
        " V " + (-height + arrowedge).toString() +
        " H " + (left + graphics.metrics.blockwidth).toString() +
        " V " + (-height).toString() +
        " Z");
      break;
      case 1:
        thisarrow = graphics.editor.paper.path(
          "M " + right.toString() + " " + (-height / 2).toString() +
          " L " + (right - graphics.metrics.blockwidth).toString() + " 0 " +
          " V " + -arrowedge.toString() +
          " H " + left.toString() +
          " V " + (-height + arrowedge).toString() +
          " H " + (right - graphics.metrics.blockwidth).toString() +
          " V " + (-height).toString() +
          " Z");
      break;
    };
  };

  thisarrow.attr("class", "annotation " + ref.type);
  thisfragment.push(thisarrow);

  thisfragment.mousedown(
    function(e)
    {
      if (!e) var e = window.event;
      if (e.which) rightclick = (e.which == 3);
      else if (e.button) rightclick = (e.button == 2);

      if (rightclick)
      {
        annotations.sendcontextmenu(e.clientX, e.clientY, ref)

        //for aesthetic purpsoses, hide the annotatation tooltip.
        annotations.hideTip();
      }
      else //normal click triggers selection of underlying sequence
      {
        var token = new Token("select");
        token.range = ref.range;
        editor.broadcasttoken(token);
      }
    })

  return thisfragment;
};


////////////////////////////////////////////////////////////////////////
// HELPER OBJECTS

Annotation = function(_caption, _type, _range, _id){
  return {
    caption:_caption,
    type: _type,
    range: new GenBankSeqRange(_range),
    id: _id,
    data: {},

    //outputs the css class for such an annotation
    cssclass: function()
    {
      return ["annotation_reverse","annotation_undirected","annotation_forward"][this.range.orientation + 1];
    },

    to_s: function()
    {
      switch (this.range.orientation)
      {
        case 1:
          return this.range.start + ".." + this.range.end;
        break;
        case 0:
          return "[" + this.range.start + ".." + this.range.end + "]";
        break;
        case -1:
          return "(" + this.range.start + ".." + this.range.end + ")";
        break;
      }
    }
  }
}

AnnoData = function (_data, _id){
  return { id:_id, data:$.trim(_data) } //use jQuery because we can.
}
