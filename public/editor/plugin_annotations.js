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
  //re-initialize the annotation fragments list.
  annotations.fragments = []; 

  //use the xml jQuery object to find the sequence tag and use it.
  $queriedxml.find("annotation").each(
    function()
    {
      var myannotation = 
        new Annotation($(this).attr("caption"),
                       $(this).attr("type"),
                       $(this).attr("domain"),
                       $(this).attr("id"));

      current_annotation = myannotation;

      $(this).children().each(
        function()
        {
          current_annotation.data[$(this).attr("type")] = new AnnoData($(this).text(), $(this).attr("id"));
        }
      );
    }
  );

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
  //if we're trying to pass an object instead of an index
  if (isNaN(i))
  {
    //reassign it to its index.
    i = annotations.annotations.indexOf(i);
  }

  var annotation = annotations.annotations[i];

  for (var j = 0; j < annotation.domain.ranges.length; j++)
  {
    var currentrange = annotation.domain.ranges[j];

    var span = currentrange.span();
    var orientation = currentrange.orientation;

    //check if it's really short.
    if (span.start_s == span.end_s)
    {
      //then there's only one fragment.
      annotations.fragments.push(new Fragment(
        span.start_s, span.start_p, span.end_p, orientation, annotation));
      graphics.invalidate(span.start_s);
    }
    else
    {
      //set up start fragment.
      annotations.fragments.push(new Fragment(
        span.start_s, span.start_p, graphics.settings.zoomlevel, orientation, annotation));
    
      graphics.invalidate(span.start_s);

      //if it's reaaaly long, then you have fill in middle fragments.
      if (span.start_s < span.end_s - 1)
      {
        for(var j = span.start_s + 1; j < span.end_s; j++)
        {
          annotations.fragments.push(new Fragment(
            j, 0, graphics.settings.zoomlevel, orientation, annotation));
            graphics.invalidate(j);
        }
      }
  
      //set up end fragment
      annotations.fragments.push(new Fragment(
        span.end_s, 0, span.end_p, orientation, annotation));
      graphics.invalidate(span.end_s);
    }
  }
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
      var cright = currentfragment.end*graphics.metrics.charwidth;

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
            currentannotation.toString() +
            " </span><br/>" + finalstring;

      annotations.addTip(graphicselement.content, currentannotation.caption, descriptionstring);

      //put it into the elements array.
      graphics.lines[token.line].push(graphicselement);
    }
  }
};

annotations.todelete = {};

annotations.contextmenu = function(token)
{
  switch (token.subtype)
  {
    case "annotations":
      annotations.todelete = token.ref;
      editor.addcontextmenuitem(new MenuItem("delete annotation", "annotations.deletemenu();"));
      editor.addcontextmenuitem(new MenuItem("edit annotation", "annotations.editdialog(" + 
        annotations.annotations.indexOf(token.ref) + ");"));
    break;
    case "selection":
      editor.addcontextmenuitem(new MenuItem(
        "create annotation", "annotations.createdialog(" + selection.range.datastring() + ");"))
    break;
  }
}

/////////////////////////////////////////////////////////////////
// DIALOGS and such

annotations.deletemenu = function()
{
  //set up the http request, jQuery way.
  $.ajax({
    type: 'DELETE',
    url: '/annotation/' + annotations.todelete.id,
    success: function() {
      //delete it!
      annotations.todelete.deleteme();
      //then, redraw.
      graphics.render();
    },
    error: function(a, b, e) {
      alert("delete failed; error: " + e);
    }
  });
}

annotations.editdialog = function(index)
{
  var oldannotation = annotations.annotations[index];

  dialog.show(annotations.dialogstring,
    function(){
      var newannotation = annotations.retrievenewfromdialog();
      //set up the http request, jQuery way.
      $.ajax({
        type: 'PATCH',
        url: '/annotation/' + oldannotation.id,
        data:
        {
          caption: newannotation.caption,
          type: newannotation.type,
          seqrange: newannotation.range.toGenBank(),
        },
        success: function(data) {
          //GET RID OF THE OLD ANNOTATION.
          oldannotation.deleteme();

          //INSTALL THE NEW ANNOTATION.
          newannotation.id = parseInt(data);

          annotations.generatefragments(newannotation);

          //REDRAW.
          graphics.render();
        },
        error: function(a, b, e) {alert("edit failed; error: " + e);}
    });
    },  
    new Function("annotations.filldialog('" + oldannotation.range.start + "','" +
      oldannotation.range.end + "','" +
      oldannotation.range.orientation + "','" +
      oldannotation.caption + "','" +
      oldannotation.type + "');")
  );
}

