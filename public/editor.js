var editor =
{
  sequence_id: 0, 	//the sequence id number that is used.
  sequence_name: "",	//the name used to send the AJAX query
  queryresult: "",	//the raw output from the AJAX query
  queriedxml: {},	//jQuery-processed AJAX query xml
  sequence: "",		//the actual sequence

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
        editor.sequence_name = queriedxml.find("name").text().trim();
        editor.sequence_id = parseInt(queriedxml.find("id").text().trim());

        //submit this information to the infobox.
        var infobox = document.getElementById("infobox");
        infobox.innerHTML = "<h2>" + editor.sequence_name + "</h2>" + editor.sequence.length + "bp";
        
        //pass control to the graphics initialization routine.  This routine should return to the 'graphicsinitcallback'
        //function, since graphics initialization requires asynchronous events.
        graphics.initialize();
      }
    }

    //send the AJAX query.  here we are passing the 'id/name-detection' buck to the seq.rb file.
    xmlhttp.open("GET","../seq/" + query,true);
    xmlhttp.send();
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
    mywindow.document.write("<code>");
    mywindow.document.write(document.getElementById("editor").innerHTML.split("&").join("&amp;").split( "<").join("&lt;").split(">").join("&gt;"));
    mywindow.document.write("</code>");
  }
};

//Token object.  These are informational objects that are to be distributed to all the plugins.
Token = function(_type)
{
  return {
    type: _type
  }
};

//create the base plugin object.
Plugin = function()
{
  return {
    handletoken: function(token)
    {
      if (this[token.type])
      {
        this[token.type](token);
      }
    },
  }
}
