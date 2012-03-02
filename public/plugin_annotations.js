var annotations = new Plugin();

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

annotations.annospan = function(i)
//return spanning information for the annotation at index i
//spanning information is an object with the following properties:
//  start_s - starting segment
//  end_s - ending segment
//  start_p - position within starting segment
//  end_p - position within ending segment
{
  //set some convienience variables.
  var tstart = annotations.annotations[i].range.start;
  var tend = annotations.annotations[i].range.end;

  //TODO: fix this so that it really refers to the "orientation" variable.
  //seq_start and seq_ends are actually the ends in sequence order (not orientation order)
  var seq_start = (tstart < tend) ? tstart : tend;
  var seq_end = (tstart < tend) ? tend : tstart;

  //figure out which segment they're going to be in, and where in that segement.
  var startsegment = Math.floor((seq_start - 1)/graphics.settings.zoomlevel);
  var endsegment = Math.floor((seq_end - 1)/graphics.settings.zoomlevel);
  var startpos = (seq_start - 1)%graphics.settings.zoomlevel;
  var endpos = (seq_end - 1)%graphics.settings.zoomlevel;

  return {
    start_s: startsegment,
    end_s: endsegment,
    start_p: startpos,
    end_p: endpos
  }
};

annotations.generatefragments = function(i)
//generate annotation fragments for annotation of index i.
{
  var span = annotations.annospan(i);
  var orientation = annotations.annotations[i].orientation;

  //check if it's really short.
  if (span.start_s == span.end_s)
  {
    var fragment =
      {ref: annotations.annotations[i],
       line: span.start_s,
       start: span.start_p, 
       end: span.end_p,
       direction: orientation}; 
    annotations.fragments.push(fragment)
  }
  else
  {
    //set up distinct start and end fragments.
    var startfragment =
      {ref: annotations.annotations[i],
       line: span.start_s,
       start: span.start_p, 
       end: graphics.settings.zoomlevel - 1,
       direction: orientation};
    annotations.fragments.push(startfragment);
    var endfragment =
      {ref: annotations.annotations[i],
       line: span.end_s,
       start: 0, 
       end: span.end_p,
       direction: orientation};
    annotations.fragments.push(endfragment);

    //if it's reaaaly long, then you have fill in middle fragments.
    if (span.start_s < span.end_s - 1)
    {
      for(var j = span.start_s + 1; j < span.end_s; j++)
      {
        var midfragment =
          {ref: annotations.annotations[i],
           line: j,
           start: 0,
           end: graphics.settings.zoomlevel -1,
           direction: orientation};
        annotations.fragments.push(midfragment);
      }
    }
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

    if (currentfragment.line == token.line)
    {
      var cleft = currentfragment.start*graphics.metrics.charwidth;
      var cright = (currentfragment.end+1)*graphics.metrics.charwidth;

      var height = graphics.metrics.lineheight;

      var graphicselement = new GraphicsElement();

      //set up the content.  Note that the Y position is very likely to be altered
      //by the internal layout engine.
      graphicselement.content = annotations.createfragmentgraphic(cleft, cright, currentfragment.direction, currentfragment.ref);
      graphicselement.snapto();

      graphicselement.toppadding = ((((cright - cleft) < graphics.metrics.blockwidth) || (currentfragment.direction == 0)) ? 
        graphics.metrics.lineheight / 5 : 0) + 1;
      graphicselement.bottompadding = graphicselement.toppadding;

      //find what to use as the description string.
      var finalstring = (annotations.fragments[i].ref.data["note"] ? 
        annotations.fragments[i].ref.data["note"].data :
        (annotations.fragments[i].ref.data["gene"] ?
          annotations.fragments[i].ref.data["gene"].data + " gene" : ""));

      //set up the tooltip associated with the raphael object. 
      var descriptionstring = annotations.fragments[i].ref.type + 
            '<span class="' + 
            ((annotations.fragments[i].ref.range.start < annotations.fragments[i].ref.range.end) ? 'annotip_forward' : 'annotip_reverse')
            + '">' + " (" + annotations.fragments[i].ref.range.start.toString() +
            ".." + annotations.fragments[i].ref.range.end.toString() +
            ")</span><br/>" + finalstring;

      annotations.addTip(graphicselement.content, annotations.fragments[i].ref.caption, descriptionstring);

      //put it into the elements array.
      graphics.lines[token.line].elements.push(graphicselement);
      //put the raphael object into the raphael array.
      graphics.lines[token.line].content.push(graphicselement.content);
    }
  }
};

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
      $("#annotip").css("display","none");
      annotation_tipover = false;
    });
  element.mousemove(
    function(e)
    {
      $("#annotip")
        .css("left",(e.clientX+20).toString() + "px")
        .css("top",(e.clientY+20).toString() + "px");
    }); 
};

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

//    if (ref.caption.length > 0)  // make sure it's worth making.
//    {
//      //next make the text object:
//      var thistext = graphics.editor.text(right + 10, height / 2, ref.caption);
//      thistext.attr("font","");
//      thistext.attr("text-anchor","");
//      thistext.attr("class","caption");
//      thisfragment.push(thistext);
//    }

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
  }
}

AnnoData = function (_data, _id){
  return { id:_id, data:$.trim(_data) } //use jQuery because we can.
}