annotations.createdialog = function(start, end, orientation)
{
  dialog.show(annotations.dialogstring, 
    function() { //extract data from the annotations dialog box.
      var _orientation = document.getElementById("ann_d_orientation").value;
      var newannotation = annotations.retrievenewfromdialog();

      //send the new annotation the jquery way.
      $.post("/annotation/",
        {
          seqid: editor.sequence_id,
          caption: newannotation.caption,
          type: newannotation.type,
          seqrange: newannotation.range.toGenBank()
        },function(data){newannotation.id=parseInt(data);})

      annotations.generatefragments(newannotation);
      //redraw this thing.
      graphics.render();
    },
    new Function("annotations.filldialog('" + start + "','" + end + "','" + orientation + "')")
  )
}

annotations.retrievenewfromdialog = function()
{
  var orientation = document.getElementById("ann_d_orientation").value;
  var newannotation = new Annotation(
        document.getElementById("ann_d_caption").value, 
        document.getElementById("ann_d_type").value, 
        (orientation == -1 ? "complement(" : "") + 
        document.getElementById("ann_d_start").value + ".." +
        document.getElementById("ann_d_end").value +
        (orientation == -1 ? ")" : ""));
  return newannotation;
}

annotations.filldialog = function(start, end, orientation, caption, type)
{
  //caption and type DOM elements
  if (caption)
  {document.getElementById("ann_d_caption").value = caption;}
  if (type)
  {document.getElementById("ann_d_type").value = type;}
  
  //start and end DOM elements
  document.getElementById("ann_d_start").value = start;
  document.getElementById("ann_d_end").value = end;
  switch (parseInt(orientation))
  {
    case -1:
      document.getElementById("ann_d_rev").selected = true;
    break;
    case 0:
      document.getElementById("ann_d_und").selected = true;
    break;
    case 1:
      document.getElementById("ann_d_for").selected = true;
    break;
  }
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

  thisarrow.attr("class", ref.cssclass());
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

Annotation = function(_caption, _type, _domain, _id){
  var data = {
    //data that should be put in at the beginning.
    caption:_caption,
    type: _type,
    domain: new Domain(_domain),
    id: _id,
    data: {},

    //outputs the css class for such an annotation
    cssclass: function(i)
    {
      return [
        "annotation_reverse",
        "annotation_undirected",
        "annotation_forward "][this.domain.orientation + 1]
        + " ann_" + this.id + " annotation " + this.type;
    },

    toString: function()
    {
      return this.domain.toString();
    },

    deleteme: function()
    {
      //excise me from the annotations array.
      annotations.annotations.splice(annotations.annotations.indexOf(this), 1);
      //remove all my fragments from the fragments array.
      //NB count down to avoid having to do stupid decrement tricks.
      for (var i = annotations.fragments.length - 1; i >= 0; i--)
      {
        //check to see if we want to remove this.
        if ((i < annotations.fragments.length) && (annotations.fragments[i].ref == this))
        {
          //don't forget to invalidate this line.
          graphics.invalidate(annotations.fragments[i].line)
          annotations.fragments.splice(i,1);
        }
      };
    }
  }
  annotations.annotations.push(data);
  return data;
}

AnnoData = function (_data, _id){
  return { id:_id, data:$.trim(_data) } //use jQuery because we can.
}

////////////////////////////////////////////////////////////
// STRING CONSTANT

annotations.dialogstring = "caption: <input id='ann_d_caption'/><br/>" +
                           "type: <input id='ann_d_type'/><br/>" +
                           "range: <input id='ann_d_start'/>..<input id='ann_d_end'><br/>" +
                           "orientation: <select id='ann_d_orientation'>" +
                           "<option value='-1' id='ann_d_rev'>reverse</option>" +
                           "<option value='0' id='ann_d_und'>undirected</option>" +
                           "<option value='1' id='ann_d_for'>forward</option>";
