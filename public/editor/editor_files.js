var files =
{
  //member variables:
  workspace:{
    data: {},
    dom: {},
  },

  initialize: function()
  {
    //let's make sure that we have a user, otherwise these functions don't make sense.
    if (user_loggedin)
    { 
      document.getElementById("forkbutton").onclick = files.forkall;
      files.workspace.dom = document.getElementById("workspace_content");

      //post the request to fork the construct the jQuery way.
      $.getJSON("/workspace/", function(data)
      {
        files.workspace.data = data;
        files.populateworkspace();
      });
    };
  },

  populateworkspace: function()
  {
    var htmlstring = "";
    //takes the workspace element and populates it with the current workspace data.
    for (var i = 0; i < files.workspace.data.length; i++)
    {
      htmlstring += "<a href='/editor/id=" + files.workspace.data[i].id + "' class='wksp_link'>" +
        files.workspace.data[i].title + "</a><br>"
    }
    files.workspace.dom.innerHTML = htmlstring;
  },

  forkall: function()
  {
    dialog.show("new construct name: <input id='newtitle'/>", function()
    {
      files.fork(document.getElementById("newtitle").value)
    });
  },

  fork: function(newname, range)
  {
    //set up the params object.
    var params = { sourceid: editor.sequence_id };
    if (range)
    {
      params.start = range.start; 
      params.end = range.end;
      params.orientation = ((range.orientation == "1") ? "forward" : "reverse");
    };

    //post the request to fork the construct the jQuery way.
    $.post("/fork/" + newname, params, function(data){window.location = "/editor/id=" + data; });
  },

  addtoroot: function()
  {
    alert("add to root!");
  },

  addtowksp: function()
  {
    alert("add to workspace!");
  }
}
