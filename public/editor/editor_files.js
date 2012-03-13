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

    //do it the jQuery way.
    $.post("/fork/" + newname, params, "application/x-www-form-urlencoded", function(data){ window.location = data; });
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
