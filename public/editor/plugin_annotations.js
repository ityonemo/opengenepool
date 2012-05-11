var annotations = new editor.Plugin("annotations",
{
  ////////////////////////////////////////////////////////////////////////
  // MEMBER VARIABLES

  //list of annotations
  annotations: [],
  annotip: {},
  fragments: [],

  //annotations typelist
  types: [],

  ////////////////////////////////////////////////////////////////////////
  // OVERLOADING TOKEN FUNCTIONS

  initialize: function()
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

    ////////////////////////////////////
    // GENERATE THE ANNOTATIONS TOOLBAR
    annotations.maketool();
  },

  //temporary variable to store current annotation.
  newsequence: function(token)
  {
    //re-initialize the annotation fragments list.
    annotations.fragments = []; 

    //a temporary variable.
    var current_annotation = {};

    //use the xml jQuery object to find the sequence tag and use it.
    $queriedxml.find("annotation").each(
      function()
      {
        var myannotation = new annotations.Annotation($(this).attr("caption"),
                                                      $(this).attr("type"),
                                                      $(this).attr("domain"),
                                                      $(this).attr("id"));

        //add the type to the type list.
        var type = $(this).attr("type");
        if (annotations.types.indexOf(type) < 0)
        {
          annotations.types.push(type);
          //populate the toolbar with this information.
          annotations.toolbardom.innerHTML += "<div class='annotoolbar' id='tb_" + type + "'>" + type + "</div>"
        }

        current_annotation = myannotation;

        $(this).children().each(
          function()
          {
            current_annotation.data[$(this).attr("type")] = new AnnoData($(this).text(), $(this).attr("id"));
          }
        );
      });

    //parse over the annotations array and split into graphically digestible
    //elements which will go into the "annofragments" array.

    if (!token.initial)  //we can't be guaranteed that the graphics have been initialized because this is asynchronous.
      for (var i = 0; i < annotations.annotations.length; i++)
        annotations.generatefragments(i);
  },

  ready: function()
  {
    for (var i = 0; i < annotations.annotations.length; i++)
      annotations.generatefragments(i);
    annotations.isready = true;
  },

  zoomed: function()
  {
    //re-initialize the annotation fragments list.
    annotations.fragments = []; 

    //parse over the annotations array and split into graphically digestible
    //elements which will go into the "annofragments" array.
    for (var i = 0; i < annotations.annotations.length; i++)
      annotations.generatefragments(i);
  },

  redraw: function(token)
  {
    //this is a really kludgey array parsing function.  Possibly consider
    //parsed into sub-arrays indexed by line, or sorted somehow.  OTOH
    //this might not really be worth the effort.
    
    var graphicsarray = [];

    for (var i = 0; i < annotations.fragments.length; i++)
    {
      var fragment = annotations.fragments[i];
      var annotation = annotations.fragments[i].ref;

      if (fragment.line == token.line)
      {
        //set left, right and height of our annotation arrow.
        var cleft = fragment.start*graphics.metrics.charwidth;
        var cright = fragment.end*graphics.metrics.charwidth;
        var height = graphics.metrics.lineheight;

        //create the graphics element.
        var graphicscontainer = graphics.newcontainer(token.line, "annotationfragment_" + i);
        annotations.createfragmentgraphic(graphicscontainer, cleft, cright, fragment.orientation, annotation);

        graphicscontainer.toppadding = ((((cright - cleft) < graphics.metrics.blockwidth) || (fragment.orientation == 0)) ? 
          graphics.metrics.lineheight / 5 : 0) + 1;
        graphicscontainer.bottompadding = graphicscontainer.toppadding;

        //generate a descriptive string for the tooltip.  Best to use either the 'note' or 'gene' attributes.
        var description = (annotation.data["note"] ? annotation.data["note"].data :
          (annotation.data["gene"] ? annotation.data["gene"].data + " gene" : ""));

        //set up the tooltip associated with the raphael object. 
        var tipstring = annotation.type + '<span class="' + (annotation.cssclass()) + '"> ' + 
              annotation.toString() + " </span><br/>" + description;
 
        annotations.addTip(graphicscontainer, annotation.caption, tipstring);
      }
    }
  },

  /////////////////////////////////////////////////////////////////////////////////////////////
  // NONTOKEN HELPER FUNCTIONS

  generatefragments: function(i)
  {
    //set the reference variable.
    var annotation;
    if (i instanceof annotations.Annotation)
      annotation = i; //we might be trying to pass an annotation variable directly.
    else
      annotation = annotations.annotations[i];  //find it in the array.

    for (var j = 0; j < annotation.ranges.length; j++) // seek through the array
    {
      var range = annotation.ranges[j];
      var span = new graphics.Span(range);
      var orientation = range.orientation;

      if (span.start_l == span.end_l)  //do we have a short fragment that only is one line?
      {
        annotations.fragments.push(
          $.extend(new graphics.Fragment(span.start_l, span.start_p, span.end_p, orientation),
            {ref: annotation}));
        annotations.broadcast("invalidate",{line: span.start_l});  //invalidate this line.
      }
      else
      {
        //set up the fragment on the starting line.
        //set up start fragment.
        annotations.fragments.push(
          $.extend(new graphics.Fragment(span.start_l, span.start_p, graphics.settings.zoomlevel, orientation),
            {ref: annotation}));    
        annotations.broadcast("invalidate",{line: span.start_l}); //invalidate this line.

        //if it's reaaaly long, then you have fill in middle fragments.
        if (span.start_l < span.end_l - 1)
          for(var k = span.start_l + 1; k < span.end_l; k++)
          {
            annotations.fragments.push(
              $.extend(new graphics.Fragment(k, 0, graphics.settings.zoomlevel, orientation),
                {ref: annotation}));
            annotations.broadcast("invalidate",{line: k});
          }

        //set up the fragment on the ending line
        annotations.fragments.push(
          $.extend(new graphics.Fragment(span.end_l, 0, span.end_p, orientation)
            , {ref: annotation}));
        annotations.broadcast("invalidate",{line: span.end_l});
      }
    }
  },

  createfragmentgraphic: function (container, left, right, type, ref)
  //type matches orientation specs - note that the graphics options might result in
  //arrow ends not reflecting orientation at line breaks.
  {
    var arrow = {};
    var height = graphics.metrics.lineheight;
    var arrowedge = graphics.metrics.lineheight / 5; //space between bottom and arrow body, arrow body and top.
  
    if (((right - left) < graphics.metrics.blockwidth) || (type == 0))
    {
      arrow = container.rect(left,-height + arrowedge,right-left,height - arrowedge * 2);
      container.toppadding = arrowedge;
      container.bottompadding = arrowedge;
    }
    else
      switch (type)
      {
        case -1:
          arrow = container.path(
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
          arrow = container.path(
            "M " + right.toString() + " " + (-height / 2).toString() +
            " L " + (right - graphics.metrics.blockwidth).toString() + " 0 " +
            " V " + -arrowedge.toString() +
            " H " + left.toString() +
            " V " + (-height + arrowedge).toString() +
            " H " + (right - graphics.metrics.blockwidth).toString() +
            " V " + (-height).toString() +
            " Z");
        break;
      }

    arrow.ref = ref;
    $(arrow).attr("class", ref.cssclass());
  
    $(arrow).mousedown(
      function(e)
      {
        if (!e) var e = window.event;
        if (e.which) rightclick = (e.which == 3);
        else if (e.button) rightclick = (e.button == 2);

        if (rightclick)
        {
          editor.showcontextmenu(event);
          annotations.broadcast("contextmenu",{ref:ref});

          //for aesthetic purpsoses, hide the annotatation tooltip.
          annotations.hideTip();
        }
        else //normal click triggers selection of underlying sequence
        {
          var token = new editor.Token(e.shiftKey ? "appendselect" : "select");
          token.domain = arrow.ref.toString();
          annotations.broadcast(token);
        }
      });
  },

  ////////////////////////////////////////////////////////////////////////////////
  // TOOLTIP BLUES

  tipover: false,
  addTip: function(element, title, text)
  {
    //jQuery based craziness that associates callback functions with the
    //selected annotation segment.  jQuery is necessary to deal with overlapping
    //mouseover/mouseout insanity and resolve to simple functions.
    $(element).mouseover(
      function(){
        document.getElementById("annotip_title").innerHTML=title;
        document.getElementById("annotip_text").innerHTML="<br/>" + text;
        $("#annotip").css("display","block");
        annotations.tipover = true;
      })
    $(element).mouseout(
      function()
      {
        annotations.hideTip()
      });
    $(element).mousemove(
      function(e)
      {
        $("#annotip")
          .css("left",(e.clientX+20).toString() + "px")
          .css("top",(e.clientY+20).toString() + "px");
      }); 
  },

  hideTip: function()
  {
    $("#annotip").css("display","none");
    annotations.tipover = false;
  },
});

