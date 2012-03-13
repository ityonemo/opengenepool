var files = {
  initialize: function()
  {
    
  },

  forkall: function()
  {
    files.fork("test");
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
