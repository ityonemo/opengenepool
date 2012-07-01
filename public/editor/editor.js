var editor = new function Editor()
{
  $.extend(this,
  {
    sequence_id: 0, 	//the sequence id number that is used.
    sequence_name: "",	//the name used to send the AJAX query
    queryresult: "",	//the raw output from the AJAX query
    $queriedxml: {},	//jQuery-processed AJAX query xml
    sequence: "",		//the actual sequence
    asgcount: 0,	//how many times we have gone through all systems go.

    //DOM items
    infobox: {},

    //plugin management
    plugins: [],

    //initialization function that is passed the query information.
    load: function(query)
    {
      //check to see if we're embedding the request as an ID value.
      //then set up the AJAX query to retrieve the information

      if (query.substring(0,3) == "id=")
        editor.sequence_id = query.substring(3);
      else
        editor.sequence = query;

      //request the sequence data the jQuery way.
      $.get("/seq/" + query, "", editor.onsequence, "xml");
    },

    initialize:function()
    {
      //the dialog box and filesystem are components that depend on the DOM
      //but are not part of the ecosystem.

      //TODO: really think about cutting out the files.initialize() directive here
      //in the case of non-login user.

      //initialize dialog box
      dialog.initialize();
      //initialize files stuff.
      //files.initialize();

      //broadcast to tell the plugins to initialize.
      editor.broadcast("initialize");
    },

    //process the sequence.
    onsequence:function(data)
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

      //editor.initializecomponents();
      editor.broadcast("newsequence",{initial:true});

      editor.onready();
    },

    onready:function()
    {
      //block until the graphics settings have arrived.
      if (graphics.initstate.sequence && graphics.initstate.resize)
        editor._onready();
      else
        window.setTimeout(editor.onready, 100);
    },

    _onready:function()
    {
      editor.broadcast("ready");
      editor.allsystemsgo()
    },

    allsystemsgo:function()
    {
      if (editor.asgcount++ > 20) 
      {
        editor.findbrokenplugins();
        alert("ERROR: plugins " + editor.brokenplugins.join(" ") + " have failed initialization");
        return;
      };

      for (var i = 0; i < editor.plugins.length; i++)
        if (!editor.plugins[i].isready)
        {
          window.setTimeout(editor.allsystemsgo, 100);
          return;
        }
      editor._allsystemsgo()
    },

    _allsystemsgo: function()
    { editor.broadcast("allsystemsgo"); },

    findbrokenplugins: function()
    {
      editor.brokenplugins = [];
      for (var i = 0; i < editor.plugins.length; i++)
        if (!editor.plugins[i].isready)
          editor.brokenplugins.push(editor.plugins[i].title);
    },

    /////////////////////////////////////////////////////////////////////////////////////////////
    // Utility functions.

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

    //life cycle of the context menu:  showcontextmenu gets called.
    //(ideally) calling object propagates a "contextmenu" token.
    //responders push contextmenuitems using addcontextmenu function.
    //wait for click, then hidecontextmenu.

    showcontextmenu: function(event)
    {
      var x = event.clientX, y = event.clientY;

      //create the context menu.
      //get the context menu DOM object.
      var contextmenu = document.getElementById("contextmenu");
      //clear the context menu.
      contextmenu.innerHTML = "";

      //actually show the context menu:
      $("#contextmenu")
        .css("left",(x - 5).toString() + "px")
        .css("top",(y - 5).toString() + "px")
        .css("display","block");
      //set the context menu visibility flag
      editor.context_menu_visible = true;
      //create a hook for window to close the context menu on finish.
      window.addEventListener("click",editor.hidecontextmenu);
    },

    addcontextmenuitem: function(menuitem) 
    //puts a context menu object into the menu.
    {
      if (editor.context_menu_visible)
      {
        var contextmenu = document.getElementById("contextmenu");

        //first check to see if we're adding an <hr> element.
        if (menuitem.html == "<hr>")
        {
          //reject if it's the first object.
          if (contextmenu.innerHTML == "") return;
          //reject if the last object is also an <hr> element.
          if (contextmenu.lastChild.innerHTML == "<hr>") return;
        }

        var childdiv = document.createElement("div");
        childdiv.innerHTML = menuitem.html;
        if (menuitem.callback)
          childdiv.onclick = menuitem.callback;
        childdiv.setAttribute("class","menuitem");
        contextmenu.appendChild(childdiv);
      }
    },

    hidecontextmenu: function()
    {
      //hide the context menu:
      $("#contextmenu").css("display", "none");
      //reset the context menu visibility flag
      editor.context_menu_visible = false;
      //clear the event listener.
      window.removeEventListener("click", editor.hidecontextmenu);
    },

    //menuitem object
    MenuItem: function(html, callback)
    {
      if (!html) html = "<hr>";
      $.extend(this,{
        html: html, //what appears on the context menu.
        callback: callback, //callback should be a string describing the callback function
      });
    },
  
    ////////////////////////////////////////////////////////
    // PLUGIN functions

    broadcast: function(token, addenda)
    //distributes tokens to the plugins
    //Precondition: token contains a string
    //Postcondition:  broadcast creates a new token object of type string and passes it to all of the plugins.
    //Precondition: token is an editor.Token object
    //Postcondition:  broadcast passes it to all of the plugins.
    {
      token = (typeof token == "string") ? new editor.Token(token, addenda) : token;

      for (var i = 0; i < editor.plugins.length; i++)
        editor.plugins[i].handletoken(token);
    },
  });

  //Token object.  These are informational objects that are to be distributed to all the plugins.
  this.Token = function(type, data)
  {
    this.type = type;
    if (data)
      $.extend(this, data);
  };

  this.Plugin = function(_name, definition)
  {
    //register the plugin with the editor.
    editor.plugins.push(this);

    $.extend(this,
    {
      title: _name,

      //default ready function just sets isready to true.
      ready: function() 
      {
        this.isready = true;
      },
      isready: false,

      broadcast: function(token, addenda) 
      //Precondition: token contains a string
      //Postcondition:  broadcast creates a new token object of type string and passes it to all of the plugins.
      //Precondition: token is an editor.Token object
      //Postcondition:  broadcast passes it to all of the plugins.
      {
        var mytoken = (typeof token == "string") ? new editor.Token(token, addenda) : token;
        mytoken.source = this.title;
        editor.broadcast(mytoken);
      },

      handletoken: function(token)
      {
        if ((typeof this["_" + token.type]) == 'function') //check to make sure the object actually has this function.
        {
          //execute it and pass it the token.
          this["_" + token.type](token);
        }
      },

      toolbardom: {},
      maketool: function(open)
      {
        var container = document.getElementById("toolbar");
        var outside = document.createElement("div");
        outside.setAttribute("class","toolitem");

        var details = document.createElement("details");
        details.setAttribute("id", this.title + "_toolbar");

        if (open) details.setAttribute("open", "open");
        var summary = document.createElement("summary");
        summary.innerHTML = this.title + "<p>";  //the paragraph tag provides an elegant fallback for browsers which don't support the details/summary tags.
      
        container.appendChild(outside);
        outside.appendChild(details);
        details.appendChild(summary);
    
        this.toolbardom = details;
      }
    });
    //append the coded definition to the end of the object.
    $.extend(this, definition);
  };

  //RESTful interface object
  this.REST = function(URL)
  {
    $.extend(this,
    {
      URL: URL,
      get: function(id)
      {
        var request = new XMLHttpRequest();  
        request.open('GET', URL + id, false);  
        request.send();  
        return eval("(" + request.responseText + ")"); 
      },

      post: function(what)
      {
        var request = new XMLHttpRequest();
        var params = "";

        for (data in what)
          params += data + "=" + what[data] + "&";

        request.open('POST', URL, false);
        request.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        request.send(params);

        return eval("(" + request.responseText + ")");
      },

      patch: function(id, what) 
      {
        var request = new XMLHttpRequest();
        var params = "";

        for (data in what)
          params += data + "=" + what[data] + "&";

        request.open('PATCH', URL + id, false);
        request.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        request.send(params);

        return eval("(" + request.responseText + ")");
      },

      _delete: function(id) 
      {  //NB, "delete" function does not respond with a javascript object.
        var request = new XMLHttpRequest();

        request.open('DELETE', URL, false);
        request.send();

        return request.responseText;
      },
    });
  };
};

/////////////////////////////////////////////////////////////////
// GLOBAL OVERRIDES

//set up the trigger to let it know that the DOM is ready.
document.onready = editor.initialize;

document.onclick = function() { editor.hidecontextmenu(); }
window.oncontextmenu = function() {return false;}