/*
annotations.todelete = {};

annotations.contextmenu = function(token)
{
  switch (token.subtype)
  {
    case "annotations":
      annotations.todelete = token.ref;
      if (user_loggedin)
      {
        editor.addcontextmenuitem(new MenuItem("delete annotation", "annotations.deletemenu();"));
        editor.addcontextmenuitem(new MenuItem("edit annotation", "annotations.editdialog(" + 
          annotations.annotations.indexOf(token.ref) + ");"));
      }
    break;
    case "selection":
      if (user_loggedin)
        editor.addcontextmenuitem(new MenuItem("create annotation", "annotations.createdialog();"))
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

  dialog.show(annotations.dialogstring(oldannotation),
    function(){
      var newannotation = annotations.parsedialog();
      //set up the http request, jQuery way.
      $.ajax({
        type: 'PATCH',
        url: '/annotation/' + oldannotation.id,
        data:
        {
          caption: newannotation.caption,
          type: newannotation.type,
          domain: newannotation.domain.toString(),
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
    });
}

annotations.createdialog = function(domain)
{
  dialog.show(annotations.dialogstring(),
    function() { //extract data from the annotations dialog box.
      var newannotation = annotations.parsedialog();

      //send the new annotation the jquery way.
      $.post("/annotation/",(editor.sequence.length % graphics.settings.zoomlevel) * graphics.metrics.charwidth
        {
          seqid: editor.sequence_id,
          caption: newannotation.caption,
          type: newannotation.type,
          domain: newannotation.domain.toString(),
        },
        function(data){
          newannotation.id=parseInt(data);
          annotations.generatefragments(newannotation);
          //redraw this thing.
          graphics.render();
        });
    }, function() { //grab the selection data if applicable.
      if (selection.isselected)
      {
        var target = document.getElementById('ann_d_rangelist');
        var dialogranges = selection.domain.ranges.length;
        document.getElementById('ann_d_ranges').value = dialogranges;
        target.innerHTML="";
        //set up the ranges
        for (var i = 0; i < dialogranges; i++)
        {
          //WHAT?? yes, this works because selection looks quite a bit like an annotation.
          target.innerHTML += annotations.rangeblock(i, selection);
        }
      }
    }
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
}*/

