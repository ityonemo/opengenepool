// basic plugin architecture.  Unless otherwise indicated, no plugin is 
// required to implement any of these functions, the editor will always 
// do a check to make sure that the function exists before calling it.

var _plugin =
{
  //REQUIRED:
  register: function() {}
  //register the plugin with the editor architecture.  All global variables and functions
  //should be available, and the global DOM architecture should be available.  No guarantees
  //that any other plugin is available.  Outputs false if failed, if failed, then the
  //plugin will be deleted, so that other plugins do not detect it.

  postregister: function() {}
  //call this function after all the plugins have registered.  A plugin should use this
  //if it has initialization that is dependent on another plugin.

  calculatemetrics: function() {}
  //some sort of format change has triggered a need to recalculate the graphics metrics of
  //this plugin.
}
