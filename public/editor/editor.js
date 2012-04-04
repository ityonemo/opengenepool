var editor =
{
  sequence_id: 0, 	//the sequence id number that is used.
  sequence_name: "",	//the name used to send the AJAX query
  queryresult: "",	//the raw output from the AJAX query
  $queriedxml: {},	//jQuery-processed AJAX query xml
  sequence: "",		//the actual sequence

  //DOM items
  infobox: {},

  //plugin management
  plugins: [],

  //initialization function that is passed a list of plugins from sinatra.
  load: function(query)
  {
    //check to see if we're embedding the request as an ID value.
    //then set up the AJAX query to retrieve the information

    if (query.substring(0,3) == "id=")
    { 
      this.sequence_id = query.substring(3);
    }
    else
    {
      this.sequence = query;    
    }

    //request the sequence data the jQuery way.

    $.get("/seq/" + query, "", editor.processsequence, "xml");

    //disable context menus.
    window.oncontextmenu = function () {return false;}
  },

  //process the sequence.
  processsequence:function(data)
  {
    $queriedxml = $(data);

    //use the xml jQuery object to find the sequence tag and use it.
    editor.sequence = $(data).find("sequence").text().trim();
    editor.sequence_name = $(data).find("title").text().trim();
    editor.sequence_id = parseInt($(data).find("id").text().trim());
    
    //submit this information to the infobox.
    var innerbox = document.getElementById("innerbox");
    innerbox.innerHTML = "<h2>" + editor.sequence_name + "</h2>" + editor.sequence.length + "bp";
        
    //assign relevant dom items
    editor.infobox = document.getElementById("information");

    editor.initializecomponents();
  },

  initializecomponents: function()
  {
    //pass control to the graphics initialization routine.
    //nb there will be a further asynchronous call beyond this one.
    graphics.initialize();
    //initialize dialog box
    dialog.initialize();
    //initialize files stuff.
    files.initialize();
  },
  
  //distributes tokens to the plugins.
  broadcasttoken:function(token)
  {
    for (var i = 0; i < plugins.length; i++)
    {
      plugins[i].handletoken(token);
    }
  },

  //export the image as svg:
  getsvg: function()
  {
    //TODO: check to see if raphael is in svg mode.
    mywindow = window.open("","svg output");
    mywindow.document.write("<code>");  //flank the output with code to make it look nice.
    mywindow.document.write(document.getElementById("editor").innerHTML.split("&").join("&amp;").split( "<").join("&lt;").split(">").join("&gt;"));  //substitute &, <, and > for proper HTML characters
    mywindow.document.write("</code>"); //end code tag
  },

  //retrieve a subsequence.
  subsequence: function(domain)
  {
    var output = "";
    for (var i = 0; i < domain.ranges.length; i++)
    {
      var range = domain.ranges[i];
      if (range.orientation == 1)
      { output += editor.sequence.substring(range.start, range.end); }
      else
      { output += reversecomplement(editor.sequence.substring(range.start, range.end)); }
    }
    return output;
  },

  //////////////////////////////////////////////////////////////////////
  // CONTEXT MENU STUFF
  context_menu_visible: false,
  context_menu_array: [],  //array of menuitems.

  addcontextmenuitem: function(what) {editor.context_menu_array.push(what)}, //synonymous call.

  showcontextmenu: function(x, y)
  {
    //make sure that there actually context menu items to show.
    if (editor.context_menu_array.length > 0)
    {
      //create the context menu.
      //get the context menu DOM object.
      var contextmenu = document.getElementById("contextmenu");
      //clear the context menu.
      contextmenu.innerHTML = "";
      for (i = 0; i < editor.context_menu_array.length; i++)
      {
        var menuitem = editor.context_menu_array[i];
        childdiv = document.createElement("div");
        childdiv.innerHTML = menuitem.html;
        childdiv.onclick = new Function(menuitem.callback + "editor.hidecontextmenu();");  //set up the correct onclick.
        childdiv.setAttribute("class","menuitem");
        contextmenu.appendChild(childdiv);
      };

      //actually show the context menu:
      $("#contextmenu")
        .css("left",(x - 5).toString() + "px")
        .css("top",(y - 5).toString() + "px")
        .css("display","block");
      //set the context menu visibility flag
      editor.context_menu_visible = true;
    }
  },

  hidecontextmenu: function()
  {
    //hide the context menu:
    $("#contextmenu").css("display", "none");
    //reset the context menu visibility flag
    editor.context_menu_visible = false;
  },
};

document.onclick = function()
{
  editor.hidecontextmenu();
}

//////////////////////////////////////////////////////////////////////
// CONTEXT MENU STUFF


//Token object.  These are informational objects that are to be distributed to all the plugins.
Token = function(_type)
{
  return {
    type: _type
  }
};

//create the base plugin object.
Plugin = function(_name)
{
  return {
    title: _name,

    handletoken: function(token)
    {
      if (this[token.type])
      {
        this[token.type](token);
      }
    },

    sendcontextmenu: function(x, y, ref, data, savemenu)
    {
      if (!savemenu) {editor.context_menu_array = [];};
      //set up values for the token.
      token = new Token("contextmenu");
      token.x = x;
      token.y = y;
      token.subtype = this.title;
      token.ref = ref;
      //tell the plugins about the context menu.
      editor.broadcasttoken(token);
      editor.showcontextmenu(x, y);
    },

    toolbardom: {},
    maketool: function(open)
    {
      var container = document.getElementById("toolbar");
      var outside = document.createElement("div");
      outside.setAttribute("id", this.title + "_toolbar");
      outside.setAttribute("class","toolitem");
      var details = document.createElement("details");
      if (open) details.setAttribute("open", "open");
      var summary = document.createElement("summary");
      summary.innerHTML = this.title;
      
      container.appendChild(outside);
      outside.appendChild(details);
      details.appendChild(summary);
      
      this.toolbardom = details;
    }
  }
}

//menuitem object

MenuItem = function(_html, _callback)
{
  return {
    html: _html, //what appears on the context menu.
    callback: _callback, //callback should be a string described function
  }
}