////////////////////////////////////////////////////////////////////////
// HELPER OBJECTS

annotations.Annotation = function(_caption, _type, _domain, _id)
{
  $.extend(this,new Domain(_domain));
  $.extend(this,
  {
    //further information.
    caption: _caption,
    type: _type,
    id: _id,
    data: {},

    cssclass: function()
    {
      return "annotation " + this.type + " " + "annotation_" + this.id;
    },

    deleteme: function()
    {
      //remove from the annotations array.
      annotations.annotations.splice(annotation.annotations.indexOf(annotation),1);
      //remove fragments from the fragments array
      //count down to avoid stupid decrement tricks.
      for (var i = annotations.fragments.length - 1; i >= 0; i--)
        if ((i < annotations.fragments.length) && (annotations.fragments[i].ref == this)) //check if it corresponds
        {
          graphics.invalidate(annotations.fragments[i].line); //post the invalidation.
          annotations.fragments.splice(i,1); //delete it!
        }
    },
  });

  annotations.annotations.push(this);  //push on construction.
}

AnnoData = function (_data, _id){
  return { id:_id, data:$.trim(_data) } //use jQuery because we can.
}
/*
////////////////////////////////////////////////////////////
// DIALOG GENERATION

annotations.dialogstring = function(annotation)
{
  //this is common to all annotation dialog boxes.
  var output = 
  "caption: <input id='ann_d_caption' value='" + (annotation ? annotation.caption : "") + "'><br>" +
  "type: <input id='ann_d_type' value='" + (annotation ? annotation.type : "") + "'><br>";
  
  //calculate how many ranges we'll have to account for.
  var dialogranges = (annotation ? annotation.domain.ranges.length : 1);

  output += "<input id='ann_d_ranges' type='hidden' value='" + dialogranges + "'>";

  output += "<details open='open'><summary>ranges:</summary>";

  output += "<div id='ann_d_rangelist'>"
  //set up the ranges
  for (var i = 0; i < dialogranges; i++)
  {
    output += annotations.rangeblock(i, annotation);
  }

  output += "</div>";

  //set up the range increment button
  output += "<button type='button' onclick='annotations.addrange();'> add a range </button>";
  output += "</details>";

  //next set up the further information.
  output += "<details><summary>data:</summary>"
  if (annotation) for (data in annotation.data)
  {
    output += "<input value='" + data + "'> : <input value='" + annotation.data[data].data + "'>";
    output += "<button type='button'>delete</button>";
  }
  output += "<button type='button'>add data</button>";
  output += "</details>";

  //spit out our accumulated string.
  return output;
};

annotations.addrange = function()
{
  var enclosing = document.getElementById("ann_d_rangelist");
  var counter = document.getElementById("ann_d_ranges");
  var index = parseInt(counter.value);
  counter.value = index + 1;
  enclosing.innerHTML += "<hr>" + annotations.rangeblock(index);
}

annotations.rangeblock = function(i, annotation)
{
  //delivers a block of HTML range based on an index number.
  return "<div id='ann_d_range" + i + "'>" + 
  "location: <input id='ann_d_start" + i + "' value='" + (annotation ? annotation.domain.ranges[i].start : "") + "'>" +
  " .. <input id='ann_d_end" + i + "' value='" + (annotation ? annotation.domain.ranges[i].end : "") + "'>" +
  "orientation: <select id='ann_d_orientation" + i + "'>" +
  (annotation ?
  "<option value='-1' id='ann_d_rev" + i + "'"+ ((annotation.domain.ranges[i].orientation === -1) ? "selected" : "") + ">minus</option>" +
  "<option value='0' id='ann_d_und" + i + "'"+ ((annotation.domain.ranges[i].orientation === 0) ? "selected" : "") + ">undirected</option>" +
  "<option value='1' id='ann_d_for" + i + "'"+ ((annotation.domain.ranges[i].orientation === 1) ? "selected" : "") + ">plus</option>"
  :
  "<option value='-1' id='ann_d_rev" + i + "'>minus</option>" +
  "<option value='0' id='ann_d_und" + i + "'>undirected</option>" +
  "<option value='1' id='ann_d_for" + i + "' selected>plus</option>"
  ) + 
  "</select>" +
  ((i == 0) ? "" : "<button type='button' onclick='annotations.killrange(" + i + ");'> delete </button>") +
  "</div>";
}

annotations.parsedialog = function()
{
  var caption = document.getElementById("ann_d_caption").value;
  var type = document.getElementById("ann_d_type").value;
  var rangecount = parseInt(document.getElementById("ann_d_ranges").value);
  var domain = new Domain();

  //fill out ranges
  for (var i = 0; i < rangecount; i++)
  {
    var start = parseInt(document.getElementById("ann_d_start" + i).value);
    var end = parseInt(document.getElementById("ann_d_end" + i).value);
    var orientation = parseInt(document.getElementById("ann_d_orientation" + i).value);

    domain.push(new Range(start, end, orientation));
  }

  //then do the additional data stuff.

  return new Annotation(caption, type, domain.toString());
}*/

