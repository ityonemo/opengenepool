var editor =
{
  sequence_id: 0, 	//the sequence id number that is used.
  sequence_name: "",	//the name used to send the AJAX query
  queryresult: "",	//the raw output from the AJAX query
  queriedxml: {},	//jQuery-processed AJAX query xml
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

    //prepare HTTP request object.
    var xmlhttp = new XMLHttpRequest();

    //set the AJAX wait response.
    xmlhttp.onreadystatechange=
    function()
    {
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200)
      {
        editor.queryresult = xmlhttp.responseText;
        //use jQuery to parse the XML of the query.
        var xdoc = $.parseXML(editor.queryresult);
        queriedxml = $(xdoc);
          
        //use the xml jQuery object to find the sequence tag and use it.
        editor.sequence = queriedxml.find("sequence").text().trim();
        editor.sequence_name = queriedxml.find("title").text().trim();
        editor.sequence_id = parseInt(queriedxml.find("id").text().trim());

        //submit this information to the infobox.
        var innerbox = document.getElementById("innerbox");
        innerbox.innerHTML = "<h2>" + editor.sequence_name + "</h2>" + editor.sequence.length + "bp";
        
        //assign relevant dom items
        editor.infobox = document.getElementById("information");

        //pass control to the graphics initialization routine.  This routine should return to the 'graphicsinitcallback'
        //function, since graphics initialization requires asynchronous events.
        graphics.initialize();

      }
    }

    //send the AJAX query.  here we are passing the 'id/name-detection' buck to the seq.rb file.
    xmlhttp.open("GET","/seq/" + query,true);
    xmlhttp.send();

    //disable context menus.
    window.oncontextmenu = function () {return false;}
  },

  //distributes tokens to the plugins.
  broadcasttoken:function(token)
  {
    for (var i = 0; i < plugins.length; i++)
    {
      plugins[i].handletoken(token);
    }
  },

  //upon complete initialization of the graphics routine, then proceed to initialize the plugins.
  //also tell all the components that there is a new sequence.
  graphicsinitcallback: function()
  {
    graphics.setmetrics();
    graphics.newsequence();
    editor.broadcasttoken(new Token("initialize"));
    editor.broadcasttoken(new Token("newsequence"));
    graphics.render();
  },

  //export the image as svg:
  getsvg: function()
  {
    mywindow = window.open("","svg output");
    mywindow.document.write("<code>");  //flank the output with code to make it look nice.
    mywindow.document.write(document.getElementById("editor").innerHTML.split("&").join("&amp;").split( "<").join("&lt;").split(">").join("&gt;"));  //substitute &, <, and > for proper HTML characters
    mywindow.document.write("</code>"); //end code tag
  },

  //retrieve a subsequence.
  subsequence: function(range)
  {
    if (range.orientation == 1)
    { return editor.sequence.substring(range.start - 1, range.end); }
    else
    { return reversecomplement(editor.sequence.substring(range.start - 1, range.end)); }
  },

  //////////////////////////////////////////////////////////////////////
  // CONTEXT MENU STUFF
  context_menu_visible: false,
  context_menu_array: [],  //array of menuitems.

  addcontextmenuitem: function(what) {editor.context_menu_array.push(what)}, //synonymous call.

  showcontextmenu: function(x, y)
  {
    //populate the context menu array.
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
  },

  hidecontextmenu: function()
  {
    //hide the context menu:
    $("#contextmenu").css("display", "none");
    //reset the context menu visibility flag
    editor.context_menu_visible = false;
  },

  fork: function()
  {
    alert("fork!");
  }
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

    sendcontextmenu: function(x, y, ref, savemenu)
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
