Editor = function ()
{
  $.extend(this,
  {
    //generally important editor information:
    query: undefined,
    user_loggedin: undefined,
    data: undefined,
    sequence: undefined,
    //options passed in the URL
    options: undefined,
    //DOM items
    titlebox: undefined,
    infobox: undefined,
    //state items:
    stateflags: 0,
    initializeflag: 1,
    dataflag: 2,
    readyflag: 4,
    allgoflag: 8,
    pluginpolls: 0,

    //plugin management
    plugins: [],
  });
}

Editor.prototype = 
{
  //initialization function that is passed the query information.
  load: function()
  {
    //parse the URL options and push them into the options variable.
    editor.options = new Hash();
    var optionsarray = window.location.search.substr(1).split("&");
    for (var i = 0; i < optionsarray.length; i++)
    {
      var option = optionsarray[i].split("=");
      editor.options[option[0]] = option[1];
    };

    //request the sequence data the jQuery way.
    $.getJSON("/seq/" + editor.query, editor.ondata);
    editor.poll();
  },

  initialize:function()
  {
    //the dialog box and filesystem are components that depend on the DOM
    //but are not part of the plugin ecosystem.

    //initialize dialog box
    dialog.initialize();
    //initialize files stuff.
    //if (user_loggedin)
    //files.initialize();

    //set internal DOM elements.
    editor.titlebox = document.getElementById("titlebox");
    editor.infobox = document.getElementById("information");

    //broadcast to tell the plugins to initialize.
    editor.broadcast("initialize");
    editor.stateflags |= editor.initializeflag;
  },

  //process the sequence.
  ondata:function(data)
  {
    //use the xml jQuery object to find the sequence tag and use it.
    editor.data = new Hash(data);
    //link the sequence directly so it's a first-class citizen of "editor"
    editor.sequence = editor.data.sequence;
  
    if (editor.stateflags & editor.readyflag)
      //means that we are in a post-initialization state.
      //submit this information to the infobox.
      editor.titlebox.innerHTML = "<h2>" + editor.data.title + "</h2>" + editor.sequence.length + "bp";

    editor.broadcast("newdata");

    editor.stateflags |= editor.dataflag;
  },

  ready:function()
  //these are things that have to have both the initial data and the DOM set.
  {
    editor.titlebox.innerHTML = "<h2>" + editor.data.title + "</h2>" + editor.sequence.length + "bp";

    //set the state flag and announce to the other plugins. 
    editor.stateflags |= editor.readyflag;
    editor.broadcast("ready");
  },

  poll:function()
  {
    //check to see if we have DOM initialization and sequence data prepared.
    if (editor.stateflags == 3)
      editor.ready();

    //let's say we've already passed the ready checkpoint.
    if (editor.stateflags & editor.readyflag)
    {
      //check to see which plugins are stalled, save in a list.
      var stalledplugins = editor.stalledplugins();

      if (editor.pluginpolls++ > 20)
        throw new Error("plugins " + stalledplugins.join() + " have failed to initialize");

      if (stalledplugins.length == 0)
      {
        editor.stateflags |= editor.allgoflag;
        editor.broadcast("allsystemsgo");
        return;
      }
    }
    //repoll
    window.setTimeout(editor.poll, 100);
  },

  stalledplugins: function()
  {
    var stalledlist = [];
    for (var i = 0; i < editor.plugins.length; i++)
      if (!editor.plugins[i].isready)
        stalledlist.push(editor.plugins[i].title);
    return stalledlist;
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
  
  ////////////////////////////////////////////////////////
  // PLUGIN related functions

  broadcast: function(token, addenda)
  //distributes tokens to the plugins
  //Precondition: token contains a string
  //Postcondition:  broadcast creates a new token object of type string and passes it to all of the plugins.
  //Precondition: token is an editor.Token object
  //Postcondition:  broadcast passes it to all of the plugins.
  {
    token = (typeof token == "string") ? new editor.Token(token, addenda) : token;
    if (!(token instanceof editor.Token))
      throw new Error("attempted to broadcast a non-token object")

    for (var i = 0; i < editor.plugins.length; i++)
      editor.plugins[i].handletoken(token);
  },
};

////////////////////////////////////////////////////////////////////////////////////////////////
// EDITOR-subclassed objects

//create the editor variable as a new singleton Editor.
editor = new Editor();

//Menuitem object.  Contains display information and a callback for when clicked.
editor.MenuItem = function(html, callback)
{
  if (!html) html = "<hr>";  //simplifies the process of creating a 
  $.extend(this,{
    html: html, //what appears on the context menu.
    callback: callback, //callback should be a string describing the callback function
  });
},

//Token object.  These are informational objects that are to be distributed to all the plugins.
editor.Token = function(type, data)
{
  this.type = type;
  if (data)
    $.extend(this, data);
};

editor.Plugin = function(name, definition)
{
  //register the plugin with the editor.
  editor.plugins.push(this);

  $.extend(this,
  {
    title: name,
    isready: false,
    toolbarDOM: undefined,
  }, definition);
};

editor.Plugin.prototype = 
{
  //default ready function just sets isready to true.
  _ready: function() 
  {
    this.isready = true;
  },

  broadcast: function(token, addenda) 
  //Precondition: token contains a string or an 
  //Postcondition:  broadcast creates a new token object of type string and passes it to the editor
  // to brodacast to all of the plugins.
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

  maketoolbar: function(open)
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
};

/////////////////////////////////////////////////////////////////
// GLOBAL OVERRIDES

//set up the trigger to let it know that the DOM is ready.
$(document).ready(editor.initialize);

//override the context menu to suppress the native context menus.
window.oncontextmenu = function() {return false;}; 

/////////////////////////////////////////////////////////////////
// a cute wrapper to explicitly make objects Hashes.
// should only be used for pure hashes.  Use with caution!

Hash = function(object)
{
  if (object && (typeof object == 'function'))
    throw new Error(Hash.prototype.fnerror)
  if (object && (typeof object == 'object'))  //do an initial type check to see if this can be hashified.
  {                                           //if not, then you should return an empty hash {}.
    if (object instanceof Array)              //special case, we have passed an array.
    {
      var a = new Array();                    //create a new array that is going to go into our hash.
      for (var i = 0; i < object.length; i++) //iterate over the passed array.
        if (typeof object[i] != 'object' || object[i] == null)
          a.push(object[i]);                  //if it's a boring member, just push it onto the array
        else if (typeof object[i] == 'function')
          throw new Error(Hash.prototype.fnerror)
        else
          a.push(new Hash(object[i]));        //if it's an object member, call hash again.
      return a;                               //yes! you can effectively bypass the "new" by returning a value
    }                                         //this overrides the Hash object creation and keeps Arrays as is.
    else
    for (var o in object)                     //iterate over the objects in our source
    {
      if ((typeof object[o] != 'object') || object[o] == null)
        this[o] = object[o]                   //if it's boring, just add it to the hash.
      else if (typeof object[o] == 'function')
        throw new Error(Hash.prototype.fnerror)
      else
        this[o] = new Hash(object[o]);        //iterate hash-ification!
    };
  };
};

Hash.prototype =
{
  fnerror: "hashes do not take functions as values.",

  store: function(key, value) 
  {
    //adds the data stored in 'value' and clones it into our hash.
    switch (typeof value)
    {
      case 'object':
        if (value == null)
          this[key] = null;
        else
          this[key] = new Hash(value);  //clone the object itself. Also takes care of the array case.
      break;
      case 'function':
        throw new Error(Hash.prototype.fnerror)
      break;
      default:
        this[key] = null;
    }
    return this[key];
  },

  assoc: function(key)
  {  //based on the ruby function of the same name.
    return [key,this[key]];
  },

  clear: function()
  {
    for (var o in this)
      delete this[o];
    return this;
  },

  del: function(key)
  {
    delete this[key];
    return this;
  },

  flatten: function()
  {
    var result = [];
    for (var o in this)
    {
      result.push(o.toString());
      result.push(this[o]);
    }
    return result;
  },

  keys: function()
  {
    var result = [];
    for (var o in this)
      result.push(o.toString());
    return result;
  },

  values: function()
  {
    var result = [];
    for (var o in this)
      result.push(this[o]);
    return result;
  }
};